import { t } from "../i18n";

export function Info() {
  return (
    <section style={{ padding: "10px 20px 30px", color: "#b9b9c5" }}>
      <p style={{ margin: 0 }}>{t.app.info}</p>
    </section>
  );
}