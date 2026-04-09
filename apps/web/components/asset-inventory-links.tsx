"use client";

import type { AssetInventoryLinkSummary } from "@aegis/types";
import type { JSX, FormEvent } from "react";
import { useState } from "react";
import {
  addAssetInventoryLinkAction,
  removeAssetInventoryLinkAction,
} from "../app/actions";

type InventoryOption = {
  id: string;
  name: string;
  category: string | null;
  unit: string;
  quantityOnHand: number;
};

type AssetInventoryLinksProps = {
  assetId: string;
  initialLinks: AssetInventoryLinkSummary[];
  availableItems: InventoryOption[];
};

export function AssetInventoryLinks({
  assetId,
  initialLinks,
  availableItems,
}: AssetInventoryLinksProps): JSX.Element {
  const [links, setLinks] = useState(initialLinks);
  const [adding, setAdding] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [recommendedQty, setRecommendedQty] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const linkedIds = new Set(links.map((l) => l.inventoryItemId));
  const unlinkedItems = availableItems.filter((item) => !linkedIds.has(item.id));

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedItemId) return;
    setSubmitting(true);
    const fd = new FormData();
    fd.set("assetId", assetId);
    fd.set("inventoryItemId", selectedItemId);
    if (notes.trim()) fd.set("notes", notes.trim());
    if (recommendedQty.trim()) fd.set("recommendedQuantity", recommendedQty.trim());
    await addAssetInventoryLinkAction(fd);
    setAdding(false);
    setSelectedItemId("");
    setRecommendedQty("");
    setNotes("");
    setSubmitting(false);
  };

  const handleRemove = async (inventoryItemId: string) => {
    const fd = new FormData();
    fd.set("assetId", assetId);
    fd.set("inventoryItemId", inventoryItemId);
    await removeAssetInventoryLinkAction(fd);
    setLinks((prev) => prev.filter((l) => l.inventoryItemId !== inventoryItemId));
  };

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      <section className="panel">
        <div className="panel__header">
          <h2>Linked Inventory Items</h2>
          <span className="pill">{links.length}</span>
          <button
            type="button"
            className="button button--ghost button--sm"
            onClick={() => setAdding((v) => !v)}
          >
            {adding ? "Cancel" : "Link Item"}
          </button>
        </div>

        {adding && (
          <div className="panel__body--padded" style={{ borderBottom: "1px solid var(--border)" }}>
            <form onSubmit={handleAdd} className="workbench-grid">
              <label className="field">
                <span>Inventory Item</span>
                <select
                  className="input"
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  required
                >
                  <option value="">— select an item —</option>
                  {unlinkedItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                      {item.category ? ` (${item.category})` : ""}
                      {" · "}
                      {item.quantityOnHand} {item.unit} on hand
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Recommended Qty</span>
                <input
                  type="number"
                  className="input"
                  min="0"
                  step="0.01"
                  placeholder="Optional"
                  value={recommendedQty}
                  onChange={(e) => setRecommendedQty(e.target.value)}
                />
              </label>
              <label className="field field--full">
                <span>Notes</span>
                <input
                  type="text"
                  className="input"
                  placeholder="Optional notes about this pairing"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
              <div className="field field--full" style={{ display: "flex", gap: 8 }}>
                <button
                  type="submit"
                  className="button button--primary button--sm"
                  disabled={submitting || !selectedItemId}
                >
                  {submitting ? "Linking…" : "Link Item"}
                </button>
                <button
                  type="button"
                  className="button button--ghost button--sm"
                  onClick={() => setAdding(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {links.length === 0 ? (
          <div className="panel__body--padded">
            <div className="empty-state">
              <p className="empty-state__title">No inventory items linked</p>
              <p className="empty-state__body">
                Link consumables, spare parts, or supplies that belong to or are used with this asset.
              </p>
            </div>
          </div>
        ) : (
          <table className="workbench-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>On Hand</th>
                <th>Rec. Qty</th>
                <th>Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {links.map((link) => (
                <tr key={link.id}>
                  <td>{link.inventoryItem.name}</td>
                  <td>
                    {link.inventoryItem.quantityOnHand}{" "}
                    <span style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>
                      {link.inventoryItem.unit}
                    </span>
                  </td>
                  <td>
                    {link.recommendedQuantity !== null ? (
                      `${link.recommendedQuantity} ${link.inventoryItem.unit}`
                    ) : (
                      <span style={{ color: "var(--ink-muted)" }}>—</span>
                    )}
                  </td>
                  <td style={{ color: link.notes ? undefined : "var(--ink-muted)" }}>
                    {link.notes ?? "—"}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="button button--ghost button--xs"
                      onClick={() => handleRemove(link.inventoryItemId)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
