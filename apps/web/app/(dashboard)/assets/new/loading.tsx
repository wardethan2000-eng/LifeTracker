import type { JSX } from "react";

import { RouteLoading } from "../../../../components/route-loading";

export default function NewAssetLoading(): JSX.Element {
  return (
    <RouteLoading>
      <header className="page-header">
        <div className="skeleton-bar" style={{ width: 190, height: 28 }} />
      </header>

      <div className="page-body" style={{ display: "grid", gap: 16 }}>
        <section className="panel">
          <div className="panel__body--padded" style={{ display: "grid", gap: 14 }}>
            <div className="skeleton-bar" style={{ width: 260, height: 14 }} />
            {[1, 2, 3, 4, 5, 6].map((field) => (
              <div key={field} style={{ display: "grid", gap: 8 }}>
                <div className="skeleton-bar" style={{ width: 130, height: 12 }} />
                <div className="skeleton-bar" style={{ width: "100%", height: 38, borderRadius: 8 }} />
              </div>
            ))}
          </div>
        </section>
      </div>
    </RouteLoading>
  );
}
