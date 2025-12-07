import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CountdownSemaphore } from "./components/CountdownSemaphore";
import { useReactionSequence } from "./hooks/useReactionSequence";
import { usePausableTimeout } from "./hooks/usePausableTimeout";
import styles from "./ReactionGame.module.scss";
import concordStyles from "./ConcordanciaGramatical.module.scss";
import { Modal } from "../../components/ui/Modal";
import { useRegisterControlsPortal } from "../../contexts/ControlsPortalContext";
import controlStyles from "./ReactionControls.module.scss";
import { ARTICLES, NOUNS, type GrammarCategory } from "./grammarData";

interface ConcordanciaGramaticalProps {
  running: boolean;
  boardW: number;
  boardH: number;
  onTimeout: () => void;
}

const LEVEL_MIN = 1;

const LEVEL_MAX = 9;

const WAIT_RANGE_MS: [number, number] = [1000, 5000];

const MAX_VISIBILITY_MS = 2000;

const MIN_VISIBILITY_MS = 250;



function clampLevel(value: number) {

  return Math.min(LEVEL_MAX, Math.max(LEVEL_MIN, value));

}



function mapDistanceToGap(level: number) {
  const clamped = clampLevel(level);
  const MIN_PERCENT = 5;
  const MAX_PERCENT = 90;
  return MIN_PERCENT + ((clamped - 1) / (LEVEL_MAX - 1)) * (MAX_PERCENT - MIN_PERCENT);
}

function mapVisibility(level: number) {

  const t = (clampLevel(level) - 1) / (LEVEL_MAX - 1);

  return Math.round(MAX_VISIBILITY_MS - t * (MAX_VISIBILITY_MS - MIN_VISIBILITY_MS));

}



export function ConcordanciaGramatical({ running, onTimeout }: ConcordanciaGramaticalProps) {
  const [explanationOpen, setExplanationOpen] = useState(false);
  const [distanceLevel, setDistanceLevel] = useState(5);
  const [visibilityLevel, setVisibilityLevel] = useState(5);
  const [pair, setPair] = useState<{
    article: string;
    articleCategory: GrammarCategory;
    noun: string;
    nounCategory: GrammarCategory;
  } | null>(null);

  const [wordsHidden, setWordsHidden] = useState(true);
  const registerControlsPortal = useRegisterControlsPortal();
  const awaitingRef = useRef(false);
  const { start: startVisibilityTimer, cancel: cancelVisibilityTimer } = usePausableTimeout(explanationOpen);

  const handleStimulus = useCallback(() => {
    const article = ARTICLES[Math.floor(Math.random() * ARTICLES.length)];
    const categories = Object.keys(NOUNS) as GrammarCategory[];
    const nounCategory = categories[Math.floor(Math.random() * categories.length)];
    const nouns = NOUNS[nounCategory];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    setPair({ article: article.value, articleCategory: article.category, noun, nounCategory });
    setWordsHidden(false);
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
      cancelVisibilityTimer();
      setWordsHidden(true);
      return;
    }
    const visibilityMs = mapVisibility(visibilityLevel);
    startVisibilityTimer(() => {
      setWordsHidden(true);
    }, visibilityMs);
  }, [cancelVisibilityTimer, phase, startVisibilityTimer, visibilityLevel]);

  useEffect(() => cancelVisibilityTimer, [cancelVisibilityTimer]);

  useEffect(() => {
    registerControlsPortal(
      <div className={controlStyles.panel}>
        <label className={controlStyles.control}>
          <span className={controlStyles.label}>Distancia entre palabras: {distanceLevel}</span>
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
          <span className={controlStyles.label}>Tiempo de visibilidad: {visibilityLevel}</span>
          <input
            type="range"
            min={LEVEL_MIN}
            max={LEVEL_MAX}
            value={visibilityLevel}
            disabled={running}
            onChange={(event) => setVisibilityLevel(Number(event.target.value))}
          />
        </label>
      </div>
    );

    return () => registerControlsPortal(null);
  }, [distanceLevel, registerControlsPortal, running, visibilityLevel]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "KeyZ" && event.code !== "KeyX") {
        return;
      }
      if (!awaitingResponse || explanationOpen || phase !== "stimulus" || !pair) {
        return;
      }
      event.preventDefault();
      const matches = pair.articleCategory === pair.nounCategory;
      const pressedMatch = event.code === "KeyZ";
      const success = (pressedMatch && matches) || (!pressedMatch && !matches);
      registerResponse({ success, label: success ? "Correcto" : "Incorrecto", timeMsOverride: success ? undefined : 2000 });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [awaitingResponse, explanationOpen, pair, phase, registerResponse]);

  const spacing = useMemo(() => mapDistanceToGap(distanceLevel), [distanceLevel]);

  const progressLabel = attempt > 0 ? `Intento ${Math.min(attempt, totalAttempts)}/${totalAttempts}` : `Listo para ${totalAttempts} intentos`;

  const feedbackText = useMemo(() => {
    if (!lastResult) {
      return "Aqui veras el tiempo y si acertaste.";
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
          <span className={styles.badge}>Z concuerda / X no concuerda</span>
        </div>
        <button className={styles.explanationBtn} type="button" onClick={() => setExplanationOpen(true)}>
          Explicacion
        </button>
      </div>

      <p className={styles.instructions}>Decide si el articulo concuerda en genero y numero con el sustantivo. Responde con Z o X antes de 2 segundos.</p>

      <CountdownSemaphore stage={countdownStage} />

      <p className={`${styles.feedback} ${feedbackClass}`}>{feedbackText}</p>

      <div className={styles.board}>
        {phase === "stimulus" && pair && !wordsHidden && (
          <div className={concordStyles.words} style={{ columnGap: `${spacing}px` }}>
            <span className={concordStyles.word}>{pair.article}</span>
            <span className={concordStyles.word}>{pair.noun}</span>
          </div>
        )}
        {phase === "stimulus" && wordsHidden && (
          <p className={styles.helperText}>Las palabras ya no son visibles, responde Z/X antes de 2000 ms.</p>
        )}
        {phase !== "stimulus" && <p className={styles.helperText}>Esperando las palabras...</p>}
      </div>

      {summary && (
        <div className={styles.summary}>
          Tiempo medio: {summary.averageMs} ms - Concordancias correctas: {summary.successCount}/{summary.attempts}
        </div>
      )}

      <Modal open={explanationOpen} title="Concordancia Gramatical" onClose={() => setExplanationOpen(false)}>
        <ul>
          <li>Veras un articulo a la izquierda y un sustantivo a la derecha.</li>
          <li>Pulsa Z si la combinacion concuerda en genero y numero, o X si no concuerda.</li>
          <li>Dispones de 2 segundos. El control de visibilidad define cuantos milisegundos quedan en pantalla.</li>
          <li>Las respuestas tardias o erroneas cuentan como 2000 ms. Tras 10 intentos veras tu promedio.</li>
        </ul>
      </Modal>
    </div>
  );
}
