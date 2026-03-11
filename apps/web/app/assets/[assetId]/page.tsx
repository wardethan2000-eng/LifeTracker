import type { JSX } from "react";
import { notFound } from "next/navigation";
import {
  applyPresetToAssetAction,
  completeScheduleAction,
  createLogAction,
  createMetricAction,
  createScheduleAction,
  deleteScheduleAction,
  toggleScheduleActiveAction,
  updateMetricAction
} from "../../actions";
import { ApiError, getAssetDetail, getLibraryPresets } from "../../../lib/api";
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
  params: Promise<{
    assetId: string;
  }>;
};

export default async function AssetDetailPage({ params }: AssetDetailPageProps): Promise<JSX.Element> {
  const { assetId } = await params;

  try {
    const [detail, presets] = await Promise.all([
      getAssetDetail(assetId),
      getLibraryPresets()
    ]);
    const matchingPresets = presets.filter((preset) => preset.category === detail.asset.category);
    const visiblePresets = matchingPresets.length > 0 ? matchingPresets : presets;

    return (
      <main className="detail-shell">
        <div className="detail-topbar">
          <a href={`/?householdId=${detail.asset.householdId}`} className="text-link">Back to dashboard</a>
        </div>

        <section className="detail-hero">
          <div>
            <p className="eyebrow">{formatCategoryLabel(detail.asset.category)}</p>
            <h1>{detail.asset.name}</h1>
            <p>
              {[detail.asset.manufacturer, detail.asset.model].filter(Boolean).join(" ") || detail.asset.description || "No descriptive details yet."}
            </p>
          </div>

          <dl className="hero-meta-grid">
            <div>
              <dt>Visibility</dt>
              <dd>{formatVisibilityLabel(detail.asset.visibility)}</dd>
            </div>
            <div>
              <dt>Overdue</dt>
              <dd>{detail.overdueScheduleCount}</dd>
            </div>
            <div>
              <dt>Due now</dt>
              <dd>{detail.dueScheduleCount}</dd>
            </div>
            <div>
              <dt>Purchased</dt>
              <dd>{formatDate(detail.asset.purchaseDate, "Not recorded")}</dd>
            </div>
          </dl>
        </section>

        <div className="detail-layout">
          <div className="detail-column">
            <section className="panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Usage metrics</p>
                  <h2>Current readings</h2>
                </div>
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

                <button type="submit" className="button button--ghost">Add metric</button>
              </form>

              {detail.metrics.length === 0 ? (
                <p className="empty-state">No usage metrics attached to this asset yet.</p>
              ) : (
                <div className="metric-grid">
                  {detail.metrics.map((metric) => (
                    <article key={metric.id} className="metric-card">
                      <div>
                        <p className="eyebrow">{metric.unit}</p>
                        <h3>{metric.name}</h3>
                        <p className="metric-value">{metric.currentValue}</p>
                        <span>Last updated {formatDateTime(metric.lastRecordedAt, "never")}</span>
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

                        <button type="submit" className="button button--primary">Update reading</button>
                      </form>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Schedules</p>
                  <h2>Maintenance workflow</h2>
                </div>
              </div>

              {detail.schedules.length === 0 ? (
                <p className="empty-state">No maintenance schedules are active yet. Apply a preset or add schedules through the API.</p>
              ) : (
                <div className="schedule-stack">
                  {detail.schedules.map((schedule) => (
                    <article key={schedule.id} className={`schedule-card schedule-card--${schedule.status}`}>
                      <div className="schedule-card__summary">
                        <div>
                          <p className="eyebrow">{formatTriggerSummary(schedule.triggerConfig)}</p>
                          <h3>{schedule.name}</h3>
                          <p>{schedule.description ?? "No description provided."}</p>
                        </div>
                        <div className="schedule-card__badges">
                          <span className={`status-chip status-chip--${schedule.status}`}>{formatScheduleStatus(schedule.status)}</span>
                          {!schedule.isActive ? <span className="pill">Paused</span> : null}
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

                        <button type="submit" className="button button--primary">Complete schedule</button>
                      </form>

                      <div className="inline-actions">
                        <form action={toggleScheduleActiveAction}>
                          <input type="hidden" name="assetId" value={detail.asset.id} />
                          <input type="hidden" name="scheduleId" value={schedule.id} />
                          <input type="hidden" name="isActive" value={schedule.isActive ? "false" : "true"} />
                          <button type="submit" className="button button--ghost">{schedule.isActive ? "Pause schedule" : "Resume schedule"}</button>
                        </form>

                        <form action={deleteScheduleAction}>
                          <input type="hidden" name="assetId" value={detail.asset.id} />
                          <input type="hidden" name="scheduleId" value={schedule.id} />
                          <button type="submit" className="button button--subtle">Delete schedule</button>
                        </form>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>

          <aside className="detail-column detail-column--aside">
            <section className="panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Preset library</p>
                  <h2>Apply a preset</h2>
                </div>
              </div>

              <div className="preset-grid">
                {visiblePresets.map((preset) => (
                  <article key={preset.key} className="preset-card">
                    <div>
                      <p className="eyebrow">{formatCategoryLabel(preset.category)}</p>
                      <h3>{preset.label}</h3>
                      <p>{preset.description ?? "No description provided."}</p>
                    </div>

                    <dl className="preset-meta">
                      <div>
                        <dt>Metrics</dt>
                        <dd>{preset.metricTemplates.length}</dd>
                      </div>
                      <div>
                        <dt>Schedules</dt>
                        <dd>{preset.scheduleTemplates.length}</dd>
                      </div>
                    </dl>

                    <form action={applyPresetToAssetAction}>
                      <input type="hidden" name="assetId" value={detail.asset.id} />
                      <input type="hidden" name="presetKey" value={preset.key} />
                      <button type="submit" className="button button--ghost">Apply preset</button>
                    </form>
                  </article>
                ))}
              </div>
            </section>

            <section className="panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Create schedule</p>
                  <h2>Manual maintenance rule</h2>
                </div>
              </div>

              <form action={createScheduleAction} className="form-grid">
                <input type="hidden" name="assetId" value={detail.asset.id} />

                <label className="field field--full">
                  <span>Name</span>
                  <input type="text" name="name" placeholder="Brake inspection" required />
                </label>

                <label className="field field--full">
                  <span>Description</span>
                  <textarea name="description" rows={3} placeholder="What should be done and what counts as completion" />
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

                <button type="submit" className="button button--primary">Create schedule</button>
              </form>
            </section>

            <section className="panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Quick log</p>
                  <h2>Capture unscheduled work</h2>
                </div>
              </div>

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
                  <textarea name="notes" rows={4} placeholder="Service notes, issues found, or receipts reference" />
                </label>

                <button type="submit" className="button button--primary">Add log entry</button>
              </form>
            </section>

            <section className="panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Custom fields</p>
                  <h2>Asset-specific data</h2>
                </div>
              </div>

              {Object.keys(detail.asset.customFields).length === 0 ? (
                <p className="empty-state">No custom fields saved for this asset.</p>
              ) : (
                <dl className="data-list">
                  {Object.entries(detail.asset.customFields).map(([key, value]) => (
                    <div key={key}>
                      <dt>{key}</dt>
                      <dd>{Array.isArray(value) ? value.join(", ") : String(value)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>

            <section className="panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">History</p>
                  <h2>Recent logs</h2>
                </div>
              </div>

              {detail.recentLogs.length === 0 ? (
                <p className="empty-state">No maintenance history has been logged yet.</p>
              ) : (
                <div className="log-list">
                  {detail.recentLogs.map((log) => (
                    <article key={log.id} className="log-card">
                      <div>
                        <h3>{log.title}</h3>
                        <p>{log.notes ?? "No notes provided."}</p>
                      </div>
                      <dl className="log-card__meta">
                        <div>
                          <dt>Completed</dt>
                          <dd>{formatDateTime(log.completedAt)}</dd>
                        </div>
                        <div>
                          <dt>Cost</dt>
                          <dd>{formatCurrency(log.cost)}</dd>
                        </div>
                        <div>
                          <dt>Usage</dt>
                          <dd>{log.usageValue ?? "Not recorded"}</dd>
                        </div>
                      </dl>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </aside>
        </div>
      </main>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }

    throw error;
  }
}