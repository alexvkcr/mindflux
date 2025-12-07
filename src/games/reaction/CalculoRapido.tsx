import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CountdownSemaphore } from "./components/CountdownSemaphore";
import { useReactionSequence } from "./hooks/useReactionSequence";
import { usePausableTimeout } from "./hooks/usePausableTimeout";
import styles from "./ReactionGame.module.scss";
import calcStyles from "./CalculoRapido.module.scss";
import { Modal } from "../../components/ui/Modal";
import { useRegisterControlsPortal } from "../../contexts/ControlsPortalContext";
import controlStyles from "./ReactionControls.module.scss";

interface CalculoRapidoProps {
  running: boolean;
  boardW: number;
  boardH: number;
  onTimeout: () => void;
}

const LEVEL_MIN = 1;
const LEVEL_MAX = 9;
const WAIT_RANGE_MS: [number, number] = [1000, 5000];
const MAX_EXPOSURE_MS = 2000;
const MIN_EXPOSURE_MS = 250;

function clampLevel(value: number) {

  return Math.min(LEVEL_MAX, Math.max(LEVEL_MIN, value));

}



function mapDistanceToGap(level: number) {
  const clamped = clampLevel(level);
  const MIN_PERCENT = 5;
  const MAX_PERCENT = 90;
  return MIN_PERCENT + ((clamped - 1) / (LEVEL_MAX - 1)) * (MAX_PERCENT - MIN_PERCENT);
}

function mapExposure(level: number) {

  const t = (clampLevel(level) - 1) / (LEVEL_MAX - 1);

  return Math.round(MAX_EXPOSURE_MS - t * (MAX_EXPOSURE_MS - MIN_EXPOSURE_MS));

}



