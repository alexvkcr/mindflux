import type { ChangeEvent } from 'react';

import type { BookKey } from '../../../components/ControlsBar.tsx';
import { WIDTH_MAP } from '../utils/widthMap';
import type { WidthIndex } from '../utils/widthMap';

import styles from './ReadingControls.module.scss';

export interface ReadingControlsProps {
  initialBook: BookKey;
  initialLevel: number;
  initialWidthIdx: WidthIndex;
  onChange: (state: { book: BookKey; level: number; widthIdx: WidthIndex }) => void;
}

const BOOK_OPTIONS: Array<{ value: BookKey; label: string }> = [
  { value: 'quijote', label: 'Quijote' },
  { value: 'regenta', label: 'Regenta' },
  { value: 'colmena', label: 'Colmena' }
];

const LEVEL_OPTIONS = Array.from({ length: 9 }, (_, idx) => idx + 1);

const WIDTH_ENTRIES = (Object.entries(WIDTH_MAP) as Array<[string, number]>).map(([key, width]) => ({
  idx: Number(key) as WidthIndex,
  width
}));

export function ReadingControls({
  initialBook,
  initialLevel,
  initialWidthIdx,
  onChange
}: ReadingControlsProps) {
  const handleBookChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextBook = event.target.value as BookKey;
    onChange({ book: nextBook, level: initialLevel, widthIdx: initialWidthIdx });
  };

  const handleLevelChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextLevel = Number(event.target.value);
    onChange({ book: initialBook, level: nextLevel, widthIdx: initialWidthIdx });
  };

  const handleWidthChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextWidth = Number(event.target.value) as WidthIndex;
    onChange({ book: initialBook, level: initialLevel, widthIdx: nextWidth });
  };

  return (
    <div className={styles.controls} data-testid="reading-controls">
      <label className={styles.control}>
        <span className={styles.label}>Texto</span>
        <select
          className={styles.select}
          value={initialBook}
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
          value={initialLevel}
          onChange={handleLevelChange}
          data-testid="reading-controls-level"
        >
          {LEVEL_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.control}>
        <span className={styles.label}>Ancho</span>
        <select
          className={styles.select}
          value={initialWidthIdx}
          onChange={handleWidthChange}
          data-testid="reading-controls-width"
        >
          {WIDTH_ENTRIES.map(({ idx, width }) => (
            <option key={idx} value={idx}>
              {width}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
