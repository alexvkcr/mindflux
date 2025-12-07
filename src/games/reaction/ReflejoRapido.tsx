import { useEffect, useMemo, useState } from "react";
import { CountdownSemaphore } from "./components/CountdownSemaphore";
import { useReactionSequence } from "./hooks/useReactionSequence";
import styles from "./ReactionGame.module.scss";
import circleStyles from "./ReflejoRapido.module.scss";
import { Modal } from "../../components/ui/Modal";

interface ReflejoRapidoProps {
  running: boolean;
  boardW: number;
  boardH: number;
  onTimeout: () => void;
}

const WAIT_RANGE_MS: [number, number] = [1000, 5000];

export function ReflejoRapido({ running, onTimeout }: ReflejoRapidoProps) {
  const [explanationOpen, setExplanationOpen] = useState(false);
  const [stimulusVisible, setStimulusVisible] = useState(false);

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
    onStimulus: () => setStimulusVisible(true),
    onFinished: () => onTimeout()
  });

  useEffect(() => {
    if (phase !== "stimulus") {
      setStimulusVisible(false);
    }
  }, [phase]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isZeroKey = event.code === "Digit0" || event.code === "Numpad0";
      if (!isZeroKey) {
        return;
      }
      if (!awaitingResponse || phase !== "stimulus" || explanationOpen) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) {
        event.stopImmediatePropagation();
      }
      setStimulusVisible(false);
      registerResponse({ success: true, label: "Correcto" });
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [awaitingResponse, explanationOpen, phase, registerResponse]);

  const progressLabel = attempt > 0 ? `Intento ${Math.min(attempt, totalAttempts)}/${totalAttempts}` : `Listo para ${totalAttempts} intentos`;

  const feedbackClass = lastResult
    ? lastResult.success
      ? styles.feedbackOk
      : styles.feedbackFail
    : styles.helperText;

  const feedbackText = useMemo(() => {
    if (!lastResult) {
      return "Ve viendo tus tiempos entre intentos";
    }
    const base = `Tiempo de reaccion: ${lastResult.timeMs} ms`;
    if (lastResult.success) {
      return base;
    }
    return `${base} (timeout)`;
  }, [lastResult]);

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <div className={styles.badges}>
          <span className={styles.badge}>{progressLabel}</span>
          <span className={styles.badge}>Limite: 2000 ms</span>
        </div>
        <button className={styles.explanationBtn} type="button" onClick={() => setExplanationOpen(true)}>
          Explicacion
        </button>
      </div>

      <p className={styles.instructions}>Espera al semaforo, observa el circulo y pulsa la tecla 0 (fila superior o teclado numerico) tan rapido como puedas.</p>

      <CountdownSemaphore stage={countdownStage} />

      <p className={`${styles.feedback} ${feedbackClass}`}>{feedbackText}</p>

      <div className={styles.board}>
        {stimulusVisible && <div className={circleStyles.circle} />}
        {!running && phase === "idle" && (
          <p className={styles.helperText}>Pulsa "Arranque" para comenzar.</p>
        )}
      </div>

      {summary && (
        <div className={styles.summary}>Tiempo de reaccion medio: {summary.averageMs} ms</div>
      )}

      <Modal open={explanationOpen} title="Reflejo Rapido" onClose={() => setExplanationOpen(false)}>
        <ul>
          <li>Cada intento inicia con un semaforo de 3 segundos seguido de una espera aleatoria de 1 a 5 segundos.</li>
          <li>Cuando aparezca el circulo, presiona la tecla 0 (arriba o en el teclado numerico) de inmediato.</li>
          <li>Dispones de 2 segundos por intento; si no respondes se registran 2000 ms como penalizacion.</li>
          <li>Completa los 10 intentos para conocer tu tiempo medio de reaccion.</li>
        </ul>
      </Modal>
    </div>
  );
}
