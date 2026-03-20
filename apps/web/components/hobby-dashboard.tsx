"use client";

import Link from "next/link";
import type { LayoutItem } from "react-grid-layout";
import { DashboardGrid, type DashboardCardDef } from "./dashboard-grid";
import { DashboardNotepad } from "./dashboard-notepad";

type SessionSummary = {
  id: string;
  name: string;
  status: string;
  recipeName: string | null;
  startDate: string | null;
  completedDate: string | null;
  rating: number | null;
  completedStepCount: number;
  stepCount: number;
};

type AssetLink = {
  id: string;
  assetId: string;
  assetName: string;
  role: string | null;
};

type EntrySummary = {
  id: string;
  title: string;
  entryDate: string;
};

type HobbyDashboardProps = {
  householdId: string;
  hobbyId: string;
  hobbyName: string;
  status: string;
  hobbyType: string | null;
  activityMode: string;
  lifecycleMode: string;
  sessionCount: number;
  recipeCount: number;
  seriesCount: number;
  activeSessions: SessionSummary[];
  recentSessions: SessionSummary[];
  equipment: AssetLink[];
  recentEntries: EntrySummary[];
};

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "active": return "pill pill--success";
    case "paused": return "pill pill--warning";
    case "archived": return "pill pill--muted";
    case "completed": return "pill pill--success";
    default: return "pill";
  }
}

export function HobbyDashboard(props: HobbyDashboardProps) {
  const {
    householdId,
    hobbyId,
    status,
    hobbyType,
    activityMode,
    sessionCount,
    recipeCount,
    seriesCount,
    activeSessions,
    recentSessions,
    equipment,
    recentEntries,
  } = props;

  const base = `/hobbies/${hobbyId}`;

  const cards: DashboardCardDef[] = [
    {
      key: "stats",
      title: "At a Glance",
      content: (
        <dl className="dashboard-card__kv">
          <div><dt>Status</dt><dd><span className={statusBadgeClass(status)}>{status}</span></dd></div>
          <div><dt>Sessions</dt><dd>{sessionCount}</dd></div>
          <div><dt>Active</dt><dd>{activeSessions.length}</dd></div>
          <div><dt>Completed</dt><dd>{sessionCount - activeSessions.length}</dd></div>
          {hobbyType ? <div><dt>Type</dt><dd>{hobbyType}</dd></div> : null}
          <div><dt>Mode</dt><dd style={{ textTransform: "capitalize" }}>{activityMode}</dd></div>
        </dl>
      ),
    },
    {
      key: "active",
      title: `Active Sessions (${activeSessions.length})`,
      content: activeSessions.length > 0 ? (
        <div className="dashboard-card__list">
          {activeSessions.slice(0, 5).map((s) => (
            <div key={s.id} className="dashboard-card__list-item">
              <Link href={`${base}/sessions/${s.id}`} className="text-link">{s.name}</Link>
              <span style={{ color: "var(--ink-muted)", fontSize: "0.78rem" }}>
                {s.completedStepCount}/{s.stepCount} steps
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="dashboard-card__empty">No active sessions</p>
      ),
      footerLink: { label: "View all sessions →", href: `${base}/sessions` },
    },
    {
      key: "recent",
      title: "Recent Sessions",
      content: recentSessions.length > 0 ? (
        <div className="dashboard-card__list">
          {recentSessions.map((s) => (
            <div key={s.id} className="dashboard-card__list-item">
              <div>
                <Link href={`${base}/sessions/${s.id}`} className="text-link">{s.name}</Link>
                {s.rating != null ? <span style={{ marginLeft: 6, fontSize: "0.82rem" }}>{"★".repeat(s.rating)}</span> : null}
              </div>
              <span style={{ color: "var(--ink-muted)", fontSize: "0.78rem" }}>{formatDate(s.completedDate)}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="dashboard-card__empty">No completed sessions yet</p>
      ),
      footerLink: { label: "View sessions →", href: `${base}/sessions` },
    },
    {
      key: "recipes",
      title: "Recipes & Series",
      content: (
        <dl className="dashboard-card__kv">
          <div><dt>Recipes</dt><dd>{recipeCount}</dd></div>
          <div><dt>Series</dt><dd>{seriesCount}</dd></div>
        </dl>
      ),
      footerLink: recipeCount > 0
        ? { label: "View recipes →", href: `${base}/recipes` }
        : undefined,
    },
    {
      key: "equipment",
      title: `Equipment (${equipment.length})`,
      content: equipment.length > 0 ? (
        <div className="dashboard-card__list">
          {equipment.map((link) => (
            <div key={link.id} className="dashboard-card__list-item">
              <Link href={`/assets/${link.assetId}`} className="text-link">{link.assetName}</Link>
              {link.role ? <span style={{ color: "var(--ink-muted)", fontSize: "0.78rem" }}>{link.role}</span> : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="dashboard-card__empty">No equipment linked</p>
      ),
    },
    {
      key: "journal",
      title: "Recent Journal",
      content: recentEntries.length > 0 ? (
        <div className="dashboard-card__list">
          {recentEntries.map((entry) => (
            <div key={entry.id} className="dashboard-card__list-item">
              <span>{entry.title || "Untitled"}</span>
              <span style={{ color: "var(--ink-muted)", fontSize: "0.78rem" }}>{formatDate(entry.entryDate)}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="dashboard-card__empty">No journal entries yet</p>
      ),
      footerLink: { label: "View journal →", href: `${base}/entries` },
    },
    {
      key: "notepad",
      title: "Quick Notepad",
      content: (
        <DashboardNotepad
          householdId={householdId}
          entityType="hobby"
          entityId={hobbyId}
        />
      ),
    },
  ];

  const defaultLayout: LayoutItem[] = [
    { i: "stats", x: 0, y: 0, w: 1, h: 3, minW: 1, minH: 2 },
    { i: "active", x: 1, y: 0, w: 1, h: 3, minW: 1, minH: 2 },
    { i: "recent", x: 2, y: 0, w: 1, h: 3, minW: 1, minH: 2 },
    { i: "recipes", x: 3, y: 0, w: 1, h: 3, minW: 1, minH: 2 },
    { i: "equipment", x: 0, y: 3, w: 2, h: 3, minW: 1, minH: 2 },
    { i: "journal", x: 2, y: 3, w: 2, h: 3, minW: 1, minH: 2 },
    { i: "notepad", x: 0, y: 6, w: 2, h: 4, minW: 1, minH: 3 },
  ];

  return (
    <DashboardGrid
      entityType="hobby"
      entityId={hobbyId}
      cards={cards}
      defaultLayout={defaultLayout}
    />
  );
}
