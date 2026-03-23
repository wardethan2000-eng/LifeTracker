"use client";

import type { Asset } from "@lifekeeper/types";
import Link from "next/link";
import type { JSX } from "react";
import { useMemo } from "react";
import { useMultiSelect } from "../lib/use-multi-select";
import {
  formatCategoryLabel,
  formatDate,
  formatVisibilityLabel,
} from "../lib/formatters";
import { AssetBulkActions } from "./asset-bulk-actions";
import { BulkActionBar } from "./bulk-action-bar";

type AssetListWorkspaceProps = {
  householdId: string;
  assets: Asset[];
};

export function AssetListWorkspace({ householdId, assets }: AssetListWorkspaceProps): JSX.Element {
  const { selectedCount, isSelected, toggleItem, toggleGroup, clearSelection } = useMultiSelect();

  const selectedItems = useMemo(
    () => assets.filter((a) => isSelected(a.id)),
    [assets, isSelected]
  );

  const allSelected = assets.length > 0 && selectedCount === assets.length;

  if (assets.length === 0) {
    return (
      <p className="panel__empty">
        No assets found.{" "}
        <Link href="/assets/new" className="text-link">Add your first asset</Link> to get started.
      </p>
    );
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <AssetBulkActions
          householdId={householdId}
          selectedItems={selectedItems}
          allItems={assets}
          onBulkComplete={clearSelection}
        />
      </div>

      <BulkActionBar selectedCount={selectedCount} onClearSelection={clearSelection} />

      <table className="data-table">
        <thead>
          <tr>
            <th style={{ width: 44 }}>
              <input
                type="checkbox"
                aria-label="Select all assets"
                checked={allSelected}
                onChange={(e) => toggleGroup(assets.map((a) => a.id), e.target.checked)}
              />
            </th>
            <th>Asset</th>
            <th>Category</th>
            <th>Visibility</th>
            <th>Status</th>
            <th>Manufacturer</th>
            <th>Model</th>
            <th>Created</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {assets.map((asset) => (
            <tr key={asset.id}>
              <td>
                <input
                  type="checkbox"
                  aria-label={`Select ${asset.name}`}
                  checked={isSelected(asset.id)}
                  onChange={() => toggleItem(asset.id)}
                />
              </td>
              <td>
                <div className="data-table__primary">
                  <Link href={`/assets/${asset.id}`} className="data-table__link">{asset.name}</Link>
                </div>
                {asset.assetTag ? (
                  <div className="data-table__secondary">{asset.assetTag}</div>
                ) : null}
              </td>
              <td><span className="pill">{formatCategoryLabel(asset.category)}</span></td>
              <td><span className="pill">{formatVisibilityLabel(asset.visibility)}</span></td>
              <td>{asset.isArchived ? "Archived" : "Active"}</td>
              <td>{asset.manufacturer ?? "—"}</td>
              <td>{asset.model ?? "—"}</td>
              <td>{formatDate(asset.createdAt)}</td>
              <td>
                <Link href={`/assets/${asset.id}`} className="data-table__link">Open</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
