'use client';

import { useSyncExternalStore } from 'react';

export type AudioPlaybackState = 'playing' | 'paused' | 'stopped';

export type AudioSourceHandle = {
  play?: () => void;
  pause?: () => void;
  stop?: () => void;
  setVolume?: (volume: number) => void;
  setMuted?: (muted: boolean) => void;
};

export type GlobalAudioState = {
  volume: number;
  muted: boolean;
  playback: AudioPlaybackState;
  hasInteracted: boolean;
};

function clampVolume(volume: number) {
  return Math.max(0, Math.min(100, Math.round(volume)));
}

class GlobalAudioController {
  private sources = new Map<string, AudioSourceHandle>();
  private listeners = new Set<() => void>();
  private state: GlobalAudioState = {
    volume: 80,
    muted: false,
    playback: 'paused',
    hasInteracted: false,
  };

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.state;

  private emit() {
    this.listeners.forEach((listener) => listener());
  }

  private getEffectiveMute() {
    return this.state.muted || this.state.volume <= 0;
  }

  private applyToSource(source: AudioSourceHandle) {
    source.setVolume?.(this.getEffectiveMute() ? 0 : this.state.volume);

    if (source.setMuted) {
      source.setMuted(this.state.muted);
    }
  }

  private applyToAllSources() {
    this.sources.forEach((source) => this.applyToSource(source));
  }

  registerSource(id: string, source: AudioSourceHandle) {
    this.sources.set(id, source);
    this.applyToSource(source);

    if (this.state.playback === 'playing' && this.state.hasInteracted) {
      source.play?.();
    } else if (this.state.playback === 'paused') {
      source.pause?.();
    } else if (this.state.playback === 'stopped') {
      source.stop?.();
    }

    return () => {
      this.sources.delete(id);
    };
  }

  setVolume(volume: number) {
    this.state = { ...this.state, volume: clampVolume(volume) };
    this.applyToAllSources();
    this.emit();
  }

  toggleMute() {
    this.state = { ...this.state, muted: !this.state.muted, hasInteracted: true };
    this.applyToAllSources();
    this.emit();
  }

  setMuted(muted: boolean) {
    this.state = { ...this.state, muted, hasInteracted: true };
    this.applyToAllSources();
    this.emit();
  }

  setPlayback(playback: AudioPlaybackState) {
    this.state = { ...this.state, playback };
    this.emit();
  }

  playAll() {
    this.state = { ...this.state, playback: 'playing', hasInteracted: true };
    this.applyToAllSources();
    this.sources.forEach((source) => source.play?.());
    this.emit();
  }

  pauseAll() {
    this.state = { ...this.state, playback: 'paused' };
    this.sources.forEach((source) => source.pause?.());
    this.emit();
  }

  stopAll() {
    this.state = { ...this.state, playback: 'stopped' };
    this.sources.forEach((source) => source.stop?.());
    this.applyToAllSources();
    this.emit();
  }
}

export const globalAudioController = new GlobalAudioController();

export function useGlobalAudioController() {
  const snapshot = useSyncExternalStore(globalAudioController.subscribe, globalAudioController.getSnapshot, globalAudioController.getSnapshot);

  return {
    state: snapshot,
    setVolume: (volume: number) => globalAudioController.setVolume(volume),
    toggleMute: () => globalAudioController.toggleMute(),
    setMuted: (muted: boolean) => globalAudioController.setMuted(muted),
    setPlayback: (playback: AudioPlaybackState) => globalAudioController.setPlayback(playback),
    playAll: () => globalAudioController.playAll(),
    pauseAll: () => globalAudioController.pauseAll(),
    stopAll: () => globalAudioController.stopAll(),
    registerSource: (id: string, source: AudioSourceHandle) => globalAudioController.registerSource(id, source),
  };
}
