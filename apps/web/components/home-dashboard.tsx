"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LayoutItem } from "react-grid-layout";
import { useState } from "react";
import { DashboardGrid, type DashboardCardDef } from "./dashboard-grid";
import { DashboardNotepad } from "./dashboard-notepad";
import { EntryActionableList } from "./entry-system";
import { removeDashboardPin, saveQuickActionsPreference } from "../lib/api";
import type { DashboardPin } from "@lifekeeper/types";

/* LaunchPad actions moved back to <LaunchPad /> rendered outside the grid */

const statusTones: Record<string, string> = {
  overdue: "danger",
  due: "warning",
  scheduled: "info",
};

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

type IdeaSummaryItem = {
  id: string;
  title: string;
  stage: string;
  priority: string;
  promotionTarget: string | null;
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
  pins: DashboardPin[];
  ideas?: IdeaSummaryItem[];
  savedQuickActionIds?: string[] | null;
};

const AVAILABLE_QUICK_ACTIONS: Array<{ id: string; label: string; href: string }> = [
  { id: "add-asset", label: "+ New Asset", href: "/assets/new" },
  { id: "view-projects", label: "View Projects", href: "/projects" },
  { id: "maintenance-queue", label: "Maintenance Queue", href: "/maintenance" },
  { id: "asset-registry", label: "Asset Registry", href: "/assets" },
  { id: "notifications", label: "Notifications", href: "/notifications" },
  { id: "add-project", label: "New Project", href: "/projects/new" },
  { id: "browse-ideas", label: "Browse Ideas", href: "/ideas" },
  { id: "inventory", label: "Inventory", href: "/inventory" },
  { id: "add-hobby", label: "Log a Hobby", href: "/hobbies" },
];

const DEFAULT_QUICK_ACTION_IDS = ["add-asset", "view-projects", "maintenance-queue", "asset-registry", "notifications"];

