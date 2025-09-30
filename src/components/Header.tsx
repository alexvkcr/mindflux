import { t } from "../i18n";

export function Header() {
  return (
    <header style={{ padding: "16px 20px" }}>
      <h1 style={{ margin: 0, fontSize: 28, letterSpacing: 1.5 }}>{t.app.title}</h1>
      <p style={{ marginTop: 6, maxWidth: 840, lineHeight: 1.4 }}>{t.app.tagline}</p>
    </header>
  );
}