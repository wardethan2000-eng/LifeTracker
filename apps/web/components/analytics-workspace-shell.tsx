"use client";

import type { ReactNode } from "react";
import { AnalyticsPanelBoundary, AnalyticsPanelSkeleton } from "./analytics-panel-boundary";
import { TabNav, type TabNavItem } from "./tab-nav";

type AnalyticsWorkspaceShellProps = {
  title: string;
  tabs: TabNavItem[];
  activeTab: string;
  loading?: boolean;
  loadingFallback?: ReactNode;
  headerActions?: ReactNode;
  children: ReactNode;
};

export function AnalyticsWorkspaceShell({
  title,
  tabs,
  activeTab,
  loading = false,
  loadingFallback,
  headerActions,
  children,
}: AnalyticsWorkspaceShellProps): JSX.Element {
  return (
    <div className="analytics-workspace-shell">
      <div className="analytics-workspace-shell__header">
        <div>
          <h2>{title}</h2>
        </div>
        {headerActions ? <div className="analytics-workspace-shell__actions">{headerActions}</div> : null}
      </div>

      <TabNav
        ariaLabel={`${title} sections`}
        variant="analytics"
        items={tabs.map((tab) => ({
          ...tab,
          active: tab.id === activeTab,
        }))}
      />

      <AnalyticsPanelBoundary title={title}>
        {loading ? loadingFallback ?? <AnalyticsPanelSkeleton title={title} /> : children}
      </AnalyticsPanelBoundary>
    </div>
  );
}