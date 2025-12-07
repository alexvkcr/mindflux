import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./MathGame.module.scss";
import controlStyles from "../reaction/ReactionControls.module.scss";
import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { Modal } from "../../components/ui/Modal";
import { useRegisterControlsPortal } from "../../contexts/ControlsPortalContext";
import { levelToCount, levelToIntervalMs } from "./utils";
import { MathProgressBar } from "./components/MathProgressBar";

interface MathGameProps {
  running: boolean;
  boardW: number;
  boardH: number;
  onTimeout: () => void;
}

type Stage = "idle" | "show" | "input" | "result";

export function SumaCadena({ running, onTimeout }: MathGameProps) {
  const [quantityLevel, setQuantityLevel] = useState(3);
  const [speedLevel, setSpeedLevel] = useState(3);
  const [stage, setStage] = useState<Stage>("idle");
  const [currentDigit, setCurrentDigit] = useState<number | null>(null);
  const [digitsShown, setDigitsShown] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [feedback, setFeedback] = useState<{ text: string; ok: boolean | null }>({ text: "", ok: null });
  const [explanationOpen, setExplanationOpen] = useState(false);
  const [barKey, setBarKey] = useState(0);

  const timerRef = useRef<number | null>(null);
  const totalRef = useRef(0);
  const stageRef = useRef<Stage>("idle");

  const registerControlsPortal = useRegisterControlsPortal();

  const digitsCount = useMemo(() => levelToCount(quantityLevel), [quantityLevel]);
  const intervalMs = useMemo(() => levelToIntervalMs(speedLevel), [speedLevel]);
  const disableControls = stage === "show" || stage === "input" || running;

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const resetGame = useCallback(() => {
    clearTimer();
    setStage("idle");
    setCurrentDigit(null);
    setDigitsShown(0);
    setUserAnswer("");
    setFeedback({ text: "", ok: null });
    setBarKey(0);
  }, []);

  const runSequence = useCallback(
    (digits: number[]) => {
      if (!digits.length) {
        return;
      }
      setStage("show");
      setDigitsShown(0);
      let idx = 0;
      const tick = () => {
        setCurrentDigit(digits[idx]);
        setDigitsShown(idx + 1);
        setBarKey((prev) => prev + 1);
        timerRef.current = window.setTimeout(() => {
          idx += 1;
          if (idx < digits.length) {
            tick();
          } else {
            setCurrentDigit(null);
            setDigitsShown(digits.length);
            setStage("input");
          }
        }, intervalMs);
      };
      tick();
    },
    [intervalMs]
  );

  const startRound = useCallback(() => {
    clearTimer();
    setFeedback({ text: "", ok: null });
    setUserAnswer("");
    setDigitsShown(0);
    const nextSequence = Array.from({ length: digitsCount }, () => Math.floor(Math.random() * 10));
    totalRef.current = nextSequence.reduce((sum, digit) => sum + digit, 0);
    runSequence(nextSequence);
  }, [digitsCount, runSequence]);

  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  useEffect(() => {
    if (running) {
      resetGame();
      startRound();
    } else if (stageRef.current !== "result") {
      resetGame();
    }
  }, [resetGame, running, startRound]);

  useEffect(() => {
    registerControlsPortal(
      <div className={controlStyles.panel}>
        <label className={controlStyles.control}>
          <span className={controlStyles.label}>Cantidad de numeros: {digitsCount}</span>
          <select value={quantityLevel} disabled={disableControls} onChange={(e) => setQuantityLevel(Number(e.target.value))}>
            {Array.from({ length: 9 }, (_, idx) => idx + 1).map((level) => (
              <option key={level} value={level}>
                Nivel {level}
              </option>
            ))}
          </select>
        </label>
        <label className={controlStyles.control}>
          <span className={controlStyles.label}>Velocidad (ms): {intervalMs} ms</span>
          <select value={speedLevel} disabled={disableControls} onChange={(e) => setSpeedLevel(Number(e.target.value))}>
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
  }, [digitsCount, disableControls, intervalMs, quantityLevel, registerControlsPortal, speedLevel]);

  useEffect(() => () => {
    clearTimer();
    registerControlsPortal(null);
  }, [registerControlsPortal]);

  useEffect(() => {
    if (stage === "result") {
      onTimeout();
    }
  }, [onTimeout, stage]);

  const handleValidate = () => {
    const guess = Number(userAnswer.trim());
    if (Number.isNaN(guess)) {
      setFeedback({ text: "Introduce una respuesta numerica.", ok: null });
      return;
    }
    const correct = totalRef.current;
    const success = guess === correct;
    setFeedback({
      text: success
        ? `Correcto. La suma era ${correct}.`
        : `Incorrecto. Tu respuesta: ${guess}. La suma correcta era ${correct}.`,
      ok: success
    });
    setStage("result");
  };

  const displayDigit = currentDigit ?? "";

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <div className={styles.badges}>
          <span className={styles.badge}>Numeros: {digitsCount}</span>
          <span className={styles.badge}>Intervalo: {intervalMs} ms</span>
          <span className={styles.badge}>Progreso: {digitsShown}/{digitsCount}</span>
        </div>
        <button className={styles.explanationBtn} type="button" onClick={() => setExplanationOpen(true)}>
          Explicacion
        </button>
      </div>

      <p className={styles.instructions}>Observa cada digito y suma mentalmente. Al final escribe el resultado total.</p>

      <div className={styles.board}>
        {stage === "show" && (
          <div>
            <div className={styles.digitDisplay} aria-live="polite">
              {displayDigit}
            </div>
            {currentDigit !== null && <MathProgressBar duration={intervalMs} runKey={barKey} />}
          </div>
        )}

        {stage === "input" && (
          <div className={styles.inputRow}>
            <input
              type="number"
              inputMode="numeric"
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              placeholder="Introduce la suma"
            />
            <div className={styles.validateRow}>
              <PrimaryButton onClick={handleValidate}>Validar</PrimaryButton>
            </div>
          </div>
        )}

        {stage === "result" && (
          <p className={feedback.ok === null ? styles.feedbackNeutral : feedback.ok ? styles.feedbackOk : styles.feedbackFail}>
            {feedback.text}
          </p>
        )}

        {stage === "idle" && <p className={styles.helperText}>Pulsa "Arranque" para comenzar una nueva cadena.</p>}
      </div>

      <Modal open={explanationOpen} title="Suma en Cadena" onClose={() => setExplanationOpen(false)}>
        <ul>
          <li>Veras una secuencia de digitos (0-9) uno tras otro en el mismo punto.</li>
          <li>Al finalizar introduce la suma total en el campo y pulsa "Validar".</li>
          <li>Configura cuantas cifras apareceran y la velocidad entre ellas antes de comenzar.</li>
        </ul>
      </Modal>
    </div>
  );
}