export function CalculoRapido({ running, onTimeout }: CalculoRapidoProps) {
  const [explanationOpen, setExplanationOpen] = useState(false);
  const [distanceLevel, setDistanceLevel] = useState(5);
  const [exposureLevel, setExposureLevel] = useState(5);
  const [digits, setDigits] = useState<{ left: number; right: number } | null>(null);
  const [digitsHidden, setDigitsHidden] = useState(true);
  const registerControlsPortal = useRegisterControlsPortal();
  const awaitingRef = useRef(false);
  const { start: startExposureTimer, cancel: cancelExposureTimer } = usePausableTimeout(explanationOpen);

  const handleStimulus = useCallback(() => {
    const left = Math.floor(Math.random() * 10);
    const right = Math.floor(Math.random() * 10);
    setDigits({ left, right });
    setDigitsHidden(false);
  }, []);

  const {
    attempt,
    totalAttempts,
    phase,
    countdownStage,
    lastResult,
    summary,
    awaitingResponse,
    registerResponse
  } = useReactionSequence({
    running,
    paused: explanationOpen,
    waitRangeMs: WAIT_RANGE_MS,
    onStimulus: handleStimulus,
    onFinished: () => onTimeout()
  });

  useEffect(() => {
    awaitingRef.current = awaitingResponse;
  }, [awaitingResponse]);

  useEffect(() => {
    if (phase !== "stimulus") {
      cancelExposureTimer();
      setDigitsHidden(true);
      return;
    }
    const exposureMs = mapExposure(exposureLevel);
    startExposureTimer(() => {
      setDigitsHidden(true);
    }, exposureMs);
  }, [cancelExposureTimer, exposureLevel, phase, startExposureTimer]);

  useEffect(() => cancelExposureTimer, [cancelExposureTimer]);

  useEffect(() => {
    registerControlsPortal(
      <div className={controlStyles.panel}>
        <label className={controlStyles.control}>
          <span className={controlStyles.label}>Distancia entre numeros: {distanceLevel}</span>
          <input
            type="range"
            min={LEVEL_MIN}
            max={LEVEL_MAX}
            value={distanceLevel}
            disabled={running}
            onChange={(event) => setDistanceLevel(Number(event.target.value))}
          />
        </label>
        <label className={controlStyles.control}>
          <span className={controlStyles.label}>Tiempo de exposicion: {exposureLevel}</span>
          <input
            type="range"
            min={LEVEL_MIN}
            max={LEVEL_MAX}
            value={exposureLevel}
            disabled={running}
            onChange={(event) => setExposureLevel(Number(event.target.value))}
          />
        </label>
      </div>
    );

    return () => {
      registerControlsPortal(null);
    };
  }, [distanceLevel, exposureLevel, registerControlsPortal, running]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "KeyZ" && event.code !== "KeyX") {
        return;
      }
      if (!awaitingResponse || explanationOpen || phase !== "stimulus" || !digits) {
        return;
      }

      event.preventDefault();
      const sum = digits.left + digits.right;
      const isOdd = sum % 2 !== 0;
      const pressedOdd = event.code === "KeyZ";
      const isCorrect = (pressedOdd && isOdd) || (!pressedOdd && !isOdd);
      registerResponse({ success: isCorrect, label: isCorrect ? "Correcto" : "Incorrecto", timeMsOverride: isCorrect ? undefined : 2000 });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [awaitingResponse, digits, explanationOpen, phase, registerResponse]);

  const distanceGap = useMemo(() => mapDistanceToGap(distanceLevel), [distanceLevel]);

  const progressLabel = attempt > 0 ? `Intento ${Math.min(attempt, totalAttempts)}/${totalAttempts}` : `Listo para ${totalAttempts} intentos`;

  const feedbackText = useMemo(() => {
    if (!lastResult) {
      return "Veras el resultado del intento anterior aqui";
    }
    return `Tiempo: ${lastResult.timeMs} ms - ${lastResult.label}`;
  }, [lastResult]);

  const feedbackClass = lastResult
    ? lastResult.success
      ? styles.feedbackOk
      : styles.feedbackFail
    : styles.helperText;

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <div className={styles.badges}>
          <span className={styles.badge}>{progressLabel}</span>
          <span className={styles.badge}>Letras: Z impar / X par</span>
        </div>
        <button className={styles.explanationBtn} type="button" onClick={() => setExplanationOpen(true)}>
          Explicacion
        </button>
      </div>

      <p className={styles.instructions}>Etiqueta mentalmente la suma. Pulsa Z si es impar o X si es par antes de 2 segundos.</p>

      <CountdownSemaphore stage={countdownStage} />

      <p className={`${styles.feedback} ${feedbackClass}`}>{feedbackText}</p>

      <div className={styles.board}>
        {phase === "stimulus" && digits && !digitsHidden && (
          <div className={calcStyles.digitRow} style={{ columnGap: `${distanceGap}px` }}>
            <span className={calcStyles.digit}>{digits.left}</span>
            <span className={calcStyles.digit}>{digits.right}</span>
          </div>
        )}
        {phase === "stimulus" && digitsHidden && (
          <p className={styles.helperText}>Estimulo oculto, responde con Z/X antes de 2000 ms.</p>
        )}
        {phase !== "stimulus" && <p className={styles.helperText}>Espera a que aparezcan los numeros...</p>}
      </div>

      {summary && (
        <div className={styles.summary}>
          Tiempo medio: {summary.averageMs} ms - Aciertos: {summary.successCount}/{summary.attempts}
        </div>
      )}

      <Modal open={explanationOpen} title="Calculo Rapido" onClose={() => setExplanationOpen(false)}>
        <ul>
          <li>Tras el semaforo veras dos digitos del 0 al 9 con una separacion ajustable.</li>
          <li>Pulsa Z si la suma es impar o X si es par. Tienes un maximo de 2 segundos.</li>
          <li>El control de exposicion define cuantos milisegundos permanecen los numeros en pantalla.</li>
          <li>Si te equivocas o te quedas sin tiempo, el intento cuenta como 2000 ms. Completa 10 intentos para ver tu promedio.</li>
        </ul>
      </Modal>
    </div>
  );
}
