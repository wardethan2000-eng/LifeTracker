import type { JSX } from "react";

import { RouteLoading } from "../../../../components/route-loading";

export default function NewProjectLoading(): JSX.Element {
  return (
    <RouteLoading>
      <header className="page-header">
        <div>
          <div className="skeleton-bar" style={{ width: 180, height: 28, marginBottom: 8 }} />
          <div className="skeleton-bar" style={{ width: 320, height: 14 }} />
        </div>
        <div className="skeleton-bar" style={{ width: 140, height: 36, borderRadius: 8 }} />
      </header>

      <div className="page-body" style={{ display: "grid", gap: 16 }}>
        <section className="panel">
          <div className="panel__body--padded" style={{ display: "grid", gap: 14 }}>
            {[1, 2, 3, 4, 5, 6].map((field) => (
              <div key={field} style={{ display: "grid", gap: 8 }}>
                <div className="skeleton-bar" style={{ width: 110, height: 12 }} />
                <div className="skeleton-bar" style={{ width: "100%", height: 38, borderRadius: 8 }} />
              </div>
            ))}
          </div>
        </section>
      </div>
    </RouteLoading>
  );
}
