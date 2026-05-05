'use client';

import { useEffect, useMemo, useState } from 'react';
import { RoomPageView } from '@/components/room-page';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { RoomMemberPreview, RoomPageState, RoomRole } from '@/lib/rooms';

type PresenceMeta = {
  user_id?: string;
  label?: string;
  role?: RoomRole;
  online_at?: string;
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

export function LiveRoomPage({ initialState }: { initialState: RoomPageState }) {
  const [state, setState] = useState<RoomPageState>(initialState);
  const [presenceConnected, setPresenceConnected] = useState(false);

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

  return <RoomPageView state={hydratedState} />;
}
