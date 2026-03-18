import type { JSX } from "react";

import { RouteLoading } from "../../../components/route-loading";
import { SkeletonBlock, SkeletonCard, SkeletonTextLine } from "../../../components/skeleton";

export default function AssetScanLoading(): JSX.Element {
  return (
    <RouteLoading>
      <main className="public-report inline-stack">
        <header className="public-report__header inline-stack inline-stack--xs">
          <SkeletonTextLine size="lg" width="sm" />
          <SkeletonTextLine size="sm" width="md" />
        </header>
        <SkeletonCard titleWidth="sm" lineWidths={["full", "md"]} blockVariant="row" />
        <SkeletonBlock variant="button" width="sm" />
      </main>
    </RouteLoading>
  );
}