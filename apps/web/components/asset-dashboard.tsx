"use client";

import Link from "next/link";
import type { LayoutItem } from "react-grid-layout";
import { DashboardGrid, type DashboardCardDef } from "./dashboard-grid";
import { DashboardNotepad } from "./dashboard-notepad";

type ScheduleSummary = {
  id: string;
  name: string;
  status: string;
  nextDueAt: string | null;
};

type LogSummary = {
  id: string;
  title: string;
  performedAt: string;
  cost: number | null;
};

type TimelineItem = {
  id: string;
  title: string;
  sourceType: string;
  eventDate: string;
};

type HobbyLink = {
  id: string;
  hobbyId: string;
  hobbyName: string;
  hobbyStatus: string;
};

type AssetDashboardProps = {
  householdId: string;
  assetId: string;
  conditionScore: number | null;
  childAssetCount: number;
  dueScheduleCount: number;
  overdueScheduleCount: number;
  totalSchedules: number;
  recentLogCount: number;
  dueWork: ScheduleSummary[];
  recentLogs: LogSummary[];
  recentTimeline: TimelineItem[];
  hobbyLinks: HobbyLink[];
  transferCount: number;
};

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatCurrency(amount: number | null): string {
  if (amount === null || amount === undefined) return "$0.00";
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const statusColors: Record<string, string> = {
  due: "warning",
  overdue: "danger",
  current: "success",
  upcoming: "info",
};

export function AssetDashboard(props: AssetDashboardProps) {
  const {
    householdId,
    assetId,
    conditionScore,
    childAssetCount,
    dueScheduleCount,
    overdueScheduleCount,
    totalSchedules,
    dueWork,
    recentLogs,
    recentTimeline,
    hobbyLinks,
    transferCount,
  } = props;

  const base = `/assets/${assetId}`;

  const cards: DashboardCardDef[] = [
    {
      key: "condition",
      title: "At a Glance",
      content: (
        <dl className="dashboard-card__kv">
          <div><dt>Condition</dt><dd>{conditionScore ?? "Not assessed"}</dd></div>
          <div><dt>Children</dt><dd>{childAssetCount}</dd></div>
          <div><dt>Due</dt><dd>{dueScheduleCount}</dd></div>
          <div><dt>Overdue</dt><dd>{overdueScheduleCount}</dd></div>
          <div><dt>Schedules</dt><dd>{totalSchedules}</dd></div>
          <div><dt>Transfers</dt><dd>{transferCount}</dd></div>
        </dl>
      ),
    },
    {
      key: "duework",
      title: `Due Work (${dueWork.length})`,
      content: dueWork.length > 0 ? (
        <div className="dashboard-card__list">
          {dueWork.map((s) => (
            <div key={s.id} className="dashboard-card__list-item">
              <span>{s.name}</span>
              <span className={`pill pill--${statusColors[s.status] ?? ""}`} style={{ fontSize: "0.72rem" }}>
                {s.status}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="dashboard-card__empty">No due work</p>
      ),
      footerLink: { label: "View schedules →", href: `${base}/schedules` },
    },
    {
      key: "maintenance",
      title: "Recent Maintenance",
      content: recentLogs.length > 0 ? (
        <div className="dashboard-card__list">
          {recentLogs.map((log) => (
            <div key={log.id} className="dashboard-card__list-item">
              <span>{log.title}</span>
              <span style={{ color: "var(--ink-muted)", fontSize: "0.78rem" }}>
                {log.cost !== null ? formatCurrency(log.cost) : formatDate(log.performedAt)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="dashboard-card__empty">No maintenance logged yet</p>
      ),
      footerLink: { label: "View maintenance →", href: `${base}/maintenance` },
    },
    {
      key: "timeline",
      title: "Recent Activity",
      content: recentTimeline.length > 0 ? (
        <div className="dashboard-card__list">
          {recentTimeline.map((item) => (
            <div key={item.id} className="dashboard-card__list-item">
              <span>{item.title}</span>
              <span style={{ color: "var(--ink-muted)", fontSize: "0.78rem" }}>{formatDate(item.eventDate)}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="dashboard-card__empty">No recent activity</p>
      ),
      footerLink: { label: "View history →", href: `${base}/history` },
    },
    {
      key: "hobbies",
      title: `Linked Hobbies (${hobbyLinks.length})`,
      content: hobbyLinks.length > 0 ? (
        <div className="dashboard-card__list">
          {hobbyLinks.map((link) => (
            <div key={link.id} className="dashboard-card__list-item">
              <Link href={`/hobbies/${link.hobbyId}`} className="text-link">{link.hobbyName}</Link>
              <span className="pill" style={{ fontSize: "0.72rem" }}>{link.hobbyStatus}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="dashboard-card__empty">No hobbies linked</p>
      ),
    },
    {
      key: "notepad",
      title: "Quick Notepad",
      content: (
        <DashboardNotepad
          householdId={householdId}
          entityType="asset"
          entityId={assetId}
        />
      ),
    },
  ];

  const defaultLayout: LayoutItem[] = [
    { i: "condition", x: 0, y: 0, w: 4, h: 3, minW: 3, minH: 2 },
    { i: "duework", x: 4, y: 0, w: 4, h: 3, minW: 3, minH: 2 },
    { i: "maintenance", x: 8, y: 0, w: 4, h: 3, minW: 3, minH: 2 },
    { i: "timeline", x: 0, y: 3, w: 4, h: 3, minW: 3, minH: 2 },
    { i: "hobbies", x: 4, y: 3, w: 4, h: 3, minW: 3, minH: 2 },
    { i: "notepad", x: 8, y: 3, w: 4, h: 4, minW: 3, minH: 3 },
  ];

  return (
    <DashboardGrid
      entityType="asset"
      entityId={assetId}
      cards={cards}
      defaultLayout={defaultLayout}
    />
  );
}
