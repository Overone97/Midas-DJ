'use client';

import { useEffect, useMemo, useState } from 'react';
import { RoomPageView } from '@/components/room-page';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { ChatMessagePreview, PlaybackPreview, QueueItemPreview, RoomMemberPreview, RoomPageState, RoomRole } from '@/lib/rooms';
import { extractYouTubeVideoId, getYouTubeThumbnailUrl } from '@/lib/youtube';

type PresenceMeta = {
  user_id?: string;
  label?: string;
  role?: RoomRole;
  online_at?: string;
};

type QueueFeedback = {
  tone: 'neutral' | 'success' | 'error';
  text: string;
};

type ChatFeedback = {
  tone: 'neutral' | 'success' | 'error';
  text: string;
};

type RoomRow = {
  id: string;
  name: string;
  slug: string;
  type: 'public' | 'private';
  description: string | null;
  owner_id: string;
};

type QueueRow = {
  id: string;
  youtube_video_id: string;
  title: string;
  thumbnail_url: string | null;
  duration_seconds: number;
  position: number;
  status: 'queued' | 'playing' | 'played' | 'skipped';
  added_by: string;
  profiles?: { username?: string | null } | { username?: string | null }[] | null;
};

type MembershipRow = {
  role: 'owner' | 'mod' | 'member';
};

type MemberRow = {
  role: 'owner' | 'mod' | 'member';
  profiles?: { id?: string; username?: string | null } | { id?: string; username?: string | null }[] | null;
};

type PlaybackRow = {
  current_queue_item_id: string | null;
  dj_user_id: string | null;
  state: 'playing' | 'paused' | 'ended';
  started_at: string | null;
  offset_seconds: number;
  updated_at: string;
};

type MessageRow = {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles?: { username?: string | null } | { username?: string | null }[] | null;
};

function flattenPresence(state: Record<string, PresenceMeta[] | undefined>) {
  return Object.entries(state).flatMap(([key, metas]) => (metas ?? []).map((meta, index) => ({ key, index, meta })));
}

function dedupeMembers(members: RoomMemberPreview[]) {
  const seen = new Set<string>();
  return members.filter((member) => {
    if (seen.has(member.id)) {
      return false;
    }
    seen.add(member.id);
    return true;
  });
}

function labelFromProfile(
  profile: { username?: string | null; id?: string } | { username?: string | null; id?: string }[] | null | undefined,
  fallback: string,
) {
  const resolved = Array.isArray(profile) ? profile[0] : profile;
  return resolved?.username?.trim() || fallback;
}

function mapQueueRows(rows: QueueRow[]): QueueItemPreview[] {
  return rows.map((item, index) => ({
    id: item.id,
    youtubeVideoId: item.youtube_video_id,
    title: item.title,
    thumbnailUrl: item.thumbnail_url,
    durationSeconds: item.duration_seconds,
    position: item.position ?? index + 1,
    status: item.status,
    addedByLabel: labelFromProfile(item.profiles, `Member ${index + 1}`),
  }));
}

function mapMemberRows(rows: MemberRow[]) {
  return rows.reduce<RoomMemberPreview[]>((acc, entry, index) => {
    const profile = Array.isArray(entry.profiles) ? entry.profiles[0] : entry.profiles;
    if (!profile?.id) {
      return acc;
    }

    acc.push({
      id: profile.id,
      label: labelFromProfile(profile, `Member ${index + 1}`),
      role: entry.role,
      online: false,
    });
    return acc;
  }, []);
}

function mapPlaybackRow(row: PlaybackRow | null | undefined): PlaybackPreview | undefined {
  if (!row) {
    return undefined;
  }

  return {
    currentQueueItemId: row.current_queue_item_id,
    djUserId: row.dj_user_id,
    state: row.state,
    startedAt: row.started_at,
    offsetSeconds: Number(row.offset_seconds ?? 0),
    updatedAt: row.updated_at,
  };
}

function mapMessageRows(rows: MessageRow[]): ChatMessagePreview[] {
  return rows.map((message, index) => ({
    id: message.id,
    content: message.content,
    createdAt: message.created_at,
    userId: message.user_id,
    authorLabel: labelFromProfile(message.profiles, `Listener ${index + 1}`),
  }));
}

function getCurrentOffset(playback?: PlaybackPreview) {
  if (!playback) {
    return 0;
  }

  if (playback.state !== 'playing' || !playback.startedAt) {
    return playback.offsetSeconds;
  }

  return playback.offsetSeconds + Math.max(0, (Date.now() - new Date(playback.startedAt).getTime()) / 1000);
}

