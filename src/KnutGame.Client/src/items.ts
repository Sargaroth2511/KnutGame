export const ItemType = {
  POINTS: 'POINTS',
  LIFE: 'LIFE',
  SLOWMO: 'SLOWMO',
  MULTI: 'MULTI',
  ANGEL: 'ANGEL'
} as const;

export type ItemType = typeof ItemType[keyof typeof ItemType];

export type ItemConfig = {
  spawnIntervalMs: number;
  dropChance: number; // 0..1 per interval
}

export const defaultItemConfig: ItemConfig = {
  spawnIntervalMs: 2500,
  dropChance: 0.35,
};
