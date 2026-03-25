"use client";

import type { JSX } from "react";
import { usePathname } from "next/navigation";
import { TabNav } from "./tab-nav";

type AssetTabNavProps = {
  assetId: string;
};

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "maintenance", label: "Maintenance" },
  { id: "details", label: "Details" },
  { id: "metrics", label: "Metrics" },
  { id: "costs", label: "Costs" },
  { id: "history", label: "History" },
  { id: "settings", label: "Settings" }
] as const;

export function AssetTabNav({ assetId }: AssetTabNavProps): JSX.Element {
  const pathname = usePathname();
  const basePath = `/assets/${assetId}`;

  return (
    <TabNav
      ariaLabel="Asset sections"
      items={tabs.map((item) => {
        const href = item.id === "overview" ? basePath : `${basePath}/${item.id}`;
        const isActive = item.id === "overview"
          ? pathname === basePath
          : pathname.startsWith(`${basePath}/${item.id}`);

        return {
          id: item.id,
          label: item.label,
          href,
          active: isActive,
        };
      })}
    />
  );
}