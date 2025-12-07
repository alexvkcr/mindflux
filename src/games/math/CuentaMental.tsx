import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./MathGame.module.scss";
import controlStyles from "../reaction/ReactionControls.module.scss";
import { BLOCK_SIZE_OPTIONS, levelToIntervalMs } from "./utils";
import { useRegisterControlsPortal } from "../../contexts/ControlsPortalContext";
import { MathProgressBar } from "./components/MathProgressBar";
import { Modal } from "../../components/ui/Modal";

interface MathGameProps {
  running: boolean;
  boardW: number;
  boardH: number;
  onTimeout: () => void;
}

type Phase = "idle" | "show" | "answer" | "cooldown" | "ended";


export function CuentaMental({ running, onTimeout }: MathGameProps) {
  const [blockSize, setBlockSize] = useState(BLOCK_SIZE_OPTIONS[1]);
  const [speedLevel, setSpeedLevel] = useState(5);
  const [phase, setPhase] = useState<Phase>("idle");
  const [currentValue, setCurrentValue] = useState<number | null>(null);
  const [valuesShown, setValuesShown] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [feedback, setFeedback] = useState<string>("");
  const [barKey, setBarKey] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [explanationOpen, setExplanationOpen] = useState(false);

  const accumulatorRef = useRef(0);
  const blockIndexRef = useRef(0);
  const timersRef = useRef<number[]>([]);
  const runningRef = useRef(false);
  const awaitingAnswerRef = useRef(false);
  const prevRunningRef = useRef(false);

  const registerControlsPortal = useRegisterControlsPortal();

  const intervalMs = useMemo(() => levelToIntervalMs(speedLevel), [speedLevel]);
  const controlsDisabled = running || phase === "show" || phase === "answer" || phase === "cooldown";

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  const resetState = useCallback(() => {
    clearTimers();
    setPhase("idle");
    setCurrentValue(null);
    setValuesShown(0);
    setInputValue("");
    setFeedback("");
    setCooldown(0);
    blockIndexRef.current = 0;
    awaitingAnswerRef.current = false;
  }, [clearTimers]);

  const scheduleTimeout = useCallback((fn: () => void, delay: number) => {
    const id = window.setTimeout(fn, delay);
    timersRef.current.push(id);
  }, []);

  const startBlock = useCallback(() => {
    clearTimers();
    blockIndexRef.current = 0;
    setValuesShown(0);
    setPhase("show");
    setInputValue("");
    setFeedback("");
    awaitingAnswerRef.current = false;
    const playNext = () => {
      if (!runningRef.current || awaitingAnswerRef.current) {
        return;
      }
      if (blockIndexRef.current >= blockSize) {
        awaitingAnswerRef.current = true;
        setPhase("answer");
        setCurrentValue(null);
        return;
      }
      const choices = [-1, 0, 1] as const;
      const value = choices[Math.floor(Math.random() * choices.length)];
      accumulatorRef.current += value;
      blockIndexRef.current += 1;
      setValuesShown(blockIndexRef.current);
      setCurrentValue(value);
      setBarKey((prev) => prev + 1);
      scheduleTimeout(playNext, intervalMs);
    };
    playNext();
  }, [blockSize, intervalMs, scheduleTimeout, clearTimers]);

  const startGame = useCallback(() => {
    accumulatorRef.current = 0;
    setFeedback("");
    startBlock();
  }, [startBlock]);

  const finishGame = useCallback(() => {
    clearTimers();
    setPhase("ended");
    setCurrentValue(null);
    onTimeout();
  }, [clearTimers, onTimeout]);

  useEffect(() => {
    runningRef.current = running;
    if (running && !prevRunningRef.current) {
      startGame();
    }
    if (!running && phase !== "ended") {
      resetState();
    }
    prevRunningRef.current = running;
  }, [phase, resetState, running, startGame]);

  useEffect(() => {
    registerControlsPortal(
      <div className={controlStyles.panel}>
        <label className={controlStyles.control}>
          <span className={controlStyles.label}>Longitud de bloque: {blockSize}</span>
          <select value={blockSize} disabled={controlsDisabled} onChange={(e) => setBlockSize(Number(e.target.value))}>
            {BLOCK_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option} numeros
              </option>
            ))}
          </select>
        </label>
        <label className={controlStyles.control}>
          <span className={controlStyles.label}>Velocidad (ms): {intervalMs}</span>
          <select value={speedLevel} disabled={controlsDisabled} onChange={(e) => setSpeedLevel(Number(e.target.value))}>
            {Array.from({ length: 9 }, (_, idx) => idx + 1).map((level) => (
              <option key={level} value={level}>
                Nivel {level}
              </option>
            ))}
          </select>
        </label>
      </div>
    );

    return () => {
      registerControlsPortal(null);
    };
  }, [blockSize, controlsDisabled, intervalMs, registerControlsPortal, speedLevel]);

  useEffect(() => () => {
    clearTimers();
    registerControlsPortal(null);
  }, [clearTimers, registerControlsPortal]);

  const handleGiveUp = () => {
    setFeedback(`La cuenta correcta era ${accumulatorRef.current}.`);
    finishGame();
  };

  const evaluateAnswer = (): number | null => {
    const guess = Number(inputValue.trim());
    if (Number.isNaN(guess)) {
      setFeedback("Introduce un numero valido para continuar.");
      return null;
    }
    const correct = accumulatorRef.current;
    const success = guess === correct;
    setFeedback(
      success
        ? `Correcto. Cuenta acumulada: ${correct}.`
        : `Incorrecto. Tu respuesta: ${guess}. Cuenta correcta: ${correct}.`
    );
    return guess;
  };

  const handleFinish = () => {
    const guess = evaluateAnswer();
    if (guess === null) {
      return;
    }
    finishGame();
  };

  const handleContinue = () => {
    const guess = evaluateAnswer();
    if (guess === null) {
      return;
    }
    setPhase("cooldown");
    setCooldown(5);
    const countdown = () => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearTimers();
          startBlock();
          return 0;
        }
        const next = prev - 1;
        const id = window.setTimeout(countdown, 1000);
        timersRef.current.push(id);
        return next;
      });
    };
    const id = window.setTimeout(countdown, 1000);
    timersRef.current.push(id);
  };

  const showProgressBar = phase === "show" && currentValue !== null;

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <div className={styles.badges}>
          <span className={styles.badge}>Bloque: {blockSize} numeros</span>
          <span className={styles.badge}>Intervalo: {intervalMs} ms</span>
          <span className={styles.badge}>Progreso: {valuesShown}/{blockSize}</span>
        </div>
        <button className={styles.explanationBtn} type="button" onClick={() => setExplanationOpen(true)}>
          Explicacion
        </button>
      </div>

      <p className={styles.instructions}>Suma mentalmente los valores -1, 0, 1. Tras cada bloque indica la cuenta acumulada.</p>

      <div className={styles.board}>
        {phase === "idle" && <p className={styles.helperText}>Pulsa "Arranque" para comenzar a contar.</p>}

        {phase === "show" && (
          <div>
            <div className={styles.numberDisplay} aria-live="polite">
              {currentValue !== null ? (currentValue > 0 ? `+${currentValue}` : currentValue) : ""}
            </div>
            <p className={styles.countInfo}>
              Numero {valuesShown} / {blockSize}
            </p>
            {showProgressBar && <MathProgressBar duration={intervalMs} runKey={barKey} />}
          </div>
        )}

        {phase === "answer" && (
          <div className={styles.inputRow}>
            <input
              type="number"
              inputMode="numeric"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Cuenta acumulada"
            />
            <div className={styles.responseButtons}>
              <button type="button" onClick={handleGiveUp}>No lo se</button>
              <button type="button" onClick={handleContinue}>Lo se y quiero continuar</button>
              <button type="button" onClick={handleFinish}>Lo se pero quiero terminar</button>
            </div>
          </div>
        )}

        {phase === "cooldown" && <p className={styles.cooldown}>Reanudando en {cooldown}...</p>}

        {feedback && <p className={styles.helperText}>{feedback}</p>}
      </div>

      <Modal open={explanationOpen} title="Cuenta Mental 1-0-(-1)" onClose={() => setExplanationOpen(false)}>
        <ul>
          <li>Apareceran numeros -1, 0 o 1. Lleva la cuenta mental de la suma acumulada.</li>
          <li>Cada bloque de {blockSize} apariciones te pedira ingresar tu resultado.</li>
          <li>Botones: "No lo se" muestra la respuesta y termina; "Lo se y quiero continuar" valida y sigue tras 5 segundos; "Lo se pero quiero terminar" valida y finaliza.</li>
          <li>Configura el tamano del bloque y la velocidad de aparicion antes de comenzar.</li>
        </ul>
      </Modal>
    </div>
  );
}
