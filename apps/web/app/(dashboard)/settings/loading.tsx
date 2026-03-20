import type { JSX } from "react";
import { RouteLoading } from "../../../components/route-loading";

export default function SettingsLoading(): JSX.Element {
  return (
    <RouteLoading>
      <div className="skeleton-page">
        <header className="page-header">
          <div>
            <div className="skeleton-bar" style={{ width: 160, height: 28 }} />
            <div className="skeleton-bar" style={{ width: 260, height: 16, marginTop: 6 }} />
          </div>
        </header>
        <div className="page-body">
          <div className="panel">
            <div className="panel__header">
              <div>
                <div className="skeleton-bar" style={{ width: 120, height: 20 }} />
                <div className="skeleton-bar" style={{ width: 200, height: 16, marginTop: 6 }} />
              </div>
            </div>
            <div className="panel__body--padded">
              <div className="skeleton-bar" style={{ width: 180, height: 40, borderRadius: 8 }} />
            </div>
          </div>
        </div>
      </div>
    </RouteLoading>
  );
}
