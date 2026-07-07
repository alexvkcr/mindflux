import { useCallback, useMemo, useState, type ReactNode } from "react";
import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { MINI_LESSONS } from "./data/miniLessons";
import { MINI_LESSON_FREQUENCY } from "./data/miniLessonFrequency";
import type { MiniLesson } from "./types";
import { buildWeightedDeck, pickWeightedLesson } from "./utils/buildWeightedDeck";
import styles from "./TriggerDrill.module.scss";

type DrillMode = "mixed" | "trigger" | "exact";

interface SessionStats {
  reviewed: number;
  hits: number;
  misses: number;
}

const MODE_LABELS: Record<DrillMode, string> = {
  mixed: "Mixto",
  trigger: "Disparador",
  exact: "Frase exacta"
};

function toText(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return null;
}

function getFirstText(lesson: MiniLesson, keys: readonly (keyof MiniLesson)[]): string | null {
  for (const key of keys) {
    const text = toText(lesson[key]);
    if (text) {
      return text;
    }
  }

  return null;
}

function normalizeExamples(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(toText).filter((text): text is string => text !== null);
  }

  const text = toText(value);
  return text ? [text] : [];
}

function getLessonNumber(lesson: MiniLesson, fallbackIndex: number): string {
  return getFirstText(lesson, ["number", "id"]) ?? String(fallbackIndex + 1);
}

function getLessonTitle(lesson: MiniLesson, lessonNumber: string): string {
  return getFirstText(lesson, ["title"]) ?? `Minileccion ${lessonNumber}`;
}

function getPrompt(lesson: MiniLesson): string {
  return (
    getFirstText(lesson, ["prompt"]) ??
    "Anade un prompt o situacion en MINI_LESSONS."
  );
}

function getModeHint(mode: DrillMode): string {
  if (mode === "trigger") {
    return "Recuerda el marco o criterio que aplica aqui.";
  }

  if (mode === "exact") {
    return "Recuerda una frase o ejemplo usable antes de revelar.";
  }

  return "Recuerda la respuesta antes de revelar la minileccion.";
}

function DetailBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.detail}>
      <span className={styles.detailLabel}>{label}</span>
      {children}
    </div>
  );
}

