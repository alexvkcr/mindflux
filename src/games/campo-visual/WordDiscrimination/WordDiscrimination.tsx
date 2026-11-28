import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createSession, evaluate, summarize, DEFAULT_CONFIG, EXPOSURE_MS, SESSION_LENGTHS, SYLLABLE_COUNTS, CHALLENGES, WORD_DISTANCES, type Challenge, type SessionConfig, type Judgment, type ResponseResult, type Stimulus } from "./stimuli";
import { CountdownSemaphore } from "../../reaction/components/CountdownSemaphore";
import styles from "./WordDiscrimination.module.scss";

type Phase = "idle" | "countdown" | "exposure" | "answer" | "feedback" | "finished";
const EXPOSURE_GROUPS = [
  { label: "Lenta", values: EXPOSURE_MS.filter(ms => ms >= 700) },
  { label: "Rápida", values: EXPOSURE_MS.filter(ms => ms >= 400 && ms < 700) },
  { label: "Muy rápida", values: EXPOSURE_MS.filter(ms => ms >= 300 && ms < 400) },
  { label: "Extrema", values: EXPOSURE_MS.filter(ms => ms < 300) }
];
const CHALLENGE_LABELS: Record<Challenge, string> = {
  substitution: "Letra distinta", transposition: "Desorden", accent: "Acentuación",
  deletion: "Omisión", insertion: "Inserción", double: "Alteración doble",
  similar: "Letras visualmente similares", all: "Todas"
};

