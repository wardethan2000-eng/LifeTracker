import type { JSX } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  applyPresetToAssetAction,
  archiveAssetAction,
  completeScheduleAction,
  createLogAction,
  createMetricAction,
  createScheduleAction,
  deleteScheduleAction,
  softDeleteAssetAction,
  toggleScheduleActiveAction,
  unarchiveAssetAction,
  updateAssetAction,
  updateMetricAction,
} from "../../actions";
import { AppShell } from "../../../components/app-shell";
import { AssetDangerActions } from "../../../components/asset-danger-actions";
import { AssetProfileWorkbench } from "../../../components/asset-profile-workbench";
import { ScheduleCardActions } from "../../../components/schedule-card-actions";
import { ScheduleForm } from "../../../components/schedule-form";
import { ApiError, getAssetDetail, getHouseholdPresets, getLibraryPresets } from "../../../lib/api";
import {
  formatCategoryLabel,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatDueLabel,
  formatScheduleStatus,
  formatTriggerSummary,
  formatVisibilityLabel,
} from "../../../lib/formatters";

type AssetDetailPageProps = {
  params: Promise<{ assetId: string }>;
  searchParams: Promise<{ tab?: string }>;
};

export default async function AssetDetailPage({ params, searchParams }: AssetDetailPageProps): Promise<JSX.Element> {
  const { assetId } = await params;
  const { tab = "overview" } = await searchParams;

  try {
    const [detail, presets] = await Promise.all([getAssetDetail(assetId), getLibraryPresets()]);
    const customPresets = await getHouseholdPresets(detail.asset.householdId);
    const matchingPresets = presets.filter((p) => p.category === detail.asset.category);
    const visiblePresets = matchingPresets.length > 0 ? matchingPresets : presets;

    const groupedFields = detail.asset.fieldDefinitions.reduce<Record<string, typeof detail.asset.fieldDefinitions>>((groups, field) => {
      const key = field.group?.trim() || "Asset Details";
      if (!groups[key]) groups[key] = [];
      groups[key].push(field);
      return groups;
    }, {});

    const formatFieldValue = (fieldKey: string): JSX.Element | string => {
      const field = detail.asset.fieldDefinitions.find((f) => f.key === fieldKey);
      const value = detail.asset.customFields[fieldKey];
      if (value === null || value === undefined || value === "") return "—";
      if (Array.isArray(value)) {
        return (
          <span className="field-value__tags">
            {value.map((v) => <span key={String(v)} className="pill">{String(v)}</span>)}
          </span>
        );
      }
      if (field?.type === "boolean") return value ? "✓ Yes" : "✗ No";
      if (field?.type === "currency" && typeof value === "number") return formatCurrency(value);
      if (field?.type === "date" && typeof value === "string") return formatDate(value, "—");
      if (field?.type === "url" && typeof value === "string") {
        return <a href={value} target="_blank" rel="noopener noreferrer" className="text-link">{value}</a>;
      }
      const text = String(value);
      if (field?.unit) return `${text} ${field.unit}`;
      return text;
    };

    const tabs = [
      { id: "overview", label: "Overview" },
      { id: "details", label: "Details & Specs" },
      { id: "schedules", label: "Maintenance" },
      { id: "history", label: "History" },
      { id: "settings", label: "Settings" }
    ];

    // OVERVIEW TAB
    const renderOverviewTab = () => (
      <div className="tab-pane">
        <div style={{ display: "grid", gap: "24px", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
          
          {/* Action Callout */}
          <section className="panel" style={{ borderTop: detail.overdueScheduleCount > 0 ? "4px solid var(--danger-color)" : "4px solid var(--accent-color)" }}>
            <div className="panel__header"><h2>Needs Attention</h2></div>
            <div className="panel__body">
              {detail.schedules.filter(s => s.status === 'overdue' || s.status === 'due').length > 0 ? (
                <ul className="action-list" style={{ listStyle: "none", padding: 0 }}>
                  {detail.schedules.filter(s => s.status === 'overdue' || s.status === 'due').map(s => (
                    <li key={s.id} style={{ padding: "12px 0", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                         <span className={`status-chip status-chip--${s.status}`}>{formatScheduleStatus(s.status)}</span>
                         <strong style={{ marginLeft: "8px" }}>{s.name}</strong>
                      </div>
                      <span style={{ fontSize: "0.85rem", color: "var(--ink-muted)" }}>{formatDueLabel(s.nextDueAt, s.nextDueMetricValue, null)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="panel__empty">Asset is in good standing. No immediate maintenance due.</p>
              )}
            </div>
          </section>

          {/* Key Metrics */}
          <section className="panel">
            <div className="panel__header"><h2>Key Metrics</h2></div>
            <div className="panel__body">
              {detail.metrics.length === 0 ? (
                <p className="panel__empty">No usage metrics being tracked.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {detail.metrics.map(m => (
                    <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px" }}>
                      <div>
                        <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--ink-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{m.name}</p>
                        <strong style={{ fontSize: "1.5rem" }}>{m.currentValue} <span style={{ fontSize: "1rem", fontWeight: "normal" }}>{m.unit}</span></strong>
                      </div>
                      <span style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>Updated {formatDateTime(m.lastRecordedAt, "never")}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Recent Activity Mini-Feed */}
          <section className="panel">
            <div className="panel__header"><h2>Recent Activity</h2></div>
            <div className="panel__body">
              {detail.recentLogs.slice(0, 3).length === 0 ? (
                <p className="panel__empty">No recent maintenance activity.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {detail.recentLogs.slice(0, 3).map(log => (
                    <div key={log.id}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <strong>{log.title}</strong>
                        <span style={{ fontSize: "0.85rem", color: "var(--ink-muted)" }}>{formatDate(log.completedAt)}</span>
                      </div>
                      {log.cost != null && log.cost > 0 && <div style={{ fontSize: "0.85rem", marginTop: "4px" }}>Cost: {formatCurrency(log.cost)}</div>}
                    </div>
                  ))}
                  {detail.recentLogs.length > 3 && (
                    <Link href={`/assets/${detail.asset.id}?tab=history`} className="text-link" style={{ textAlign: "center", display: "block", marginTop: "8px" }}>View all history</Link>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    );

    // DETAILS & SPECS TAB
    const renderDetailsTab = () => (
      <div className="tab-pane" style={{ display: "grid", gap: "24px", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))" }}>
        <section className="panel">
          <div className="panel__header"><h2>Asset Profile</h2></div>
          {detail.asset.fieldDefinitions.length === 0 ? (
            <p className="panel__empty">No detail fields attached yet. Edit the asset in settings to add details.</p>
          ) : (
            <div className="asset-detail-groups">
              {Object.entries(groupedFields).map(([groupLabel, fields]) => (
                <section key={groupLabel} className="asset-detail-group">
                  <p className="eyebrow">{groupLabel}</p>
                  <dl className="data-list">
                    {fields.map((field) => (
                      <div key={field.key}><dt>{field.label}</dt><dd>{formatFieldValue(field.key)}</dd></div>
                    ))}
                  </dl>
                </section>
              ))}
            </div>
          )}
        </section>

        {Object.keys(detail.asset.customFields).length > 0 && (
          <section className="panel">
            <div className="panel__header"><h2>Raw Field Data</h2></div>
            <div className="panel__body--padded">
              <dl className="data-list">
                {Object.entries(detail.asset.customFields).map(([key, value]) => (
                  <div key={key}><dt>{key}</dt><dd>{Array.isArray(value) ? value.join(", ") : String(value)}</dd></div>
                ))}
              </dl>
            </div>
          </section>
        )}
      </div>
    );

    // SCHEDULES TAB
    const renderSchedulesTab = () => (
      <div className="tab-pane" style={{ display: "grid", gap: "24px" }}>
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
                        <p style={{ color: "var(--ink-muted)", fontSize: "0.88rem" }}>{schedule.description ?? "No description."}</p>
                      </div>
                      <div className="schedule-card__badges">
                        <span className={`status-chip status-chip--${schedule.status}`}>{formatScheduleStatus(schedule.status)}</span>
                        {!schedule.isActive && <span className="status-chip status-chip--paused">Paused</span>}
                      </div>
                    </div>
                    <dl className="schedule-meta">
                      <div><dt>Next due</dt><dd>{formatDueLabel(schedule.nextDueAt, schedule.nextDueMetricValue, null)}</dd></div>
                      <div><dt>Last completed</dt><dd>{formatDateTime(schedule.lastCompletedAt, "Never")}</dd></div>
                      <div><dt>Channels</dt><dd>{schedule.notificationConfig.channels.join(", ")}</dd></div>
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
          <div className="panel__header"><h2>Add Schedule</h2></div>
          <ScheduleForm
            assetId={detail.asset.id}
            metrics={detail.metrics.map((m) => ({ id: m.id, name: m.name, unit: m.unit }))}
            action={createScheduleAction}
          />
        </section>
      </div>
    );

    // HISTORY TAB
    const renderHistoryTab = () => (
      <div className="tab-pane" style={{ display: "grid", gap: "24px" }}>
        <section className="panel">
          <div className="panel__header"><h2>Maintenance History</h2></div>
          <div className="panel__body">
            {detail.recentLogs.length === 0 ? (
              <p className="panel__empty">No maintenance history logged yet.</p>
            ) : (
              <div className="log-list">
                {detail.recentLogs.map((log) => (
                  <div key={log.id} className="log-card">
                    <div>
                      <h4>{log.title}</h4>
                      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>{log.notes ?? "No notes."}</p>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>Completed</div>
                      <strong style={{ fontSize: "0.88rem" }}>{formatDateTime(log.completedAt)}</strong>
                      <div style={{ fontSize: "0.75rem", color: "var(--ink-muted)", marginTop: "4px" }}>Cost</div>
                      <strong style={{ fontSize: "0.88rem" }}>{formatCurrency(log.cost)}</strong>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel__header"><h2>Log Maintenance</h2></div>
          <div className="panel__body--padded">
            <form action={createLogAction} className="form-grid">
              <input type="hidden" name="assetId" value={detail.asset.id} />
              <label className="field field--full"><span>Schedule (optional)</span>
                <select name="scheduleId" defaultValue="">
                  <option value="">No linked schedule</option>
                  {detail.schedules.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                </select>
              </label>
              <label className="field field--full"><span>Title</span><input type="text" name="title" placeholder="Brake inspection" required /></label>
              <label className="field"><span>Completed at</span><input type="datetime-local" name="completedAt" required /></label>
              <label className="field"><span>Usage value</span><input type="number" name="usageValue" min="0" step="0.1" /></label>
              <label className="field"><span>Cost</span><input type="number" name="cost" min="0" step="0.01" /></label>
              <label className="field field--full"><span>Notes</span><textarea name="notes" rows={3} placeholder="Service notes or findings" /></label>
              <button type="submit" className="button button--primary">Add Log Entry</button>
            </form>
          </div>
        </section>
      </div>
    );

    // SETTINGS TAB
    const renderSettingsTab = () => (
      <div className="tab-pane" style={{ display: "grid", gap: "24px" }}>
        <section className="panel">
          <div className="panel__header"><h2>Edit Asset</h2></div>
          <div className="panel__body--padded">
            <AssetProfileWorkbench
              action={updateAssetAction}
              householdId={detail.asset.householdId}
              submitLabel="Update Asset"
              libraryPresets={visiblePresets}
              customPresets={customPresets}
              initialAsset={detail.asset}
            />
          </div>
        </section>

        <section className="panel">
          <div className="panel__header"><h2>Update Metrics</h2></div>
          <div className="panel__body">
            <form action={createMetricAction} className="form-grid form-grid--create" style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "24px", marginBottom: "24px" }}>
              <input type="hidden" name="assetId" value={detail.asset.id} />
              <label className="field"><span>Name</span><input type="text" name="name" placeholder="Odometer" required /></label>
              <label className="field"><span>Unit</span><input type="text" name="unit" placeholder="miles" required /></label>
              <label className="field"><span>Starting value</span><input type="number" name="currentValue" min="0" step="0.1" defaultValue="0" /></label>
              <label className="field"><span>Recorded at</span><input type="datetime-local" name="lastRecordedAt" /></label>
              <button type="submit" className="button button--ghost" style={{ alignSelf: "end" }}>Add Metric</button>
            </form>
            {detail.metrics.length === 0 ? (
              <p className="panel__empty">No usage metrics yet.</p>
            ) : (
              <div className="metric-grid">
                {detail.metrics.map((metric) => (
                  <article key={metric.id} className="metric-card">
                    <div>
                      <p className="eyebrow">{metric.unit}</p>
                      <h3>{metric.name}</h3>
                      <p className="metric-value">{metric.currentValue}</p>
                      <span style={{ fontSize: "0.82rem", color: "var(--ink-muted)" }}>Last updated {formatDateTime(metric.lastRecordedAt, "never")}</span>
                    </div>
                    <form action={updateMetricAction} className="form-grid form-grid--compact">
                      <input type="hidden" name="assetId" value={detail.asset.id} />
                      <input type="hidden" name="metricId" value={metric.id} />
                      <label className="field"><span>New reading</span><input type="number" name="currentValue" min="0" step="0.1" defaultValue={metric.currentValue} required /></label>
                      <label className="field"><span>Recorded at</span><input type="datetime-local" name="lastRecordedAt" /></label>
                      <button type="submit" className="button button--primary button--sm" style={{ alignSelf: "end", gridColumn: "-1" }}>Update</button>
                    </form>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel__header"><h2>Apply a Preset</h2></div>
          <div className="preset-grid">
            {visiblePresets.map((preset) => (
              <article key={preset.key} className="preset-card">
                <div>
                  <p className="eyebrow">{formatCategoryLabel(preset.category)}</p>
                  <h3>{preset.label}</h3>
                  <p style={{ fontSize: "0.85rem", color: "var(--ink-muted)" }}>{preset.description ?? "No description."}</p>
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
            <Link href={`/assets/${detail.asset.id}?tab=history`} className="button button--primary button--sm">Log Maintenance</Link>
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
              <p>{[detail.asset.manufacturer, detail.asset.model].filter(Boolean).join(" ") || detail.asset.description || "No description."}</p>
            </div>
            <dl className="detail-hero__meta">
              <div className="detail-hero__meta-item"><dt>Visibility</dt><dd>{formatVisibilityLabel(detail.asset.visibility)}</dd></div>
              <div className="detail-hero__meta-item"><dt>Overdue</dt><dd>{detail.overdueScheduleCount}</dd></div>
              <div className="detail-hero__meta-item"><dt>Due</dt><dd>{detail.dueScheduleCount}</dd></div>
              <div className="detail-hero__meta-item"><dt>Purchased</dt><dd>{formatDate(detail.asset.purchaseDate, "—")}</dd></div>
              {detail.asset.serialNumber && (
                <div className="detail-hero__meta-item"><dt>Serial</dt><dd>{detail.asset.serialNumber}</dd></div>
              )}
            </dl>
          </section>

          <nav className="tab-navigation" aria-label="Asset sections">
            <ul style={{ display: "flex", gap: "24px", listStyle: "none", padding: "0 0 12px 0", margin: "16px 0 24px 0", borderBottom: "1px solid var(--border-color)", overflowX: "auto" }}>
              {tabs.map((t) => (
                <li key={t.id}>
                  <Link 
                    href={`/assets/${detail.asset.id}?tab=${t.id}`}
                    style={{ 
                      textDecoration: "none", 
                      color: tab === t.id ? "var(--ink-base)" : "var(--ink-muted)",
                      fontWeight: tab === t.id ? "600" : "normal",
                      paddingBottom: "12px",
                      borderBottom: tab === t.id ? "2px solid var(--ink-base)" : "none",
                      display: "block"
                    }}
                  >
                    {t.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <main className="tab-content">
            {tab === "overview" && renderOverviewTab()}
            {tab === "details" && renderDetailsTab()}
            {tab === "schedules" && renderSchedulesTab()}
            {tab === "history" && renderHistoryTab()}
            {tab === "settings" && renderSettingsTab()}
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
