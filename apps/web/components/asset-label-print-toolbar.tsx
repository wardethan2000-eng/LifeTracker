"use client";

import type { JSX } from "react";

export function AssetLabelPrintToolbar(): JSX.Element {
  return (
    <button type="button" className="button button--primary button--sm" onClick={() => window.print()}>
      Print
    </button>
  );
}