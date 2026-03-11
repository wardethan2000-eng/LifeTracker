import type { JSX } from "react";

export default function DashboardLoading(): JSX.Element {
  return (
    <div className="app-layout">
      <nav className="sidebar">
        <div className="sidebar__brand">
          <h1>AssetKeeper</h1>
          <p>Maintenance Tracker</p>
        </div>
        <div className="sidebar__nav">
          <div className="sidebar__section-label">Main</div>
          <span className="sidebar__link sidebar__link--active skeleton-pulse" style={{ height: 40 }} />
          <span className="sidebar__link skeleton-pulse" style={{ height: 40 }} />
          <span className="sidebar__link skeleton-pulse" style={{ height: 40 }} />
          <span className="sidebar__link skeleton-pulse" style={{ height: 40 }} />
          <span className="sidebar__link skeleton-pulse" style={{ height: 40 }} />
        </div>
      </nav>
      <div className="main-content">
        <header className="page-header">
          <div className="skeleton-bar" style={{ width: 160, height: 28 }} />
        </header>
        <div className="page-body">
          <section className="stats-row">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="stat-card">
                <div className="skeleton-bar" style={{ width: 80, height: 14 }} />
                <div className="skeleton-bar" style={{ width: 48, height: 36, marginTop: 8 }} />
                <div className="skeleton-bar" style={{ width: 120, height: 14, marginTop: 4 }} />
              </div>
            ))}
          </section>
          <div className="panel">
            <div className="panel__header">
              <div className="skeleton-bar" style={{ width: 200, height: 20 }} />
            </div>
            <div className="panel__body" style={{ padding: 20 }}>
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton-bar" style={{ width: "100%", height: 48, marginBottom: 12, borderRadius: 8 }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
