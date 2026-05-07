export const XP_ACTION_VALUES = {
  woot: 5,
  djFullPlay: 20,
  receivedLike: 2,
  presenceFiveMinutes: 3,
  firstPlayOfDayBonus: 15,
  threePlaysNoSkipBonus: 25,
} as const;

export type XpActionKey = keyof typeof XP_ACTION_VALUES;

export type XpEvent = {
  userId: string;
  action: XpActionKey;
  amount: number;
  reason: string;
  createdAt: string;
  roomId?: string;
  queueItemId?: string;
};

export type UserXpSnapshot = {
  xp: number;
  level: number;
  xpToNext: number;
};

export function xpRequiredForLevel(level: number) {
  if (level <= 1) {
    return 0;
  }

  return Math.round(100 * level ** 1.5);
}

export function levelFromXp(xp: number) {
  let level = 1;
  while (xpRequiredForLevel(level + 1) <= xp) {
    level += 1;
  }
  return level;
}

export function createXpSnapshot(xp: number): UserXpSnapshot {
  const level = levelFromXp(xp);
  const nextLevelXp = xpRequiredForLevel(level + 1);
  return {
    xp,
    level,
    xpToNext: Math.max(0, nextLevelXp - xp),
  };
}

export function avatarUnlockTierFromLevel(level: number) {
  if (level >= 20) return 'legendary';
  if (level >= 10) return 'epic';
  if (level >= 5) return 'rare';
  return 'common';
}
