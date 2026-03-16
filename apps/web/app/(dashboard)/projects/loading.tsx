import type { JSX } from "react";

import { RouteLoading } from "../../../components/route-loading";

export default function ProjectsLoading(): JSX.Element {
  return (
    <RouteLoading>
      <header className="page-header">
        <div className="skeleton-bar" style={{ width: 140, height: 28 }} />
        <div className="skeleton-bar" style={{ width: 120, height: 36, borderRadius: 8 }} />
      </header>

      <div className="page-body" style={{ display: "grid", gap: 20 }}>
        <section className="stats-row">
          {[1, 2, 3, 4, 5].map((item) => (
            <div key={item} className="stat-card">
              <div className="skeleton-bar" style={{ width: 90, height: 12 }} />
              <div className="skeleton-bar" style={{ width: 46, height: 30, marginTop: 8 }} />
              <div className="skeleton-bar" style={{ width: 110, height: 12, marginTop: 8 }} />
            </div>
          ))}
        </section>

        <section className="panel">
          <div className="panel__header">
            <div className="skeleton-bar" style={{ width: 220, height: 20 }} />
          </div>
          <div className="panel__body" style={{ padding: 0 }}>
            {[1, 2, 3, 4, 5].map((row) => (
              <div key={row} style={{ display: "flex", gap: 12, padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
                <div className="skeleton-bar" style={{ width: 220, height: 16 }} />
                <div className="skeleton-bar" style={{ width: 100, height: 16 }} />
                <div className="skeleton-bar" style={{ width: 80, height: 16 }} />
                <div className="skeleton-bar" style={{ width: 90, height: 16 }} />
                <div className="skeleton-bar" style={{ width: 120, height: 16 }} />
                <div className="skeleton-bar" style={{ flex: 1, height: 16 }} />
              </div>
            ))}
          </div>
        </section>
      </div>
    </RouteLoading>
  );
}