export function LiveRoomPage({ initialState }: { initialState: RoomPageState }) {
  const [state, setState] = useState<RoomPageState>(initialState);
  const [presenceConnected, setPresenceConnected] = useState(false);
  const [queueUrl, setQueueUrl] = useState('');
  const [queueTitle, setQueueTitle] = useState('');
  const [queueSubmitting, setQueueSubmitting] = useState(false);
  const [queueFeedback, setQueueFeedback] = useState<QueueFeedback | null>(null);
  const [chatMessage, setChatMessage] = useState('');
  const [chatSubmitting, setChatSubmitting] = useState(false);
  const [chatFeedback, setChatFeedback] = useState<ChatFeedback | null>(null);

  useEffect(() => {
    setState(initialState);
  }, [initialState]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return;
    }

    let cancelled = false;

    async function hydrateRoom() {
      const [authResult, roomResult] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from('rooms').select('id, name, slug, type, description, owner_id').eq('slug', initialState.room.slug).maybeSingle(),
      ]);

      if (cancelled) {
        return;
      }

      const user = authResult.data.user;
      const room = roomResult.data as RoomRow | null;

      if (roomResult.error || !room) {
        setState((current) => ({
          ...current,
          status: 'missing',
          currentUser: { id: user?.id, isLoggedIn: Boolean(user), role: 'visitor', email: user?.email },
          room: {
            ...current.room,
            name: 'Room introuvable',
            description: 'Cette URL ne correspond à aucune room connue côté backend.',
            type: 'public',
            ownerLabel: '—',
          },
          members: [],
          queue: { items: [] },
          playback: undefined,
        }));
        return;
      }

      let membershipData: MembershipRow | null = null;

      if (user) {
        const { data: membership } = await supabase.from('room_members').select('role').eq('room_id', room.id).eq('user_id', user.id).maybeSingle();

        membershipData = (membership as MembershipRow | null) ?? null;

        if (!membershipData && room.type === 'public' && user.id !== room.owner_id) {
          const { error: joinError } = await supabase.from('room_members').upsert({
            room_id: room.id,
            user_id: user.id,
            role: 'member',
          });

          if (!joinError) {
            membershipData = { role: 'member' };
          }
        }
      }

      const [{ data: ownerProfile }, { data: membersData }, { data: queueItemsData }, { data: playbackData }, { data: messagesData }] = await Promise.all([
        supabase.from('profiles').select('username').eq('id', room.owner_id).maybeSingle(),
        supabase.from('room_members').select('role, profiles!room_members_user_id_fkey(id, username)').eq('room_id', room.id).limit(12),
        supabase
          .from('queue_items')
          .select('id, youtube_video_id, title, thumbnail_url, duration_seconds, position, status, added_by, profiles!queue_items_added_by_fkey(username)')
          .eq('room_id', room.id)
          .in('status', ['queued', 'playing'])
          .order('position', { ascending: true })
          .limit(20),
        supabase
          .from('playback_state')
          .select('current_queue_item_id, dj_user_id, state, started_at, offset_seconds, updated_at')
          .eq('room_id', room.id)
          .maybeSingle(),
        supabase
          .from('messages')
          .select('id, content, created_at, user_id, profiles!messages_user_id_fkey(username)')
          .eq('room_id', room.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(30),
      ]);

      if (cancelled) {
        return;
      }

      const role = user ? (membershipData?.role ?? (user.id === room.owner_id ? 'owner' : 'visitor')) : 'visitor';
      const denied = room.type === 'private' && role === 'visitor';
      const queueItems = mapQueueRows((queueItemsData as QueueRow[]) ?? []);

      setState({
        status: denied ? 'forbidden' : 'live',
        envReady: true,
        room: {
          id: room.id,
          name: room.name,
          slug: room.slug,
          type: room.type,
          description: room.description ?? 'La room est prête côté backend. La scène sync tient maintenant debout.',
          ownerLabel: labelFromProfile(ownerProfile, `Owner ${room.owner_id.slice(0, 8)}`),
          ownerId: room.owner_id,
          queueDepth: queueItems.length,
        },
        currentUser: { id: user?.id, isLoggedIn: Boolean(user), role, email: user?.email },
        members: mapMemberRows((membersData as MemberRow[]) ?? []),
        queue: { items: queueItems },
        playback: mapPlaybackRow(playbackData as PlaybackRow | null),
        chat: { messages: mapMessageRows((messagesData as MessageRow[]) ?? []).reverse() },
        presence: { enabled: true, connected: false, onlineCount: 0 },
      });
    }

    void hydrateRoom();

    return () => {
      cancelled = true;
    };
  }, [initialState.room.slug]);

  useEffect(() => {
    if (!state.envReady || !state.room.id) {
      setPresenceConnected(false);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setPresenceConnected(false);
      return;
    }

    const channel = supabase.channel(`room-presence:${state.room.id}`, {
      config: { presence: { key: state.currentUser.email ?? state.currentUser.role } },
    });

    const syncPresence = () => {
      const presenceEntries = flattenPresence(channel.presenceState() as Record<string, PresenceMeta[] | undefined>);
      const presenceById = new Map<string, PresenceMeta>();

      for (const entry of presenceEntries) {
        if (entry.meta.user_id) {
          presenceById.set(entry.meta.user_id, entry.meta);
        }
      }

      setState((current) => {
        const baseMembers = current.members.map((member) => ({ ...member, online: presenceById.has(member.id) }));
        const extraPresentMembers = Array.from(presenceById.entries())
          .filter(([userId]) => !baseMembers.some((member) => member.id === userId))
          .map(([userId, meta], index) => ({
            id: userId,
            label: meta.label?.trim() || `Listener ${index + 1}`,
            role: meta.role === 'owner' || meta.role === 'mod' || meta.role === 'member' ? meta.role : 'visitor',
            online: true,
          })) satisfies RoomMemberPreview[];

        return {
          ...current,
          room: { ...current.room, listenerCount: presenceById.size || current.room.listenerCount },
          members: dedupeMembers([...baseMembers, ...extraPresentMembers]),
          presence: { enabled: true, connected: true, onlineCount: presenceById.size },
        };
      });
    };

    channel
      .on('presence', { event: 'sync' }, syncPresence)
      .subscribe(async (status: 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR') => {
        setPresenceConnected(status === 'SUBSCRIBED');
        if (status !== 'SUBSCRIBED') {
          return;
        }

        const { data } = await supabase.auth.getUser();
        const user = data.user;
        await channel.track({
          user_id: user?.id,
          label: user?.user_metadata?.username || user?.email?.split('@')[0] || 'Guest listener',
          role: state.currentUser.role,
          online_at: new Date().toISOString(),
        });
      });

    return () => {
      void channel.untrack();
      void supabase.removeChannel(channel);
    };
  }, [state.envReady, state.room.id, state.currentUser.email, state.currentUser.role]);

  useEffect(() => {
    if (!state.envReady || !state.room.id) {
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return;
    }

    const roomId = state.room.id;

    async function refreshQueue() {
      const { data, error } = await supabase
        .from('queue_items')
        .select('id, youtube_video_id, title, thumbnail_url, duration_seconds, position, status, added_by, profiles!queue_items_added_by_fkey(username)')
        .eq('room_id', roomId)
        .in('status', ['queued', 'playing'])
        .order('position', { ascending: true })
        .limit(20);

      if (error) {
        setQueueFeedback((current) => current ?? { tone: 'error', text: error.message });
        return;
      }

      const items = mapQueueRows((data as QueueRow[]) ?? []);
      setState((current) => ({
        ...current,
        room: { ...current.room, queueDepth: items.length },
        queue: { items },
      }));
    }

    async function refreshPlayback() {
      const { data, error } = await supabase
        .from('playback_state')
        .select('current_queue_item_id, dj_user_id, state, started_at, offset_seconds, updated_at')
        .eq('room_id', roomId)
        .maybeSingle();

      if (error) {
        return;
      }

      setState((current) => ({ ...current, playback: mapPlaybackRow(data as PlaybackRow | null) }));
    }

    async function refreshMessages() {
      const { data, error } = await supabase
        .from('messages')
        .select('id, content, created_at, user_id, profiles!messages_user_id_fkey(username)')
        .eq('room_id', roomId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) {
        setChatFeedback((current) => current ?? { tone: 'error', text: error.message });
        return;
      }

      setState((current) => ({
        ...current,
        chat: { messages: mapMessageRows((data as MessageRow[]) ?? []).reverse() },
      }));
    }

    const queueChannel = supabase
      .channel(`room-queue:${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_items', filter: `room_id=eq.${roomId}` }, () => {
        void refreshQueue();
      })
      .subscribe();

    const playbackChannel = supabase
      .channel(`room-playback:${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'playback_state', filter: `room_id=eq.${roomId}` }, () => {
        void refreshPlayback();
      })
      .subscribe();

    const messagesChannel = supabase
      .channel(`room-messages:${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` }, () => {
        void refreshMessages();
      })
      .subscribe();

    void refreshQueue();
    void refreshPlayback();
    void refreshMessages();

    return () => {
      void supabase.removeChannel(queueChannel);
      void supabase.removeChannel(playbackChannel);
      void supabase.removeChannel(messagesChannel);
    };
  }, [state.envReady, state.room.id]);

  async function ensurePlaybackStateForFirstTrack(newQueueItemId: string) {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !state.room.id || !state.room.ownerId) {
      return;
    }

    const { data: existing } = await supabase
      .from('playback_state')
      .select('room_id')
      .eq('room_id', state.room.id)
      .maybeSingle();

    if (existing) {
      return;
    }

    await supabase.from('playback_state').insert({
      room_id: state.room.id,
      current_queue_item_id: newQueueItemId,
      dj_user_id: state.room.ownerId,
      state: 'playing',
      started_at: new Date().toISOString(),
      offset_seconds: 0,
    });
  }

  async function handleQueueSubmit() {
    if (!state.envReady || !state.room.id) {
      setQueueFeedback({ tone: 'error', text: 'Mode preview : rien ne sera enregistré.' });
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setQueueFeedback({ tone: 'error', text: 'Client Supabase indisponible.' });
      return;
    }

    if (!state.currentUser.isLoggedIn) {
      setQueueFeedback({ tone: 'error', text: 'Connecte-toi avant d’ajouter un titre.' });
      return;
    }

    const videoId = extractYouTubeVideoId(queueUrl);
    if (!videoId) {
      setQueueFeedback({ tone: 'error', text: 'Lien YouTube invalide. Colle un vrai lien, pas une bouillie.' });
      return;
    }

    setQueueSubmitting(true);
    setQueueFeedback({ tone: 'neutral', text: 'Ajout du titre dans la queue…' });

    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) {
        throw new Error('Session expirée. Recharge ou reconnecte-toi.');
      }

      const { data: latestItems, error: latestItemsError } = await supabase
        .from('queue_items')
        .select('position')
        .eq('room_id', state.room.id)
        .order('position', { ascending: false })
        .limit(1);

      if (latestItemsError) {
        throw latestItemsError;
      }

      const nextPosition = ((latestItems?.[0]?.position as number | undefined) ?? 0) + 1;
      const computedTitle = queueTitle.trim() || `YouTube track · ${videoId}`;

      const { data: inserted, error } = await supabase
        .from('queue_items')
        .insert({
          room_id: state.room.id,
          added_by: user.id,
          dj_user_id: state.room.ownerId ?? user.id,
          youtube_video_id: videoId,
          title: computedTitle,
          thumbnail_url: getYouTubeThumbnailUrl(videoId),
          duration_seconds: 0,
          position: nextPosition,
          status: 'queued',
        })
        .select('id')
        .single();

      if (error) {
        throw error;
      }

      if (!state.playback && inserted?.id) {
        await supabase.from('queue_items').update({ status: 'playing' }).eq('id', inserted.id);
        await ensurePlaybackStateForFirstTrack(inserted.id);
      }

      setQueueUrl('');
      setQueueTitle('');
      setQueueFeedback({ tone: 'success', text: 'Titre ajouté. La scène a maintenant quelque chose à jouer.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Impossible d’ajouter ce titre.';
      setQueueFeedback({ tone: 'error', text: message });
    } finally {
      setQueueSubmitting(false);
    }
  }

  async function handleChatSubmit() {
    if (!state.envReady || !state.room.id) {
      setChatFeedback({ tone: 'error', text: 'Mode preview : le chat live ne part nulle part.' });
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setChatFeedback({ tone: 'error', text: 'Client Supabase indisponible.' });
      return;
    }

    if (!state.currentUser.isLoggedIn) {
      setChatFeedback({ tone: 'error', text: 'Connecte-toi avant de parler dans la room.' });
      return;
    }

    const content = chatMessage.trim();
    if (!content) {
      setChatFeedback({ tone: 'error', text: 'Envoie au moins une vraie phrase, pas du vide.' });
      return;
    }

    setChatSubmitting(true);
    setChatFeedback(null);

    const optimisticId = `optimistic-${Date.now()}`;

    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) {
        throw new Error('Session expirée. Recharge ou reconnecte-toi.');
      }

      const optimisticLabel =
        state.members.find((member) => member.id === user.id)?.label ||
        user.user_metadata?.username ||
        user.email?.split('@')[0] ||
        'Toi';

      setState((current) => ({
        ...current,
        chat: {
          messages: [
            ...(current.chat?.messages ?? []),
            {
              id: optimisticId,
              content,
              createdAt: new Date().toISOString(),
              userId: user.id,
              authorLabel: optimisticLabel,
            },
          ],
        },
      }));
      setChatMessage('');

      const { error } = await supabase.from('messages').insert({
        room_id: state.room.id,
        user_id: user.id,
        content,
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      setState((current) => ({
        ...current,
        chat: {
          messages: (current.chat?.messages ?? []).filter((message) => message.id !== optimisticId),
        },
      }));
      const message = error instanceof Error ? error.message : 'Impossible d’envoyer ce message.';
      setChatFeedback({ tone: 'error', text: message });
    } finally {
      setChatSubmitting(false);
    }
  }

  async function handleTogglePlayback(nextState: 'playing' | 'paused', currentOffset: number) {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !state.room.id || !state.playback) {
      return;
    }

    const payload =
      nextState === 'playing'
        ? {
            state: 'playing',
            started_at: new Date().toISOString(),
            offset_seconds: currentOffset,
          }
        : {
            state: 'paused',
            started_at: null,
            offset_seconds: currentOffset,
          };

    await supabase.from('playback_state').update(payload).eq('room_id', state.room.id).eq('dj_user_id', state.playback.djUserId ?? '');
  }

  async function handleNextTrack() {
    const supabase = getSupabaseBrowserClient();
    const roomId = state.room.id;
    const currentPlayback = state.playback;
    const queueItems = state.queue?.items ?? [];
    if (!supabase || !roomId || !currentPlayback) {
      return;
    }

    const currentTrack = queueItems.find((item) => item.id === currentPlayback.currentQueueItemId) ?? queueItems[0];
    const nextTrack = queueItems.find((item) => item.position > (currentTrack?.position ?? 0));

    if (!nextTrack) {
      await supabase
        .from('playback_state')
        .update({ state: 'ended', started_at: null, offset_seconds: 0 })
        .eq('room_id', roomId)
        .eq('dj_user_id', currentPlayback.djUserId ?? '');
      return;
    }

    if (currentTrack) {
      await supabase.from('queue_items').update({ status: 'played' }).eq('id', currentTrack.id);
    }
    await supabase.from('queue_items').update({ status: 'playing' }).eq('id', nextTrack.id);
    await supabase
      .from('playback_state')
      .update({
        current_queue_item_id: nextTrack.id,
        state: 'playing',
        started_at: new Date().toISOString(),
        offset_seconds: 0,
      })
      .eq('room_id', roomId)
      .eq('dj_user_id', currentPlayback.djUserId ?? '');
  }

  const hydratedState = useMemo<RoomPageState>(
    () => ({
      ...state,
      presence: state.presence
        ? { ...state.presence, connected: presenceConnected }
        : state.envReady && state.room.id
          ? {
              enabled: true,
              connected: presenceConnected,
              onlineCount: state.members.filter((member) => member.online).length,
            }
          : undefined,
    }),
    [presenceConnected, state],
  );

  const canComposeQueue = hydratedState.status === 'live' && hydratedState.currentUser.isLoggedIn;
  const canControlPlayback = hydratedState.status === 'live' && hydratedState.currentUser.role === 'owner';

  return (
    <RoomPageView
      state={hydratedState}
      playerControls={{
        canControl: canControlPlayback,
        onTogglePlayback: (nextState, currentOffset) => void handleTogglePlayback(nextState, currentOffset),
        onNextTrack: () => void handleNextTrack(),
      }}
      queueComposer={
        canComposeQueue
          ? {
              url: queueUrl,
              title: queueTitle,
              submitting: queueSubmitting,
              feedback: queueFeedback,
              onUrlChange: setQueueUrl,
              onTitleChange: setQueueTitle,
              onSubmit: () => void handleQueueSubmit(),
            }
          : undefined
      }
      chatComposer={{
        value: chatMessage,
        submitting: chatSubmitting,
        feedback: chatFeedback,
        onChange: setChatMessage,
        onSubmit: () => void handleChatSubmit(),
      }}
    />
  );
}
