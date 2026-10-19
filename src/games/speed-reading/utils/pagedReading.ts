import { normalizeReadingText, type CharacterLine } from "./characterReading.ts";
import { WIDTH_MAP, type WidthIndex } from "./widthMap.ts";

export interface WordCycle extends CharacterLine { line: number }
export interface ReaderLine extends CharacterLine { cycleStart: number; cycleEnd: number }
export interface ReadingCombination { widthIdx: WidthIndex; lineCycles: number }

export function buildWordDocument(source: string, width: number, lineCycles: number) {
  const text = normalizeReadingText(source);
  const cycles: WordCycle[] = [];
  let start = 0, current = "", count = 0;
  const flush = () => {
    if (!current) return;
    cycles.push({ start, end: start + count, text: current, line: 0 });
    start += count; current = ""; count = 0;
  };
  for (const match of text.matchAll(/\S+ ?/gu)) {
    const word = match[0], length = Array.from(word).length;
    if (current && count + length > width) flush();
    current += word; count += length;
  }
  flush();
  const lines: ReaderLine[] = [];
  let cycleStart = 0, lineText = "", lineStart = 0, lineEnd = 0;
  const flushLine = (cycleEnd: number) => {
    if (!lineText) return;
    lines.push({ start: lineStart, end: lineEnd, text: lineText, cycleStart, cycleEnd });
    cycleStart = cycleEnd; lineText = "";
  };
  for (const [index, cycle] of cycles.entries()) {
    if (lineText && (index - cycleStart >= lineCycles || cycle.end - lineStart > width * lineCycles)) flushLine(index);
    if (!lineText) lineStart = cycle.start;
    cycle.line = lines.length;
    lineText += cycle.text; lineEnd = cycle.end;
  }
  flushLine(cycles.length);
  return { lines, cycles };
}

// Find the largest character budget for which every substring of this text fits.
// Glyph widths are prepared once; resizing only needs a few linear scans of numeric data.
export function readingCapacity(widths: Float32Array, available: number, maximum = 102): number {
  const fits = (count: number) => {
    let width = 0;
    for (let index = 0; index < widths.length; index++) {
      width += widths[index];
      if (index >= count) width -= widths[index - count];
      if (width > available) return false;
    }
    return true;
  };
  let low = 0, high = maximum;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (fits(middle)) low = middle;
    else high = middle - 1;
  }
  return low;
}

export function readingCombinations(capacity: number, longestWord: number): ReadingCombination[] {
  return (Object.keys(WIDTH_MAP) as `${WidthIndex}`[]).flatMap(key => {
    const widthIdx = Number(key) as WidthIndex;
    return [1, 2, 3].filter(lineCycles => {
      const budget = WIDTH_MAP[widthIdx] * lineCycles;
      return budget <= capacity && budget >= longestWord;
    }).map(lineCycles => ({ widthIdx, lineCycles }));
  });
}

export function closestCombination(options: ReadingCombination[], widthIdx: WidthIndex, lineCycles: number) {
  return options.reduce<ReadingCombination | undefined>((best, option) => {
    const score = (value: ReadingCombination) => Math.abs(value.widthIdx - widthIdx) * 4 + Math.abs(value.lineCycles - lineCycles);
    return !best || score(option) < score(best) ? option : best;
  }, undefined);
}
