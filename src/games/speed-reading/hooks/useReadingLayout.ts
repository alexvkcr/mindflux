import { useLayoutEffect, useRef, useState } from "react";
import { referenceWords } from "../utils/widthMap";

export const READING_FONT = "Arial, Helvetica, sans-serif";
const COLUMN_GAP_PX = 8;
const WRAP_CUE_HEIGHT_PX = 24;

export function useReadingLayout(lines: string[], charWidth: number, columnMode: boolean) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState({ fontSize: 20, columns: 1, rows: 1, referenceWidthEm: 0 });
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return;
    context.font = `400 20px ${READING_FONT}`;
    const reference = Array(referenceWords(charWidth)).fill("como").join(" ");
    const referenceWidth = context.measureText(reference).width;
    const referenceWidthEm = referenceWidth / 20;
    // Proportional fonts require measuring the complete strings, not counting zero glyphs.
    let widestBlock = referenceWidth;
    for (const line of new Set(lines)) widestBlock = Math.max(widestBlock, context.measureText(line).width);
    const measure = () => {
      const availableWidth = stage.clientWidth;
      if (availableWidth <= 0) return;
      // Two columns have padding only at the outside; their text meets at the central gap.
      const minimumColumnWidth = widestBlock * 12 / 20 + 12;
      const columns = columnMode && availableWidth >= minimumColumnWidth * 2 + COLUMN_GAP_PX ? 2 : 1;
      const horizontalPadding = columns === 2 ? 12 : 24;
      const contentWidth = (availableWidth - (columns - 1) * COLUMN_GAP_PX) / columns - horizontalPadding;
      const fontSize = Math.max(1, Math.floor(Math.min(20, contentWidth / widestBlock * 20) * 100) / 100);
      const rowHeight = fontSize * 1.7 + 16;
      const availableHeight = stage.clientHeight - WRAP_CUE_HEIGHT_PX - 8;
      const rows = columnMode ? Math.max(1, Math.min(10, Math.floor((availableHeight + 8) / (rowHeight + 8)))) : 1;
      setLayout(previous => previous.fontSize === fontSize && previous.columns === columns && previous.rows === rows && previous.referenceWidthEm === referenceWidthEm
        ? previous : { fontSize, columns, rows, referenceWidthEm });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    measure();
    return () => observer.disconnect();
  }, [lines, charWidth, columnMode]);
  return { stageRef, ...layout, columnGap: COLUMN_GAP_PX, cueHeight: WRAP_CUE_HEIGHT_PX };
}
