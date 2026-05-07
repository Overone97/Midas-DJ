export const AVATAR_SKIN_CATEGORIES = ['animal', 'game_character', 'stylized_human'] as const;
export const AVATAR_RARITIES = ['common', 'rare', 'epic', 'legendary'] as const;
export const AVATAR_UNLOCK_CURRENCIES = ['soft_coins', 'premium_gems', 'xp_only'] as const;
export const AVATAR_ANIMATION_STATES = ['idle', 'dancing', 'sitting', 'onLike', 'onWoot', 'onGrab', 'onDJing', 'onLevelUp'] as const;
export const AVATAR_ACCESSORY_ANCHORS = ['head', 'face', 'back', 'left_hand', 'right_hand', 'body'] as const;

export type AvatarSkinCategory = (typeof AVATAR_SKIN_CATEGORIES)[number];
export type AvatarRarity = (typeof AVATAR_RARITIES)[number];
export type AvatarUnlockCurrency = (typeof AVATAR_UNLOCK_CURRENCIES)[number];
export type AvatarAnimationState = (typeof AVATAR_ANIMATION_STATES)[number];
export type AvatarAccessoryAnchor = (typeof AVATAR_ACCESSORY_ANCHORS)[number];

export type AvatarAnimationClip = {
  frames: number[];
  fps: number;
  loop: boolean;
};

export type AvatarAssetBundle = {
  thumbnailUrl?: string;
  spriteSheetUrl?: string;
  frameAtlasUrl?: string;
  frameWidth?: number;
  frameHeight?: number;
  animations: Partial<Record<AvatarAnimationState, AvatarAnimationClip>>;
};

export type AvatarSkinUnlockCondition = {
  xpRequired?: number;
  softCurrencyCost?: number;
  premiumCurrencyCost?: number;
  eventId?: string;
};

export type AvatarSkinDefinition = {
  id: string;
  name: string;
  category: AvatarSkinCategory;
  rarity: AvatarRarity;
  speciesOrArchetype: string;
  description?: string;
  unlockCondition: AvatarSkinUnlockCondition;
  supportedAccessories: string[];
  assetBundle: AvatarAssetBundle;
  tags: string[];
};

export type AvatarAccessoryDefinition = {
  id: string;
  name: string;
  anchor: AvatarAccessoryAnchor;
  rarity: AvatarRarity;
  compatibleSkinTags?: string[];
  animationOverrides?: AvatarAnimationState[];
  assetUrl?: string;
};

export type AvatarLoadout = {
  selectedSkinId: string;
  equippedAccessoryIds: string[];
  preferredPitPose?: 'standing' | 'sitting';
  selectedEmotePackId?: string;
};

export type AvatarProgression = {
  xp: number;
  level: number;
  unlockedSkinIds: string[];
  unlockedAccessoryIds: string[];
  softCoins: number;
  premiumGems: number;
};

export const avatarAccessoryCatalog: AvatarAccessoryDefinition[] = [
  { id: 'hat-dj', name: 'DJ Hat', anchor: 'head', rarity: 'common', compatibleSkinTags: ['human', 'dj', 'streetwear'] },
  { id: 'crown-gold', name: 'Gold Crown', anchor: 'head', rarity: 'epic', compatibleSkinTags: ['royal', 'animal', 'human'] },
  { id: 'glasses-neon', name: 'Neon Glasses', anchor: 'face', rarity: 'rare', compatibleSkinTags: ['cyberpunk', 'streetwear', 'sci-fi'] },
  { id: 'mic-handheld', name: 'Handheld Mic', anchor: 'right_hand', rarity: 'common', animationOverrides: ['onDJing', 'onWoot'] },
  { id: 'guitar-neon', name: 'Neon Guitar', anchor: 'left_hand', rarity: 'rare', animationOverrides: ['dancing', 'onWoot'] },
  { id: 'synth-mini', name: 'Mini Synth', anchor: 'body', rarity: 'rare', animationOverrides: ['dancing', 'onDJing'] },
  { id: 'headphones-pro', name: 'Pro Headphones', anchor: 'head', rarity: 'common', compatibleSkinTags: ['dj', 'streetwear', 'animal'] },
  { id: 'royal-cape', name: 'Royal Cape', anchor: 'back', rarity: 'epic', compatibleSkinTags: ['royal', 'fantasy'] },
];

