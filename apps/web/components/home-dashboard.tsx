"use client";

import Link from "next/link";
import type { LayoutItem } from "react-grid-layout";
import { DashboardGrid, type DashboardCardDef } from "./dashboard-grid";
import { DashboardNotepad } from "./dashboard-notepad";
import { EntryActionableList } from "./entry-system";

type DueWorkItem = {
  scheduleId: string;
  assetId: string;
  assetName: string;
  scheduleName: string;
  status: string;
  nextDueLabel: string;
};

type AssetSummary = {
  id: string;
  name: string;
  category: string;
  overdueCount: number;
  dueCount: number;
  tone: string;
};

type NotificationSummary = {
  id: string;
  title: string;
  body: string;
  scheduledFor: string;
  href: string | null;
};

type HomeDashboardProps = {
  householdId: string;
  assetCount: number;
  overdueScheduleCount: number;
  dueScheduleCount: number;
  unreadNotificationCount: number;
  overdueAssetCount: number;
  dueAssetCount: number;
  latestAlertTime: string | null;
  dueWork: DueWorkItem[];
  topAssets: AssetSummary[];
  notifications: NotificationSummary[];
  nextDueAssetId: string | null;
  nextDueAssetName: string | null;
};

const launchActions = [
  { href: "/ideas/new", title: "Ideate", desc: "Capture ideas" },
  { href: "/assets/new", title: "Create", desc: "New asset" },
  { href: "/projects/new", title: "Plan", desc: "Start project" },
  { href: "/maintenance", title: "Maintain", desc: "Due work" },
  { href: "/hobbies/new", title: "Pursue", desc: "New hobby" },
];

const statusTones: Record<string, string> = {
  overdue: "danger",
  due: "warning",
  scheduled: "info",
};

