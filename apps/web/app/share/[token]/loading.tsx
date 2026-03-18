import type { JSX } from "react";

import { RouteLoading } from "../../../components/route-loading";
import { SkeletonBlock, SkeletonCard, SkeletonTextLine } from "../../../components/skeleton";

export default function PublicShareLoading(): JSX.Element {
  return (
    <RouteLoading>
      <main className="public-report">
        <header className="public-report__header inline-stack inline-stack--xs">
          <SkeletonTextLine size="sm" width="xs" />
          <SkeletonTextLine size="lg" width="md" />
          <SkeletonTextLine size="sm" width="sm" />
        </header>

        <div className="inline-stack">
          <SkeletonCard titleWidth="md" lineWidths={["full", "lg"]} blockVariant="row" />
          <SkeletonCard titleWidth="sm" lineWidths={["full", "full", "full"]} blockVariant="panel" />
          <section className="stats-row">
            {[1, 2].map((item) => (
              <div key={item} className="stat-card inline-stack inline-stack--xs">
                <SkeletonTextLine size="sm" width="sm" />
                <SkeletonTextLine size="lg" width="xs" />
              </div>
            ))}
          </section>
        </div>
      </main>
    </RouteLoading>
  );
}