export const avatarSkinCatalog: AvatarSkinDefinition[] = [
  {
    id: 'animal-fox-neon',
    name: 'Neon Fox',
    category: 'animal',
    rarity: 'common',
    speciesOrArchetype: 'fox',
    description: 'Renard vif avec silhouette agile et queue animée.',
    unlockCondition: { xpRequired: 0 },
    supportedAccessories: ['glasses-neon', 'headphones-pro', 'crown-gold'],
    assetBundle: { animations: {} },
    tags: ['animal', 'fox', 'tail', 'neon'],
  },
  {
    id: 'animal-dragon-club',
    name: 'Club Dragon',
    category: 'animal',
    rarity: 'epic',
    speciesOrArchetype: 'dragon',
    description: 'Dragon de club avec ailes, glow et célébrations plus démonstratives.',
    unlockCondition: { xpRequired: 12, softCurrencyCost: 2400 },
    supportedAccessories: ['crown-gold', 'mic-handheld'],
    assetBundle: { animations: {} },
    tags: ['animal', 'dragon', 'wings', 'fire'],
  },
  {
    id: 'game-pixel-adventurer',
    name: 'Pixel Adventurer',
    category: 'game_character',
    rarity: 'rare',
    speciesOrArchetype: 'pixel-adventurer',
    description: 'Petit héros rétro avec animations saccadées façon RPG pixel.',
    unlockCondition: { xpRequired: 6, softCurrencyCost: 900 },
    supportedAccessories: ['royal-cape', 'guitar-neon'],
    assetBundle: { animations: {} },
    tags: ['game', 'pixel', 'fantasy'],
  },
  {
    id: 'human-dj-booth',
    name: 'Booth Operator',
    category: 'stylized_human',
    rarity: 'common',
    speciesOrArchetype: 'dj-booth',
    description: 'Humain stylisé orienté performance booth et scène live.',
    unlockCondition: { xpRequired: 0 },
    supportedAccessories: ['hat-dj', 'headphones-pro', 'mic-handheld', 'synth-mini'],
    assetBundle: { animations: {} },
    tags: ['human', 'dj', 'streetwear'],
  },
  {
    id: 'human-cyberpunk-vj',
    name: 'Cyber VJ',
    category: 'stylized_human',
    rarity: 'rare',
    speciesOrArchetype: 'cyberpunk',
    description: 'Silhouette cyberpunk plus nerveuse, orientée néons et motion rapide.',
    unlockCondition: { xpRequired: 10, premiumCurrencyCost: 120 },
    supportedAccessories: ['glasses-neon', 'headphones-pro', 'mic-handheld'],
    assetBundle: { animations: {} },
    tags: ['human', 'cyberpunk', 'sci-fi'],
  },
];

export const defaultAvatarLoadout: AvatarLoadout = {
  selectedSkinId: 'animal-fox-neon',
  equippedAccessoryIds: ['headphones-pro'],
  preferredPitPose: 'standing',
};

export function getAvatarSkinById(id?: string | null) {
  return avatarSkinCatalog.find((skin) => skin.id === id) ?? avatarSkinCatalog[0];
}

export function getAvatarAccessoryById(id: string) {
  return avatarAccessoryCatalog.find((accessory) => accessory.id === id) ?? null;
}

export function normalizeAvatarLoadout(input?: Partial<AvatarLoadout> | null): AvatarLoadout {
  const selectedSkin = getAvatarSkinById(input?.selectedSkinId);
  const equippedAccessoryIds = Array.isArray(input?.equippedAccessoryIds)
    ? input.equippedAccessoryIds.filter((id) => selectedSkin.supportedAccessories.includes(id)).slice(0, 4)
    : defaultAvatarLoadout.equippedAccessoryIds;

  return {
    selectedSkinId: selectedSkin.id,
    equippedAccessoryIds,
    preferredPitPose: input?.preferredPitPose === 'sitting' ? 'sitting' : 'standing',
    selectedEmotePackId: input?.selectedEmotePackId,
  };
}

export function createDefaultAvatarProgression(): AvatarProgression {
  return {
    xp: 0,
    level: 1,
    unlockedSkinIds: [defaultAvatarLoadout.selectedSkinId],
    unlockedAccessoryIds: [...defaultAvatarLoadout.equippedAccessoryIds],
    softCoins: 0,
    premiumGems: 0,
  };
}
