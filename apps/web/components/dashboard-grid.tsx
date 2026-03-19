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

const COLS = { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 };
const BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };
const ROW_HEIGHT = 80;
const SAVE_DEBOUNCE_MS = 1200;

export function DashboardGrid({
  entityType,
  entityId,
  cards,
  defaultLayout,
}: DashboardGridProps) {
  const [layouts, setLayouts] = useState<ResponsiveLayouts>({ lg: defaultLayout });
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { width, containerRef: rawRef, mounted } = useContainerWidth({ initialWidth: 1280 });
  const containerRef = rawRef as React.RefObject<HTMLDivElement>;

  // Load saved layout on mount
  useEffect(() => {
    let cancelled = false;
    getLayoutPreference(entityType, entityId)
      .then((pref) => {
        if (cancelled) return;
        if (pref?.layoutJson) {
          setLayouts({ lg: pref.layoutJson as unknown as LayoutItem[] });
        }
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => { cancelled = true; };
  }, [entityType, entityId]);

  const handleLayoutChange = useCallback(
    (currentLayout: Layout, _allLayouts: ResponsiveLayouts) => {
      if (!loaded) return;

      // Debounced save
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        const items = currentLayout.map(({ i, x, y, w, h }) => ({ i, x, y, w, h }));
        saveLayoutPreference({
          entityType,
          entityId: entityId ?? null,
          layoutJson: items,
        }).catch(() => {
          // Silent failure — layout will still work, just not persisted
        });
      }, SAVE_DEBOUNCE_MS);
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
