import type { JSX } from "react";

import { RouteLoading } from "../../../components/route-loading";

export default function CostsLoading(): JSX.Element {
  return (
    <RouteLoading>
      <div className="page-body">
        <section className="panel">
          <div className="panel__body--padded" style={{ display: "grid", gap: 10 }}>
            <div className="skeleton-bar" style={{ width: 200, height: 18 }} />
            <div className="skeleton-bar" style={{ width: 320, height: 14 }} />
          </div>
        </section>
      </div>
    </RouteLoading>
  );
}
