"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ResponsiveGridLayout,
  useContainerWidth,
} from "react-grid-layout";
import type { LayoutItem, Layout, ResponsiveLayouts } from "react-grid-layout";
import { getLayoutPreference, saveLayoutPreference } from "../lib/api";

export type DashboardCardDef = {
  key: string;
  title: string;
  content: React.ReactNode;
  footerLink?: { label: string; href: string } | undefined;
};

type DashboardGridProps = {
  entityType: string;
  entityId?: string;
  cards: DashboardCardDef[];
  defaultLayout: LayoutItem[];
  serverLayout?: Record<string, unknown>[];
};

const COLS = { lg: 4, md: 4, sm: 2, xs: 2, xxs: 1 };
const BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };
const ROW_HEIGHT = 100;
const SETTLE_MS = 400;
/** Grace period (ms) after a drag stop during which onLayoutChange is ignored
 *  so the library's vertical-biased collision layout can't overwrite a swap. */
const DRAG_GRACE_MS = 600;

/** Compact layout items upward to eliminate vertical gaps. */
function compactVertical(layout: readonly LayoutItem[]): LayoutItem[] {
  const sorted = [...layout].sort((a, b) => a.y - b.y || a.x - b.x);
  const compacted: LayoutItem[] = [];
  for (const item of sorted) {
    let minY = 0;
    for (const placed of compacted) {
      if (item.x < placed.x + placed.w && item.x + item.w > placed.x) {
        minY = Math.max(minY, placed.y + placed.h);
      }
    }
    compacted.push({ ...item, y: minY });
  }
  return compacted;
}

/** Find the card whose center is closest to the dragged card's center,
 *  but only if the dragged card is closer to that card than to its own
 *  original position.  This triggers equally easily in any direction. */
function findSwapTarget(
  current: { x: number; y: number; w: number; h: number; i: string },
  candidates: readonly LayoutItem[],
  original: { x: number; y: number; w: number; h: number },
): string | null {
  const cx = current.x + current.w / 2;
  const cy = current.y + current.h / 2;
  const ox = original.x + original.w / 2;
  const oy = original.y + original.h / 2;
  const distToOrigSq = (cx - ox) ** 2 + (cy - oy) ** 2;

  let bestId: string | null = null;
  let bestDistSq = Infinity;
  for (const c of candidates) {
    if (c.i === current.i) continue;
    const ccx = c.x + c.w / 2;
    const ccy = c.y + c.h / 2;
    const distSq = (cx - ccx) ** 2 + (cy - ccy) ** 2;
    if (distSq < bestDistSq) { bestDistSq = distSq; bestId = c.i; }
  }

  // Only swap when closer to the target than to our own starting spot
  if (bestId && bestDistSq < distToOrigSq) return bestId;
  return null;
}

function layoutFingerprint(layout: readonly LayoutItem[]): string {
  return layout.map(({ i, x, y, w, h }) => `${i}:${x},${y},${w},${h}`).join("|");
}