export function HomeDashboard(props: HomeDashboardProps) {
  const router = useRouter();
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
    pins,
    ideas = [],
    savedQuickActionIds,
  } = props;

  const [editingQuickActions, setEditingQuickActions] = useState(false);
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const [activeQuickActionIds, setActiveQuickActionIds] = useState<string[]>(
    savedQuickActionIds ?? DEFAULT_QUICK_ACTION_IDS
  );
  const [isSavingQuickActions, setIsSavingQuickActions] = useState(false);

  const startEditQuickActions = (): void => {
    setPendingIds([...activeQuickActionIds]);
    setEditingQuickActions(true);
  };

  const cancelEditQuickActions = (): void => {
    setEditingQuickActions(false);
    setPendingIds([]);
  };

  const saveQuickActions = async (): Promise<void> => {
    setIsSavingQuickActions(true);
    try {
      await saveQuickActionsPreference(pendingIds);
      setActiveQuickActionIds(pendingIds);
      setEditingQuickActions(false);
      setPendingIds([]);
    } finally {
      setIsSavingQuickActions(false);
    }
  };

  const togglePendingAction = (id: string): void => {
    setPendingIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleUnpin = async (pinId: string) => {
    await removeDashboardPin(pinId);
    router.refresh();
  };

  const cards: DashboardCardDef[] = [
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
      content: editingQuickActions ? (
        <div className="quick-actions-editor">
          <p className="quick-actions-editor__hint">Select which actions appear on your dashboard:</p>
          <ul className="quick-actions-editor__list">
            {AVAILABLE_QUICK_ACTIONS.map((action) => (
              <li key={action.id}>
                <label className="quick-actions-editor__item">
                  <input
                    type="checkbox"
                    checked={pendingIds.includes(action.id)}
                    onChange={() => togglePendingAction(action.id)}
                  />
                  {action.label}
                </label>
              </li>
            ))}
          </ul>
          <div className="quick-actions-editor__footer">
            <button
              type="button"
              className="button button--ghost button--sm"
              onClick={cancelEditQuickActions}
              disabled={isSavingQuickActions}
            >
              Cancel
            </button>
            <button
              type="button"
              className="button button--primary button--sm"
              onClick={() => { void saveQuickActions(); }}
              disabled={isSavingQuickActions || pendingIds.length === 0}
            >
              {isSavingQuickActions ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      ) : (
        <div className="dashboard-card__list" style={{ gap: 4 }}>
          <div className="quick-actions-edit-row">
            <button
              type="button"
              className="quick-actions-edit-btn"
              aria-label="Customize quick actions"
              onClick={startEditQuickActions}
            >
              ✏ Edit
            </button>
          </div>
          {AVAILABLE_QUICK_ACTIONS.filter((a) => activeQuickActionIds.includes(a.id)).map((action) => (
            <Link key={action.id} href={action.href} className="text-link" style={{ padding: "6px 0" }}>
              {action.label}
            </Link>
          ))}
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
      footerLink: { label: "Open notes →", href: "/notes" },
    },
  ];

  if (ideas.length > 0) {
    const sparkCount = ideas.filter((i) => i.stage === "spark").length;
    const developingCount = ideas.filter((i) => i.stage === "developing").length;
    const readyCount = ideas.filter((i) => i.stage === "ready").length;

    const stageLabels: Record<string, string> = { spark: "Spark", developing: "Developing", ready: "Ready" };
    const targetLabels: Record<string, string> = { project: "Project", asset: "Asset", hobby: "Hobby" };
    const priorityLabels: Record<string, string> = { high: "High", medium: "Medium", low: "Low" };

    cards.push({
      key: "ideas",
      title: "💡 Ideas",
      content: (
        <div className="dashboard-card__list">
          <div style={{ fontSize: "0.78rem", color: "var(--ink-muted)", padding: "0 0 6px" }}>
            {sparkCount} spark · {developingCount} developing · {readyCount} ready
          </div>
          {ideas.slice(0, 5).map((idea) => (
            <div key={idea.id} className="dashboard-card__list-item">
              <div>
                <Link href={`/ideas/${idea.id}`} className="text-link" style={{ fontWeight: 500, fontSize: "0.85rem" }}>
                  {idea.title}
                </Link>
                <div style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>
                  {stageLabels[idea.stage] ?? idea.stage}
                  {idea.priority === "high" ? ` · ${priorityLabels[idea.priority]}` : ""}
                  {idea.promotionTarget ? ` → ${targetLabels[idea.promotionTarget]}` : ""}
                </div>
              </div>
            </div>
          ))}
        </div>
      ),
      footerLink: { label: "View all ideas →", href: "/ideas" },
    });
  } else {
    cards.push({
      key: "ideas",
      title: "💡 Ideas",
      content: (
        <div className="dashboard-card__list">
          <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", margin: 0 }}>
            No ideas captured yet.{" "}
            <Link href="/ideas" className="text-link">Quick Capture</Link>
          </p>
        </div>
      ),
      footerLink: { label: "View all ideas →", href: "/ideas" },
    });
  }

  const defaultLayout: LayoutItem[] = [
    { i: "stats", x: 0, y: 0, w: 1, h: 3, minW: 1, minH: 2 },
    { i: "duework", x: 1, y: 0, w: 1, h: 3, minW: 1, minH: 2 },
    { i: "assets", x: 2, y: 0, w: 1, h: 3, minW: 1, minH: 2 },
    { i: "notifications", x: 3, y: 0, w: 1, h: 3, minW: 1, minH: 2 },
    { i: "quickactions", x: 0, y: 3, w: 1, h: 3, minW: 1, minH: 2 },
    { i: "actionitems", x: 1, y: 3, w: 1, h: 3, minW: 1, minH: 2 },
    { i: "notepad", x: 2, y: 3, w: 2, h: 4, minW: 1, minH: 3 },
    ...(ideas.length > 0 ? [{ i: "ideas", x: 0, y: 7, w: 1, h: 3, minW: 1, minH: 2 }] : []),
    ...pins.map((pin, i) => ({
      i: `pin-${pin.entityType}-${pin.entityId}`,
      x: i % 4,
      y: 7 + Math.floor(i / 4) * 3,
      w: 1,
      h: 3,
      minW: 1,
      minH: 2,
    })),
  ];

  const pinCards: DashboardCardDef[] = pins.map((pin) => ({
    key: `pin-${pin.entityType}-${pin.entityId}`,
    title: pin.entityName,
    content: (
      <div className="dashboard-card__pin-body">
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          <span className="pill">{pin.entityType}</span>
          {pin.entityStatus ? (
            <span className="pill">{pin.entityStatus.replace(/_/g, " ")}</span>
          ) : null}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href={pin.entityHref} className="button button--sm">
            Open →
          </Link>
          <button
            type="button"
            className="button button--sm button--ghost"
            onClick={() => handleUnpin(pin.id)}
          >
            Unpin
          </button>
        </div>
      </div>
    ),
  }));

  return (
    <DashboardGrid
      entityType="home"
      cards={[...cards, ...pinCards]}
      defaultLayout={defaultLayout}
    />
  );
}
