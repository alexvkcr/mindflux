const LEVEL_MIN = 1;
const LEVEL_MAX = 9;

// Preserve levels 1–7; interpolate 613→381 over 3 steps and 381→150 over 4.
const SPEED_INTERVALS_MS = [2000, 1769, 1538, 1306, 1075, 844, 613, 536, 458, 381, 323, 266, 208, 150];
export const SPEED_LEVELS = SPEED_INTERVALS_MS.map((_, index) => index + 1);

export const START_COUNTDOWN_SECONDS = 3;
export const BETWEEN_BLOCK_COUNTDOWN_SECONDS = 5;

export function clampLevel(value: number): number {
  return Math.min(LEVEL_MAX, Math.max(LEVEL_MIN, Math.round(value)));
}

export function levelToCount(level: number): number {
  const clamped = clampLevel(level);
  return 10 + (clamped - 1) * 5;
}

export function levelToIntervalMs(level: number): number {
  const clamped = Math.min(SPEED_INTERVALS_MS.length, Math.max(1, Math.round(level)));
  return SPEED_INTERVALS_MS[clamped - 1];
}

export const BLOCK_SIZE_OPTIONS = [5, 10, 15, 20, 25, 30, 40, 50];

