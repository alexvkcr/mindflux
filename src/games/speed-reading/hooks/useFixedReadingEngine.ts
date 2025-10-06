import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { buildLines } from '../utils/buildLines';
import { tokenize } from '../utils/tokenize';

const LEVEL_INTERVAL_TABLE: Record<number, number> = {
  1: 1000,
  2: 750,
  3: 563,
  4: 422,
  5: 316,
  6: 237,
  7: 178,
  8: 133,
  9: 100
};

const TIMEOUT_MS = 30000;

export interface EngineParams {
  text: string;
  charWidth: number;
  running: boolean;
  level: number;
  onTimeout: () => void;
}

export interface EngineState {
  currentLine: string;
  currentIndex: number;
  totalLines: number;
  reset: (params?: Partial<AdjustableParams>) => void;
}

type AdjustableParams = Pick<EngineParams, 'text' | 'charWidth' | 'level'>;

export function useFixedReadingEngine({
  text,
  charWidth,
  running,
  level,
  onTimeout
}: EngineParams): EngineState {
  const [overrides, setOverrides] = useState<Partial<AdjustableParams>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHidden, setIsHidden] = useState(() => {
    if (typeof document === 'undefined') {
      return false;
    }
    return document.hidden;
  });

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timedOutRef = useRef(false);

  const effectiveText = overrides.text ?? text;
  const effectiveCharWidth = overrides.charWidth ?? charWidth;
  const effectiveLevel = overrides.level ?? level;

  const words = useMemo(() => tokenize(effectiveText), [effectiveText]);
  const lines = useMemo(() => buildLines(words, effectiveCharWidth), [words, effectiveCharWidth]);
  const totalLines = lines.length;

  const safeIndex = totalLines === 0 ? 0 : Math.min(currentIndex, totalLines - 1);
  const currentLine = totalLines === 0 ? '' : lines[safeIndex];

  useEffect(() => {
    setCurrentIndex(0);
  }, [effectiveText, effectiveCharWidth]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }
    const handleVis = () => {
      setIsHidden(document.hidden);
    };
    document.addEventListener('visibilitychange', handleVis);
    return () => {
      document.removeEventListener('visibilitychange', handleVis);
    };
  }, []);

  const clearTick = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const clearTimeoutTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    clearTick();

    if (!running || isHidden || totalLines <= 1) {
      return;
    }

    const intervalMs = LEVEL_INTERVAL_TABLE[effectiveLevel] ?? LEVEL_INTERVAL_TABLE[1];

    tickRef.current = setInterval(() => {
      setCurrentIndex((prev) => {
        if (totalLines === 0) {
          return 0;
        }
        return (prev + 1) % totalLines;
      });
    }, intervalMs);

    return clearTick;
  }, [clearTick, effectiveLevel, isHidden, running, totalLines]);

  useEffect(() => {
    clearTimeoutTimer();

    if (!running) {
      timedOutRef.current = false;
      return;
    }

    timedOutRef.current = false;

    timeoutRef.current = setTimeout(() => {
      if (timedOutRef.current) {
        return;
      }
      timedOutRef.current = true;
      clearTick();
      onTimeout();
    }, TIMEOUT_MS);

    return clearTimeoutTimer;
  }, [clearTick, clearTimeoutTimer, running, onTimeout, effectiveText, effectiveCharWidth, effectiveLevel]);

  useEffect(() => {
    return () => {
      clearTick();
      clearTimeoutTimer();
    };
  }, [clearTick, clearTimeoutTimer]);

  const reset = useCallback((params?: Partial<AdjustableParams>) => {
    setCurrentIndex(0);
    timedOutRef.current = false;
    setOverrides(params ?? {});
  }, []);

  return {
    currentLine,
    currentIndex: safeIndex,
    totalLines,
    reset
  };
}
