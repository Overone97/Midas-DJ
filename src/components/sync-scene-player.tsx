'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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

function getInitials(label: string) {
  return label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase() ?? '')
    .join('');
}

function getAvatarPalette(seed: string) {
  const palettes = [
    {
      aura: 'from-cyan-300/40 via-sky-400/10 to-transparent',
      hair: 'bg-slate-950',
      skin: 'bg-[#f3c6a6]',
      body: 'bg-cyan-300',
      accent: 'bg-cyan-100',
      badge: 'border-cyan-300/30 bg-cyan-300/10 text-cyan-50',
    },
    {
      aura: 'from-fuchsia-300/35 via-rose-400/12 to-transparent',
      hair: 'bg-[#2b152a]',
      skin: 'bg-[#d8a27b]',
      body: 'bg-fuchsia-300',
      accent: 'bg-rose-100',
      badge: 'border-fuchsia-300/30 bg-fuchsia-300/10 text-fuchsia-50',
    },
    {
      aura: 'from-amber-300/40 via-orange-300/12 to-transparent',
      hair: 'bg-[#382314]',
      skin: 'bg-[#f0be8f]',
      body: 'bg-amber-300',
      accent: 'bg-yellow-50',
      badge: 'border-amber-300/30 bg-amber-300/10 text-amber-50',
    },
    {
      aura: 'from-emerald-300/35 via-teal-300/12 to-transparent',
      hair: 'bg-[#15352f]',
      skin: 'bg-[#d9b18a]',
      body: 'bg-emerald-300',
      accent: 'bg-emerald-50',
      badge: 'border-emerald-300/30 bg-emerald-300/10 text-emerald-50',
    },
  ];

  const score = Array.from(seed).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return palettes[score % palettes.length];
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

export function SyncScenePlayer({ track, playback, canControl, members, ownerLabel, onTogglePlayback, onNextTrack }: ScenePlayerProps) {
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
  const [hasInteracted, setHasInteracted] = useState(false);
  const [localVolume, setLocalVolume] = useState(80);

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

    player.setVolume(localVolume);
    if (localVolume <= 0) {
      player.mute();
    } else if (audioUnlockedRef.current || hasInteracted) {
      player.unMute();
    } else {
      player.mute();
    }
  }

  function unlockLocalAudio(nextVolume = localVolume) {
    const player = playerRef.current;
    if (!player || !currentTrack) {
      return;
    }

    audioUnlockedRef.current = true;
    setHasInteracted(true);
    player.setVolume(nextVolume);
    if (nextVolume <= 0) {
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

      currentPlayer.setVolume(nextVolume);
      if (nextVolume <= 0) {
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
            playerRef.current?.setVolume(localVolume);
            playerRef.current?.mute();
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
  }, [currentTrack, localVolume]);

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
  }, [currentTrack, playback?.state, playback?.startedAt, playback?.offsetSeconds, hasInteracted, localVolume, playerReady]);

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

  const progressWidth = Math.min(100, ((liveOffset % 240) / 240) * 100);
  const ownerPalette = getAvatarPalette(ownerLabel);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.62fr)_360px]">
      <div className="overflow-hidden rounded-[2rem] border border-fuchsia-400/20 bg-[radial-gradient(circle_at_top,#fb718522,transparent_28%),radial-gradient(circle_at_15%_75%,#9333ea26,transparent_30%),radial-gradient(circle_at_85%_20%,#22d3ee22,transparent_28%),linear-gradient(180deg,#20112d,#09060f)] p-4 shadow-[0_24px_90px_rgba(0,0,0,0.55)]">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.32em] text-gold/70">Main stage</p>
            <h4 className="mt-2 line-clamp-2 text-2xl font-black text-white">{currentTrack?.title ?? 'Aucun titre chargé'}</h4>
            <p className="mt-1 text-sm text-white/58">Une scène plus propre, plus neon club, plus plug.dj dans l’esprit.</p>
          </div>
          <span className="rounded-full border border-gold/20 bg-gold/10 px-4 py-2 text-xs uppercase tracking-[0.22em] text-gold">{stageBadge}</span>
        </div>

        <div className="relative overflow-hidden rounded-[1.7rem] border border-white/10 bg-[linear-gradient(180deg,#140d1d,#05040a)]">
          <div className="pointer-events-none absolute inset-0 opacity-90">
            <div className="absolute left-[10%] top-0 h-48 w-48 rounded-full bg-fuchsia-500/20 blur-3xl" />
            <div className="absolute right-[8%] top-[10%] h-52 w-52 rounded-full bg-cyan-400/18 blur-3xl" />
            <div className="absolute left-1/2 top-[18%] h-40 w-80 -translate-x-1/2 rounded-full bg-amber-300/12 blur-3xl" />
            <div className="absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(180deg,transparent,rgba(15,10,20,0.95))]" />
          </div>

          <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 bg-gradient-to-b from-black/80 to-transparent px-4 py-3 text-xs uppercase tracking-[0.22em] text-white/72">
            <span>DJ booth · {ownerLabel}</span>
            <span>{syncedCount} sync en live</span>
          </div>

          <div className="relative z-[1] p-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.18fr)_320px]">
              <div className="space-y-4">
                <div className="relative overflow-hidden rounded-[1.6rem] border border-white/10 bg-[radial-gradient(circle_at_top,#ffffff12,transparent_30%),linear-gradient(180deg,#09080d,#040307)] shadow-[0_18px_60px_rgba(0,0,0,0.6)]">
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-40 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.84)_45%,rgba(0,0,0,0.98))]" />
                  <div className="absolute inset-x-[6%] bottom-16 z-[3] h-10 rounded-[999px] border border-gold/20 bg-[linear-gradient(180deg,rgba(214,158,46,0.34),rgba(74,40,10,0.82))] shadow-[0_0_40px_rgba(234,179,8,0.12)]" />
                  <div className="absolute inset-x-[10%] bottom-12 z-[3] h-16 rounded-[1.8rem] border border-gold/20 bg-[linear-gradient(180deg,rgba(60,30,14,0.95),rgba(12,8,8,0.98))] shadow-[0_14px_40px_rgba(0,0,0,0.48)]" />
                  <div className="absolute bottom-[5.2rem] left-1/2 z-[4] flex -translate-x-1/2 flex-col items-center">
                    <div className={`absolute -top-10 h-28 w-28 rounded-full bg-gradient-to-b ${ownerPalette.aura} blur-2xl`} />
                    <div className="relative h-36 w-28">
                      <div className={`absolute left-1/2 top-3 h-10 w-10 -translate-x-1/2 rounded-full border border-white/15 ${ownerPalette.skin}`} />
                      <div className={`absolute left-1/2 top-1 h-5 w-11 -translate-x-1/2 rounded-t-full ${ownerPalette.hair}`} />
                      <div className={`absolute bottom-6 left-1/2 h-20 w-24 -translate-x-1/2 rounded-[1.7rem_1.7rem_1rem_1rem] ${ownerPalette.body} shadow-[0_0_25px_rgba(255,255,255,0.12)]`} />
                      <div className={`absolute bottom-12 left-2 h-4 w-9 rounded-full ${ownerPalette.accent} opacity-80`} />
                      <div className={`absolute bottom-12 right-2 h-4 w-9 rounded-full ${ownerPalette.accent} opacity-80`} />
                    </div>
                    <span className={`mt-2 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] ${ownerPalette.badge}`}>DJ live</span>
                  </div>
                  <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 bg-gradient-to-b from-black/80 to-transparent px-4 py-3 text-xs uppercase tracking-[0.22em] text-white/72">
                    <span>DJ booth · {ownerLabel}</span>
                    <span>{syncedCount} sync en live</span>
                  </div>
                  <div className="aspect-video w-full bg-black/90">
                    {currentTrack ? <div ref={playerHostRef} className="h-full w-full [&_iframe]:h-full [&_iframe]:w-full [&_iframe]:opacity-70" /> : <div className="flex h-full items-center justify-center text-white/55">Ajoute un titre pour lancer la scène.</div>}
                  </div>
                  <div className="absolute inset-x-0 bottom-0 z-[5] px-4 pb-4 pt-10">
                    <div className="flex items-center justify-between gap-3 text-sm text-white/80">
                      <span>Timing room · {formatClock(liveOffset)}</span>
                      <span>{canControl ? 'Mode DJ' : 'Audience sync'}</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-gradient-to-r from-gold to-amber-300 transition-all" style={{ width: `${progressWidth}%` }} />
                    </div>
                  </div>
                </div>

                <div className="rounded-[1.45rem] border border-fuchsia-300/10 bg-[linear-gradient(180deg,rgba(12,11,18,0.94),rgba(6,6,10,0.94))] px-4 py-4 backdrop-blur-sm">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-xs uppercase tracking-[0.26em] text-white/48">Crowd</p>
                    <p className="text-xs text-white/55">{syncedCount > 0 ? `${syncedCount} personne${syncedCount > 1 ? 's' : ''} calée${syncedCount > 1 ? 's' : ''}` : 'Le floor attend du monde'}</p>
                  </div>
                  <div className="flex min-h-[10rem] items-end gap-2 overflow-x-auto rounded-[1.2rem] border border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] px-3 pb-3 pt-6">
                    {crowdMembers.length > 0 ? (
                      crowdMembers.map((member, index) => {
                        const palette = getAvatarPalette(member.label);
                        const bounce = playback?.state === 'playing' ? 4 + ((index + Math.floor(liveOffset)) % 3) * 4 : 0;

                        return (
                          <div key={member.id} className="group flex min-w-[4.6rem] flex-col items-center" style={{ transform: `translateY(-${bounce}px)` }}>
                            <div className={`absolute h-16 w-16 rounded-full bg-gradient-to-b ${palette.aura} opacity-70 blur-2xl transition ${member.online ? 'scale-100' : 'scale-75 opacity-30'}`} />
                            <div className="relative h-24 w-16">
                              <div className={`absolute left-1/2 top-1 h-7 w-7 -translate-x-1/2 rounded-full border border-white/12 ${palette.skin}`} />
                              <div className={`absolute left-1/2 top-0 h-4 w-8 -translate-x-1/2 rounded-t-full ${palette.hair}`} />
                              <div className={`absolute bottom-1 left-1/2 h-14 w-12 -translate-x-1/2 rounded-[1rem_1rem_0.7rem_0.7rem] ${member.online ? palette.body : 'bg-white/15'} transition`} />
                              <div className={`absolute bottom-8 left-0 h-3 w-5 rounded-full ${member.online ? palette.accent : 'bg-white/10'} opacity-80`} />
                              <div className={`absolute bottom-8 right-0 h-3 w-5 rounded-full ${member.online ? palette.accent : 'bg-white/10'} opacity-80`} />
                            </div>
                            <p className="mt-2 max-w-[4.8rem] truncate text-center text-[11px] font-semibold text-white/82">{member.label}</p>
                            <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">{member.online ? 'on beat' : 'idle'}</p>
                          </div>
                        );
                      })
                    ) : (
                      <div className="rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/55">La crowd est encore vide.</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-[1.4rem] border border-gold/15 bg-[linear-gradient(180deg,rgba(20,14,24,0.95),rgba(9,7,15,0.92))] p-4 backdrop-blur-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <div className="mb-4 rounded-[1.4rem] border border-gold/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-white/45">Now performing</p>
                  <div className="mt-4 flex items-center gap-4">
                    <div className="relative h-24 w-20 overflow-hidden rounded-[1.3rem] border border-gold/30 bg-[linear-gradient(180deg,#2f1d11,#120d0b)]">
                      <div className={`absolute left-1/2 top-3 h-8 w-8 -translate-x-1/2 rounded-full ${ownerPalette.skin}`} />
                      <div className={`absolute left-1/2 top-2 h-4 w-9 -translate-x-1/2 rounded-t-full ${ownerPalette.hair}`} />
                      <div className={`absolute bottom-3 left-1/2 h-12 w-14 -translate-x-1/2 rounded-[1rem] ${ownerPalette.body}`} />
                    </div>
                    <div className="min-w-0">
                      <h5 className="truncate text-xl font-black text-white">{ownerLabel}</h5>
                      <p className="mt-1 text-sm text-white/58">{canControl ? 'Tu pilotes la scène.' : 'Tu suis le set en audience sync.'}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-8 items-end gap-2 rounded-[1.1rem] border border-fuchsia-300/10 bg-white/5 p-3">
                  {Array.from({ length: 8 }).map((_, index) => {
                    const base = playback?.state === 'playing' ? 24 + ((index * 11 + Math.floor(liveOffset * 10)) % 50) : 18;
                    return <span key={index} className="rounded-full bg-gradient-to-t from-gold via-amber-300 to-white/90 transition-all" style={{ height: `${base}px` }} />;
                  })}
                </div>

                <div className="mt-4 rounded-[1.25rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.03))] p-4 text-sm text-white/64">
                  <p>État partagé · {playback?.state ?? 'aucun'}</p>
                  <p className="mt-1">Offset room · {formatClock(getExpectedOffset(playback))}</p>
                  <p className="mt-1 truncate">Track live · {currentTrack?.youtubeVideoId ?? '—'}</p>
                  <p className="mt-1">Booth owner · {ownerLabel}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[1.9rem] border border-cyan-300/15 bg-[linear-gradient(180deg,rgba(7,10,18,0.96),rgba(11,15,23,0.92))] p-5 text-white/78 shadow-[0_18px_60px_rgba(0,0,0,0.32)]">
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/70">Booth controls</p>
        <h4 className="mt-3 text-2xl font-black text-white">Volume local</h4>
        <p className="mt-3 text-sm leading-6 text-white/68">Je fais partir la vidéo automatiquement en muet. Le son auto sans geste utilisateur, le navigateur ne le laissera pas passer proprement — donc le volume sert de déverrouillage local clair.</p>

        <div className="mt-5 grid gap-3">
          <button
            type="button"
            onClick={() => onTogglePlayback(playback?.state === 'playing' ? 'paused' : 'playing', liveOffset)}
            disabled={!currentTrack || !canControl}
            className="rounded-full bg-gold px-5 py-3 font-semibold text-night transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {playback?.state === 'playing' ? 'Mettre en pause la scène' : 'Lancer la scène'}
          </button>
          <button
            type="button"
            onClick={() => onNextTrack()}
            disabled={!currentTrack || !canControl}
            className="rounded-full border border-white/15 px-5 py-3 font-semibold text-white transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Morceau suivant
          </button>

          <div className="rounded-[1.7rem] border border-cyan-300/25 bg-[linear-gradient(180deg,rgba(34,211,238,0.18),rgba(34,211,238,0.08))] px-5 py-5 shadow-[0_0_0_1px_rgba(34,211,238,0.08),0_0_30px_rgba(34,211,238,0.08)]">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-50">Volume</span>
              <span className="rounded-full border border-cyan-200/30 bg-black/20 px-3 py-1 text-sm font-bold text-cyan-50">{localVolume}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={localVolume}
              onPointerDown={() => {
                if (currentTrack) {
                  unlockLocalAudio(localVolume);
                }
              }}
              onPointerUp={() => {
                if (currentTrack) {
                  unlockLocalAudio(localVolume);
                }
              }}
              onTouchStart={() => {
                if (currentTrack) {
                  unlockLocalAudio(localVolume);
                }
              }}
              onChange={(event) => {
                const nextVolume = Number(event.target.value);
                setLocalVolume(nextVolume);
                if (currentTrack) {
                  unlockLocalAudio(nextVolume);
                }
              }}
              onInput={(event) => {
                const nextVolume = Number((event.target as HTMLInputElement).value);
                setLocalVolume(nextVolume);
              }}
              disabled={!currentTrack}
              className="mt-4 h-4 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <div className="mt-3 flex items-center justify-between text-xs uppercase tracking-[0.18em] text-cyan-50/80">
              <span>Muet</span>
              <span>Fort</span>
            </div>
            <p className="mt-4 text-sm leading-6 text-cyan-50/85">Touchez le slider une fois pour déverrouiller le son local, puis il reste actif. Après ça, c’est juste un vrai volume.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
