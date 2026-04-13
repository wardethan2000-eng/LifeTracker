import type { JSX } from "react";
import { Suspense } from "react";
import SharedCanvasContent from "./shared-canvas-content";

type Props = {
  params: Promise<{ token: string }>;
};

export default async function SharedCanvasPage({ params }: Props): Promise<JSX.Element> {
  const { token } = await params;

  return (
    <div className="shared-canvas-page">
      <Suspense fallback={<div className="shared-canvas-page__loading"><p className="note">Loading canvas…</p></div>}>
        <SharedCanvasContent token={token} />
      </Suspense>
    </div>
  );
}
