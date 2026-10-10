import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Modal } from "../../../components/ui/Modal";
import { useRegisterControlsPortal } from "../../../contexts/controlsPortal";
import { buildSequence, CONTENT_OPTIONS, formatElapsed, GRID_OPTIONS, normalizeBoardCount, shuffle, summarizeBoards,
  type BoardResult, type ContentMode, type GridSize } from "./schulte";
import controlStyles from "../../reaction/ReactionControls.module.scss";
import styles from "./SchulteTable.module.scss";

interface Props {
  running: boolean;
  boardW: number;
  boardH: number;
  onTimeout: () => void;
  continuous?: boolean;
}

type Phase = "idle" | "countdown" | "playing" | "finished";
interface Cell { id: string; value: string }

export function SchulteTable({ running, onTimeout, continuous = false }: Props) {
  const [gridSize, setGridSize] = useState<GridSize>("5x5");
  const [contentMode, setContentMode] = useState<ContentMode>("numbers");
  const [boardCount, setBoardCount] = useState(3);
  const [roundNumber, setRoundNumber] = useState(1);
  const [phase, setPhase] = useState<Phase>("idle");
  const [cells, setCells] = useState<Cell[]>([]);
  const [sequence, setSequence] = useState<string[]>([]);
  const [targetIndex, setTargetIndex] = useState(0);
  const [errors, setErrors] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [mistakeValue, setMistakeValue] = useState<string | null>(null);
  const [results, setResults] = useState<BoardResult[]>([]);
  const [explanationOpen, setExplanationOpen] = useState(false);

  const dialogRef = useRef<HTMLDialogElement>(null);
  const intervalRef = useRef<number | null>(null);
  const countdownTimerRef = useRef<number | null>(null);
  const mistakeTimerRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);
  const targetIndexRef = useRef(0);
  const errorsRef = useRef(0);
  const resultsRef = useRef<BoardResult[]>([]);
  const phaseRef = useRef<Phase>("idle");
  const runningRef = useRef(false);
  const configRef = useRef(`${gridSize}-${contentMode}-${boardCount}`);
  const registerControlsPortal = useRegisterControlsPortal();
  const title = continuous ? "Tablas Schulte continuas" : "Tabla Schulte";
  const sessionBoardCount = continuous ? normalizeBoardCount(boardCount) : 1;
  const grid = GRID_OPTIONS.find((option) => option.value === gridSize) ?? GRID_OPTIONS[0];
  const totalCells = grid.rows * grid.cols;
  const average = useMemo(() => summarizeBoards(results), [results]);

  const updatePhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const clearTimers = useCallback(() => {
    window.clearInterval(intervalRef.current ?? undefined);
    window.clearTimeout(countdownTimerRef.current ?? undefined);
    window.clearTimeout(mistakeTimerRef.current ?? undefined);
    intervalRef.current = countdownTimerRef.current = mistakeTimerRef.current = null;
  }, []);

  const resetRound = useCallback(() => {
    clearTimers();
    updatePhase("idle");
    setCells([]);
    setTargetIndex(0);
    setErrors(0);
    setElapsedMs(0);
    setCountdown(0);
    setMistakeValue(null);
    setResults([]);
    setRoundNumber(1);
    resultsRef.current = [];
    targetIndexRef.current = errorsRef.current = 0;
  }, [clearTimers, updatePhase]);

  const startRound = useCallback(() => {
    if (!runningRef.current) return;
    clearTimers();
    const nextSequence = buildSequence(contentMode, totalCells);
    setSequence(nextSequence);
    setCells(shuffle(nextSequence.map((value, index) => ({ id: `${value}-${index}`, value }))));
    setCountdown(0);
    updatePhase("playing");
  }, [clearTimers, contentMode, totalCells, updatePhase]);

  // Start measuring once the new board has been committed to the dialog.
  useLayoutEffect(() => {
    if (phase !== "playing" || !running) return;
    startTimeRef.current = performance.now();
    intervalRef.current = window.setInterval(() => {
      setElapsedMs(Math.max(0, Math.round(performance.now() - startTimeRef.current)));
    }, 100);
    return () => {
      window.clearInterval(intervalRef.current ?? undefined);
      intervalRef.current = null;
    };
  }, [phase, running]);

  const startCountdown = useCallback(() => {
    clearTimers();
    updatePhase("countdown");
    setCells([]);
    setTargetIndex(0);
    setErrors(0);
    setElapsedMs(0);
    setMistakeValue(null);
    targetIndexRef.current = errorsRef.current = 0;
    setCountdown(3);
    let remaining = 3;
    const tick = () => {
      if (!runningRef.current) return;
      remaining -= 1;
      if (remaining === 0) {
        startRound();
      } else {
        setCountdown(remaining);
        countdownTimerRef.current = window.setTimeout(tick, 1000);
      }
    };
    countdownTimerRef.current = window.setTimeout(tick, 1000);
  }, [clearTimers, startRound, updatePhase]);

  useEffect(() => {
    runningRef.current = running;
    if (running) {
      resultsRef.current = [];
      setResults([]);
      setRoundNumber(1);
      setExplanationOpen(false);
      startCountdown();
    } else if (phaseRef.current !== "finished") {
      resetRound();
    }
    return () => {
      runningRef.current = false;
      clearTimers();
    };
  }, [clearTimers, resetRound, running, startCountdown]);

  // Changing the session options clears the previous report.
  useEffect(() => {
    const config = `${gridSize}-${contentMode}-${boardCount}`;
    if (configRef.current === config) return;
    configRef.current = config;
    if (!running) resetRound();
  }, [gridSize, contentMode, boardCount, resetRound, running]);

  useLayoutEffect(() => {
    if (!running) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const body = document.body;
    const root = document.documentElement;
    const previousBody = { position: body.style.position, top: body.style.top, left: body.style.left,
      width: body.style.width, overflow: body.style.overflow };
    const previousOverflow = root.style.overflow;
    Object.assign(body.style, { position: "fixed", top: `${-scrollY}px`, left: `${-scrollX}px`, width: "100%", overflow: "hidden" });
    root.style.overflow = "hidden";
    dialog.showModal();
    return () => {
      dialog.close();
      Object.assign(body.style, previousBody);
      root.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
      window.scrollTo(scrollX, scrollY);
    };
  }, [running]);

  const cancelGame = useCallback(() => {
    runningRef.current = false;
    resetRound();
    onTimeout();
  }, [onTimeout, resetRound]);

  const controls = useMemo(() => (
    <div className={controlStyles.panel}>
      <label className={controlStyles.control}>
        <span className={controlStyles.label}>Cuadrícula</span>
        <select value={gridSize} disabled={running} onChange={(event) => setGridSize(event.target.value as GridSize)}>
          {GRID_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <label className={controlStyles.control}>
        <span className={controlStyles.label}>Contenido</span>
        <select value={contentMode} disabled={running} onChange={(event) => setContentMode(event.target.value as ContentMode)}>
          {CONTENT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      {continuous && (
        <label className={controlStyles.control}>
          <span className={controlStyles.label}>Tableros por sesión</span>
          <select value={boardCount} disabled={running} onChange={(event) => setBoardCount(normalizeBoardCount(Number(event.target.value)))}>
            {Array.from({ length: 15 }, (_, index) => index + 1).map((count) => <option key={count} value={count}>{count}</option>)}
          </select>
        </label>
      )}
    </div>
  ), [boardCount, contentMode, continuous, gridSize, running]);

  useEffect(() => {
    registerControlsPortal(controls);
    return () => registerControlsPortal(null);
  }, [controls, registerControlsPortal]);

  const handleCellPress = (cell: Cell) => {
    if (!runningRef.current || phaseRef.current !== "playing") return;
    const index = targetIndexRef.current;
    const order = sequence.indexOf(cell.value);
    if (order < index) return;
    if (cell.value !== sequence[index]) {
      window.clearTimeout(mistakeTimerRef.current ?? undefined);
      errorsRef.current += 1;
      setErrors(errorsRef.current);
      setMistakeValue(cell.value);
      mistakeTimerRef.current = window.setTimeout(() => setMistakeValue(null), 220);
      return;
    }
    targetIndexRef.current = index + 1;
    setTargetIndex(index + 1);
    if (index + 1 !== sequence.length) return;

    const timeMs = Math.max(0, Math.round(performance.now() - startTimeRef.current));
    clearTimers();
    setElapsedMs(timeMs);
    const nextResults = [...resultsRef.current, { board: resultsRef.current.length + 1, timeMs, errors: errorsRef.current }];
    resultsRef.current = nextResults;
    setResults(nextResults);
    if (nextResults.length < sessionBoardCount) {
      setRoundNumber(nextResults.length + 1);
      startCountdown();
    } else {
      runningRef.current = false;
      updatePhase("finished");
      onTimeout();
    }
  };

  const gridStyle = { "--rows": grid.rows, "--cols": grid.cols } as CSSProperties;

  return (
    <div className={styles.container} data-schulte data-phase={phase} data-round={roundNumber}>
      <div className={styles.pageHeader}>
        <h2>{title}</h2>
        <button className={styles.explanationBtn} type="button" disabled={running} onClick={() => setExplanationOpen(true)}>Explicación</button>
      </div>
      {phase !== "finished" && <p className={styles.helperText}>
        Pulsa «Arranque» para jugar a pantalla completa. {continuous && `Completa ${sessionBoardCount} tableros seguidos, con 3 segundos entre ellos. `}
        La cruceta o Escape cancelan la {continuous ? "sesión" : "partida"}.
      </p>}
      {phase === "finished" && (
        <section className={styles.results} aria-label="Resultados de la sesión" aria-live="polite">
          <h3>{continuous ? "Sesión completada" : "Tablero completado"}</h3>
          <table>
            <caption>Tiempos de juego y errores por tablero</caption>
            <thead><tr><th scope="col">Tablero</th><th scope="col">Tiempo</th><th scope="col">Errores</th></tr></thead>
            <tbody>{results.map((result) => <tr key={result.board}>
              <th scope="row">{result.board}</th><td data-time-ms={result.timeMs}>{formatElapsed(result.timeMs)}</td><td>{result.errors}</td>
            </tr>)}</tbody>
            <tfoot><tr><th scope="row">Media</th><td data-average-time-ms={average.timeMs}>{formatElapsed(average.timeMs)}</td>
              <td>{average.errors.toLocaleString("es-ES", { maximumFractionDigits: 2 })}</td></tr></tfoot>
          </table>
          <p className={styles.helperText}>La cuenta atrás no se incluye en los tiempos. Pulsa «Arranque» para repetir.</p>
        </section>
      )}

      {createPortal(
        <dialog ref={dialogRef} className={styles.fullscreen} aria-label={title}
          onCancel={(event) => { event.preventDefault(); cancelGame(); }}
          onKeyDown={(event) => { if (event.code === "Space" && !(event.target instanceof HTMLButtonElement)) event.preventDefault(); }}>
          <div className={styles.session}>
            <header className={styles.sessionHeader}>
              <h2>{title}{continuous && <span> · {roundNumber}/{sessionBoardCount}</span>}</h2>
              <button type="button" className={styles.closeButton} aria-label="Cancelar partida" onClick={cancelGame}>×</button>
            </header>
            <div className={styles.topBar}>
              <div className={styles.targetBox} role="status">
                <span className={styles.targetLabel}>{phase === "countdown" ? "Empieza en" : "Busca"}</span>
                <span className={styles.targetValue}>{phase === "countdown" ? countdown : sequence[targetIndex] ?? "—"}</span>
              </div>
              <div className={styles.badges}>
                <span className={styles.badge}>Tiempo: {formatElapsed(elapsedMs)}</span>
                <span className={styles.badge}>Errores: {errors}</span>
                <span className={styles.badge}>Progreso: {targetIndex}/{totalCells}</span>
              </div>
            </div>
            <div className={styles.board}>
              {phase === "countdown" && <div className={styles.countdownPanel}>
                <p className={styles.helperText}>{roundNumber > 1 ? "Siguiente tablero" : "Prepárate para empezar"}</p>
                <span className={styles.countdownNumber} aria-hidden="true">{countdown}</span>
              </div>}
              {phase === "playing" && <div className={styles.grid} style={gridStyle}>
                {cells.map((cell) => <button key={cell.id} type="button" className={styles.cell}
                  disabled={sequence.indexOf(cell.value) < targetIndex} data-wrong={mistakeValue === cell.value}
                  onClick={() => handleCellPress(cell)} aria-label={`Elemento ${cell.value}`}>{cell.value}</button>)}
              </div>}
            </div>
          </div>
        </dialog>, document.body,
      )}

      <Modal open={explanationOpen} title={title} onClose={() => setExplanationOpen(false)}>
        <ul>
          <li>Encuentra y pulsa los elementos en orden: números, letras o 1, A, 2, B…</li>
          <li>Cuando aciertas, la casilla queda deshabilitada y el objetivo avanza.</li>
          <li>Cada pulsación en un elemento incorrecto cuenta como un error.</li>
          <li>La partida se abre a pantalla completa y bloquea el scroll. La cruceta o Escape cancelan el juego.</li>
          {continuous && <li>Elige de 1 a 15 tableros. Entre tableros hay 3 segundos de cuenta atrás. Al terminar verás los tiempos y errores de cada tablero y sus medias.</li>}
        </ul>
      </Modal>
    </div>
  );
}
