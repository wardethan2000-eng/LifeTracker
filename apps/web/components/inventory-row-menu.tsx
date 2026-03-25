"use client";

import type { JSX } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { duplicateInventoryItem, deleteInventoryItem } from "../lib/api";
import { useToast } from "./toast-provider";

type InventoryRowMenuProps = {
  householdId: string;
  itemId: string;
  itemName: string;
};

export function InventoryRowMenu({ householdId, itemId, itemName }: InventoryRowMenuProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { pushToast } = useToast();

  // Close on outside click
  useEffect(() => {
    if (!open) return;

    const handleClick = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;

    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  const handleDuplicate = useCallback(async () => {
    setBusy(true);
    try {
      const copy = await duplicateInventoryItem(householdId, itemId);
      pushToast({ message: `Duplicated "${itemName}" → "${copy.name}"` });
      router.refresh();
    } catch {
      pushToast({ message: "Failed to duplicate item", tone: "danger" });
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }, [householdId, itemId, itemName, pushToast, router]);

  const handleDelete = useCallback(async () => {
    setBusy(true);
    try {
      await deleteInventoryItem(householdId, itemId);
      pushToast({ message: `Moved "${itemName}" to trash` });
      router.refresh();
    } catch {
      pushToast({ message: "Failed to delete item", tone: "danger" });
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }, [householdId, itemId, itemName, pushToast, router]);

  return (
    <div className="row-menu" ref={menuRef}>
      <button
        type="button"
        className="button button--ghost button--sm"
        aria-label="More actions"
        aria-expanded={open}
        style={{ padding: "2px 6px", fontSize: "1.1rem", lineHeight: 1 }}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        disabled={busy}
      >
        ⋮
      </button>
      {open && (
        <div className="row-menu__dropdown">
          <a
            href={`/inventory/${itemId}?householdId=${householdId}`}
            className="row-menu__item"
            onClick={() => setOpen(false)}
          >
            View Details
          </a>
          <button
            type="button"
            className="row-menu__item"
            onClick={() => { void handleDuplicate(); }}
            disabled={busy}
          >
            Duplicate
          </button>
          <button
            type="button"
            className="row-menu__item row-menu__item--danger"
            onClick={() => { void handleDelete(); }}
            disabled={busy}
          >
            Move to Trash
          </button>
        </div>
      )}
    </div>
  );
}
