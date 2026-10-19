import type { CSSProperties } from "react";
import styles from "./ReadingViewportColumns.module.scss";

export interface ReadingViewportColumnsProps {
  grid: string[];
  rows: number;
  columns: number;
  columnGap: number;
  referenceWidthEm: number;
  highlightIdx: number;
  cueHeight: number;
  hasNextPage: boolean;
  reading: boolean;
}

export function ReadingViewportColumns({ grid, rows, columns, columnGap, referenceWidthEm, highlightIdx,
  cueHeight, hasNextPage, reading }: ReadingViewportColumnsProps) {
  const showReturnCue = reading && hasNextPage && Math.floor(highlightIdx / columns) === rows - 1;
  return (
    <div className={styles.columns} data-columns={columns} data-rows={rows} data-next-page={hasNextPage}
      style={{ "--columns": columns, "--column-gap": `${columnGap}px`, "--wrap-cue-height": `${cueHeight}px` } as CSSProperties}
      role="region" aria-label="Lectura en columnas">
      {Array.from({ length: rows }, (_, rowIdx) => (
        <div key={rowIdx} className={styles.row}>
          {Array.from({ length: columns }, (_, colIdx) => {
            const index = rowIdx * columns + colIdx;
            const active = index === highlightIdx;
            return (
              <p key={colIdx} data-testid={`cell-${rowIdx}-${colIdx}`} data-active={active}
                className={active ? styles.lineOn : styles.lineOff} aria-hidden={!active}>
                <span style={{ minWidth: `${referenceWidthEm}em` }}>{active ? grid[index] ?? "" : ""}</span>
              </p>
            );
          })}
        </div>
      ))}
      <div className={styles.returnCue} data-testid="reading-return-cue" data-visible={showReturnCue}
        aria-hidden="true" />
    </div>
  );
}
