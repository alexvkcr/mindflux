import { useCallback, useEffect, useRef } from "react";

export function usePausableTimeout(paused: boolean) {
  const timerRef = useRef<number | null>(null);
  const callbackRef = useRef<(() => void) | null>(null);
  const remainingRef = useRef(0);
  const startedAtRef = useRef(0);

  const clear = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    callbackRef.current = null;
    remainingRef.current = 0;
    startedAtRef.current = 0;
  }, []);

  const schedule = useCallback(
    (fn: () => void, delay: number) => {
      if (delay <= 0) {
        fn();
        return;
      }

      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }

      callbackRef.current = fn;
      remainingRef.current = delay;
      startedAtRef.current = performance.now();
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        const cb = callbackRef.current;
        callbackRef.current = null;
        remainingRef.current = 0;
        startedAtRef.current = 0;
        cb?.();
      }, delay);
    },
    []
  );

  useEffect(() => {
    if (!paused) {
      if (!timerRef.current && callbackRef.current && remainingRef.current > 0) {
        const remaining = remainingRef.current;
        startedAtRef.current = performance.now();
        timerRef.current = window.setTimeout(() => {
          timerRef.current = null;
          const cb = callbackRef.current;
          callbackRef.current = null;
          remainingRef.current = 0;
          startedAtRef.current = 0;
          cb?.();
        }, remaining);
      }
      return;
    }

    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
      const elapsed = performance.now() - startedAtRef.current;
      remainingRef.current = Math.max(0, remainingRef.current - elapsed);
    }
  }, [paused]);

  return { start: schedule, cancel: clear };
}
