import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createSession, evaluate, exposureForLevel, summarize, type Judgment, type ResponseResult, type Stimulus } from "./stimuli";
import styles from "./WordDiscrimination.module.scss";

type Phase = "idle" | "exposure" | "answer" | "feedback" | "finished";

export function WordDiscrimination({ running, onTimeout }: { running: boolean; onTimeout: () => void }) {
  const [level, setLevel] = useState(1);
  const [length, setLength] = useState<20 | 40 | 60>(20);
  const [sessionLevel, setSessionLevel] = useState(1);
  const [phase, setPhase] = useState<Phase>("idle");
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
      setSession(createSession(level, length));
      setSessionLevel(level);
      setIndex(0);
      setResults([]);
      changePhase("exposure");
    } else if (phaseRef.current !== "finished") {
      window.clearTimeout(timerRef.current);
      changePhase("idle");
    }
    return () => window.clearTimeout(timerRef.current);
    // Configuration changes are disabled while running; only the start/stop signal starts a session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, changePhase]);

  useLayoutEffect(() => {
    if (phase !== "exposure" || !current || !running) return;
    timerRef.current = window.setTimeout(() => changePhase("answer"), exposureForLevel(sessionLevel));
    return () => window.clearTimeout(timerRef.current);
  }, [phase, current, sessionLevel, running, changePhase]);

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
      <label>Nivel
        <select value={level} disabled={running} onChange={(event) => setLevel(Number(event.target.value))}>
          {Array.from({ length: 9 }, (_, i) => <option key={i + 1} value={i + 1}>Nivel {i + 1}</option>)}
        </select>
      </label>
      <label>Comparaciones
        <select value={length} disabled={running} onChange={(event) => setLength(Number(event.target.value) as 20 | 40 | 60)}>
          <option value={20}>20</option><option value={40}>40</option><option value={60}>60</option>
        </select>
      </label>
      <span className={styles.detail}>Exposición: {exposureForLevel(level).toLocaleString("es-ES")} ms</span>
    </div>

    {phase !== "finished" && <>
      <div className={styles.progress} aria-live="polite">
        {phase === "idle" ? "Pulsa Arranque para comenzar" : `Comparación ${index + 1} de ${session.length}`}
      </div>
      <div className={styles.pair} aria-label={phase === "exposure" ? "Palabras visibles" : "Palabras ocultas"}>
        <div className={styles.word} aria-label="Primera palabra">{phase === "exposure" ? current?.left : "••••••"}</div>
        <div className={styles.word} aria-label="Segunda palabra">{phase === "exposure" ? current?.right : "••••••"}</div>
      </div>
      <p className={styles.instruction} aria-live="polite">
        {phase === "exposure" ? "Observa las dos palabras" : phase === "answer" ? "¿Eran iguales o diferentes?" : phase === "feedback"
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
      <p>Nivel {sessionLevel} · Exposición {exposureForLevel(sessionLevel).toLocaleString("es-ES")} ms</p>
      {metrics.misses.length > 0 && <div className={styles.misses}>
        <h4>Pares fallados</h4>
        <ul>{metrics.misses.map((result, i) => <li key={i}>{result.left} / {result.right} — eran {result.answer === "same" ? "iguales" : "diferentes"}</li>)}</ul>
      </div>}
      <p>Pulsa Arranque para repetir.</p>
    </section>}
  </div>;
}
