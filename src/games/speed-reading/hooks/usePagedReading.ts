import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { normalizeReadingText } from "../utils/characterReading";
import { buildWordDocument, closestCombination, readingCapacity, readingCombinations } from "../utils/pagedReading";
import { WIDTH_MAP, type WidthIndex } from "../utils/widthMap";
import { READING_FONT } from "./useReadingLayout";

export const READER_FONT_SIZE = 20;
export const READER_LINE_HEIGHT = 36;

export function usePagedReading(text: string, widthIdx: WidthIndex, lineCycles: number, open: boolean) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [space, setSpace] = useState(() => ({ width: Math.max(0, window.innerWidth - 40), height: Math.max(0, window.innerHeight - 150) }));
  useLayoutEffect(() => {
    const measure = () => {
      const bounds = open ? bodyRef.current?.getBoundingClientRect() : undefined;
      const width = Math.max(0, bounds?.width || window.innerWidth - 40);
      const height = Math.max(0, bounds?.height || window.innerHeight - 150);
      setSpace(previous => previous.width === width && previous.height === height ? previous : { width, height });
    };
    const observer = new ResizeObserver(measure);
    if (bodyRef.current) observer.observe(bodyRef.current);
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    measure();
    return () => {
      observer.disconnect(); window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
    };
  }, [open]);
  const prepared = useMemo(() => {
    const normalized = normalizeReadingText(text);
    const context = document.createElement("canvas").getContext("2d")!;
    context.font = `400 ${READER_FONT_SIZE}px ${READING_FONT}`;
    context.fontKerning = "none";
    const widths = new Float32Array(normalized.length);
    const cache = new Map<string, number>();
    let index = 0, wordLength = 0, longestWord = 0;
    for (const character of normalized) {
      let width = cache.get(character);
      if (width === undefined) { width = context.measureText(character).width; cache.set(character, width); }
      widths[index++] = width;
      if (character === " ") { longestWord = Math.max(longestWord, wordLength + 1); wordLength = 0; }
      else wordLength++;
    }
    longestWord = Math.max(longestWord, wordLength);
    return { widths: widths.subarray(0, index), longestWord };
  }, [text]);
  const capacity = useMemo(() => readingCapacity(prepared.widths, Math.max(0, space.width - 8)), [prepared, space.width]);
  const combinations = useMemo(() => readingCombinations(capacity, prepared.longestWord), [capacity, prepared]);
  const selected = closestCombination(combinations, widthIdx, lineCycles);
  const effectiveWidth = selected?.widthIdx ?? widthIdx;
  const effectiveCycles = selected?.lineCycles ?? lineCycles;
  const wordDocument = useMemo(() => buildWordDocument(text, WIDTH_MAP[effectiveWidth], effectiveCycles), [text, effectiveWidth, effectiveCycles]);
  return { bodyRef, ...wordDocument, capacity, combinations, selected, space,
    rows: Math.max(1, Math.floor(space.height / READER_LINE_HEIGHT)), ready: !!selected && space.height >= READER_LINE_HEIGHT };
}
