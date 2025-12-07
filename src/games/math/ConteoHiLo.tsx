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

const SHOE_OPTIONS = [
  { label: "1 mazo", value: 1 },
  { label: "2 mazos", value: 2 },
  { label: "3 mazos", value: 3 },
  { label: "4 mazos", value: 4 },
  { label: "5 mazos", value: 5 },
  { label: "6 mazos", value: 6 },
  { label: "7 mazos", value: 7 },
  { label: "8 mazos", value: 8 },
  { label: "9 mazos", value: 9 },
  { label: "Nivel 10 (18 mazos)", value: 18 }
];

const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUITS = ["2660", "2665", "2666", "2663"].map((code) => String.fromCodePoint(parseInt(code, 16)));

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getCardValue(rank: string): number {
  if (["2", "3", "4", "5", "6"].includes(rank)) {
    return 1;
  }
  if (["7", "8", "9"].includes(rank)) {
    return 0;
  }
  return -1;
}

export function ConteoHiLo({ running, onTimeout }: MathGameProps) {
  const [shoeSize, setShoeSize] = useState(SHOE_OPTIONS[0].value);
  const [blockSize, setBlockSize] = useState(BLOCK_SIZE_OPTIONS[1]);
  const [speedLevel, setSpeedLevel] = useState(5);
  const [phase, setPhase] = useState<Phase>("idle");
  const [currentCard, setCurrentCard] = useState<string | null>(null);
  const [valuesShown, setValuesShown] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [feedback, setFeedback] = useState("");
  const [barKey, setBarKey] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [explanationOpen, setExplanationOpen] = useState(false);

  const countRef = useRef(0);
  const shoeRef = useRef<string[]>([]);
  const shoeIndexRef = useRef(0);
  const blockIndexRef = useRef(0);
  const timersRef = useRef<number[]>([]);
  const runningRef = useRef(false);
  const prevRunningRef = useRef(false);

  const registerControlsPortal = useRegisterControlsPortal();

  const intervalMs = useMemo(() => levelToIntervalMs(speedLevel), [speedLevel]);
  const controlsDisabled = running || phase === "show" || phase === "answer" || phase === "cooldown";

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  const buildShoe = useCallback(() => {
    const deck: string[] = [];
    for (let rep = 0; rep < shoeSize; rep += 1) {
      for (const rank of RANKS) {
        for (const suit of SUITS) {
          deck.push(`${rank}${suit}`);
        }
      }
    }
    shoeRef.current = shuffle(deck);
    shoeIndexRef.current = 0;
  }, [shoeSize]);

  const resetState = useCallback(() => {
    clearTimers();
    setPhase("idle");
    setCurrentCard(null);
    setValuesShown(0);
    setInputValue("");
    setFeedback("");
    setCooldown(0);
    blockIndexRef.current = 0;
  }, [clearTimers]);

  const drawCard = useCallback(() => {
    if (!shoeRef.current.length) {
      buildShoe();
    }
    if (shoeIndexRef.current >= shoeRef.current.length) {
      shoeRef.current = shuffle(shoeRef.current);
      shoeIndexRef.current = 0;
    }
    const card = shoeRef.current[shoeIndexRef.current];
    shoeIndexRef.current += 1;
    return card;
  }, [buildShoe]);

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

    const playNext = () => {
      if (!runningRef.current) {
        return;
      }
      if (blockIndexRef.current >= blockSize) {
        setPhase("answer");
        setCurrentCard(null);
        return;
      }
      const card = drawCard();
      const rank = card.slice(0, card.length - 1);
      const value = getCardValue(rank);
      countRef.current += value;
      blockIndexRef.current += 1;
      setValuesShown(blockIndexRef.current);
      setCurrentCard(card);
      setBarKey((prev) => prev + 1);
      scheduleTimeout(playNext, intervalMs);
    };

    playNext();
  }, [blockSize, clearTimers, drawCard, intervalMs, scheduleTimeout]);

  const startGame = useCallback(() => {
    countRef.current = 0;
    buildShoe();
    setFeedback("");
    startBlock();
  }, [buildShoe, startBlock]);

  const finishGame = useCallback(() => {
    clearTimers();
    setPhase("ended");
    setCurrentCard(null);
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
    if (!running) {
      buildShoe();
    }
  }, [buildShoe, running, shoeSize]);

  useEffect(() => {
    registerControlsPortal(
      <div className={controlStyles.panel}>
        <label className={controlStyles.control}>
          <span className={controlStyles.label}>Numero de mazos: {shoeSize}</span>
          <select value={shoeSize} disabled={controlsDisabled} onChange={(e) => setShoeSize(Number(e.target.value))}>
            {SHOE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className={controlStyles.control}>
          <span className={controlStyles.label}>Bloque: {blockSize} cartas</span>
          <select value={blockSize} disabled={controlsDisabled} onChange={(e) => setBlockSize(Number(e.target.value))}>
            {BLOCK_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option} cartas
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

    return () => registerControlsPortal(null);
  }, [blockSize, controlsDisabled, intervalMs, registerControlsPortal, shoeSize, speedLevel]);

  useEffect(() => () => {
    clearTimers();
    registerControlsPortal(null);
  }, [clearTimers, registerControlsPortal]);

  const handleGiveUp = () => {
    setFeedback(`La cuenta correcta era ${countRef.current}.`);
    finishGame();
  };

  const evaluateAnswer = (): number | null => {
    const guess = Number(inputValue.trim());
    if (Number.isNaN(guess)) {
      setFeedback("Introduce un numero valido para continuar.");
      return null;
    }
    const correct = countRef.current;
    setFeedback(
      guess === correct
        ? `Correcto. Cuenta actual: ${correct}.`
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
    const tick = () => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearTimers();
          startBlock();
          return 0;
        }
        const next = prev - 1;
        const id = window.setTimeout(tick, 1000);
        timersRef.current.push(id);
        return next;
      });
    };
    const id = window.setTimeout(tick, 1000);
    timersRef.current.push(id);
  };

  const showProgressBar = phase === "show" && currentCard !== null;

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <div className={styles.badges}>
          <span className={styles.badge}>Mazos: {shoeSize}</span>
          <span className={styles.badge}>Bloque: {blockSize} cartas</span>
          <span className={styles.badge}>Intervalo: {intervalMs} ms</span>
        </div>
        <button className={styles.explanationBtn} type="button" onClick={() => setExplanationOpen(true)}>
          Explicacion
        </button>
      </div>

      <p className={styles.instructions}>Aplica el sistema Hi-Lo (+1,0,-1) y registra la cuenta en cada bloque.</p>

      <div className={styles.board}>
        {phase === "idle" && <p className={styles.helperText}>Pulsa "Arranque" para comenzar el conteo.</p>}

        {phase === "show" && (
          <div>
            <div className={styles.cardDisplay} aria-live="polite">
              {currentCard}
            </div>
            <p className={styles.countInfo}>
              Carta {valuesShown} / {blockSize}
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
              placeholder="Cuenta Hi-Lo"
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

      <Modal open={explanationOpen} title="Conteo de Cartas Hi-Lo" onClose={() => setExplanationOpen(false)}>
        <ul>
          <li>Veras cartas de poker de uno o varios mazos.</li>
          <li>Cada carta aporta +1 (2-6), 0 (7-9) o -1 (10, figuras y As). Lleva la cuenta mentalmente.</li>
          <li>Cada bloque solicitara tu conteo. Usa los botones para continuar o terminar.</li>
          <li>Puedes ajustar el numero de mazos, el tamano del bloque y la velocidad antes de iniciar.</li>
        </ul>
      </Modal>
    </div>
  );
}
