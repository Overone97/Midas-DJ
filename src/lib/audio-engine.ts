'use client';

import { useSyncExternalStore } from 'react';
import type { PlaybackPreview } from '@/lib/rooms';
import { YouTubeAudioAdapter } from '@/lib/youtube-audio-adapter';

export type EnginePlaybackState = 'idle' | 'loading' | 'ready' | 'playing' | 'buffering' | 'paused' | 'ended' | 'error';
export type EngineHealth = 'ok' | 'stalled' | 'recovering' | 'failed';
export type SyncReason = 'initial-load' | 'track-change' | 'drift' | 'resume' | 'recovery' | 'pause-sync';

export type AudioTrackReference = {
  roomId?: string | null;
  trackId: string;
  youtubeVideoId: string;
};

export type AudioEngineState = {
  roomId: string | null;
  trackId: string | null;
  youtubeVideoId: string | null;
  playbackState: EnginePlaybackState;
  health: EngineHealth;
  targetOffsetSeconds: number;
  actualOffsetSeconds: number;
  driftSeconds: number;
  volume: number;
  muted: boolean;
  hasUserGesture: boolean;
  lastProgressAt: number | null;
  lastSyncAt: number | null;
  recoveryAttempts: number;
  errorCode?: string;
  errorMessage?: string;
};

const initialState: AudioEngineState = {
  roomId: null,
  trackId: null,
  youtubeVideoId: null,
  playbackState: 'idle',
  health: 'ok',
  targetOffsetSeconds: 0,
  actualOffsetSeconds: 0,
  driftSeconds: 0,
  volume: 80,
  muted: false,
  hasUserGesture: false,
  lastProgressAt: null,
  lastSyncAt: null,
  recoveryAttempts: 0,
};

function computeExpectedOffset(playback?: PlaybackPreview | null) {
  if (!playback) {
    return 0;
  }

  if (playback.state !== 'playing' || !playback.startedAt) {
    return playback.offsetSeconds;
  }

  const elapsed = Math.max(0, (Date.now() - new Date(playback.startedAt).getTime()) / 1000);
  return playback.offsetSeconds + elapsed;
}

function clampVolume(volume: number) {
  return Math.max(0, Math.min(100, Math.round(volume)));
}

export class AudioEngine {
  private adapter: YouTubeAudioAdapter | null = null;
  private listeners = new Set<() => void>();
  private cleanupFns: Array<() => void> = [];
  private heartbeatId: number | null = null;
  private state: AudioEngineState = initialState;
  private playback: PlaybackPreview | null = null;
  private track: AudioTrackReference | null = null;
  private lastKnownTimeSeconds = 0;
  private bufferingSince: number | null = null;
  private loadedTrackId: string | null = null;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.state;

  attachAdapter(adapter: YouTubeAudioAdapter) {
    this.detachAdapter();
    this.adapter = adapter;
    this.cleanupFns = [
      adapter.on('ready', () => {
        this.log('ready');
        if (this.state.playbackState === 'loading') {
          this.setState({ playbackState: 'ready' });
        }
      }),
      adapter.on('statechange', ({ data }) => {
        const playerState = adapter.getPlayerState();

        if (playerState === 'playing') {
          this.bufferingSince = null;
          this.setState({
            playbackState: 'playing',
            health: 'ok',
            actualOffsetSeconds: adapter.getCurrentTime(),
            lastProgressAt: Date.now(),
          });
        } else if (playerState === 'paused' && this.playback?.state !== 'ended') {
          this.bufferingSince = null;
          this.setState({
            playbackState: 'paused',
            actualOffsetSeconds: adapter.getCurrentTime(),
          });
        } else if (playerState === 'buffering') {
          this.bufferingSince = this.bufferingSince ?? Date.now();
          this.setState({
            playbackState: 'buffering',
            health: 'stalled',
          });
          this.log('buffering_start', { code: data });
        } else if (playerState === 'ended') {
          this.bufferingSince = null;
          this.stopHeartbeat();
          this.setState({
            playbackState: 'ended',
            health: 'ok',
          });
          this.log('ended');
        }
      }),
      adapter.on('error', (payload) => {
        this.stopHeartbeat();
        this.setState({
          playbackState: 'error',
          health: 'failed',
          errorCode: 'youtube_error',
          errorMessage: JSON.stringify(payload),
        });
        this.log('error', { payload });
      }),
    ];
  }

  detachAdapter() {
    this.cleanupFns.forEach((cleanup) => cleanup());
    this.cleanupFns = [];
    this.stopHeartbeat();
    this.adapter = null;
  }

