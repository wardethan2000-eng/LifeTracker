"use client";

import type { SpaceResponse } from "@lifekeeper/types";
import { useRouter } from "next/navigation";
import type { JSX, PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import { useRef, useState } from "react";
import { getSpaceTypeBadge, getSpaceTypeLabel } from "../lib/spaces";

type SpaceTreeMapProps = {
  householdId: string;
  spaces: SpaceResponse[];
};

type PositionedNode = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  space: SpaceResponse;
};

type PositionedLink = {
  fromId: string;
  toId: string;
  path: string;
};

const NODE_WIDTH = 196;
const NODE_HEIGHT = 94;
const NODE_GAP_X = 44;
const NODE_GAP_Y = 122;

const typeColorMap: Record<SpaceResponse["type"], string> = {
  building: "#7a4d2b",
  room: "#2f6b63",
  area: "#3977a8",
  shelf: "#946f1a",
  cabinet: "#6e5a8a",
  drawer: "#3f5f8d",
  tub: "#6f7682",
  bin: "#587236",
  other: "#6a6161"
};

const countLeaves = (node: SpaceResponse): number => {
  if (!node.children || node.children.length === 0) {
    return 1;
  }

  return node.children.reduce((sum, child) => sum + countLeaves(child), 0);
};

const layoutTree = (
  nodes: SpaceResponse[],
  depth: number,
  startX: number,
  positionedNodes: PositionedNode[],
  positionedLinks: PositionedLink[]
): number => {
  let cursorX = startX;

  for (const node of nodes) {
    const children = node.children ?? [];
    const subtreeLeaves = countLeaves(node);
    const subtreeWidth = subtreeLeaves * NODE_WIDTH + Math.max(subtreeLeaves - 1, 0) * NODE_GAP_X;
    const nodeX = cursorX + (subtreeWidth - NODE_WIDTH) / 2;
    const nodeY = depth * NODE_GAP_Y;

    positionedNodes.push({
      id: node.id,
      x: nodeX,
      y: nodeY,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      space: node
    });

    if (children.length > 0) {
      const childStartX = cursorX;
      layoutTree(children, depth + 1, childStartX, positionedNodes, positionedLinks);

      for (const child of children) {
        const childNode = positionedNodes.find((entry) => entry.id === child.id);

        if (!childNode) {
          continue;
        }

        const startY = nodeY + NODE_HEIGHT;
        const endY = childNode.y;
        const startCenterX = nodeX + NODE_WIDTH / 2;
        const endCenterX = childNode.x + NODE_WIDTH / 2;
        const controlY = startY + (endY - startY) / 2;

        positionedLinks.push({
          fromId: node.id,
          toId: child.id,
          path: `M ${startCenterX} ${startY} C ${startCenterX} ${controlY}, ${endCenterX} ${controlY}, ${endCenterX} ${endY}`
        });
      }
    }

    cursorX += subtreeWidth + NODE_GAP_X;
  }

  return cursorX;
};

const buildLayout = (spaces: SpaceResponse[]) => {
  const nodes: PositionedNode[] = [];
  const links: PositionedLink[] = [];
  layoutTree(spaces, 0, 0, nodes, links);

  const width = nodes.reduce((max, node) => Math.max(max, node.x + node.width), 0);
  const height = nodes.reduce((max, node) => Math.max(max, node.y + node.height), 0);

  return {
    nodes,
    links,
    width: width + 80,
    height: height + 80
  };
};

export function SpaceTreeMap({ householdId, spaces }: SpaceTreeMapProps): JSX.Element {
  const router = useRouter();
  const { nodes, links, width, height } = buildLayout(spaces);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragOriginRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 32, y: 32 });
  const [isDragging, setIsDragging] = useState(false);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    dragOriginRef.current = {
      x: event.clientX,
      y: event.clientY,
      panX: pan.x,
      panY: pan.y
    };
    setIsDragging(true);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!dragOriginRef.current) {
      return;
    }

    setPan({
      x: dragOriginRef.current.panX + (event.clientX - dragOriginRef.current.x),
      y: dragOriginRef.current.panY + (event.clientY - dragOriginRef.current.y)
    });
  };

  const handlePointerUp = (): void => {
    dragOriginRef.current = null;
    setIsDragging(false);
  };

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>): void => {
    event.preventDefault();
    const nextZoom = Math.min(1.9, Math.max(0.55, zoom + (event.deltaY < 0 ? 0.08 : -0.08)));
    setZoom(Number(nextZoom.toFixed(2)));
  };

  return (
    <section className="space-tree-map">
      <div className="space-tree-map__toolbar">
        <div>
          <strong>Hierarchy Map</strong>
          <p className="data-table__secondary" style={{ margin: "4px 0 0" }}>
            Drag to pan, scroll to zoom, and select a node to open that space.
          </p>
        </div>
        <div className="space-tree-map__toolbar-actions">
          <button type="button" className="button button--ghost button--sm" onClick={() => setZoom((current) => Math.max(0.55, Number((current - 0.1).toFixed(2))))}>Zoom Out</button>
          <button type="button" className="button button--ghost button--sm" onClick={() => setZoom(1)}>Reset Zoom</button>
          <button type="button" className="button button--ghost button--sm" onClick={() => { setZoom(1); setPan({ x: 32, y: 32 }); }}>Reset View</button>
          <button type="button" className="button button--ghost button--sm" onClick={() => setZoom((current) => Math.min(1.9, Number((current + 0.1).toFixed(2))))}>Zoom In</button>
        </div>
      </div>

      <div
        ref={viewportRef}
        className="space-tree-map__viewport"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onWheel={handleWheel}
        style={{ cursor: isDragging ? "grabbing" : "grab" }}
      >
        <div
          className="space-tree-map__scene"
          style={{
            width,
            height,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0"
          }}
        >
          <svg className="space-tree-map__links" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
            {links.map((link) => (
              <path key={`${link.fromId}-${link.toId}`} d={link.path} />
            ))}
          </svg>

          {nodes.map((node) => {
            const color = typeColorMap[node.space.type];

            return (
              <button
                key={node.id}
                type="button"
                className="space-tree-map__node"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => router.push(`/inventory/spaces/${node.id}?householdId=${householdId}`)}
                style={{
                  left: node.x,
                  top: node.y,
                  width: node.width,
                  height: node.height,
                  borderColor: color,
                  boxShadow: `0 16px 38px color-mix(in srgb, ${color} 18%, transparent)`
                }}
              >
                <div className="space-tree-map__node-topline">
                  <span className="space-tree-map__node-chip" style={{ background: color }}>{getSpaceTypeBadge(node.space.type)}</span>
                  <span className="space-tree-map__node-code">{node.space.shortCode}</span>
                </div>
                <strong className="space-tree-map__node-name">{node.space.name}</strong>
                <span className="space-tree-map__node-meta">{getSpaceTypeLabel(node.space.type)}</span>
                <span className="space-tree-map__node-count">{node.space.totalItemCount ?? 0} items</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
