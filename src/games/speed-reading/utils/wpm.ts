export type Level = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export const WPM_BY_LEVEL: Record<Level, number> = {
  1: 200,
  2: 230,
  3: 260,
  4: 300,
  5: 330,
  6: 360,
  7: 390,
  8: 420,
  9: 450
};

export function levelToWpm(level: number): number {
  const clamped = Math.min(9, Math.max(1, Math.round(level))) as Level;
  return WPM_BY_LEVEL[clamped];
}
