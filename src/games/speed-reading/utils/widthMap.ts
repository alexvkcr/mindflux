export type WidthIndex = 1 | 2 | 3 | 4 | 5;

export const WIDTH_MAP: Record<WidthIndex, number> = {
  1: 14,
  2: 19,
  3: 24,
  4: 29,
  5: 34
};

// N copies of "como", separated by N - 1 spaces.
export function referenceWords(charWidth: number): number {
  return (charWidth + 1) / 5;
}
