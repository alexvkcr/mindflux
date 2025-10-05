import { t } from "../i18n";
import styles from "./ControlsBar.module.scss";
import { PrimaryButton } from "./ui/PrimaryButton";

export type CategoryKey = "eyeMovement";
export type GameKey = "basic" | "isoDistance";

export type ControlsState = {
  category: CategoryKey;
  game: GameKey;
  level: number; // 1..9
  running: boolean;
  distance?: number; // 1..9 solo aplica a isoDistance
};

export function ControlsBar(props: {
  state: ControlsState;
  onChange: (next: Partial<ControlsState>) => void;
}) {
  const { state, onChange } = props;

  return (
    <section className={styles.controlsBar}>
      {/* Categoria unica, por defecto */}
      <div className={styles.control}>
        <label className={styles.label}>{t.controls.categoryLabel}</label>
        <select
          className={styles.select}
          value={state.category}
          onChange={(e) => onChange({ category: e.target.value as CategoryKey })}
        >
          <option value="eyeMovement">{t.controls.categories.eyeMovement}</option>
        </select>
      </div>

      {/* Juego unico dentro de la categoria */}
      <div className={styles.control}>
        <label className={styles.label}>{t.controls.gameLabel}</label>
        <select
          className={styles.select}
          value={state.game}
          onChange={(e) => onChange({ game: e.target.value as GameKey })}
        >
          <option value="basic">{t.controls.games.basic}</option>
          <option value="isoDistance">{t.controls.games.isoDistance}</option>
        </select>
      </div>

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

      {/* Botón Arranque/Parar */}
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
