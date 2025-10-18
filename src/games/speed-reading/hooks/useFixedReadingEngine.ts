import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { tokenize } from "../utils/tokenize";
import { buildLines } from "../utils/buildLines";
import { getMsPerLine } from "../utils/getMsPerLine";

const TIMEOUT_MS = 30000;

export interface EngineParams {
  text: string;
  charWidth: number;
  wpm: number;
  running: boolean;
  onTimeout: () => void;
}

interface AdjustableParams extends Pick<EngineParams, "text" | "charWidth" | "wpm"> {}

export interface EngineState {
  currentLine: string;
  currentIndex: number;
  totalLines: number;
  timeLeftMs: number;
  paused: boolean;
  pause: () => void;
  resume: () => void;
  reset: (params?: Partial<AdjustableParams>) => void;
}

export function useFixedReadingEngine({
  text,
  charWidth,
  wpm,
  running,
  onTimeout
}: EngineParams): EngineState {
  const [overrides, setOverrides] = useState<Partial<AdjustableParams>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeftMs, setTimeLeftMs] = useState(TIMEOUT_MS);
  const [paused, setPaused] = useState(false);

  const timeoutTriggeredRef = useRef(false);
  const lineTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number | null>(null);
  const prevRunningRef = useRef(running);

  const effectiveText = overrides.text ?? text;
  const effectiveCharWidth = overrides.charWidth ?? charWidth;
  const effectiveWpm = overrides.wpm ?? wpm;

  const words = useMemo(() => tokenize(effectiveText), [effectiveText]);
  const lines = useMemo(
    () => buildLines(words, effectiveCharWidth),
    [words, effectiveCharWidth]
  );
  const totalLines = lines.length;
  const safeIndex = totalLines === 0 ? 0 : Math.min(currentIndex, totalLines - 1);
  const currentLine = totalLines === 0 ? "" : lines[safeIndex];

  const clearLineTimeout = useCallback(() => {
    if (lineTimeoutRef.current !== null) {
      clearTimeout(lineTimeoutRef.current);
      lineTimeoutRef.current = null;
    }
  }, []);

  const stopClock = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastTickRef.current = null;
  }, []);

  const stopAll = useCallback(() => {
    clearLineTimeout();
    stopClock();
  }, [clearLineTimeout, stopClock]);

  const handleTimeout = useCallback(() => {
    if (timeoutTriggeredRef.current) {
      return;
    }
    timeoutTriggeredRef.current = true;
    stopAll();
    setPaused(true);
    onTimeout();
  }, [onTimeout, stopAll]);

  useEffect(() => {
    timeoutTriggeredRef.current = false;
    setCurrentIndex(0);
    setTimeLeftMs(TIMEOUT_MS);
    setPaused(false);
    stopAll();
  }, [effectiveText, effectiveCharWidth, effectiveWpm, stopAll]);

  useEffect(() => {
    if (running && !prevRunningRef.current) {
      timeoutTriggeredRef.current = false;
      setPaused(false);
      setCurrentIndex(0);
      setTimeLeftMs(TIMEOUT_MS);
    }

    if (!running && prevRunningRef.current) {
      stopAll();
      setPaused(false);
      setTimeLeftMs(TIMEOUT_MS);
    }

    prevRunningRef.current = running;
  }, [running, stopAll]);

  useEffect(() => {
    if (!running || paused || timeoutTriggeredRef.current) {
      stopClock();
      return;
    }

    const step = (timestamp: number) => {
      const last = lastTickRef.current ?? timestamp;
      const delta = Math.min(timestamp - last, 200);
      lastTickRef.current = timestamp;

      let shouldTimeout = false;
      setTimeLeftMs((prev) => {
        if (prev <= 0) {
          shouldTimeout = true;
          return 0;
        }
        const next = Math.max(0, prev - delta);
        if (next === 0) {
          shouldTimeout = true;
        }
        return next;
      });

      if (shouldTimeout) {
        handleTimeout();
        return;
      }

      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);

    return () => {
      stopClock();
    };
  }, [running, paused, handleTimeout, stopClock]);

  const computeDelayForIndex = useCallback(
    (index: number) => {
      const line = lines[index] ?? "";
      const wordsInLine = line.trim().length === 0 ? 1 : line.trim().split(/\s+/u).length;
      return getMsPerLine(wordsInLine, effectiveWpm);
    },
    [lines, effectiveWpm]
  );

  useEffect(() => {
    if (!running || paused || timeoutTriggeredRef.current || totalLines === 0) {
      clearLineTimeout();
      return;
    }

    const delay = computeDelayForIndex(safeIndex);
    clearLineTimeout();

    lineTimeoutRef.current = setTimeout(() => {
      setCurrentIndex((prev) => {
        if (totalLines === 0) {
          return 0;
        }
        return (prev + 1) % totalLines;
      });
    }, delay);

    return () => {
      clearLineTimeout();
    };
  }, [running, paused, totalLines, safeIndex, computeDelayForIndex, clearLineTimeout]);

  useEffect(() => {
    if (totalLines === 0) {
      setCurrentIndex(0);
    } else if (currentIndex >= totalLines) {
      setCurrentIndex(0);
    }
  }, [currentIndex, totalLines]);

  const pause = useCallback(() => {
    if (paused || !running) {
      return;
    }
    clearLineTimeout();
    stopClock();
    setPaused(true);
  }, [paused, running, clearLineTimeout, stopClock]);

  const resume = useCallback(() => {
    if (!paused || !running || timeLeftMs <= 0 || timeoutTriggeredRef.current) {
      return;
    }
    lastTickRef.current = null;
    setPaused(false);
  }, [paused, running, timeLeftMs]);

  const reset = useCallback((params?: Partial<AdjustableParams>) => {
    timeoutTriggeredRef.current = false;
    setOverrides(params ?? {});
    setCurrentIndex(0);
    setTimeLeftMs(TIMEOUT_MS);
    setPaused(false);
    stopAll();
  }, [stopAll]);

  return {
    currentLine,
    currentIndex: safeIndex,
    totalLines,
    timeLeftMs,
    paused,
    pause,
    resume,
    reset
  };
}
