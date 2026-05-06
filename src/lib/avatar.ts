export const AVATAR_SPECIES = ['bunny', 'panda', 'bear', 'dragon', 'cat'] as const;
export const AVATAR_ACCESSORIES = ['crown', 'glasses', 'hat', 'headphones'] as const;
export const AVATAR_BADGES = ['none', 'vip', 'mod', 'crown'] as const;
export const AVATAR_OUTFIT_COLORS = ['pink', 'gold', 'purple', 'cyan', 'emerald'] as const;

export type AvatarSpecies = (typeof AVATAR_SPECIES)[number];
export type AvatarAccessory = (typeof AVATAR_ACCESSORIES)[number];
export type AvatarBadge = (typeof AVATAR_BADGES)[number];
export type AvatarOutfitColor = (typeof AVATAR_OUTFIT_COLORS)[number];

export type AvatarConfig = {
  species: AvatarSpecies;
  accessories: AvatarAccessory[];
  outfitColor: AvatarOutfitColor;
  badge: AvatarBadge;
};

export const DEFAULT_AVATAR: AvatarConfig = {
  species: 'bunny',
  accessories: ['headphones'],
  outfitColor: 'purple',
  badge: 'none',
};

export const avatarOptionLabels = {
  species: {
    bunny: 'Bunny',
    panda: 'Panda',
    bear: 'Bear',
    dragon: 'Dragon',
    cat: 'Cat',
  },
  accessories: {
    crown: 'Crown',
    glasses: 'Glasses',
    hat: 'Hat',
    headphones: 'Headphones',
  },
  badges: {
    none: 'None',
    vip: 'VIP',
    mod: 'MOD',
    crown: 'Crown',
  },
  outfitColors: {
    pink: 'Neon pink',
    gold: 'Gold',
    purple: 'Purple',
    cyan: 'Cyan',
    emerald: 'Emerald',
  },
} as const;

export const avatarColorThemes: Record<AvatarOutfitColor, { body: string; glow: string; accent: string; chip: string }> = {
  pink: {
    body: 'from-fuchsia-400 to-rose-300',
    glow: 'shadow-[0_0_22px_rgba(244,114,182,0.42)]',
    accent: 'bg-fuchsia-200',
    chip: 'border-fuchsia-300/35 bg-fuchsia-400/15 text-fuchsia-50',
  },
  gold: {
    body: 'from-amber-300 to-yellow-200',
    glow: 'shadow-[0_0_22px_rgba(251,191,36,0.42)]',
    accent: 'bg-yellow-50',
    chip: 'border-amber-300/35 bg-amber-300/15 text-amber-50',
  },
  purple: {
    body: 'from-violet-400 to-fuchsia-300',
    glow: 'shadow-[0_0_22px_rgba(168,85,247,0.42)]',
    accent: 'bg-fuchsia-100',
    chip: 'border-violet-300/35 bg-violet-400/15 text-violet-50',
  },
  cyan: {
    body: 'from-cyan-300 to-sky-300',
    glow: 'shadow-[0_0_22px_rgba(34,211,238,0.42)]',
    accent: 'bg-cyan-50',
    chip: 'border-cyan-300/35 bg-cyan-300/15 text-cyan-50',
  },
  emerald: {
    body: 'from-emerald-300 to-teal-300',
    glow: 'shadow-[0_0_22px_rgba(52,211,153,0.42)]',
    accent: 'bg-emerald-50',
    chip: 'border-emerald-300/35 bg-emerald-300/15 text-emerald-50',
  },
};

export function normalizeAvatar(input?: Partial<AvatarConfig> | null): AvatarConfig {
  const species = AVATAR_SPECIES.includes(input?.species as AvatarSpecies) ? (input?.species as AvatarSpecies) : DEFAULT_AVATAR.species;
  const outfitColor = AVATAR_OUTFIT_COLORS.includes(input?.outfitColor as AvatarOutfitColor)
    ? (input?.outfitColor as AvatarOutfitColor)
    : DEFAULT_AVATAR.outfitColor;
  const badge = AVATAR_BADGES.includes(input?.badge as AvatarBadge) ? (input?.badge as AvatarBadge) : DEFAULT_AVATAR.badge;
  const accessories = Array.isArray(input?.accessories)
    ? input.accessories.filter((item): item is AvatarAccessory => AVATAR_ACCESSORIES.includes(item as AvatarAccessory)).slice(0, 4)
    : DEFAULT_AVATAR.accessories;

  return {
    species,
    outfitColor,
    badge,
    accessories: accessories.length > 0 ? accessories : [],
  };
}

export function createAvatarStorageKey(userId?: string) {
  return `midas-dj:avatar:${userId ?? 'guest'}`;
}

export function loadStoredAvatar(userId?: string) {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(createAvatarStorageKey(userId));
    if (!raw) {
      return null;
    }
    return normalizeAvatar(JSON.parse(raw) as Partial<AvatarConfig>);
  } catch {
    return null;
  }
}

export function saveStoredAvatar(avatar: AvatarConfig, userId?: string) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(createAvatarStorageKey(userId), JSON.stringify(normalizeAvatar(avatar)));
}
