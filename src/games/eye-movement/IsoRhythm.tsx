import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./Basic.module.scss";
import controlStyles from "../reaction/ReactionControls.module.scss";
import isoStyles from "./IsoRhythm.module.scss";
import { getIntervalMs } from "../utils/speed";
import { useRegisterControlsPortal } from "../../contexts/ControlsPortalContext";
import { t } from "../../i18n";

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

const SIZE = 24;
const RADIUS = SIZE / 2;
const MARGIN = 8;
const MAX_ATTEMPTS = 48;
const REST_OPTIONS = [1500, 2000, 2500, 3000, 4000, 5000, 7500, 10000, 15000];

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

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

const computeStep = (distanceLevel: number, bounds: Bounds): number => {
  const maxReachX = Math.max(0, bounds.maxX - bounds.minX);
  const maxReachY = Math.max(0, bounds.maxY - bounds.minY);
  const span = Math.max(1, Math.min(maxReachX, maxReachY));
  const diag = Math.hypot(maxReachX, maxReachY);

  const rawMin = Math.max(RADIUS * 1.8, span * 0.18);
  const rawMax = Math.max(rawMin + 14, Math.min(span * 0.98, diag * 0.8));

  const ratio = (distanceLevel - 1) / 8;
  const tPow = Math.pow(ratio, 0.55);

  const scaledMin = rawMin * 1.5;
  const scaledMax = Math.max(scaledMin, rawMax * 1.05);
  return scaledMin + tPow * (scaledMax - scaledMin);
};

const formatSeconds = (ms: number): string => {
  if (ms % 1000 === 0) {
    return `${ms / 1000} s`;
  }
  return `${(ms / 1000).toFixed(1)} s`;
};

