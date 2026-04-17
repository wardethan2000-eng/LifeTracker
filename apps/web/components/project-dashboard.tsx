"use client";

import Link from "next/link";
import type { LayoutItem } from "react-grid-layout";
import dynamic from "next/dynamic";
import type { DashboardCardDef } from "./dashboard-grid";
const DashboardGrid = dynamic(() => import("./dashboard-grid").then((m) => ({ default: m.DashboardGrid })), { ssr: false });
import { PinButton } from "./pin-button";
import { ProjectProgressBar } from "./project-progress-bar";
import { AttachmentSection } from "./attachment-section";
import { NotesAndCanvasCard, type NccNoteSummary, type NccCanvasSummary } from "./notes-canvas-card";
import type { ProjectPhaseProgress, IdeaCanvasThumbnail } from "@aegis/types";
import { useFormattedDate } from "../lib/formatted-date";

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
  recentNote: NccNoteSummary | null;
  canvases: NccCanvasSummary[];
  canvasThumbnails?: IdeaCanvasThumbnail[];
};

function formatCurrency(amount: number | null, fallback = "Not set"): string {
  if (amount === null || amount === undefined) return fallback;
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const statusColors: Record<string, string> = {
  planning: "info",
  active: "success",
  on_hold: "warning",
  completed: "muted",
  cancelled: "danger",
};

export function ProjectDashboard(props: ProjectDashboardProps) {
  const { formatDate: formatShortDate } = useFormattedDate();
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
    recentNote,
    canvases,
  } = props;

  const base = `/projects/${projectId}`;
  const nextTask = upcomingTasks[0] ?? null;

  const cards: DashboardCardDef[] = [
    {
      key: "focus",
      title: "Next Focus",
      content: (
        nextTask ? (
          <div className="dashboard-card__focus">
            <strong>{nextTask.title}</strong>
            <p>
              {nextTask.dueDate
                ? `Due ${formatShortDate(nextTask.dueDate)}`
                : "No due date set yet"}
            </p>
            <dl className="dashboard-card__kv">
              <div><dt>Remaining tasks</dt><dd>{remainingTaskCount}</dd></div>
              <div><dt>Blocked</dt><dd>{blockedTasks}</dd></div>
            </dl>
          </div>
        ) : (
          <div className="dashboard-card__focus">
            <strong>{activePhaseLabel ?? "No active phase yet"}</strong>
            <p>Start by defining the next concrete task or phase milestone.</p>
          </div>
        )
      ),
      footerLink: { label: "Open plan →", href: `${base}/phases${qs}` },
    },
    {
      key: "phases",
      title: "Plan Progress",
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
      title: "Budget Snapshot",
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
      title: "Material Readiness",
      content: (
        <dl className="dashboard-card__kv">
          <div><dt>Total Items</dt><dd>{supplyTotalItems}</dd></div>
          <div><dt>Needed</dt><dd>{supplyNeededItems}</dd></div>
        </dl>
      ),
      footerLink: { label: "View materials →", href: `${base}/supplies${qs}` },
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
      footerLink: { label: "View tasks →", href: `${base}/phases${qs}` },
    },
    {
      key: "journal",
      title: "Recent Activity",
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
        <p className="dashboard-card__empty">No log entries yet</p>
      ),
      footerLink: { label: "Open activity →", href: `${base}/notes${qs}` },
    },
    {
      key: "attachments",
      title: "Photos & Documents",
      content: (
        <AttachmentSection
          householdId={householdId}
          entityType="project"
          entityId={projectId}
          compact
          label=""
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
    { i: "focus", x: 0, y: 0, w: 1, h: 3, minW: 1, minH: 2 },
    { i: "phases", x: 1, y: 0, w: 1, h: 3, minW: 1, minH: 2 },
    { i: "budget", x: 2, y: 0, w: 1, h: 3, minW: 1, minH: 2 },
    { i: "inventory", x: 3, y: 0, w: 1, h: 3, minW: 1, minH: 2 },
    { i: "upcoming", x: 0, y: 3, w: 2, h: 3, minW: 1, minH: 2 },
    { i: "journal", x: 2, y: 3, w: 2, h: 3, minW: 1, minH: 2 },
    { i: "assets", x: 0, y: 6, w: 2, h: 3, minW: 1, minH: 2 },
    { i: "attachments", x: 2, y: 6, w: 2, h: 4, minW: 1, minH: 3 },
  ];

  if (subProjectCount > 0) {
    defaultLayout.push({ i: "subprojects", x: 0, y: 9, w: 2, h: 2, minW: 1, minH: 2 });
  }

  return (
    <>
      <div className="dashboard-pin-bar">
        <PinButton entityType="project" entityId={projectId} />
      </div>
      <DashboardGrid
        entityType="project"
        entityId={projectId}
        cards={cards}
        defaultLayout={defaultLayout}
      />
      <div className="ncc-section">
        <NotesAndCanvasCard
          householdId={householdId}
          entityType="project"
          entityId={projectId}
          recentNote={recentNote}
          canvases={canvases}
          allNotesHref={`/projects/${projectId}/notes${qs}`}
        />
      </div>
    </>
  );
}