export function WordDiscrimination({ running, onTimeout }: { running: boolean; onTimeout: () => void }) {
  const [config, setConfig] = useState<SessionConfig>(DEFAULT_CONFIG);
  const [sessionConfig, setSessionConfig] = useState<SessionConfig>(DEFAULT_CONFIG);
  const pairRef = useRef<HTMLDivElement>(null);
  const displayConfig = running ? sessionConfig : config;
  const [phase, setPhase] = useState<Phase>("idle");
  const [countdownStage, setCountdownStage] = useState(3);
  const [index, setIndex] = useState(0);
  const [session, setSession] = useState<Stimulus[]>([]);
  const [results, setResults] = useState<ResponseResult[]>([]);
  const phaseRef = useRef<Phase>("idle");
  const timerRef = useRef<number | undefined>(undefined);
  const current = session[index];
  const metrics = summarize(results);

  const changePhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  useEffect(() => {
    if (running) {
      window.clearTimeout(timerRef.current);
      setSession(createSession(config));
      setSessionConfig(config);
      setIndex(0);
      setResults([]);
      setCountdownStage(3);
      changePhase("countdown");
    } else if (phaseRef.current !== "finished") {
      window.clearTimeout(timerRef.current);
      changePhase("idle");
    }
    return () => window.clearTimeout(timerRef.current);
    // Configuration changes are disabled while running; only the start/stop signal starts a session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, changePhase]);

  useEffect(() => {
    if (!running || phase !== "countdown") return;
    const timeout = window.setTimeout(() => {
      if (countdownStage > 1) setCountdownStage(countdownStage - 1);
      else {
        setCountdownStage(0);
        changePhase("exposure");
      }
    }, 1000);
    return () => window.clearTimeout(timeout);
  }, [running, phase, countdownStage, changePhase]);

  useLayoutEffect(() => {
    if (phase !== "exposure" || !current || !running) return;
    timerRef.current = window.setTimeout(() => changePhase("answer"), sessionConfig.exposureMs);
    return () => window.clearTimeout(timerRef.current);
  }, [phase, current, sessionConfig.exposureMs, running, changePhase]);

  // Measure the actual glyph widths so the pair stays on one line even on narrow phones.
  useLayoutEffect(() => {
    const pair = pairRef.current;
    if (!pair) return;
    const fit = () => {
      pair.style.removeProperty("--word-font-size");
      const words = Array.from(pair.querySelectorAll<HTMLElement>("[data-word]"));
      if (!words.length) return;
      const style = window.getComputedStyle(pair);
      const available = pair.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - parseFloat(style.columnGap);
      const total = words.reduce((width, word) => width + word.getBoundingClientRect().width, 0);
      if (total > available && available > 0) {
        const baseSize = parseFloat(window.getComputedStyle(words[0]).fontSize);
        pair.style.setProperty("--word-font-size", Math.max(1, baseSize * available / total * 0.98) + "px");
      }
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(pair);
    return () => observer.disconnect();
  }, [phase, current, displayConfig.distance]);

  const respond = useCallback((judgment: Judgment) => {
    if (phaseRef.current !== "answer" || !current || !running) return;
    changePhase("feedback");
    setResults((previous) => [...previous, evaluate(current, judgment)]);
    timerRef.current = window.setTimeout(() => {
      if (index + 1 >= session.length) {
        changePhase("finished");
        onTimeout();
      } else {
        setIndex(index + 1);
        changePhase("exposure");
      }
    }, 1100);
  }, [changePhase, current, index, onTimeout, running, session.length]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
      const key = event.key.toLowerCase();
      if (key === "i" || key === "1") respond("same");
      if (key === "d" || key === "2") respond("different");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [respond]);

  return <div className={styles.root} data-phase={phase}>
    <header className={styles.header}>
      <h2>Discriminación visual de palabras</h2>
      <p>Compara las letras. No hace falta conocer su significado ni decidir si están bien escritas.</p>
    </header>

    <div className={styles.settings}>
      <label>Comparaciones
        <select value={config.comparisons} disabled={running} onChange={event => setConfig(previous => ({ ...previous, comparisons: Number(event.target.value) as SessionConfig["comparisons"] }))}>
          {SESSION_LENGTHS.map(value => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      <label>Exposición
        <select value={config.exposureMs} disabled={running} onChange={event => setConfig(previous => ({ ...previous, exposureMs: Number(event.target.value) as SessionConfig["exposureMs"] }))}>
          {EXPOSURE_GROUPS.map(group => <optgroup key={group.label} label={group.label}>
            {group.values.map(value => <option key={value} value={value}>{value.toLocaleString("es-ES")} ms</option>)}
          </optgroup>)}
        </select>
      </label>
      <label>Longitud
        <select value={config.syllables} disabled={running} onChange={event => setConfig(previous => ({ ...previous, syllables: Number(event.target.value) as SessionConfig["syllables"] }))}>
          {SYLLABLE_COUNTS.map(value => <option key={value} value={value}>{value} sílabas</option>)}
        </select>
      </label>
      <label>Reto
        <select value={config.challenge} disabled={running} onChange={event => setConfig(previous => ({ ...previous, challenge: event.target.value as Challenge }))}>
          {CHALLENGES.map(value => <option key={value} value={value}>{CHALLENGE_LABELS[value]}</option>)}
        </select>
      </label>
      <label>Separación
        <select value={config.distance} disabled={running} onChange={event => setConfig(previous => ({ ...previous, distance: Number(event.target.value) as SessionConfig["distance"] }))}>
          {WORD_DISTANCES.map(value => <option key={value} value={value}>{value} px</option>)}
        </select>
      </label>
    </div>

    {phase !== "finished" && <>
      <div className={styles.progress} aria-live="polite">
        {phase === "idle" ? "Pulsa Arranque para comenzar" : phase === "countdown" ? `Empieza en ${countdownStage}` : `Comparación ${index + 1} de ${session.length}`}
      </div>
      <div ref={pairRef} className={styles.pair} style={{ columnGap: displayConfig.distance }} aria-label={phase === "exposure" ? "Palabras visibles" : "Palabras ocultas"}>
        {phase === "countdown" ? <CountdownSemaphore stage={countdownStage} /> : <>
          <span data-word className={styles.word} aria-label="Primera palabra">{phase === "exposure" ? current?.left : "••••••"}</span>
          <span data-word className={styles.word} aria-label="Segunda palabra">{phase === "exposure" ? current?.right : "••••••"}</span>
        </>}
      </div>
      <p className={styles.instruction} aria-live="polite">
        {phase === "countdown" ? "Prepárate" : phase === "exposure" ? "Observa las dos palabras" : phase === "answer" ? "¿Eran iguales o diferentes?" : phase === "feedback"
          ? results.at(-1)?.correct ? "Correcto" : "Incorrecto" : "Las palabras desaparecerán antes de responder"}
      </p>
      <div className={styles.actions}>
        <button type="button" disabled={phase !== "answer"} onClick={() => respond("same")}>IGUALES <kbd>I</kbd></button>
        <button type="button" disabled={phase !== "answer"} onClick={() => respond("different")}>DIFERENTES <kbd>D</kbd></button>
      </div>
      {phase === "feedback" && results.at(-1) && <p className={styles.reveal}>
        Par: <strong>{results.at(-1)?.left}</strong> / <strong>{results.at(-1)?.right}</strong>
      </p>}
    </>}

    {phase === "finished" && <section className={styles.summary} aria-label="Resultados de la sesión">
      <h3>Sesión completada</h3>
      <div className={styles.stats}>
        <p><strong>{metrics.hits} / {results.length}</strong><span>Aciertos</span></p>
        <p><strong>{metrics.accuracy} %</strong><span>Precisión</span></p>
        <p><strong>{metrics.differentAsSame}</strong><span>Diferentes juzgadas iguales</span></p>
        <p><strong>{metrics.sameAsDifferent}</strong><span>Iguales juzgadas diferentes</span></p>
      </div>
      <p>Exposición {sessionConfig.exposureMs.toLocaleString("es-ES")} ms · {sessionConfig.syllables} sílabas · {CHALLENGE_LABELS[sessionConfig.challenge]} · {sessionConfig.distance} px · {sessionConfig.comparisons} comparaciones</p>
      {metrics.misses.length > 0 && <div className={styles.misses}>
        <h4>Pares fallados</h4>
        <ul>{metrics.misses.map((result, i) => <li key={i}>{result.left} / {result.right} — eran {result.answer === "same" ? "iguales" : "diferentes"}</li>)}</ul>
      </div>}
      <p>Pulsa Arranque para repetir.</p>
    </section>}
  </div>;
}
