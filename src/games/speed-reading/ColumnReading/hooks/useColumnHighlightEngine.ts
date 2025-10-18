import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { tokenize } from "../../utils/tokenize";
import { buildLines } from "../../utils/buildLines";

const MIN_DELAY_MS = 60;
const MAX_CELLS = 20; // 2 columns * 10 rows

export interface EngineParams {
  text: string;
  charWidth: number;
  wpm: number;
  rows: number;
  running: boolean;
  onTimeout: () => void;
}

interface AdjustableParams extends Pick<EngineParams, "text" | "charWidth" | "wpm" | "rows"> {}

export interface EngineState {
  grid: string[];
  highlightIdx: number;
  paused: boolean;
  play: () => void;
  pause: () => void;
  stop: () => void;
  reset: (params?: Partial<AdjustableParams>) => void;
}

function buildInitialGrid(lines: string[], cellCount: number): string[] {
  if (cellCount <= 0) {
    return [];
  }
  if (lines.length === 0) {
    return Array.from({ length: cellCount }, () => "");
  }

  return Array.from({ length: cellCount }, (_, idx) => {
    const lineIdx = idx % lines.length;
    return lines[lineIdx];
  });
}

export function useColumnHighlightEngine({
  text,
  charWidth,
  wpm,
  rows,
  running,
  onTimeout
}: EngineParams): EngineState {
  const [overrides, setOverrides] = useState<Partial<AdjustableParams>>({});
  const [resetToken, setResetToken] = useState(0);

  const effectiveText = overrides.text ?? text;
  const effectiveCharWidth = overrides.charWidth ?? charWidth;
  const effectiveWpm = overrides.wpm ?? wpm;
  const effectiveRows = Math.max(0, overrides.rows ?? rows);
  const cellCount = Math.min(MAX_CELLS, Math.max(0, effectiveRows * 2));

  const words = useMemo(() => tokenize(effectiveText), [effectiveText]);
  const lines = useMemo(
    () => buildLines(words, effectiveCharWidth),
    [words, effectiveCharWidth]
  );

  const [grid, setGrid] = useState<string[]>(() => buildInitialGrid(lines, cellCount));
  const [highlightIdx, setHighlightIdx] = useState<number>(0);
  const [paused, setPaused] = useState<boolean>(false);

  const gridRef = useRef(grid);
  const highlightRef = useRef(highlightIdx);
  const linesRef = useRef(lines);
  const cellCountRef = useRef(cellCount);
  const wpmRef = useRef(effectiveWpm);
  const charWidthRef = useRef(effectiveCharWidth);
  const nextLineCursorRef = useRef(0);
  const lastLineCellRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);
  const pausedRef = useRef(paused);
  const isPlayingRef = useRef(false);
  const elapsedMsRef = useRef(0);

  useEffect(() => {
    gridRef.current = grid;
  }, [grid]);

  useEffect(() => {
    highlightRef.current = highlightIdx;
  }, [highlightIdx]);

  useEffect(() => {
    linesRef.current = lines;
  }, [lines]);

  useEffect(() => {
    cellCountRef.current = cellCount;
  }, [cellCount]);

  useEffect(() => {
    wpmRef.current = effectiveWpm;
  }, [effectiveWpm]);

  useEffect(() => {
    charWidthRef.current = effectiveCharWidth;
  }, [effectiveCharWidth]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  const clearTick = useCallback(() => {
    if (tickRef.current !== null) {
      clearTimeout(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const initializeGrid = useCallback(() => {
    const total = cellCountRef.current;
    const source = linesRef.current;
    const initialGrid = buildInitialGrid(source, total);

    gridRef.current = initialGrid;
    setGrid(initialGrid);

    const startIdx = total > 0 ? 0 : 0;
    highlightRef.current = startIdx;
    setHighlightIdx(startIdx);

    if (source.length === 0) {
      nextLineCursorRef.current = 0;
      lastLineCellRef.current = null;
    } else {
      nextLineCursorRef.current = Math.min(total, source.length);
      if (source.length <= total) {
        lastLineCellRef.current = source.length - 1;
      } else {
        lastLineCellRef.current = null;
      }
    }
  }, []);

  const getIntervalMs = useCallback(() => {
    const safeWpm = Math.max(1, Math.round(wpmRef.current));
    const safeCharWidth = Math.max(1, charWidthRef.current);
    return Math.max(MIN_DELAY_MS, Math.round((60000 * safeCharWidth) / (safeWpm * 5)));
  }, []);

  const scheduleNext = useCallback(() => {
    clearTick();

    if (!isPlayingRef.current || pausedRef.current) {
      return;
    }
    if (cellCountRef.current <= 0 || rows <= 0) {
      return;
    }
    if (linesRef.current.length === 0) {
      return;
    }

    const intervalMs = getIntervalMs();

    tickRef.current = window.setTimeout(() => {
      if (!isPlayingRef.current || pausedRef.current) {
        return;
      }

      const total = cellCountRef.current;
      if (total <= 0) {
        scheduleNext();
        return;
      }

      const sourceLines = linesRef.current;
      const prevIdx = highlightRef.current;
      const noMoreLinesRemaining = nextLineCursorRef.current >= sourceLines.length;
      const justDisplayedLast =
        lastLineCellRef.current !== null && prevIdx === lastLineCellRef.current;

      elapsedMsRef.current = Math.min(45000, elapsedMsRef.current + intervalMs);

      if (noMoreLinesRemaining && justDisplayedLast) {
        clearTick();
        isPlayingRef.current = false;
        setPaused(false);
        pausedRef.current = false;
        onTimeout();
        return;
      }

      const nextIdx = total > 0 ? (prevIdx + 1) % total : 0;
      setHighlightIdx(nextIdx);
      highlightRef.current = nextIdx;

      if (nextLineCursorRef.current < sourceLines.length) {
        const nextLine = sourceLines[nextLineCursorRef.current] ?? "";
        const updatedGrid = gridRef.current.slice(0, total);
        while (updatedGrid.length < total) {
          updatedGrid.push("");
        }
        updatedGrid[prevIdx] = nextLine;
        gridRef.current = updatedGrid;
        setGrid(updatedGrid);

        if (nextLineCursorRef.current === sourceLines.length - 1) {
          lastLineCellRef.current = prevIdx;
        }

        nextLineCursorRef.current += 1;
      }

      scheduleNext();
    }, intervalMs);
  }, [clearTick, getIntervalMs, onTimeout, rows]);

  const playInternal = useCallback(() => {
    if (linesRef.current.length === 0 || cellCountRef.current <= 0 || rows <= 0) {
      return;
    }

    isPlayingRef.current = true;
    pausedRef.current = false;
    setPaused(false);
    scheduleNext();
  }, [rows, scheduleNext]);

  const pauseInternal = useCallback(() => {
    if (!isPlayingRef.current || pausedRef.current) {
      return;
    }
    clearTick();
    isPlayingRef.current = false;
    pausedRef.current = true;
    setPaused(true);
  }, [clearTick]);

  const stopInternal = useCallback(() => {
    clearTick();
    isPlayingRef.current = false;
    pausedRef.current = false;
    setPaused(false);
    elapsedMsRef.current = 0;
    initializeGrid();
  }, [clearTick, initializeGrid]);

  useEffect(() => {
    initializeGrid();
  }, [initializeGrid, resetToken, lines, cellCount]);


  useEffect(() => {
    if (!isPlayingRef.current || pausedRef.current) {
      return;
    }
    if (cellCountRef.current <= 0 || rows <= 0 || linesRef.current.length === 0) {
      clearTick();
      return;
    }
    scheduleNext();
  }, [rows, cellCount, lines, scheduleNext, clearTick]);

  useEffect(() => {
    if (running) {
      playInternal();
    } else {
      stopInternal();
    }
  }, [running, playInternal, stopInternal]);

  const play = useCallback(() => {
    playInternal();
  }, [playInternal]);

  const pause = useCallback(() => {
    pauseInternal();
  }, [pauseInternal]);

  const stop = useCallback(() => {
    stopInternal();
  }, [stopInternal]);

  const reset = useCallback((params?: Partial<AdjustableParams>) => {
    clearTick();
    if (params) {
      setOverrides((prev) => ({ ...prev, ...params }));
    }
    setResetToken((token) => token + 1);
  }, [clearTick]);
  return {
    grid,
    highlightIdx,
    paused,
    play,
    pause,
    stop,
    reset
  };
}

