'use client';

export type YouTubePlayerLike = {
  destroy: () => void;
  getCurrentTime: () => number;
  getPlayerState: () => number;
  loadVideoById: (videoId: string, startSeconds?: number) => void;
  mute: () => void;
  pauseVideo: () => void;
  playVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  setVolume: (volume: number) => void;
  unMute: () => void;
};

type AdapterEventMap = {
  ready: undefined;
  statechange: { data: number };
  error: { data: number } | unknown;
};

type AdapterEventName = keyof AdapterEventMap;

type Listener<T extends AdapterEventName> = (payload: AdapterEventMap[T]) => void;

export type YouTubePlayerFactory = new (
  element: HTMLElement,
  config: {
    videoId: string;
    playerVars?: Record<string, string | number>;
    events?: {
      onReady?: () => void;
      onStateChange?: (event: { data: number }) => void;
      onError?: (event: { data: number }) => void;
    };
  },
) => YouTubePlayerLike;

export type YouTubeStateMap = {
  UNSTARTED: number;
  ENDED: number;
  PLAYING: number;
  PAUSED: number;
  BUFFERING: number;
  CUED: number;
};

export class YouTubeAudioAdapter {
  private player: YouTubePlayerLike | null = null;
  private listeners = new Map<AdapterEventName, Set<Listener<AdapterEventName>>>();
  private desiredVolume = 80;
  private desiredMuted = false;

  constructor(
    private host: HTMLElement,
    private Player: YouTubePlayerFactory,
    private playerStateMap: YouTubeStateMap,
  ) {}

  private withPlayer<T>(callback: (player: YouTubePlayerLike) => T) {
    if (!this.player) {
      return undefined;
    }

    try {
      return callback(this.player);
    } catch {
      return undefined;
    }
  }

  private applyAudioPreferences() {
    this.withPlayer((player) => {
      const setVolume = (player as Partial<YouTubePlayerLike>).setVolume;
      if (typeof setVolume === 'function') {
        setVolume.call(player, this.desiredMuted ? 0 : this.desiredVolume);
      }

      if (this.desiredMuted) {
        const mute = (player as Partial<YouTubePlayerLike>).mute;
        if (typeof mute === 'function') {
          mute.call(player);
        }
        return;
      }

      const unMute = (player as Partial<YouTubePlayerLike>).unMute;
      if (typeof unMute === 'function') {
        unMute.call(player);
      }
    });
  }

  mount(initialVideoId: string) {
    if (this.player) {
      return;
    }

    this.player = new this.Player(this.host, {
      videoId: initialVideoId,
      playerVars: {
        autoplay: 1,
        controls: 1,
        playsinline: 1,
        rel: 0,
        modestbranding: 1,
      },
      events: {
        onReady: () => {
          this.applyAudioPreferences();
          this.emit('ready', undefined);
        },
        onStateChange: (event) => this.emit('statechange', event),
        onError: (event) => this.emit('error', event),
      },
    });

    this.applyAudioPreferences();
  }

  destroy() {
    this.player?.destroy();
    this.player = null;
  }

  on<T extends AdapterEventName>(event: T, listener: Listener<T>) {
    const bucket = this.listeners.get(event) ?? new Set();
    bucket.add(listener as Listener<AdapterEventName>);
    this.listeners.set(event, bucket);
    return () => bucket.delete(listener as Listener<AdapterEventName>);
  }

  private emit<T extends AdapterEventName>(event: T, payload: AdapterEventMap[T]) {
    const bucket = this.listeners.get(event);
    bucket?.forEach((listener) => listener(payload as never));
  }

  load(videoId: string, startSeconds: number) {
    this.withPlayer((player) => {
      player.loadVideoById(videoId, startSeconds);
    });
    this.applyAudioPreferences();
  }

  play() {
    this.withPlayer((player) => {
      player.playVideo();
    });
  }

  pause() {
    this.withPlayer((player) => {
      player.pauseVideo();
    });
  }

  stop() {
    this.withPlayer((player) => {
      player.pauseVideo();
      player.seekTo(0, true);
    });
  }

  seek(seconds: number) {
    this.withPlayer((player) => {
      player.seekTo(seconds, true);
    });
  }

  mute() {
    this.desiredMuted = true;
    this.applyAudioPreferences();
  }

  unmute() {
    this.desiredMuted = false;
    this.applyAudioPreferences();
  }

  setVolume(volume: number) {
    this.desiredVolume = volume;
    this.applyAudioPreferences();
  }

  getCurrentTime() {
    return this.player?.getCurrentTime?.() ?? 0;
  }

  getRawPlayerState() {
    return this.player?.getPlayerState?.() ?? this.playerStateMap.UNSTARTED;
  }

  getPlayerState() {
    const state = this.getRawPlayerState();
    if (state === this.playerStateMap.PLAYING) return 'playing' as const;
    if (state === this.playerStateMap.PAUSED) return 'paused' as const;
    if (state === this.playerStateMap.BUFFERING) return 'buffering' as const;
    if (state === this.playerStateMap.ENDED) return 'ended' as const;
    if (state === this.playerStateMap.CUED) return 'cued' as const;
    return 'unstarted' as const;
  }
}
