import type { JSX } from "react";

import { RouteLoading } from "../../../components/route-loading";

export default function HobbiesLoading(): JSX.Element {
  return (
    <RouteLoading>
      <header className="page-header">
        <div className="skeleton-bar" style={{ width: 130, height: 28 }} />
        <div className="skeleton-bar" style={{ width: 120, height: 36, borderRadius: 8 }} />
      </header>

      <div className="page-body" style={{ display: "grid", gap: 16 }}>
        <section className="stats-row">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="stat-card">
              <div className="skeleton-bar" style={{ width: 100, height: 12 }} />
              <div className="skeleton-bar" style={{ width: 48, height: 30, marginTop: 8 }} />
              <div className="skeleton-bar" style={{ width: 110, height: 12, marginTop: 8 }} />
            </div>
          ))}
        </section>

        <section className="panel">
          <div className="panel__body--padded" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
            {[1, 2, 3, 4].map((card) => (
              <div key={card} className="panel" style={{ margin: 0 }}>
                <div className="panel__body--padded" style={{ display: "grid", gap: 10 }}>
                  <div className="skeleton-bar" style={{ width: 160, height: 18 }} />
                  <div className="skeleton-bar" style={{ width: 120, height: 14 }} />
                  <div className="skeleton-bar" style={{ width: "100%", height: 12 }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </RouteLoading>
  );
}
