import { t } from "../i18n";
import styles from "./Info.module.scss";

export function Info() {
  return (
    <section className={styles.info}>
      <p className={styles.message}>{t.app.info}</p>
    </section>
  );
}
