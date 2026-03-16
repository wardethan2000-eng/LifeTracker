import type { JSX } from "react";

import { RouteLoading } from "../../../../components/route-loading";

export default function HobbyDetailLoading(): JSX.Element {
  return (
    <RouteLoading>
      <header className="page-header">
        <div style={{ display: "grid", gap: 8 }}>
          <div className="skeleton-bar" style={{ width: 220, height: 28 }} />
          <div className="skeleton-bar" style={{ width: 130, height: 22, borderRadius: 999 }} />
        </div>
        <div className="skeleton-bar" style={{ width: 150, height: 36, borderRadius: 8 }} />
      </header>

      <div className="page-body" style={{ display: "grid", gap: 16 }}>
        <section className="stats-row">
          {[1, 2, 3, 4, 5].map((item) => (
            <div key={item} className="stat-card">
              <div className="skeleton-bar" style={{ width: 90, height: 12 }} />
              <div className="skeleton-bar" style={{ width: 48, height: 30, marginTop: 8 }} />
              <div className="skeleton-bar" style={{ width: 100, height: 12, marginTop: 8 }} />
            </div>
          ))}
        </section>

        <section className="panel">
          <div className="panel__header">
            <div className="skeleton-bar" style={{ width: 280, height: 20 }} />
          </div>
          <div className="panel__body--padded" style={{ display: "grid", gap: 12 }}>
            {[1, 2, 3].map((row) => (
              <div key={row} className="skeleton-bar" style={{ width: "100%", height: 52, borderRadius: 8 }} />
            ))}
          </div>
        </section>
      </div>
    </RouteLoading>
  );
}
