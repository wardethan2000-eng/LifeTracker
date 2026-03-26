"use client";

import type { IdeaCanvasThumbnailNode, IdeaCanvasThumbnailEdge } from "@lifekeeper/types";
import { useMemo } from "react";
import { renderCanvasToSVG } from "../lib/canvas-svg-render";

type CanvasThumbnailProps = {
  nodes: IdeaCanvasThumbnailNode[];
  edges: IdeaCanvasThumbnailEdge[];
  className?: string;
};

function buildImageUrlMap(nodes: IdeaCanvasThumbnailNode[]): Map<string, string> | undefined {
  let map: Map<string, string> | undefined;
  for (const n of nodes) {
    if ((n.objectType === "image" || n.objectType === "object") && n.imageUrl && !n.imageUrl.startsWith("attachment:")) {
      if (!map) map = new Map();
      map.set(n.id, n.imageUrl);
    }
  }
  return map;
}

export function CanvasThumbnail({ nodes, edges, className }: CanvasThumbnailProps) {
  const imageUrlMap = useMemo(() => buildImageUrlMap(nodes), [nodes]);

  const svgString = useMemo(
    () => renderCanvasToSVG(nodes, edges, { backgroundColor: "transparent", imageUrlMap }),
    [nodes, edges, imageUrlMap],
  );

  if (nodes.length === 0) {
    return (
      <svg viewBox="0 0 200 120" className={className}>
        <rect x="30" y="20" width="50" height="30" rx="4" fill="var(--border)" opacity="0.5" />
        <rect x="120" y="20" width="50" height="30" rx="4" fill="var(--border)" opacity="0.5" />
        <rect x="75" y="70" width="50" height="30" rx="4" fill="var(--border)" opacity="0.5" />
        <line x1="80" y1="35" x2="120" y2="35" stroke="var(--ink-muted)" strokeWidth="1" opacity="0.4" />
        <line x1="100" y1="70" x2="80" y2="50" stroke="var(--ink-muted)" strokeWidth="1" opacity="0.4" />
        <line x1="100" y1="70" x2="145" y2="50" stroke="var(--ink-muted)" strokeWidth="1" opacity="0.4" />
      </svg>
    );
  }

  /* eslint-disable react/no-danger -- SVG is generated entirely from our own rendering code (not user HTML) */
  return <div className={className} dangerouslySetInnerHTML={{ __html: svgString }} />;
}
