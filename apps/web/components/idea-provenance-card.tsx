"use client";

import type { JSX } from "react";
import Link from "next/link";
import type { IdeaPromotionTarget } from "@aegis/types";
import { CollapsibleCard } from "./collapsible-card";
import { useFormattedDate } from "../lib/formatted-date";

const targetLabels: Record<string, string> = {
  project: "Project",
  asset: "Asset",
  hobby: "Hobby",
};

const targetRoutes: Record<string, string> = {
  project: "/projects",
  asset: "/assets",
  hobby: "/hobbies",
};

type IdeaProvenanceCardProps = {
  demotedFromType: IdeaPromotionTarget | null;
  demotedFromId: string | null;
  promotedAt: string | null;
  promotedToType: IdeaPromotionTarget | null;
  promotedToId: string | null;
  createdAt: string;
};

export function IdeaProvenanceCard({
  demotedFromType,
  demotedFromId,
  promotedAt,
  promotedToType,
  promotedToId,
  createdAt,
}: IdeaProvenanceCardProps): JSX.Element {
  const { formatDate } = useFormattedDate();
  const createdDate = formatDate(createdAt);

  const parts: string[] = [];
  if (demotedFromType && demotedFromId) parts.push(`Demoted from ${targetLabels[demotedFromType]}`);
  if (promotedAt && promotedToType) parts.push(`Promoted to ${targetLabels[promotedToType]}`);
  parts.push(`Created ${createdDate}`);
  const summary = parts.join(" · ");

  const promotedDate = promotedAt
    ? formatDate(promotedAt)
    : null;

  return (
    <CollapsibleCard title="Provenance" summary={summary}>
      <div style={{ display: "grid", gap: 10, fontSize: "0.85rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "var(--ink-muted)" }}>Created</span>
          <span>{createdDate}</span>
        </div>

        {demotedFromType && demotedFromId && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--ink-muted)" }}>Demoted from</span>
            <Link
              href={`${targetRoutes[demotedFromType]}/${demotedFromId}`}
              className="text-link"
            >
              {targetLabels[demotedFromType]}
            </Link>
          </div>
        )}

        {promotedAt && promotedToType && promotedToId && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--ink-muted)" }}>Promoted to</span>
            <span>
              <Link
                href={`${targetRoutes[promotedToType]}/${promotedToId}`}
                className="text-link"
              >
                {targetLabels[promotedToType]}
              </Link>
              {promotedDate && <span style={{ color: "var(--ink-muted)" }}> on {promotedDate}</span>}
            </span>
          </div>
        )}
      </div>
    </CollapsibleCard>
  );
}
