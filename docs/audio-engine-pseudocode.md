# AudioEngine — pseudo-code d’implémentation

## But

Donner un squelette clair avant de coder le vrai moteur audio.

---

## Types

```ts
type EnginePlaybackState =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'playing'
  | 'buffering'
  | 'paused'
  | 'ended'
  | 'error';

type EngineHealth = 'ok' | 'stalled' | 'recovering' | 'failed';

type SyncReason = 'initial-load' | 'track-change' | 'drift' | 'resume' | 'recovery';

type AudioTrack = {
  roomId: string;
  trackId: string;
  youtubeVideoId: string;
};

type PlaybackSnapshot = {
  state: 'playing' | 'paused' | 'ended';
  startedAt: string | null;
  offsetSeconds: number;
  currentQueueItemId: string | null;
};

type AudioEngineState = {
  roomId: string | null;
  trackId: string | null;
  youtubeVideoId: string | null;
  playbackState: EnginePlaybackState;
  health: EngineHealth;
  targetOffsetSeconds: number;
  actualOffsetSeconds: number;
  driftSeconds: number;
  lastKnownTimeSeconds: number;
  lastProgressAt: number | null;
  lastSyncAt: number | null;
  hasUserGesture: boolean;
  muted: boolean;
  volume: number;
  recoveryAttempts: number;
  bufferingSince: number | null;
  errorCode?: string;
  errorMessage?: string;
};
```

---

## Interface adapter

```ts
interface AudioAdapter {
  mount(host: HTMLElement): Promise<void>;
  destroy(): void;

  load(videoId: string, startSeconds: number): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  stop(): Promise<void>;
  seek(seconds: number): Promise<void>;

  mute(): void;
  unmute(): void;
  setVolume(volume: number): void;

  getCurrentTime(): number;
  getPlayerState(): 'unstarted' | 'playing' | 'paused' | 'buffering' | 'ended' | 'cued';

  on(event: 'ready' | 'statechange' | 'error', callback: (payload?: unknown) => void): () => void;
}
```

---

## Helpers

```ts
function computeExpectedOffset(playback: PlaybackSnapshot): number {
  if (playback.state !== 'playing' || !playback.startedAt) {
    return playback.offsetSeconds;
  }

  const elapsed = Math.max(0, (Date.now() - new Date(playback.startedAt).getTime()) / 1000);
  return playback.offsetSeconds + elapsed;
}

function clampVolume(volume: number) {
  return Math.max(0, Math.min(100, Math.round(volume)));
}
```

---

## Classe principale

```ts
class AudioEngine {
  private adapter: AudioAdapter;
  private listeners = new Set<(state: AudioEngineState) => void>();
  private heartbeatId: number | null = null;
  private playback: PlaybackSnapshot | null = null;
  private track: AudioTrack | null = null;
  private state: AudioEngineState = {
    roomId: null,
    trackId: null,
    youtubeVideoId: null,
    playbackState: 'idle',
    health: 'ok',
    targetOffsetSeconds: 0,
    actualOffsetSeconds: 0,
    driftSeconds: 0,
    lastKnownTimeSeconds: 0,
    lastProgressAt: null,
    lastSyncAt: null,
    hasUserGesture: false,
    muted: false,
    volume: 80,
    recoveryAttempts: 0,
    bufferingSince: null,
  };

  constructor(adapter: AudioAdapter) {
    this.adapter = adapter;
    this.bindAdapterEvents();
  }

  subscribe(listener: (state: AudioEngineState) => void) {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  getSnapshot() {
    return this.state;
  }

  private emit() {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  private setState(patch: Partial<AudioEngineState>) {
    this.state = { ...this.state, ...patch };
    this.emit();
  }

  private log(event: string, payload?: Record<string, unknown>) {
    console.info(`[AUDIO] ${event}`, payload ?? {});
  }
}
```

---

## Binding événements adapter

```ts
private bindAdapterEvents() {
  this.adapter.on('ready', () => {
    this.log('ready');

    if (this.state.playbackState === 'loading') {
      this.setState({ playbackState: 'ready' });
    }
  });

  this.adapter.on('statechange', () => {
    const playerState = this.adapter.getPlayerState();

    if (playerState === 'playing') {
      this.setState({
        playbackState: 'playing',
        health: 'ok',
        bufferingSince: null,
        lastProgressAt: Date.now(),
      });
    }

    if (playerState === 'paused' && this.state.playbackState !== 'ended') {
      this.setState({ playbackState: 'paused' });
    }

    if (playerState === 'buffering') {
      this.setState({
        playbackState: 'buffering',
        health: 'stalled',
        bufferingSince: this.state.bufferingSince ?? Date.now(),
      });
    }

    if (playerState === 'ended') {
      this.setState({
        playbackState: 'ended',
        health: 'ok',
        bufferingSince: null,
      });
      this.log('ended');
    }
  });

  this.adapter.on('error', (payload) => {
    this.setState({
      playbackState: 'error',
      health: 'failed',
      errorMessage: String(payload ?? 'unknown error'),
    });
    this.log('error', { payload });
  });
}
```

