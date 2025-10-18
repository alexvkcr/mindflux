import type { RefObject } from "react";

import styles from "./ColumnReading.module.scss";
import { ReadingViewportColumns } from "./components/ReadingViewportColumns";

interface Props {
  grid: string[];
  rows: number;
  charWidth: number;
  highlightIdx: number;
  gameAreaRef: RefObject<HTMLDivElement>;
}

export function ColumnReading({
  grid,
  rows,
  charWidth,
  highlightIdx,
  gameAreaRef
}: Props) {
  return (
    <main className={styles.gameArea} ref={gameAreaRef}>
      <ReadingViewportColumns
        grid={grid}
        rows={rows}
        charWidth={charWidth}
        highlightIdx={highlightIdx}
      />
    </main>
  );
}
