import type { AssetDetailResponse, MaintenanceLog, UsageMetricEntry, UsageProjection } from "@lifekeeper/types";
import type { JSX } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  applyPresetToAssetAction,
  archiveAssetAction,
  completeScheduleAction,
  createCommentAction,
  createLogAction,
  createMetricAction,
  createMetricEntryAction,
  createScheduleAction,
  deleteCommentAction,
  deleteMetricAction,
  deleteScheduleAction,
  recordConditionAssessmentAction,
  softDeleteAssetAction,
  transferAssetAction,
  toggleScheduleActiveAction,
  unarchiveAssetAction,
  updateAssetAction,
  updateCommentAction,
  updateMetricAction
} from "../../actions";
import { AppShell } from "../../../components/app-shell";
import { AssetDangerActions } from "../../../components/asset-danger-actions";
import { AssetLabelActions } from "../../../components/asset-label-actions";
import { AssetProfileWorkbench } from "../../../components/asset-profile-workbench";
import { ScheduleCardActions } from "../../../components/schedule-card-actions";
import { ScheduleForm } from "../../../components/schedule-form";
import {
  ApiError,
  getAssetComments,
  getAssetDetail,
  getAssetTransferHistory,
  getHouseholdAssets,
  getHouseholdMembers,
  getHouseholdPresets,
  getLibraryPresets,
  getMetricEntries,
  getMetricProjection
} from "../../../lib/api";
import {
  formatCategoryLabel,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatDueLabel,
  formatScheduleStatus,
  formatTriggerSummary,
  formatVisibilityLabel
} from "../../../lib/formatters";

type AssetDetailPageProps = {
  params: Promise<{ assetId: string }>;
  searchParams: Promise<{ tab?: string }>;
};

type MetricInsight = {
  metricId: string;
  entries: UsageMetricEntry[];
  projection: UsageProjection | null;
};

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "details", label: "Structured Details" },
  { id: "metrics", label: "Usage Metrics" },
  { id: "maintenance", label: "Maintenance" },
  { id: "comments", label: "Comments" },
  { id: "settings", label: "Settings" }
] as const;

const renderMetaRow = (label: string, value: string | null | undefined): JSX.Element => (
  <div>
    <dt>{label}</dt>
    <dd>{value && value.trim().length > 0 ? value : "Not set"}</dd>
  </div>
);

const renderMoneyMetaRow = (label: string, value: number | null | undefined): JSX.Element => (
  <div>
    <dt>{label}</dt>
    <dd>{value === null || value === undefined ? "Not set" : formatCurrency(value)}</dd>
  </div>
);

const renderLogSummary = (log: MaintenanceLog): JSX.Element => (
  <article key={log.id} className="log-card">
    <div>
      <h4>{log.title}</h4>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>
        {log.notes ?? "No notes recorded."}
      </p>
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "8px" }}>
        <span className="pill">{formatDateTime(log.completedAt)}</span>
        <span className="pill">Labor {formatCurrency(log.cost, "$0.00")}</span>
        <span className="pill">Parts {formatCurrency(log.totalPartsCost, "$0.00")}</span>
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

const formatTransferTypeLabel = (value: "reassignment" | "household_transfer"): string => value === "reassignment"
  ? "Reassignment"
  : "Household Transfer";

async function loadMetricInsights(assetId: string, detail: AssetDetailResponse): Promise<Record<string, MetricInsight>> {
  const metricPayloads = await Promise.all(
    detail.metrics.map(async (metric) => {
      const [entries, projection] = await Promise.all([
        getMetricEntries(assetId, metric.id),
        getMetricProjection(assetId, metric.id).catch(() => null)
      ]);

      return {
        metricId: metric.id,
        entries,
        projection
      } satisfies MetricInsight;
    })
  );

  return Object.fromEntries(metricPayloads.map((item) => [item.metricId, item]));
}

