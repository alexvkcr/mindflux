import type { ChangeEvent } from "react";

import styles from "./CvControls.module.scss";
import type { Mode } from "../hooks/useDoubleNumberEngine";

const LEVEL_OPTIONS = Array.from({ length: 9 }, (_, idx) => idx + 1);

export interface CvControlsProps {
  speedLevel: number;
  difficultyLevel: number;
  running: boolean;
  paused: boolean;
  mode: Mode;
  onSpeedChange: (level: number) => void;
  onDifficultyChange: (level: number) => void;
  onModeChange: (mode: Mode) => void;
  onTogglePause: () => void;
}

export function CvControls({
  speedLevel,
  difficultyLevel,
  running,
  paused,
  mode,
  onSpeedChange,
  onDifficultyChange,
  onModeChange,
  onTogglePause
}: CvControlsProps) {
  const handleSpeedChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onSpeedChange(Number(event.target.value));
  };

  const handleDifficultyChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onDifficultyChange(Number(event.target.value));
  };

  const handleModeToggle = () => {
    onModeChange(mode === "numbers" ? "chars" : "numbers");
  };

  return (
    <div className={styles.controls}>
      <label className={styles.control}>
        <span className={styles.label}>Velocidad</span>
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
        <span className={styles.label}>Dificultad</span>
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

      <button
        type="button"
        role="switch"
        aria-checked={mode === "chars"}
        className={styles.modeSwitch}
        onClick={handleModeToggle}
      >
        Modo: {mode === "numbers" ? "Números" : "Letras"}
      </button>

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
