"use client";

import type { SpaceResponse } from "@lifekeeper/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { JSX } from "react";
import { useState } from "react";
import { formatSpaceBreadcrumb, getSpaceTypeBadge, getSpaceTypeLabel } from "../lib/spaces";
import { SpaceForm } from "./space-form";

type SpacesSectionClientProps = {
  householdId: string;
  spaces: SpaceResponse[];
};

const SpaceTreeNode = ({ householdId, space }: { householdId: string; space: SpaceResponse }): JSX.Element => {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = (space.children?.length ?? 0) > 0;

  return (
    <li style={{ display: "grid", gap: 10 }}>
      <article className="schedule-card" style={{ gap: 12 }}>
        <div className="schedule-card__summary" style={{ alignItems: "start" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              {hasChildren ? (
                <button type="button" className="button button--ghost button--xs" onClick={() => setExpanded((current) => !current)}>
                  {expanded ? "Hide" : "Show"}
                </button>
              ) : null}
              <span className="pill">{getSpaceTypeBadge(space.type)}</span>
              <Link href={`/inventory/spaces/${space.id}?householdId=${householdId}`} className="data-table__link">{space.name}</Link>
              <span className="pill">{space.shortCode}</span>
              <span className="data-table__secondary">{getSpaceTypeLabel(space.type)}</span>
            </div>
            <div className="data-table__secondary">{formatSpaceBreadcrumb(space)}</div>
          </div>
          <div className="data-table__secondary">{space.totalItemCount ?? 0} items</div>
        </div>
      </article>
      {expanded && hasChildren ? (
        <ul style={{ listStyle: "none", margin: 0, padding: "0 0 0 20px", display: "grid", gap: 10, borderLeft: "1px solid var(--border)" }}>
          {space.children?.map((child) => <SpaceTreeNode key={child.id} householdId={householdId} space={child} />)}
        </ul>
      ) : null}
    </li>
  );
};

export function SpacesSectionClient({ householdId, spaces }: SpacesSectionClientProps): JSX.Element {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);

  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <h2>Spaces</h2>
          <div className="data-table__secondary">Track buildings, rooms, bins, and other storage locations in a household hierarchy.</div>
        </div>
        <button type="button" className="button button--primary button--sm" onClick={() => setShowCreate((current) => !current)}>
          {showCreate ? "Close Form" : "Add Space"}
        </button>
      </div>
      {showCreate ? (
        <div className="panel__body--padded" style={{ borderBottom: "1px solid var(--border)" }}>
          <SpaceForm
            householdId={householdId}
            spaces={spaces}
            onSaved={() => {
              setShowCreate(false);
              router.refresh();
            }}
            onCancel={() => setShowCreate(false)}
          />
        </div>
      ) : null}
      <div className="panel__body">
        {spaces.length === 0 ? (
          <p className="panel__empty">No spaces have been added yet.</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }}>
            {spaces.map((space) => <SpaceTreeNode key={space.id} householdId={householdId} space={space} />)}
          </ul>
        )}
      </div>
    </section>
  );
}