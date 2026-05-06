'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AvatarDisplay } from '@/components/avatar-display';
import { SceneAudioControlBar } from '@/components/scene-audio-control-bar';
import { globalAudioController, useGlobalAudioController } from '@/lib/audio-controller';
import type { PlaybackPreview, QueueItemPreview, RoomMemberPreview } from '@/lib/rooms';

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLElement,
        config: {
          videoId: string;
          playerVars?: Record<string, string | number>;
          events?: {
            onReady?: () => void;
            onStateChange?: (event: { data: number }) => void;
          };
        },
      ) => YouTubePlayer;
      PlayerState: {
        UNSTARTED: number;
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

type YouTubePlayer = {
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

type ScenePlayerProps = {
  track?: QueueItemPreview;
  playback?: PlaybackPreview;
  canControl: boolean;
  members: RoomMemberPreview[];
  ownerLabel: string;
  onTogglePlayback: (nextState: 'playing' | 'paused', currentOffset: number) => void;
  onNextTrack: () => void;
  onStopPlayback: () => void;
};

function getExpectedOffset(playback?: PlaybackPreview) {
  if (!playback) {
    return 0;
  }

  if (playback.state !== 'playing' || !playback.startedAt) {
    return playback.offsetSeconds;
  }

  const elapsed = Math.max(0, (Date.now() - new Date(playback.startedAt).getTime()) / 1000);
  return playback.offsetSeconds + elapsed;
}

function formatClock(value: number) {
  const safe = Math.max(0, Math.floor(value));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function ensureYouTubeApi() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('window indisponible'));
  }

  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }

  return new Promise<typeof window.YT>((resolve) => {
    const existing = document.querySelector('script[data-youtube-api="true"]');

    if (!existing) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.dataset.youtubeApi = 'true';
      document.head.appendChild(script);
    }

    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT);
    };
  });
}

