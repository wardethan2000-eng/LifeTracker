"use client";

import type { Asset, AssetCategory, AssetVisibility } from "@lifekeeper/types";
import { assetCategoryValues, assetVisibilityValues } from "@lifekeeper/types";
import Link from "next/link";
import type { JSX } from "react";
import { useCallback, useMemo, useState } from "react";
import { useMultiSelect } from "../lib/use-multi-select";
import {
  formatCategoryLabel,
  formatDate,
  formatVisibilityLabel,
} from "../lib/formatters";
import { AssetBulkActions } from "./asset-bulk-actions";
import { BulkActionBar } from "./bulk-action-bar";
import { ClickToEdit } from "./click-to-edit";
import { ClickToEditSelect } from "./click-to-edit-select";
import { useToast } from "./toast-provider";
import { updateAssetFieldAction } from "../app/actions";

type AssetListWorkspaceProps = {
  householdId: string;
  assets: Asset[];
};

const CATEGORY_OPTIONS = assetCategoryValues.map((v) => ({
  value: v,
  label: formatCategoryLabel(v as AssetCategory),
}));

const VISIBILITY_OPTIONS = assetVisibilityValues.map((v) => ({
  value: v,
  label: formatVisibilityLabel(v as AssetVisibility),
}));

export function AssetListWorkspace({ householdId, assets }: AssetListWorkspaceProps): JSX.Element {
  const { selectedCount, isSelected, toggleItem, toggleGroup, clearSelection } = useMultiSelect();
  const { pushToast } = useToast();

  // Optimistic field overrides: { [assetId]: { field: value } }
  const [optimistic, setOptimistic] = useState<Record<string, Partial<Asset>>>({});
  // Currently saving cells: `${assetId}:${field}`
  const [saving, setSaving] = useState<Set<string>>(new Set());

  const selectedItems = useMemo(
    () => assets.filter((a) => isSelected(a.id)),
    [assets, isSelected]
  );

  const allSelected = assets.length > 0 && selectedCount === assets.length;

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
                <td>{asset.isArchived ? "Archived" : "Active"}</td>
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

              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
