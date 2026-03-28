"use client";

import type { Asset, AssetCategory, AssetVisibility } from "@lifekeeper/types";
import { assetCategoryValues, assetVisibilityValues } from "@lifekeeper/types";
import Link from "next/link";
import type { JSX } from "react";
import { useCallback, useMemo, useState } from "react";
import { useMultiSelect } from "../lib/use-multi-select";
import {
  formatCategoryLabel,
  formatVisibilityLabel,
} from "../lib/formatters";
import { useDisplayPreferences } from "./display-preferences-context";
import { AssetBulkActions } from "./asset-bulk-actions";
import { AssetListFilters } from "./asset-list-filters";
import { BulkActionBar } from "./bulk-action-bar";
import { ClickToEdit } from "./click-to-edit";
import { ClickToEditSelect } from "./click-to-edit-select";
import { useToast } from "./toast-provider";
import { updateAssetFieldAction } from "../app/actions";

type AssetListWorkspaceProps = {
  householdId: string;
  assets: Asset[];
  totalAssets: number;
  includeArchived: boolean;
  currentSearch?: string;
  currentCategory?: string;
  scheduleCountsByAssetId?: Map<string, { overdue: number; due: number }>;
};

const CATEGORY_OPTIONS = assetCategoryValues.map((v) => ({
  value: v,
  label: formatCategoryLabel(v as AssetCategory),
}));

const VISIBILITY_OPTIONS = assetVisibilityValues.map((v) => ({
  value: v,
  label: formatVisibilityLabel(v as AssetVisibility),
}));