---

## Chargement d’un track

```ts
async loadTrack(track: AudioTrack, playback: PlaybackSnapshot) {
  const expectedOffset = computeExpectedOffset(playback);

  this.track = track;
  this.playback = playback;

  this.setState({
    roomId: track.roomId,
    trackId: track.trackId,
    youtubeVideoId: track.youtubeVideoId,
    playbackState: 'loading',
    health: 'ok',
    targetOffsetSeconds: expectedOffset,
    actualOffsetSeconds: 0,
    driftSeconds: 0,
    recoveryAttempts: 0,
    bufferingSince: null,
    errorCode: undefined,
    errorMessage: undefined,
  });

  this.log('load_track', {
    trackId: track.trackId,
    youtubeVideoId: track.youtubeVideoId,
    expectedOffset,
  });

  await this.adapter.load(track.youtubeVideoId, expectedOffset);

  this.setState({
    playbackState: playback.state === 'playing' ? 'ready' : playback.state,
    targetOffsetSeconds: expectedOffset,
    lastSyncAt: Date.now(),
  });

  if (playback.state === 'playing' && this.state.hasUserGesture) {
    await this.play();
  }
}
```

---

## Sync avec playback_state serveur

```ts
async syncToPlayback(playback: PlaybackSnapshot) {
  this.playback = playback;

  const expectedOffset = computeExpectedOffset(playback);
  const actualOffset = this.adapter.getCurrentTime();
  const drift = Math.abs(actualOffset - expectedOffset);

  this.setState({
    targetOffsetSeconds: expectedOffset,
    actualOffsetSeconds: actualOffset,
    driftSeconds: drift,
  });

  if (playback.state === 'paused') {
    await this.pause();
    if (drift > 0.4) {
      await this.seek(expectedOffset, 'drift');
    }
    return;
  }

  if (playback.state === 'ended') {
    await this.stop();
    this.setState({ playbackState: 'ended' });
    return;
  }

  if (playback.state === 'playing') {
    if (this.state.playbackState === 'paused' || this.state.playbackState === 'ready') {
      await this.seek(expectedOffset, 'resume');
      await this.play();
      return;
    }

    if (drift > 1.8 && this.canSoftSync()) {
      await this.seek(expectedOffset, 'drift');
    }
  }
}
```

---

## Play / pause / stop

```ts
async play() {
  if (!this.track) return;

  this.setState({ hasUserGesture: true });

  if (this.state.muted) {
    this.adapter.mute();
  } else {
    this.adapter.unmute();
  }

  await this.adapter.play();

  this.setState({
    playbackState: 'playing',
    health: 'ok',
    lastProgressAt: Date.now(),
  });

  this.log('play', { trackId: this.state.trackId });
  this.startHeartbeat();
}

async pause() {
  await this.adapter.pause();
  this.setState({ playbackState: 'paused', bufferingSince: null });
  this.log('pause', { trackId: this.state.trackId });
}

async stop() {
  await this.adapter.stop();
  this.setState({
    playbackState: 'paused',
    targetOffsetSeconds: 0,
    actualOffsetSeconds: 0,
    driftSeconds: 0,
    bufferingSince: null,
  });
  this.log('stop', { trackId: this.state.trackId });
}
```

---

## Heartbeat

```ts
private startHeartbeat() {
  if (this.heartbeatId) return;

  this.heartbeatId = window.setInterval(() => {
    this.tickHeartbeat().catch((error) => {
      this.setState({
        playbackState: 'error',
        health: 'failed',
        errorMessage: error instanceof Error ? error.message : 'heartbeat failed',
      });
    });
  }, 500);
}

private stopHeartbeat() {
  if (!this.heartbeatId) return;
  window.clearInterval(this.heartbeatId);
  this.heartbeatId = null;
}

private async tickHeartbeat() {
  if (!this.playback || this.state.playbackState === 'idle') return;

  const actualOffset = this.adapter.getCurrentTime();
  const expectedOffset = computeExpectedOffset(this.playback);
  const drift = Math.abs(actualOffset - expectedOffset);
  const progressed = Math.abs(actualOffset - this.state.lastKnownTimeSeconds) > 0.15;
  const now = Date.now();

  this.setState({
    actualOffsetSeconds: actualOffset,
    targetOffsetSeconds: expectedOffset,
    driftSeconds: drift,
    lastKnownTimeSeconds: actualOffset,
    lastProgressAt: progressed ? now : this.state.lastProgressAt,
  });

  this.log('progress', {
    actualOffsetSeconds: actualOffset,
    expectedOffsetSeconds: expectedOffset,
    driftSeconds: drift,
  });

  const stalled =
    this.playback.state === 'playing' &&
    !progressed &&
    this.state.lastProgressAt !== null &&
    now - this.state.lastProgressAt > 1500;

  if (stalled && this.state.playbackState !== 'buffering') {
    this.setState({
      playbackState: 'buffering',
      health: 'stalled',
      bufferingSince: now,
    });
    this.log('stall_detected', { driftSeconds: drift });
  }

  const bufferingTooLong =
    this.state.playbackState === 'buffering' &&
    this.state.bufferingSince !== null &&
    now - this.state.bufferingSince > 5000;

  if (bufferingTooLong) {
    await this.recover();
  }
}
```

