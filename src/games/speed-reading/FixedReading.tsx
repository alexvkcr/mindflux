import { useCallback, useEffect, useMemo, useState } from "react";

import styles from "./FixedReading.module.scss";
import { texts } from "./texts";
import { ReadingControls } from "./components/ReadingControls";
import { ReadingViewport } from "./components/ReadingViewport";
import { useFixedReadingEngine } from "./hooks/useFixedReadingEngine";
import { WIDTH_MAP, type WidthIndex } from "./utils/widthMap";
import { levelToWpm } from "./utils/wpm";
import { formatCountdown } from "./utils/formatCountdown";
import type { BookKey } from "../../components/ControlsBar";

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
  return Math.min(9, Math.max(1, Math.round(level)));
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

  const clampedLevel = useMemo(() => clampLevel(selLevel), [selLevel]);
  const charWidth = WIDTH_MAP[widthIdx];
  const wpm = useMemo(() => levelToWpm(clampedLevel), [clampedLevel]);

  const rawText = useMemo(() => {
    const fragments = texts[selBook] ?? [];
    return fragments.map((fragment) => fragment.text).join("\n\n");
  }, [selBook]);

  const {
    currentLine,
    timeLeftMs,
    paused,
    pause,
    resume,
    reset
  } = useFixedReadingEngine({
    text: rawText,
    charWidth,
    wpm,
    running,
    onTimeout
  });

  useEffect(() => {
    reset({ text: rawText, charWidth, wpm });
  }, [rawText, charWidth, wpm, reset]);

  const handleControlsChange = useCallback(
    ({ book: nextBook, level: nextLevel, widthIdx: nextWidthIdx }: {
      book: BookKey;
      level: number;
      widthIdx: WidthIndex;
    }) => {
      const safeLevel = clampLevel(nextLevel);
      const nextCharWidth = WIDTH_MAP[nextWidthIdx];
      const nextText = (texts[nextBook] ?? []).map((fragment) => fragment.text).join("\n\n");
      const nextWpm = levelToWpm(safeLevel);

      setSelBook(nextBook);
      setSelLevel(safeLevel);
      setWidthIdx(nextWidthIdx);

      reset({
        text: nextText,
        charWidth: nextCharWidth,
        wpm: nextWpm
      });
    },
    [reset]
  );

  const handlePauseToggle = useCallback(() => {
    if (!running) {
      return;
    }
    if (paused) {
      resume();
    } else {
      pause();
    }
  }, [paused, pause, resume, running]);

  const formattedTimeLeft = formatCountdown(timeLeftMs);

  return (
    <div className={styles.container} data-testid="fixed-reading-container">
      <div className={styles.controlsWrapper}>
        <ReadingControls
          book={selBook}
          level={clampedLevel}
          widthIdx={widthIdx}
          onChange={handleControlsChange}
        />
      </div>

      <div className={styles.statusBar}>
        <div className={styles.statusItem} aria-live="polite">
          VELOCIDAD: {wpm} PALABRAS/MINUTO
        </div>
        <div className={styles.statusItem} aria-live="polite">
          Tiempo restante: {formattedTimeLeft}
        </div>
        <button
          type="button"
          className={styles.pauseButton}
          onClick={handlePauseToggle}
          aria-pressed={paused}
          disabled={!running || timeLeftMs <= 0}
        >
          {paused ? "Continuar" : "Pausa"}
        </button>
      </div>

      <div className={styles.textArea}>
        <ReadingViewport line={currentLine} charWidth={charWidth} />
      </div>
    </div>
  );
}