export function AssetListWorkspace({ householdId, assets, totalAssets, includeArchived, currentSearch = "", currentCategory = "", scheduleCountsByAssetId }: AssetListWorkspaceProps): JSX.Element {
  const { selectedCount, isSelected, toggleItem, toggleGroup, clearSelection } = useMultiSelect();
  const { pushToast } = useToast();
  const { formatDate } = useDisplayPreferences();

  const [selectAllPages, setSelectAllPages] = useState(false);

  // Optimistic field overrides: { [assetId]: { field: value } }
  const [optimistic, setOptimistic] = useState<Record<string, Partial<Asset>>>({});
  // Currently saving cells: `${assetId}:${field}`
  const [saving, setSaving] = useState<Set<string>>(new Set());

  const selectedItems = useMemo(
    () => assets.filter((a) => isSelected(a.id)),
    [assets, isSelected]
  );

  const allSelected = assets.length > 0 && selectedCount === assets.length;
  const hasMorePages = totalAssets > assets.length;

  const handleClearSelection = (): void => {
    setSelectAllPages(false);
    clearSelection();
  };

  const handleSave = useCallback(
    async (assetId: string, field: keyof Asset, value: string) => {
      const key = `${assetId}:${field}`;
      setSaving((prev) => new Set([...prev, key]));
      setOptimistic((prev) => ({
        ...prev,
        [assetId]: { ...prev[assetId], [field]: value },
      }));

      const result = await updateAssetFieldAction(assetId, householdId, {
        [field]: value,
      });

      if (!result.success) {
        setOptimistic((prev) => {
          const next = { ...prev };
          if (next[assetId]) {
            const fields = { ...next[assetId] };
            delete (fields as Record<string, unknown>)[field];
            next[assetId] = fields;
          }
          return next;
        });
        pushToast({ message: result.message ?? "Update failed", tone: "danger" });
      }

      setSaving((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    },
    [householdId, pushToast],
  );

  if (assets.length === 0 && !currentSearch && !currentCategory) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon" aria-hidden="true">📦</div>
        <h3 className="empty-state__title">No assets yet</h3>
        <p className="empty-state__body">Start tracking your home&apos;s assets — appliances, vehicles, tools, and more.</p>
        <Link href="/assets/new" className="button button--primary">Add your first asset</Link>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <AssetListFilters
        currentSearch={currentSearch}
        currentCategory={currentCategory}
        includeArchived={includeArchived}
        householdId={householdId}
      />
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        {assets.length === 0 ? (
          <p className="panel__empty">No assets match the current filters.</p>
        ) : null}
        <AssetBulkActions
          householdId={householdId}
          selectedItems={selectedItems}
          allItems={assets}
          selectAllPages={selectAllPages}
          totalAssets={totalAssets}
          includeArchived={includeArchived}
          onBulkComplete={handleClearSelection}
        />
      </div>

      <BulkActionBar
        selectedCount={selectedCount}
        selectAllPages={selectAllPages}
        totalAssets={totalAssets}
        onClearSelection={handleClearSelection}
      />

      {allSelected && hasMorePages && !selectAllPages ? (
        <div className="select-all-pages-banner">
          All {assets.length} assets on this page are selected.{" "}
          <button
            type="button"
            className="select-all-pages-banner__link"
            onClick={() => setSelectAllPages(true)}
          >
            Select all {totalAssets} assets
          </button>
        </div>
      ) : null}

      <table className="data-table">
        <thead>
          <tr>
            <th style={{ width: 44 }}>
              <input
                type="checkbox"
                aria-label="Select all assets"
                checked={allSelected}
                onChange={(e) => {
                  if (!e.target.checked) setSelectAllPages(false);
                  toggleGroup(assets.map((a) => a.id), e.target.checked);
                }}
              />
            </th>
            <th>Asset</th>
            <th>Category</th>
            <th>Visibility</th>
            <th>Status</th>
            <th>Due</th>
            <th>Location</th>
            <th>Manufacturer</th>
            <th>Model</th>
            <th>Created</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {assets.map((asset) => {
            const ov = optimistic[asset.id] ?? {};
            const name = (ov.name ?? asset.name) as string;
            const category = (ov.category ?? asset.category) as AssetCategory;
            const visibility = (ov.visibility ?? asset.visibility) as AssetVisibility;
            const manufacturer = (ov.manufacturer ?? asset.manufacturer) as string | null;
            const model = (ov.model ?? asset.model) as string | null;

            return (
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
                  <ClickToEdit
                    value={name}
                    required
                    disabled={saving.has(`${asset.id}:name`)}
                    aria-label={`Edit name of ${asset.name}`}
                    onSave={(v) => { void handleSave(asset.id, "name", v); }}
                  />
                  {asset.assetTag ? (
                    <div className="data-table__secondary">{asset.assetTag}</div>
                  ) : null}
                </td>
                <td>
                  <ClickToEditSelect
                    value={category}
                    options={CATEGORY_OPTIONS}
                    disabled={saving.has(`${asset.id}:category`)}
                    aria-label={`Edit category of ${asset.name}`}
                    renderValue={(v) => <span className="pill">{formatCategoryLabel(v as AssetCategory)}</span>}
                    onSave={(v) => { void handleSave(asset.id, "category", v); }}
                  />
                </td>
                <td>
                  <ClickToEditSelect
                    value={visibility}
                    options={VISIBILITY_OPTIONS}
                    disabled={saving.has(`${asset.id}:visibility`)}
                    aria-label={`Edit visibility of ${asset.name}`}
                    renderValue={(v) => <span className="pill">{formatVisibilityLabel(v as AssetVisibility)}</span>}
                    onSave={(v) => { void handleSave(asset.id, "visibility", v); }}
                  />
                </td>
                <td>
                  {asset.isArchived
                    ? <span className="pill pill--muted">Archived</span>
                    : <span className="pill pill--success">Active</span>}
                </td>
                <td>
                  {(() => {
                    const counts = scheduleCountsByAssetId?.get(asset.id);
                    if (!counts || (counts.overdue === 0 && counts.due === 0)) return <span style={{ color: "var(--ink-muted)" }}>—</span>;
                    return (
                      <span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {counts.overdue > 0 && <span className="pill pill--danger" title={`${counts.overdue} overdue`}>{counts.overdue} overdue</span>}
                        {counts.due > 0 && <span className="pill pill--warning" title={`${counts.due} due`}>{counts.due} due</span>}
                      </span>
                    );
                  })()}
                </td>
                <td>
                  {asset.spaceLocation ? (
                    <span title={asset.spaceLocation.breadcrumb.map((b) => b.name).join(" › ")}>
                      {asset.spaceLocation.name}
                    </span>
                  ) : <span style={{ color: "var(--ink-muted)" }}>—</span>}
                </td>
                <td>
                  <ClickToEdit
                    value={manufacturer ?? ""}
                    placeholder="—"
                    disabled={saving.has(`${asset.id}:manufacturer`)}
                    aria-label={`Edit manufacturer of ${asset.name}`}
                    onSave={(v) => { void handleSave(asset.id, "manufacturer", v); }}
                  />
                </td>
                <td>
                  <ClickToEdit
                    value={model ?? ""}
                    placeholder="—"
                    disabled={saving.has(`${asset.id}:model`)}
                    aria-label={`Edit model of ${asset.name}`}
                    onSave={(v) => { void handleSave(asset.id, "model", v); }}
                  />
                </td>
                <td>{formatDate(asset.createdAt)}</td>
                <td>
                  <Link href={`/assets/${asset.id}`} className="data-table__link">Open</Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

