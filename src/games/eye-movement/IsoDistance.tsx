import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./Basic.module.scss";
import { getIntervalMs } from "../utils/speed";

type Props = {
  distance: number;
  level: number;
  running: boolean;
  boardW: number;
  boardH: number;
  onTimeout: () => void;
};

type Point = { x: number; y: number };
type Bounds = { minX: number; maxX: number; minY: number; maxY: number };

type PhaseLoop = {
  raf: number | null;
  killer: ReturnType<typeof setTimeout> | null;
};

const SIZE = 24;
const RADIUS = SIZE / 2;
const MARGIN = 8;
const MAX_ATTEMPTS = 48;
const TIMEOUT_MS = 30000;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const computeBounds = (boardW: number, boardH: number): Bounds => {
  const minX = MARGIN + RADIUS;
  const maxX = Math.max(minX, boardW - MARGIN - RADIUS);
  const minY = MARGIN + RADIUS;
  const maxY = Math.max(minY, boardH - MARGIN - RADIUS);
  return { minX, maxX, minY, maxY };
};

const clampPoint = (point: Point, bounds: Bounds): Point => ({
  x: clamp(point.x, bounds.minX, bounds.maxX),
  y: clamp(point.y, bounds.minY, bounds.maxY)
});

const isWithinBounds = (point: Point, bounds: Bounds): boolean =>
  point.x >= bounds.minX &&
  point.x <= bounds.maxX &&
  point.y >= bounds.minY &&
  point.y <= bounds.maxY;

const computeStep = (distanceLevel: number, bounds: Bounds): number => {
  const maxReachX = Math.max(0, bounds.maxX - bounds.minX);
  const maxReachY = Math.max(0, bounds.maxY - bounds.minY);
  const span = Math.max(1, Math.min(maxReachX, maxReachY));
  const diag = Math.hypot(maxReachX, maxReachY);

  const rawMin = Math.max(RADIUS * 1.8, span * 0.18);
  const rawMax = Math.max(rawMin + 14, Math.min(span * 0.98, diag * 0.8));

  const ratio = (distanceLevel - 1) / 8;
  const t = Math.pow(ratio, 0.55);

  const scaledMin = rawMin * 1.5;
  const scaledMax = Math.max(scaledMin, rawMax * 1.05);
  return scaledMin + t * (scaledMax - scaledMin);
};

export function EyeMovementIsoDistance({
  distance,
  level,
  running,
  boardW,
  boardH,
  onTimeout
}: Props) {
  const bounds = useMemo(() => computeBounds(boardW, boardH), [boardW, boardH]);

  const stepPx = useMemo(() => {
    const distLevel = Math.min(9, Math.max(1, Math.round(distance)));
    return computeStep(distLevel, bounds);
  }, [bounds, distance]);

  const defaultCenter = useMemo(() => {
    const mid = {
      x: (bounds.minX + bounds.maxX) / 2,
      y: (bounds.minY + bounds.maxY) / 2
    };
    return clampPoint(mid, bounds);
  }, [bounds]);

  const [center, setCenter] = useState<Point>(defaultCenter);

  const intervalMs = getIntervalMs(level);

  const loopRef = useRef<PhaseLoop>({ raf: null, killer: null });
  const lastFrameRef = useRef<number | null>(null);
  const accumulatorRef = useRef(0);
  const runningRef = useRef(false);

  const randomizeStart = useCallback((): Point => {
    const widthRange = Math.max(bounds.maxX - bounds.minX, 0);
    const heightRange = Math.max(bounds.maxY - bounds.minY, 0);
    const next = {
      x: bounds.minX + (widthRange > 0 ? Math.random() * widthRange : 0),
      y: bounds.minY + (heightRange > 0 ? Math.random() * heightRange : 0)
    };
    setCenter(next);
    return next;
  }, [bounds]);

  const moveStep = useCallback(
    (origin?: Point) => {
      setCenter((prev) => {
        const base = clampPoint(origin ?? prev ?? defaultCenter, bounds);
        const cx = (bounds.minX + bounds.maxX) / 2;
        const cy = (bounds.minY + bounds.maxY) / 2;
        const toCenter = Math.atan2(cy - base.y, cx - base.x);

        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
          const randomOffset = (Math.random() - 0.5) * Math.PI * 2;
          const angle = toCenter + randomOffset;
          const candidate = {
            x: base.x + Math.cos(angle) * stepPx,
            y: base.y + Math.sin(angle) * stepPx
          };

          if (isWithinBounds(candidate, bounds)) {
            return candidate;
          }
        }

        return base;
      });
    },
    [bounds, defaultCenter, stepPx]
  );

  const stopLoop = useCallback(() => {
    if (loopRef.current.raf !== null) {
      cancelAnimationFrame(loopRef.current.raf);
      loopRef.current.raf = null;
    }
    lastFrameRef.current = null;
    accumulatorRef.current = 0;
  }, []);

  const frameLoop = useCallback(
    (timestamp: number) => {
      if (!runningRef.current) {
        return;
      }
      const last = lastFrameRef.current ?? timestamp;
      const delta = Math.min(timestamp - last, intervalMs);
      lastFrameRef.current = timestamp;

      accumulatorRef.current += delta;
      if (accumulatorRef.current >= intervalMs) {
        accumulatorRef.current %= intervalMs;
        moveStep();
      }

      loopRef.current.raf = requestAnimationFrame(frameLoop);
    },
    [intervalMs, moveStep]
  );

  const startLoop = useCallback(() => {
    stopLoop();
    lastFrameRef.current = null;
    accumulatorRef.current = 0;
    loopRef.current.raf = requestAnimationFrame(frameLoop);
  }, [frameLoop, stopLoop]);

  useEffect(() => {
    setCenter((prev) => clampPoint(prev ?? defaultCenter, bounds));
  }, [bounds, defaultCenter]);

  useEffect(() => {
    runningRef.current = running;

    if (loopRef.current.killer) {
      clearTimeout(loopRef.current.killer);
      loopRef.current.killer = null;
    }

    if (!running) {
      stopLoop();
      return;
    }

    const origin = randomizeStart();
    moveStep(origin);
    startLoop();

    loopRef.current.killer = setTimeout(() => {
      runningRef.current = false;
      stopLoop();
      onTimeout();
    }, TIMEOUT_MS);

    return () => {
      stopLoop();
      if (loopRef.current.killer) {
        clearTimeout(loopRef.current.killer);
        loopRef.current.killer = null;
      }
    };
  }, [moveStep, onTimeout, randomizeStart, running, startLoop, stopLoop]);

  useEffect(() => {
    const handleVis = () => {
      if (document.hidden) {
        stopLoop();
      } else if (runningRef.current) {
        startLoop();
      }
    };
    document.addEventListener("visibilitychange", handleVis);
    return () => {
      document.removeEventListener("visibilitychange", handleVis);
    };
  }, [startLoop, stopLoop]);

  useEffect(() => {
    return () => {
      stopLoop();
      if (loopRef.current.killer) {
        clearTimeout(loopRef.current.killer);
        loopRef.current.killer = null;
      }
    };
  }, [stopLoop]);

  useEffect(() => {
    if (!runningRef.current || !running) {
      return;
    }
    startLoop();
  }, [intervalMs, running, startLoop]);

  const left = Math.round(center.x - RADIUS);
  const top = Math.round(center.y - RADIUS);

  return (
    <div className={styles.container}>
      {running && (
        <div
          aria-label="target-circle"
          className={styles.circle}
          style={{ left, top, width: SIZE, height: SIZE }}
        />
      )}
    </div>
  );
}
