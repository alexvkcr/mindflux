import { t } from "../i18n";
import styles from "./Header.module.scss";

export function Header() {
  return (
    <header className={styles.header}>
      <h1 className={styles.title}>{t.app.title}</h1>
      <p className={styles.tagline}>{t.app.tagline}</p>
    </header>
  );
}
