import type { JSX } from "react";

import { RouteLoading } from "../../../components/route-loading";

export default function NotificationsLoading(): JSX.Element {
  return (
    <RouteLoading>
      <div className="skeleton-page">
        <header className="page-header">
          <div className="skeleton-bar" style={{ width: 180, height: 28 }} />
        </header>
        <div className="page-body">
          <div className="panel">
            <div className="panel__header">
              <div className="skeleton-bar" style={{ width: 140, height: 20 }} />
            </div>
            <div className="panel__body" style={{ padding: 0 }}>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} style={{ display: "flex", gap: 12, padding: "14px 20px", borderBottom: "1px solid var(--border)", alignItems: "center" }}>
                  <div className="skeleton-bar" style={{ width: 60, height: 22, borderRadius: 999 }} />
                  <div style={{ flex: 1, display: "grid", gap: 4 }}>
                    <div className="skeleton-bar" style={{ width: 200, height: 16 }} />
                    <div className="skeleton-bar" style={{ width: 300, height: 14 }} />
                  </div>
                  <div className="skeleton-bar" style={{ width: 80, height: 14 }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </RouteLoading>
  );
}
