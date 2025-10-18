const MIN_DELAY_MS = 60;

export function getMsPerLine(wordsInLine: number, wpm: number): number {
  const safeWords = Math.max(1, Math.round(wordsInLine));
  const safeWpm = Math.max(60, Math.round(wpm));
  const minutes = safeWords / safeWpm;
  return Math.max(MIN_DELAY_MS, Math.round(minutes * 60000));
}
