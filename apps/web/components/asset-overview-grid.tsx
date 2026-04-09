"use client";

import type { JSX } from "react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { AssetDetailResponse, AssetTransferList, Entry, OverviewPin } from "@lifekeeper/types";
import { updateEntry, removeOverviewPin } from "../lib/api";
import { useCallback } from "react";
import type { LayoutItem } from "react-grid-layout";
import dynamic from "next/dynamic";
import type { DashboardCardDef } from "./dashboard-grid";
const DashboardGrid = dynamic(() => import("./dashboard-grid").then((m) => ({ default: m.DashboardGrid })), { ssr: false });
import { AssetLabelActions } from "./asset-label-actions";
import { AttachmentSection } from "./attachment-section";
import { NotesAndCanvasCard, type NccNoteSummary, type NccCanvasSummary } from "./notes-canvas-card";
import { useDisplayPreferences } from "./display-preferences-context";
import {
  formatCategoryLabel,
  formatDueLabel,
  formatScheduleStatus,
  formatTriggerSummary,
} from "../lib/formatters";

const SCHEDULE_STATUS_PILL: Record<string, string> = {
  overdue: "pill--danger",
  due: "pill--warning",
  upcoming: "pill--info",
};
import {
  renderLogSummary,
  formatTimelineSourceLabel,
  formatTransferTypeLabel,
  type AssetTimelineFeed,
} from "../app/(dashboard)/assets/[assetId]/shared";
import { completeScheduleAction, createLogAction } from "../app/actions";

type AssetOverviewGridProps = {
  detail: AssetDetailResponse;
  assetId: string;
  transferHistory: AssetTransferList;
  overviewTimeline: AssetTimelineFeed;
  householdId: string;
  recentNote: NccNoteSummary | null;
  canvases: NccCanvasSummary[];
  serverLayout?: Record<string, unknown>[];
  pinnedEntries?: Entry[];
  overviewPins?: OverviewPin[];
};

