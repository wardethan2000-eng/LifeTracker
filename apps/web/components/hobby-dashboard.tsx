"use client";

import type { HobbyPracticeGoalSummary, HobbyPracticeRoutineSummary } from "@lifekeeper/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { LayoutItem } from "react-grid-layout";
import { createHobbySession } from "../lib/api";
import { DashboardGrid, type DashboardCardDef } from "./dashboard-grid";
import { PinButton } from "./pin-button";
import { DashboardNotepad } from "./dashboard-notepad";
import { NotesAndCanvasCard, type NccNoteSummary, type NccCanvasSummary } from "./notes-canvas-card";
import { useFormattedDate } from "../lib/formatted-date";

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
  activeGoals: HobbyPracticeGoalSummary[];
  topRoutines: HobbyPracticeRoutineSummary[];
  recentNote: NccNoteSummary | null;
  canvases: NccCanvasSummary[];
};

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
  const { formatDate } = useFormattedDate();
  const router = useRouter();
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
    activeGoals,
    topRoutines,
    recentNote,
    canvases,
  } = props;

  const [quickLogName, setQuickLogName] = useState("");
  const [quickLogSaving, setQuickLogSaving] = useState(false);

  const handleQuickLog = async () => {
    const name = quickLogName.trim();
    if (!name || quickLogSaving) return;
    setQuickLogSaving(true);
    try {
      const session = await createHobbySession(householdId, hobbyId, { name });
      setQuickLogName("");
      router.push(`/hobbies/${hobbyId}/sessions/${session.id}`);
    } finally {
      setQuickLogSaving(false);
    }
  };

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
      footerLink: { label: "Open journal →", href: `${base}/entries` },
    },
    {
      key: "quicklog",
      title: "Log a Session",
      content: (
        <div className="hobby-quick-log">
          <p className="hobby-quick-log__hint">Create a new session and start tracking immediately.</p>
          <div className="hobby-quick-log__row">
            <input
              type="text"
              className="hobby-quick-log__input"
              placeholder="Session name…"
              value={quickLogName}
              onChange={(e) => setQuickLogName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void handleQuickLog(); }}
            />
            <button
              type="button"
              className="button button--primary button--sm"
              onClick={() => void handleQuickLog()}
              disabled={quickLogSaving || !quickLogName.trim()}
            >
              {quickLogSaving ? "Creating…" : "Start"}
            </button>
          </div>
        </div>
      ),
    },
    {
      key: "goals",
      title: `Active Goals (${activeGoals.length})`,
      content: activeGoals.length > 0 ? (
        <div className="dashboard-card__list">
          {activeGoals.map((goal) => (
            <div key={goal.id} className="dashboard-card__list-item dashboard-card__list-item--col">
              <div className="dashboard-card__list-item-row">
                <Link href={`${base}/goals/${goal.id}`} className="text-link">{goal.name}</Link>
                <span style={{ color: "var(--ink-muted)", fontSize: "0.78rem" }}>{goal.currentValue}/{goal.targetValue} {goal.unit}</span>
              </div>
              <div className="mode-progress__bar mode-progress__bar--sm">
                <span style={{ width: `${Math.max(0, Math.min(100, goal.progressPercentage))}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="dashboard-card__empty">No active goals</p>
      ),
      footerLink: { label: "Manage goals →", href: `${base}/practice` },
    },
    {
      key: "routines",
      title: `Routines (${topRoutines.length})`,
      content: topRoutines.length > 0 ? (
        <div className="dashboard-card__list">
          {topRoutines.map((routine) => (
            <div key={routine.id} className="dashboard-card__list-item">
              <Link href={`${base}/routines/${routine.id}`} className="text-link">{routine.name}</Link>
              <span style={{ color: "var(--ink-muted)", fontSize: "0.78rem" }}>
                {routine.currentStreak > 0 ? `🔥 ${routine.currentStreak}` : "No streak"}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="dashboard-card__empty">No routines set up</p>
      ),
      footerLink: { label: "Manage routines →", href: `${base}/practice` },
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
    { i: "quicklog", x: 2, y: 6, w: 2, h: 3, minW: 1, minH: 2 },
    { i: "goals", x: 0, y: 10, w: 2, h: 4, minW: 1, minH: 2 },
    { i: "routines", x: 2, y: 10, w: 2, h: 4, minW: 1, minH: 2 },
  ];

  return (
    <>
      <div className="dashboard-pin-bar">
        <PinButton entityType="hobby" entityId={hobbyId} />
      </div>
      <DashboardGrid
        entityType="hobby"
        entityId={hobbyId}
        cards={cards}
        defaultLayout={defaultLayout}
      />
      <div className="ncc-section">
        <NotesAndCanvasCard
          householdId={householdId}
          entityType="hobby"
          entityId={hobbyId}
          recentNote={recentNote}
          canvases={canvases}
          allNotesHref={`/hobbies/${hobbyId}/entries`}
        />
      </div>
    </>
  );
}
