"use client";

import type { AssetDetailResponse, InventoryItemSummary, ProjectSummary } from "@lifekeeper/types";
import type { JSX } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  addAssetToProjectAction,
  removeAssetFromProjectAction,
  addAssetInventoryLinkAction,
  removeAssetInventoryLinkAction
} from "../app/actions";
import { formatCategoryLabel } from "../lib/formatters";

type AssetRelationshipsTabProps = {
  detail: AssetDetailResponse;
  assetId: string;
  householdId: string;
  allProjects: ProjectSummary[];
  allInventoryItems: InventoryItemSummary[];
};

const RELATIONSHIP_LABELS: Record<string, string> = {
  target: "Target",
  produces: "Produces",
  consumes: "Consumes",
  supports: "Supports"
};

export function AssetRelationshipsTab({
  detail,
  assetId,
  householdId,
  allProjects,
  allInventoryItems
}: AssetRelationshipsTabProps): JSX.Element {
  const router = useRouter();
  const { asset, projectLinks, inventoryLinks, hobbyLinks } = detail;

  const linkedProjectIds = new Set(projectLinks.map((p) => p.projectId));
  const unlinkedProjects = allProjects.filter((p) => !linkedProjectIds.has(p.id));

  const linkedInventoryItemIds = new Set(inventoryLinks.map((l) => l.inventoryItemId));
  const unlinkedInventoryItems = allInventoryItems.filter((i) => !linkedInventoryItemIds.has(i.id));

  async function handleAddProject(formData: FormData): Promise<void> {
    await addAssetToProjectAction(formData);
    router.refresh();
  }

  async function handleRemoveProject(formData: FormData): Promise<void> {
    await removeAssetFromProjectAction(formData);
    router.refresh();
  }

  async function handleAddInventory(formData: FormData): Promise<void> {
    await addAssetInventoryLinkAction(formData);
    router.refresh();
  }

  async function handleRemoveInventory(formData: FormData): Promise<void> {
    await removeAssetInventoryLinkAction(formData);
    router.refresh();
  }

  return (
    <div style={{ display: "grid", gap: "24px" }}>

      {/* ── Components ─────────────────────────────────────────── */}
      <section className="panel">
        <div className="panel__header">
          <h2>Components</h2>
          <Link
            href={`/assets/new?parentAssetId=${assetId}`}
            className="button button--ghost button--sm"
          >
            Add component
          </Link>
        </div>
        <div className="panel__body">
          {asset.parentAsset && (
            <div className="workbench-details" style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
              <span style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>Part of</span>
              <Link href={`/assets/${asset.parentAsset.id}`} className="text-link">
                {asset.parentAsset.name}
                <span style={{ color: "var(--ink-muted)", marginLeft: "6px", fontSize: "0.85rem" }}>
                  ({formatCategoryLabel(asset.parentAsset.category)})
                </span>
              </Link>
            </div>
          )}
          {asset.childAssets.length === 0 ? (
            <p className="panel__empty">No components linked. Use &ldquo;Add component&rdquo; to link a child asset.</p>
          ) : (
            <table className="workbench-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                </tr>
              </thead>
              <tbody>
                {asset.childAssets.map((child) => (
                  <tr key={child.id}>
                    <td>
                      <Link href={`/assets/${child.id}`} className="text-link">
                        {child.name}
                      </Link>
                    </td>
                    <td style={{ color: "var(--ink-muted)" }}>{formatCategoryLabel(child.category)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* ── Projects ───────────────────────────────────────────── */}
      <section className="panel">
        <div className="panel__header">
          <h2>Projects</h2>
        </div>
        <div className="panel__body">
          {projectLinks.length === 0 ? (
            <p className="panel__empty">No projects linked.</p>
          ) : (
            <table className="workbench-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Relationship</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {projectLinks.map((link) => (
                  <tr key={link.id}>
                    <td>
                      <Link href={`/projects/${link.projectId}`} className="text-link">
                        {link.project.name}
                      </Link>
                    </td>
                    <td>
                      <span className="pill">{RELATIONSHIP_LABELS[link.relationship] ?? link.relationship}</span>
                    </td>
                    <td style={{ color: "var(--ink-muted)", fontSize: "0.88rem" }}>{link.project.status}</td>
                    <td>
                      <form action={handleRemoveProject}>
                        <input type="hidden" name="householdId" value={householdId} />
                        <input type="hidden" name="assetId" value={assetId} />
                        <input type="hidden" name="projectId" value={link.projectId} />
                        <input type="hidden" name="projectAssetId" value={link.id} />
                        <button type="submit" className="button button--ghost button--sm button--danger">
                          Remove
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {unlinkedProjects.length > 0 && (
            <div style={{ padding: "12px 16px", borderTop: projectLinks.length > 0 ? "1px solid var(--border)" : undefined }}>
              <form action={handleAddProject} style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                <input type="hidden" name="householdId" value={householdId} />
                <input type="hidden" name="assetId" value={assetId} />
                <select name="projectId" className="workbench-select" required>
                  <option value="">Select project…</option>
                  {unlinkedProjects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <select name="relationship" className="workbench-select">
                  <option value="target">Target</option>
                  <option value="supports">Supports</option>
                  <option value="produces">Produces</option>
                  <option value="consumes">Consumes</option>
                </select>
                <button type="submit" className="button button--sm">Link to project</button>
              </form>
            </div>
          )}
        </div>
      </section>

      {/* ── Hobbies ────────────────────────────────────────────── */}
      {hobbyLinks.length > 0 && (
        <section className="panel">
          <div className="panel__header">
            <h2>Hobbies</h2>
          </div>
          <div className="panel__body">
            <table className="workbench-table">
              <thead>
                <tr>
                  <th>Hobby</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Role</th>
                </tr>
              </thead>
              <tbody>
                {hobbyLinks.map((link) => (
                  <tr key={link.id}>
                    <td>
                      <Link href={`/hobbies/${link.hobbyId}`} className="text-link">
                        {link.hobbyName}
                      </Link>
                    </td>
                    <td style={{ color: "var(--ink-muted)", fontSize: "0.88rem" }}>{link.hobbyType ?? "—"}</td>
                    <td><span className="pill">{link.hobbyStatus}</span></td>
                    <td style={{ color: "var(--ink-muted)", fontSize: "0.88rem" }}>{link.role ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ padding: "8px 16px", color: "var(--ink-muted)", fontSize: "0.85rem" }}>
              Manage equipment links from the hobby&rsquo;s settings page.
            </p>
          </div>
        </section>
      )}

      {/* ── Inventory Items ────────────────────────────────────── */}
      <section className="panel">
        <div className="panel__header">
          <h2>Inventory Items</h2>
        </div>
        <div className="panel__body">
          {inventoryLinks.length === 0 ? (
            <p className="panel__empty">No inventory items linked to this asset.</p>
          ) : (
            <table className="workbench-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>On hand</th>
                  <th>Recommended qty</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {inventoryLinks.map((link) => (
                  <tr key={link.id}>
                    <td>
                      <Link href={`/inventory/${link.inventoryItemId}`} className="text-link">
                        {link.inventoryItem.name}
                      </Link>
                    </td>
                    <td style={{ color: "var(--ink-muted)" }}>
                      {link.inventoryItem.quantityOnHand} {link.inventoryItem.unit}
                    </td>
                    <td style={{ color: "var(--ink-muted)" }}>
                      {link.recommendedQuantity != null
                        ? `${link.recommendedQuantity} ${link.inventoryItem.unit}`
                        : "—"}
                    </td>
                    <td>
                      <form action={handleRemoveInventory}>
                        <input type="hidden" name="assetId" value={assetId} />
                        <input type="hidden" name="inventoryItemId" value={link.inventoryItemId} />
                        <button type="submit" className="button button--ghost button--sm button--danger">
                          Remove
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {unlinkedInventoryItems.length > 0 && (
            <div style={{ padding: "12px 16px", borderTop: inventoryLinks.length > 0 ? "1px solid var(--border)" : undefined }}>
              <form action={handleAddInventory} style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                <input type="hidden" name="assetId" value={assetId} />
                <select name="inventoryItemId" className="workbench-select" required>
                  <option value="">Select inventory item…</option>
                  {unlinkedInventoryItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.quantityOnHand} {item.unit})
                    </option>
                  ))}
                </select>
                <button type="submit" className="button button--sm">Link item</button>
              </form>
            </div>
          )}
        </div>
      </section>

    </div>
  );
}
