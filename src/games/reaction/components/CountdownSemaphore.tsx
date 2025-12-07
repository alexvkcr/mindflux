import styles from "./CountdownSemaphore.module.scss";

interface CountdownSemaphoreProps {
  stage: number;
}

export function CountdownSemaphore({ stage }: CountdownSemaphoreProps) {
  const lights = [3, 2, 1];
  const isVisible = stage > 0;

  return (
    <div className={styles.semaphore} aria-hidden="true" data-visible={isVisible}>
      {lights.map((value) => {
        const active = stage >= value;
        return (
          <div key={value} className={`${styles.light} ${active ? styles.lightOn : styles.lightOff}`}>
            {value}
          </div>
        );
      })}
    </div>
  );
}
