export const LEADERBOARD_TABS = ['best_listeners', 'best_djs', 'top_day', 'top_week'] as const;

export type LeaderboardTab = (typeof LEADERBOARD_TABS)[number];

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  username: string;
  avatarSkinId?: string;
  avatarAccessoryIds?: string[];
  level: number;
  score: number;
  medal?: 'gold' | 'silver' | 'bronze';
  isCurrentUser?: boolean;
};

export type LeaderboardPayload = {
  tab: LeaderboardTab;
  generatedAt: string;
  entries: LeaderboardEntry[];
  currentUserEntry?: LeaderboardEntry | null;
};

export function withLeaderboardMedals(entries: LeaderboardEntry[]) {
  return entries.map((entry) => ({
    ...entry,
    medal: entry.rank === 1 ? 'gold' : entry.rank === 2 ? 'silver' : entry.rank === 3 ? 'bronze' : undefined,
  }));
}
