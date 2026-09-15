import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { Modal } from "../../../components/ui/Modal";
import { useRegisterControlsPortal } from "../../../contexts/ControlsPortalContext";
import controlStyles from "../../reaction/ReactionControls.module.scss";
import styles from "./SchulteTable.module.scss";

interface Props {
  running: boolean;
  boardW: number;
  boardH: number;
  onTimeout: () => void;
}

type GridSize = "3x3" | "3x4" | "4x4" | "4x5" | "5x5";
type ContentMode = "numbers" | "lettersUpper" | "lettersLower" | "mixedUpper" | "mixedRandomCase";
type Phase = "idle" | "countdown" | "playing" | "finished";

interface GridOption {
  value: GridSize;
  label: string;
  rows: number;
  cols: number;
}

interface Cell {
  id: string;
  value: string;
}

const GRID_OPTIONS: GridOption[] = [
  { value: "3x3", label: "3 x 3", rows: 3, cols: 3 },
  { value: "3x4", label: "3 x 4", rows: 3, cols: 4 },
  { value: "4x4", label: "4 x 4", rows: 4, cols: 4 },
  { value: "4x5", label: "4 x 5", rows: 4, cols: 5 },
  { value: "5x5", label: "5 x 5", rows: 5, cols: 5 }
];

const CONTENT_OPTIONS: { value: ContentMode; label: string }[] = [
  { value: "numbers", label: "Numeros" },
  { value: "lettersUpper", label: "Letras mayusculas" },
  { value: "lettersLower", label: "Letras minusculas" },
  { value: "mixedUpper", label: "Numeros + letras" },
  { value: "mixedRandomCase", label: "Numeros + letras Aa" }
];

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const START_COUNTDOWN_SECONDS = 3;

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function buildSequence(mode: ContentMode, count: number): string[] {
  if (mode === "numbers") {
    return Array.from({ length: count }, (_, index) => String(index + 1));
  }

  if (mode === "lettersUpper") {
    return LETTERS.slice(0, count);
  }

  if (mode === "lettersLower") {
    return LETTERS.slice(0, count).map((letter) => letter.toLowerCase());
  }

  return Array.from({ length: count }, (_, index) => {
    const pairIndex = Math.floor(index / 2);
    const letter = LETTERS[pairIndex];
    const displayLetter =
      mode === "mixedRandomCase" && Math.random() < 0.5
        ? letter.toLowerCase()
        : letter;

    return index % 2 === 0 ? String(pairIndex + 1) : displayLetter;
  });
}

function formatElapsed(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}

