import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./MathGame.module.scss";
import controlStyles from "../reaction/ReactionControls.module.scss";
import { BETWEEN_BLOCK_COUNTDOWN_SECONDS, BLOCK_SIZE_OPTIONS, START_COUNTDOWN_SECONDS, SPEED_LEVELS, levelToIntervalMs } from "./utils";
import { useRegisterControlsPortal } from "../../contexts/controlsPortal";
import { MathProgressBar } from "./components/MathProgressBar";
import { Modal } from "../../components/ui/Modal";
import { cardTransform, NO_DISTORTION, randomCardDistortion } from "./cardDistortions";
import type { CardDistortion, DistortionOptions } from "./cardDistortions";

function PracticeCard({ card, distortion }: { card: string; distortion: CardDistortion }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = stageRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setStage({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const width = Math.max(1, Math.min(250, stage.width, stage.height / 1.4));
  const height = width * 1.4;
  return (
    <div ref={stageRef} className={styles.cardStage}>
      <img
        key={card}
        className={styles.realCardImage}
        src={getCardImageSrc(card)}
        alt={`Carta ${card}`}
        style={{
          width, height, marginLeft: -width / 2, marginTop: -height / 2,
          visibility: stage.width > 0 ? "visible" : "hidden",
          transform: cardTransform(distortion, width, height, stage.width, stage.height)
        }}
      />
    </div>
  );
}

interface MathGameProps {
  running: boolean;
  boardW: number;
  boardH: number;
  onTimeout: () => void;
}

type Phase = "idle" | "countdown" | "show" | "answer" | "cooldown" | "ended";

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
const SUIT_IMAGE_NAMES: Record<string, string> = {
  "\u2660": "spades",
  "\u2665": "hearts",
  "\u2666": "diamonds",
  "\u2663": "clubs"
};

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

interface ConteoHiLoProps extends MathGameProps {
  useCardImages?: boolean;
}

function getCardImageSrc(card: string): string {
  const rank = card.slice(0, card.length - 1);
  const suit = card.at(-1);
  return `${import.meta.env.BASE_URL}assets/cards-real/${rank}-${SUIT_IMAGE_NAMES[suit ?? ""]}.png`;
}

export function ConteoHiLo({ running, onTimeout, useCardImages = false }: ConteoHiLoProps) {
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
  const [distortions, setDistortions] = useState<DistortionOptions>({ size: "normal", rotation: "normal", perspective: "none" });
  const [cardDistortion, setCardDistortion] = useState<CardDistortion>(NO_DISTORTION);

  const countRef = useRef(0);
  const shoeRef = useRef<string[]>([]);
  const shoeIndexRef = useRef(0);
  const blockIndexRef = useRef(0);
  const timersRef = useRef<number[]>([]);
  const runningRef = useRef(false);
  const prevRunningRef = useRef(false);

  const registerControlsPortal = useRegisterControlsPortal();

  const intervalMs = useMemo(() => levelToIntervalMs(speedLevel), [speedLevel]);
  const controlsDisabled = running || phase === "countdown" || phase === "show" || phase === "answer" || phase === "cooldown";

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
      setCardDistortion(useCardImages ? randomCardDistortion(distortions) : NO_DISTORTION);
      setBarKey((prev) => prev + 1);
      scheduleTimeout(playNext, intervalMs);
    };

    playNext();
  }, [blockSize, clearTimers, drawCard, intervalMs, scheduleTimeout, distortions, useCardImages]);

  const startBlockAfterCountdown = useCallback(
    (nextPhase: "countdown" | "cooldown", seconds: number) => {
      clearTimers();
      setPhase(nextPhase);
      setCurrentCard(null);
      setCooldown(seconds);

      let remaining = seconds;
      const tick = () => {
        if (!runningRef.current) {
          return;
        }
        remaining -= 1;
        if (remaining <= 0) {
          setCooldown(0);
          startBlock();
          return;
        }
        setCooldown(remaining);
        scheduleTimeout(tick, 1000);
      };

      scheduleTimeout(tick, 1000);
    },
    [clearTimers, scheduleTimeout, startBlock]
  );

  const startGame = useCallback(() => {
    countRef.current = 0;
    buildShoe();
    setFeedback("");
    setInputValue("");
    setValuesShown(0);
    blockIndexRef.current = 0;
    startBlockAfterCountdown("countdown", START_COUNTDOWN_SECONDS);
  }, [buildShoe, startBlockAfterCountdown]);

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
            {SPEED_LEVELS.map((level) => (
              <option key={level} value={level}>
                Nivel {level}
              </option>
            ))}
          </select>
        </label>
        {useCardImages && (
          <fieldset className={styles.distortionControls} disabled={controlsDisabled}>
            <legend>Distorsiones (combinables)</legend>
            <label>
              Tamaño
              <select value={distortions.size} onChange={(e) => {
                const size = e.target.value as DistortionOptions["size"];
                setDistortions((previous) => ({ ...previous, size }));
              }}>
                <option value="normal">Normal</option>
                <option value="half">50%</option>
                <option value="random">Aleatorio (50–100%)</option>
              </select>
            </label>
            <label>
              Rotación
              <select value={distortions.rotation} onChange={(e) => {
                const rotation = e.target.value as DistortionOptions["rotation"];
                setDistortions((previous) => ({ ...previous, rotation }));
              }}>
                <option value="normal">Normal</option>
                <option value="horizontal">Horizontal (90°)</option>
                <option value="upsideDown">Boca abajo (180°)</option>
                <option value="horizontalOrUpsideDown">Horizontal / boca abajo</option>
                <option value="random">Aleatoria (hasta 180°)</option>
              </select>
            </label>
            <label>
              Perspectiva
              <select value={distortions.perspective} onChange={(e) => {
                const perspective = e.target.value as DistortionOptions["perspective"];
                setDistortions((previous) => ({ ...previous, perspective }));
              }}>
                <option value="none">Sin perspectiva</option>
                <option value="horizontal">Horizontal (80%)</option>
                <option value="vertical">Vertical (80%)</option>
                <option value="both">Ambos ejes (80%)</option>
                <option value="random">Aleatoria (hasta 80%)</option>
              </select>
            </label>
          </fieldset>
        )}
      </div>
    );

    return () => registerControlsPortal(null);
  }, [blockSize, controlsDisabled, intervalMs, registerControlsPortal, shoeSize, speedLevel, distortions, useCardImages]);

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
    startBlockAfterCountdown("cooldown", BETWEEN_BLOCK_COUNTDOWN_SECONDS);
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

        {phase === "countdown" && (
          <div className={styles.countdownPanel} aria-live="polite">
            <p className={styles.cooldown}>Comenzando en</p>
            <span className={styles.countdownNumber}>{cooldown}</span>
          </div>
        )}

        {phase === "show" && (
          <div>
            <div className={styles.cardDisplay} aria-live="polite">
              {useCardImages && currentCard ? (
                <PracticeCard card={currentCard} distortion={cardDistortion} />
              ) : (
                currentCard
              )}
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

      <Modal open={explanationOpen} title={useCardImages ? "Conteo Hi-Lo con cartas reales" : "Conteo de Cartas Hi-Lo"} onClose={() => setExplanationOpen(false)}>
        <ul>
          <li>Veras cartas de poker de uno o varios mazos.</li>
          <li>Cada carta aporta +1 (2-6), 0 (7-9) o -1 (10, figuras y As). Lleva la cuenta mentalmente.</li>
          <li>Cada bloque solicitara tu conteo. Usa los botones para continuar o terminar.</li>
          <li>Puedes ajustar el numero de mazos, el tamano del bloque y la velocidad antes de iniciar.</li>
          {useCardImages && <>
            <li>Puedes combinar los modos de tamaño, rotación y perspectiva. Los modos fijos se aplican a todas las cartas; los aleatorios cambian con cada carta.</li>
            <li>Horizontal / boca abajo elige entre 90°, 180° y 270°. La perspectiva en ambos ejes reparte la distorsión entre X e Y, con un máximo total del 80%.</li>
          </>}
        </ul>
      </Modal>
    </div>
  );
}

export function ConteoHiLoConCartas(props: MathGameProps) {
  return <ConteoHiLo {...props} useCardImages />;
}
