'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AvatarDisplay } from '@/components/avatar-display';
import { SyncScenePlayer } from '@/components/sync-scene-player';
import type { AvatarConfig } from '@/lib/avatar';
import type { LeaderboardPayload, LeaderboardTab } from '@/lib/leaderboard';
import type { PersonalPlaylistItemPreview, RoomPageState, RoomReactionSummary, RoomReactionType, RoomRole } from '@/lib/rooms';
import { createXpSnapshot, xpRequiredForLevel, type XpActionKey } from '@/lib/xp';

type QueueComposerProps = {
  url: string;
  title: string;
  submitting: boolean;
  feedback?: {
    tone: 'neutral' | 'success' | 'error';
    text: string;
  } | null;
  onUrlChange: (value: string) => void;
  onTitleChange: (value: string) => void;
  onSubmit: () => void;
};

type PlaylistComposerProps = {
  url: string;
  title: string;
  submitting: boolean;
  feedback?: {
    tone: 'neutral' | 'success' | 'error';
    text: string;
  } | null;
  onUrlChange: (value: string) => void;
  onTitleChange: (value: string) => void;
  onSubmit: () => void;
};

type PlayerControlsProps = {
  canControl: boolean;
  onTogglePlayback: (nextState: 'playing' | 'paused', currentOffset: number) => void;
  onNextTrack: () => void;
  onStopPlayback: () => void;
  onTrackEnded?: (finishedQueueItemId: string) => void;
};

type PlaylistControlsProps = {
  items: PersonalPlaylistItemPreview[];
  submitting?: boolean;
  feedback?: {
    tone: 'neutral' | 'success' | 'error';
    text: string;
  } | null;
  onSendToQueue: (itemId: string) => void;
  onRemove: (itemId: string) => void;
};

type ChatComposerProps = {
  value: string;
  submitting: boolean;
  feedback?: {
    tone: 'neutral' | 'success' | 'error';
    text: string;
  } | null;
  onChange: (value: string) => void;
  onSubmit: () => void;
};

type AvatarControlsProps = {
  open: boolean;
  submitting: boolean;
  draft: AvatarConfig;
  onOpen: () => void;
  onClose: () => void;
  onChange: (avatar: AvatarConfig) => void;
  onSave: () => void;
};

type ReactionControlsProps = {
  counts: Record<RoomReactionType, number>;
  currentUserReaction?: RoomReactionType | null;
  onReact: (reaction: RoomReactionType) => void;
};

type XpToast = {
  id: string;
  action: XpActionKey;
  amount: number;
  reason: string;
  createdAt: string;
  leveledUp?: boolean;
};

export type LeaderboardPanelState = {
  status?: 'idle' | 'loading' | 'ready' | 'error';
  error?: string | null;
  payload?: LeaderboardPayload;
  updatedAt?: string;
};

type LeaderboardListEntry = {
  id: string;
  label: string;
  avatar?: AvatarConfig;
  online: boolean;
  xp: number;
  level: number;
  rank: number;
  medal: string | null;
  isCurrentUser: boolean;
};

type LeaderboardCurrentUserEntry = {
  rank: number;
  level: number;
  score: number;
  label: string;
};

const roleLabels: Record<RoomRole, string> = {
  owner: 'Owner',
  mod: 'Mod',
  member: 'Member',
  visitor: 'Visiteur',
};

const roleAccent: Record<RoomRole, string> = {
  owner: 'border-gold/30 bg-gold/10 text-gold',
  mod: 'border-sky-400/30 bg-sky-400/10 text-sky-100',
  member: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-50',
  visitor: 'border-white/10 bg-white/5 text-white/75',
};

const feedbackStyles: Record<NonNullable<QueueComposerProps['feedback']>['tone'], string> = {
  neutral: 'border-white/10 bg-white/5 text-white/72',
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-50',
  error: 'border-rose-500/30 bg-rose-500/10 text-rose-50',
};

