import type { JSX } from "react";
import { RouteLoading } from "../../../components/route-loading";

export default function IdeasLoading(): JSX.Element {
  return (
    <RouteLoading>
      <div className="skeleton-page">
        <header className="page-header">
          <div>
            <div className="skeleton-bar" style={{ width: 80, height: 28 }} />
            <div className="skeleton-bar" style={{ width: 260, height: 16, marginTop: 6 }} />
          </div>
          <div className="skeleton-bar" style={{ width: 100, height: 36, borderRadius: 8 }} />
        </header>
        <div className="page-body">
          <div className="panel">
            <div className="panel__header">
              <div className="skeleton-bar" style={{ width: 120, height: 20 }} />
            </div>
            <div className="panel__body" style={{ padding: 0 }}>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} style={{ display: "flex", gap: 16, padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
                  <div className="skeleton-bar" style={{ width: 200, height: 18 }} />
                  <div className="skeleton-bar" style={{ width: 80, height: 18 }} />
                  <div className="skeleton-bar" style={{ flex: 1 }} />
                  <div className="skeleton-bar" style={{ width: 80, height: 18 }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </RouteLoading>
  );
}
