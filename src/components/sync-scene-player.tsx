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
  const lastPlayAttemptRef = useRef(0);
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
    const state = player.getPlayerState?.();
    const now = Date.now();

    if (trackIdRef.current !== currentTrack.id) {
      player.loadVideoById(currentTrack.youtubeVideoId, expected);
      trackIdRef.current = currentTrack.id;
      lastPlayAttemptRef.current = now;
      return;
    }

    if (playback?.state === 'playing') {
      if (drift > (mode === 'hard' ? 0.75 : 1.35)) {
        player.seekTo(expected, true);
      }

      if (state !== ytState?.PLAYING && now - lastPlayAttemptRef.current > 1400) {
        player.playVideo();
        lastPlayAttemptRef.current = now;
      }
    } else if (playback?.state === 'paused') {
      if (drift > 0.4) {
        player.seekTo(expected, true);
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
    if (hasInteracted) {
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

    setHasInteracted(true);
    player.setVolume(nextVolume);
    player.unMute();

    if (playback?.state === 'playing') {
      player.playVideo();
      window.setTimeout(() => {
        player.setVolume(nextVolume);
        player.unMute();
      }, 120);
    }
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
            playerRef.current?.setVolume(localVolume);
            playerRef.current?.mute();
            syncPlayer('hard');
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

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.58fr)_360px]">
      <div className="overflow-hidden rounded-[1.9rem] border border-gold/20 bg-[radial-gradient(circle_at_top,#eab30822,transparent_32%),radial-gradient(circle_at_20%_70%,#9333ea22,transparent_28%),linear-gradient(180deg,#181224,#0a0811)] p-4 shadow-[0_24px_90px_rgba(0,0,0,0.5)]">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.32em] text-gold/70">Main stage</p>
            <h4 className="mt-2 line-clamp-2 text-2xl font-black text-white">{currentTrack?.title ?? 'Aucun titre chargé'}</h4>
            <p className="mt-1 text-sm text-white/58">Vidéo au centre, crowd en dessous, booth à droite. Enfin quelque chose de plus plug.dj.</p>
          </div>
          <span className="rounded-full border border-gold/20 bg-gold/10 px-4 py-2 text-xs uppercase tracking-[0.22em] text-gold">{stageBadge}</span>
        </div>

        <div className="relative overflow-hidden rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,#110d18,#05040a)]">
          <div className="pointer-events-none absolute inset-0 opacity-90">
            <div className="absolute left-[10%] top-0 h-48 w-48 rounded-full bg-fuchsia-500/15 blur-3xl" />
            <div className="absolute right-[8%] top-[10%] h-52 w-52 rounded-full bg-amber-400/15 blur-3xl" />
            <div className="absolute left-1/2 top-[18%] h-40 w-80 -translate-x-1/2 rounded-full bg-sky-400/10 blur-3xl" />
          </div>

          <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 bg-gradient-to-b from-black/75 to-transparent px-4 py-3 text-xs uppercase tracking-[0.22em] text-white/72">
            <span>DJ booth · {ownerLabel}</span>
            <span>{syncedCount} sync en live</span>
          </div>

          <div className="relative z-[1] p-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_280px]">
              <div className="space-y-4">
                <div className="relative overflow-hidden rounded-[1.45rem] border border-white/10 bg-black shadow-[0_12px_45px_rgba(0,0,0,0.55)]">
                  <div className="aspect-video w-full bg-black">
                    {currentTrack ? <div ref={playerHostRef} className="h-full w-full [&_iframe]:h-full [&_iframe]:w-full" /> : <div className="flex h-full items-center justify-center text-white/55">Ajoute un titre pour lancer la scène.</div>}
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-4 pb-4 pt-10">
                    <div className="flex items-center justify-between gap-3 text-sm text-white/80">
                      <span>Timing room · {formatClock(liveOffset)}</span>
                      <span>{canControl ? 'Mode DJ' : 'Audience sync'}</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-gradient-to-r from-gold to-amber-300 transition-all" style={{ width: `${progressWidth}%` }} />
                    </div>
                  </div>
                </div>

                <div className="rounded-[1.35rem] border border-white/10 bg-black/30 px-4 py-4 backdrop-blur-sm">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-xs uppercase tracking-[0.26em] text-white/48">Crowd</p>
                    <p className="text-xs text-white/55">{syncedCount > 0 ? `${syncedCount} personne${syncedCount > 1 ? 's' : ''} calée${syncedCount > 1 ? 's' : ''}` : 'Le floor attend du monde'}</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {crowdMembers.length > 0 ? (
                      crowdMembers.map((member, index) => (
                        <div
                          key={member.id}
                          className={`group flex items-center gap-2 rounded-full border px-3 py-2 transition ${member.online ? 'border-emerald-400/20 bg-emerald-400/10' : 'border-white/10 bg-white/5'}`}
                          style={{ transform: `translateY(${playback?.state === 'playing' ? (index % 2 === 0 ? '-2px' : '2px') : '0px'})` }}
                        >
                          <span className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-black ${member.online ? 'bg-emerald-300 text-black' : 'bg-white/10 text-white/70'}`}>
                            {getInitials(member.label) || '??'}
                          </span>
                          <div>
                            <p className="max-w-[7rem] truncate text-sm font-semibold text-white/85">{member.label}</p>
                            <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">{member.online ? 'on beat' : 'idle'}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/55">La crowd est encore vide.</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-[1.4rem] border border-white/10 bg-black/35 p-4 backdrop-blur-sm">
                <div className="mb-4 flex items-center gap-4">
                  <div className="flex h-20 w-20 items-center justify-center rounded-[1.25rem] border border-gold/30 bg-[linear-gradient(180deg,#3b2a11,#140f08)] text-2xl font-black text-gold shadow-[0_0_30px_rgba(234,179,8,0.2)]">{getInitials(ownerLabel) || 'DJ'}</div>
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-[0.24em] text-white/45">Now performing</p>
                    <h5 className="mt-1 truncate text-xl font-black text-white">{ownerLabel}</h5>
                    <p className="mt-1 text-sm text-white/58">{canControl ? 'Tu pilotes la scène.' : 'Tu suis le set en audience sync.'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-8 items-end gap-2 rounded-[1.1rem] border border-white/10 bg-white/5 p-3">
                  {Array.from({ length: 8 }).map((_, index) => {
                    const base = playback?.state === 'playing' ? 24 + ((index * 11 + Math.floor(liveOffset * 10)) % 50) : 18;
                    return <span key={index} className="rounded-full bg-gradient-to-t from-gold via-amber-300 to-white/90 transition-all" style={{ height: `${base}px` }} />;
                  })}
                </div>

                <div className="mt-4 rounded-[1.25rem] border border-white/10 bg-white/5 p-4 text-sm text-white/64">
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

      <div className="rounded-[1.8rem] border border-white/10 bg-black/25 p-5 text-white/78">
        <p className="text-xs uppercase tracking-[0.3em] text-gold/70">Scene controls</p>
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

          <div className="rounded-[1.6rem] border border-emerald-400/25 bg-emerald-400/10 px-5 py-5 shadow-[0_0_0_1px_rgba(52,211,153,0.08)]">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-50">Volume</span>
              <span className="rounded-full border border-emerald-300/30 bg-black/20 px-3 py-1 text-sm font-bold text-emerald-50">{localVolume}%</span>
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
              onTouchStart={() => {
                if (currentTrack) {
                  unlockLocalAudio(localVolume);
                }
              }}
              onInput={(event) => {
                const nextVolume = Number((event.target as HTMLInputElement).value);
                setLocalVolume(nextVolume);
                if (currentTrack) {
                  unlockLocalAudio(nextVolume);
                }
              }}
              disabled={!currentTrack}
              className="mt-4 h-4 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <div className="mt-3 flex items-center justify-between text-xs uppercase tracking-[0.18em] text-emerald-50/80">
              <span>Muet</span>
              <span>Fort</span>
            </div>
            <p className="mt-4 text-sm leading-6 text-emerald-50/85">Touchez le slider une seule fois pour activer l’audio local. Après ça, il sert juste de vrai volume, pas d’un bouton planqué chelou.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
