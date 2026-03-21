"use client";

import type { JSX } from "react";
import Link from "next/link";

type IdeaProvenanceBarProps = {
  ideaId: string;
  ideaTitle: string;
};

export function IdeaProvenanceBar({ ideaId, ideaTitle }: IdeaProvenanceBarProps): JSX.Element {
  return (
    <div className="provenance-bar">
      <span>💡</span>
      <span>
        Originally captured as an idea:{" "}
        <Link href={`/ideas/${ideaId}`}>{ideaTitle}</Link>
      </span>
    </div>
  );
}
