import type { AssetDetailResponse, AssetTransferList } from "@lifekeeper/types";
import type { JSX } from "react";
import Link from "next/link";
import { AssetLabelActions } from "./asset-label-actions";
import { AttachmentSection } from "./attachment-section";
import { NotesAndCanvasCard, type NccNoteSummary, type NccCanvasSummary } from "./notes-canvas-card";
import {
  formatCategoryLabel,
  formatCurrency,
  formatDateTime,
  formatDueLabel,
  formatScheduleStatus,
  formatTriggerSummary
} from "../lib/formatters";
import { getDisplayPreferences } from "../lib/api";
import {
  formatTimelineSourceLabel,
  formatTransferTypeLabel,
  hobbyStatusBadgeClass,
  renderLogSummary,
  type AssetTimelineFeed
} from "../app/(dashboard)/assets/[assetId]/shared";

type AssetOverviewTabProps = {
  detail: AssetDetailResponse;
  assetId: string;
  transferHistory: AssetTransferList;
  overviewTimeline: AssetTimelineFeed;
  householdId: string;
  recentNote: NccNoteSummary | null;
  canvases: NccCanvasSummary[];
};

export async function AssetOverviewTab({ detail, assetId, transferHistory, overviewTimeline, householdId, recentNote, canvases }: AssetOverviewTabProps): Promise<JSX.Element> {
  const prefs = await getDisplayPreferences().catch(() => ({ pageSize: 25, dateFormat: "US" as const, currencyCode: "USD" }));
  const dueNow = detail.schedules.filter((schedule) => schedule.status === "due" || schedule.status === "overdue");

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      <section className="stats-row">
        <div className="stat-card stat-card--accent">
          <span className="stat-card__label">Condition</span>
          <strong className="stat-card__value">{detail.asset.conditionScore ?? "-"}</strong>
          <span className="stat-card__sub">Latest assessment score</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__label">Hierarchy</span>
          <strong className="stat-card__value">{detail.asset.childAssets.length}</strong>
          <span className="stat-card__sub">Child assets linked</span>
        </div>
        <div className="stat-card stat-card--warning">
          <span className="stat-card__label">Due Now</span>
          <strong className="stat-card__value">{dueNow.length}</strong>
          <span className="stat-card__sub">Schedules requiring action</span>
        </div>
        <div className="stat-card stat-card--danger">
          <span className="stat-card__label">Latest Spend</span>
          <strong className="stat-card__value">
            {detail.recentLogs[0] ? formatCurrency(detail.recentLogs[0].cost, "$0.00", prefs.currencyCode) : "$0.00"}
          </strong>
          <span className="stat-card__sub">Most recent labor cost</span>
        </div>
      </section>

      <div style={{ display: "grid", gap: "24px", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        <section className="panel asset-label-panel">
          <div className="panel__header">
            <h2>Label &amp; QR</h2>
            <span className="pill">Ready to print</span>
          </div>
          <div className="panel__body--padded asset-label-panel__body">
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
                <p>{formatCategoryLabel(detail.asset.category)}{detail.asset.serialNumber ? ` · S/N ${detail.asset.serialNumber}` : ""}</p>
              </div>
            </div>
            <AssetLabelActions
              assetId={detail.asset.id}
              assetName={detail.asset.name}
              assetTag={detail.asset.assetTag}
            />
          </div>
        </section>

        {detail.hobbyLinks.length > 0 ? (
          <section className="panel">
            <div className="panel__header">
              <h2>Linked Hobbies</h2>
            </div>
            <div className="panel__body--padded">
              <div style={{ display: "grid", gap: "12px" }}>
                {detail.hobbyLinks.map((link) => (
                  <div
                    key={link.id}
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "8px",
                      alignItems: "center"
                    }}
                  >
                    <Link href={`/hobbies/${link.hobbyId}`} className="text-link">
                      {link.hobbyName}
                    </Link>
                    <span className={hobbyStatusBadgeClass(link.hobbyStatus)}>{link.hobbyStatus}</span>
                    {link.hobbyType ? <span className="pill">{link.hobbyType}</span> : null}
                    {link.role ? <span style={{ color: "var(--ink-muted)", fontSize: "0.88rem" }}>role: {link.role}</span> : null}
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <section className="panel">
          <div className="panel__header">
            <h2>Photos &amp; Documents</h2>
          </div>
          <div className="panel__body--padded">
            <AttachmentSection
              householdId={detail.asset.householdId}
              entityType="asset"
              entityId={detail.asset.id}
              label=""
            />
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <h2>Due Work</h2>
          </div>
          <div className="panel__body">
            {dueNow.length === 0 ? (
              <p className="panel__empty">No maintenance due.</p>
            ) : (
              <div className="schedule-stack">
                {dueNow.map((schedule) => (
                  <article key={schedule.id} className={`schedule-card schedule-card--${schedule.status}`}>
                    <div className="schedule-card__summary">
                      <div>
                        <p className="eyebrow">{formatTriggerSummary(schedule.triggerConfig)}</p>
                        <h3>{schedule.name}</h3>
                        <p style={{ color: "var(--ink-muted)", fontSize: "0.88rem" }}>
                          {formatDueLabel(schedule.nextDueAt, schedule.nextDueMetricValue, null)}
                        </p>
                      </div>
                      <span className={`status-chip status-chip--${schedule.status}`}>
                        {formatScheduleStatus(schedule.status)}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <h2>Recent Maintenance</h2>
          </div>
          <div className="panel__body">
            {detail.recentLogs.length === 0 ? (
              <p className="panel__empty">No maintenance logs recorded yet.</p>
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
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel__header">
          <h2>Transfer History</h2>
        </div>
        <div className="panel__body--padded">
          {transferHistory.items.length === 0 ? (
            <p className="panel__empty">This asset has not been transferred.</p>
          ) : (
            <div style={{ display: "grid", gap: "16px" }}>
              {transferHistory.items.map((transfer) => (
                <article
                  key={transfer.id}
                  style={{
                    display: "grid",
                    gap: "8px",
                    paddingLeft: "18px",
                    borderLeft: "3px solid var(--border-strong)",
                    position: "relative"
                  }}
                >
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                    <strong>{transfer.fromUser.displayName ?? "Unknown user"}</strong>
                    <span style={{ color: "var(--ink-muted)" }}>to</span>
                    <strong>{transfer.toUser.displayName ?? "Unknown user"}</strong>
                    <span className="pill">{formatTransferTypeLabel(transfer.transferType)}</span>
                    <span className="pill">{formatDateTime(transfer.transferredAt, undefined, undefined, prefs.dateFormat)}</span>
                  </div>
                  <p style={{ margin: 0, color: "var(--ink-muted)" }}>
                    Initiated by {transfer.initiatedBy.displayName ?? "Unknown user"}
                    {transfer.toHouseholdId ? ` into household ${transfer.toHouseholdId}` : " within the current household"}
                  </p>
                  {transfer.reason ? <p style={{ margin: 0 }}><strong>Reason:</strong> {transfer.reason}</p> : null}
                  {transfer.notes ? <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{transfer.notes}</p> : null}
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <NotesAndCanvasCard
        householdId={householdId}
        entityType="asset"
        entityId={assetId}
        recentNote={recentNote}
        canvases={canvases}
        allNotesHref={`/assets/${assetId}/history`}
      />

      <section className="panel">
        <div className="panel__header">
          <h2>Recent Timeline</h2>
          <Link href={`/assets/${detail.asset.id}/history`} className="text-link">View All</Link>
        </div>
        <div className="panel__body">
          {overviewTimeline.items.length > 0 ? (
            <div className="log-list">
              {overviewTimeline.items.map((item) => (
                <article key={item.id} className="log-card">
                  <div style={{ display: "grid", gap: "8px" }}>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                      <span className={`timeline-item__source-badge timeline-item__source-badge--${item.sourceType}`}>
                        {formatTimelineSourceLabel(item.sourceType)}
                      </span>
                      <strong>{item.title}</strong>
                    </div>
                    <span style={{ fontSize: "0.82rem", color: "var(--ink-muted)" }}>{formatDateTime(item.eventDate, undefined, undefined, prefs.dateFormat)}</span>
                  </div>
                  {item.cost !== null ? <strong>{formatCurrency(item.cost, undefined, prefs.currencyCode)}</strong> : null}
                </article>
              ))}
            </div>
          ) : (
            <p className="panel__empty">No recent timeline activity yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}