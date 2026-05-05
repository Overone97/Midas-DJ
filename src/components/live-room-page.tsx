'use client';

import { useEffect, useMemo, useState } from 'react';
import { RoomPageView } from '@/components/room-page';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { QueueItemPreview, RoomMemberPreview, RoomPageState, RoomRole } from '@/lib/rooms';
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

function flattenPresence(state: Record<string, PresenceMeta[] | undefined>) {
  return Object.entries(state).flatMap(([key, metas]) =>
    (metas ?? []).map((meta, index) => ({
      key,
      index,
      meta,
    })),
  );
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

function labelFromProfile(profile: QueueRow['profiles'], fallback: string) {
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

export function LiveRoomPage({ initialState }: { initialState: RoomPageState }) {
  const [state, setState] = useState<RoomPageState>(initialState);
  const [presenceConnected, setPresenceConnected] = useState(false);
  const [queueUrl, setQueueUrl] = useState('');
  const [queueTitle, setQueueTitle] = useState('');
  const [queueSubmitting, setQueueSubmitting] = useState(false);
  const [queueFeedback, setQueueFeedback] = useState<QueueFeedback | null>(null);

  useEffect(() => {
    setState(initialState);
  }, [initialState]);

  useEffect(() => {
    if (!initialState.envReady || !initialState.room.id) {
      setPresenceConnected(false);
      return;
    }

    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      setPresenceConnected(false);
      return;
    }

    const channel = supabase.channel(`room-presence:${initialState.room.id}`, {
      config: {
        presence: {
          key: initialState.currentUser.email ?? initialState.currentUser.role,
        },
      },
    });

    const syncPresence = () => {
      const presenceEntries = flattenPresence(channel.presenceState() as Record<string, PresenceMeta[] | undefined>);
      const presenceById = new Map<string, PresenceMeta>();

      for (const entry of presenceEntries) {
        const userId = entry.meta.user_id;
        if (!userId) {
          continue;
        }
        presenceById.set(userId, entry.meta);
      }

      setState((current) => {
        const baseMembers = current.members.map((member) => ({
          ...member,
          online: presenceById.has(member.id),
        }));

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
          room: {
            ...current.room,
            listenerCount: presenceById.size || current.room.listenerCount,
          },
          members: dedupeMembers([...baseMembers, ...extraPresentMembers]),
          presence: {
            enabled: true,
            connected: presenceConnected,
            onlineCount: presenceById.size,
          },
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
          role: initialState.currentUser.role,
          online_at: new Date().toISOString(),
        });
      });

    return () => {
      void channel.untrack();
      void supabase.removeChannel(channel);
    };
  }, [initialState]);

  useEffect(() => {
    if (!initialState.envReady || !initialState.room.id) {
      return;
    }

    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      return;
    }

    const roomId = initialState.room.id;

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
        room: {
          ...current.room,
          queueDepth: items.length,
        },
        queue: {
          items,
        },
      }));
    }

    void refreshQueue();

    const channel = supabase
      .channel(`room-queue:${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_items', filter: `room_id=eq.${roomId}` }, () => {
        void refreshQueue();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [initialState.envReady, initialState.room.id]);

  async function handleQueueSubmit() {
    if (!initialState.envReady || !initialState.room.id) {
      setQueueFeedback({ tone: 'error', text: 'Mode preview : rien ne sera enregistré.' });
      return;
    }

    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      setQueueFeedback({ tone: 'error', text: 'Client Supabase indisponible.' });
      return;
    }

    if (!initialState.currentUser.isLoggedIn) {
      setQueueFeedback({ tone: 'error', text: 'Connecte-toi avant d’ajouter un titre.' });
      return;
    }

    const videoId = extractYouTubeVideoId(queueUrl);

    if (!videoId) {
      setQueueFeedback({ tone: 'error', text: 'Lien YouTube invalide. Colle un vrai watch/youtu.be/shorts, pas une horreur bancale.' });
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
        .select('position, status')
        .eq('room_id', initialState.room.id)
        .order('position', { ascending: false })
        .limit(1);

      if (latestItemsError) {
        throw latestItemsError;
      }

      const nextPosition = ((latestItems?.[0]?.position as number | undefined) ?? 0) + 1;
      const hasPlayingTrack = state.queue?.items?.some((item) => item.status === 'playing') ?? false;
      const computedTitle = queueTitle.trim() || `YouTube track · ${videoId}`;

      const { error } = await supabase.from('queue_items').insert({
        room_id: initialState.room.id,
        added_by: user.id,
        dj_user_id: initialState.room.ownerId ?? null,
        youtube_video_id: videoId,
        title: computedTitle,
        thumbnail_url: getYouTubeThumbnailUrl(videoId),
        duration_seconds: 0,
        position: nextPosition,
        status: hasPlayingTrack ? 'queued' : 'playing',
      });

      if (error) {
        throw error;
      }

      setQueueUrl('');
      setQueueTitle('');
      setQueueFeedback({ tone: 'success', text: 'Titre ajouté. La room commence enfin à ressembler à quelque chose.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Impossible d’ajouter ce titre.';
      setQueueFeedback({ tone: 'error', text: message });
    } finally {
      setQueueSubmitting(false);
    }
  }

  const hydratedState = useMemo<RoomPageState>(
    () => ({
      ...state,
      presence: state.presence
        ? {
            ...state.presence,
            connected: presenceConnected,
          }
        : initialState.envReady && initialState.room.id
          ? {
              enabled: true,
              connected: presenceConnected,
              onlineCount: state.members.filter((member) => member.online).length,
            }
          : undefined,
    }),
    [initialState.envReady, initialState.room.id, presenceConnected, state],
  );

  const canComposeQueue = hydratedState.status === 'live' && hydratedState.currentUser.isLoggedIn;

  return (
    <RoomPageView
      state={hydratedState}
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
    />
  );
}
