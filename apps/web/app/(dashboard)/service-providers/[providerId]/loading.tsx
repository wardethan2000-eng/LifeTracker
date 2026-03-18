import type { JSX } from "react";

import { RouteLoading } from "../../../../components/route-loading";
import { SkeletonBlock, SkeletonCard, SkeletonTextLine } from "../../../../components/skeleton";

export default function ServiceProviderDetailLoading(): JSX.Element {
  return (
    <RouteLoading>
      <header className="page-header">
        <div className="inline-stack inline-stack--xs">
          <SkeletonTextLine size="lg" width="md" />
          <SkeletonTextLine size="sm" width="lg" />
        </div>
        <SkeletonBlock variant="button" width="sm" />
      </header>

      <div className="page-body inline-stack inline-stack--sm">
        <section className="stats-row">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="stat-card inline-stack inline-stack--xs">
              <SkeletonTextLine size="sm" width="sm" />
              <SkeletonTextLine size="lg" width="xs" />
              <SkeletonTextLine size="sm" width="lg" />
            </div>
          ))}
        </section>

        <SkeletonCard titleWidth="sm" lineWidths={["full", "full", "lg", "full", "full"]} blockVariant="input" />
        <SkeletonCard titleWidth="sm" lineWidths={["full", "full", "full"]} blockVariant="row" />
        <SkeletonCard titleWidth="sm" lineWidths={["full", "full"]} blockVariant="row" />
      </div>
    </RouteLoading>
  );
}