export function HomeDashboard(props: HomeDashboardProps) {
  const {
    householdId,
    assetCount,
    overdueScheduleCount,
    dueScheduleCount,
    unreadNotificationCount,
    overdueAssetCount,
    dueAssetCount,
    dueWork,
    topAssets,
    notifications,
    nextDueAssetId,
    nextDueAssetName,
  } = props;

  const cards: DashboardCardDef[] = [
    {
      key: "launch",
      title: "Quick Start",
      content: (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
          {launchActions.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              style={{
                textDecoration: "none",
                textAlign: "center",
                padding: "12px 8px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                display: "block",
              }}
            >
              <strong style={{ display: "block", fontSize: "0.88rem", color: "var(--ink)" }}>{a.title}</strong>
              <span style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>{a.desc}</span>
            </Link>
          ))}
        </div>
      ),
    },
    {
      key: "stats",
      title: "At a Glance",
      content: (
        <dl className="dashboard-card__kv">
          <div><dt>Total Assets</dt><dd>{assetCount}</dd></div>
          <div>
            <dt>Overdue</dt>
            <dd style={overdueScheduleCount > 0 ? { color: "var(--danger)" } : undefined}>
              {overdueScheduleCount} ({overdueAssetCount} assets)
            </dd>
          </div>
          <div>
            <dt>Due Now</dt>
            <dd style={dueScheduleCount > 0 ? { color: "var(--warning)" } : undefined}>
              {dueScheduleCount} ({dueAssetCount} assets)
            </dd>
          </div>
          <div><dt>Unread Alerts</dt><dd>{unreadNotificationCount}</dd></div>
        </dl>
      ),
    },
    {
      key: "duework",
      title: "Upcoming Maintenance",
      content: dueWork.length > 0 ? (
        <div className="dashboard-card__list">
          {dueWork.map((item) => (
            <div key={item.scheduleId} className="dashboard-card__list-item">
              <div>
                <div style={{ fontWeight: 500 }}>{item.scheduleName}</div>
                <div style={{ fontSize: "0.78rem", color: "var(--ink-muted)" }}>{item.assetName}</div>
              </div>
              <span
                className={`pill pill--${statusTones[item.status] ?? ""}`}
                style={{ fontSize: "0.72rem" }}
              >
                {item.status}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="dashboard-card__empty">No due maintenance</p>
      ),
      footerLink: { label: "View maintenance →", href: "/maintenance" },
    },
    {
      key: "assets",
      title: "Asset Health",
      content: topAssets.length > 0 ? (
        <div className="dashboard-card__list">
          {topAssets.map((asset) => (
            <div key={asset.id} className="dashboard-card__list-item">
              <div>
                <Link href={`/assets/${asset.id}`} className="text-link">{asset.name}</Link>
                <div style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>{asset.category}</div>
              </div>
              <span
                className={`status-chip status-chip--${asset.tone}`}
                style={{ fontSize: "0.72rem" }}
              >
                {asset.tone}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="dashboard-card__empty">No assets tracked yet</p>
      ),
      footerLink: { label: "View all assets →", href: "/assets" },
    },
    {
      key: "quickactions",
      title: "Quick Actions",
      content: (
        <div className="dashboard-card__list" style={{ gap: 4 }}>
          <Link href="/assets/new" className="text-link" style={{ padding: "6px 0" }}>+ Add New Asset</Link>
          <Link href="/projects" className="text-link" style={{ padding: "6px 0" }}>View Projects</Link>
          <Link href="/maintenance" className="text-link" style={{ padding: "6px 0" }}>Maintenance Queue</Link>
          <Link href="/assets" className="text-link" style={{ padding: "6px 0" }}>Asset Registry</Link>
          <Link href="/notifications" className="text-link" style={{ padding: "6px 0" }}>Notifications</Link>
          {nextDueAssetId ? (
            <Link href={`/assets/${nextDueAssetId}`} className="text-link" style={{ padding: "6px 0" }}>
              Next Due: {nextDueAssetName}
            </Link>
          ) : null}
        </div>
      ),
    },
    {
      key: "notifications",
      title: "Recent Notifications",
      content: notifications.length > 0 ? (
        <div className="dashboard-card__list">
          {notifications.map((n) => (
            <div key={n.id} className="dashboard-card__list-item">
              <div>
                <div style={{ fontWeight: 500, fontSize: "0.85rem" }}>{n.title}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>{n.scheduledFor}</div>
              </div>
              {n.href ? (
                <Link href={n.href} className="text-link" style={{ fontSize: "0.78rem" }}>View</Link>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="dashboard-card__empty">No notifications</p>
      ),
      footerLink: { label: "View all →", href: "/notifications" },
    },
    {
      key: "actionitems",
      title: "Action Items",
      content: (
        <EntryActionableList householdId={householdId} compact entryHrefStrategy="dashboardActionable" />
      ),
    },
    {
      key: "notepad",
      title: "Quick Notepad",
      content: (
        <DashboardNotepad
          householdId={householdId}
          entityType="home"
          entityId="dashboard"
        />
      ),
    },
  ];

  const defaultLayout: LayoutItem[] = [
    { i: "launch", x: 0, y: 0, w: 4, h: 2, minW: 2, minH: 2 },
    { i: "stats", x: 0, y: 2, w: 4, h: 2, minW: 2, minH: 2 },
    { i: "duework", x: 0, y: 4, w: 2, h: 4, minW: 1, minH: 2 },
    { i: "assets", x: 2, y: 4, w: 2, h: 4, minW: 1, minH: 2 },
    { i: "quickactions", x: 0, y: 8, w: 1, h: 3, minW: 1, minH: 2 },
    { i: "actionitems", x: 1, y: 8, w: 1, h: 3, minW: 1, minH: 2 },
    { i: "notifications", x: 2, y: 8, w: 1, h: 3, minW: 1, minH: 2 },
    { i: "notepad", x: 3, y: 8, w: 1, h: 4, minW: 1, minH: 2 },
  ];

  return (
    <DashboardGrid
      entityType="home"
      cards={cards}
      defaultLayout={defaultLayout}
    />
  );
}
