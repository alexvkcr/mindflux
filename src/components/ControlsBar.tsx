import type { ChangeEvent } from "react";
import { t } from "../i18n";
import styles from "./ControlsBar.module.scss";
import { PrimaryButton } from "./ui/PrimaryButton";

export type CategoryKey = "eyeMovement" | "speedReading" | "visualField";
export type GameKey =
  | "basic"
  | "isoDistance"
  | "fixedReading"
  | "columnReading"
  | "doubleNumber";
export type BookKey = "quijote" | "regenta" | "colmena";

export type ControlsState = {
  category: CategoryKey;
  game: GameKey;
  level: number;
  running: boolean;
  distance?: number;
  book?: BookKey;
  widthIdx?: number;
};

const CATEGORY_GAMES: Record<CategoryKey, GameKey[]> = {
  eyeMovement: ["basic", "isoDistance"],
  speedReading: ["fixedReading", "columnReading"],
  visualField: ["doubleNumber"]
};

const DEFAULT_BOOK: BookKey = "quijote";

function ensureGame(category: CategoryKey, game: GameKey): GameKey {
  const candidates = CATEGORY_GAMES[category];
  if (candidates.includes(game)) {
    return game;
  }
  return candidates[0];
}

export function ControlsBar(props: {
  state: ControlsState;
  onChange: (next: Partial<ControlsState>) => void;
}) {
  const { state, onChange } = props;

  const handleCategoryChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextCategory = event.target.value as CategoryKey;
    const nextGame = CATEGORY_GAMES[nextCategory][0];
    const nextState: Partial<ControlsState> = {
      category: nextCategory,
      game: nextGame
    };

    if (nextCategory === "speedReading") {
      nextState.book = state.book ?? DEFAULT_BOOK;
    } else {
      nextState.book = undefined;
    }

    onChange(nextState);
  };

  const handleGameChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextGame = event.target.value as GameKey;
    onChange({ game: nextGame });
  };

  const effectiveGame = ensureGame(state.category, state.game);
  const isSpeedReading = state.category === "speedReading";
  const isIsoDistance = effectiveGame === "isoDistance";
  const isColumnReading = isSpeedReading && effectiveGame === "columnReading";

  return (
    <section className={styles.controlsBar}>
      <div className={styles.control}>
        <label className={styles.label}>{t.controls.categoryLabel}</label>
        <select
          className={styles.select}
          value={state.category}
          onChange={handleCategoryChange}
        >
          <option value="eyeMovement">{t.controls.categories.eyeMovement}</option>
          <option value="speedReading">{t.controls.categories.speedReading}</option>
          <option value="visualField">{t.controls.categories.visualField}</option>
        </select>
      </div>

      <div className={styles.control}>
        <label className={styles.label}>{t.controls.gameLabel}</label>
        <select
          className={styles.select}
          value={effectiveGame}
          onChange={handleGameChange}
        >
          {CATEGORY_GAMES[state.category].map((gameKey) => (
            <option key={gameKey} value={gameKey}>
              {t.controls.games[gameKey]}
            </option>
          ))}
        </select>
      </div>

      {isSpeedReading && !isColumnReading && (
        <div className={styles.control}>
          <label className={styles.label}>{t.controls.bookLabel}</label>
          <select
            className={styles.select}
            value={state.book || DEFAULT_BOOK}
            onChange={(e) => onChange({ book: e.target.value as BookKey })}
          >
            <option value="quijote">{t.controls.books.quijote}</option>
            <option value="regenta">{t.controls.books.regenta}</option>
            <option value="colmena">{t.controls.books.colmena}</option>
          </select>
        </div>
      )}

      {isIsoDistance && (
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

      {!isColumnReading && (
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
      )}

      {!isColumnReading && (
        <div className={styles.action}>
          <PrimaryButton
            className={styles.button}
            onClick={() => onChange({ running: !state.running })}
            aria-pressed={state.running}
          >
            {state.running ? t.controls.stop : t.controls.start}
          </PrimaryButton>
        </div>
      )}
    </section>
  );
}
