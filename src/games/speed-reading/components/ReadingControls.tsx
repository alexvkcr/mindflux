import type { ChangeEvent } from "react";

import type { BookKey, ControlsState } from "../../../components/ControlsBar";
import { PACE_MS_BY_LEVEL } from "../utils/pace";
import { WIDTH_MAP, referenceWords, type WidthIndex } from "../utils/widthMap";
import type { ReadingCombination } from "../utils/pagedReading";

import styles from "./ReadingControls.module.scss";

export interface ReadingControlsProps {
  book: BookKey;
  level: number;
  widthIdx: WidthIndex;
  disabled?: boolean;
  lineCycles?: number;
  customTextName?: string;
  combinations?: ReadingCombination[];
  onChange: (state: Partial<ControlsState>) => void;
}

const BOOK_OPTIONS: Array<{ value: BookKey; label: string }> = [
  { value: "quijote", label: "Quijote" },
  { value: "regenta", label: "Regenta" },
  { value: "colmena", label: "Colmena" }
];

const LEVEL_OPTIONS = PACE_MS_BY_LEVEL.map((_, index) => index + 1);

const WIDTH_ENTRIES = (Object.entries(WIDTH_MAP) as Array<[string, number]>).map(([key, width]) => ({
  idx: Number(key) as WidthIndex,
  width
}));

export function ReadingControls({
  book,
  level,
  widthIdx,
  disabled = false,
  lineCycles,
  customTextName,
  combinations,
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
    const nextCycles = combinations?.find(option => option.widthIdx === nextWidth && option.lineCycles === lineCycles)?.lineCycles
      ?? combinations?.find(option => option.widthIdx === nextWidth)?.lineCycles;
    onChange({ book, level, widthIdx: nextWidth, ...(nextCycles ? { readingLineCycles: nextCycles } : {}) });
  };

  return (
    <div className={styles.controls} data-testid="reading-controls">
      <label className={styles.control}>
        <span id="reading-book-label" className={styles.label}>Texto</span>
        <select
          aria-labelledby="reading-book-label"
          disabled={disabled}
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
          {customTextName && <option value="custom">TXT: {customTextName}</option>}
        </select>
      </label>

      <label className={styles.control}>
        <span id="reading-pace-label" className={styles.label}>Ritmo</span>
        <select
          aria-labelledby="reading-pace-label"
          disabled={disabled}
          className={styles.select}
          value={level}
          onChange={handleLevelChange}
          data-testid="reading-controls-level"
        >
          {LEVEL_OPTIONS.map((lvl) => (
            <option key={lvl} value={lvl}>
              {`Nivel ${lvl}`}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.control}>
        <span id="reading-width-label" className={styles.label}>Ancho de referencia</span>
        <select
          aria-labelledby="reading-width-label"
          disabled={disabled}
          className={styles.select}
          value={widthIdx}
          onChange={handleWidthChange}
          data-testid="reading-controls-width"
        >
          {WIDTH_ENTRIES.map(({ idx, width }) => (
            <option key={idx} value={idx} disabled={combinations && !combinations.some(option => option.widthIdx === idx)}>
              {referenceWords(width)} palabras · {width} caracteres
            </option>
          ))}
        </select>
      </label>
      {lineCycles !== undefined && (
        <label className={styles.control}>
          <span id="reading-line-cycles-label" className={styles.label}>Ciclos por línea</span>
          <select aria-labelledby="reading-line-cycles-label" className={styles.select} disabled={disabled}
            data-testid="reading-controls-line-cycles" value={lineCycles}
            onChange={(event) => onChange({ book, level, widthIdx, readingLineCycles: Number(event.target.value) })}>
            {[1, 2, 3].map(count => <option key={count} value={count}
              disabled={combinations && !combinations.some(option => option.widthIdx === widthIdx && option.lineCycles === count)}>
              {count} ({count * WIDTH_MAP[widthIdx]} caracteres)</option>)}
          </select>
        </label>
      )}
    </div>
  );
}

