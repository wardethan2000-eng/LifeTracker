"use client";

import type { JSX } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type AssetTabNavProps = {
  assetId: string;
};

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "details", label: "Structured Details" },
  { id: "metrics", label: "Usage Metrics" },
  { id: "costs", label: "Costs" },
  { id: "maintenance", label: "Maintenance" },
  { id: "history", label: "History" },
  { id: "entries", label: "Entries" },
  { id: "comments", label: "Comments" },
  { id: "settings", label: "Settings" }
] as const;

export function AssetTabNav({ assetId }: AssetTabNavProps): JSX.Element {
  const pathname = usePathname();
  const basePath = `/assets/${assetId}`;

  return (
    <nav className="tab-navigation" aria-label="Asset sections">
      <ul style={{ display: "flex", gap: "24px", listStyle: "none", padding: "0 0 12px 0", margin: "16px 0 24px 0", borderBottom: "1px solid var(--border-color)", overflowX: "auto" }}>
        {tabs.map((item) => {
          const href = item.id === "overview" ? basePath : `${basePath}/${item.id}`;
          const isActive = item.id === "overview"
            ? pathname === basePath
            : pathname.startsWith(`${basePath}/${item.id}`);

          return (
            <li key={item.id}>
              <Link
                href={href}
                style={{
                  textDecoration: "none",
                  color: isActive ? "var(--ink-base)" : "var(--ink-muted)",
                  fontWeight: isActive ? 600 : "normal",
                  paddingBottom: "12px",
                  borderBottom: isActive ? "2px solid var(--ink-base)" : "none",
                  display: "block"
                }}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}