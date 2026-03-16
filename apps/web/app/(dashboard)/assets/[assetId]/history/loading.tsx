import type { JSX } from "react";

import { RouteLoading } from "../../../../../components/route-loading";

export default function AssetHistoryLoading(): JSX.Element {
  return (
    <RouteLoading>
      <div style={{ display: "grid", gap: "24px" }}>
        <section className="stats-row">
          {[1, 2, 3, 4].map((index) => (
            <div key={index} className="stat-card">
              <div className="skeleton-bar" style={{ width: 90, height: 12, marginBottom: 10 }} />
              <div className="skeleton-bar" style={{ width: 72, height: 28, marginBottom: 8 }} />
              <div className="skeleton-bar" style={{ width: 140, height: 12 }} />
            </div>
          ))}
        </section>

        <section className="panel">
          <div className="panel__body--padded" style={{ display: "grid", gap: "16px" }}>
            <div className="skeleton-bar" style={{ width: "100%", height: 52, borderRadius: 10 }} />
            <div className="skeleton-bar" style={{ width: "100%", height: 180, borderRadius: 14 }} />
            {[1, 2, 3].map((index) => (
              <div key={index} className="skeleton-bar" style={{ width: "100%", height: 124, borderRadius: 14 }} />
            ))}
          </div>
        </section>
      </div>
    </RouteLoading>
  );
}