function formatDuration(durationSeconds?: number) {
  if (!durationSeconds || durationSeconds <= 0) {
    return 'durée inconnue';
  }

  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatXp(value?: number) {
  return `${value ?? 0} XP`;
}

export function RoomPageView({
  state,
  queueComposer,
  playlistComposer,
  playlistControls,
  playerControls,
  chatComposer,
  avatarControls,
  reactionControls,
  xpFeed,
  leaderboardState,
  onLeaderboardTabChange,
}: {
  state: RoomPageState;
  queueComposer?: QueueComposerProps;
  playlistComposer?: PlaylistComposerProps;
  playlistControls?: PlaylistControlsProps;
  playerControls?: PlayerControlsProps;
  chatComposer?: ChatComposerProps;
  avatarControls?: AvatarControlsProps;
  reactionControls?: ReactionControlsProps;
  xpFeed?: XpToast[];
  leaderboardState?: Partial<Record<LeaderboardTab, LeaderboardPanelState>>;
  onLeaderboardTabChange?: (tab: LeaderboardTab) => void;
}) {
  const denied = state.status === 'forbidden';
  const missing = state.status === 'missing';
  const preview = state.status === 'preview';
  const onlineMembers = state.members.filter((member) => member.online).length;
  const queueItems = state.queue?.items ?? [];
  const currentTrack = queueItems.find((item) => item.id === state.playback?.currentQueueItemId) ?? queueItems.find((item) => item.status === 'playing') ?? queueItems[0];
  const chatMessages = state.chat?.messages ?? [];
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const [rightPanelTab, setRightPanelTab] = useState<'chat' | 'users' | 'leaderboard'>('chat');
  const [layoutMode, setLayoutMode] = useState<'default' | 'wide'>('wide');
  const [leaderboardTab, setLeaderboardTab] = useState<LeaderboardTab>('best_listeners');
  const [lastSeenMessageId, setLastSeenMessageId] = useState<string | null>(chatMessages.at(-1)?.id ?? null);

  const displayedMessages = useMemo(() => chatMessages.slice(-24), [chatMessages]);

  const firstUnreadMessageId = useMemo(() => {
    if (!displayedMessages.length) {
      return null;
    }

    if (!lastSeenMessageId) {
      return displayedMessages[0]?.id ?? null;
    }

    const seenIndex = displayedMessages.findIndex((message) => message.id === lastSeenMessageId);
    if (seenIndex === -1) {
      return displayedMessages[0]?.id ?? null;
    }

    return displayedMessages[seenIndex + 1]?.id ?? null;
  }, [displayedMessages, lastSeenMessageId]);

  function isNearBottom(node: HTMLDivElement) {
    return node.scrollHeight - node.scrollTop - node.clientHeight < 48;
  }

  useEffect(() => {
    const node = chatScrollRef.current;
    if (!node || rightPanelTab !== 'chat') {
      return;
    }

    if (shouldAutoScrollRef.current) {
      node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' });
      if (chatMessages.length > 0) {
        setLastSeenMessageId(chatMessages.at(-1)?.id ?? null);
      }
    }
  }, [chatMessages.length, rightPanelTab]);

  useEffect(() => {
    if (rightPanelTab !== 'chat') {
      return;
    }

    const node = chatScrollRef.current;
    if (!node) {
      return;
    }

    const handleScroll = () => {
      const nearBottom = isNearBottom(node);
      shouldAutoScrollRef.current = nearBottom;

      if (nearBottom && chatMessages.length > 0) {
        setLastSeenMessageId(chatMessages.at(-1)?.id ?? null);
      }
    };

    handleScroll();
    node.addEventListener('scroll', handleScroll);
    return () => node.removeEventListener('scroll', handleScroll);
  }, [chatMessages, rightPanelTab]);

  useEffect(() => {
    if (rightPanelTab === 'chat' && chatMessages.length > 0 && !firstUnreadMessageId) {
      setLastSeenMessageId(chatMessages.at(-1)?.id ?? null);
      shouldAutoScrollRef.current = true;
    }
  }, [chatMessages, firstUnreadMessageId, rightPanelTab]);

  const unreadCount = useMemo(() => {
    if (!firstUnreadMessageId) {
      return 0;
    }

    const firstUnreadIndex = displayedMessages.findIndex((entry) => entry.id === firstUnreadMessageId);
    return firstUnreadIndex === -1 ? 0 : displayedMessages.length - firstUnreadIndex;
  }, [displayedMessages, firstUnreadMessageId]);

  const activeLeaderboard = leaderboardState?.[leaderboardTab];

  useEffect(() => {
    onLeaderboardTabChange?.(leaderboardTab);
  }, [leaderboardTab, onLeaderboardTabChange]);

  const leaderboardEntries = useMemo<LeaderboardListEntry[]>(() => {
    const serverEntries = activeLeaderboard?.payload?.entries;
    if (serverEntries && serverEntries.length > 0) {
      return serverEntries.map((entry) => ({
        id: entry.userId,
        label: entry.username,
        avatar: undefined,
        online: state.members.some((member) => member.id === entry.userId && member.online) || state.currentUser.id === entry.userId,
        xp: entry.score,
        level: entry.level,
        rank: entry.rank,
        medal: entry.medal === 'gold' ? '🥇' : entry.medal === 'silver' ? '🥈' : entry.medal === 'bronze' ? '🥉' : null,
        isCurrentUser: entry.isCurrentUser ?? entry.userId === state.currentUser.id,
      }));
    }

    const uniqueMembers = new Map<string, RoomPageState['members'][number]>();

    for (const member of state.members) {
      uniqueMembers.set(member.id, member);
    }

    if (state.currentUser.id) {
      uniqueMembers.set(state.currentUser.id, {
        id: state.currentUser.id,
        label: state.currentUser.label ?? state.currentUser.email?.split('@')[0] ?? 'You',
        role: state.currentUser.role,
        online: true,
        avatar: state.currentUser.avatar,
        avatarLoadout: state.currentUser.avatarLoadout,
        avatarProgression: state.currentUser.avatarProgression,
      });
    }

    return Array.from(uniqueMembers.values())
      .map((member) => ({
        ...member,
        xp: member.avatarProgression?.xp ?? 0,
        level: member.avatarProgression?.level ?? 1,
      }))
      .sort((a, b) => (b.xp - a.xp) || (Number(b.online) - Number(a.online)) || a.label.localeCompare(b.label))
      .slice(0, 50)
      .map((member, index) => ({
        id: member.id,
        label: member.label,
        avatar: member.avatar,
        online: Boolean(member.online),
        rank: index + 1,
        xp: member.xp,
        level: member.level,
        medal: index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : null,
        isCurrentUser: member.id === state.currentUser.id,
      }));
  }, [activeLeaderboard, state.currentUser.avatar, state.currentUser.avatarLoadout, state.currentUser.avatarProgression, state.currentUser.email, state.currentUser.id, state.currentUser.label, state.currentUser.role, state.members]);

  const leaderboardStatus = activeLeaderboard?.status ?? 'idle';
  const leaderboardError = activeLeaderboard?.error ?? null;
  const leaderboardUpdatedAt = activeLeaderboard?.updatedAt;
  const currentUserLeaderboardEntry = useMemo<LeaderboardCurrentUserEntry | null>(() => {
    const serverEntry = activeLeaderboard?.payload?.currentUserEntry;
    if (serverEntry) {
      return {
        rank: serverEntry.rank,
        level: serverEntry.level,
        score: serverEntry.score,
        label: serverEntry.username,
      };
    }

    const fallbackEntry = leaderboardEntries.find((entry) => entry.isCurrentUser);
    if (!fallbackEntry) {
      return null;
    }

    return {
      rank: fallbackEntry.rank,
      level: fallbackEntry.level,
      score: fallbackEntry.xp,
      label: fallbackEntry.label,
    };
  }, [activeLeaderboard, leaderboardEntries]);

  const reactionSummary: RoomReactionSummary | undefined = state.reactions;
  const isWideLayout = layoutMode === 'wide';
  const xpSnapshot = createXpSnapshot(state.currentUser.avatarProgression?.xp ?? 0);
  const currentLevelFloor = xpRequiredForLevel(xpSnapshot.level);
  const nextLevelTarget = xpRequiredForLevel(xpSnapshot.level + 1);
  const xpProgressPercent = nextLevelTarget > currentLevelFloor ? Math.min(100, Math.max(0, (((xpSnapshot.xp - currentLevelFloor) / (nextLevelTarget - currentLevelFloor)) * 100))) : 0;

  return (
    <section className="space-y-4">
      {xpFeed && xpFeed.length > 0 ? (
        <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
          {xpFeed.map((event) => (
            <div key={event.id} className={`rounded-[1.1rem] border px-4 py-3 shadow-[0_18px_40px_rgba(0,0,0,0.35)] backdrop-blur ${event.leveledUp ? 'border-gold/30 bg-[linear-gradient(180deg,rgba(251,191,36,0.18),rgba(0,0,0,0.55))] text-gold' : 'border-cyan-300/18 bg-[linear-gradient(180deg,rgba(34,211,238,0.16),rgba(0,0,0,0.55))] text-cyan-50'}`}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-black">+{event.amount} XP</p>
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/55">{new Date(event.createdAt).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
              <p className="mt-1 text-sm text-white/85">{event.reason}</p>
              {event.leveledUp ? <p className="mt-1 text-[11px] font-black uppercase tracking-[0.16em] text-gold">Level up</p> : null}
            </div>
          ))}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[1.6rem] border border-fuchsia-400/15 bg-[radial-gradient(circle_at_top,#fb71851c,transparent_26%),radial-gradient(circle_at_85%_15%,#22d3ee18,transparent_24%),linear-gradient(180deg,#170f23,#09070f)] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-fuchsia-200/72">Plug floor</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-black text-white">{state.room.name}</h2>
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-white/70">{state.room.type}</span>
              <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${roleAccent[state.currentUser.role]}`}>{roleLabels[state.currentUser.role]}</span>
            </div>
            <p className="mt-2 max-w-4xl text-sm text-white/66">{state.room.description}</p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:min-w-[20rem]">
            <div className="rounded-[1rem] border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/72">
              <p className="text-[10px] uppercase tracking-[0.22em] text-white/45">Accès</p>
              <p className="mt-1 text-sm font-black text-white">{missing ? 'Introuvable' : denied ? 'Refusé' : preview ? 'Preview statique' : 'Disponible'}</p>
            </div>
            <div className="rounded-[1rem] border border-emerald-400/15 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-50/90">
              <p className="text-[10px] uppercase tracking-[0.22em] text-emerald-100/60">Présence</p>
              <p className="mt-1 text-sm font-black">{state.presence?.enabled ? state.presence.connected ? `${state.presence.onlineCount} en ligne` : 'connexion…' : `${onlineMembers} visibles`}</p>
            </div>
          </div>
        </div>

        {state.currentUser.isLoggedIn ? (
          <div className="mt-4 rounded-[1.2rem] border border-gold/12 bg-black/25 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-white/76">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-gold/72">Progression</p>
                <p className="mt-1 font-black text-white">Niveau {xpSnapshot.level} · {formatXp(xpSnapshot.xp)}</p>
              </div>
              <p className="text-xs text-white/58">Plus que {xpSnapshot.xpToNext} XP pour le niveau suivant</p>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-gold via-amber-300 to-fuchsia-300 transition-all" style={{ width: `${xpProgressPercent}%` }} />
            </div>
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-white/62">
          <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">slug · {state.room.slug}</span>
          <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">owner · {state.room.ownerLabel}</span>
          {typeof state.room.listenerCount === 'number' ? <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">audience · {state.room.listenerCount}</span> : null}
          {typeof state.room.queueDepth === 'number' ? <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">queue · {state.room.queueDepth} titres</span> : null}
          {state.playback ? <span className="rounded-full border border-gold/20 bg-gold/10 px-3 py-1 text-gold">sync · {state.playback.state}</span> : null}
          {state.currentUser.isLoggedIn ? <span className="rounded-full border border-cyan-300/15 bg-cyan-300/10 px-3 py-1 text-cyan-50">session · {state.currentUser.email}</span> : null}
        </div>
      </div>

      <div className={`grid gap-4 xl:items-start ${isWideLayout ? 'xl:grid-cols-[minmax(0,1.2fr)_460px] 2xl:grid-cols-[minmax(0,1.35fr)_500px]' : 'xl:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_420px]'}`}>
        <div className="rounded-[1.8rem] border border-fuchsia-400/12 bg-[linear-gradient(180deg,rgba(12,10,18,0.96),rgba(7,6,11,0.95))] p-3 shadow-[0_22px_70px_rgba(0,0,0,0.35)]">
          <div className="mb-3 flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.24em] text-fuchsia-200/72">Main stage</p>
              <h3 className="mt-1 text-xl font-black text-white">Scène synchronisée</h3>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden rounded-full border border-white/10 bg-black/20 p-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/68 md:flex">
                <button type="button" onClick={() => setLayoutMode('default')} className={`rounded-full px-3 py-1 transition ${!isWideLayout ? 'bg-white/10 text-white' : 'hover:bg-white/6'}`}>cozy</button>
                <button type="button" onClick={() => setLayoutMode('wide')} className={`rounded-full px-3 py-1 transition ${isWideLayout ? 'bg-fuchsia-300/18 text-fuchsia-50' : 'hover:bg-white/6'}`}>wide</button>
              </div>
              <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/65">{currentTrack ? currentTrack.status : 'placeholder'}</span>
            </div>
          </div>

          {currentTrack ? (
            <SyncScenePlayer
              track={currentTrack}
              playback={state.playback}
              reactions={reactionSummary}
              canControl={playerControls?.canControl ?? false}
              members={state.members}
              ownerLabel={state.room.ownerLabel}
              layoutMode={layoutMode}
              onTogglePlayback={playerControls?.onTogglePlayback ?? (() => undefined)}
              onNextTrack={playerControls?.onNextTrack ?? (() => undefined)}
              onStopPlayback={playerControls?.onStopPlayback ?? (() => undefined)}
              onTrackEnded={playerControls?.onTrackEnded}
            />
          ) : (
            <div className="rounded-[1.6rem] border border-dashed border-gold/20 bg-black/30 p-6 text-white/68">
              Aucun titre dans la queue pour l’instant. Ajoute un lien YouTube et on arrête enfin de regarder du vide.
            </div>
          )}
        </div>

        <div className={`premium-card premium-card-soft rounded-[1.8rem] border border-cyan-300/10 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.08),transparent_28%),linear-gradient(180deg,rgba(8,14,20,0.97),rgba(8,10,16,0.96))] p-4 shadow-[0_18px_55px_rgba(0,0,0,0.28)] xl:sticky xl:top-4 ${isWideLayout ? '2xl:p-5' : ''}`}>
          <div className="rounded-[1.35rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-cyan-100/66">Room live</p>
                <h3 className="mt-1 text-lg font-black text-white">Le dancefloor parle</h3>
              </div>
              <div className="flex rounded-full border border-white/10 bg-black/25 p-1 text-xs font-semibold text-white/70">
                <button type="button" onClick={() => setRightPanelTab('chat')} className={`premium-button rounded-full px-3 py-1.5 transition ${rightPanelTab === 'chat' ? 'bg-cyan-300/16 text-cyan-50 shadow-[0_0_16px_rgba(34,211,238,0.12)]' : 'hover:bg-white/6'}`}>Chat{unreadCount > 0 ? <span className="ml-2 rounded-full bg-fuchsia-400/80 px-1.5 py-0.5 text-[10px] font-black text-white">{unreadCount}</span> : null}</button>
                <button type="button" onClick={() => setRightPanelTab('users')} className={`premium-button rounded-full px-3 py-1.5 transition ${rightPanelTab === 'users' ? 'bg-cyan-300/16 text-cyan-50 shadow-[0_0_16px_rgba(34,211,238,0.12)]' : 'hover:bg-white/6'}`}>Users</button>
                <button type="button" onClick={() => setRightPanelTab('leaderboard')} className={`premium-button rounded-full px-3 py-1.5 transition ${rightPanelTab === 'leaderboard' ? 'bg-cyan-300/16 text-cyan-50 shadow-[0_0_16px_rgba(34,211,238,0.12)]' : 'hover:bg-white/6'}`}>Top</button>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-left">
              <div className="premium-card premium-float rounded-[1rem] border border-white/8 bg-white/5 px-3 py-2">
                <p className="text-[9px] uppercase tracking-[0.16em] text-white/42">tab</p>
                <p className="mt-1 text-sm font-black text-white">{rightPanelTab === 'chat' ? 'chat' : rightPanelTab === 'users' ? 'users' : 'top'}</p>
              </div>
              <div className="premium-card premium-float rounded-[1rem] border border-white/8 bg-white/5 px-3 py-2 [animation-delay:140ms]">
                <p className="text-[9px] uppercase tracking-[0.16em] text-white/42">live</p>
                <p className="mt-1 text-sm font-black text-white">{onlineMembers}</p>
              </div>
              <div className="premium-card premium-float rounded-[1rem] border border-fuchsia-300/12 bg-fuchsia-300/8 px-3 py-2 [animation-delay:280ms]">
                <p className="text-[9px] uppercase tracking-[0.16em] text-fuchsia-100/48">queue</p>
                <p className="mt-1 text-sm font-black text-fuchsia-50">{queueItems.length}</p>
              </div>
            </div>
          </div>

          {rightPanelTab === 'chat' ? (
          <div className="relative mt-4">
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-12 rounded-t-[1.2rem] bg-[linear-gradient(180deg,rgba(4,10,16,0.95),rgba(4,10,16,0.55),transparent)]" />
            <div ref={chatScrollRef} className={`chat-scrollbar space-y-1.5 overflow-y-auto rounded-[1.2rem] border border-cyan-300/10 bg-[linear-gradient(180deg,rgba(2,6,10,0.66),rgba(4,6,12,0.88))] p-2.5 shadow-[inset_0_0_30px_rgba(34,211,238,0.05)] ${isWideLayout ? 'max-h-[52rem]' : 'max-h-[46rem]'}`}>
            {displayedMessages.length > 0 ? (
              displayedMessages.map((message) => (
                <div key={message.id}>
                  {firstUnreadMessageId === message.id ? (
                    <div className="chat-new-divider my-2 flex items-center gap-2 px-1">
                      <span className="h-px flex-1 bg-gradient-to-r from-transparent via-fuchsia-300/60 to-fuchsia-300/15" />
                      <span className="rounded-full border border-fuchsia-300/25 bg-fuchsia-300/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-fuchsia-50">Nouveaux messages</span>
                      <span className="h-px flex-1 bg-gradient-to-l from-transparent via-fuchsia-300/60 to-fuchsia-300/15" />
                    </div>
                  ) : null}
                <div className={`premium-card animate-chat-pop rounded-[1rem] border border-white/6 px-3 py-2 shadow-[0_0_18px_rgba(34,211,238,0.06)] ${message.userId === state.currentUser.id ? 'border-fuchsia-300/18 bg-[linear-gradient(90deg,rgba(217,70,239,0.14),rgba(255,255,255,0.02))]' : 'border-cyan-300/10 bg-[linear-gradient(90deg,rgba(34,211,238,0.12),rgba(255,255,255,0.02))]'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <AvatarDisplay avatar={message.authorAvatar} label={message.authorLabel} size="sm" />
                      <p className="truncate text-[13px] font-semibold text-cyan-50/95">{message.authorLabel}</p>
                    </div>
                    <p className="text-[10px] uppercase tracking-[0.14em] text-cyan-100/40">{new Date(message.createdAt).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <p className="mt-1 text-[13px] leading-5 text-white/78">{message.content}</p>
                </div>
                </div>
              ))
            ) : (
              <div className="rounded-[1.1rem] border border-dashed border-cyan-300/15 bg-cyan-300/5 px-4 py-5 text-sm text-cyan-50/55">Pas encore de messages. Quelqu’un doit bien casser la glace.</div>
            )}
            </div>
          </div>
          ) : rightPanelTab === 'users' ? (
            <div className="mt-4 space-y-3 rounded-[1.2rem] border border-cyan-300/10 bg-[linear-gradient(180deg,rgba(2,6,10,0.66),rgba(4,6,12,0.88))] p-3 shadow-[inset_0_0_30px_rgba(34,211,238,0.05)]">
              {state.members.length > 0 ? (
                state.members.map((member) => (
                  <div key={member.id} className={`premium-card group rounded-[1.15rem] border px-3 py-3 transition ${member.online ? 'border-cyan-300/14 bg-[linear-gradient(90deg,rgba(34,211,238,0.12),rgba(255,255,255,0.03))]' : 'border-white/8 bg-white/5 hover:bg-white/6'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className={`mt-3 h-2.5 w-2.5 shrink-0 rounded-full ${member.online ? 'bg-emerald-400 shadow-[0_0_12px_rgba(74,222,128,0.8)]' : 'bg-white/20'}`} />
                        <AvatarDisplay avatar={member.avatar} label={member.label} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white/92">{member.label}</p>
                          <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-white/45">{member.online ? 'en ligne' : 'hors piste'} · lvl {member.avatarProgression?.level ?? 1}</p>
                        </div>
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-[10px] ${roleAccent[member.role]}`}>{roleLabels[member.role]}</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between rounded-[0.95rem] border border-white/6 bg-black/20 px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-white/50">
                      <span>{member.online ? 'sur la piste' : 'idle'}</span>
                      <span>{formatXp(member.avatarProgression?.xp ?? 0)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[1rem] border border-dashed border-white/10 bg-white/5 px-4 py-5 text-sm text-white/55">Personne à afficher pour l’instant.</div>
              )}
            </div>
          ) : (
            <div className="mt-4 space-y-3 rounded-[1.2rem] border border-cyan-300/10 bg-[linear-gradient(180deg,rgba(2,6,10,0.66),rgba(4,6,12,0.88))] p-3 shadow-[inset_0_0_30px_rgba(34,211,238,0.05)]">
              <div className="grid grid-cols-2 gap-2 rounded-[1rem] border border-white/8 bg-black/20 p-1 text-[10px] font-black uppercase tracking-[0.14em] text-white/62">
                {([
                  ['best_listeners', 'Listeners'],
                  ['best_djs', 'DJs'],
                  ['top_day', '24h'],
                  ['top_week', '7j'],
                ] as const).map(([tab, label]) => (
                  <button key={tab} type="button" onClick={() => setLeaderboardTab(tab)} className={`premium-button rounded-full px-3 py-2 transition ${leaderboardTab === tab ? 'bg-fuchsia-300/16 text-fuchsia-50' : 'hover:bg-white/6'}`}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between rounded-[1rem] border border-gold/15 bg-gold/10 px-3 py-2 text-[11px] text-gold/90">
                <span>Classement room</span>
                <span>{leaderboardStatus === 'loading' ? 'sync…' : `${leaderboardEntries.length} / 50`}</span>
              </div>
              {currentUserLeaderboardEntry ? (
                <div className="rounded-[1rem] border border-fuchsia-300/20 bg-fuchsia-300/10 px-3 py-3 text-sm text-white/82">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.18em] text-fuchsia-100/70">Ta place</p>
                      <p className="mt-1 font-black text-white">#{currentUserLeaderboardEntry.rank} · lvl {currentUserLeaderboardEntry.level}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-fuchsia-100/70">Score</p>
                      <p className="mt-1 font-black text-white">{formatXp(currentUserLeaderboardEntry.score)}</p>
                    </div>
                  </div>
                  <p className="mt-2 truncate text-xs text-white/62">{currentUserLeaderboardEntry.label}</p>
                </div>
              ) : null}
              {leaderboardUpdatedAt ? <p className="text-[10px] uppercase tracking-[0.14em] text-white/35">Maj {new Date(leaderboardUpdatedAt).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p> : null}
              {leaderboardStatus === 'error' ? (
                <div className="rounded-[1rem] border border-rose-500/25 bg-rose-500/10 px-4 py-4 text-sm text-rose-50/90">
                  Leaderboard KO pour l’instant. {leaderboardError ?? 'Le backend fait le malin.'}
                </div>
              ) : leaderboardStatus === 'loading' && leaderboardEntries.length === 0 ? (
                <div className="rounded-[1rem] border border-white/8 bg-white/5 px-4 py-5 text-sm text-white/58">Chargement du classement live…</div>
              ) : leaderboardEntries.length === 0 ? (
                <div className="rounded-[1rem] border border-dashed border-white/10 bg-white/5 px-4 py-5 text-sm text-white/55">Pas encore de score exploitable. Il faut bouger la room un peu.</div>
              ) : (
                leaderboardEntries.map((entry) => (
                <div key={entry.id} className={`premium-card flex items-center justify-between rounded-[1rem] border px-3 py-3 ${entry.isCurrentUser ? 'border-fuchsia-300/25 bg-fuchsia-300/10' : 'border-white/8 bg-white/5'}`}>
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/25 text-xs font-black text-white/78">{entry.medal ?? `#${entry.rank}`}</div>
                      <AvatarDisplay avatar={entry.avatar} label={entry.label} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white/92">{entry.label}</p>
                        <p className="text-[10px] uppercase tracking-[0.14em] text-white/45">lvl {entry.level} · {formatXp(entry.xp)}</p>
                      </div>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-[10px] ${entry.online ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-50' : 'border-white/10 bg-white/5 text-white/60'}`}>{entry.online ? 'live' : 'idle'}</span>
                  </div>
                ))
              )}
            </div>
          )}
          {chatComposer && state.currentUser.isLoggedIn && rightPanelTab === 'chat' ? (
            <>
              <div className="mt-4 space-y-3">
                <textarea value={chatComposer.value} onChange={(event) => chatComposer.onChange(event.target.value)} placeholder="Balance une réaction sur le morceau..." rows={2} className="w-full resize-none rounded-[1.1rem] border border-cyan-300/15 bg-[linear-gradient(180deg,rgba(0,0,0,0.28),rgba(34,211,238,0.05))] px-4 py-3 text-[13px] leading-5 text-white outline-none shadow-[inset_0_0_20px_rgba(34,211,238,0.04)] focus:border-cyan-300/45" />
                {chatComposer.feedback?.tone === 'error' ? <div className={`rounded-2xl border px-4 py-3 text-sm ${feedbackStyles[chatComposer.feedback.tone]}`}>{chatComposer.feedback.text}</div> : null}
              </div>
              <button type="button" onClick={chatComposer.onSubmit} disabled={chatComposer.submitting} className="premium-button mt-3 w-full rounded-full border border-cyan-300/20 bg-cyan-300/8 px-5 py-2.5 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-300/12 disabled:cursor-not-allowed disabled:opacity-60">
                {chatComposer.submitting ? 'Envoi…' : 'Envoyer dans la room'}
              </button>
              {reactionControls ? (
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {([
                    ['woot', 'Woot'],
                    ['grab', 'Grab'],
                    ['meh', 'Meh'],
                  ] as const).map(([key, label]) => {
                    const active = reactionControls.currentUserReaction === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => reactionControls.onReact(key)}
                        className={`premium-card premium-button rounded-[1rem] border px-3 py-3 text-left transition ${active ? 'border-fuchsia-300/35 bg-fuchsia-300/14 text-fuchsia-50 shadow-[0_0_18px_rgba(217,70,239,0.14)]' : 'border-white/10 bg-white/5 text-white/75 hover:bg-white/8'}`}
                      >
                        <div className="text-sm font-black uppercase tracking-[0.12em]">{label}</div>
                        <div className="mt-1 text-xs text-white/55">{reactionControls.counts[key]} vibe{reactionControls.counts[key] > 1 ? 's' : ''}</div>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </>
          ) : rightPanelTab === 'chat' ? (
            <div className="mt-4 rounded-[1.2rem] border border-dashed border-white/10 bg-black/30 p-4 text-white/68">
              {preview ? 'Preview statique : le chat n’est pas branché hors backend.' : !state.currentUser.isLoggedIn ? 'Connecte-toi pour chatter avec la room.' : 'Le chat live attend son formulaire.'}
            </div>
          ) : null}
        </div>
      </div>

      <div className={`grid gap-4 ${isWideLayout ? 'xl:grid-cols-[300px_minmax(0,1fr)] 2xl:grid-cols-[340px_minmax(0,1fr)]' : 'xl:grid-cols-[280px_minmax(0,1fr)] 2xl:grid-cols-[320px_minmax(0,1fr)]'}`}>
        <aside className="space-y-5">
          <div className="premium-card rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(217,70,239,0.08),transparent_30%),linear-gradient(180deg,rgba(14,13,19,0.97),rgba(10,10,14,0.95))] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.24)]">
            <p className="text-xs uppercase tracking-[0.24em] text-fuchsia-200/72">Audience</p>
            <h3 className="mt-3 text-2xl font-black text-white">Dans la room</h3>
            <p className="mt-2 text-sm text-white/58">{state.presence?.enabled ? `${onlineMembers} présence${onlineMembers > 1 ? 's' : ''} live détectée${state.presence.connected ? 's' : ''}.` : 'Roster statique pour l’instant.'}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-[1rem] border border-white/8 bg-white/5 px-3 py-2">
                <p className="text-[9px] uppercase tracking-[0.16em] text-white/42">online</p>
                <p className="mt-1 text-sm font-black text-white">{onlineMembers}</p>
              </div>
              <div className="rounded-[1rem] border border-cyan-300/12 bg-cyan-300/8 px-3 py-2">
                <p className="text-[9px] uppercase tracking-[0.16em] text-cyan-100/46">membres</p>
                <p className="mt-1 text-sm font-black text-cyan-50">{state.members.length}</p>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {state.members.length > 0 ? (
                state.members.map((member) => (
                  <div key={member.id} className={`premium-card rounded-[1.25rem] border px-4 py-3 transition ${member.online ? 'border-fuchsia-300/16 bg-[linear-gradient(90deg,rgba(217,70,239,0.1),rgba(255,255,255,0.03))]' : 'border-white/10 bg-white/5'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className={`h-2.5 w-2.5 rounded-full ${member.online ? 'bg-emerald-400 shadow-[0_0_12px_rgba(74,222,128,0.9)]' : 'bg-white/20'}`} />
                        <AvatarDisplay avatar={member.avatar} label={member.label} size="sm" />
                        <div className="min-w-0">
                          <span className="block truncate font-medium text-white/88">{member.label}</span>
                          <span className="block text-[10px] uppercase tracking-[0.16em] text-white/44">lvl {member.avatarProgression?.level ?? 1} · {member.online ? 'live' : 'idle'}</span>
                        </div>
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-xs ${roleAccent[member.role]}`}>{roleLabels[member.role]}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[1.25rem] border border-dashed border-white/10 bg-white/5 px-4 py-5 text-sm text-white/60">Aucun roster exploitable pour l’instant.</div>
              )}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 text-sm text-white/72">
            <p className="text-xs uppercase tracking-[0.24em] text-fuchsia-200/72">Actions</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/rooms" className="premium-button rounded-full bg-gold px-4 py-2 font-semibold text-night">Retour au lobby</Link>
              {!state.currentUser.isLoggedIn ? <Link href="/login" className="premium-button rounded-full border border-white/15 px-4 py-2 font-semibold text-white/85">Se connecter</Link> : null}
              {state.currentUser.isLoggedIn && avatarControls ? <button type="button" onClick={avatarControls.onOpen} className="premium-button rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 font-semibold text-cyan-50">Avatar lab</button> : null}
              {denied ? <Link href="/rooms" className="premium-button rounded-full border border-white/15 px-4 py-2 font-semibold text-white/85">Demander un autre accès</Link> : null}
              {missing ? <Link href="/rooms" className="premium-button rounded-full border border-white/15 px-4 py-2 font-semibold text-white/85">Explorer les rooms visibles</Link> : null}
            </div>
          </div>
        </aside>

        <div className={`space-y-5 ${isWideLayout ? '2xl:grid 2xl:grid-cols-[minmax(0,1.2fr)_minmax(380px,0.8fr)] 2xl:gap-5 2xl:space-y-0' : ''}`}>
          <div className="premium-card rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(217,70,239,0.08),transparent_30%),linear-gradient(180deg,rgba(15,11,18,0.98),rgba(9,9,12,0.96))] p-6 shadow-[0_18px_50px_rgba(0,0,0,0.24)]">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-fuchsia-200/72">Queue</p>
                <h3 className="mt-3 text-2xl font-black text-white">File collaborative</h3>
                <p className="mt-3 text-white/72">{queueItems.length > 0 ? `${queueItems.length} titre${queueItems.length > 1 ? 's' : ''} visible${queueItems.length > 1 ? 's' : ''} dans la file.` : 'La queue est vide. Ça se corrige vite.'}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 md:min-w-[14rem]">
                <div className="premium-card premium-float rounded-[1rem] border border-white/8 bg-white/5 px-3 py-2">
                  <p className="text-[9px] uppercase tracking-[0.16em] text-white/42">en file</p>
                  <p className="mt-1 text-sm font-black text-white">{queueItems.length}</p>
                </div>
                <div className="premium-card premium-float rounded-[1rem] border border-gold/12 bg-gold/8 px-3 py-2 [animation-delay:180ms]">
                  <p className="text-[9px] uppercase tracking-[0.16em] text-gold/55">now playing</p>
                  <p className="mt-1 text-sm font-black text-gold">{queueItems.some((item) => item.status === 'playing') ? 'live' : 'standby'}</p>
                </div>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {queueItems.length > 0 ? (
                queueItems.map((item) => (
                  <div key={item.id} className={`premium-card group flex gap-3 rounded-[1.5rem] border p-3 transition ${item.status === 'playing' ? 'border-gold/20 bg-[linear-gradient(90deg,rgba(212,175,55,0.12),rgba(255,255,255,0.03))] shadow-[0_0_24px_rgba(212,175,55,0.08)]' : 'border-white/10 bg-black/30 hover:bg-black/35'}`}>
                    {item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="Miniature YouTube" className="h-16 w-28 rounded-xl border border-white/8 object-cover shadow-[0_10px_24px_rgba(0,0,0,0.28)]" /> : <div className="flex h-16 w-28 items-center justify-center rounded-xl border border-white/8 bg-white/5 text-xs text-white/40">no thumb</div>}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-white/55">#{item.position}</span>
                        <span className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.18em] ${item.status === 'playing' ? 'border-gold/20 bg-gold/10 text-gold' : 'border-white/10 bg-white/5 text-white/60'}`}>{item.status}</span>
                        <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-white/48">{formatDuration(item.durationSeconds)}</span>
                      </div>
                      <p className="mt-2 truncate text-[15px] font-semibold text-white/90">{item.title}</p>
                      <div className="mt-3 flex items-center justify-between gap-3 rounded-[1rem] border border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] px-3 py-2 text-xs text-white/55">
                        <div className="flex min-w-0 items-center gap-2">
                          <AvatarDisplay avatar={item.addedByAvatar} label={item.addedByLabel} size="sm" />
                          <p className="truncate">Ajouté par {item.addedByLabel}</p>
                        </div>
                        <span className="shrink-0 text-[10px] uppercase tracking-[0.16em] text-white/42">{item.status === 'playing' ? 'sur scène' : 'en attente'}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[1.5rem] border border-dashed border-white/10 bg-black/30 p-5 text-white/60">Toujours rien. La room est prête à encaisser son premier lien.</div>
              )}
            </div>
          </div>

          <div className="premium-card rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.06),transparent_32%),linear-gradient(180deg,rgba(15,11,18,0.98),rgba(9,9,12,0.96))] p-6 shadow-[0_18px_50px_rgba(0,0,0,0.24)]">
            <p className="text-xs uppercase tracking-[0.24em] text-fuchsia-200/72">Ajouter un titre</p>
            <h3 className="mt-3 text-2xl font-black text-white">Drop YouTube dans la file</h3>
            {queueComposer ? (
              <>
                <p className="mt-3 text-white/72">Colle un lien YouTube propre. Le titre est optionnel, sinon on garde une version basée sur l’identifiant vidéo.</p>
                <div className="mt-5 space-y-3">
                  <input type="text" value={queueComposer.url} onChange={(event) => queueComposer.onUrlChange(event.target.value)} placeholder="https://www.youtube.com/watch?v=..." className="premium-button w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-gold/40 focus:shadow-[0_0_0_1px_rgba(212,175,55,0.2),0_0_30px_rgba(212,175,55,0.08)]" />
                  <input type="text" value={queueComposer.title} onChange={(event) => queueComposer.onTitleChange(event.target.value)} placeholder="Titre custom optionnel" className="premium-button w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-gold/40 focus:shadow-[0_0_0_1px_rgba(212,175,55,0.2),0_0_30px_rgba(212,175,55,0.08)]" />
                  {queueComposer.feedback ? <div className={`rounded-2xl border px-4 py-3 text-sm ${feedbackStyles[queueComposer.feedback.tone]}`}>{queueComposer.feedback.text}</div> : null}
                </div>
                <button type="button" onClick={queueComposer.onSubmit} disabled={queueComposer.submitting} className="premium-button mt-5 rounded-full bg-gold px-5 py-3 font-semibold text-night transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
                  {queueComposer.submitting ? 'Ajout…' : 'Ajouter à la queue'}
                </button>
              </>
            ) : (
              <div className="mt-5 rounded-[1.5rem] border border-dashed border-white/10 bg-black/30 p-5 text-white/68">
                {preview ? 'Preview statique : la room montre la queue, mais elle ne persiste rien.' : !state.currentUser.isLoggedIn ? 'Connecte-toi pour empiler de vrais titres.' : 'Le formulaire live n’est pas branché ici.'}
              </div>
            )}
          </div>

          <div className="premium-card rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(217,70,239,0.08),transparent_34%),linear-gradient(180deg,rgba(13,11,18,0.98),rgba(8,8,12,0.96))] p-6 shadow-[0_18px_50px_rgba(0,0,0,0.24)]">
            <p className="text-xs uppercase tracking-[0.24em] text-fuchsia-200/72">My Playlist</p>
            <h3 className="mt-3 text-2xl font-black text-white">Ta bibliothèque perso</h3>
            <p className="mt-3 text-white/72">Persistante, liée à ton compte, et totalement séparée de la queue de la room.</p>

            {playlistComposer ? (
              <div className="mt-5 space-y-3">
                <input type="text" value={playlistComposer.url} onChange={(event) => playlistComposer.onUrlChange(event.target.value)} placeholder="https://www.youtube.com/watch?v=..." className="premium-button w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-fuchsia-300/40 focus:shadow-[0_0_0_1px_rgba(217,70,239,0.18),0_0_30px_rgba(217,70,239,0.08)]" />
                <input type="text" value={playlistComposer.title} onChange={(event) => playlistComposer.onTitleChange(event.target.value)} placeholder="Titre custom optionnel" className="premium-button w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-fuchsia-300/40 focus:shadow-[0_0_0_1px_rgba(217,70,239,0.18),0_0_30px_rgba(217,70,239,0.08)]" />
                {playlistComposer.feedback ? <div className={`rounded-2xl border px-4 py-3 text-sm ${feedbackStyles[playlistComposer.feedback.tone]}`}>{playlistComposer.feedback.text}</div> : null}
                <button type="button" onClick={playlistComposer.onSubmit} disabled={playlistComposer.submitting} className="premium-button rounded-full border border-fuchsia-300/20 bg-fuchsia-300/10 px-5 py-3 font-semibold text-fuchsia-50 transition hover:bg-fuchsia-300/14 disabled:cursor-not-allowed disabled:opacity-60">
                  {playlistComposer.submitting ? 'Ajout…' : 'Ajouter à My Playlist'}
                </button>
              </div>
            ) : (
              <div className="mt-5 rounded-[1.5rem] border border-dashed border-white/10 bg-black/30 p-5 text-white/68">
                Connecte-toi pour sauvegarder tes titres dans ta playlist perso.
              </div>
            )}

            <div className="mt-5 space-y-3">
              {playlistControls && playlistControls.items.length > 0 ? (
                playlistControls.items.map((item) => (
                  <div key={item.id} className="premium-card rounded-[1.35rem] border border-white/10 bg-black/25 p-3">
                    <div className="flex gap-3">
                      {item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="Miniature playlist" className="h-14 w-24 rounded-xl border border-white/8 object-cover" /> : <div className="flex h-14 w-24 items-center justify-center rounded-xl border border-white/8 bg-white/5 text-xs text-white/40">no thumb</div>}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-white/55">#{item.position}</span>
                          <span className="rounded-full border border-fuchsia-300/15 bg-fuchsia-300/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-fuchsia-50">library</span>
                          <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-white/48">{formatDuration(item.durationSeconds)}</span>
                        </div>
                        <p className="mt-2 truncate text-sm font-semibold text-white/90">{item.title}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button type="button" onClick={() => playlistControls.onSendToQueue(item.id)} className="premium-button rounded-full border border-gold/20 bg-gold/10 px-3 py-2 text-xs font-semibold text-gold">Envoyer à la room</button>
                          <button type="button" onClick={() => playlistControls.onRemove(item.id)} className="premium-button rounded-full border border-white/12 bg-white/5 px-3 py-2 text-xs font-semibold text-white/78">Supprimer</button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[1.5rem] border border-dashed border-white/10 bg-black/30 p-5 text-white/60">
                  {state.currentUser.isLoggedIn ? 'Ta playlist est encore vide. Commence à te bâtir une réserve solide.' : 'La playlist perso arrive dès que tu es connecté.'}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
