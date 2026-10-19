import { useEffect, useRef, type FormEvent } from "react";
import { LEVELS, summarize, type SessionLength } from "./engine";
import { useRunningSpan } from "./useRunningSpan";
import styles from "./RunningSpan.module.scss";

export function RunningSpan() {
  const { state, configure, start, begin, next, restart, pause, setAnswer, append, backspace, submit } = useRunningSpan();
  const inputRef = useRef<HTMLInputElement>(null);
  const { phase, round, results } = state;
  const latest = results.at(-1);
  const metrics = summarize(results);
  const selected = LEVELS[state.level - 1];
  const locked = phase !== "idle" && phase !== "finished";

  useEffect(() => {
    // Keep the built-in keypad visible on touch devices; desktop users can type at once.
    if (phase === "answer" && window.matchMedia("(pointer: fine)").matches) {
      inputRef.current?.focus({ preventScroll: true });
    }
  }, [phase]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit();
  };

  return <div className={styles.container} data-phase={phase}>
    <header className={styles.header}>
      <h2>Ventana de memoria</h2>
      <span className={styles.badge}>Running Span</span>
    </header>
    <p className={styles.instructions}>Verás un dígito cada vez. Al terminar, escribe solo los últimos K en el mismo orden. La secuencia puede acabar en cualquier momento.</p>

    <div className={styles.controls}>
      <label>Nivel
        <select value={state.level} disabled={locked} onChange={(event) => configure(Number(event.target.value), state.sessionLength)}>
          {LEVELS.map((config, index) => <option key={index} value={index + 1}>Nivel {index + 1} · K={config.k} · {config.exposureMs} ms</option>)}
        </select>
      </label>
      <label>Rondas
        <select value={state.sessionLength} disabled={locked} onChange={(event) => configure(state.level, Number(event.target.value) as SessionLength)}>
          <option value={5}>5</option><option value={10}>10</option><option value={20}>20</option>
        </select>
      </label>
    </div>

    <section className={styles.board} aria-label="Ventana de memoria">
      {phase === "idle" && <div className={styles.panel}>
        <p>Recordarás los últimos <strong>{selected.k}</strong> dígitos.</p>
        <p>Exposición: {selected.exposureMs} ms por dígito.</p>
        <button className={styles.primary} type="button" onClick={start}>Iniciar sesión</button>
      </div>}

      {phase === "prepare" && round && <div className={styles.panel}>
        <p className={styles.eyebrow}>Ronda {state.roundNumber} de {state.sessionLength}</p>
        <p>Recuerda los últimos <strong className={styles.k}>{round.k}</strong> dígitos.</p>
        <p>La secuencia terminará sin aviso previo.</p>
        <button className={styles.primary} type="button" onClick={begin}>Mostrar secuencia</button>
      </div>}

      {phase === "present" && round && <div className={styles.panel}>
        <p className={styles.eyebrow}>Ronda {state.roundNumber} · últimos {round.k} dígitos</p>
        <div className={styles.stimulus} aria-label={state.paused ? "Presentación pausada" : "Dígito actual"}>
          {state.paused ? "•" : round.sequence[state.digitIndex]}
        </div>
        <button className={styles.secondary} type="button" onClick={pause}>{state.paused ? "Reanudar" : "Pausar"}</button>
      </div>}

      {phase === "answer" && round && <form className={styles.answerForm} onSubmit={handleSubmit}>
        <p className={styles.eyebrow}>Ronda {state.roundNumber} · respuesta</p>
        <label htmlFor="running-span-answer">Escribe los últimos {round.k} dígitos en orden</label>
        <input ref={inputRef} id="running-span-answer" type="text" inputMode="numeric" pattern="[0-9]*"
          autoComplete="off" autoCapitalize="off" spellCheck={false} value={state.answer}
          onChange={(event) => setAnswer(event.target.value)} maxLength={round.k} aria-describedby="running-span-count" />
        <p id="running-span-count" className={styles.hint}>{state.answer.length} de {round.k} dígitos escritos</p>
        <div className={styles.keypad} aria-label="Teclado numérico">
          {"123456789".split("").map((digit) => <button key={digit} type="button" onClick={() => append(digit)}>{digit}</button>)}
          <button type="button" onClick={backspace} aria-label="Borrar último dígito">⌫</button>
          <button type="button" onClick={() => append("0")}>0</button>
          <button type="submit" className={styles.submitKey} aria-label="Corregir respuesta">✓</button>
        </div>
        <button className={styles.primary} type="submit">Corregir respuesta</button>
      </form>}

      {phase === "correct" && latest && <div className={styles.correction}>
        <p className={styles.eyebrow}>Ronda {latest.round} · corrección</p>
        <h3>{latest.complete ? "Ronda correcta" : `${latest.correctCount} de ${latest.positions.length} posiciones correctas`}</h3>
        <p>Últimos {latest.positions.length} dígitos: <strong className={styles.digits}>{latest.expected}</strong></p>
        <p>Tu respuesta: <strong className={styles.digits}>{latest.answer || "Sin respuesta"}</strong></p>
        <div className={styles.positions} aria-label="Corrección por posición">
          {latest.positions.map((position, index) => <div key={index} className={position.correct ? styles.positionCorrect : styles.positionWrong}>
            <span>Pos. {index + 1}</span>
            <strong>{position.actual || "—"}</strong>
            {!position.correct && <small>Era {position.expected}</small>}
          </div>)}
        </div>
        <p className={styles.hint}>La secuencia tuvo {latest.totalLength} dígitos.</p>
        <button className={styles.primary} type="button" onClick={next}>
          {results.length >= state.sessionLength ? "Ver resultados" : "Siguiente ronda"}
        </button>
      </div>}

      {phase === "finished" && <div className={styles.summary}>
        <h3>Sesión completada</h3>
        <div className={styles.stats}>
          <p><strong>{metrics.completeRounds} / {results.length}</strong><span>Rondas completamente correctas</span></p>
          <p><strong>{metrics.percentage} %</strong><span>Posiciones correctas ({metrics.correctPositions}/{metrics.positions})</span></p>
        </div>
        <p>Nivel {state.sessionLevel} · K={LEVELS[state.sessionLevel - 1].k} · {LEVELS[state.sessionLevel - 1].exposureMs} ms por dígito</p>
        <div className={styles.resultList}>
          {results.map((result) => <div key={result.round}>
            <strong>Ronda {result.round}: {result.correctCount}/{result.positions.length}</strong>
            <span>Correcto: {result.expected} · Tu respuesta: {result.answer || "—"}</span>
          </div>)}
        </div>
        <button className={styles.primary} type="button" onClick={start}>Nueva sesión</button>
      </div>}
    </section>

    {locked && <button className={styles.restart} type="button" onClick={restart}>Reiniciar sesión</button>}
  </div>;
}
