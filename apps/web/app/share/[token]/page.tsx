import Link from "next/link";
import type { JSX } from "react";
import { ApiError, getPublicAssetReport } from "../../../lib/api";
import { formatCurrency, formatDate, formatDateTime } from "../../../lib/formatters";

type PublicSharePageProps = {
  params: Promise<{ token: string }>;
};

const formatSourceLabel = (sourceType: string): string => {
  switch (sourceType) {
    case "maintenance_log":
      return "Maintenance";
    case "timeline_entry":
      return "Manual Entry";
    case "project_event":
      return "Project";
    case "inventory_transaction":
      return "Inventory";
    case "schedule_change":
      return "Schedule";
    case "comment":
      return "Comment";
    case "condition_assessment":
      return "Condition";
    case "usage_reading":
      return "Usage";
    default:
      return "Activity";
  }
};

export default async function PublicSharePage({ params }: PublicSharePageProps): Promise<JSX.Element> {
  const { token } = await params;

  try {
    const report = await getPublicAssetReport(token);
    const rangeLabel = report.dateRangeStart || report.dateRangeEnd
      ? `${report.dateRangeStart ? formatDate(report.dateRangeStart) : "Beginning"} to ${report.dateRangeEnd ? formatDate(report.dateRangeEnd) : "Present"}`
      : "Complete History";
    const makeModelYear = [report.assetYear, report.assetMake, report.assetModel]
      .filter((value) => value !== null && value !== undefined && String(value).trim().length > 0)
      .join(" ");

    return (
      <main className="public-report">
        <header className="public-report__header">
          <div className="public-report__brand">LifeKeeper</div>
          <h1 className="public-report__title">Shared Asset Report</h1>
          <p style={{ margin: "8px 0 0 0", color: "var(--ink-muted)" }}>Generated {formatDateTime(report.generatedAt)}</p>
        </header>

        <section className="panel" style={{ marginBottom: 24 }}>
          <div className="panel__body--padded" style={{ display: "grid", gap: 16 }}>
            <div>
              <h2 style={{ margin: 0 }}>{report.assetName}</h2>
              <p style={{ margin: "6px 0 0 0", color: "var(--ink-muted)" }}>{report.assetCategory}</p>
            </div>
            <div className="public-report__meta">
              <dl className="data-list">
                <div>
                  <dt>Make / Model / Year</dt>
                  <dd>{makeModelYear || "Not provided"}</dd>
                </div>
                <div>
                  <dt>Date Range</dt>
                  <dd>{rangeLabel}</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        <section className="panel" style={{ marginBottom: 24 }}>
          <div className="panel__header">
            <h2>Timeline</h2>
          </div>
          <div className="panel__body--padded">
            {report.timelineItems.length === 0 ? (
              <p className="panel__empty">No timeline activity is available for this shared range.</p>
            ) : (
              <div className="timeline-feed">
                {report.timelineItems.map((item) => (
                  <article key={item.id} className={`timeline-item timeline-item--${item.sourceType}`}>
                    <div className="timeline-item__header">
                      <div style={{ display: "grid", gap: 8, flex: 1 }}>
                        <h3 className="timeline-item__title">{item.title}</h3>
                        {item.description ? <p className="timeline-item__description timeline-item__description--expanded">{item.description}</p> : null}
                      </div>
                      {item.cost !== null ? <div className="timeline-item__cost">{formatCurrency(item.cost)}</div> : null}
                    </div>
                    <div className="timeline-item__meta">
                      <span className={`timeline-item__source-badge timeline-item__source-badge--${item.sourceType}`}>
                        {formatSourceLabel(item.sourceType)}
                      </span>
                      <span className="timeline-item__date">{formatDateTime(item.eventDate)}</span>
                      {item.category ? <span className="pill">{item.category}</span> : null}
                    </div>
                    {item.parts && item.parts.length > 0 ? (
                      <div className="timeline-item__parts">
                        {item.parts.map((part, index) => (
                          <span key={`${part.name}-${index}`} className="timeline-item__part-pill">
                            {part.quantity}x {part.name}
                            {part.partNumber ? ` (${part.partNumber})` : ""}
                            {part.unitCost !== null ? ` • ${formatCurrency(part.unitCost)}` : ""}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="public-report__cost-summary">
          <div className="stats-row">
            <div className="stat-card stat-card--accent">
              <span className="stat-card__label">Lifetime Cost</span>
              <strong className="stat-card__value">{formatCurrency(report.costSummary.lifetimeCost)}</strong>
            </div>
            <div className="stat-card">
              <span className="stat-card__label">Maintenance Log Count</span>
              <strong className="stat-card__value">{report.costSummary.logCount}</strong>
            </div>
          </div>
        </section>
      </main>
    );
  } catch (error) {
    const message = error instanceof ApiError && (error.status === 404 || error.status === 410)
      ? "This link is not valid or has expired."
      : "This link is not valid or has expired.";

    return (
      <main className="public-report" style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
        <div style={{ textAlign: "center", display: "grid", gap: 12 }}>
          <h1 className="public-report__title" style={{ margin: 0 }}>{message}</h1>
          <p style={{ margin: 0, color: "var(--ink-muted)" }}>
            <Link href="/" className="text-link">Return to LifeKeeper</Link>
          </p>
        </div>
      </main>
    );
  }
}