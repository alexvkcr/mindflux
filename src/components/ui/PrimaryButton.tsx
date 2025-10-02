import type { ButtonHTMLAttributes } from "react";
import styles from "./PrimaryButton.module.scss";

interface PrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  "aria-pressed"?: boolean;
}

export function PrimaryButton(props: PrimaryButtonProps) {
  const { className, children, ...rest } = props;

  return (
    <button 
      className={`${styles.button} ${className || ""}`}
      type="button"
      {...rest}
    >
      {children}
    </button>
  );
}