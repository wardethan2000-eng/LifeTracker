import type { JSX } from "react";
import { RouteLoading } from "../../../components/route-loading";

export default function NotesLoading(): JSX.Element {
  return (
    <RouteLoading>
      <div className="skeleton-page">
        <header className="page-header">
          <div>
            <div className="skeleton-bar" style={{ width: 80, height: 28 }} />
            <div className="skeleton-bar" style={{ width: 260, height: 16, marginTop: 6 }} />
          </div>
        </header>
        <div className="page-body">
          <div className="panel">
            <div className="panel__header">
              <div className="skeleton-bar" style={{ width: 140, height: 20 }} />
            </div>
            <div className="panel__body" style={{ padding: 0 }}>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} style={{ display: "flex", gap: 16, padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
                  <div className="skeleton-bar" style={{ width: 220, height: 18 }} />
                  <div className="skeleton-bar" style={{ width: 80, height: 18 }} />
                  <div className="skeleton-bar" style={{ flex: 1 }} />
                  <div className="skeleton-bar" style={{ width: 60, height: 18 }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </RouteLoading>
  );
}
