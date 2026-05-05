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
  const [playerReady, setPlayerReady] = useState(false);
  const [liveOffset, setLiveOffset] = useState(0);
  const [hasInteracted, setHasInteracted] = useState(false);

  const currentTrack = track;
  const syncedCount = members.filter((member) => member.online).length;

  useEffect(() => {
    if (!currentTrack || !playerHostRef.current) {
      return;
    }

    let cancelled = false;

    void ensureYouTubeApi().then((YT) => {
      if (cancelled || !YT?.Player || !playerHostRef.current) {
        return;
      }

      if (playerRef.current && trackIdRef.current !== currentTrack.id) {
        playerRef.current.loadVideoById(currentTrack.youtubeVideoId, 0);
        trackIdRef.current = currentTrack.id;
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
            playerRef.current?.mute();
          },
        },
      });
      trackIdRef.current = currentTrack.id;
    });

    return () => {
      cancelled = true;
    };
  }, [currentTrack]);

  useEffect(() => {
    if (!playerReady || !currentTrack || !playerRef.current) {
      return;
    }

    const player = playerRef.current;
    const expected = getExpectedOffset(playback);
    const current = player.getCurrentTime?.() ?? 0;
    const drift = Math.abs(current - expected);

    if (trackIdRef.current !== currentTrack.id) {
      player.loadVideoById(currentTrack.youtubeVideoId, expected);
      trackIdRef.current = currentTrack.id;
    } else if (drift > 1.5) {
      player.seekTo(expected, true);
    }

    if (playback?.state === 'playing') {
      player.playVideo();
    } else {
      player.pauseVideo();
    }

    if (hasInteracted) {
      player.unMute();
    } else {
      player.mute();
    }
  }, [currentTrack, hasInteracted, playback, playerReady]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (playerRef.current && readyRef.current) {
        setLiveOffset(playerRef.current.getCurrentTime?.() ?? getExpectedOffset(playback));
      } else {
        setLiveOffset(getExpectedOffset(playback));
      }
    }, 500);

    return () => window.clearInterval(timer);
  }, [playback]);

  useEffect(() => {
    return () => {
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

  return (
    <div className="grid gap-5 xl:grid-cols-[1.4fr_0.8fr]">
      <div className="overflow-hidden rounded-[1.75rem] border border-gold/20 bg-[radial-gradient(circle_at_top,#6b4d1f33,transparent_55%),linear-gradient(180deg,#120f18,#09070d)] p-4 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-gold/70">Main stage</p>
            <h4 className="mt-2 text-2xl font-black text-white">{currentTrack?.title ?? 'Aucun titre chargé'}</h4>
          </div>
          <span className="rounded-full border border-gold/20 bg-gold/10 px-4 py-2 text-xs uppercase tracking-[0.22em] text-gold">
            {stageBadge}
          </span>
        </div>

        <div className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/50">
          <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent px-4 py-3 text-xs uppercase tracking-[0.22em] text-white/70">
            <span>DJ booth · {ownerLabel}</span>
            <span>{syncedCount} connecté{syncedCount > 1 ? 's' : ''}</span>
          </div>
          <div className="aspect-video w-full bg-black">
            {currentTrack ? <div ref={playerHostRef} className="h-full w-full" /> : <div className="flex h-full items-center justify-center text-white/55">Ajoute un titre pour lancer la scène.</div>}
          </div>
          <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 to-transparent px-4 py-4">
            <div className="flex items-center justify-between text-sm text-white/75">
              <span>Timing room · {formatClock(liveOffset)}</span>
              <span>{canControl ? 'Mode DJ' : 'Mode audience sync'}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${Math.min(100, ((liveOffset % 240) / 240) * 100)}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[1.75rem] border border-white/10 bg-black/25 p-5 text-white/78">
        <p className="text-xs uppercase tracking-[0.3em] text-gold/70">Scene controls</p>
        <h4 className="mt-3 text-2xl font-black text-white">Comme une vraie room plug.dj</h4>
        <p className="mt-3 text-sm leading-6 text-white/68">
          Le timing affiché ici suit un état partagé en base. Si le DJ play/pause/skip, tout le monde recale la vidéo sur la même horloge.
        </p>

        <div className="mt-5 grid gap-3">
          <button
            type="button"
            onClick={() => {
              setHasInteracted(true);
              onTogglePlayback(playback?.state === 'playing' ? 'paused' : 'playing', liveOffset);
            }}
            disabled={!currentTrack || !canControl}
            className="rounded-full bg-gold px-5 py-3 font-semibold text-night transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {playback?.state === 'playing' ? 'Mettre en pause la scène' : 'Lancer la scène'}
          </button>
          <button
            type="button"
            onClick={() => {
              setHasInteracted(true);
              onNextTrack();
            }}
            disabled={!currentTrack || !canControl}
            className="rounded-full border border-white/15 px-5 py-3 font-semibold text-white transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Morceau suivant
          </button>
          <button
            type="button"
            onClick={() => {
              setHasInteracted(true);
              playerRef.current?.unMute();
            }}
            disabled={!currentTrack}
            className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-5 py-3 font-semibold text-emerald-50 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Activer le son local
          </button>
        </div>

        <div className="mt-6 rounded-[1.25rem] border border-white/10 bg-white/5 p-4 text-sm text-white/64">
          <p>État partagé · {playback?.state ?? 'aucun'}</p>
          <p className="mt-1">Offset room · {formatClock(getExpectedOffset(playback))}</p>
          <p className="mt-1">Track live · {currentTrack?.youtubeVideoId ?? '—'}</p>
        </div>
      </div>
    </div>
  );
}
