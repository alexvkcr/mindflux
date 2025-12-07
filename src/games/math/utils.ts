const LEVEL_MIN = 1;
const LEVEL_MAX = 9;

export function clampLevel(value: number): number {
  return Math.min(LEVEL_MAX, Math.max(LEVEL_MIN, Math.round(value)));
}

export function levelToCount(level: number): number {
  const clamped = clampLevel(level);
  return 10 + (clamped - 1) * 5;
}

export function levelToIntervalMs(level: number): number {
  const clamped = clampLevel(level);
  const MAX_MS = 2000;
  const MIN_MS = 150;
  const step = (MAX_MS - MIN_MS) / (LEVEL_MAX - 1);
  return Math.round(MAX_MS - (clamped - 1) * step);
}

export const BLOCK_SIZE_OPTIONS = [5, 10, 15, 20, 25, 30, 40, 50];

