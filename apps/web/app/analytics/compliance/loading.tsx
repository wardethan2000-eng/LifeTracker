import type { JSX } from "react";

export default function ComplianceAnalyticsLoading(): JSX.Element {
  return (
    <div className="skeleton-page">
      <header className="page-header">
        <div className="skeleton-bar" style={{ width: 300, height: 28 }} />
      </header>
      <div className="page-body">
        <section className="panel">
          <div className="panel__body compliance-skeleton-grid">
            <div className="skeleton-bar" style={{ width: "100%", height: 54, borderRadius: 10 }} />
            <div className="skeleton-bar" style={{ width: "100%", height: 54, borderRadius: 10 }} />
            <div className="skeleton-bar" style={{ width: "100%", height: 54, borderRadius: 10 }} />
          </div>
        </section>
        <div className="analytics-tab-bar">
          <div className="skeleton-bar" style={{ width: 130, height: 40, borderRadius: 8 }} />
          <div className="skeleton-bar" style={{ width: 140, height: 40, borderRadius: 8 }} />
          <div className="skeleton-bar" style={{ width: 170, height: 40, borderRadius: 8 }} />
          <div className="skeleton-bar" style={{ width: 160, height: 40, borderRadius: 8 }} />
        </div>
        <section className="panel">
          <div className="panel__body compliance-skeleton-grid">
            <div className="skeleton-bar" style={{ width: "100%", height: 140, borderRadius: 12 }} />
            <div className="skeleton-bar" style={{ width: "100%", height: 320, borderRadius: 12 }} />
            <div className="skeleton-bar" style={{ width: "100%", height: 240, borderRadius: 12 }} />
          </div>
        </section>
      </div>
    </div>
  );
}