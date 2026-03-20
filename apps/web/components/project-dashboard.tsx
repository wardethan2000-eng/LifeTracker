"use client";

import Link from "next/link";
import type { LayoutItem } from "react-grid-layout";
import { DashboardGrid, type DashboardCardDef } from "./dashboard-grid";
import { DashboardNotepad } from "./dashboard-notepad";
import { ProjectProgressBar } from "./project-progress-bar";
import type { ProjectPhaseProgress } from "@lifekeeper/types";

type ProjectDashboardProps = {
  householdId: string;
  projectId: string;
  qs: string;
  status: string;
  statusLabel: string;
  percentComplete: number;
  remainingTaskCount: number;
  totalTaskCount: number;
  completedTaskCount: number;
  blockedTasks: number;
  criticalPathTasks: number;
  completedPhaseCount: number;
  phaseCount: number;
  activePhaseLabel: string | null;
  budgetAmount: number | null;
  totalSpent: number;
  remainingEstimatedHours: number;
  supplyTotalItems: number;
  supplyNeededItems: number;
  linkedAssetCount: number;
  topAssets: { id: string; name: string; relationship: string }[];
  subProjectCount: number;
  recentEntries: { id: string; title: string; entryDate: string }[];
  upcomingTasks: { id: string; title: string; dueDate: string | null; status: string }[];
  phaseProgress: ProjectPhaseProgress[];
};

