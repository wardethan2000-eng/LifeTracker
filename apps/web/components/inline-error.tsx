import type { JSX } from "react";

type InlineErrorProps = {
  message: string | null | undefined;
  className?: string;
  size?: "md" | "sm";
};

export function InlineError({ message, className, size = "md" }: InlineErrorProps): JSX.Element | null {
  if (!message) {
    return null;
  }

  return (
    <p className={`inline-error inline-error--${size}${className ? ` ${className}` : ""}`} role="alert">
      {message}
    </p>
  );
}