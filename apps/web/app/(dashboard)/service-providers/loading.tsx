import type { JSX } from "react";

import { RouteLoading } from "../../../components/route-loading";

export default function ServiceProvidersLoading(): JSX.Element {
  return (
    <RouteLoading>
      <header className="page-header">
        <div className="skeleton-bar" style={{ width: 190, height: 28 }} />
      </header>

      <div className="page-body" style={{ display: "grid", gap: 16 }}>
        <section className="panel">
          <div className="panel__header">
            <div className="skeleton-bar" style={{ width: 200, height: 20 }} />
          </div>
          <div className="panel__body--padded" style={{ display: "grid", gap: 10 }}>
            {[1, 2, 3, 4].map((field) => (
              <div key={field} style={{ display: "grid", gap: 8 }}>
                <div className="skeleton-bar" style={{ width: 120, height: 12 }} />
                <div className="skeleton-bar" style={{ width: "100%", height: 38, borderRadius: 8 }} />
              </div>
            ))}
            <div className="skeleton-bar" style={{ width: 140, height: 36, borderRadius: 8 }} />
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <div className="skeleton-bar" style={{ width: 170, height: 20 }} />
          </div>
          <div className="panel__body--padded" style={{ display: "grid", gap: 10 }}>
            {[1, 2, 3, 4, 5].map((row) => (
              <div key={row} className="skeleton-bar" style={{ width: "100%", height: 60, borderRadius: 8 }} />
            ))}
          </div>
        </section>
      </div>
    </RouteLoading>
  );
}
