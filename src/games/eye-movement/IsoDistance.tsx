import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./Basic.module.scss";
import { getIntervalMs } from "../utils/speed";

type Props = {
  distance: number; // 1..9 controla la distancia del salto
  level: number;    // 1..9 controla la velocidad (ms)
  running: boolean;
  boardW: number;
  boardH: number;
  onTimeout: () => void;
};

type Point = { x: number; y: number };
type Bounds = { minX: number; maxX: number; minY: number; maxY: number };

const SIZE = 24;
const RADIUS = SIZE / 2;
const MARGIN = 8;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const computeBounds = (boardW: number, boardH: number): Bounds => {
  // Coordenadas del CENTRO del círculo
  const minX = MARGIN + RADIUS;
  const maxX = Math.max(minX, boardW - MARGIN - RADIUS);
  const minY = MARGIN + RADIUS;
  const maxY = Math.max(minY, boardH - MARGIN - RADIUS);
  return { minX, maxX, minY, maxY };
};

const clampPoint = (point: Point, bounds: Bounds): Point => ({
  x: clamp(point.x, bounds.minX, bounds.maxX),
  y: clamp(point.y, bounds.minY, bounds.maxY),
});

/**
 * computeStep (v3 “más grande”)
 * - Usa el span utilizable y la diagonal para permitir saltos MUY largos.
 * - Aumenta mínimos/máximos y usa una curva ease-out más agresiva (0.55).
 */
const computeStep = (
  distanceLevel: number,
  boardW: number,
  boardH: number,
  bounds: Bounds
): number => {
  const maxReachX = Math.max(0, bounds.maxX - bounds.minX); // ancho permitido para el centro
  const maxReachY = Math.max(0, bounds.maxY - bounds.minY); // alto permitido para el centro
  const span = Math.max(1, Math.min(maxReachX, maxReachY)); // “lado corto” utilizable por el centro
  const diag = Math.hypot(maxReachX, maxReachY);

  // Subimos umbrales respecto a v2
  const rawMin = Math.max(RADIUS * 1.8, span * 0.18);
  const rawMax = Math.max(rawMin + 14, Math.min(span * 0.98, diag * 0.80));

  const ratio = (distanceLevel - 1) / 8;    // 1..9 -> 0..1
  const t = Math.pow(ratio, 0.55);          // ease-out más marcada (crece antes)
  return rawMin + t * (rawMax - rawMin);
};

export function EyeMovementIsoDistance({
  distance,
  level,
  running,
  boardW,
  boardH,
  onTimeout,
}: Props) {
  const [center, setCenter] = useState<Point>(() => {
    const initialBounds = computeBounds(boardW, boardH);
    const mid = {
      x: (initialBounds.minX + initialBounds.maxX) / 2,
      y: (initialBounds.minY + initialBounds.maxY) / 2,
    };
    return clampPoint(mid, initialBounds);
  });

  const intervalMs = getIntervalMs(level);
  const bounds = useMemo(() => computeBounds(boardW, boardH), [boardW, boardH]);

  const defaultCenter = useMemo(() => {
    const mid = {
      x: (bounds.minX + bounds.maxX) / 2,
      y: (bounds.minY + bounds.maxY) / 2,
    };
    return clampPoint(mid, bounds);
  }, [bounds]);

  const distLevel = Math.min(9, Math.max(1, Math.round(distance)));
  const stepPx = useMemo(
    () => computeStep(distLevel, boardW, boardH, bounds),
    [distLevel, boardW, boardH, bounds]
  );

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const killerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const randomizeStart = useCallback((): Point => {
    const widthRange = Math.max(bounds.maxX - bounds.minX, 0);
    const heightRange = Math.max(bounds.maxY - bounds.minY, 0);
    const next = {
      x: bounds.minX + (widthRange > 0 ? Math.random() * widthRange : 0),
      y: bounds.minY + (heightRange > 0 ? Math.random() * heightRange : 0),
    };
    setCenter(next);
    return next;
  }, [bounds]);

  /**
   * moveStep con sesgo amplio hacia el centro:
   * - Distancia constante stepPx.
   * - Cono grande (±180º) para no “atascarse” en bordes con saltos largos.
   * - Aumentamos intentos a 36 para mejorar la tasa de hallazgo.
   */
  const moveStep = useCallback(
    (origin?: Point) => {
      if (stepPx <= 0) return;

      const cx = (bounds.minX + bounds.maxX) / 2;
      const cy = (bounds.minY + bounds.maxY) / 2;

      setCenter((prev) => {
        const base = clampPoint(origin ?? prev ?? defaultCenter, bounds);
        const attempts = 36;
        const toCenter = Math.atan2(cy - base.y, cx - base.x);
        const jitter = Math.PI; // ±180º

        for (let i = 0; i < attempts; i += 1) {
          const angle = toCenter + (Math.random() - 0.5) * 2 * jitter;
          const candidate = {
            x: base.x + Math.cos(angle) * stepPx,
            y: base.y + Math.sin(angle) * stepPx,
          };
          if (
            candidate.x >= bounds.minX &&
            candidate.x <= bounds.maxX &&
            candidate.y >= bounds.minY &&
            candidate.y <= bounds.maxY
          ) {
            return candidate;
          }
        }

        // Fallback: clamp (mantiene dirección “hacia dentro”, aunque acorte algo el paso real)
        return {
          x: clamp(base.x + Math.cos(toCenter) * stepPx, bounds.minX, bounds.maxX),
          y: clamp(base.y + Math.sin(toCenter) * stepPx, bounds.minY, bounds.maxY),
        };
      });
    },
    [bounds, defaultCenter, stepPx]
  );

  useEffect(() => {
    setCenter((prev) => clampPoint(prev ?? defaultCenter, bounds));
  }, [bounds, defaultCenter]);

  useEffect(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (killerRef.current) {
      clearTimeout(killerRef.current);
      killerRef.current = null;
    }

    if (!running) return;

    const origin = randomizeStart();
    moveStep(origin);

    tickRef.current = setInterval(() => moveStep(), intervalMs);
    killerRef.current = setTimeout(onTimeout, 30000);

    return () => {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
      if (killerRef.current) {
        clearTimeout(killerRef.current);
        killerRef.current = null;
      }
    };
  }, [running, intervalMs, randomizeStart, moveStep, onTimeout]);

  useEffect(() => {
    const onVis = () => {
      if (document.hidden && tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      } else if (!document.hidden && running && !tickRef.current) {
        moveStep();
        tickRef.current = setInterval(() => moveStep(), intervalMs);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [running, intervalMs, moveStep]);

  useEffect(() => {
    if (running) {
      setCenter((prev) => clampPoint(prev ?? defaultCenter, bounds));
    }
  }, [running, bounds, defaultCenter]);

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
