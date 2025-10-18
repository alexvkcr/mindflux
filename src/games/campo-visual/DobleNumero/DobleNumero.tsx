import { useCallback, useEffect, useMemo, useState } from "react";

import styles from "./DobleNumero.module.scss";
import { CvControls } from "./components/CvControls";
import { useDoubleNumberEngine, type Mode } from "./hooks/useDoubleNumberEngine";
import { formatCountdown } from "../../speed-reading/utils/formatCountdown";

interface Props {
  level: number;
  running: boolean;
  boardW: number;
  boardH: number;
  onTimeout: () => void;
}

const clampLevel = (value: number) => Math.min(9, Math.max(1, Math.round(value)));

function getSeparationRatio(level: number): number {
  const t = (clampLevel(level) - 1) / 8;
  const MIN = 0.12;
  const MAX = 0.44;
  return MIN + (MAX - MIN) * t;
}

export function DobleNumero({
  level,
  running,
  boardW,
  boardH,
  onTimeout
}: Props) {
  const [speedLevel, setSpeedLevel] = useState(() => clampLevel(level));
  const [difficultyLevel, setDifficultyLevel] = useState(() => clampLevel(level));
  const [mode, setMode] = useState<Mode>("numbers");

  useEffect(() => {
    setSpeedLevel(clampLevel(level));
  }, [level]);

  const {
    pair,
    phase,
    timeLeftMs,
    paused,
    pause,
    resume,
    reset
  } = useDoubleNumberEngine({
    speedLevel,
    difficultyLevel,
    mode,
    running,
    boardW,
    boardH,
    onRoundOver: onTimeout
  });

  useEffect(() => {
    reset();
  }, [speedLevel, difficultyLevel, reset]);

  const handleSpeedChange = useCallback((next: number) => {
    setSpeedLevel(clampLevel(next));
  }, []);

  const handleDifficultyChange = useCallback((next: number) => {
    setDifficultyLevel(clampLevel(next));
  }, []);

  const handleModeChange = useCallback((nextMode: Mode) => {
    setMode(nextMode);
  }, []);

  const handleTogglePause = useCallback(() => {
    if (!running) {
      return;
    }
    if (paused) {
      resume();
    } else {
      pause();
    }
  }, [paused, pause, resume, running]);

  const formattedTime = useMemo(() => formatCountdown(timeLeftMs), [timeLeftMs]);
  const separation = useMemo(() => getSeparationRatio(difficultyLevel), [difficultyLevel]);

  const horizontalOffsetPercent = separation * 100;
  const leftPercent = Math.max(5, 50 - horizontalOffsetPercent);
  const rightPercent = Math.min(95, 50 + horizontalOffsetPercent);

  return (
    <div className={styles.container} data-testid="doble-numero-container">
      <div className={styles.controlsWrapper}>
        <CvControls
          speedLevel={speedLevel}
          difficultyLevel={difficultyLevel}
          running={running}
          paused={paused}
          mode={mode}
          onSpeedChange={handleSpeedChange}
          onDifficultyChange={handleDifficultyChange}
          onModeChange={handleModeChange}
          onTogglePause={handleTogglePause}
        />
      </div>

      <div className={styles.statusBar}>
        <div className={styles.statusItem} aria-live="polite">
          Tiempo restante: {formattedTime}
        </div>
        <div className={styles.statusItem} aria-live="polite">
          Fase: {phase === "show" ? "muestra" : "intervalo"}
        </div>
      </div>

      <div className={styles.board}>
        {phase === "show" && (
          <>
            <div
              className={styles.number}
              style={{ left: `${leftPercent}%`, top: "50%" }}
              aria-live="polite"
              data-testid="doble-numero-left"
            >
              {pair.left}
            </div>
            <div
              className={styles.number}
              style={{ left: `${rightPercent}%`, top: "50%" }}
              aria-live="polite"
              data-testid="doble-numero-right"
            >
              {pair.right}
            </div>
          </>
        )}
        {phase === "blank" && (
          <div className={styles.blank} aria-hidden="true" data-testid="doble-numero-blank">
            +
          </div>
        )}
      </div>
    </div>
  );
}
