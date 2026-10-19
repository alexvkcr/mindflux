export const PACE_MS_BY_LEVEL = [900, 180000 / 230, 180000 / 260, 600, 180000 / 330, 500, 180000 / 390, 180000 / 420, 400] as const;

export function levelToIntervalMs(level: number): number {
  const safeLevel = Number.isFinite(level) ? Math.min(9, Math.max(1, Math.round(level))) : 1;
  return PACE_MS_BY_LEVEL[safeLevel - 1];
}

export function readingMetrics(intervalMs: number, referenceWordCount: number, lines: string[]) {
  const blocksPerMinute = 60000 / intervalMs;
  const words = lines.reduce((sum, line) => sum + (line.trim() ? line.trim().split(/\s+/u).length : 0), 0);
  return {
    blocksPerMinute,
    referenceWpm: blocksPerMinute * referenceWordCount,
    textWpm: lines.length ? blocksPerMinute * words / lines.length : 0,
  };
}
