import type { JSX } from "react";

import { RouteLoading } from "../../../components/route-loading";

export default function ActivityLoading(): JSX.Element {
  return (
    <RouteLoading>
      <header className="page-header">
        <div className="skeleton-bar" style={{ width: 150, height: 28 }} />
        <div className="skeleton-bar" style={{ width: 110, height: 36, borderRadius: 8 }} />
      </header>

      <div className="page-body">
        <section className="panel">
          <div className="panel__header">
            <div className="skeleton-bar" style={{ width: 170, height: 20 }} />
          </div>
          <div className="panel__body--padded" style={{ display: "grid", gap: 12 }}>
            {[1, 2, 3, 4, 5, 6].map((row) => (
              <div key={row} className="skeleton-bar" style={{ width: "100%", height: 56, borderRadius: 8 }} />
            ))}
          </div>
        </section>
      </div>
    </RouteLoading>
  );
}