---

## Seek contrôlé

```ts
private canSoftSync() {
  if (!this.state.lastSyncAt) return true;
  return Date.now() - this.state.lastSyncAt > 4000;
}

private async seek(targetOffsetSeconds: number, reason: SyncReason) {
  await this.adapter.seek(targetOffsetSeconds);

  this.setState({
    targetOffsetSeconds,
    actualOffsetSeconds: targetOffsetSeconds,
    driftSeconds: 0,
    lastSyncAt: Date.now(),
    lastKnownTimeSeconds: targetOffsetSeconds,
  });

  this.log('seek', { reason, targetOffsetSeconds });
}
```

---

## Recovery

```ts
async recover() {
  if (!this.track || !this.playback) return;

  const attempt = this.state.recoveryAttempts + 1;
  const stableOffset = this.state.actualOffsetSeconds || this.state.targetOffsetSeconds;

  this.setState({
    health: 'recovering',
    recoveryAttempts: attempt,
    playbackState: 'loading',
  });

  this.log('recovery_attempt', {
    attempt,
    fromOffsetSeconds: stableOffset,
  });

  try {
    await this.adapter.load(this.track.youtubeVideoId, stableOffset);
    await this.seek(stableOffset, 'recovery');

    if (this.playback.state === 'playing') {
      await this.play();
    }

    this.setState({
      health: 'ok',
      bufferingSince: null,
    });
  } catch (error) {
    if (attempt >= 2) {
      this.setState({
        playbackState: 'error',
        health: 'failed',
        errorMessage: error instanceof Error ? error.message : 'recovery failed',
      });
      this.log('recovery_failed', { attempt });
      return;
    }

    await this.recover();
  }
}
```

---

## Volume / mute

```ts
setVolume(volume: number) {
  const nextVolume = clampVolume(volume);
  this.adapter.setVolume(nextVolume);
  this.setState({ volume: nextVolume });
}

setMuted(muted: boolean) {
  if (muted) {
    this.adapter.mute();
  } else {
    this.adapter.unmute();
  }

  this.setState({ muted });
}
```

---

## Hook React minimal

```ts
export function useAudioEngine(engine: AudioEngine) {
  const [state, setState] = useState(engine.getSnapshot());

  useEffect(() => engine.subscribe(setState), [engine]);

  return {
    state,
    loadTrack: engine.loadTrack.bind(engine),
    syncToPlayback: engine.syncToPlayback.bind(engine),
    play: engine.play.bind(engine),
    pause: engine.pause.bind(engine),
    stop: engine.stop.bind(engine),
    retry: engine.recover.bind(engine),
    setVolume: engine.setVolume.bind(engine),
    setMuted: engine.setMuted.bind(engine),
  };
}
```

---

## Intégration côté `SyncScenePlayer`

```ts
// pseudo-flow
const engine = useMemo(() => createSharedAudioEngine(), []);
const { state, loadTrack, syncToPlayback, play, pause, stop } = useAudioEngine(engine);

useEffect(() => {
  if (!track || !playback) return;
  void loadTrack(
    {
      roomId,
      trackId: track.id,
      youtubeVideoId: track.youtubeVideoId,
    },
    playback,
  );
}, [roomId, track?.id, track?.youtubeVideoId, playback?.currentQueueItemId]);

useEffect(() => {
  if (!playback) return;
  void syncToPlayback(playback);
}, [playback?.state, playback?.startedAt, playback?.offsetSeconds, playback?.updatedAt]);

const avatarMood = state.playbackState === 'playing'
  ? burstLevel > 0.75 ? 'hype' : 'groove'
  : 'idle';
```

---

## Notes franches

- Si on garde l’ancien `globalAudioController` comme deuxième chef, ça va se battre.
- Si on resync toutes les 1,5 secondes avec `playVideo()` en prime, ça va rebugger.
- Si on veut du live propre, il faut une machine à états. Pas une collection de refs paniquées.