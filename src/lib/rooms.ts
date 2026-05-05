export type RoomType = 'public' | 'private';
export type RoomRole = 'owner' | 'mod' | 'member' | 'visitor';

export type FeaturedRoom = {
  name: string;
  slug: string;
  type: RoomType;
  listeners: number;
  queueDepth: number;
  dj: string;
  vibe: string;
  description: string;
  tags: string[];
};

export type LiveRoom = {
  id: string;
  name: string;
  slug: string;
  type: RoomType;
  description: string | null;
  owner_id: string;
};

export type RoomMemberPreview = {
  id: string;
  label: string;
  role: RoomRole;
  online?: boolean;
};

export type QueueItemStatus = 'queued' | 'playing' | 'played' | 'skipped';

export type QueueItemPreview = {
  id: string;
  youtubeVideoId: string;
  title: string;
  thumbnailUrl?: string | null;
  durationSeconds?: number;
  position: number;
  status: QueueItemStatus;
  addedByLabel: string;
};

export type PlaybackMode = 'playing' | 'paused' | 'ended';

export type PlaybackPreview = {
  currentQueueItemId?: string | null;
  djUserId?: string | null;
  state: PlaybackMode;
  startedAt?: string | null;
  offsetSeconds: number;
  updatedAt?: string | null;
};

export type ChatMessagePreview = {
  id: string;
  content: string;
  authorLabel: string;
  userId?: string;
  createdAt: string;
};

export type RoomPageState = {
  status: 'live' | 'preview' | 'missing' | 'forbidden';
  envReady: boolean;
  room: {
    id?: string;
    name: string;
    slug: string;
    type: RoomType;
    description: string;
    ownerLabel: string;
    ownerId?: string;
    listenerCount?: number;
    queueDepth?: number;
    dj?: string;
    vibe?: string;
    tags?: string[];
  };
  currentUser: {
    id?: string;
    isLoggedIn: boolean;
    role: RoomRole;
    email?: string | null;
  };
  members: RoomMemberPreview[];
  queue?: {
    items: QueueItemPreview[];
  };
  playback?: PlaybackPreview;
  chat?: {
    messages: ChatMessagePreview[];
  };
  presence?: {
    enabled: boolean;
    connected: boolean;
    onlineCount: number;
  };
};

export const featuredRooms: FeaturedRoom[] = [
  {
    name: 'Golden Hour',
    slug: 'golden-hour',
    type: 'public',
    listeners: 142,
    queueDepth: 18,
    dj: 'Ari Vega',
    vibe: 'Nu-disco, edits solaires, transitions velvet',
    description: 'La room signature pour les débuts de soirée qui montent proprement en intensité.',
    tags: ['Warmup', 'Disco', 'Community pick'],
  },
  {
    name: 'Night Shift FM',
    slug: 'night-shift-fm',
    type: 'public',
    listeners: 86,
    queueDepth: 11,
    dj: 'Kito Nova',
    vibe: 'UK garage, bassline et club cuts calibrés',
    description: 'Un flux plus nerveux pour les crews qui veulent skip le small talk et entrer direct dans le groove.',
    tags: ['UKG', 'Bass', 'Late set'],
  },
  {
    name: 'Velvet Booth',
    slug: 'velvet-booth',
    type: 'private',
    listeners: 12,
    queueDepth: 6,
    dj: 'Mina Lux',
    vibe: 'R&B futuriste et sélections after-hours',
    description: 'Room privée sur invitation, parfaite pour un cercle restreint et une modération stricte.',
    tags: ['Private', 'Invite-only', 'After hours'],
  },
];

export function slugifyRoom(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 36);
}

export function getFeaturedRoomBySlug(slug: string) {
  return featuredRooms.find((room) => room.slug === slug) ?? null;
}

export function getPreviewRoomState(slug: string): RoomPageState {
  const featured = getFeaturedRoomBySlug(slug);

  if (!featured) {
    return {
      status: 'missing',
      envReady: false,
      room: {
        name: 'Room introuvable',
        slug,
        type: 'public',
        description: 'Aucune room de démonstration ne correspond à ce slug. Reviens au lobby pour en choisir une autre.',
        ownerLabel: '—',
      },
      currentUser: {
        isLoggedIn: false,
        role: 'visitor',
      },
      members: [],
    };
  }

  return {
    status: 'preview',
    envReady: false,
    room: {
      name: featured.name,
      slug: featured.slug,
      type: featured.type,
      description: featured.description,
      ownerLabel: featured.dj,
      listenerCount: featured.listeners,
      queueDepth: featured.queueDepth,
      dj: featured.dj,
      vibe: featured.vibe,
      tags: featured.tags,
    },
    currentUser: {
      isLoggedIn: false,
      role: featured.type === 'private' ? 'visitor' : 'member',
    },
    members: featured.type === 'private'
      ? [
          { id: 'host', label: featured.dj, role: 'owner' },
          { id: 'guest-1', label: 'Crew invité', role: 'member' },
        ]
      : [
          { id: 'host', label: featured.dj, role: 'owner' },
          { id: 'guest-1', label: 'Nora Pulse', role: 'member' },
          { id: 'guest-2', label: 'Sami Fade', role: 'member' },
        ],
    queue: {
      items: [
        {
          id: `${featured.slug}-1`,
          youtubeVideoId: 'dQw4w9WgXcQ',
          title: `${featured.name} opener`,
          thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
          durationSeconds: 212,
          position: 1,
          status: 'playing',
          addedByLabel: featured.dj,
        },
        {
          id: `${featured.slug}-2`,
          youtubeVideoId: '3JZ4pnNtyxQ',
          title: `${featured.vibe.split(',')[0]} selection`,
          thumbnailUrl: 'https://i.ytimg.com/vi/3JZ4pnNtyxQ/hqdefault.jpg',
          durationSeconds: 245,
          position: 2,
          status: 'queued',
          addedByLabel: featured.type === 'private' ? 'Crew invité' : 'Nora Pulse',
        },
      ],
    },
    playback: {
      currentQueueItemId: `${featured.slug}-1`,
      djUserId: 'host',
      state: 'playing',
      startedAt: new Date(Date.now() - 42_000).toISOString(),
      offsetSeconds: 0,
      updatedAt: new Date().toISOString(),
    },
  };
}
