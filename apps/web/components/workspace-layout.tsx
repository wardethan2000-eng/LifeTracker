"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { TabNav } from "./tab-nav";

export type WorkspaceTab = {
  id: string;
  label: string;
  href: string;
  show?: boolean;
};

type BreadcrumbItem = {
  id: string;
  name: string;
  href: string;
};

type WorkspaceLayoutProps = {
  entityType: "project" | "hobby" | "plan";
  title: string;
  description?: string;
  status?: string;
  statusVariant?: "success" | "warning" | "muted" | "info" | "accent" | "danger";
  breadcrumbs?: BreadcrumbItem[];
  headerActions?: ReactNode;
  headerMeta?: ReactNode;
  tabs: WorkspaceTab[];
  children: ReactNode;
  backHref: string;
  backLabel: string;
};

export function WorkspaceLayout({
  title,
  description,
  status,
  statusVariant,
  breadcrumbs,
  headerActions,
  headerMeta,
  tabs,
  children,
  backHref,
  backLabel,
}: WorkspaceLayoutProps) {
  const pathname = usePathname();
  const visibleTabs = tabs.filter((tab) => tab.show !== false);

  return (
    <>
      <header className="page-header">
        <div>
          {breadcrumbs && breadcrumbs.length > 1 ? (
            <nav className="workspace-breadcrumbs">
              {breadcrumbs.map((crumb, index) => (
                <span key={crumb.id} className="workspace-breadcrumbs__item">
                  {index > 0 && <span className="workspace-breadcrumbs__sep">›</span>}
                  {index < breadcrumbs.length - 1 ? (
                    <Link href={crumb.href} className="text-link">{crumb.name}</Link>
                  ) : (
                    <span className="workspace-breadcrumbs__current">{crumb.name}</span>
                  )}
                </span>
              ))}
            </nav>
          ) : (
            <Link href={backHref} className="text-link" style={{ fontSize: "0.85rem" }}>← {backLabel}</Link>
          )}
          <h1 style={{ marginTop: 4 }}>{title}</h1>
          {description ? <p className="workspace-description">{description}</p> : null}
          {headerMeta ? <div className="workspace-header-meta">{headerMeta}</div> : null}
        </div>
        <div className="page-header__actions">
          {status ? (
            <span className={`pill${statusVariant ? ` pill--${statusVariant}` : ""}`}>{status}</span>
          ) : null}
          {headerActions}
        </div>
      </header>

      <div className="workspace-nav">
        <TabNav
          ariaLabel="Workspace sections"
          variant="pill"
          items={visibleTabs.map((tab) => ({
            id: tab.id,
            label: tab.label,
            href: tab.href,
            active: isTabActive(pathname, tab, visibleTabs),
          }))}
        />
      </div>

      <div className="page-body">
        {children}
      </div>
    </>
  );
}

function isTabActive(pathname: string, tab: WorkspaceTab, allTabs: WorkspaceTab[]): boolean {
  const tabPath = new URL(tab.href, "http://x").pathname;

  if (pathname === tabPath) return true;

  // For overview tab (shortest path), only match exact
  const isOverview = allTabs.every((t) => t === tab || tabPath.length <= new URL(t.href, "http://x").pathname.length);
  if (isOverview) return pathname === tabPath;

  // For other tabs, match prefix
  return pathname.startsWith(tabPath + "/") || pathname === tabPath;
}
