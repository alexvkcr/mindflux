import { useCallback, useEffect, useMemo, useState } from 'react';

import styles from './FixedReading.module.scss';
import { texts } from './texts';
import { ReadingControls } from './components/ReadingControls';
import { ReadingViewport } from './components/ReadingViewport';
import { useFixedReadingEngine } from './hooks/useFixedReadingEngine';
import { WIDTH_MAP, type WidthIndex } from './utils/widthMap';
import type { BookKey } from '../../components/ControlsBar';

interface Props {
  book: BookKey;
  level: number;
  running: boolean;
  boardW: number;
  boardH: number;
  onTimeout: () => void;
}

const DEFAULT_WIDTH_IDX: WidthIndex = 3;

function clampLevel(level: number): number {
  return Math.min(9, Math.max(1, level));
}

export function FixedReading({
  book,
  level,
  running,
  onTimeout
}: Props) {
  const [selBook, setSelBook] = useState<BookKey>(book);
  const [selLevel, setSelLevel] = useState<number>(level);
  const [widthIdx, setWidthIdx] = useState<WidthIndex>(DEFAULT_WIDTH_IDX);

  useEffect(() => {
    setSelBook(book);
  }, [book]);

  useEffect(() => {
    setSelLevel(level);
  }, [level]);

  const charWidth = WIDTH_MAP[widthIdx];

  const rawText = useMemo(() => {
    const fragments = texts[selBook] ?? [];
    return fragments.map((fragment) => fragment.text).join('\n\n');
  }, [selBook]);

  const clampedLevel = useMemo(() => {
    return clampLevel(selLevel);
  }, [selLevel]);

  const { currentLine, currentIndex, totalLines, reset } = useFixedReadingEngine({
    text: rawText,
    charWidth,
    running,
    level: clampedLevel,
    onTimeout
  });

  const handleControlsChange = useCallback(
    ({ book: nextBook, level: nextLevel, widthIdx: nextWidthIdx }: {
      book: BookKey;
      level: number;
      widthIdx: WidthIndex;
    }) => {
      const safeLevel = clampLevel(nextLevel);
      const nextCharWidth = WIDTH_MAP[nextWidthIdx];
      const nextText = (texts[nextBook] ?? []).map((fragment) => fragment.text).join('\n\n');

      setSelBook(nextBook);
      setSelLevel(safeLevel);
      setWidthIdx(nextWidthIdx);

      reset({
        text: nextText,
        charWidth: nextCharWidth,
        level: safeLevel
      });
    },
    [reset]
  );

  const displayTotal = totalLines > 0 ? totalLines : 1;
  const displayIndex = Math.min(currentIndex + 1, displayTotal);

  return (
    <div className={styles.container} data-testid="fixed-reading-container">
      <div className={styles.controlsWrapper}>
        <ReadingControls
          initialBook={selBook}
          initialLevel={clampedLevel}
          initialWidthIdx={widthIdx}
          onChange={handleControlsChange}
        />
      </div>

      <div className={styles.textArea}>
        <ReadingViewport line={currentLine}/>
      </div>

      <div className={styles.status} data-testid="reading-progress">
        Linea {displayIndex}/{displayTotal}
      </div>
    </div>
  );
}