export default async function AssetDetailPage({ params, searchParams }: AssetDetailPageProps): Promise<JSX.Element> {
  const { assetId } = await params;
  const { tab = "overview" } = await searchParams;

  try {
    const detail = await getAssetDetail(assetId);
    const [libraryPresets, customPresets, householdAssets, householdMembers, metricInsights, comments, transferHistory] = await Promise.all([
      getLibraryPresets(),
      getHouseholdPresets(detail.asset.householdId),
      getHouseholdAssets(detail.asset.householdId),
      getHouseholdMembers(detail.asset.householdId),
      loadMetricInsights(assetId, detail),
      getAssetComments(assetId),
      getAssetTransferHistory(assetId)
    ]);

    const matchingPresets = libraryPresets.filter((preset) => preset.category === detail.asset.category);
    const visiblePresets = matchingPresets.length > 0 ? matchingPresets : libraryPresets;
    const dueNow = detail.schedules.filter((schedule) => schedule.status === "due" || schedule.status === "overdue");
    const sortedConditionHistory = [...detail.asset.conditionHistory].sort((left, right) => (
      right.assessedAt.localeCompare(left.assessedAt)
    ));

    const renderOverviewTab = (): JSX.Element => (
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
              {detail.recentLogs[0] ? formatCurrency(detail.recentLogs[0].cost, "$0.00") : "$0.00"}
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

          <section className="panel">
            <div className="panel__header">
              <h2>Hierarchy</h2>
            </div>
            <div className="panel__body--padded">
              <dl className="data-list">
                <div>
                  <dt>Parent Asset</dt>
                  <dd>
                    {detail.asset.parentAsset ? (
                      <Link href={`/assets/${detail.asset.parentAsset.id}`} className="text-link">
                        {detail.asset.parentAsset.name}
                      </Link>
                    ) : "Top-level asset"}
                  </dd>
                </div>
              </dl>
              {detail.asset.childAssets.length === 0 ? (
                <p className="panel__empty" style={{ marginTop: "16px" }}>No direct child assets linked.</p>
              ) : (
                <div style={{ display: "grid", gap: "12px", marginTop: "16px" }}>
                  {detail.asset.childAssets.map((child) => (
                    <Link key={child.id} href={`/assets/${child.id}`} className="data-table__link">
                      {child.name} · {formatCategoryLabel(child.category)}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel__header">
              <h2>Structured Records</h2>
            </div>
            <div className="panel__body--padded">
              <dl className="data-list">
                {renderMoneyMetaRow("Purchase Price", detail.asset.purchaseDetails?.price ?? null)}
                {renderMetaRow("Purchase Vendor", detail.asset.purchaseDetails?.vendor)}
                {renderMetaRow("Warranty Ends", formatDate(detail.asset.warrantyDetails?.endDate, "Not set"))}
                {renderMetaRow("Location", detail.asset.locationDetails?.room ?? detail.asset.locationDetails?.propertyName ?? null)}
                {renderMetaRow("Insurance Provider", detail.asset.insuranceDetails?.provider)}
                {renderMetaRow("Disposition", detail.asset.dispositionDetails?.method ?? null)}
              </dl>
            </div>
          </section>

          <section className="panel">
            <div className="panel__header">
              <h2>Due Work</h2>
            </div>
            <div className="panel__body">
              {dueNow.length === 0 ? (
                <p className="panel__empty">No maintenance items are currently due.</p>
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
                  {detail.recentLogs.slice(0, 3).map(renderLogSummary)}
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
                      <span className="pill">{formatDateTime(transfer.transferredAt)}</span>
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
      </div>
    );

    const renderDetailsTab = (): JSX.Element => (
      <div style={{ display: "grid", gap: "24px", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        <section className="panel">
          <div className="panel__header">
            <h2>Purchase Details</h2>
          </div>
          <div className="panel__body--padded">
            <dl className="data-list">
              {renderMoneyMetaRow("Price", detail.asset.purchaseDetails?.price ?? null)}
              {renderMetaRow("Vendor", detail.asset.purchaseDetails?.vendor)}
              {renderMetaRow("Condition", detail.asset.purchaseDetails?.condition ?? null)}
              {renderMetaRow("Financing", detail.asset.purchaseDetails?.financing)}
              {renderMetaRow("Receipt Reference", detail.asset.purchaseDetails?.receiptRef)}
            </dl>
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <h2>Warranty Details</h2>
          </div>
          <div className="panel__body--padded">
            <dl className="data-list">
              {renderMetaRow("Provider", detail.asset.warrantyDetails?.provider)}
              {renderMetaRow("Policy Number", detail.asset.warrantyDetails?.policyNumber)}
              {renderMetaRow("Coverage Type", detail.asset.warrantyDetails?.coverageType)}
              {renderMetaRow("Start", formatDate(detail.asset.warrantyDetails?.startDate, "Not set"))}
              {renderMetaRow("End", formatDate(detail.asset.warrantyDetails?.endDate, "Not set"))}
              {renderMetaRow("Notes", detail.asset.warrantyDetails?.notes)}
            </dl>
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <h2>Location Details</h2>
          </div>
          <div className="panel__body--padded">
            <dl className="data-list">
              {renderMetaRow("Property", detail.asset.locationDetails?.propertyName)}
              {renderMetaRow("Building", detail.asset.locationDetails?.building)}
              {renderMetaRow("Room", detail.asset.locationDetails?.room)}
              {renderMetaRow(
                "Coordinates",
                detail.asset.locationDetails?.latitude !== undefined && detail.asset.locationDetails?.longitude !== undefined
                  ? `${detail.asset.locationDetails.latitude}, ${detail.asset.locationDetails.longitude}`
                  : null
              )}
              {renderMetaRow("Notes", detail.asset.locationDetails?.notes)}
            </dl>
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <h2>Insurance & Disposition</h2>
          </div>
          <div className="panel__body--padded">
            <dl className="data-list">
              {renderMetaRow("Insurance Provider", detail.asset.insuranceDetails?.provider)}
              {renderMetaRow("Policy Number", detail.asset.insuranceDetails?.policyNumber)}
              {renderMoneyMetaRow("Coverage Amount", detail.asset.insuranceDetails?.coverageAmount ?? null)}
              {renderMoneyMetaRow("Deductible", detail.asset.insuranceDetails?.deductible ?? null)}
              {renderMetaRow("Renewal Date", formatDate(detail.asset.insuranceDetails?.renewalDate, "Not set"))}
              {renderMetaRow("Disposition Method", detail.asset.dispositionDetails?.method ?? null)}
              {renderMetaRow("Disposition Date", formatDate(detail.asset.dispositionDetails?.date, "Not set"))}
              {renderMoneyMetaRow("Sale Price", detail.asset.dispositionDetails?.salePrice ?? null)}
              {renderMetaRow("Buyer Info", detail.asset.dispositionDetails?.buyerInfo)}
            </dl>
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <h2>Condition History</h2>
          </div>
          <div className="panel__body--padded">
            <form action={recordConditionAssessmentAction} className="form-grid" style={{ marginBottom: "24px" }}>
              <input type="hidden" name="assetId" value={detail.asset.id} />
              <label className="field">
                <span>Score</span>
                <input type="number" name="score" min="1" max="10" step="1" required />
              </label>
              <label className="field field--full">
                <span>Notes</span>
                <textarea name="notes" rows={2} placeholder="Capture condition changes, findings, or observations" />
              </label>
              <button type="submit" className="button button--primary">Record Assessment</button>
            </form>

            {sortedConditionHistory.length === 0 ? (
              <p className="panel__empty">No condition assessments recorded yet.</p>
            ) : (
              <div className="schedule-stack">
                {sortedConditionHistory.map((entry) => (
                  <article key={`${entry.assessedAt}-${entry.score}`} className="schedule-card">
                    <div className="schedule-card__summary">
                      <div>
                        <h3>Score {entry.score}/10</h3>
                        <p style={{ color: "var(--ink-muted)", fontSize: "0.88rem" }}>
                          {entry.notes ?? "No notes recorded."}
                        </p>
                      </div>
                      <span className="pill">{formatDateTime(entry.assessedAt)}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <h2>Profile Fields</h2>
          </div>
          <div className="panel__body--padded">
            {detail.asset.fieldDefinitions.length === 0 ? (
              <p className="panel__empty">No custom profile fields defined.</p>
            ) : (
              <dl className="data-list">
                {detail.asset.fieldDefinitions.map((field) => {
                  const rawValue = detail.asset.customFields[field.key];
                  const renderedValue = rawValue === null || rawValue === undefined || rawValue === ""
                    ? "Not set"
                    : Array.isArray(rawValue)
                      ? rawValue.join(", ")
                      : String(rawValue);

                  return (
                    <div key={field.key}>
                      <dt>{field.label}</dt>
                      <dd>{renderedValue}</dd>
                    </div>
                  );
                })}
              </dl>
            )}
          </div>
        </section>
      </div>
    );

    const renderMetricsTab = (): JSX.Element => (
      <div style={{ display: "grid", gap: "24px" }}>
        <section className="panel">
          <div className="panel__header">
            <h2>Add Usage Metric</h2>
          </div>
          <div className="panel__body--padded">
            <form action={createMetricAction} className="form-grid">
              <input type="hidden" name="assetId" value={detail.asset.id} />
              <label className="field">
                <span>Name</span>
                <input type="text" name="name" placeholder="Odometer" required />
              </label>
              <label className="field">
                <span>Unit</span>
                <input type="text" name="unit" placeholder="miles" required />
              </label>
              <label className="field">
                <span>Starting Value</span>
                <input type="number" name="currentValue" min="0" step="0.1" defaultValue="0" />
              </label>
              <label className="field">
                <span>Recorded At</span>
                <input type="datetime-local" name="lastRecordedAt" />
              </label>
              <button type="submit" className="button button--primary">Create Metric</button>
            </form>
          </div>
        </section>

        {detail.metrics.length === 0 ? (
          <section className="panel">
            <div className="panel__body">
              <p className="panel__empty">No usage metrics yet.</p>
            </div>
          </section>
        ) : (
          <div style={{ display: "grid", gap: "24px" }}>
            {detail.metrics.map((metric) => {
              const insight = metricInsights[metric.id];

              return (
                <section key={metric.id} className="panel">
                  <div className="panel__header">
                    <div>
                      <h2>{metric.name}</h2>
                      <p style={{ margin: "6px 0 0 0", color: "var(--ink-muted)" }}>
                        {metric.currentValue} {metric.unit} • Last recorded {formatDateTime(metric.lastRecordedAt, "never")}
                      </p>
                    </div>
                    <form action={deleteMetricAction}>
                      <input type="hidden" name="assetId" value={detail.asset.id} />
                      <input type="hidden" name="metricId" value={metric.id} />
                      <button type="submit" className="button button--danger button--sm">Delete Metric</button>
                    </form>
                  </div>
                  <div className="panel__body--padded" style={{ display: "grid", gap: "24px" }}>
                    <div style={{ display: "grid", gap: "24px", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
                      <form action={updateMetricAction} className="form-grid">
                        <input type="hidden" name="assetId" value={detail.asset.id} />
                        <input type="hidden" name="metricId" value={metric.id} />
                        <label className="field">
                          <span>Current Value</span>
                          <input type="number" name="currentValue" min="0" step="0.1" defaultValue={metric.currentValue} required />
                        </label>
                        <label className="field">
                          <span>Recorded At</span>
                          <input type="datetime-local" name="lastRecordedAt" />
                        </label>
                        <button type="submit" className="button button--ghost">Update Snapshot</button>
                      </form>

                      <form action={createMetricEntryAction} className="form-grid">
                        <input type="hidden" name="assetId" value={detail.asset.id} />
                        <input type="hidden" name="metricId" value={metric.id} />
                        <label className="field">
                          <span>New Reading</span>
                          <input type="number" name="value" min="0" step="0.1" required />
                        </label>
                        <label className="field">
                          <span>Recorded At</span>
                          <input type="datetime-local" name="recordedAt" />
                        </label>
                        <label className="field">
                          <span>Source</span>
                          <input type="text" name="source" defaultValue="manual" />
                        </label>
                        <label className="field field--full">
                          <span>Notes</span>
                          <textarea name="notes" rows={2} placeholder="Trip complete, service visit, seasonal reading" />
                        </label>
                        <button type="submit" className="button button--primary">Add Entry</button>
                      </form>
                    </div>

                    <div style={{ display: "grid", gap: "24px", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
                      <section>
                        <div className="eyebrow">Projection</div>
                        {insight?.projection ? (
                          <div style={{ display: "grid", gap: "12px", marginTop: "10px" }}>
                            <div className="pill">Rate {insight.projection.currentRate.toFixed(2)} {insight.projection.rateUnit}</div>
                            {insight.projection.projectedValues.length === 0 ? (
                              <p className="panel__empty">No projected values available.</p>
                            ) : (
                              <div className="schedule-stack">
                                {insight.projection.projectedValues.map((projection) => (
                                  <article key={projection.date} className="schedule-card">
                                    <div className="schedule-card__summary">
                                      <div>
                                        <h3>{projection.value.toFixed(1)} {metric.unit}</h3>
                                      </div>
                                      <span className="pill">{formatDate(projection.date)}</span>
                                    </div>
                                  </article>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="panel__empty" style={{ marginTop: "10px" }}>
                            Not enough entry history to compute a projection yet.
                          </p>
                        )}
                      </section>

                      <section>
                        <div className="eyebrow">Recent Entries</div>
                        {insight?.entries.length ? (
                          <div className="schedule-stack" style={{ marginTop: "10px" }}>
                            {insight.entries.slice(0, 8).map((entry) => (
                              <article key={entry.id} className="schedule-card">
                                <div className="schedule-card__summary">
                                  <div>
                                    <h3>{entry.value} {metric.unit}</h3>
                                    <p style={{ color: "var(--ink-muted)", fontSize: "0.88rem" }}>
                                      {entry.source}
                                      {entry.notes ? ` • ${entry.notes}` : ""}
                                    </p>
                                  </div>
                                  <span className="pill">{formatDateTime(entry.recordedAt)}</span>
                                </div>
                              </article>
                            ))}
                          </div>
                        ) : (
                          <p className="panel__empty" style={{ marginTop: "10px" }}>No metric entries recorded yet.</p>
                        )}
                      </section>
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    );

    const renderMaintenanceTab = (): JSX.Element => (
      <div style={{ display: "grid", gap: "24px" }}>
        <section className="panel">
          <div className="panel__header">
            <h2>Maintenance Schedules</h2>
            <span className="pill">{detail.schedules.length}</span>
          </div>
          <div className="panel__body">
            {detail.schedules.length === 0 ? (
              <p className="panel__empty">No maintenance schedules active yet.</p>
            ) : (
              <div className="schedule-stack">
                {detail.schedules.map((schedule) => (
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
                    <ScheduleCardActions
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
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <h2>Add Schedule</h2>
          </div>
          <ScheduleForm
            assetId={detail.asset.id}
            metrics={detail.metrics.map((metric) => ({ id: metric.id, name: metric.name, unit: metric.unit }))}
            action={createScheduleAction}
          />
        </section>

        <section className="panel">
          <div className="panel__header">
            <h2>Maintenance Log</h2>
          </div>
          <div className="panel__body">
            {detail.recentLogs.length === 0 ? (
              <p className="panel__empty">No maintenance history logged yet.</p>
            ) : (
              <div className="log-list">
                {detail.recentLogs.map(renderLogSummary)}
              </div>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <h2>Log Maintenance</h2>
          </div>
          <div className="panel__body--padded">
            <form action={createLogAction} className="form-grid">
              <input type="hidden" name="assetId" value={detail.asset.id} />
              <label className="field field--full">
                <span>Schedule</span>
                <select name="scheduleId" defaultValue="">
                  <option value="">No linked schedule</option>
                  {detail.schedules.map((schedule) => (
                    <option key={schedule.id} value={schedule.id}>{schedule.name}</option>
                  ))}
                </select>
              </label>
              <label className="field field--full">
                <span>Title</span>
                <input type="text" name="title" placeholder="Brake inspection" required />
              </label>
              <label className="field">
                <span>Completed At</span>
                <input type="datetime-local" name="completedAt" required />
              </label>
              <label className="field">
                <span>Usage Value</span>
                <input type="number" name="usageValue" min="0" step="0.1" />
              </label>
              <label className="field">
                <span>Cost</span>
                <input type="number" name="cost" min="0" step="0.01" />
              </label>
              <label className="field">
                <span>Service Provider Id</span>
                <input type="text" name="serviceProviderId" placeholder="Optional structured provider id" />
              </label>
              <label className="field field--full">
                <span>Notes</span>
                <textarea name="notes" rows={3} placeholder="Service notes or findings" />
              </label>
              <label className="field"><span>Part Name</span><input type="text" name="partName" placeholder="Oil filter" /></label>
              <label className="field"><span>Part Number</span><input type="text" name="partNumber" placeholder="FL-500S" /></label>
              <label className="field"><span>Quantity</span><input type="number" name="partQuantity" min="0" step="0.1" placeholder="1" /></label>
              <label className="field"><span>Unit Cost</span><input type="number" name="partUnitCost" min="0" step="0.01" placeholder="8.97" /></label>
              <label className="field"><span>Supplier</span><input type="text" name="partSupplier" placeholder="AutoZone" /></label>
              <label className="field field--full"><span>Part Notes</span><textarea name="partNotes" rows={2} placeholder="Optional part note" /></label>
              <button type="submit" className="button button--primary">Add Log Entry</button>
            </form>
          </div>
        </section>
      </div>
    );

    const renderCommentsTab = (): JSX.Element => (
      <div style={{ display: "grid", gap: "24px" }}>
        <section className="panel">
          <div className="panel__header">
            <h2>New Comment</h2>
          </div>
          <div className="panel__body--padded">
            <form action={createCommentAction} className="form-grid">
              <input type="hidden" name="assetId" value={detail.asset.id} />
              <input type="hidden" name="householdId" value={detail.asset.householdId} />
              <label className="field field--full">
                <span>Comment</span>
                <textarea name="body" rows={3} placeholder="Leave a note, issue, or handoff for other household members" required />
              </label>
              <button type="submit" className="button button--primary">Post Comment</button>
            </form>
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <h2>Discussion</h2>
            <span className="pill">{comments.length}</span>
          </div>
          <div className="panel__body">
            {comments.length === 0 ? (
              <p className="panel__empty">No comments on this asset yet.</p>
            ) : (
              <div className="schedule-stack">
                {comments.map((comment) => (
                  <article key={comment.id} className="schedule-card">
                    <div className="schedule-card__summary">
                      <div>
                        <h3>{comment.author.displayName ?? "Household member"}</h3>
                        <p style={{ color: "var(--ink-muted)", fontSize: "0.88rem" }}>
                          {formatDateTime(comment.createdAt)}
                          {comment.editedAt ? ` • edited ${formatDateTime(comment.editedAt)}` : ""}
                        </p>
                      </div>
                    </div>

                    <p style={{ margin: "0 0 16px 0", whiteSpace: "pre-wrap" }}>{comment.body}</p>

                    <form action={updateCommentAction} className="form-grid" style={{ marginBottom: "16px" }}>
                      <input type="hidden" name="assetId" value={detail.asset.id} />
                      <input type="hidden" name="commentId" value={comment.id} />
                      <label className="field field--full">
                        <span>Edit Comment</span>
                        <textarea name="body" rows={2} defaultValue={comment.body} required />
                      </label>
                      <button type="submit" className="button button--ghost">Save Edit</button>
                    </form>

                    <form action={createCommentAction} className="form-grid" style={{ marginBottom: "16px" }}>
                      <input type="hidden" name="assetId" value={detail.asset.id} />
                      <input type="hidden" name="householdId" value={detail.asset.householdId} />
                      <input type="hidden" name="parentCommentId" value={comment.id} />
                      <label className="field field--full">
                        <span>Reply</span>
                        <textarea name="body" rows={2} placeholder="Add a threaded reply" required />
                      </label>
                      <button type="submit" className="button button--primary">Reply</button>
                    </form>

                    <form action={deleteCommentAction} className="inline-actions inline-actions--end">
                      <input type="hidden" name="assetId" value={detail.asset.id} />
                      <input type="hidden" name="householdId" value={detail.asset.householdId} />
                      <input type="hidden" name="commentId" value={comment.id} />
                      <button type="submit" className="button button--danger button--sm">Delete Comment</button>
                    </form>

                    {comment.replies.length > 0 ? (
                      <div style={{ display: "grid", gap: "12px", marginTop: "18px", paddingLeft: "18px", borderLeft: "2px solid var(--border-color)" }}>
                        {comment.replies.map((reply) => (
                          <div key={reply.id} className="schedule-card">
                            <div className="schedule-card__summary">
                              <div>
                                <h3>{reply.author.displayName ?? "Household member"}</h3>
                                <p style={{ color: "var(--ink-muted)", fontSize: "0.88rem" }}>
                                  {formatDateTime(reply.createdAt)}
                                  {reply.editedAt ? ` • edited ${formatDateTime(reply.editedAt)}` : ""}
                                </p>
                              </div>
                            </div>
                            <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{reply.body}</p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    );

    const renderSettingsTab = (): JSX.Element => (
      <div style={{ display: "grid", gap: "24px" }}>
        <section className="panel">
          <div className="panel__header">
            <h2>Edit Asset</h2>
          </div>
          <div className="panel__body--padded">
            <AssetProfileWorkbench
              action={updateAssetAction}
              householdId={detail.asset.householdId}
              householdAssets={householdAssets}
              submitLabel="Update Asset"
              libraryPresets={visiblePresets}
              customPresets={customPresets}
              initialAsset={detail.asset}
            />
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <h2>Transfer Asset</h2>
          </div>
          <div className="panel__body--padded">
            <form action={transferAssetAction} className="form-grid">
              <input type="hidden" name="assetId" value={detail.asset.id} />
              <input type="hidden" name="householdId" value={detail.asset.householdId} />
              <label className="field">
                <span>Transfer Type</span>
                <select name="transferType" defaultValue="reassignment">
                  <option value="reassignment">Reassignment within household</option>
                  <option value="household_transfer">Transfer to another household</option>
                </select>
              </label>
              <label className="field">
                <span>Reassign To</span>
                <select name="reassignmentToUserId" defaultValue={detail.asset.ownerId ?? ""}>
                  <option value="">Select a household member</option>
                  {householdMembers.map((member) => (
                    <option key={member.userId} value={member.userId}>
                      {member.user.displayName ?? member.user.email ?? member.userId}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Target Household Id</span>
                <input type="text" name="toHouseholdId" placeholder="Required for household transfers" />
              </label>
              <label className="field">
                <span>Target User Id</span>
                <input type="text" name="householdTransferToUserId" placeholder="Destination household member user id" />
              </label>
              <label className="field">
                <span>Reason</span>
                <input type="text" name="reason" placeholder="sold, gifted, reassigned responsibility" />
              </label>
              <label className="field field--full">
                <span>Notes</span>
                <textarea name="notes" rows={3} placeholder="Optional handoff notes, sale details, or household context" />
              </label>
              <button type="submit" className="button button--primary">Transfer Asset</button>
            </form>
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <h2>Apply a Preset</h2>
          </div>
          <div className="preset-grid">
            {visiblePresets.map((preset) => (
              <article key={preset.key} className="preset-card">
                <div>
                  <p className="eyebrow">{formatCategoryLabel(preset.category)}</p>
                  <h3>{preset.label}</h3>
                  <p style={{ fontSize: "0.85rem", color: "var(--ink-muted)" }}>
                    {preset.description ?? "No description."}
                  </p>
                </div>
                <div className="preset-card__meta">
                  <span>{preset.metricTemplates.length} metrics</span>
                  <span>{preset.scheduleTemplates.length} schedules</span>
                </div>
                <form action={applyPresetToAssetAction}>
                  <input type="hidden" name="assetId" value={detail.asset.id} />
                  <input type="hidden" name="presetKey" value={preset.key} />
                  <button type="submit" className="button button--ghost button--sm">Apply</button>
                </form>
              </article>
            ))}
          </div>
        </section>
      </div>
    );

    return (
      <AppShell activePath="/assets">
        <div className="detail-topbar">
          <Link href="/assets" className="text-link">&larr; Back to Assets</Link>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <Link href={`/assets/${detail.asset.id}?tab=maintenance`} className="button button--primary button--sm">
              Log Maintenance
            </Link>
            <Link href={`/assets/${detail.asset.id}?tab=settings`} className="button button--ghost button--sm">
              Transfer Asset
            </Link>
            <AssetDangerActions
              assetId={detail.asset.id}
              isArchived={detail.asset.isArchived}
              archiveAction={archiveAssetAction}
              unarchiveAction={unarchiveAssetAction}
              deleteAction={softDeleteAssetAction}
            />
          </div>
        </div>

        <div className="detail-body">
          <section className="detail-hero">
            <div className="detail-hero__info">
              <p className="eyebrow">{formatCategoryLabel(detail.asset.category)}</p>
              <h1>{detail.asset.name}</h1>
              <p>
                {[detail.asset.manufacturer, detail.asset.model].filter(Boolean).join(" ")
                  || detail.asset.description
                  || "No description."}
              </p>
            </div>
            <dl className="detail-hero__meta">
              <div className="detail-hero__meta-item"><dt>Visibility</dt><dd>{formatVisibilityLabel(detail.asset.visibility)}</dd></div>
              <div className="detail-hero__meta-item"><dt>Purchased</dt><dd>{formatDate(detail.asset.purchaseDate, "-")}</dd></div>
              <div className="detail-hero__meta-item"><dt>Parent</dt><dd>{detail.asset.parentAsset?.name ?? "None"}</dd></div>
              <div className="detail-hero__meta-item"><dt>Children</dt><dd>{detail.asset.childAssets.length}</dd></div>
              <div className="detail-hero__meta-item"><dt>Due</dt><dd>{detail.dueScheduleCount}</dd></div>
              <div className="detail-hero__meta-item"><dt>Overdue</dt><dd>{detail.overdueScheduleCount}</dd></div>
              {detail.asset.serialNumber ? (
                <div className="detail-hero__meta-item"><dt>Serial</dt><dd>{detail.asset.serialNumber}</dd></div>
              ) : null}
            </dl>
          </section>

          <nav className="tab-navigation" aria-label="Asset sections">
            <ul style={{ display: "flex", gap: "24px", listStyle: "none", padding: "0 0 12px 0", margin: "16px 0 24px 0", borderBottom: "1px solid var(--border-color)", overflowX: "auto" }}>
              {tabs.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/assets/${detail.asset.id}?tab=${item.id}`}
                    style={{
                      textDecoration: "none",
                      color: tab === item.id ? "var(--ink-base)" : "var(--ink-muted)",
                      fontWeight: tab === item.id ? "600" : "normal",
                      paddingBottom: "12px",
                      borderBottom: tab === item.id ? "2px solid var(--ink-base)" : "none",
                      display: "block"
                    }}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <main>
            {tab === "overview" ? renderOverviewTab() : null}
            {tab === "details" ? renderDetailsTab() : null}
            {tab === "metrics" ? renderMetricsTab() : null}
            {tab === "maintenance" ? renderMaintenanceTab() : null}
            {tab === "comments" ? renderCommentsTab() : null}
            {tab === "settings" ? renderSettingsTab() : null}
          </main>
        </div>
      </AppShell>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }

    throw error;
  }
}
