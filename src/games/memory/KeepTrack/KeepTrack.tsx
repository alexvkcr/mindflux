import { type FormEvent } from "react";
import { CATEGORY_LABELS, LEVELS, SESSION_ROUNDS, summarize } from "./engine";
import { useKeepTrack } from "./useKeepTrack";
import styles from "./KeepTrack.module.scss";

export function KeepTrack() {
  const { state, configure, start, begin, next, pause, setAnswer, submit, restart } = useKeepTrack();
  const { phase, round, results } = state;
  const latest = results.at(-1);
  const score = summarize(results);
  const selected = LEVELS[state.level - 1];
  const locked = phase !== "idle" && phase !== "finished";

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit();
  };

  return <div className={styles.container} data-phase={phase}>
    <header className={styles.header}>
      <h2>Seguimiento por categorías</h2>
      <span className={styles.badge}>Keep Track</span>
    </header>
    <p className={styles.instructions}>Recuerda solo la palabra más reciente de cada categoría. Cada nueva palabra sustituye a la anterior de su categoría.</p>

    <label className={styles.levelControl}>Nivel
      <select value={state.level} disabled={locked} onChange={(event) => configure(Number(event.target.value))}>
        {LEVELS.map((config, index) => <option key={index} value={index + 1}>
          Nivel {index + 1} · {config.categories} categorías · {config.exposureMs} ms
        </option>)}
      </select>
    </label>

    <section className={styles.board} aria-label="Seguimiento por categorías">
      {phase === "idle" && <div className={styles.panel}>
        <p>Seguirás {selected.categories} categorías durante {SESSION_ROUNDS} rondas.</p>
        <p>Verás una palabra cada {selected.exposureMs.toLocaleString("es-ES")} ms.</p>
        <button className={styles.primary} type="button" onClick={start}>Iniciar sesión</button>
      </div>}

      {phase === "prepare" && round && <div className={styles.panel}>
        <p className={styles.eyebrow}>Ronda {state.roundNumber} de {SESSION_ROUNDS}</p>
        <p>Sigue la última palabra de estas categorías:</p>
        <ul className={styles.categoryList}>{round.categories.map((category) =>
          <li key={category}>{CATEGORY_LABELS[category]}</li>)}</ul>
        <button className={styles.primary} type="button" onClick={begin}>Mostrar palabras</button>
      </div>}

      {phase === "present" && round && <div className={styles.panel}>
        <p className={styles.eyebrow}>Ronda {state.roundNumber} · actualiza tus categorías</p>
        <div className={styles.stimulus} aria-label={state.paused ? "Presentación pausada" : "Palabra actual"}>
          {state.paused ? "•" : round.items[state.itemIndex].word}
        </div>
        <button className={styles.secondary} type="button" onClick={pause}>{state.paused ? "Reanudar" : "Pausar"}</button>
      </div>}

      {phase === "answer" && round && <form className={styles.answerForm} onSubmit={handleSubmit}>
        <p className={styles.eyebrow}>Ronda {state.roundNumber} · respuestas</p>
        <p>Escribe la última palabra que apareció de cada categoría.</p>
        <div className={styles.fields}>{round.categories.map((category) => <label key={category}>
          {CATEGORY_LABELS[category]}
          <input type="text" autoComplete="off" autoCapitalize="none" spellCheck={false}
            value={state.answers[category] ?? ""} onChange={(event) => setAnswer(category, event.target.value)} />
        </label>)}</div>
        <button className={styles.primary} type="submit">Corregir todas las respuestas</button>
      </form>}

      {phase === "correct" && latest && <div className={styles.correction}>
        <p className={styles.eyebrow}>Ronda {latest.round} · corrección</p>
        <h3>{latest.correctCount} de {latest.rows.length} categorías correctas</h3>
        <div className={styles.answerRows}>{latest.rows.map((row) => <div key={row.category} className={row.correct ? styles.correct : styles.incorrect}>
          <strong>{CATEGORY_LABELS[row.category]}</strong>
          <span>Tu respuesta: {row.actual || "—"}</span>
          <span>Última palabra: {row.expected}</span>
        </div>)}</div>
        <button className={styles.primary} type="button" onClick={next}>
          {results.length >= SESSION_ROUNDS ? "Ver resultados" : "Siguiente ronda"}
        </button>
      </div>}

      {phase === "finished" && <div className={styles.summary}>
        <h3>Sesión completada</h3>
        <p className={styles.score}>{score.percentage} %</p>
        <p>{score.correct} de {score.categories} categorías recordadas correctamente</p>
        <p>Nivel {state.sessionLevel} · {LEVELS[state.sessionLevel - 1].exposureMs.toLocaleString("es-ES")} ms por palabra</p>
        <div className={styles.resultList}>{results.map((result) => <details key={result.round}>
          <summary>Ronda {result.round} · {result.correctCount}/{result.rows.length} categorías</summary>
          <div className={styles.roundDetail}>
            <h4>Respuestas</h4>
            {result.rows.map((row) => <p key={row.category}>
              {CATEGORY_LABELS[row.category]}: {row.actual || "—"} → {row.expected} {row.correct ? "✓" : "✗"}
            </p>)}
            <h4>Secuencia reconstruida por categorías</h4>
            <ol>{result.sequence.map((item, index) => <li key={index}>
              <span>{CATEGORY_LABELS[item.category]}</span><strong>{item.word}</strong>
            </li>)}</ol>
          </div>
        </details>)}</div>
        <button className={styles.primary} type="button" onClick={start}>Nueva sesión</button>
      </div>}
    </section>
    {locked && <button className={styles.restart} type="button" onClick={restart}>Reiniciar sesión</button>}
  </div>;
}
