"use client";

import type { AssetDetailResponse, MaintenanceLog } from "@lifekeeper/types";
import type { JSX } from "react";
import Link from "next/link";
import { AttachmentSection } from "./attachment-section";
import { Card } from "./card";
import { CompactMaintenanceSchedulePreview } from "./compact-maintenance-schedule-preview";
import { ExpandableCard } from "./expandable-card";
import { LogMaintenanceForm } from "./log-maintenance-form";
import { ScheduleCardActions } from "./schedule-card-actions";
import { SectionFilterBar, SectionFilterChildren, SectionFilterProvider, SectionFilterToggle } from "./section-filter";
import { ScheduleForm } from "./schedule-form";
import { ScheduleInventoryLinks } from "./schedule-inventory-links";
import { SchedulePartsReadiness } from "./schedule-parts-readiness";
import {
  formatDueLabel,
  formatScheduleStatus,
  formatTriggerSummary
} from "../lib/formatters";
import { useDisplayPreferences } from "./display-preferences-context";

type AssetMaintenanceSectionsProps = {
  detail: AssetDetailResponse;
  createScheduleAction: (formData: FormData) => void | Promise<void>;
  completeScheduleAction: (formData: FormData) => void | Promise<void>;
  toggleScheduleActiveAction: (formData: FormData) => void | Promise<void>;
  deleteScheduleAction: (formData: FormData) => void | Promise<void>;
  createLogAction: (formData: FormData) => void | Promise<void>;
};

const renderLogSummary = (
  log: MaintenanceLog,
  formatDateTime: (v: string | null | undefined, fb?: string) => string,
  formatCurrency: (v: number | null | undefined, fb?: string) => string
): JSX.Element => (
  <article key={log.id} id={`maintenance-log-${log.id}`} className="log-card">
    <div>
      <h4>{log.title}</h4>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>
        {log.notes ?? "No notes recorded."}
      </p>
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "8px" }}>
        <span className="pill">{formatDateTime(log.completedAt)}</span>
        <span className="pill">Labor {formatCurrency(log.cost, "$0.00")}</span>
        <span className="pill">Parts {formatCurrency(log.totalPartsCost, "$0.00")}</span>
        {log.performedBy ? <span className="pill">By {log.performedBy}</span> : null}
        {log.serviceProviderId ? <span className="pill">Provider linked</span> : null}
      </div>
    </div>
    {log.parts.length > 0 ? (
      <div style={{ minWidth: "260px" }}>
        <div className="eyebrow">Parts Used</div>
        <ul style={{ margin: "8px 0 0 0", paddingLeft: "18px" }}>
          {log.parts.map((part) => (
            <li key={part.id}>
              {part.name}
              {part.partNumber ? ` (${part.partNumber})` : ""}
              {` x${part.quantity}`}
              {part.unitCost !== null ? ` • ${formatCurrency(part.unitCost)}` : ""}
            </li>
          ))}
        </ul>
      </div>
    ) : null}
  </article>
);

