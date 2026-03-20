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
};

const COLS = { lg: 4, md: 4, sm: 2, xs: 2, xxs: 1 };
const BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };
const ROW_HEIGHT = 100;
const SETTLE_MS = 400;

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

function layoutFingerprint(layout: readonly LayoutItem[]): string {
  return layout.map(({ i, x, y, w, h }) => `${i}:${x},${y},${w},${h}`).join("|");
}

export function DashboardGrid({
  entityType,
  entityId,
  cards,
  defaultLayout,
}: DashboardGridProps) {
  const [layouts, setLayouts] = useState<ResponsiveLayouts>(() => ({
    lg: compactVertical(defaultLayout),
  }));
  const [loaded, setLoaded] = useState(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFP = useRef(layoutFingerprint(compactVertical(defaultLayout)));
  const { width, containerRef: rawRef, mounted } = useContainerWidth({ initialWidth: 1280 });
  const containerRef = rawRef as React.RefObject<HTMLDivElement>;

  // Load saved layout on mount
  useEffect(() => {
    let cancelled = false;
    getLayoutPreference(entityType, entityId)
      .then((pref) => {
        if (cancelled) return;
        if (pref?.layoutJson) {
          const saved = pref.layoutJson as unknown as LayoutItem[];
          // Discard layouts saved with a wider column grid (e.g. old 12-col)
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
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => { cancelled = true; };
  }, [entityType, entityId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLayoutChange = useCallback(
    (currentLayout: Layout, _allLayouts: ResponsiveLayouts) => {
      if (!loaded) return;

      if (settleTimer.current) clearTimeout(settleTimer.current);
      settleTimer.current = setTimeout(() => {
        const compacted = compactVertical(currentLayout as LayoutItem[]);
        const fp = layoutFingerprint(compacted);
        if (fp === lastFP.current) return;
        lastFP.current = fp;

        setLayouts({ lg: compacted });

        saveLayoutPreference({
          entityType,
          entityId: entityId ?? null,
          layoutJson: compacted.map(({ i, x, y, w, h }) => ({ i, x, y, w, h })),
        }).catch(() => {});
      }, SETTLE_MS);
    },
    [loaded, entityType, entityId]
  );

  if (!loaded || !mounted) {
    return <div ref={containerRef} className="dashboard-grid" style={{ minHeight: 400 }} />;
  }

  return (
    <div ref={containerRef} className="dashboard-grid">
      <ResponsiveGridLayout
        className="react-grid-layout"
        width={width}
        layouts={layouts}
        breakpoints={BREAKPOINTS}
        cols={COLS}
        rowHeight={ROW_HEIGHT}
        dragConfig={{ handle: ".dashboard-card__header" }}
        onLayoutChange={handleLayoutChange}
        margin={[16, 16]}
        containerPadding={[0, 0]}
      >
        {cards.map((card) => (
          <div key={card.key}>
            <div className="dashboard-card">
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