export function SchulteTable({ running, onTimeout }: Props) {
  const [gridSize, setGridSize] = useState<GridSize>("5x5");
  const [contentMode, setContentMode] = useState<ContentMode>("numbers");
  const [phase, setPhase] = useState<Phase>("idle");
  const [cells, setCells] = useState<Cell[]>([]);
  const [sequence, setSequence] = useState<string[]>(() => buildSequence("numbers", 25));
  const [targetIndex, setTargetIndex] = useState(0);
  const [errors, setErrors] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [mistakeValue, setMistakeValue] = useState<string | null>(null);
  const [explanationOpen, setExplanationOpen] = useState(false);

  const intervalRef = useRef<number | null>(null);
  const countdownTimerRef = useRef<number | null>(null);
  const mistakeTimerRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);
  const phaseRef = useRef<Phase>("idle");
  const configRef = useRef(`${gridSize}-${contentMode}`);
  const runningRef = useRef(false);
  const registerControlsPortal = useRegisterControlsPortal();

  const grid = useMemo(
    () => GRID_OPTIONS.find((option) => option.value === gridSize) ?? GRID_OPTIONS[0],
    [gridSize]
  );
  const totalCells = grid.rows * grid.cols;
  const configuredSequence = useMemo(() => buildSequence(contentMode, totalCells), [contentMode, totalCells]);
  const activeSequence = phase === "playing" || phase === "finished" ? sequence : configuredSequence;
  const completedCount = Math.min(targetIndex, activeSequence.length);
  const currentTarget = phase === "playing" ? activeSequence[targetIndex] : null;

  const updatePhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const clearIntervalTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const clearCountdownTimer = useCallback(() => {
    if (countdownTimerRef.current !== null) {
      window.clearTimeout(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }, []);

  const clearMistakeTimer = useCallback(() => {
    if (mistakeTimerRef.current !== null) {
      window.clearTimeout(mistakeTimerRef.current);
      mistakeTimerRef.current = null;
    }
  }, []);

  const stopElapsedTimer = useCallback(() => {
    clearIntervalTimer();
    setElapsedMs(Math.max(0, Math.round(performance.now() - startTimeRef.current)));
  }, [clearIntervalTimer]);

  const resetRound = useCallback(() => {
    clearIntervalTimer();
    clearCountdownTimer();
    clearMistakeTimer();
    updatePhase("idle");
    setCells([]);
    setTargetIndex(0);
    setErrors(0);
    setElapsedMs(0);
    setCountdown(0);
    setMistakeValue(null);
  }, [clearCountdownTimer, clearIntervalTimer, clearMistakeTimer, updatePhase]);

  const startRound = useCallback(() => {
    clearIntervalTimer();
    clearCountdownTimer();
    clearMistakeTimer();
    const nextSequence = buildSequence(contentMode, totalCells);
    const nextCells = shuffle(nextSequence.map((value, index) => ({ id: `${value}-${index}`, value })));
    startTimeRef.current = performance.now();
    setSequence(nextSequence);
    setCells(nextCells);
    setTargetIndex(0);
    setErrors(0);
    setElapsedMs(0);
    setCountdown(0);
    setMistakeValue(null);
    updatePhase("playing");
    intervalRef.current = window.setInterval(() => {
      setElapsedMs(Math.max(0, Math.round(performance.now() - startTimeRef.current)));
    }, 100);
  }, [clearCountdownTimer, clearIntervalTimer, clearMistakeTimer, contentMode, totalCells, updatePhase]);

  const startCountdown = useCallback(() => {
    clearIntervalTimer();
    clearCountdownTimer();
    clearMistakeTimer();
    updatePhase("countdown");
    setCells([]);
    setTargetIndex(0);
    setErrors(0);
    setElapsedMs(0);
    setMistakeValue(null);
    setCountdown(START_COUNTDOWN_SECONDS);

    let remaining = START_COUNTDOWN_SECONDS;
    const tick = () => {
      if (!runningRef.current) {
        return;
      }

      remaining -= 1;
      if (remaining <= 0) {
        startRound();
        return;
      }

      setCountdown(remaining);
      countdownTimerRef.current = window.setTimeout(tick, 1000);
    };

    countdownTimerRef.current = window.setTimeout(tick, 1000);
  }, [clearCountdownTimer, clearIntervalTimer, clearMistakeTimer, startRound, updatePhase]);

  useEffect(() => {
    runningRef.current = running;

    if (running) {
      startCountdown();
      return;
    }

    if (phaseRef.current !== "finished") {
      resetRound();
    }
  }, [resetRound, running, startCountdown]);

  useEffect(() => {
    const nextConfig = `${gridSize}-${contentMode}`;
    if (configRef.current === nextConfig) {
      return;
    }

    configRef.current = nextConfig;
    if (!running) {
      resetRound();
    }
  }, [contentMode, gridSize, resetRound, running]);

  useEffect(() => {
    registerControlsPortal(
      <div className={controlStyles.panel}>
        <label className={controlStyles.control}>
          <span className={controlStyles.label}>Cuadricula</span>
          <select value={gridSize} disabled={running} onChange={(event) => setGridSize(event.target.value as GridSize)}>
            {GRID_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className={controlStyles.control}>
          <span className={controlStyles.label}>Contenido</span>
          <select value={contentMode} disabled={running} onChange={(event) => setContentMode(event.target.value as ContentMode)}>
            {CONTENT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    );

    return () => registerControlsPortal(null);
  }, [contentMode, gridSize, registerControlsPortal, running]);

  useEffect(() => () => {
    clearIntervalTimer();
    clearCountdownTimer();
    clearMistakeTimer();
    registerControlsPortal(null);
  }, [clearCountdownTimer, clearIntervalTimer, clearMistakeTimer, registerControlsPortal]);

  const handleCellPress = useCallback((cell: Cell) => {
    if (!running || phase !== "playing") {
      return;
    }

    const expected = sequence[targetIndex];
    if (cell.value !== expected) {
      clearMistakeTimer();
      setErrors((prev) => prev + 1);
      setMistakeValue(cell.value);
      mistakeTimerRef.current = window.setTimeout(() => {
        setMistakeValue(null);
        mistakeTimerRef.current = null;
      }, 220);
      return;
    }

    const nextIndex = targetIndex + 1;
    setTargetIndex(nextIndex);

    if (nextIndex >= sequence.length) {
      clearMistakeTimer();
      stopElapsedTimer();
      updatePhase("finished");
      onTimeout();
    }
  }, [clearMistakeTimer, onTimeout, phase, running, sequence, stopElapsedTimer, targetIndex, updatePhase]);

  const handleCellPointerDown = (event: PointerEvent<HTMLButtonElement>, cell: Cell) => {
    event.preventDefault();
    handleCellPress(cell);
  };

  const handleCellKeyDown = (event: KeyboardEvent<HTMLButtonElement>, cell: Cell) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    event.preventDefault();
    handleCellPress(cell);
  };

  const gridStyle = {
    "--rows": grid.rows,
    "--cols": grid.cols
  } as CSSProperties;

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <div className={styles.targetBox} aria-live="polite">
          <span className={styles.targetLabel}>{phase === "countdown" ? "Empieza en" : phase === "finished" ? "Completado" : "Busca"}</span>
          <span className={styles.targetValue}>{phase === "countdown" ? countdown : phase === "finished" ? "OK" : currentTarget ?? "-"}</span>
        </div>

        <div className={styles.badges}>
          <span className={styles.badge}>Tiempo: {formatElapsed(elapsedMs)}</span>
          <span className={styles.badge}>Clicks fallidos: {errors}</span>
          <span className={styles.badge}>Progreso: {completedCount}/{activeSequence.length}</span>
        </div>

        <button className={styles.explanationBtn} type="button" onClick={() => setExplanationOpen(true)}>
          Explicacion
        </button>
      </div>

      <div className={styles.board}>
        {phase === "idle" && (
          <p className={styles.helperText}>Pulsa "Arranque" para empezar la busqueda secuencial.</p>
        )}

        {phase === "countdown" && (
          <div className={styles.countdownPanel} aria-live="polite">
            <p className={styles.helperText}>Preparate para buscar el primer elemento.</p>
            <span className={styles.countdownNumber}>{countdown}</span>
          </div>
        )}

        {(phase === "playing" || phase === "finished") && (
          <>
            <div className={styles.grid} style={gridStyle}>
              {cells.map((cell) => {
                const order = activeSequence.indexOf(cell.value);
                const isDone = order >= 0 && order < targetIndex;
                const isWrong = mistakeValue === cell.value;

                return (
                  <button
                    key={cell.id}
                    type="button"
                    className={styles.cell}
                    disabled={isDone || phase === "finished"}
                    data-wrong={isWrong}
                    onPointerDown={(event) => handleCellPointerDown(event, cell)}
                    onKeyDown={(event) => handleCellKeyDown(event, cell)}
                    aria-label={`Elemento ${cell.value}`}
                  >
                    {cell.value}
                  </button>
                );
              })}
            </div>

            {phase === "finished" && (
              <p className={styles.summary}>
                Tardaste {formatElapsed(elapsedMs)} - Clicks fallidos: {errors}
              </p>
            )}
          </>
        )}
      </div>

      <Modal open={explanationOpen} title="Tabla Schulte" onClose={() => setExplanationOpen(false)}>
        <ul>
          <li>Encuentra y toca o pulsa el siguiente elemento de la secuencia.</li>
          <li>Con letras puedes entrenar mayusculas o minusculas.</li>
          <li>Con numeros + letras: 1, A, 2, B... o letras con mayusculas/minusculas aleatorias.</li>
          <li>Cuando aciertas, la casilla queda deshabilitada y el objetivo avanza.</li>
        </ul>
      </Modal>
    </div>
  );
}
