'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AvatarDisplay } from '@/components/avatar-display';
import { SceneAudioControlBar } from '@/components/scene-audio-control-bar';
import { AudioEngine, useAudioEngine } from '@/lib/audio-engine';
import { globalAudioController, useGlobalAudioController } from '@/lib/audio-controller';
import type { PlaybackPreview, QueueItemPreview, RoomMemberPreview, RoomReactionSummary, RoomReactionType } from '@/lib/rooms';
import { assignPitSlots, defaultPitSlots } from '@/lib/pit-layout';
import { YouTubeAudioAdapter, type YouTubePlayerFactory, type YouTubeStateMap } from '@/lib/youtube-audio-adapter';

declare global {
  interface Window {
    YT?: {
      Player: YouTubePlayerFactory;
      PlayerState: YouTubeStateMap;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

type ScenePlayerProps = {
  track?: QueueItemPreview;
  playback?: PlaybackPreview;
  reactions?: RoomReactionSummary;
  canControl: boolean;
  members: RoomMemberPreview[];
  ownerLabel: string;
  onTogglePlayback: (nextState: 'playing' | 'paused', currentOffset: number) => void;
  onNextTrack: () => void;
  onStopPlayback: () => void;
};

type ReactionBurst = {
  id: string;
  type: RoomReactionType;
  lane: number;
  side: 'left' | 'right';
};

const reactionVisuals: Record<RoomReactionType, { label: string; emoji: string; accent: string; glow: string }> = {
  woot: { label: 'Woot', emoji: '🔥', accent: 'text-fuchsia-50', glow: 'from-fuchsia-400/30 to-transparent' },
  grab: { label: 'Grab', emoji: '💿', accent: 'text-cyan-50', glow: 'from-cyan-400/30 to-transparent' },
  meh: { label: 'Meh', emoji: '🫠', accent: 'text-amber-50', glow: 'from-amber-300/30 to-transparent' },
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

export function SyncScenePlayer({ track, playback, reactions, canControl, members, ownerLabel, onTogglePlayback, onNextTrack, onStopPlayback }: ScenePlayerProps) {
  const playerHostRef = useRef<HTMLDivElement | null>(null);
  const adapterRef = useRef<YouTubeAudioAdapter | null>(null);
  const engineRef = useRef(new AudioEngine());
  const previousReactionCountsRef = useRef<RoomReactionSummary['counts'] | null>(null);
  const autoAdvanceTrackRef = useRef<string | null>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [reactionBursts, setReactionBursts] = useState<ReactionBurst[]>([]);
  const engineState = useAudioEngine(engineRef.current);
  const { state: globalAudioState } = useGlobalAudioController();

  const currentTrack = track;
  const syncedMembers = members.filter((member) => member.online);
  const syncedCount = syncedMembers.length;
  const crowdMembers = members.filter((member) => member.role !== 'owner').slice(0, defaultPitSlots.length);
  const djMember = members.find((member) => member.role === 'owner');
  const pitAssignments = assignPitSlots(crowdMembers);
  const liveOffset = engineState.playbackState === 'playing' ? engineState.targetOffsetSeconds : engineState.actualOffsetSeconds;

  const stageBadge = useMemo(() => {
    if (!playback) {
      return 'scène en attente';
    }
    if (engineState.playbackState === 'buffering') {
      return 'reprise audio';
    }
    if (engineState.playbackState === 'error') {
      return 'audio décroché';
    }
    if (playback.state === 'playing') {
      return 'live sync';
    }
    if (playback.state === 'paused') {
      return 'pause room';
    }
    return 'set terminé';
  }, [engineState.playbackState, playback]);

  const sceneMood = useMemo<'idle' | 'groove' | 'hype'>(() => {
    if (engineState.playbackState !== 'playing') {
      return 'idle';
    }

    const woots = reactions?.counts.woot ?? 0;
    const grabs = reactions?.counts.grab ?? 0;
    if (reactionBursts.length >= 3 || woots + grabs >= 6) {
      return 'hype';
    }

    return 'groove';
  }, [engineState.playbackState, reactionBursts.length, reactions?.counts.grab, reactions?.counts.woot]);

  function getMemberMood(memberId: string) {
    const reaction = reactions?.userReactions?.[memberId];
    if (reaction === 'woot') {
      return sceneMood === 'hype' ? 'hype' : 'groove';
    }
    return 'idle' as const;
  }

  useEffect(() => {
    if (!reactions) {
      previousReactionCountsRef.current = null;
      return;
    }

    const previous = previousReactionCountsRef.current;
    previousReactionCountsRef.current = reactions.counts;
    if (!previous) {
      return;
    }

    const nextBursts: ReactionBurst[] = [];
    (Object.entries(reactions.counts) as [RoomReactionType, number][]).forEach(([type, count], typeIndex) => {
      const diff = count - (previous[type] ?? 0);
      const burstCount = Math.min(3, Math.max(0, diff));
      for (let index = 0; index < burstCount; index += 1) {
        nextBursts.push({
          id: `${type}-${Date.now()}-${typeIndex}-${index}`,
          type,
          lane: (typeIndex + index) % 3,
          side: (typeIndex + index) % 2 === 0 ? 'left' : 'right',
        });
      }
    });

    if (!nextBursts.length) {
      return;
    }

    setReactionBursts((current) => [...current, ...nextBursts].slice(-12));
    const timeout = window.setTimeout(() => {
      setReactionBursts((current) => current.filter((burst) => !nextBursts.some((entry) => entry.id === burst.id)));
    }, 2100);

    return () => window.clearTimeout(timeout);
  }, [reactions]);

  useEffect(() => {
    if (!currentTrack || !playerHostRef.current) {
      return;
    }

    let cancelled = false;

    void ensureYouTubeApi().then((YT) => {
      if (cancelled || !YT?.Player || !playerHostRef.current) {
        return;
      }

      if (!adapterRef.current) {
        const adapter = new YouTubeAudioAdapter(playerHostRef.current, YT.Player, YT.PlayerState);
        adapter.mount(currentTrack.youtubeVideoId);
        adapterRef.current = adapter;
        engineRef.current.attachAdapter(adapter);
        engineRef.current.setVolume(globalAudioState.volume);
        engineRef.current.setMuted(globalAudioState.muted);
        void engineRef.current.loadTrack(
          {
            trackId: currentTrack.id,
            youtubeVideoId: currentTrack.youtubeVideoId,
          },
          playback,
        );
        setPlayerReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [currentTrack?.id, currentTrack?.youtubeVideoId, globalAudioState.muted, globalAudioState.volume, playback]);

  useEffect(() => {
    if (!currentTrack) {
      engineRef.current.reset();
      setPlayerReady(false);
      return;
    }

    void engineRef.current.loadTrack(
      {
        trackId: currentTrack.id,
        youtubeVideoId: currentTrack.youtubeVideoId,
      },
      playback,
    );
  }, [currentTrack?.id, currentTrack?.youtubeVideoId]);

  useEffect(() => {
    void engineRef.current.syncToPlayback(playback);
  }, [playback?.state, playback?.startedAt, playback?.offsetSeconds, playback?.updatedAt]);

  useEffect(() => {
    engineRef.current.setMuted(globalAudioState.muted);
  }, [globalAudioState.muted]);

  useEffect(() => {
    engineRef.current.setVolume(globalAudioState.volume);
  }, [globalAudioState.volume]);

  useEffect(() => {
    return globalAudioController.registerSource(`youtube-scene-${currentTrack?.id ?? 'idle'}`, {
      play: () => {
        if (!currentTrack) {
          return;
        }
        engineRef.current.play();
      },
      pause: () => {
        engineRef.current.pause();
      },
      stop: () => {
        engineRef.current.stop();
      },
      setVolume: (volume) => {
        engineRef.current.setVolume(volume);
      },
      setMuted: (muted) => {
        engineRef.current.setMuted(muted);
      },
    });
  }, [currentTrack?.id]);

  useEffect(() => {
    autoAdvanceTrackRef.current = null;
  }, [currentTrack?.id]);

  useEffect(() => {
    if (engineState.playbackState === 'ended' && canControl && currentTrack) {
      if (autoAdvanceTrackRef.current !== currentTrack.id) {
        autoAdvanceTrackRef.current = currentTrack.id;
        onNextTrack();
      }
    }
  }, [canControl, currentTrack, engineState.playbackState, onNextTrack]);

  useEffect(() => {
    if (!playback) {
      globalAudioController.setPlayback('paused');
      return;
    }

    globalAudioController.setPlayback(playback.state === 'ended' ? 'stopped' : playback.state);
  }, [playback]);

  useEffect(() => {
    return () => {
      adapterRef.current?.destroy();
      adapterRef.current = null;
      engineRef.current.detachAdapter();
    };
  }, []);

  const progressWidth = Math.min(100, ((liveOffset % 240) / 240) * 100);
  const stageGlow =
    engineState.playbackState === 'buffering'
      ? 'shadow-[0_0_40px_rgba(34,211,238,0.16)]'
      : sceneMood === 'hype'
        ? 'shadow-[0_0_60px_rgba(244,114,182,0.18)]'
        : 'shadow-[0_0_28px_rgba(34,211,238,0.08)]';

  return (
    <div className="overflow-hidden rounded-[2rem] border border-fuchsia-400/20 bg-[radial-gradient(circle_at_top,#fb718522,transparent_28%),radial-gradient(circle_at_15%_75%,#9333ea26,transparent_30%),radial-gradient(circle_at_85%_20%,#22d3ee22,transparent_28%),linear-gradient(180deg,#20112d,#09060f)] p-4 shadow-[0_24px_90px_rgba(0,0,0,0.55)]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.3em] text-gold/70">Main stage</p>
          <h4 className="mt-1 line-clamp-2 text-xl font-black text-white">{currentTrack?.title ?? 'Aucun titre chargé'}</h4>
        </div>
        <div className="flex items-center gap-2">
          {engineState.playbackState === 'error' ? (
            <button
              type="button"
              onClick={() => engineRef.current.retry()}
              className="rounded-full border border-red-300/20 bg-red-300/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-red-50 transition hover:bg-red-300/16"
            >
              Retry son
            </button>
          ) : null}
          <span className="shrink-0 rounded-full border border-gold/20 bg-gold/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.22em] text-gold">{stageBadge}</span>
        </div>
      </div>

      <SceneAudioControlBar
        canControl={canControl}
        hasTrack={Boolean(currentTrack)}
        playbackState={engineState.playbackState}
        health={engineState.health}
        onPlay={() => onTogglePlayback('playing', playback?.state === 'paused' ? liveOffset : getExpectedOffset(playback))}
        onNext={onNextTrack}
        onStop={onStopPlayback}
      />

      <div className={`relative overflow-hidden rounded-[1.9rem] border border-white/10 bg-[linear-gradient(180deg,#140d1d,#05040a)] ${stageGlow}`}>
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
                  <span>{currentTrack ? (playerReady ? 'live video' : 'loading') : 'offline'}</span>
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

              <div className={`absolute left-1/2 bottom-[13.5rem] z-[6] flex -translate-x-1/2 flex-col items-center transition-transform duration-500 ${sceneMood === 'hype' ? 'translate-y-[-0.35rem]' : sceneMood === 'groove' ? 'translate-y-[-0.15rem]' : ''}`}>
                <div className={`absolute -top-10 h-32 w-32 rounded-full blur-2xl ${sceneMood === 'hype' ? 'bg-fuchsia-400/30' : 'bg-fuchsia-400/20'}`} />
                <AvatarDisplay avatar={djMember?.avatar} label={ownerLabel} size="lg" badge="DJ" mood={sceneMood} raisedHand={reactions?.userReactions?.[djMember?.id ?? ''] === 'grab'} />
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
                {reactions ? (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {(Object.entries(reactions.counts) as [RoomReactionType, number][]).map(([type, count]) => (
                      <div key={type} className={`rounded-full border border-white/8 bg-white/6 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] ${reactionVisuals[type].accent}`}>
                        {reactionVisuals[type].emoji} {reactionVisuals[type].label} · {count}
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="relative rounded-[1.6rem] border border-cyan-300/8 bg-[linear-gradient(180deg,rgba(20,18,32,0.76),rgba(8,8,14,0.82))] px-4 py-5 shadow-[inset_0_0_24px_rgba(34,211,238,0.03)]">
                  <div className="pointer-events-none absolute inset-x-6 bottom-[9.8rem] z-[9] h-28 overflow-hidden">
                    {reactionBursts.map((burst, index) => (
                      <div
                        key={burst.id}
                        className={`reaction-burst absolute bottom-0 ${burst.side === 'left' ? 'left-[12%]' : 'right-[12%]'} ${reactionVisuals[burst.type].accent}`}
                        style={{
                          animationDelay: `${index * 40}ms`,
                          transform: `translateX(${burst.side === 'left' ? burst.lane * 44 : burst.lane * -44}px)`,
                        }}
                      >
                        <div className={`absolute inset-0 -z-10 rounded-full bg-gradient-to-t ${reactionVisuals[burst.type].glow} blur-xl`} />
                        <span className="text-lg drop-shadow-[0_0_12px_rgba(255,255,255,0.18)]">{reactionVisuals[burst.type].emoji}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mb-4 grid grid-cols-3 gap-2 text-[10px] uppercase tracking-[0.16em] text-white/44">
                    <div className="rounded-full border border-white/8 bg-white/5 px-3 py-2 text-center">front rail</div>
                    <div className="rounded-full border border-fuchsia-300/12 bg-fuchsia-300/6 px-3 py-2 text-center text-fuchsia-100/55">crowd heat</div>
                    <div className="rounded-full border border-cyan-300/12 bg-cyan-300/6 px-3 py-2 text-center text-cyan-100/55">live listeners</div>
                  </div>
                  <div className="relative min-h-[20rem] overflow-hidden rounded-[1.25rem] border border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))] pb-2">
                    {defaultPitSlots.map((slot) => {
                      const assigned = pitAssignments.find((entry) => entry.slot.id === slot.id);
                      const member = assigned?.member;
                      const reaction = member ? reactions?.userReactions?.[member.id] ?? null : null;
                      const memberMood = member ? getMemberMood(member.id) : 'idle';
                      const slotGlow = member
                        ? reaction === 'woot'
                          ? 'border-fuchsia-300/30 bg-fuchsia-300/12 shadow-[0_0_22px_rgba(217,70,239,0.14)]'
                          : member.online
                            ? 'border-cyan-300/25 bg-cyan-300/10 shadow-[0_0_18px_rgba(34,211,238,0.08)]'
                            : 'border-white/10 bg-white/5'
                        : 'border-white/8 bg-white/[0.03]';

                      return (
                        <div
                          key={slot.id}
                          className="absolute"
                          style={{
                            left: `${slot.x}%`,
                            top: `${slot.y}%`,
                            transform: `translate(-50%, 0) scale(${slot.scale})`,
                            zIndex: slot.zIndex,
                          }}
                        >
                          <div className="flex w-[4.9rem] flex-col items-center justify-end">
                            <div className={`mb-1 h-2 w-2 rounded-full ${member?.online ? 'bg-emerald-400 shadow-[0_0_12px_rgba(74,222,128,0.7)]' : 'bg-white/16'}`} />
                            <div className={`relative h-[6.8rem] w-[4.9rem] rounded-[1.2rem_1.2rem_0.7rem_0.7rem] border transition ${slotGlow}`}>
                              <div className="absolute inset-x-3 top-3 h-1 rounded-full bg-white/10" />
                              <div className="absolute inset-x-2 bottom-2 h-8 rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))]" />
                              {member ? (
                                <>
                                  <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-5">
                                    <AvatarDisplay
                                      avatar={member.avatar}
                                      label={member.label}
                                      size="sm"
                                      mood={memberMood}
                                      raisedHand={reaction === 'grab'}
                                      badge={reaction === 'grab' ? 'Wants this track' : undefined}
                                    />
                                  </div>
                                  <p className="absolute left-1/2 top-[4.9rem] max-w-[4.8rem] -translate-x-1/2 truncate text-center text-[11px] font-semibold text-white/82">{member.label}</p>
                                  <p className="absolute left-1/2 top-[5.95rem] -translate-x-1/2 text-[9px] uppercase tracking-[0.16em] text-white/45">{reaction === 'woot' ? 'dancing' : reaction === 'meh' ? 'meh' : reaction === 'grab' ? 'grab' : 'idle'}</p>
                                </>
                              ) : (
                                <div className="absolute inset-0 flex items-center justify-center text-[9px] uppercase tracking-[0.16em] text-white/18">empty</div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {crowdMembers.length === 0 ? <div className="absolute inset-x-0 bottom-2 text-center text-sm text-white/45">La fosse est encore vide.</div> : null}
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