export function AssetMaintenanceSections({
  detail,
  createScheduleAction,
  completeScheduleAction,
  toggleScheduleActiveAction,
  deleteScheduleAction,
  createLogAction
}: AssetMaintenanceSectionsProps): JSX.Element {
  const overdueCount = detail.schedules.filter((schedule) => schedule.status === "overdue").length;
  const { formatCurrency, formatDateTime } = useDisplayPreferences();

  return (
    <>
      <SectionFilterProvider items={detail.schedules} keys={["name", "description"]} placeholder="Filter schedules by name or description">
        <ExpandableCard
          title="Maintenance Schedules"
          modalTitle="Maintenance Schedules"
          actions={<SectionFilterToggle />}
          headerContent={<SectionFilterBar />}
          {...(detail.schedules.length > 0
            ? { badge: { count: detail.schedules.length, variant: overdueCount > 0 ? "danger" as const : "warning" as const } }
            : {})}
          previewContent={<CompactMaintenanceSchedulePreview schedules={detail.schedules} />}
        >
          <SectionFilterChildren<AssetDetailResponse["schedules"][number]>>
            {(filteredSchedules) => (
              <>
                {detail.schedules.length === 0 ? <p className="panel__empty">No maintenance schedules active yet.</p> : null}
                {detail.schedules.length > 0 && filteredSchedules.length === 0 ? <p className="panel__empty">No maintenance schedules match that search.</p> : null}
                {filteredSchedules.length > 0 ? (
                  <div className="schedule-stack">
                    {filteredSchedules.map((schedule) => (
                      <article key={schedule.id} className={`schedule-card schedule-card--${schedule.status}`}>
                        <div className="schedule-card__summary">
                          <div>
                            <p className="eyebrow">{formatTriggerSummary(schedule.triggerConfig)}</p>
                            <h3>{schedule.name}</h3>
                            <p style={{ color: "var(--ink-muted)", fontSize: "0.88rem" }}>
                              {schedule.description ?? "No description."}
                            </p>
                          </div>
                          <div className="schedule-card__badges">
                            <span className={`status-chip status-chip--${schedule.status}`}>
                              {formatScheduleStatus(schedule.status)}
                            </span>
                            {!schedule.isActive ? <span className="status-chip status-chip--paused">Paused</span> : null}
                          </div>
                        </div>
                        <dl className="schedule-meta">
                          <div><dt>Next due</dt><dd>{formatDueLabel(schedule.nextDueAt, schedule.nextDueMetricValue, null)}</dd></div>
                          <div><dt>Last completed</dt><dd>{formatDateTime(schedule.lastCompletedAt, "Never")}</dd></div>
                          <div><dt>Assignee</dt><dd>{schedule.assignee?.displayName ?? "Unassigned"}</dd></div>
                          <div><dt>Trigger</dt><dd>{schedule.triggerConfig.type}</dd></div>
                        </dl>
                        <ScheduleInventoryLinks
                          assetId={detail.asset.id}
                          scheduleId={schedule.id}
                          householdId={detail.asset.householdId}
                        />
                        <SchedulePartsReadiness
                          assetId={detail.asset.id}
                          scheduleId={schedule.id}
                        />
                        <ScheduleCardActions
                          householdId={detail.asset.householdId}
                          assetId={detail.asset.id}
                          scheduleId={schedule.id}
                          scheduleName={schedule.name}
                          isActive={schedule.isActive}
                          completeAction={completeScheduleAction}
                          toggleAction={toggleScheduleActiveAction}
                          deleteAction={deleteScheduleAction}
                        />
                      </article>
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </SectionFilterChildren>
        </ExpandableCard>
      </SectionFilterProvider>

      <Card title="Add Schedule">
        <ScheduleForm
          assetId={detail.asset.id}
          metrics={detail.metrics.map((metric) => ({ id: metric.id, name: metric.name, unit: metric.unit }))}
          action={createScheduleAction}
        />
      </Card>

      <SectionFilterProvider items={detail.recentLogs} keys={["title", "notes", "performedBy"]} placeholder="Filter logs by title, notes, or who performed the work">
        <Card
          title="Maintenance Log"
          actions={<SectionFilterToggle />}
          headerContent={<SectionFilterBar />}
        >
          <SectionFilterChildren<MaintenanceLog>>
            {(filteredLogs) => (
              <>
                {detail.recentLogs.length === 0 ? <p className="panel__empty">No maintenance history logged yet.</p> : null}
                {detail.recentLogs.length > 0 && filteredLogs.length === 0 ? <p className="panel__empty">No maintenance logs match that search.</p> : null}
                {filteredLogs.length > 0 ? (
                  <div className="log-list">
                    {filteredLogs.map((log) => (
                      <div key={log.id}>
                        {renderLogSummary(log, formatDateTime, formatCurrency)}
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
                ) : null}
                {detail.recentLogs.length > 0 ? (
                  <div style={{ padding: "12px 0 4px", textAlign: "center" }}>
                    <Link
                      href={`/assets/${detail.asset.id}/history?sourceType=maintenance_log`}
                      className="text-link"
                    >
                      View full maintenance history &rarr;
                    </Link>
                  </div>
                ) : null}
              </>
            )}
          </SectionFilterChildren>
        </Card>
      </SectionFilterProvider>

      <Card title="Log Maintenance">
        <LogMaintenanceForm
          householdId={detail.asset.householdId}
          assetId={detail.asset.id}
          schedules={detail.schedules.map((schedule) => ({ id: schedule.id, name: schedule.name }))}
          createLogAction={createLogAction}
        />
      </Card>
    </>
  );
}
