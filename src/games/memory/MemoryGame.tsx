import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { useRegisterControlsPortal } from "../../contexts/ControlsPortalContext";
import { useMemoryGame } from "./useMemoryGame";
import { compareAnswer, formatExposure, groupSequence, normalizeExposure, stepExposure, type MemoryMode } from "./utils";
import styles from "./MemoryGame.module.scss";

const LENGTHS = Array.from({ length: 30 }, (_, index) => index + 1);

function ExposureControl({ value, disabled, onChange }: { value: number; disabled: boolean; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState(() => formatExposure(value));
  const update = (next: number) => {
    setDraft(formatExposure(next));
    onChange(next);
  };
  const readDraft = () => {
    const seconds = Number(draft.trim().replace(",", "."));
    return Number.isFinite(seconds) && seconds > 0 ? normalizeExposure(seconds * 1000) : value;
  };
  return (
    <div className={styles.control}>
      <label htmlFor="memory-exposure">Exposición (s)</label>
      <div className={styles.stepper}>
        <button type="button" aria-label="Reducir exposición" disabled={disabled || readDraft() <= 100} onClick={() => update(stepExposure(readDraft(), -1))}>−</button>
        <input
          id="memory-exposure"
          type="text"
          inputMode="decimal"
          role="spinbutton"
          aria-valuemin={0.1}
          aria-valuenow={value / 1000}
          aria-valuetext={`${formatExposure(value)} segundos`}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={disabled}
          onBlur={() => update(readDraft())}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "ArrowUp" || event.key === "ArrowDown") {
              event.preventDefault();
              update(stepExposure(readDraft(), event.key === "ArrowUp" ? 1 : -1));
            }
          }}
        />
        <button type="button" aria-label="Aumentar exposición" disabled={disabled} onClick={() => update(stepExposure(readDraft(), 1))}>+</button>
      </div>
    </div>
  );
}

function Sequence({ sequence, mode, answer }: { sequence: string; mode: MemoryMode; answer?: string }) {
  const results = answer === undefined ? null : compareAnswer(sequence, answer);
  const groupSize = mode === "binary" ? 6 : 2;
  return (
    <div className={styles.sequenceScroll} role="region" aria-label={results ? "Corrección de tu respuesta" : "Secuencia para memorizar"} tabIndex={0}>
      <div className={styles.sequence}>
        {groupSequence(sequence, mode).map((group, groupIndex) => (
          <div className={mode === "binary" ? styles.binaryGroup : styles.decimalGroup} key={groupIndex}>
            {Array.from(group, (digit, digitIndex) => {
              const index = groupIndex * groupSize + digitIndex;
              const result = results?.[index];
              return (
                <span
                  className={[styles.digit, result ? result.correct ? styles.correct : styles.incorrect : ""].filter(Boolean).join(" ")}
                  key={index}
                  role={result ? "img" : undefined}
                  aria-label={result ? `Posición ${index + 1}: ${result.actual || "sin respuesta"}. ${result.correct ? "Correcto" : `El dígito correcto era ${result.expected}`}.` : undefined}
                >
                  <span aria-hidden={result ? true : undefined}>{result ? result.actual || "–" : digit}</span>
                  {result && !result.correct && <span className={styles.correction} aria-hidden="true">{result.expected}</span>}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export function MemoryGame() {
  const { config, phase, round, answer, locked, configure, start, setAnswer, reveal } = useMemoryGame();
  const registerControls = useRegisterControlsPortal();
  const answerInput = useRef<HTMLInputElement>(null);
  const nextButton = useRef<HTMLButtonElement>(null);

  const controls = useMemo(() => (
    <div className={styles.controls}>
      <label className={styles.control}>
        <span>Modo</span>
        <select value={config.mode} disabled={locked} onChange={(event) => configure({ mode: event.target.value as MemoryMode })}>
          <option value="decimal">Decimal</option>
          <option value="binary">Binario</option>
        </select>
      </label>
      <label className={styles.control}>
        <span>Dígitos</span>
        <select value={config.length} disabled={locked} onChange={(event) => configure({ length: Number(event.target.value) })}>
          {LENGTHS.map((length) => <option value={length} key={length}>{length}</option>)}
        </select>
      </label>
      <ExposureControl value={config.exposureMs} disabled={locked} onChange={(exposureMs) => configure({ exposureMs })} />
    </div>
  ), [config, locked, configure]);

  useEffect(() => {
    registerControls(controls);
    return () => registerControls(null);
  }, [controls, registerControls]);

  useEffect(() => {
    if (phase === "answering") answerInput.current?.focus({ preventScroll: true });
    if (phase === "result") nextButton.current?.focus({ preventScroll: true });
  }, [phase]);

  const displayedConfig = round && phase !== "ready" ? round : config;
  const handleReveal = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    reveal();
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Memoria de dígitos</h2>
        <span className={styles.badge}>{displayedConfig.mode === "binary" ? "Binario" : "Decimal"} · {displayedConfig.length} dígitos · {formatExposure(displayedConfig.exposureMs)} s</span>
      </div>
      <p className={styles.instructions}>
        {displayedConfig.mode === "binary"
          ? "Lee cada bloque de arriba abajo y pasa al siguiente. Después, escribe los dígitos en ese orden."
          : "Memoriza los pares de izquierda a derecha. Después, escribe los dígitos en ese orden."}
      </p>
      <div className={styles.board}>
        <p className={styles.phase} role="status">
          {phase === "ready" ? "A tu ritmo" : phase === "memorizing" ? "Memoriza" : phase === "answering" ? "Escribe lo que recuerdas" : "Tu respuesta"}
        </p>
        {phase === "ready" && (
          <div className={styles.ready}>
            <p>Elige la cantidad y el tiempo de exposición.<br />Para responder, tendrás todo el tiempo que necesites.</p>
            <PrimaryButton onClick={start}>Mostrar</PrimaryButton>
          </div>
        )}
        {phase === "memorizing" && round && <Sequence sequence={round.sequence} mode={round.mode} />}
        {phase === "answering" && round && (
          <form className={styles.answerForm} onSubmit={handleReveal}>
            <label className={styles.answerLabel} htmlFor="memory-answer">Tu secuencia</label>
            <input
              ref={answerInput}
              id="memory-answer"
              className={styles.answerInput}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              value={answer}
              aria-describedby="memory-answer-hint"
              onChange={(event) => setAnswer(event.target.value)}
            />
            <p id="memory-answer-hint" className={styles.hint}>{answer.length} de {round.length} dígitos escritos</p>
            <PrimaryButton type="submit">Revelar</PrimaryButton>
          </form>
        )}
        {phase === "result" && round && (
          <>
            <Sequence sequence={round.sequence} mode={round.mode} answer={answer} />
            <button ref={nextButton} className={styles.nextButton} type="button" onClick={start}>Nueva ronda</button>
          </>
        )}
      </div>
    </div>
  );
}