export function SyncScenePlayer({ track, playback, canControl, members, ownerLabel, onTogglePlayback, onNextTrack, onStopPlayback }: ScenePlayerProps) {
  const playerHostRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const readyRef = useRef(false);
  const trackIdRef = useRef<string | undefined>(track?.id);
  const followUpSyncRef = useRef<number | null>(null);
  const audioRetryRef = useRef<number | null>(null);
  const lastPlayAttemptRef = useRef(0);
  const lastSeekRef = useRef(0);
  const lastTrackLoadRef = useRef(0);
  const lastKnownTimeRef = useRef(0);
  const lastProgressAtRef = useRef(0);
  const playerStateRef = useRef<number | null>(null);
  const autoAdvanceTrackRef = useRef<string | null>(null);
  const audioUnlockedRef = useRef(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [liveOffset, setLiveOffset] = useState(0);
  const { state: globalAudioState } = useGlobalAudioController();

  const currentTrack = track;
  const syncedMembers = members.filter((member) => member.online);
  const syncedCount = syncedMembers.length;
  const crowdMembers = members.slice(0, 8);

  function syncPlayer(mode: 'soft' | 'hard' = 'soft') {
    const player = playerRef.current;
    if (!player || !currentTrack) {
      return;
    }

    const expected = getExpectedOffset(playback);
    const current = player.getCurrentTime?.() ?? 0;
    const drift = Math.abs(current - expected);
    const ytState = window.YT?.PlayerState;
    const state = player.getPlayerState?.() ?? playerStateRef.current;
    const now = Date.now();

    if (trackIdRef.current !== currentTrack.id) {
      player.loadVideoById(currentTrack.youtubeVideoId, expected);
      trackIdRef.current = currentTrack.id;
      autoAdvanceTrackRef.current = null;
      lastTrackLoadRef.current = now;
      lastPlayAttemptRef.current = now;
      lastSeekRef.current = now;
      lastKnownTimeRef.current = expected;
      lastProgressAtRef.current = now;
      return;
    }

    if (playback?.state === 'playing') {
      const seekThreshold = mode === 'hard' ? 1.1 : 2.4;
      const justLoaded = now - lastTrackLoadRef.current < 4500;
      const buffering = state === ytState?.BUFFERING;
      const canSeekNow = !buffering && now - lastSeekRef.current > (justLoaded ? 7000 : 5000);
      const seemsStuck = now - lastProgressAtRef.current > 4000;

      if (drift > seekThreshold && canSeekNow && (!justLoaded || seemsStuck)) {
        player.seekTo(expected, true);
        lastSeekRef.current = now;
        lastKnownTimeRef.current = expected;
      }

      const shouldReplay = state !== ytState?.PLAYING && state !== ytState?.BUFFERING;
      if (shouldReplay && now - lastPlayAttemptRef.current > (justLoaded ? 2500 : 1400)) {
        player.playVideo();
        lastPlayAttemptRef.current = now;
      }
    } else if (playback?.state === 'paused') {
      if (drift > 0.4 && now - lastSeekRef.current > 1500) {
        player.seekTo(expected, true);
        lastSeekRef.current = now;
      }
      if (state === ytState?.PLAYING || state === ytState?.BUFFERING) {
        player.pauseVideo();
      }
    } else if (playback?.state === 'ended') {
      if (state === ytState?.PLAYING || state === ytState?.BUFFERING) {
        player.pauseVideo();
      }
    }

    if (!audioUnlockedRef.current && !globalAudioState.hasInteracted) {
      player.mute();
    } else if (globalAudioState.muted) {
      player.mute();
    } else {
      player.unMute();
    }

  }

  function primeAudioAndPlay() {
    const player = playerRef.current;
    if (!player || !currentTrack) {
      return;
    }

    audioUnlockedRef.current = true;
    if (globalAudioState.muted) {
      player.mute();
    } else {
      player.unMute();
    }
    player.playVideo();
    lastPlayAttemptRef.current = Date.now();

    if (audioRetryRef.current) {
      window.clearInterval(audioRetryRef.current);
    }

    let retries = 0;
    audioRetryRef.current = window.setInterval(() => {
      const currentPlayer = playerRef.current;
      if (!currentPlayer) {
        return;
      }

      if (globalAudioState.muted) {
        currentPlayer.mute();
      } else {
        currentPlayer.unMute();
      }

      if (playback?.state === 'playing') {
        currentPlayer.playVideo();
        lastPlayAttemptRef.current = Date.now();
      }

      retries += 1;
      if (retries >= 6) {
        if (audioRetryRef.current) {
          window.clearInterval(audioRetryRef.current);
          audioRetryRef.current = null;
        }
      }
    }, 350);
  }

  useEffect(() => {
    if (!currentTrack || !playerHostRef.current) {
      return;
    }

    let cancelled = false;

    void ensureYouTubeApi().then((YT) => {
      if (cancelled || !YT?.Player || !playerHostRef.current) {
        return;
      }

      if (playerRef.current) {
        return;
      }

      playerRef.current = new YT.Player(playerHostRef.current, {
        videoId: currentTrack.youtubeVideoId,
        playerVars: {
          autoplay: 1,
          controls: 1,
          playsinline: 1,
          rel: 0,
          modestbranding: 1,
        },
        events: {
          onReady: () => {
            readyRef.current = true;
            setPlayerReady(true);
            lastTrackLoadRef.current = Date.now();
            lastProgressAtRef.current = Date.now();
            syncPlayer('hard');
          },
          onStateChange: (event) => {
            playerStateRef.current = event.data;
            if (event.data === window.YT?.PlayerState?.PLAYING) {
              lastProgressAtRef.current = Date.now();
            }
            if (event.data === window.YT?.PlayerState?.ENDED && canControl && currentTrack) {
              if (autoAdvanceTrackRef.current !== currentTrack.id) {
                autoAdvanceTrackRef.current = currentTrack.id;
                onNextTrack();
              }
            }
          },
        },
      });

      trackIdRef.current = currentTrack.id;
    });

    return () => {
      cancelled = true;
    };
  }, [currentTrack, globalAudioState.muted]);

  useEffect(() => {
    return globalAudioController.registerSource(`youtube-scene-${currentTrack?.id ?? 'idle'}`, {
      play: () => {
        if (!currentTrack) {
          return;
        }
        primeAudioAndPlay();
      },
      pause: () => {
        playerRef.current?.pauseVideo();
      },
      stop: () => {
        playerRef.current?.mute();
        playerRef.current?.pauseVideo();
        playerRef.current?.seekTo(0, true);
      },
      setMuted: (muted) => {
        const canOutputAudio = audioUnlockedRef.current || globalAudioController.getSnapshot().hasInteracted;
        if (!canOutputAudio || muted) {
          playerRef.current?.mute();
          return;
        }

        playerRef.current?.unMute();
      },
    });
  }, [currentTrack]);

  useEffect(() => {
    autoAdvanceTrackRef.current = null;
  }, [currentTrack?.id]);

  useEffect(() => {
    if (!playerReady || !currentTrack) {
      return;
    }

    syncPlayer('hard');

    if (followUpSyncRef.current) {
      window.clearTimeout(followUpSyncRef.current);
    }

    followUpSyncRef.current = window.setTimeout(() => {
      syncPlayer('hard');
    }, 1600);

    return () => {
      if (followUpSyncRef.current) {
        window.clearTimeout(followUpSyncRef.current);
        followUpSyncRef.current = null;
      }
    };
  }, [currentTrack, playback?.state, playback?.startedAt, playback?.offsetSeconds, globalAudioState.hasInteracted, globalAudioState.muted, playerReady]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const expected = getExpectedOffset(playback);

      if (playerRef.current && readyRef.current) {
        const current = playerRef.current.getCurrentTime?.() ?? expected;
        if (Math.abs(current - lastKnownTimeRef.current) > 0.2) {
          lastKnownTimeRef.current = current;
          lastProgressAtRef.current = Date.now();
        }
        setLiveOffset(playback?.state === 'playing' ? expected : current);
        if (currentTrack) {
          syncPlayer('soft');
        }
      } else {
        setLiveOffset(expected);
      }
    }, 1500);

    return () => window.clearInterval(timer);
  }, [currentTrack, playback]);

  useEffect(() => {
    return () => {
      if (followUpSyncRef.current) {
        window.clearTimeout(followUpSyncRef.current);
      }
      if (audioRetryRef.current) {
        window.clearInterval(audioRetryRef.current);
      }
      playerRef.current?.destroy();
      playerRef.current = null;
      readyRef.current = false;
    };
  }, []);

  const stageBadge = useMemo(() => {
    if (!playback) {
      return 'scène en attente';
    }
    if (playback.state === 'playing') {
      return 'live sync';
    }
    if (playback.state === 'paused') {
      return 'pause room';
    }
    return 'set terminé';
  }, [playback]);

  useEffect(() => {
    if (!playback) {
      globalAudioController.setPlayback('paused');
      return;
    }

    globalAudioController.setPlayback(playback.state === 'ended' ? 'stopped' : playback.state);
  }, [playback]);

  const progressWidth = Math.min(100, ((liveOffset % 240) / 240) * 100);

  return (
    <div className="overflow-hidden rounded-[2rem] border border-fuchsia-400/20 bg-[radial-gradient(circle_at_top,#fb718522,transparent_28%),radial-gradient(circle_at_15%_75%,#9333ea26,transparent_30%),radial-gradient(circle_at_85%_20%,#22d3ee22,transparent_28%),linear-gradient(180deg,#20112d,#09060f)] p-4 shadow-[0_24px_90px_rgba(0,0,0,0.55)]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.3em] text-gold/70">Main stage</p>
          <h4 className="mt-1 line-clamp-2 text-xl font-black text-white">{currentTrack?.title ?? 'Aucun titre chargé'}</h4>
        </div>
        <span className="shrink-0 rounded-full border border-gold/20 bg-gold/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.22em] text-gold">{stageBadge}</span>
      </div>

      <SceneAudioControlBar
        canControl={canControl}
        hasTrack={Boolean(currentTrack)}
        onPlay={() => onTogglePlayback('playing', playback?.state === 'paused' ? liveOffset : getExpectedOffset(playback))}
        onNext={onNextTrack}
        onStop={onStopPlayback}
      />

      <div className="relative overflow-hidden rounded-[1.9rem] border border-white/10 bg-[linear-gradient(180deg,#140d1d,#05040a)]">
          <div className="pointer-events-none absolute inset-0 opacity-90">
            <div className="absolute left-[10%] top-0 h-48 w-48 rounded-full bg-fuchsia-500/20 blur-3xl" />
            <div className="absolute right-[8%] top-[10%] h-52 w-52 rounded-full bg-cyan-400/18 blur-3xl" />
            <div className="absolute left-1/2 top-[18%] h-40 w-80 -translate-x-1/2 rounded-full bg-amber-300/12 blur-3xl" />
            <div className="absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(180deg,transparent,rgba(15,10,20,0.95))]" />
          </div>

          <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 bg-gradient-to-b from-black/80 to-transparent px-4 py-3 text-xs uppercase tracking-[0.22em] text-white/72">
            <span>Concert stage · {ownerLabel}</span>
            <span>{syncedCount} dans la fosse</span>
          </div>

          <div className="relative z-[1] p-2 md:p-3">
            <div>
              <div className="relative min-h-[44rem] overflow-hidden rounded-[1.6rem] border border-fuchsia-300/15 bg-black shadow-[0_18px_60px_rgba(0,0,0,0.6)] xl:min-h-[50rem]">
                  <div className="absolute inset-x-[12%] top-6 z-[1] h-[39%] overflow-hidden rounded-[1.55rem] border border-white/10 bg-black shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_24px_70px_rgba(0,0,0,0.45)]">
                    <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent px-4 py-3 text-[10px] uppercase tracking-[0.2em] text-white/60">
                      <span>Screen wall</span>
                      <span>{currentTrack ? 'live video' : 'offline'}</span>
                    </div>
                    <div className="aspect-video h-full w-full bg-black">
                      {currentTrack ? <div ref={playerHostRef} className="h-full w-full [&_iframe]:h-full [&_iframe]:w-full [&_iframe]:opacity-80" /> : <div className="flex h-full items-center justify-center text-white/55">Ajoute un titre pour lancer la scène.</div>}
                    </div>
                  </div>

                  <div className="absolute inset-x-[4%] bottom-[14.6rem] z-[2] h-12 rounded-[999px] bg-[linear-gradient(90deg,transparent,rgba(255,207,120,0.18),transparent)] blur-md" />
                  <div className="absolute inset-x-[9%] bottom-[13.7rem] z-[3] h-3 rounded-full bg-[linear-gradient(90deg,transparent,rgba(255,207,120,0.7),transparent)]" />
                  <div className="absolute inset-x-[13%] bottom-[12.2rem] z-[3] h-10 rounded-[999px] border border-gold/20 bg-[linear-gradient(180deg,rgba(195,137,45,0.42),rgba(63,35,13,0.88))]" />
                  <div className="absolute inset-x-[14%] bottom-[9.8rem] z-[4] h-[7.2rem] rounded-[1.8rem_1.8rem_1rem_1rem] border border-[#7c5521]/60 bg-[linear-gradient(180deg,rgba(66,39,17,0.98),rgba(15,10,10,0.98))] shadow-[0_18px_28px_rgba(0,0,0,0.5)]" />
                  <div className="absolute inset-x-[18%] bottom-[11.9rem] z-[5] flex items-center justify-between px-5 text-[10px] uppercase tracking-[0.18em] text-gold/72">
                    <span>Deck A</span>
                    <span>Mixer</span>
                    <span>Deck B</span>
                  </div>

                  <div className="absolute left-1/2 bottom-[13.5rem] z-[6] flex -translate-x-1/2 flex-col items-center">
                    <div className="absolute -top-10 h-32 w-32 rounded-full bg-fuchsia-400/20 blur-2xl" />
                    <AvatarDisplay avatar={members.find((member) => member.role === 'owner')?.avatar} label={ownerLabel} size="lg" badge="DJ" />
                    <span className="mt-2 rounded-full border border-fuchsia-300/20 bg-fuchsia-300/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-fuchsia-50">DJ booth</span>
                  </div>

                  <div className="absolute inset-x-0 bottom-[19.4rem] z-[7] px-4">
                    <div className="bg-gradient-to-t from-black/80 to-transparent px-1 pb-2 pt-10">
                      <div className="flex items-center justify-between gap-3 text-sm text-white/80">
                        <span>Timing room · {formatClock(liveOffset)}</span>
                        <span>{canControl ? 'Mode DJ' : 'Audience sync'}</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-gradient-to-r from-gold to-amber-300 transition-all" style={{ width: `${progressWidth}%` }} />
                      </div>
                    </div>
                  </div>

                  <div className="absolute inset-x-0 bottom-0 z-[8] rounded-t-[2.4rem] border-t border-white/8 bg-[linear-gradient(180deg,rgba(11,11,17,0.7),rgba(5,5,9,0.98))] px-5 pb-7 pt-8 backdrop-blur-sm">
                    <div className="mb-3 flex items-center justify-between gap-3 text-xs uppercase tracking-[0.18em] text-white/50">
                      <span>Fosse</span>
                      <span>{crowdMembers.length > 0 ? `${crowdMembers.length} auditeurs visibles` : 'en attente'}</span>
                    </div>
                    <div className="rounded-[1.6rem] border border-cyan-300/8 bg-[linear-gradient(180deg,rgba(20,18,32,0.76),rgba(8,8,14,0.82))] px-4 py-5 shadow-[inset_0_0_24px_rgba(34,211,238,0.03)]">
                    <div className="mb-4 grid grid-cols-3 gap-2 text-[10px] uppercase tracking-[0.16em] text-white/44">
                      <div className="rounded-full border border-white/8 bg-white/5 px-3 py-2 text-center">front rail</div>
                      <div className="rounded-full border border-fuchsia-300/12 bg-fuchsia-300/6 px-3 py-2 text-center text-fuchsia-100/55">crowd heat</div>
                      <div className="rounded-full border border-cyan-300/12 bg-cyan-300/6 px-3 py-2 text-center text-cyan-100/55">live listeners</div>
                    </div>
                    <div className="flex min-h-[14.2rem] items-end gap-3 overflow-x-auto pb-1">
                      {crowdMembers.length > 0 ? (
                        crowdMembers.map((member, index) => {
                          const laneHeight = index % 3 === 0 ? 'h-[7.2rem]' : index % 3 === 1 ? 'h-[6.4rem]' : 'h-[7.8rem]';
                          const glow = member.online ? 'border-cyan-300/25 bg-cyan-300/10 shadow-[0_0_18px_rgba(34,211,238,0.08)]' : 'border-white/10 bg-white/5';

                          return (
                          <div key={member.id} className="crowd-bob flex min-w-[5.9rem] flex-col items-center justify-end" style={{ animationDelay: `${index * 0.18}s` }}>
                            <div className={`mb-1 h-2 w-2 rounded-full ${member.online ? 'bg-emerald-400 shadow-[0_0_12px_rgba(74,222,128,0.7)]' : 'bg-white/20'}`} />
                            <div className={`relative w-[4.9rem] rounded-[1.2rem_1.2rem_0.7rem_0.7rem] border transition ${laneHeight} ${glow}`}>
                              <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-5">
                                <AvatarDisplay avatar={member.avatar} label={member.label} size="sm" />
                              </div>
                              <div className="absolute inset-x-3 top-3 h-1 rounded-full bg-white/10" />
                              <div className="absolute inset-x-2 bottom-2 h-8 rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))]" />
                            </div>
                            <p className="mt-2 max-w-[4.8rem] truncate text-center text-[11px] font-semibold text-white/82">{member.label}</p>
                          </div>
                        )})
                      ) : (
                        <div className="rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/55">La fosse est encore vide.</div>
                      )}
                    </div>
                    </div>
                  </div>
                </div>
            </div>
          </div>
      </div>
    </div>
  );
}
