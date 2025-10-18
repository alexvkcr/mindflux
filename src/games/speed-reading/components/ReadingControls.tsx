import type { ChangeEvent } from "react";

import type { BookKey } from "../../../components/ControlsBar";
import { WPM_BY_LEVEL, type Level } from "../utils/wpm";
import { WIDTH_MAP, type WidthIndex } from "../utils/widthMap";

import styles from "./ReadingControls.module.scss";

export interface ReadingControlsProps {
  book: BookKey;
  level: number;
  widthIdx: WidthIndex;
  onChange: (state: { book: BookKey; level: number; widthIdx: WidthIndex }) => void;
}

const BOOK_OPTIONS: Array<{ value: BookKey; label: string }> = [
  { value: "quijote", label: "Quijote" },
  { value: "regenta", label: "Regenta" },
  { value: "colmena", label: "Colmena" }
];

const LEVEL_OPTIONS: Array<{ level: Level; wpm: number }> = (
  Object.entries(WPM_BY_LEVEL) as Array<[string, number]>
).map(([lvl, wpm]) => ({ level: Number(lvl) as Level, wpm }));

const WIDTH_ENTRIES = (Object.entries(WIDTH_MAP) as Array<[string, number]>).map(([key, width]) => ({
  idx: Number(key) as WidthIndex,
  width
}));

export function ReadingControls({
  book,
  level,
  widthIdx,
  onChange
}: ReadingControlsProps) {
  const handleBookChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextBook = event.target.value as BookKey;
    onChange({ book: nextBook, level, widthIdx });
  };

  const handleLevelChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextLevel = Number(event.target.value);
    onChange({ book, level: nextLevel, widthIdx });
  };

  const handleWidthChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextWidth = Number(event.target.value) as WidthIndex;
    onChange({ book, level, widthIdx: nextWidth });
  };

  return (
    <div className={styles.controls} data-testid="reading-controls">
      <label className={styles.control}>
        <span className={styles.label}>Texto</span>
        <select
          className={styles.select}
          value={book}
          onChange={handleBookChange}
          data-testid="reading-controls-book"
        >
          {BOOK_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.control}>
        <span className={styles.label}>Velocidad</span>
        <select
          className={styles.select}
          value={level}
          onChange={handleLevelChange}
          data-testid="reading-controls-level"
        >
          {LEVEL_OPTIONS.map(({ level: lvl, wpm }) => (
            <option key={lvl} value={lvl}>
              {`Nivel ${lvl} - ${wpm} WPM`}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.control}>
        <span className={styles.label}>Ancho</span>
        <select
          className={styles.select}
          value={widthIdx}
          onChange={handleWidthChange}
          data-testid="reading-controls-width"
        >
          {WIDTH_ENTRIES.map(({ idx, width }) => (
            <option key={idx} value={idx}>
              {width} caracteres
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

