import { t } from "../i18n";

export type CategoryKey = "eyeMovement";
export type GameKey = "basic";

export type ControlsState = {
  category: CategoryKey;
  game: GameKey;
  level: number; // 1..9
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  background: "#0e0e10",
  color: "white",
  border: "1px solid #333",
  borderRadius: 8,
};

export function ControlsBar(props: {
  state: ControlsState;
  onChange: (next: Partial<ControlsState>) => void;
}) {
  const { state, onChange } = props;

  return (
    <section
      style={{
        display: "flex",
        gap: 12,
        padding: "10px 20px",
        overflowX: "auto",
        alignItems: "center",
        borderTop: "1px solid #222",
        borderBottom: "1px solid #222",
      }}
    >
      {/* Categoría (única, por defecto) */}
      <div style={{ minWidth: 220 }}>
        <label style={{ fontSize: 12, opacity: 0.8 }}>{t.controls.categoryLabel}</label>
        <select
          value={state.category}
          onChange={(e) => onChange({ category: e.target.value as CategoryKey })}
          style={selectStyle}
        >
          <option value="eyeMovement">{t.controls.categories.eyeMovement}</option>
        </select>
      </div>

      {/* Juego (único dentro de la categoría) */}
      <div style={{ minWidth: 220 }}>
        <label style={{ fontSize: 12, opacity: 0.8 }}>{t.controls.gameLabel}</label>
        <select
          value={state.game}
          onChange={(e) => onChange({ game: e.target.value as GameKey })}
          style={selectStyle}
        >
          <option value="basic">{t.controls.games.basic}</option>
        </select>
      </div>

      {/* Nivel 1..9 */}
      <div style={{ minWidth: 220 }}>
        <label style={{ fontSize: 12, opacity: 0.8 }}>
          {t.controls.levelLabel}: {state.level}
        </label>
        <input
          type="range"
          min={1}
          max={9}
          value={state.level}
          onChange={(e) => onChange({ level: Number(e.target.value) })}
          style={{ width: "100%" }}
        />
      </div>
    </section>
  );
}

