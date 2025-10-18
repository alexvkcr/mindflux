import type { CSSProperties } from "react";
import styles from "./ReadingViewportColumns.module.scss";

export interface ReadingViewportColumnsProps {
  grid: string[];
  rows: number;
  charWidth: number;
  highlightIdx: number;
}

export function ReadingViewportColumns({
  grid,
  rows,
  charWidth,
  highlightIdx
}: ReadingViewportColumnsProps) {
  const totalCells = Math.max(0, rows * 2);
  const cells = totalCells > 0
    ? Array.from({ length: totalCells }, (_, idx) => grid[idx] ?? "")
    : [];
  const safeHighlight = totalCells === 0 ? -1 : Math.min(highlightIdx, totalCells - 1);

  const columnsStyle = { "--ch": `${charWidth}ch` } as CSSProperties;

  return (
    <div
      className={styles.columns}
      style={columnsStyle}
      role="grid"
      aria-live="polite"
    >
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} className={styles.row} role="row">
          {[0, 1].map((colIdx) => {
            const cellIndex = rowIdx * 2 + colIdx;
            const isActive = cellIndex === safeHighlight;
            const rawText = cells[cellIndex] ?? "";
            const displayText = isActive ? rawText : "";

            return (
              <p
                key={colIdx}
                role="gridcell"
                data-testid={`cell-${rowIdx}-${colIdx}`}
                className={isActive ? styles.lineOn : styles.lineOff}
                aria-hidden={!isActive}
              >
                {displayText}
              </p>
            );
          })}
        </div>
      ))}
    </div>
  );
}
