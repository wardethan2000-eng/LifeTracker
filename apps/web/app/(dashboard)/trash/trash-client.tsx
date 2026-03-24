"use client";

import type { JSX } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TrashItem } from "@lifekeeper/types";
import {
  restoreAssetByIdAction,
  restoreProjectAction,
  restoreInventoryItemAction,
  purgeAssetAction,
  purgeProjectAction,
  purgeInventoryItemAction,
  purgeAllTrashAction,
} from "../../actions";
import { ConfirmDestructiveAction } from "../../../components/confirm-destructive-action";

type TrashPageClientProps = {
  householdId: string;
  items: TrashItem[];
  total: number;
};

const TYPE_LABELS: Record<TrashItem["type"], string> = {
  asset: "Asset",
  project: "Project",
  inventory_item: "Inventory",
};

function formatDeletedDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

type TrashItemRowProps = {
  item: TrashItem;
  householdId: string;
};

function TrashItemRow({ item, householdId }: TrashItemRowProps): JSX.Element {
  const router = useRouter();

  async function handleRestore(): Promise<void> {
    if (item.type === "asset") {
      await restoreAssetByIdAction(item.id);
    } else if (item.type === "project") {
      await restoreProjectAction(householdId, item.id);
    } else if (item.type === "inventory_item") {
      await restoreInventoryItemAction(householdId, item.id);
    }
    router.refresh();
  }

  async function handlePurge(): Promise<void> {
    if (item.type === "asset") {
      await purgeAssetAction(item.id, householdId);
    } else if (item.type === "project") {
      await purgeProjectAction(householdId, item.id);
    } else if (item.type === "inventory_item") {
      await purgeInventoryItemAction(householdId, item.id);
    }
    router.refresh();
  }

  return (
    <div className="trash-item">
      <div className="trash-item__info">
        <span className={`trash-item__type-badge trash-item__type-badge--${item.type}`}>
          {TYPE_LABELS[item.type]}
        </span>
        <span className="trash-item__name">{item.name}</span>
        <span className="trash-item__meta">Deleted {formatDeletedDate(item.deletedAt)}</span>
      </div>
      <div className="trash-item__actions">
        <button
          type="button"
          className="button button--ghost button--sm"
          onClick={() => { void handleRestore(); }}
        >
          Restore
        </button>
        <ConfirmDestructiveAction
          action={async () => undefined}
          triggerLabel="Delete Permanently"
          title="Permanently delete"
          message={`Permanently delete "${item.name}"? This cannot be undone.`}
          confirmLabel="Delete Permanently"
          triggerClassName="button button--ghost button--sm trash-item__purge-btn"
          confirmClassName="button button--danger button--sm"
          cancelClassName="button button--ghost button--sm"
          deferredAction={async () => { await handlePurge(); }}
        />
      </div>
    </div>
  );
}

export function TrashPageClient({ householdId, items, total }: TrashPageClientProps): JSX.Element {
  const router = useRouter();
  const [purgeAllPhase, setPurgeAllPhase] = useState<"idle" | "confirm">("idle");

  async function handlePurgeAll(): Promise<void> {
    await purgeAllTrashAction(householdId);
    setPurgeAllPhase("idle");
    router.refresh();
  }

  if (items.length === 0) {
    return (
      <div className="trash-page__empty">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
        </svg>
        <p>No recently deleted items.</p>
        <p className="trash-page__empty-sub">Items you delete will appear here for 30 days.</p>
      </div>
    );
  }

  return (
    <div className="trash-list-wrapper">
      <div className="trash-list-toolbar">
        <span className="trash-list-count">{total} item{total !== 1 ? "s" : ""}</span>
        {purgeAllPhase === "idle" ? (
          <button
            type="button"
            className="button button--ghost button--sm"
            onClick={() => setPurgeAllPhase("confirm")}
          >
            Empty Trash
          </button>
        ) : (
          <div className="trash-purge-all-confirm">
            <span>Permanently delete all {total} items?</span>
            <button
              type="button"
              className="button button--danger button--sm"
              onClick={() => { void handlePurgeAll(); }}
            >
              Delete All Permanently
            </button>
            <button
              type="button"
              className="button button--ghost button--sm"
              onClick={() => setPurgeAllPhase("idle")}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
      <div className="trash-list">
        {items.map((item) => (
          <TrashItemRow key={`${item.type}:${item.id}`} item={item} householdId={householdId} />
        ))}
      </div>
    </div>
  );
}