export function EyeMovementIsoRhythm({
  distance,
  level,
  running,
  boardW,
  boardH,
  onTimeout
}: Props) {
  const registerControlsPortal = useRegisterControlsPortal();

  const bounds = useMemo(() => computeBounds(boardW, boardH), [boardW, boardH]);

  const distanceLevel = useMemo(() => Math.min(9, Math.max(1, Math.round(distance))), [distance]);
  const speedLevel = useMemo(() => Math.min(9, Math.max(1, Math.round(level))), [level]);

  const stepPx = useMemo(() => computeStep(distanceLevel, bounds), [bounds, distanceLevel]);

  const defaultCenter = useMemo(() => {
    const mid = {
      x: (bounds.minX + bounds.maxX) / 2,
      y: (bounds.minY + bounds.maxY) / 2
    };
    return clampPoint(mid, bounds);
  }, [bounds]);

  const [center, setCenter] = useState<Point>(defaultCenter);
  const [jumpsPerBlock, setJumpsPerBlock] = useState(3);
  const [restDurationMs, setRestDurationMs] = useState(2000);
  const [roundsTotal, setRoundsTotal] = useState(5);
  const [sessionActive, setSessionActive] = useState(false);

  const intervalMs = getIntervalMs(speedLevel);

  const jumpTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const restTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const runningRef = useRef(false);
  const roundRef = useRef(0);
  const jumpsLeftRef = useRef(0);

  const clearJumpTimeout = useCallback(() => {
    if (jumpTimeoutRef.current !== null) {
      window.clearTimeout(jumpTimeoutRef.current);
      jumpTimeoutRef.current = null;
    }
  }, []);

  const clearRestTimeout = useCallback(() => {
    if (restTimeoutRef.current !== null) {
      window.clearTimeout(restTimeoutRef.current);
      restTimeoutRef.current = null;
    }
  }, []);

  const clearAllTimers = useCallback(() => {
    clearJumpTimeout();
    clearRestTimeout();
  }, [clearJumpTimeout, clearRestTimeout]);

  const stopSession = useCallback(() => {
    runningRef.current = false;
    clearAllTimers();
    setSessionActive(false);
    roundRef.current = 0;
    jumpsLeftRef.current = 0;
  }, [clearAllTimers]);

  const finishSession = useCallback(() => {
    stopSession();
    onTimeout();
  }, [onTimeout, stopSession]);

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

          const withinX = candidate.x >= bounds.minX && candidate.x <= bounds.maxX;
          const withinY = candidate.y >= bounds.minY && candidate.y <= bounds.maxY;
          if (withinX && withinY) {
            return candidate;
          }
        }

        return base;
      });
    },
    [bounds, defaultCenter, stepPx]
  );

  const performJump = useCallback(
    (origin?: Point) => {
      if (!runningRef.current) {
        return;
      }
      moveStep(origin);
      jumpsLeftRef.current -= 1;

      if (jumpsLeftRef.current > 0) {
        clearJumpTimeout();
        jumpTimeoutRef.current = window.setTimeout(() => {
          performJump();
        }, intervalMs);
        return;
      }
      clearRestTimeout();
      restTimeoutRef.current = window.setTimeout(() => {
        if (!runningRef.current) {
          return;
        }
        const nextRound = roundRef.current + 1;
        if (nextRound > roundsTotal) {
          finishSession();
          return;
        }
        roundRef.current = nextRound;
        jumpsLeftRef.current = jumpsPerBlock;
        performJump();
      }, restDurationMs);
    },
    [
      clearJumpTimeout,
      clearRestTimeout,
      finishSession,
      intervalMs,
      jumpsPerBlock,
      moveStep,
      restDurationMs,
      roundsTotal
    ]
  );

  const startSession = useCallback(() => {
    clearAllTimers();
    runningRef.current = true;
    setSessionActive(true);
    const firstRound = 1;
    roundRef.current = firstRound;
    jumpsLeftRef.current = jumpsPerBlock;
    const origin = randomizeStart();
    performJump(origin);
  }, [clearAllTimers, jumpsPerBlock, performJump, randomizeStart]);

  useEffect(() => {
    setCenter((prev) => clampPoint(prev ?? defaultCenter, bounds));
  }, [bounds, defaultCenter]);

  useEffect(() => {
    if (running) {
      startSession();
    } else {
      stopSession();
    }
  }, [running, startSession, stopSession]);

  useEffect(() => {
    return () => {
      stopSession();
    };
  }, [stopSession]);

  useEffect(() => {
    registerControlsPortal(
      <div className={controlStyles.panel}>
        <label className={controlStyles.control}>
          <span className={controlStyles.label}>
            {t.eyeRhythm.controls.jumpsPerBlock}: {jumpsPerBlock}
          </span>
          <select
            value={jumpsPerBlock}
            disabled={sessionActive}
            onChange={(event) => setJumpsPerBlock(Number(event.target.value))}
          >
            {Array.from({ length: 6 }, (_, idx) => idx + 1).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label className={controlStyles.control}>
          <span className={controlStyles.label}>
            {t.eyeRhythm.controls.restBetweenBlocks}: {formatSeconds(restDurationMs)}
          </span>
          <select
            value={restDurationMs}
            disabled={sessionActive}
            onChange={(event) => setRestDurationMs(Number(event.target.value))}
          >
            {REST_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {formatSeconds(value)}
              </option>
            ))}
          </select>
        </label>

        <label className={controlStyles.control}>
          <span className={controlStyles.label}>
            {t.eyeRhythm.controls.totalRounds}: {roundsTotal}
          </span>
          <select
            value={roundsTotal}
            disabled={sessionActive}
            onChange={(event) => setRoundsTotal(Number(event.target.value))}
          >
            {Array.from({ length: 20 }, (_, idx) => idx + 1).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>
    );

    return () => {
      registerControlsPortal(null);
    };
  }, [jumpsPerBlock, registerControlsPortal, restDurationMs, roundsTotal, sessionActive]);

  const left = Math.round(center.x - RADIUS);
  const top = Math.round(center.y - RADIUS);

  return (
    <div className={styles.container + " " + isoStyles.panel} data-testid="iso-rhythm-container">

      {sessionActive && (
        <div
          aria-label="target-circle"
          className={styles.circle}
          style={{ left, top, width: SIZE, height: SIZE }}
        />
      )}
    </div>
  );
}
