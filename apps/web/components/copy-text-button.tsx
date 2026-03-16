"use client";

import type { JSX } from "react";
import { useState } from "react";

type CopyTextButtonProps = {
  value: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
};

export function CopyTextButton({
  value,
  label = "Copy",
  copiedLabel = "Copied",
  className = "button button--ghost button--sm"
}: CopyTextButtonProps): JSX.Element {
  const [copied, setCopied] = useState(false);

  const handleClick = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button type="button" className={className} onClick={() => { void handleClick(); }}>
      {copied ? copiedLabel : label}
    </button>
  );
}