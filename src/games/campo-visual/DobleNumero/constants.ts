export const SPEED_LEVEL_OPTIONS = [
  0,
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  12,
  13,
  14,
  15,
  16,
  17,
  18
] as const;

export type SpeedLevel = (typeof SPEED_LEVEL_OPTIONS)[number];

export const SPEED_TABLE: Record<number, number> = {
  0: 1150,
  1: 1000,
  2: 800,
  3: 650,
  4: 520,
  5: 420,
  6: 340,
  7: 280,
  8: 240,
  9: 200,
  10: 175,
  11: 150,
  12: 125,
  13: 100,
  14: 90,
  15: 80,
  16: 70,
  17: 60,
  18: 50
} as const;

const MIN_SPEED_LEVEL = SPEED_LEVEL_OPTIONS[0];
const MAX_SPEED_LEVEL = SPEED_LEVEL_OPTIONS[SPEED_LEVEL_OPTIONS.length - 1];

export function clampSpeedLevel(level: number): number {
  if (Number.isNaN(level)) {
    return MIN_SPEED_LEVEL;
  }
  return Math.min(MAX_SPEED_LEVEL, Math.max(MIN_SPEED_LEVEL, Math.round(level)));
}

export const INTERVAL_LEVEL_OPTIONS = [
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  12,
  13,
  14,
  15,
  16,
  17,
  18
] as const;

export type IntervalLevel = (typeof INTERVAL_LEVEL_OPTIONS)[number];

export const INTERVAL_TABLE: Record<number, number> = {
  1: 1400,
  2: 1200,
  3: 1000,
  4: 900,
  5: 800,
  6: 650,
  7: 520,
  8: 420,
  9: 320,
  10: 300,
  11: 280,
  12: 260,
  13: 250,
  14: 240,
  15: 230,
  16: 220,
  17: 210,
  18: 200
} as const;

const MIN_INTERVAL_LEVEL = INTERVAL_LEVEL_OPTIONS[0];
const MAX_INTERVAL_LEVEL = INTERVAL_LEVEL_OPTIONS[INTERVAL_LEVEL_OPTIONS.length - 1];

export function clampIntervalLevel(level: number): number {
  if (Number.isNaN(level)) {
    return MIN_INTERVAL_LEVEL;
  }
  return Math.min(MAX_INTERVAL_LEVEL, Math.max(MIN_INTERVAL_LEVEL, Math.round(level)));
}
