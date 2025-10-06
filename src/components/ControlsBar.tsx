import { ChangeEvent } from "react";
import { t } from "../i18n";
import styles from "./ControlsBar.module.scss";
import { PrimaryButton } from "./ui/PrimaryButton";

export type CategoryKey = "eyeMovement" | "speedReading";
export type GameKey = "basic" | "isoDistance" | "fixedReading";
export type BookKey = "quijote" | "regenta" | "colmena";

export type ControlsState = {
  category: CategoryKey;
  game: GameKey;
  level: number; // 1..9
  running: boolean;
  distance?: number; // 1..9 solo aplica a isoDistance
  book?: BookKey; // solo aplica a juegos de lectura
};

export function ControlsBar(props: {
  state: ControlsState;
  onChange: (next: Partial<ControlsState>) => void;
}) {
  const { state, onChange } = props;

  const handleCategoryChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextCategory = event.target.value as CategoryKey;

    if (nextCategory === "speedReading") {
      onChange({
        category: nextCategory,
        game: "fixedReading",
        book: state.book ?? "quijote"
      });
      return;
    }

    // Volvemos a movimiento ocular; aseguramos un juego vÃ¡lido.
    const fallbackGame =
      state.game === "basic" || state.game === "isoDistance" ? state.game : "basic";

    onChange({
      category: nextCategory,
      game: fallbackGame,
      book: undefined
    });
  };

  const handleGameChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextGame = event.target.value as GameKey;
    onChange({ game: nextGame });
  };

  const effectiveGame =
    state.category === "speedReading"
      ? "fixedReading"
      : state.game === "fixedReading"
      ? "basic"
      : state.game;

  return (
    <section className={styles.controlsBar}>
      {/* Categoria unica, por defecto */}
      <div className={styles.control}>
        <label className={styles.label}>{t.controls.categoryLabel}</label>
        <select
          className={styles.select}
          value={state.category}
          onChange={handleCategoryChange}
        >
          <option value="eyeMovement">{t.controls.categories.eyeMovement}</option>
          <option value="speedReading">{t.controls.categories.speedReading}</option>
        </select>
      </div>

      {/* Juego dentro de la categoria */}
      <div className={styles.control}>
        <label className={styles.label}>{t.controls.gameLabel}</label>
        <select
          className={styles.select}
          value={effectiveGame}
          onChange={handleGameChange}
        >
          {state.category === "eyeMovement" ? (
            <>
              <option value="basic">{t.controls.games.basic}</option>
              <option value="isoDistance">{t.controls.games.isoDistance}</option>
            </>
          ) : state.category === "speedReading" ? (
            <option value="fixedReading">{t.controls.games.fixedReading}</option>
          ) : null}
        </select>
      </div>
      
      {/* Selector de libro (solo para lectura) */}
      {state.category === "speedReading" && (
        <div className={styles.control}>
          <label className={styles.label}>{t.controls.bookLabel}</label>
          <select
            className={styles.select}
            value={state.book || "quijote"}
            onChange={(e) => onChange({ book: e.target.value as BookKey })}
          >
            <option value="quijote">{t.controls.books.quijote}</option>
            <option value="regenta">{t.controls.books.regenta}</option>
            <option value="colmena">{t.controls.books.colmena}</option>
          </select>
        </div>
      )}

      {/* Distancia 1..9 (solo para isoDistance) */}
      {state.game === "isoDistance" && (
        <div className={styles.level}>
          <label className={styles.label}>
            {t.controls.distanceLabel}: {state.distance ?? 3}
          </label>
          <input
            type="range"
            min={1}
            max={9}
            value={state.distance ?? 3}
            onChange={(e) => onChange({ distance: Number(e.target.value) })}
            className={styles.range}
          />
        </div>
      )}

      {/* Nivel 1..9 */}
      <div className={styles.level}>
        <label className={styles.label}>
          {t.controls.levelLabel}: {state.level}
        </label>
        <input
          className={styles.range}
          type="range"
          min={1}
          max={9}
          value={state.level}
          onChange={(e) => onChange({ level: Number(e.target.value) })}
        />
      </div>

      {/* BotÃ³n Arranque/Parar */}
      <div className={styles.action}>
        <PrimaryButton
          className={styles.button}
          onClick={() => onChange({ running: !state.running })}
          aria-pressed={state.running}
        >
          {state.running ? t.controls.stop : t.controls.start}
        </PrimaryButton>
      </div>
    </section>
  );
}

