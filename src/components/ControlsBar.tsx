import type { ChangeEvent } from "react";
import { t } from "../i18n";
import styles from "./ControlsBar.module.scss";
import { PrimaryButton } from "./ui/PrimaryButton";
import { useControlsPortalNode } from "../contexts/ControlsPortalContext";
import { EYE_MOVEMENT_MAX_LEVEL } from "../games/utils/speed";

export type CategoryKey = "eyeMovement" | "speedReading" | "visualField" | "reactionTime" | "math" | "miniLessons";
export type GameKey =
  | "basic"
  | "isoDistance"
  | "isoRhythm"
  | "fixedReading"
  | "columnReading"
  | "doubleNumber"
  | "quickReflex"
  | "quickMath"
  | "grammarMatch"
  | "mathChain"
  | "mentalCount"
  | "hiLoCount"
  | "triggerDrill";
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
  eyeMovement: ["basic", "isoDistance", "isoRhythm"],
  speedReading: ["fixedReading", "columnReading"],
  visualField: ["doubleNumber"],
  reactionTime: ["quickReflex", "quickMath", "grammarMatch"],
  math: ["mathChain", "mentalCount", "hiLoCount"],
  miniLessons: ["triggerDrill"]
};

const DEFAULT_BOOK: BookKey = "quijote";
const DEFAULT_LEVEL_MIN = 1;
const DEFAULT_LEVEL_MAX = 9;

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
  const extraControls = useControlsPortalNode();

  const handleCategoryChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextCategory = event.target.value as CategoryKey;
    const nextGame = CATEGORY_GAMES[nextCategory][0];
    const nextState: Partial<ControlsState> = {
      category: nextCategory,
      game: nextGame,
      running: nextCategory === "miniLessons" ? false : state.running
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
  const isEyeMovement = state.category === "eyeMovement";
  const isIsoDistance = effectiveGame === "isoDistance";
  const isIsoRhythm = effectiveGame === "isoRhythm";
  const usesDistanceSelector = isIsoDistance || isIsoRhythm;
  const isColumnReading = isSpeedReading && effectiveGame === "columnReading";
  const isDoubleNumber = state.category === "visualField" && effectiveGame === "doubleNumber";
  const isReactionCategory = state.category === "reactionTime";
  const isMathCategory = state.category === "math";
  const isMiniLessonCategory = state.category === "miniLessons";
  const levelMax = isEyeMovement ? EYE_MOVEMENT_MAX_LEVEL : DEFAULT_LEVEL_MAX;
  const normalizedLevel = Math.min(levelMax, Math.max(DEFAULT_LEVEL_MIN, state.level));

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
          <option value="reactionTime">{t.controls.categories.reactionTime}</option>
          <option value="math">{t.controls.categories.math}</option>
          <option value="miniLessons">{t.controls.categories.miniLessons}</option>
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

      {usesDistanceSelector && (
        <div className={styles.level}>
          <label className={styles.label}>
            {t.controls.distanceLabel}: {state.distance ?? 3}
          </label>
          <select
            className={styles.select}
            value={state.distance ?? 3}
            onChange={(e) => onChange({ distance: Number(e.target.value) })}
          >
            {Array.from({ length: 9 }, (_, idx) => idx + 1).map((value) => (
              <option key={value} value={value}>
                Distancia {value}
              </option>
            ))}
          </select>
        </div>
      )}

      {!isColumnReading && !isDoubleNumber && !isReactionCategory && !isMathCategory && !isMiniLessonCategory && (
        <div className={styles.level}>
          <label className={styles.label}>
            {t.controls.levelLabel}: {normalizedLevel}
          </label>
          {isEyeMovement ? (
            <select
              className={styles.select}
              value={normalizedLevel}
              onChange={(e) => onChange({ level: Number(e.target.value) })}
            >
              {Array.from({ length: levelMax }, (_, idx) => idx + 1).map((value) => (
                <option key={value} value={value}>
                  Nivel {value}
                </option>
              ))}
            </select>
          ) : (
            <input
              className={styles.range}
              type="range"
              min={DEFAULT_LEVEL_MIN}
              max={levelMax}
              value={normalizedLevel}
              onChange={(e) => onChange({ level: Number(e.target.value) })}
            />
          )}
        </div>
      )}

      {!isColumnReading && !isMiniLessonCategory && (
        <div className={styles.action}>
          <div className={styles.actionRow}>
            <PrimaryButton
              className={styles.button}
              onClick={() => onChange({ running: !state.running })}
              aria-pressed={state.running}
            >
              {state.running ? t.controls.stop : t.controls.start}
            </PrimaryButton>
          </div>

          {extraControls && (
            <div className={styles.extraControls}>{extraControls}</div>
          )}
        </div>
      )}
    </section>
  );
}
