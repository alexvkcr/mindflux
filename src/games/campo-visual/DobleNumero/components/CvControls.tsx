import type { ChangeEvent } from "react";

import styles from "./CvControls.module.scss";
import type { ModeVariant } from "../hooks/useDoubleNumberEngine";

const LEVEL_OPTIONS = Array.from({ length: 9 }, (_, idx) => idx + 1);

const MODE_OPTIONS: Array<{ value: ModeVariant; label: string }> = [
  { value: "numbers-2", label: "2 números (1 por lado)" },
  { value: "numbers-4", label: "4 números (2 por lado)" },
  { value: "chars-2", label: "2 letras (1 por lado)" },
  { value: "chars-4", label: "4 letras (2 por lado)" },
  { value: "binary-6", label: "Binarios (3 por lado)" }
];

export interface CvControlsProps {
  speedLevel: number;
  difficultyLevel: number;
  intervalLevel: number;
  running: boolean;
  paused: boolean;
  mode: ModeVariant;
  onSpeedChange: (level: number) => void;
  onDifficultyChange: (level: number) => void;
  onIntervalChange: (level: number) => void;
  onModeChange: (mode: ModeVariant) => void;
  onTogglePause: () => void;
}

export function CvControls({
  speedLevel,
  difficultyLevel,
  intervalLevel,
  running,
  paused,
  mode,
  onSpeedChange,
  onDifficultyChange,
  onIntervalChange,
  onModeChange,
  onTogglePause
}: CvControlsProps) {
  const handleSpeedChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onSpeedChange(Number(event.target.value));
  };

  const handleDifficultyChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onDifficultyChange(Number(event.target.value));
  };

  const handleIntervalChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onIntervalChange(Number(event.target.value));
  };

  const handleModeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onModeChange(event.target.value as ModeVariant);
  };

  return (
    <div className={styles.controls}>
      <label className={styles.control}>
        <span className={styles.label}>Velocidad de estímulo</span>
        <select
          className={styles.select}
          value={speedLevel}
          onChange={handleSpeedChange}
        >
          {LEVEL_OPTIONS.map((option) => (
            <option key={option} value={option}>
              Nivel {option}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.control}>
        <span className={styles.label}>Separación lateral</span>
        <select
          className={styles.select}
          value={difficultyLevel}
          onChange={handleDifficultyChange}
        >
          {LEVEL_OPTIONS.map((option) => (
            <option key={option} value={option}>
              Nivel {option}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.control}>
        <span className={styles.label}>Intervalo entre apariciones</span>
        <select
          className={styles.select}
          value={intervalLevel}
          onChange={handleIntervalChange}
        >
          {LEVEL_OPTIONS.map((option) => (
            <option key={option} value={option}>
              Nivel {option}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.control}>
        <span className={styles.label}>Modo de estímulo</span>
        <select
          className={styles.select}
          value={mode}
          onChange={handleModeChange}
        >
          {MODE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        className={styles.pauseButton}
        onClick={onTogglePause}
        aria-pressed={paused}
        disabled={!running}
      >
        {paused ? "Continuar" : "Pausa"}
      </button>
    </div>
  );
}