  reset() {
    this.stopHeartbeat();
    this.playback = null;
    this.track = null;
    this.lastKnownTimeSeconds = 0;
    this.bufferingSince = null;
    this.loadedTrackId = null;
    this.state = initialState;
    this.emit();
  }

  setMuted(muted: boolean) {
    if (muted) {
      this.adapter?.mute();
    } else if (this.state.hasUserGesture) {
      this.adapter?.unmute();
    }

    this.setState({ muted });
  }

  setVolume(volume: number) {
    const nextVolume = clampVolume(volume);
    this.adapter?.setVolume(nextVolume);
    this.setState({ volume: nextVolume });
  }

  markUserGesture() {
    this.setState({ hasUserGesture: true });
    if (!this.state.muted) {
      this.adapter?.unmute();
    }
  }

  async loadTrack(track: AudioTrackReference, playback?: PlaybackPreview) {
    this.track = track;
    if (playback) {
      this.playback = playback;
    }

    const expectedOffset = computeExpectedOffset(playback ?? this.playback);
    const trackChanged = this.loadedTrackId !== track.trackId;

    this.setState({
      roomId: track.roomId ?? null,
      trackId: track.trackId,
      youtubeVideoId: track.youtubeVideoId,
      playbackState: this.adapter ? 'loading' : 'idle',
      health: 'ok',
      targetOffsetSeconds: expectedOffset,
      driftSeconds: 0,
      errorCode: undefined,
      errorMessage: undefined,
      recoveryAttempts: trackChanged ? 0 : this.state.recoveryAttempts,
    });

    if (!this.adapter) {
      return;
    }

    if (trackChanged) {
      this.log('load_track', {
        trackId: track.trackId,
        youtubeVideoId: track.youtubeVideoId,
        targetOffsetSeconds: expectedOffset,
      });

      this.loadedTrackId = track.trackId;
      this.lastKnownTimeSeconds = expectedOffset;
      this.adapter.load(track.youtubeVideoId, expectedOffset);
    } else {
      await this.syncToPlayback(playback ?? this.playback);
    }
  }

  async syncToPlayback(playback?: PlaybackPreview | null) {
    if (!playback || !this.adapter) {
      return;
    }

    this.playback = playback;
    const expectedOffset = computeExpectedOffset(playback);
    const actualOffset = this.adapter.getCurrentTime();
    const driftSeconds = Math.abs(actualOffset - expectedOffset);

    this.setState({
      targetOffsetSeconds: expectedOffset,
      actualOffsetSeconds: actualOffset,
      driftSeconds,
    });

    if (playback.state === 'paused') {
      if (driftSeconds > 0.45) {
        this.seek(expectedOffset, 'pause-sync');
      }
      this.adapter.pause();
      this.stopHeartbeat();
      this.setState({ playbackState: 'paused', health: 'ok' });
      return;
    }

    if (playback.state === 'ended') {
      this.adapter.pause();
      this.stopHeartbeat();
      this.setState({ playbackState: 'ended', health: 'ok' });
      return;
    }

    if (playback.state === 'playing') {
      this.startHeartbeat();
      if (this.state.playbackState === 'ready' || this.state.playbackState === 'paused') {
        this.seek(expectedOffset, 'resume');
        if (this.state.hasUserGesture) {
          this.adapter.play();
        }
        return;
      }

      if (driftSeconds > 1.8 && this.canSoftSync()) {
        this.seek(expectedOffset, 'drift');
      }
    }
  }

  play() {
    this.markUserGesture();
    this.startHeartbeat();
    if (this.state.muted) {
      this.adapter?.mute();
    } else {
      this.adapter?.unmute();
    }
    this.adapter?.play();
    this.setState({ playbackState: 'playing', health: 'ok' });
    this.log('play', { trackId: this.state.trackId });
  }

  pause() {
    this.adapter?.pause();
    this.stopHeartbeat();
    this.bufferingSince = null;
    this.setState({ playbackState: 'paused', health: 'ok' });
    this.log('pause', { trackId: this.state.trackId });
  }

  stop() {
    this.adapter?.stop();
    this.stopHeartbeat();
    this.bufferingSince = null;
    this.lastKnownTimeSeconds = 0;
    this.setState({
      playbackState: 'paused',
      health: 'ok',
      targetOffsetSeconds: 0,
      actualOffsetSeconds: 0,
      driftSeconds: 0,
    });
    this.log('stop', { trackId: this.state.trackId });
  }