function formatCurrency(amount: number | null, fallback = "Not set"): string {
  if (amount === null || amount === undefined) return fallback;
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatShortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

const statusColors: Record<string, string> = {
  planning: "info",
  active: "success",
  on_hold: "warning",
  completed: "muted",
  cancelled: "danger",
};

export function ProjectDashboard(props: ProjectDashboardProps) {
  const {
    householdId,
    projectId,
    qs,
    status,
    statusLabel,
    percentComplete,
    remainingTaskCount,
    totalTaskCount,
    completedTaskCount,
    blockedTasks,
    criticalPathTasks,
    completedPhaseCount,
    phaseCount,
    activePhaseLabel,
    budgetAmount,
    totalSpent,
    remainingEstimatedHours,
    supplyTotalItems,
    supplyNeededItems,
    linkedAssetCount,
    topAssets,
    subProjectCount,
    recentEntries,
    upcomingTasks,
    phaseProgress,
  } = props;

  const base = `/projects/${projectId}`;

  const cards: DashboardCardDef[] = [
    {
      key: "tasks",
      title: "Tasks",
      content: (
        <dl className="dashboard-card__kv">
          <div><dt>Remaining</dt><dd>{remainingTaskCount}</dd></div>
          <div><dt>Completed</dt><dd>{completedTaskCount} / {totalTaskCount}</dd></div>
          <div><dt>Blocked</dt><dd>{blockedTasks}</dd></div>
          <div><dt>Critical Path</dt><dd>{criticalPathTasks}</dd></div>
        </dl>
      ),
      footerLink: { label: "View all tasks →", href: `${base}/tasks${qs}` },
    },
    {
      key: "phases",
      title: "Phase Progress",
      content: (
        <div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: "0.82rem", color: "var(--ink-muted)" }}>
              <span>{completedPhaseCount} of {phaseCount} phases</span>
              <span>{percentComplete}%</span>
            </div>
            <ProjectProgressBar
              phases={phaseProgress}
              totalTaskCount={totalTaskCount}
              completedTaskCount={completedTaskCount}
            />
          </div>
          {activePhaseLabel ? (
            <div style={{ fontSize: "0.85rem" }}>
              <span style={{ color: "var(--ink-muted)" }}>Active: </span>
              <strong>{activePhaseLabel}</strong>
            </div>
          ) : null}
        </div>
      ),
      footerLink: { label: "View plan →", href: `${base}/phases${qs}` },
    },
    {
      key: "budget",
      title: "Budget & Spending",
      content: (
        <dl className="dashboard-card__kv">
          <div><dt>Budget</dt><dd>{formatCurrency(budgetAmount)}</dd></div>
          <div><dt>Spent</dt><dd>{formatCurrency(totalSpent, "$0.00")}</dd></div>
          <div><dt>Labor Left</dt><dd>{remainingEstimatedHours.toFixed(1)}h</dd></div>
          <div>
            <dt>Status</dt>
            <dd>
              <span className={`pill pill--${statusColors[status] ?? ""}`} style={{ fontSize: "0.78rem" }}>
                {statusLabel}
              </span>
            </dd>
          </div>
        </dl>
      ),
    },
    {
      key: "inventory",
      title: "Inventory",
      content: (
        <dl className="dashboard-card__kv">
          <div><dt>Total Items</dt><dd>{supplyTotalItems}</dd></div>
          <div><dt>Needed</dt><dd>{supplyNeededItems}</dd></div>
        </dl>
      ),
      footerLink: { label: "View inventory →", href: `${base}/supplies${qs}` },
    },
    {
      key: "upcoming",
      title: "Upcoming Tasks",
      content: upcomingTasks.length > 0 ? (
        <div className="dashboard-card__list">
          {upcomingTasks.map((task) => (
            <div key={task.id} className="dashboard-card__list-item">
              <span>{task.title}</span>
              {task.dueDate ? <span style={{ color: "var(--ink-muted)", fontSize: "0.78rem" }}>{formatShortDate(task.dueDate)}</span> : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="dashboard-card__empty">No upcoming tasks</p>
      ),
      footerLink: { label: "View tasks →", href: `${base}/tasks${qs}` },
    },
    {
      key: "journal",
      title: "Recent Journal",
      content: recentEntries.length > 0 ? (
        <div className="dashboard-card__list">
          {recentEntries.map((entry) => (
            <div key={entry.id} className="dashboard-card__list-item">
              <span>{entry.title || "Untitled"}</span>
              <span style={{ color: "var(--ink-muted)", fontSize: "0.78rem" }}>{formatShortDate(entry.entryDate)}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="dashboard-card__empty">No journal entries yet</p>
      ),
      footerLink: { label: "View journal →", href: `${base}/entries${qs}` },
    },
    {
      key: "notepad",
      title: "Quick Notepad",
      content: (
        <DashboardNotepad
          householdId={householdId}
          entityType="project"
          entityId={projectId}
        />
      ),
    },
    {
      key: "assets",
      title: `Linked Assets (${linkedAssetCount})`,
      content: topAssets.length > 0 ? (
        <div className="dashboard-card__list">
          {topAssets.map((asset) => (
            <div key={asset.id} className="dashboard-card__list-item">
              <Link href={`/assets/${asset.id}`} className="text-link">{asset.name}</Link>
              <span style={{ color: "var(--ink-muted)", fontSize: "0.78rem" }}>{asset.relationship}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="dashboard-card__empty">No assets linked</p>
      ),
    },
  ];

  if (subProjectCount > 0) {
    cards.push({
      key: "subprojects",
      title: `Sub-projects (${subProjectCount})`,
      content: (
        <div style={{ fontSize: "0.88rem" }}>
          <strong>{subProjectCount}</strong> sub-project{subProjectCount === 1 ? "" : "s"}
        </div>
      ),
      footerLink: { label: "View sub-projects →", href: `${base}${qs}` },
    });
  }

  const defaultLayout: LayoutItem[] = [
    { i: "tasks", x: 0, y: 0, w: 1, h: 3, minW: 1, minH: 2 },
    { i: "phases", x: 1, y: 0, w: 1, h: 3, minW: 1, minH: 2 },
    { i: "budget", x: 2, y: 0, w: 1, h: 3, minW: 1, minH: 2 },
    { i: "inventory", x: 3, y: 0, w: 1, h: 3, minW: 1, minH: 2 },
    { i: "upcoming", x: 0, y: 3, w: 2, h: 3, minW: 1, minH: 2 },
    { i: "journal", x: 2, y: 3, w: 2, h: 3, minW: 1, minH: 2 },
    { i: "notepad", x: 0, y: 6, w: 2, h: 4, minW: 1, minH: 3 },
    { i: "assets", x: 2, y: 6, w: 2, h: 3, minW: 1, minH: 2 },
  ];

  if (subProjectCount > 0) {
    defaultLayout.push({ i: "subprojects", x: 0, y: 9, w: 2, h: 2, minW: 1, minH: 2 });
  }

  return (
    <DashboardGrid
      entityType="project"
      entityId={projectId}
      cards={cards}
      defaultLayout={defaultLayout}
    />
  );
}
