"use client";

import type { Entry, IdeaCanvas } from "@aegis/types";
import type { JSX } from "react";
import { useRouter } from "next/navigation";
import { CanvasRenderer } from "../../../../components/canvas-renderer";

type CanvasPageClientProps = {
  householdId: string;
  canvas: IdeaCanvas;
  entries: Entry[];
};

export function CanvasPageClient({
  householdId,
  canvas,
  entries,
}: CanvasPageClientProps): JSX.Element {
  const router = useRouter();

  return (
    <CanvasRenderer
      householdId={householdId}
      canvas={canvas}
      entries={entries}
      onNavigateToNote={(entryId) => {
        router.push(`/notes/${entryId}?householdId=${householdId}`);
      }}
    />
  );
}