  retry() {
    void this.recover();
  }

  private setState(patch: Partial<AudioEngineState>) {
    this.state = { ...this.state, ...patch };
    this.emit();
  }

  private emit() {
    this.listeners.forEach((listener) => listener());
  }

  private log(event: string, payload?: Record<string, unknown>) {
    console.info(`[AUDIO] ${event}`, payload ?? {});
  }

  private canSoftSync() {
    if (!this.state.lastSyncAt) {
      return true;
    }

    return Date.now() - this.state.lastSyncAt > 4000;
  }

  private seek(targetOffsetSeconds: number, reason: SyncReason) {
    this.adapter?.seek(targetOffsetSeconds);
    this.lastKnownTimeSeconds = targetOffsetSeconds;
    this.setState({
      targetOffsetSeconds,
      actualOffsetSeconds: targetOffsetSeconds,
      driftSeconds: 0,
      lastSyncAt: Date.now(),
    });
    this.log('seek', { reason, targetOffsetSeconds });
  }

  private startHeartbeat() {
    if (this.heartbeatId || typeof window === 'undefined') {
      return;
    }

    this.heartbeatId = window.setInterval(() => {
      this.tickHeartbeat();
    }, 500);
  }

  private stopHeartbeat() {
    if (this.heartbeatId && typeof window !== 'undefined') {
      window.clearInterval(this.heartbeatId);
    }
    this.heartbeatId = null;
  }

  private tickHeartbeat() {
    if (!this.adapter || !this.playback) {
      return;
    }

    const actualOffsetSeconds = this.adapter.getCurrentTime();
    const targetOffsetSeconds = computeExpectedOffset(this.playback);
    const driftSeconds = Math.abs(actualOffsetSeconds - targetOffsetSeconds);
    const now = Date.now();
    const progressed = Math.abs(actualOffsetSeconds - this.lastKnownTimeSeconds) > 0.15;
    const playerState = this.adapter.getPlayerState();

    this.lastKnownTimeSeconds = actualOffsetSeconds;

    this.setState({
      actualOffsetSeconds,
      targetOffsetSeconds,
      driftSeconds,
      lastProgressAt: progressed ? now : this.state.lastProgressAt,
    });

    if (progressed && this.state.playbackState === 'buffering') {
      this.bufferingSince = null;
      this.setState({ playbackState: 'playing', health: 'ok' });
      this.log('buffering_end');
    }

    const stalled =
      this.playback.state === 'playing' &&
      playerState !== 'paused' &&
      playerState !== 'ended' &&
      !progressed &&
      this.state.lastProgressAt !== null &&
      now - this.state.lastProgressAt > 1500;

    if (stalled && this.state.playbackState !== 'buffering') {
      this.bufferingSince = now;
      this.setState({ playbackState: 'buffering', health: 'stalled' });
      this.log('stall_detected', { driftSeconds });
    }

    if (driftSeconds > 1.8 && this.playback.state === 'playing' && this.state.playbackState !== 'buffering' && this.canSoftSync()) {
      this.seek(targetOffsetSeconds, 'drift');
    }

    if (this.state.playbackState === 'buffering' && this.bufferingSince && now - this.bufferingSince > 5000) {
      void this.recover();
    }
  }

  private async recover() {
    if (!this.adapter || !this.track) {
      return;
    }

    const attempt = this.state.recoveryAttempts + 1;
    const fromOffsetSeconds = this.state.actualOffsetSeconds || this.state.targetOffsetSeconds;

    this.setState({
      playbackState: 'loading',
      health: 'recovering',
      recoveryAttempts: attempt,
    });

    this.log('recovery_attempt', { attempt, fromOffsetSeconds });

    try {
      this.adapter.load(this.track.youtubeVideoId, fromOffsetSeconds);
      this.seek(fromOffsetSeconds, 'recovery');
      if (this.playback?.state === 'playing' && this.state.hasUserGesture) {
        this.adapter.play();
      }
      this.bufferingSince = null;
      this.setState({ health: 'ok' });
    } catch (error) {
      if (attempt >= 2) {
        this.stopHeartbeat();
        this.setState({
          playbackState: 'error',
          health: 'failed',
          errorCode: 'recovery_failed',
          errorMessage: error instanceof Error ? error.message : 'unknown recovery failure',
        });
        this.log('recovery_failed', { attempt });
        return;
      }

      await this.recover();
    }
  }
}

export function useAudioEngine(engine: AudioEngine) {
  const snapshot = useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot);
  return snapshot;
}
