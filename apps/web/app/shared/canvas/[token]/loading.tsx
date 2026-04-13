import type { JSX } from "react";

export default function SharedCanvasLoading(): JSX.Element {
  return (
    <div className="shared-canvas-page">
      <div className="shared-canvas-page__loading">
        <p className="note">Loading canvas…</p>
      </div>
    </div>
  );
}