export function DashboardGrid({
  entityType,
  entityId,
  cards,
  defaultLayout,
  serverLayout,
}: DashboardGridProps) {
  const initialItems = (() => {
    const saved = serverLayout as unknown as LayoutItem[] | undefined;
    if (!saved?.length) return compactVertical(defaultLayout);
    const fits = saved.every((item) => item.x + item.w <= COLS.lg);
    if (!fits) return compactVertical(defaultLayout);
    const savedMap = new Map(saved.map((item) => [item.i, item]));
    const merged = defaultLayout.map((def) => savedMap.get(def.i) ?? def);
    return compactVertical(merged);
  })();

  const [layouts, setLayouts] = useState<ResponsiveLayouts>(() => ({ lg: initialItems }));
  const [loaded, setLoaded] = useState(!!serverLayout);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFP = useRef(layoutFingerprint(initialItems));
  const isDragging = useRef(false);
  const dragEndedAt = useRef(0);
  const preDragLayout = useRef<LayoutItem[]>(initialItems);
  const lastSwapTarget = useRef<string | null>(null);
  const [swapTargetId, setSwapTargetId] = useState<string | null>(null);
  const { width, containerRef: rawRef, mounted } = useContainerWidth({ initialWidth: 1280 });
  const containerRef = rawRef as React.RefObject<HTMLDivElement>;

  useEffect(() => {
    if (serverLayout !== undefined) return;
    let cancelled = false;
    getLayoutPreference(entityType, entityId)
      .then((pref) => {
        if (cancelled) return;
        if (pref?.layoutJson) {
          const saved = pref.layoutJson as unknown as LayoutItem[];
          const fits = saved.every((item) => item.x + item.w <= COLS.lg);
          if (fits) {
            const savedMap = new Map(saved.map((item) => [item.i, item]));
            const merged = defaultLayout.map((def) => savedMap.get(def.i) ?? def);
            const items = compactVertical(merged);
            setLayouts({ lg: items });
            lastFP.current = layoutFingerprint(items);
          }
        }
        setLoaded(true);
      })
      .catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [entityType, entityId]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Compact, fingerprint, persist, and set state in one shot. */
  const persistLayout = useCallback(
    (items: LayoutItem[]) => {
      const compacted = compactVertical(items);
      const fp = layoutFingerprint(compacted);
      if (fp === lastFP.current) return;
      lastFP.current = fp;
      setLayouts({ lg: compacted });
      saveLayoutPreference({
        entityType,
        entityId: entityId ?? null,
        layoutJson: compacted.map(({ i, x, y, w, h }) => ({ i, x, y, w, h })),
      }).catch(() => {});
    },
    [entityType, entityId],
  );

  // ── Drag handlers ─────────────────────────────────────────────────────────

  const handleDragStart = useCallback(
    (layout: Layout, _oldItem: LayoutItem) => {
      isDragging.current = true;
      lastSwapTarget.current = null;
      setSwapTargetId(null);
      preDragLayout.current = (layout as LayoutItem[]).map(
        ({ i, x, y, w, h }) => ({ i, x, y, w, h } as LayoutItem),
      );
    },
    [],
  );

  /** Real-time swap preview.  Uses center-distance detection so horizontal
   *  and vertical swaps trigger equally easily.  During the drag preview we
   *  freeze all non-involved cards—only the swap target slides into the
   *  dragged card's original slot.  No compactVertical here so the grid
   *  stays predictable until the drop finalizes. */
  const handleDrag = useCallback(
    (_layout: Layout, _oldItem: LayoutItem, newItem: LayoutItem) => {
      const pre = preDragLayout.current;
      const origDragged = pre.find((c) => c.i === newItem.i);
      if (!origDragged) return;

      const targetId = findSwapTarget(newItem, pre, origDragged);

      if (targetId === lastSwapTarget.current) return;
      lastSwapTarget.current = targetId;
      setSwapTargetId(targetId);

      const items = pre.map((c) => {
        // Stash dragged card off-screen (library renders it at cursor)
        if (c.i === newItem.i) return { ...c, y: 1000 };
        // Swap target slides into dragged card's original slot
        if (targetId && c.i === targetId) {
          const x = Math.min(origDragged.x, COLS.lg - c.w);
          return { ...c, x, y: origDragged.y };
        }
        // Everyone else stays frozen
        return c;
      });

      // No compactVertical — keep layout stable during drag
      setLayouts({ lg: items });
    },
    [],
  );

  /** Finalize the swap: exchange the two cards' positions, compact, and
   *  persist. */
  const handleDragStop = useCallback(
    (_layout: Layout, _oldItem: LayoutItem, newItem: LayoutItem) => {
      isDragging.current = false;
      dragEndedAt.current = Date.now();
      lastSwapTarget.current = null;
      setSwapTargetId(null);
      if (!loaded) return;

      const pre = preDragLayout.current;
      const origDragged = pre.find((c) => c.i === newItem.i);
      if (!origDragged) return;

      const targetId = findSwapTarget(newItem, pre, origDragged);

      if (!targetId) {
        persistLayout(pre);
        return;
      }

      const origTarget = pre.find((c) => c.i === targetId);
      if (!origTarget) { persistLayout(pre); return; }

      const items = pre.map((c) => {
        if (c.i === newItem.i) {
          const x = Math.min(origTarget.x, COLS.lg - c.w);
          return { ...c, x, y: origTarget.y };
        }
        if (c.i === targetId) {
          const x = Math.min(origDragged.x, COLS.lg - c.w);
          return { ...c, x, y: origDragged.y };
        }
        return c;
      });

      persistLayout(items);
    },
    [loaded, persistLayout],
  );

  /** Handle resize and other non-drag layout changes. Ignored during and
   *  shortly after drags so the library can't overwrite a swap. */
  const handleLayoutChange = useCallback(
    (currentLayout: Layout, _allLayouts: ResponsiveLayouts) => {
      if (!loaded) return;
      if (isDragging.current) return;
      if (Date.now() - dragEndedAt.current < DRAG_GRACE_MS) return;

      if (settleTimer.current) clearTimeout(settleTimer.current);
      settleTimer.current = setTimeout(() => {
        persistLayout(currentLayout as LayoutItem[]);
      }, SETTLE_MS);
    },
    [loaded, persistLayout],
  );

  if (!loaded || !mounted) {
    return <div ref={containerRef} className="dashboard-grid-wrap" style={{ minHeight: 400 }} />;
  }

  return (
    <div ref={containerRef} className="dashboard-grid-wrap">
      <ResponsiveGridLayout
        className="react-grid-layout"
        width={width}
        layouts={layouts}
        breakpoints={BREAKPOINTS}
        cols={COLS}
        rowHeight={ROW_HEIGHT}
        compactType={null}
        dragConfig={{ handle: ".dashboard-card__header" }}
        resizeHandles={["s", "w", "e", "n", "sw", "nw", "se", "ne"]}
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragStop={handleDragStop}
        onLayoutChange={handleLayoutChange}
        margin={[16, 16]}
        containerPadding={[0, 0]}
      >
        {cards.map((card) => (
          <div key={card.key}>
            <div className={`dashboard-card${swapTargetId === card.key ? " dashboard-card--swap-target" : ""}`}>
              <div className="dashboard-card__header">
                <span className="dashboard-card__title">{card.title}</span>
              </div>
              <div className="dashboard-card__body">
                {card.content}
              </div>
              {card.footerLink ? (
                <a href={card.footerLink.href} className="dashboard-card__footer-link">
                  {card.footerLink.label}
                </a>
              ) : null}
            </div>
          </div>
        ))}
      </ResponsiveGridLayout>
    </div>
  );
}