export function AssetOverviewGrid({
  detail,
  assetId,
  transferHistory,
  overviewTimeline,
  householdId,
  recentNote,
  canvases,
  serverLayout,
  pinnedEntries = [],
  overviewPins = [],
}: AssetOverviewGridProps): JSX.Element {
  const router = useRouter();
  const { preferences, formatDateTime, formatCurrency } = useDisplayPreferences();
  const prefs = { dateFormat: preferences.dateFormat, currencyCode: preferences.currencyCode };

  const dueNow = detail.schedules.filter(
    (s) => s.status === "due" || s.status === "overdue"
  );

  // --- Scheduled quick-log state ---
  const [expandedScheduleId, setExpandedScheduleId] = useState<string | null>(null);
  const [scheduleNotes, setScheduleNotes] = useState("");
  const [scheduleCost, setScheduleCost] = useState("");
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [isCompletePending, startCompleteTransition] = useTransition();

  // --- Unscheduled quick-log state ---
  const [showUnscheduledForm, setShowUnscheduledForm] = useState(false);
  const [unscheduledTitle, setUnscheduledTitle] = useState("");
  const [unscheduledDate, setUnscheduledDate] = useState(
    () => new Date().toISOString().slice(0, 16)
  );
  const [unscheduledNotes, setUnscheduledNotes] = useState("");
  const [unscheduledCost, setUnscheduledCost] = useState("");
  const [unscheduledError, setUnscheduledError] = useState<string | null>(null);
  const [isLogPending, startLogTransition] = useTransition();

  // --- Pinned items state ---
  const [localPinnedEntries, setLocalPinnedEntries] = useState(pinnedEntries);
  const [localPins, setLocalPins] = useState(overviewPins);

  const handleUnpinEntry = useCallback(async (entryId: string, currentFlags: string[]) => {
    const nextFlags = currentFlags.filter((f) => f !== "pinned");
    setLocalPinnedEntries((prev) => prev.filter((e) => e.id !== entryId));
    await updateEntry(householdId, entryId, { flags: nextFlags as Entry["flags"] });
  }, [householdId]);

  const handleUnpinItem = useCallback(async (pinId: string) => {
    setLocalPins((prev) => prev.filter((p) => p.id !== pinId));
    await removeOverviewPin(pinId);
  }, []);

  const handleExpandSchedule = (scheduleId: string) => {
    if (expandedScheduleId === scheduleId) {
      setExpandedScheduleId(null);
    } else {
      setExpandedScheduleId(scheduleId);
      setScheduleNotes("");
      setScheduleCost("");
      setScheduleError(null);
    }
  };

  const handleCompleteSchedule = (scheduleId: string) => {
    setScheduleError(null);
    startCompleteTransition(async () => {
      const fd = new FormData();
      fd.set("assetId", detail.asset.id);
      fd.set("scheduleId", scheduleId);
      fd.set("completedAt", new Date().toISOString());
      if (scheduleNotes) fd.set("notes", scheduleNotes);
      if (scheduleCost) fd.set("cost", scheduleCost);
      try {
        await completeScheduleAction(fd);
        setExpandedScheduleId(null);
        setScheduleNotes("");
        setScheduleCost("");
        router.refresh();
      } catch (err) {
        setScheduleError(err instanceof Error ? err.message : "Failed to complete.");
      }
    });
  };

  const handleLogUnscheduled = () => {
    if (!unscheduledTitle.trim() || !unscheduledDate) return;
    setUnscheduledError(null);
    startLogTransition(async () => {
      const fd = new FormData();
      fd.set("assetId", detail.asset.id);
      fd.set("title", unscheduledTitle.trim());
      fd.set("completedAt", new Date(unscheduledDate).toISOString());
      if (unscheduledNotes) fd.set("notes", unscheduledNotes);
      if (unscheduledCost) fd.set("cost", unscheduledCost);
      try {
        await createLogAction(fd);
        setShowUnscheduledForm(false);
        setUnscheduledTitle("");
        setUnscheduledDate(new Date().toISOString().slice(0, 16));
        setUnscheduledNotes("");
        setUnscheduledCost("");
        setUnscheduledError(null);
        router.refresh();
      } catch (err) {
        setUnscheduledError(err instanceof Error ? err.message : "Failed to log.");
      }
    });
  };

  const hasRelationships =
    detail.hobbyLinks.length > 0 ||
    detail.projectLinks.length > 0 ||
    detail.inventoryLinks.length > 0;

  const cards: DashboardCardDef[] = [
    {
      key: "label",
      title: "Label & QR",
      content: (
        <div className="asset-label-panel__body">
          <div className="asset-label-preview">
            <img
              src={`/api/assets/${detail.asset.id}/label?format=svg&size=260`}
              alt={`QR code for ${detail.asset.name}`}
              className="asset-label-preview__image"
            />
            <div className="asset-label-preview__meta">
              <p className="eyebrow">Asset Tag</p>
              <p className="asset-label-preview__tag">{detail.asset.assetTag}</p>
              <p>{detail.asset.name}</p>
              <p>
                {formatCategoryLabel(detail.asset.category)}
                {detail.asset.serialNumber ? ` · S/N ${detail.asset.serialNumber}` : ""}
              </p>
            </div>
          </div>
          <AssetLabelActions
            assetId={detail.asset.id}
            assetName={detail.asset.name}
            assetTag={detail.asset.assetTag}
          />
        </div>
      ),
    },
    {
      key: "photos",
      title: "Photos & Documents",
      content: (
        <AttachmentSection
          householdId={detail.asset.householdId}
          entityType="asset"
          entityId={detail.asset.id}
          label=""
        />
      ),
    },
    {
      key: "due-work",
      title: "Due Work",
      content:
        dueNow.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state__icon">✅</p>
            <p className="empty-state__title">All caught up</p>
            <p className="empty-state__body">No maintenance is due or overdue.</p>
          </div>
        ) : (
          <div className="schedule-stack">
            {dueNow.map((schedule) => (
              <article
                key={schedule.id}
                className={`schedule-card schedule-card--${schedule.status}`}
              >
                <div className="schedule-card__summary">
                  <div>
                    <p className="eyebrow">{formatTriggerSummary(schedule.triggerConfig)}</p>
                    <h3>{schedule.name}</h3>
                    <p style={{ color: "var(--ink-muted)", fontSize: "0.88rem" }}>
                      {formatDueLabel(schedule.nextDueAt, schedule.nextDueMetricValue, null)}
                    </p>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                      gap: "6px",
                    }}
                  >
                    <span className={`pill ${SCHEDULE_STATUS_PILL[schedule.status] ?? ""}`}>
                      {formatScheduleStatus(schedule.status)}
                    </span>
                    <button
                      type="button"
                      className="button button--ghost button--xs"
                      onClick={() => handleExpandSchedule(schedule.id)}
                      disabled={isCompletePending}
                    >
                      {expandedScheduleId === schedule.id ? "Cancel" : "Log"}
                    </button>
                  </div>
                </div>
                {expandedScheduleId === schedule.id && (
                  <div className="quick-log-form">
                    <div className="quick-log-form__fields">
                      <label className="quick-log-form__field">
                        <span>Notes</span>
                        <textarea
                          rows={2}
                          placeholder="Optional notes"
                          value={scheduleNotes}
                          onChange={(e) => setScheduleNotes(e.target.value)}
                          disabled={isCompletePending}
                        />
                      </label>
                      <label className="quick-log-form__field">
                        <span>Cost</span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={scheduleCost}
                          onChange={(e) => setScheduleCost(e.target.value)}
                          disabled={isCompletePending}
                        />
                      </label>
                    </div>
                    {scheduleError && (
                      <p style={{ color: "var(--danger)", fontSize: "0.82rem", margin: "4px 0 0" }}>
                        {scheduleError}
                      </p>
                    )}
                    <div className="quick-log-form__actions">
                      <button
                        type="button"
                        className="button button--primary button--sm"
                        onClick={() => handleCompleteSchedule(schedule.id)}
                        disabled={isCompletePending}
                      >
                        {isCompletePending ? "Saving…" : "Mark Complete"}
                      </button>
                      <button
                        type="button"
                        className="button button--ghost button--sm"
                        onClick={() => setExpandedScheduleId(null)}
                        disabled={isCompletePending}
                      >
                        Cancel
                      </button>
                      <Link
                        href={`/assets/${assetId}/maintenance`}
                        className="text-link"
                        style={{ fontSize: "0.82rem", marginLeft: "auto" }}
                      >
                        More options →
                      </Link>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        ),
      footerLink: { label: "All schedules →", href: `/assets/${assetId}/maintenance` },
    },
    {
      key: "recent-maintenance",
      title: "Recent Maintenance",
      content: (
        <>
          {showUnscheduledForm ? (
            <div className="quick-log-form quick-log-form--unscheduled">
              <div className="quick-log-form__fields">
                <label className="quick-log-form__field quick-log-form__field--full">
                  <span>What was done?</span>
                  <input
                    type="text"
                    placeholder="Oil change, filter replacement…"
                    value={unscheduledTitle}
                    onChange={(e) => setUnscheduledTitle(e.target.value)}
                    disabled={isLogPending}
                    autoFocus
                  />
                </label>
                <label className="quick-log-form__field">
                  <span>Date &amp; Time</span>
                  <input
                    type="datetime-local"
                    value={unscheduledDate}
                    onChange={(e) => setUnscheduledDate(e.target.value)}
                    disabled={isLogPending}
                  />
                </label>
                <label className="quick-log-form__field">
                  <span>Cost</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={unscheduledCost}
                    onChange={(e) => setUnscheduledCost(e.target.value)}
                    disabled={isLogPending}
                  />
                </label>
                <label className="quick-log-form__field quick-log-form__field--full">
                  <span>Notes</span>
                  <textarea
                    rows={2}
                    placeholder="Optional details"
                    value={unscheduledNotes}
                    onChange={(e) => setUnscheduledNotes(e.target.value)}
                    disabled={isLogPending}
                  />
                </label>
              </div>
              {unscheduledError && (
                <p style={{ color: "var(--danger)", fontSize: "0.82rem", margin: "4px 0 0" }}>
                  {unscheduledError}
                </p>
              )}
              <div className="quick-log-form__actions">
                <button
                  type="button"
                  className="button button--primary button--sm"
                  onClick={handleLogUnscheduled}
                  disabled={isLogPending || !unscheduledTitle.trim() || !unscheduledDate}
                >
                  {isLogPending ? "Saving…" : "Save Log"}
                </button>
                <button
                  type="button"
                  className="button button--ghost button--sm"
                  onClick={() => {
                    setShowUnscheduledForm(false);
                    setUnscheduledError(null);
                  }}
                  disabled={isLogPending}
                >
                  Cancel
                </button>
                <Link
                  href={`/assets/${assetId}/maintenance`}
                  className="text-link"
                  style={{ fontSize: "0.82rem", marginLeft: "auto" }}
                >
                  More options →
                </Link>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "8px" }}>
              <button
                type="button"
                className="button button--ghost button--xs"
                onClick={() => setShowUnscheduledForm(true)}
              >
                + Log
              </button>
            </div>
          )}
          {detail.recentLogs.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state__icon">🔧</p>
              <p className="empty-state__title">No logs yet</p>
              <p className="empty-state__body">Log your first maintenance event above.</p>
            </div>
          ) : (
            <div className="log-list">
              {detail.recentLogs.slice(0, 3).map((log) => (
                <div key={log.id}>
                  {renderLogSummary(log, prefs)}
                  <AttachmentSection
                    householdId={detail.asset.householdId}
                    entityType="maintenance_log"
                    entityId={log.id}
                    compact
                    label=""
                  />
                </div>
              ))}
            </div>
          )}
        </>
      ),
      footerLink: { label: "Full maintenance log →", href: `/assets/${assetId}/maintenance` },
    },
    ...(hasRelationships
      ? [
          {
            key: "relationships",
            title: "Relationships",
            content: (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
                {detail.hobbyLinks.length > 0 && (
                  <span style={{ color: "var(--ink-muted)", fontSize: "0.92rem" }}>
                    {detail.hobbyLinks.length}{" "}
                    {detail.hobbyLinks.length === 1 ? "hobby" : "hobbies"}
                  </span>
                )}
                {detail.projectLinks.length > 0 && (
                  <span style={{ color: "var(--ink-muted)", fontSize: "0.92rem" }}>
                    {detail.projectLinks.length}{" "}
                    {detail.projectLinks.length === 1 ? "project" : "projects"}
                  </span>
                )}
                {detail.inventoryLinks.length > 0 && (
                  <span style={{ color: "var(--ink-muted)", fontSize: "0.92rem" }}>
                    {detail.inventoryLinks.length} linked{" "}
                    {detail.inventoryLinks.length === 1 ? "item" : "items"}
                  </span>
                )}
              </div>
            ),
            footerLink: {
              label: "View all →",
              href: `/assets/${assetId}/relationships`,
            },
          } satisfies DashboardCardDef,
        ]
      : []),
    ...(transferHistory.items.length > 0
      ? [
          {
            key: "transfer-history",
            title: "Transfer History",
            content: (
              <div style={{ display: "grid", gap: "16px" }}>
                {transferHistory.items.map((transfer) => (
                  <article
                    key={transfer.id}
                    style={{
                      paddingLeft: "18px",
                      borderLeft: "3px solid var(--border-strong)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: "10px",
                        flexWrap: "wrap",
                        alignItems: "center",
                      }}
                    >
                      <strong>{transfer.fromUser.displayName ?? "Unknown"}</strong>
                      <span style={{ color: "var(--ink-muted)" }}>→</span>
                      <strong>{transfer.toUser.displayName ?? "Unknown"}</strong>
                      <span className="pill">
                        {formatTransferTypeLabel(transfer.transferType)}
                      </span>
                    </div>
                    <span style={{ fontSize: "0.82rem", color: "var(--ink-muted)" }}>
                      {formatDateTime(transfer.transferredAt)}
                    </span>
                    {transfer.reason ? (
                      <p style={{ margin: "4px 0 0", fontSize: "0.82rem" }}>
                        {transfer.reason}
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            ),
          } satisfies DashboardCardDef,
        ]
      : []),
    {
      key: "notes-canvas",
      title: "Notes & Canvas",
      content: (
        <NotesAndCanvasCard
          householdId={householdId}
          entityType="asset"
          entityId={assetId}
          recentNote={recentNote}
          canvases={canvases}
          allNotesHref={`/assets/${assetId}/history`}
        />
      ),
    },
    {
      key: "recent-timeline",
      title: "Recent Timeline",
      content:
        overviewTimeline.items.length === 0 ? (
          <p className="dashboard-card__empty">No recent activity.</p>
        ) : (
          <div className="log-list">
            {overviewTimeline.items.map((item) => (
              <article key={item.id} className="log-card">
                <div style={{ display: "grid", gap: "8px" }}>
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    <span
                      className={`timeline-item__source-badge timeline-item__source-badge--${item.sourceType}`}
                    >
                      {formatTimelineSourceLabel(item.sourceType)}
                    </span>
                    <strong>{item.title}</strong>
                  </div>
                  <span style={{ fontSize: "0.82rem", color: "var(--ink-muted)" }}>
                    {formatDateTime(item.eventDate)}
                  </span>
                </div>
                {item.cost !== null ? (
                  <strong>{formatCurrency(item.cost)}</strong>
                ) : null}
              </article>
            ))}
          </div>
        ),
      footerLink: { label: "View all →", href: `/assets/${assetId}/history` },
    },
    // --- Pinned notes ---
    ...localPinnedEntries.map((entry) => {
      const preview = entry.bodyFormat === "rich_text"
        ? (entry.body.replace(/<[^>]*>/g, "").trim()).slice(0, 140) + (entry.body.length > 140 ? "…" : "")
        : entry.body.slice(0, 140) + (entry.body.length > 140 ? "…" : "");
      return {
        key: `pin-entry-${entry.id}`,
        title: entry.title ?? "Pinned Note",
        content: (
          <div className="pinned-card-content">
            {preview && <p className="pinned-card-content__preview">{preview}</p>}
            <button
              type="button"
              className="button button--ghost button--xs pinned-card-content__unpin"
              onClick={() => handleUnpinEntry(entry.id, entry.flags as string[])}
              title="Unpin from overview"
            >
              Unpin
            </button>
          </div>
        ),
        footerLink: { label: "Open note →", href: `/notes/${entry.id}?householdId=${householdId}` },
      } satisfies DashboardCardDef;
    }),
    // --- Pinned canvases ---
    ...localPins.filter((p) => p.itemType === "canvas" && p.canvas).map((pin) => ({
      key: `pin-canvas-${pin.itemId}`,
      title: pin.canvas!.name,
      content: (
        <div className="pinned-card-content">
          <p className="pinned-card-content__meta">
            {pin.canvas!.nodeCount} nodes · {pin.canvas!.edgeCount} edges
          </p>
          <button
            type="button"
            className="button button--ghost button--xs pinned-card-content__unpin"
            onClick={() => handleUnpinItem(pin.id)}
            title="Unpin from overview"
          >
            Unpin
          </button>
        </div>
      ),
      footerLink: { label: "Open canvas →", href: `/assets/${assetId}/canvas` },
    } satisfies DashboardCardDef)),
    // --- Pinned attachments ---
    ...localPins.filter((p) => p.itemType === "attachment" && p.attachment).map((pin) => ({
      key: `pin-attachment-${pin.itemId}`,
      title: pin.attachment!.caption ?? pin.attachment!.originalFilename,
      content: (
        <div className="pinned-card-content">
          {pin.attachment!.mimeType.startsWith("image/") && pin.attachment!.thumbnailKey ? (
            <img
              src={`/api/attachments/${pin.attachment!.id}/thumbnail`}
              alt={pin.attachment!.caption ?? pin.attachment!.originalFilename}
              className="pinned-card-content__thumb"
            />
          ) : (
            <span className="pinned-card-content__doc-icon">📄</span>
          )}
          <button
            type="button"
            className="button button--ghost button--xs pinned-card-content__unpin"
            onClick={() => handleUnpinItem(pin.id)}
            title="Unpin from overview"
          >
            Unpin
          </button>
        </div>
      ),
    } satisfies DashboardCardDef)),
  ];

  // Build pinned card layout items (placed below existing cards)
  const allPinnedKeys = [
    ...localPinnedEntries.map((e) => `pin-entry-${e.id}`),
    ...localPins.filter((p) => p.itemType === "canvas").map((p) => `pin-canvas-${p.itemId}`),
    ...localPins.filter((p) => p.itemType === "attachment").map((p) => `pin-attachment-${p.itemId}`),
  ];
  const pinnedLayoutItems: LayoutItem[] = allPinnedKeys.map((key, idx) => ({
    i: key,
    x: idx % 4,
    y: 10 + Math.floor(idx / 4) * 3,
    w: 1,
    h: 3,
    minW: 1,
    minH: 2,
  }));

  const defaultLayout: LayoutItem[] = [
    { i: "label", x: 0, y: 0, w: 1, h: 3, minW: 1, minH: 2 },
    { i: "photos", x: 1, y: 0, w: 1, h: 3, minW: 1, minH: 2 },
    { i: "due-work", x: 2, y: 0, w: 2, h: 4, minW: 1, minH: 2 },
    { i: "recent-maintenance", x: 0, y: 3, w: 2, h: 4, minW: 1, minH: 2 },
    ...(hasRelationships
      ? [{ i: "relationships", x: 2, y: 4, w: 1, h: 2, minW: 1, minH: 2 }]
      : []),
    { i: "transfer-history", x: hasRelationships ? 3 : 2, y: 4, w: 1, h: 3, minW: 1, minH: 2 },
    { i: "notes-canvas", x: 0, y: 7, w: 2, h: 3, minW: 1, minH: 2 },
    { i: "recent-timeline", x: 2, y: 7, w: 2, h: 3, minW: 1, minH: 2 },
    ...pinnedLayoutItems,
  ];

  return (
    <DashboardGrid
      entityType="asset"
      entityId={assetId}
      cards={cards}
      defaultLayout={defaultLayout}
      serverLayout={serverLayout}
    />
  );
}
