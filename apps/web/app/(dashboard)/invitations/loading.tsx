import type { JSX } from "react";

import { RouteLoading } from "../../../components/route-loading";

export default function InvitationsLoading(): JSX.Element {
  return (
    <RouteLoading>
      <header className="page-header">
        <div className="skeleton-bar" style={{ width: 140, height: 28 }} />
      </header>

      <div className="page-body" style={{ display: "grid", gap: 16 }}>
        {[1, 2].map((panel) => (
          <section key={panel} className="panel">
            <div className="panel__header">
              <div className="skeleton-bar" style={{ width: 220, height: 20 }} />
            </div>
            <div className="panel__body--padded" style={{ display: "grid", gap: 10 }}>
              <div className="skeleton-bar" style={{ width: 140, height: 12 }} />
              <div className="skeleton-bar" style={{ width: "100%", height: 38, borderRadius: 8 }} />
              <div className="skeleton-bar" style={{ width: 110, height: 36, borderRadius: 8 }} />
            </div>
          </section>
        ))}

        <section className="panel">
          <div className="panel__header">
            <div className="skeleton-bar" style={{ width: 180, height: 20 }} />
          </div>
          <div className="panel__body--padded" style={{ display: "grid", gap: 10 }}>
            {[1, 2, 3, 4].map((row) => (
              <div key={row} className="skeleton-bar" style={{ width: "100%", height: 52, borderRadius: 8 }} />
            ))}
          </div>
        </section>
      </div>
    </RouteLoading>
  );
}
