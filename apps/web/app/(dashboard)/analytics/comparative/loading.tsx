import type { JSX } from "react";

import { RouteLoading } from "../../../../components/route-loading";

export default function ComparativeAnalyticsLoading(): JSX.Element {
  return (
    <RouteLoading>
      <div className="skeleton-page">
        <header className="page-header">
          <div className="skeleton-bar" style={{ width: 240, height: 28 }} />
        </header>
        <div className="page-body">
          <div className="analytics-tab-bar">
            <div className="skeleton-bar" style={{ width: 160, height: 40, borderRadius: 8 }} />
            <div className="skeleton-bar" style={{ width: 150, height: 40, borderRadius: 8 }} />
            <div className="skeleton-bar" style={{ width: 190, height: 40, borderRadius: 8 }} />
          </div>
          <section className="panel">
            <div className="panel__header">
              <div className="skeleton-bar" style={{ width: 220, height: 20 }} />
            </div>
            <div className="panel__body comparative-skeleton">
              <div className="skeleton-bar" style={{ width: "100%", height: 56, borderRadius: 10 }} />
              <div className="skeleton-bar" style={{ width: "100%", height: 56, borderRadius: 10 }} />
              <div className="skeleton-bar" style={{ width: "100%", height: 56, borderRadius: 10 }} />
            </div>
          </section>
          <section className="panel">
            <div className="panel__body comparative-skeleton">
              <div className="skeleton-bar" style={{ width: "100%", height: 300, borderRadius: 12 }} />
              <div className="skeleton-bar" style={{ width: "100%", height: 52, borderRadius: 10 }} />
              <div className="skeleton-bar" style={{ width: "100%", height: 52, borderRadius: 10 }} />
            </div>
          </section>
        </div>
      </div>
    </RouteLoading>
  );
}