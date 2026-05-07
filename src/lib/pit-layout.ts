export type PitLane = 'front' | 'mid-front' | 'mid-back' | 'back' | 'dj';

export type PitSlot = {
  id: string;
  x: number;
  y: number;
  zIndex: number;
  scale: number;
  lane: PitLane;
};

function buildRow(rowPrefix: string, lane: PitLane, count: number, y: number, scale: number, zIndex: number, startX: number, endX: number) {
  const gap = count === 1 ? 0 : (endX - startX) / (count - 1);

  return Array.from({ length: count }, (_, index) => ({
    id: `${rowPrefix}-${index + 1}`,
    x: Number((startX + gap * index).toFixed(2)),
    y,
    zIndex,
    scale,
    lane,
  })) satisfies PitSlot[];
}

export const defaultPitSlots: PitSlot[] = [
  ...buildRow('front', 'front', 8, 8, 1.06, 40, 8, 92),
  ...buildRow('row-2', 'mid-front', 10, 27, 0.98, 30, 5, 95),
  ...buildRow('row-3', 'mid-back', 12, 47, 0.9, 20, 3, 97),
  ...buildRow('row-4', 'back', 14, 67, 0.82, 10, 2, 98),
];

export const djBoothSlots: PitSlot[] = [
  { id: 'dj-left', x: 44, y: 0, zIndex: 60, scale: 1.12, lane: 'dj' },
  { id: 'dj-right', x: 56, y: 0, zIndex: 60, scale: 1.12, lane: 'dj' },
];

export function assignPitSlots<T extends { id: string }>(members: T[]) {
  return members.slice(0, defaultPitSlots.length).map((member, index) => ({
    member,
    slot: defaultPitSlots[index],
  }));
}
