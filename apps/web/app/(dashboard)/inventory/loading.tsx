import type { JSX } from "react";

import { RouteLoading } from "../../../components/route-loading";

export default function InventoryLoading(): JSX.Element {
  return (
    <RouteLoading>
      <header className="page-header">
        <div className="skeleton-bar" style={{ width: 150, height: 28 }} />
      </header>

      <div className="page-body" style={{ display: "grid", gap: 16 }}>
        <section className="panel">
          <div className="panel__body--padded" style={{ display: "flex", gap: 8 }}>
            {[1, 2, 3, 4].map((chip) => (
              <div key={chip} className="skeleton-bar" style={{ width: 90, height: 32, borderRadius: 999 }} />
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <div className="skeleton-bar" style={{ width: 220, height: 20 }} />
          </div>
          <div className="panel__body" style={{ padding: 0 }}>
            {[1, 2, 3, 4, 5].map((row) => (
              <div key={row} style={{ display: "flex", gap: 12, padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
                <div className="skeleton-bar" style={{ width: 180, height: 16 }} />
                <div className="skeleton-bar" style={{ width: 120, height: 16 }} />
                <div className="skeleton-bar" style={{ width: 90, height: 16 }} />
                <div className="skeleton-bar" style={{ flex: 1, height: 16 }} />
              </div>
            ))}
          </div>
        </section>
      </div>
    </RouteLoading>
  );
}
