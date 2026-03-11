import type { JSX } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  applyPresetToAssetAction,
  completeScheduleAction,
  createLogAction,
  createMetricAction,
  createScheduleAction,
  deleteScheduleAction,
  toggleScheduleActiveAction,
  updateAssetAction,
  updateMetricAction
} from "../../actions";
import { AppShell } from "../../../components/app-shell";
import { AssetProfileWorkbench } from "../../../components/asset-profile-workbench";
import { ApiError, getAssetDetail, getHouseholdPresets, getLibraryPresets } from "../../../lib/api";
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
};

export default async function AssetDetailPage({ params }: AssetDetailPageProps): Promise<JSX.Element> {
  const { assetId } = await params;

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

    const formatFieldValue = (fieldKey: string): string => {
      const field = detail.asset.fieldDefinitions.find((f) => f.key === fieldKey);
      const value = detail.asset.customFields[fieldKey];
      if (value === null || value === undefined || value === "") return "—";
      if (Array.isArray(value)) return value.join(", ");
      if (field?.type === "currency" && typeof value === "number") return formatCurrency(value);
      if (field?.type === "date" && typeof value === "string") return formatDate(value, "—");
      return String(value);
    };

    return (
      <AppShell activePath="/assets">
        <div className="detail-topbar">
          <Link href="/assets" className="text-link">&larr; Back to Assets</Link>
        </div>

        <div className="detail-body">
          {/* ── Hero ── */}
          <section className="detail-hero">
            <div className="detail-hero__info">
              <p className="eyebrow">{formatCategoryLabel(detail.asset.category)}</p>
              <h1>{detail.asset.name}</h1>
              <p>{[detail.asset.manufacturer, detail.asset.model].filter(Boolean).join(" ") || detail.asset.description || "No description."}</p>
            </div>
            <dl className="detail-hero__meta">
              <div className="detail-hero__meta-item">
                <dt>Visibility</dt>
                <dd>{formatVisibilityLabel(detail.asset.visibility)}</dd>
              </div>
              <div className="detail-hero__meta-item">
                <dt>Overdue</dt>
                <dd>{detail.overdueScheduleCount}</dd>
              </div>
              <div className="detail-hero__meta-item">
                <dt>Due</dt>
                <dd>{detail.dueScheduleCount}</dd>
              </div>
              <div className="detail-hero__meta-item">
                <dt>Purchased</dt>
                <dd>{formatDate(detail.asset.purchaseDate, "—")}</dd>
              </div>
            </dl>
          </section>

          <div className="detail-layout">
            <div className="detail-column">
              {/* ── Detail Fields ── */}
              <section className="panel">
                <div className="panel__header">
                  <h2>Asset Profile</h2>
                </div>
                {detail.asset.fieldDefinitions.length === 0 ? (
                  <p className="panel__empty">No custom detail fields attached yet. Edit the asset to add fields.</p>
                ) : (
                  <div className="asset-detail-groups">
                    {Object.entries(groupedFields).map(([groupLabel, fields]) => (
                      <section key={groupLabel} className="asset-detail-group">
                        <p className="eyebrow">{groupLabel}</p>
                        <dl className="data-list">
                          {fields.map((field) => (
                            <div key={field.key}>
                              <dt>{field.label}</dt>
                              <dd>{formatFieldValue(field.key)}</dd>
                            </div>
                          ))}
                        </dl>
                      </section>
                    ))}
                  </div>
                )}
              </section>

              {/* ── Usage Metrics ── */}
              <section className="panel">
                <div className="panel__header">
                  <h2>Usage Metrics</h2>
                </div>

                <form action={createMetricAction} className="form-grid form-grid--create">
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
                    <span>Starting value</span>
                    <input type="number" name="currentValue" min="0" step="0.1" defaultValue="0" />
                  </label>
                  <label className="field">
                    <span>Recorded at</span>
                    <input type="datetime-local" name="lastRecordedAt" />
                  </label>
                  <button type="submit" className="button button--ghost">Add Metric</button>
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
                          <span style={{ fontSize: "0.82rem", color: "var(--ink-muted)" }}>
                            Last updated {formatDateTime(metric.lastRecordedAt, "never")}
                          </span>
                        </div>
                        <form action={updateMetricAction} className="form-grid form-grid--compact">
                          <input type="hidden" name="assetId" value={detail.asset.id} />
                          <input type="hidden" name="metricId" value={metric.id} />
                          <label className="field">
                            <span>New reading</span>
                            <input type="number" name="currentValue" min="0" step="0.1" defaultValue={metric.currentValue} required />
                          </label>
                          <label className="field">
                            <span>Recorded at</span>
                            <input type="datetime-local" name="lastRecordedAt" />
                          </label>
                          <button type="submit" className="button button--primary button--sm">Update</button>
                        </form>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              {/* ── Maintenance Schedules ── */}
              <section className="panel">
                <div className="panel__header">
                  <h2>Maintenance Schedules</h2>
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
                            <div>
                              <dt>Next due</dt>
                              <dd>{formatDueLabel(schedule.nextDueAt, schedule.nextDueMetricValue, null)}</dd>
                            </div>
                            <div>
                              <dt>Last completed</dt>
                              <dd>{formatDateTime(schedule.lastCompletedAt, "Never")}</dd>
                            </div>
                            <div>
                              <dt>Channels</dt>
                              <dd>{schedule.notificationConfig.channels.join(", ")}</dd>
                            </div>
                          </dl>

                          <form action={completeScheduleAction} className="form-grid">
                            <input type="hidden" name="assetId" value={detail.asset.id} />
                            <input type="hidden" name="scheduleId" value={schedule.id} />
                            <label className="field">
                              <span>Log title</span>
                              <input type="text" name="title" placeholder={schedule.name} />
                            </label>
                            <label className="field">
                              <span>Completed at</span>
                              <input type="datetime-local" name="completedAt" />
                            </label>
                            <label className="field">
                              <span>Usage value</span>
                              <input type="number" name="usageValue" min="0" step="0.1" placeholder="Optional" />
                            </label>
                            <label className="field">
                              <span>Cost</span>
                              <input type="number" name="cost" min="0" step="0.01" placeholder="Optional" />
                            </label>
                            <label className="field field--full">
                              <span>Notes</span>
                              <textarea name="notes" rows={3} placeholder="What was done, parts used, vendor, or findings" />
                            </label>
                            <button type="submit" className="button button--primary">Complete Schedule</button>
                          </form>

                          <div className="inline-actions">
                            <form action={toggleScheduleActiveAction}>
                              <input type="hidden" name="assetId" value={detail.asset.id} />
                              <input type="hidden" name="scheduleId" value={schedule.id} />
                              <input type="hidden" name="isActive" value={schedule.isActive ? "false" : "true"} />
                              <button type="submit" className="button button--ghost button--sm">
                                {schedule.isActive ? "Pause" : "Resume"}
                              </button>
                            </form>
                            <form action={deleteScheduleAction}>
                              <input type="hidden" name="assetId" value={detail.asset.id} />
                              <input type="hidden" name="scheduleId" value={schedule.id} />
                              <button type="submit" className="button button--danger button--sm">Delete</button>
                            </form>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>

            <aside className="detail-column">
              {/* ── Edit Profile ── */}
              <section className="panel">
                <div className="panel__header">
                  <h2>Edit Asset</h2>
                </div>
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

              {/* ── Preset Library ── */}
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

              {/* ── Create Schedule ── */}
              <section className="panel">
                <div className="panel__header">
                  <h2>Add Schedule</h2>
                </div>
                <div className="panel__body--padded">
                  <form action={createScheduleAction} className="form-grid">
                    <input type="hidden" name="assetId" value={detail.asset.id} />

                    <label className="field field--full">
                      <span>Name</span>
                      <input type="text" name="name" placeholder="Brake inspection" required />
                    </label>
                    <label className="field field--full">
                      <span>Description</span>
                      <textarea name="description" rows={2} placeholder="What should be done" />
                    </label>
                    <label className="field">
                      <span>Trigger type</span>
                      <select name="triggerType" defaultValue="interval">
                        <option value="interval">Interval</option>
                        <option value="usage">Usage</option>
                        <option value="compound">Compound</option>
                        <option value="seasonal">Seasonal</option>
                        <option value="one_time">One time</option>
                      </select>
                    </label>
                    <label className="field">
                      <span>Metric</span>
                      <select name="metricId" defaultValue="">
                        <option value="">No metric</option>
                        {detail.metrics.map((metric) => (
                          <option key={metric.id} value={metric.id}>{metric.name} ({metric.unit})</option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Interval days</span>
                      <input type="number" name="intervalDays" min="1" step="1" placeholder="90" />
                    </label>
                    <label className="field">
                      <span>Lead days</span>
                      <input type="number" name="leadTimeDays" min="0" step="1" placeholder="7" />
                    </label>
                    <label className="field">
                      <span>Interval value</span>
                      <input type="number" name="intervalValue" min="0" step="0.1" placeholder="5000" />
                    </label>
                    <label className="field">
                      <span>Lead value</span>
                      <input type="number" name="leadTimeValue" min="0" step="0.1" placeholder="250" />
                    </label>
                    <label className="field">
                      <span>Season month</span>
                      <input type="number" name="month" min="1" max="12" step="1" placeholder="10" />
                    </label>
                    <label className="field">
                      <span>Season day</span>
                      <input type="number" name="day" min="1" max="31" step="1" placeholder="15" />
                    </label>
                    <label className="field">
                      <span>One-time due at</span>
                      <input type="datetime-local" name="dueAt" />
                    </label>
                    <label className="field">
                      <span>Compound logic</span>
                      <select name="logic" defaultValue="whichever_first">
                        <option value="whichever_first">Whichever comes first</option>
                        <option value="whichever_last">Whichever comes last</option>
                      </select>
                    </label>
                    <label className="field field--checkbox field--full">
                      <input type="checkbox" name="digest" />
                      <span>Include digest notifications</span>
                    </label>
                    <button type="submit" className="button button--primary">Create Schedule</button>
                  </form>
                </div>
              </section>

              {/* ── Quick Log ── */}
              <section className="panel">
                <div className="panel__header">
                  <h2>Log Maintenance</h2>
                </div>
                <div className="panel__body--padded">
                  <form action={createLogAction} className="form-grid">
                    <input type="hidden" name="assetId" value={detail.asset.id} />
                    <label className="field field--full">
                      <span>Schedule (optional)</span>
                      <select name="scheduleId" defaultValue="">
                        <option value="">No linked schedule</option>
                        {detail.schedules.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </label>
                    <label className="field field--full">
                      <span>Title</span>
                      <input type="text" name="title" placeholder="Brake inspection" />
                    </label>
                    <label className="field">
                      <span>Completed at</span>
                      <input type="datetime-local" name="completedAt" />
                    </label>
                    <label className="field">
                      <span>Usage value</span>
                      <input type="number" name="usageValue" min="0" step="0.1" />
                    </label>
                    <label className="field">
                      <span>Cost</span>
                      <input type="number" name="cost" min="0" step="0.01" />
                    </label>
                    <label className="field field--full">
                      <span>Notes</span>
                      <textarea name="notes" rows={3} placeholder="Service notes or findings" />
                    </label>
                    <button type="submit" className="button button--primary">Add Log Entry</button>
                  </form>
                </div>
              </section>

              {/* ── Custom Fields (raw) ── */}
              {Object.keys(detail.asset.customFields).length > 0 && (
                <section className="panel">
                  <div className="panel__header">
                    <h2>Raw Field Data</h2>
                  </div>
                  <div className="panel__body--padded">
                    <dl className="data-list">
                      {Object.entries(detail.asset.customFields).map(([key, value]) => (
                        <div key={key}>
                          <dt>{key}</dt>
                          <dd>{Array.isArray(value) ? value.join(", ") : String(value)}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </section>
              )}

              {/* ── Maintenance History ── */}
              <section className="panel">
                <div className="panel__header">
                  <h2>Maintenance History</h2>
                </div>
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
            </aside>
          </div>
        </div>
      </AppShell>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}