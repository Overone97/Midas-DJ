import { AppShell } from '@/components/app-shell';
import { RoomPageView } from '@/components/room-page';
import { featuredRooms, getPreviewRoomState } from '@/lib/rooms';
import { hasSupabaseEnv } from '@/lib/supabase/env';
import { getSupabaseServerClient } from '@/lib/supabase/server';

function labelFromProfile(profile: { username?: string | null } | null, fallback: string) {
  return profile?.username?.trim() || fallback;
}

export function generateStaticParams() {
  return featuredRooms.map((room) => ({ slug: room.slug }));
}

export default async function RoomSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  if (!hasSupabaseEnv()) {
    return (
      <AppShell
        eyebrow="Room"
        title={`Room · ${slug}`}
        description="Fallback statique GitHub Pages : la room garde une vraie URL crédible même sans backend branché."
      >
        <RoomPageView state={getPreviewRoomState(slug)} />
      </AppShell>
    );
  }

  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    return (
      <AppShell eyebrow="Room" title={`Room · ${slug}`} description="Client serveur Supabase indisponible.">
        <RoomPageView state={getPreviewRoomState(slug)} />
      </AppShell>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select('id, name, slug, type, description, owner_id')
    .eq('slug', slug)
    .maybeSingle();

  if (roomError || !room) {
    return (
      <AppShell eyebrow="Room" title={`Room · ${slug}`} description="Aucune room correspondante n’a été trouvée.">
        <RoomPageView
          state={{
            ...getPreviewRoomState(slug),
            status: 'missing',
            envReady: true,
            room: {
              name: 'Room introuvable',
              slug,
              type: 'public',
              description: 'Cette URL ne correspond à aucune room Supabase connue. Retourne au lobby pour en créer une nouvelle ou rejoindre un autre slug.',
              ownerLabel: '—',
            },
            currentUser: {
              isLoggedIn: Boolean(user),
              role: 'visitor',
              email: user?.email,
            },
            members: [],
          }}
        />
      </AppShell>
    );
  }

  const [{ data: ownerProfile }, { data: membership }, { data: membersData }] = await Promise.all([
    supabase.from('profiles').select('username').eq('id', room.owner_id).maybeSingle(),
    user
      ? supabase.from('room_members').select('role').eq('room_id', room.id).eq('user_id', user.id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from('room_members')
      .select('role, profiles!room_members_user_id_fkey(id, username)')
      .eq('room_id', room.id)
      .limit(6),
  ]);

  const role = user ? membership?.role ?? (user.id === room.owner_id ? 'owner' : 'visitor') : 'visitor';
  const denied = room.type === 'private' && role === 'visitor';

  const members = Array.isArray(membersData)
    ? membersData.reduce<{ id: string; label: string; role: 'owner' | 'mod' | 'member' }[]>((acc, entry, index) => {
        const profile = Array.isArray(entry.profiles) ? entry.profiles[0] : entry.profiles;
        if (!profile?.id) {
          return acc;
        }

        acc.push({
          id: profile.id,
          label: labelFromProfile(profile, `Member ${index + 1}`),
          role: (entry.role ?? 'member') as 'owner' | 'mod' | 'member',
        });
        return acc;
      }, [])
    : [];

  const state = {
    status: denied ? 'forbidden' : 'live',
    envReady: true,
    room: {
      id: room.id,
      name: room.name,
      slug: room.slug,
      type: room.type,
      description: room.description ?? 'La room est prête côté backend. Player, queue et chat se branchent juste après.',
      ownerLabel: labelFromProfile(ownerProfile, `Owner ${room.owner_id.slice(0, 8)}`),
      ownerId: room.owner_id,
    },
    currentUser: {
      isLoggedIn: Boolean(user),
      role,
      email: user?.email,
    },
    members,
  } as const;

  return (
    <AppShell
      eyebrow="Room"
      title={`${room.name} · Midas DJ`}
      description="La room existe maintenant derrière une vraie route slug, avec contrôle d’accès et placeholders premium pour la suite."
    >
      <RoomPageView state={state} />
    </AppShell>
  );
}
