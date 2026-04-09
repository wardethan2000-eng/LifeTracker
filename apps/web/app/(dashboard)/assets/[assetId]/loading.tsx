import type { JSX } from "react";

import { RouteLoading } from "../../../../components/route-loading";

export default function AssetDetailLoading(): JSX.Element {
  return (
    <RouteLoading>
      <div className="skeleton-page">
        <header className="page-header">
          <div>
            <div className="skeleton-bar" style={{ width: 100, height: 13, marginBottom: 8 }} />
            <div className="skeleton-bar" style={{ width: 260, height: 28, marginBottom: 10 }} />
            <div style={{ display: "flex", gap: 16 }}>
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton-bar" style={{ width: 80, height: 13 }} />
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div className="skeleton-bar" style={{ width: 130, height: 34, borderRadius: 6 }} />
            <div className="skeleton-bar" style={{ width: 110, height: 34, borderRadius: 6 }} />
          </div>
        </header>
        <div className="workspace-nav" style={{ padding: "0 28px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", gap: 6, padding: "12px 0" }}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="skeleton-bar" style={{ width: 80, height: 30, borderRadius: 20 }} />
            ))}
          </div>
        </div>
        <div className="page-body">
          <div style={{ display: "grid", gap: "24px" }}>
            <div className="panel">
              <div style={{ padding: 20 }}>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="skeleton-bar" style={{ width: "100%", height: 44, marginBottom: 12, borderRadius: 8 }} />
                ))}
              </div>
            </div>
            <section className="stats-row">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="stat-card">
                  <div className="skeleton-bar" style={{ width: 80, height: 12, marginBottom: 8 }} />
                  <div className="skeleton-bar" style={{ width: 48, height: 28 }} />
                </div>
              ))}
            </section>
          </div>
        </div>
      </div>
    </RouteLoading>
  );
}