export function TriggerDrill() {
  const weightedDeck = useMemo(
    () => buildWeightedDeck(MINI_LESSONS, MINI_LESSON_FREQUENCY),
    []
  );
  const lessonIndex = useMemo(
    () => new Map(MINI_LESSONS.map((lesson, index) => [lesson, index])),
    []
  );

  const [mode, setMode] = useState<DrillMode>("mixed");
  const [currentLesson, setCurrentLesson] = useState<MiniLesson | null>(() => pickWeightedLesson(weightedDeck));
  const [revealed, setRevealed] = useState(false);
  const [stats, setStats] = useState<SessionStats>({ reviewed: 0, hits: 0, misses: 0 });

  const accuracy = stats.reviewed > 0 ? Math.round((stats.hits / stats.reviewed) * 100) : 0;

  const selectNextLesson = useCallback(() => {
    setCurrentLesson(pickWeightedLesson(weightedDeck));
    setRevealed(false);
  }, [weightedDeck]);

  const resetSession = useCallback(() => {
    setStats({ reviewed: 0, hits: 0, misses: 0 });
    setCurrentLesson(pickWeightedLesson(weightedDeck));
    setRevealed(false);
  }, [weightedDeck]);

  const markResult = useCallback(
    (success: boolean) => {
      setStats((prev) => ({
        reviewed: prev.reviewed + 1,
        hits: prev.hits + (success ? 1 : 0),
        misses: prev.misses + (success ? 0 : 1)
      }));
      selectNextLesson();
    },
    [selectNextLesson]
  );

  if (!currentLesson) {
    return (
      <div className={styles.container}>
        <p className={styles.emptyState}>
          No hay minilecciones disponibles. Pega tus datos en
          {" "}src/games/minilessons/data/miniLessons.ts y define frecuencias en
          {" "}src/games/minilessons/data/miniLessonFrequency.ts.
        </p>
      </div>
    );
  }

  const currentIndex = lessonIndex.get(currentLesson) ?? 0;
  const lessonNumber = getLessonNumber(currentLesson, currentIndex);
  const title = getLessonTitle(currentLesson, lessonNumber);
  const prompt = getPrompt(currentLesson);
  const trigger = getFirstText(currentLesson, ["trigger"]);
  const core = getFirstText(currentLesson, ["core"]);
  const rule = getFirstText(currentLesson, ["rule"]);
  const note = getFirstText(currentLesson, ["note"]);
  const examples = normalizeExamples(currentLesson.examples);
  const showTitleBeforeReveal = mode === "exact";

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <div className={styles.stats} aria-label="Estadisticas de la sesion">
          <div className={styles.stat}>
            <span className={styles.statLabel}>Repasadas</span>
            <span className={styles.statValue}>{stats.reviewed}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Aciertos</span>
            <span className={styles.statValue}>{stats.hits}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Fallos</span>
            <span className={styles.statValue}>{stats.misses}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Porcentaje</span>
            <span className={styles.statValue}>{accuracy}%</span>
          </div>
        </div>

        <label className={styles.modeControl}>
          <span className={styles.label}>Modo</span>
          <select
            className={styles.select}
            value={mode}
            onChange={(event) => setMode(event.target.value as DrillMode)}
          >
            <option value="mixed">{MODE_LABELS.mixed}</option>
            <option value="trigger">{MODE_LABELS.trigger}</option>
            <option value="exact">{MODE_LABELS.exact}</option>
          </select>
        </label>
      </div>

      <article className={styles.card} aria-live="polite">
        <header className={styles.cardHeader}>
          <div className={styles.lessonMeta}>
            <span className={styles.badge}>Minileccion {lessonNumber}</span>
            <span className={`${styles.badge} ${styles.mutedBadge}`}>{MODE_LABELS[mode]}</span>
          </div>
          {!revealed && (
            <span className={`${styles.badge} ${styles.mutedBadge}`}>
              {showTitleBeforeReveal ? title : "Titulo oculto"}
            </span>
          )}
        </header>

        <section className={styles.promptBlock}>
          <span className={styles.eyebrow}>{getModeHint(mode)}</span>
          <p className={styles.prompt}>{prompt}</p>
          {trigger && mode !== "exact" && (
            <p className={styles.trigger}>
              <strong>Disparador:</strong> {trigger}
            </p>
          )}
        </section>

        {revealed && (
          <section className={styles.solution} aria-label="Solucion revelada">
            <h2 className={styles.solutionTitle}>{title}</h2>
            {core && (
              <DetailBlock label="Core">
                <p className={styles.detailText}>{core}</p>
              </DetailBlock>
            )}
            {rule && (
              <DetailBlock label="Regla">
                <p className={styles.detailText}>{rule}</p>
              </DetailBlock>
            )}
            {trigger && (
              <DetailBlock label="Trigger">
                <p className={styles.detailText}>{trigger}</p>
              </DetailBlock>
            )}
            {examples.length > 0 && (
              <DetailBlock label="Ejemplos">
                <ul className={styles.examples}>
                  {examples.map((example, index) => (
                    <li key={`${example}-${index}`}>{example}</li>
                  ))}
                </ul>
              </DetailBlock>
            )}
            {note && (
              <DetailBlock label="Nota">
                <p className={styles.detailText}>{note}</p>
              </DetailBlock>
            )}
          </section>
        )}
      </article>

      <div className={styles.actions}>
        <PrimaryButton
          className={styles.actionButton}
          onClick={() => setRevealed(true)}
          disabled={revealed}
        >
          Revelar
        </PrimaryButton>
        <button
          type="button"
          className={styles.successButton}
          onClick={() => markResult(true)}
          disabled={!revealed}
        >
          Acierto
        </button>
        <button
          type="button"
          className={styles.failButton}
          onClick={() => markResult(false)}
          disabled={!revealed}
        >
          Fallo
        </button>
        <button type="button" className={styles.secondaryButton} onClick={selectNextLesson}>
          Siguiente
        </button>
        <button type="button" className={styles.secondaryButton} onClick={resetSession}>
          Reiniciar sesion
        </button>
      </div>
    </div>
  );
}
