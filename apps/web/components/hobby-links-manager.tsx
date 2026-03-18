"use client";

import type {
  HobbyDetailAssetLink,
  HobbyDetailInventoryLink,
  HobbyDetailProjectLink,
  HobbyInventoryCategory,
} from "@lifekeeper/types";
import { useState, type FormEvent, type JSX } from "react";
import {
  createHobbyInventoryCategory,
  deleteHobbyInventoryCategory,
  linkHobbyAsset,
  linkHobbyInventory,
  linkHobbyProjectLink,
  unlinkHobbyAsset,
  unlinkHobbyInventory,
  unlinkHobbyProjectLink,
} from "../lib/api";
import {
  SectionFilterBar,
  SectionFilterChildren,
  SectionFilterProvider,
  SectionFilterToggle
} from "./section-filter";

type AssetOption = {
  id: string;
  name: string;
  category: string;
};

type InventoryOption = {
  id: string;
  name: string;
  category: string | null;
  unit: string;
  quantityOnHand: number;
};

type ProjectOption = {
  id: string;
  name: string;
  status: string;
};

type HobbyLinksManagerProps = {
  householdId: string;
  hobbyId: string;
  initialAssetLinks: HobbyDetailAssetLink[];
  initialInventoryLinks: HobbyDetailInventoryLink[];
  initialProjectLinks: HobbyDetailProjectLink[];
  initialCategories: HobbyInventoryCategory[];
  availableAssets: AssetOption[];
  availableInventoryItems: InventoryOption[];
  availableProjects: ProjectOption[];
};

export function HobbyLinksManager({
  householdId,
  hobbyId,
  initialAssetLinks,
  initialInventoryLinks,
  initialProjectLinks,
  initialCategories,
  availableAssets,
  availableInventoryItems,
  availableProjects,
}: HobbyLinksManagerProps): JSX.Element {
  const [assetLinks, setAssetLinks] = useState(initialAssetLinks);
  const [inventoryLinks, setInventoryLinks] = useState(initialInventoryLinks);
  const [projectLinks, setProjectLinks] = useState(initialProjectLinks);
  const [categories, setCategories] = useState(initialCategories);
  const [assetId, setAssetId] = useState("");
  const [assetRole, setAssetRole] = useState("");
  const [assetNotes, setAssetNotes] = useState("");
  const [inventoryItemId, setInventoryItemId] = useState("");
  const [inventoryNotes, setInventoryNotes] = useState("");
  const [projectId, setProjectId] = useState("");
  const [projectNotes, setProjectNotes] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const availableAssetOptions = availableAssets.filter((asset) => !assetLinks.some((link) => link.assetId === asset.id));
  const availableInventoryOptions = availableInventoryItems.filter((item) => !inventoryLinks.some((link) => link.inventoryItemId === item.id));
  const availableProjectOptions = availableProjects.filter((project) => !projectLinks.some((link) => link.projectId === project.id));
  const sortedCategories = [...categories].sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0));
  const inventoryCategoryLookup = new Map(availableInventoryItems.map((item) => [item.id, item.category ?? ""]));

  const handleAssetSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!assetId || pendingKey) {
      return;
    }

    setPendingKey("asset-add");
    setError(null);

    try {
      const created = await linkHobbyAsset(householdId, hobbyId, {
        assetId,
        ...(assetRole.trim() ? { role: assetRole.trim() } : {}),
        ...(assetNotes.trim() ? { notes: assetNotes.trim() } : {}),
      });
      const asset = availableAssets.find((candidate) => candidate.id === assetId);

      if (!asset) {
        throw new Error("Selected asset could not be resolved.");
      }

      setAssetLinks((current) => [...current, { ...created, asset }]);
      setAssetId("");
      setAssetRole("");
      setAssetNotes("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to link asset.");
    } finally {
      setPendingKey(null);
    }
  };

  const handleInventorySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!inventoryItemId || pendingKey) {
      return;
    }

    setPendingKey("inventory-add");
    setError(null);

    try {
      const created = await linkHobbyInventory(householdId, hobbyId, {
        inventoryItemId,
        ...(inventoryNotes.trim() ? { notes: inventoryNotes.trim() } : {}),
      });
      const inventoryItem = availableInventoryItems.find((candidate) => candidate.id === inventoryItemId);

      if (!inventoryItem) {
        throw new Error("Selected inventory item could not be resolved.");
      }

      setInventoryLinks((current) => [...current, { ...created, inventoryItem }]);
      setInventoryItemId("");
      setInventoryNotes("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to link inventory item.");
    } finally {
      setPendingKey(null);
    }
  };

  const handleProjectSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!projectId || pendingKey) {
      return;
    }

    setPendingKey("project-add");
    setError(null);

    try {
      const created = await linkHobbyProjectLink(householdId, hobbyId, {
        projectId,
        ...(projectNotes.trim() ? { notes: projectNotes.trim() } : {}),
      });
      const project = availableProjects.find((candidate) => candidate.id === projectId);

      if (!project) {
        throw new Error("Selected project could not be resolved.");
      }

      setProjectLinks((current) => [...current, { ...created, project }]);
      setProjectId("");
      setProjectNotes("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to link project.");
    } finally {
      setPendingKey(null);
    }
  };

  const handleCategorySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!categoryName.trim() || pendingKey) {
      return;
    }

    setPendingKey("category-add");
    setError(null);

    try {
      const created = await createHobbyInventoryCategory(householdId, hobbyId, {
        categoryName: categoryName.trim(),
        sortOrder: categories.length,
      });
      setCategories((current) => [...current, created]);
      setCategoryName("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to add category.");
    } finally {
      setPendingKey(null);
    }
  };

  const handleAssetRemove = async (linkId: string) => {
    if (pendingKey) return;
    setPendingKey(`asset-remove-${linkId}`);
    setError(null);

    try {
      await unlinkHobbyAsset(householdId, hobbyId, linkId);
      setAssetLinks((current) => current.filter((link) => link.id !== linkId));
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Failed to unlink asset.");
    } finally {
      setPendingKey(null);
    }
  };

  const handleInventoryRemove = async (linkId: string) => {
    if (pendingKey) return;
    setPendingKey(`inventory-remove-${linkId}`);
    setError(null);

    try {
      await unlinkHobbyInventory(householdId, hobbyId, linkId);
      setInventoryLinks((current) => current.filter((link) => link.id !== linkId));
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Failed to unlink inventory item.");
    } finally {
      setPendingKey(null);
    }
  };

  const handleProjectRemove = async (linkId: string) => {
    if (pendingKey) return;
    setPendingKey(`project-remove-${linkId}`);
    setError(null);

    try {
      await unlinkHobbyProjectLink(householdId, hobbyId, linkId);
      setProjectLinks((current) => current.filter((link) => link.id !== linkId));
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Failed to unlink project.");
    } finally {
      setPendingKey(null);
    }
  };

  const handleCategoryRemove = async (categoryId: string) => {
    if (pendingKey) return;
    setPendingKey(`category-remove-${categoryId}`);
    setError(null);

    try {
      await deleteHobbyInventoryCategory(householdId, hobbyId, categoryId);
      setCategories((current) => current.filter((category) => category.id !== categoryId));
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Failed to remove category.");
    } finally {
      setPendingKey(null);
    }
  };

  return (
    <div className="hobby-manager-stack">
      <SectionFilterProvider
        items={assetLinks.map((link) => ({
          ...link,
          assetName: link.asset.name,
          assetCategory: link.asset.category
        }))}
        keys={["assetName", "assetCategory", "role", "notes"]}
        placeholder="Filter equipment by asset, category, role, or notes"
      >
        <section className="panel">
          <div className="panel__header">
            <h2>Linked Equipment</h2>
            <div className="panel__header-actions">
              <span className="pill">{assetLinks.length}</span>
              <SectionFilterToggle />
            </div>
          </div>
          <SectionFilterBar />
          <div className="panel__body--padded hobby-manager-stack">
            <SectionFilterChildren<Array<HobbyDetailAssetLink & { assetName: string; assetCategory: string }>[number]>>
              {(filteredAssetLinks) => (
                <>
                  {assetLinks.length === 0 ? <p className="panel__empty">No equipment linked yet.</p> : null}
                  {assetLinks.length > 0 && filteredAssetLinks.length === 0 ? <p className="panel__empty">No linked equipment matches that search.</p> : null}
                  {filteredAssetLinks.length > 0 ? (
                    <div className="hobby-link-list">
                      {filteredAssetLinks.map((link) => (
                        <div key={link.id} className="hobby-link-item">
                          <div className="hobby-link-meta">
                            <strong>{link.asset.name}</strong>
                            <span>{link.asset.category}</span>
                            {link.role ? <span>Role: {link.role}</span> : null}
                            {link.notes ? <span>{link.notes}</span> : null}
                          </div>
                          <button type="button" className="button button--ghost button--sm" onClick={() => void handleAssetRemove(link.id)} disabled={pendingKey !== null}>
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </>
              )}
            </SectionFilterChildren>

            <form className="form-grid" onSubmit={handleAssetSubmit}>
            <label className="field">
              <span>Asset</span>
              <select value={assetId} onChange={(event) => setAssetId(event.target.value)} disabled={pendingKey !== null || availableAssetOptions.length === 0}>
                <option value="">{availableAssetOptions.length === 0 ? "All household assets are already linked" : "Select an asset"}</option>
                {availableAssetOptions.map((asset) => (
                  <option key={asset.id} value={asset.id}>{asset.name} ({asset.category})</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Role</span>
              <input value={assetRole} onChange={(event) => setAssetRole(event.target.value)} placeholder="e.g. Fermenter, Primary Tool" disabled={pendingKey !== null} />
            </label>
            <label className="field field--full">
              <span>Notes</span>
              <textarea value={assetNotes} onChange={(event) => setAssetNotes(event.target.value)} rows={2} placeholder="How this equipment supports the hobby" disabled={pendingKey !== null} />
            </label>
            <div className="inline-actions inline-actions--end field--full">
              <button type="submit" className="button button--primary button--sm" disabled={pendingKey !== null || !assetId}>
                {pendingKey === "asset-add" ? "Linking…" : "Link Equipment"}
              </button>
            </div>
            </form>
          </div>
        </section>
      </SectionFilterProvider>

      <SectionFilterProvider
        items={inventoryLinks.map((link) => ({
          ...link,
          itemName: link.inventoryItem.name,
          categoryName: inventoryCategoryLookup.get(link.inventoryItemId) ?? ""
        }))}
        keys={["itemName", "categoryName"]}
        placeholder="Filter supplies by item or category"
      >
        <section className="panel">
          <div className="panel__header">
            <h2>Linked Supplies</h2>
            <div className="panel__header-actions">
              <span className="pill">{inventoryLinks.length}</span>
              <SectionFilterToggle />
            </div>
          </div>
          <SectionFilterBar />
          <div className="panel__body--padded hobby-manager-stack">
            <SectionFilterChildren<Array<HobbyDetailInventoryLink & { itemName: string; categoryName: string }>[number]>>
              {(filteredInventoryLinks) => (
                <>
                  {inventoryLinks.length === 0 ? <p className="panel__empty">No inventory items linked yet.</p> : null}
                  {inventoryLinks.length > 0 && filteredInventoryLinks.length === 0 ? <p className="panel__empty">No linked supplies match this filter.</p> : null}
                  {filteredInventoryLinks.length > 0 ? (
                    <div className="hobby-link-list">
                      {filteredInventoryLinks.map((link) => (
                        <div key={link.id} className="hobby-link-item">
                          <div className="hobby-link-meta">
                            <strong>{link.inventoryItem.name}</strong>
                            <span>
                              {link.categoryName ? `${link.categoryName} · ` : ""}
                              {link.inventoryItem.quantityOnHand} {link.inventoryItem.unit} on hand
                            </span>
                            {link.notes ? <span>{link.notes}</span> : null}
                          </div>
                          <button type="button" className="button button--ghost button--sm" onClick={() => void handleInventoryRemove(link.id)} disabled={pendingKey !== null}>
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </>
              )}
            </SectionFilterChildren>

            <form className="form-grid" onSubmit={handleInventorySubmit}>
            <label className="field">
              <span>Inventory Item</span>
              <select value={inventoryItemId} onChange={(event) => setInventoryItemId(event.target.value)} disabled={pendingKey !== null || availableInventoryOptions.length === 0}>
                <option value="">{availableInventoryOptions.length === 0 ? "All visible inventory items are already linked" : "Select an inventory item"}</option>
                {availableInventoryOptions.map((item) => (
                  <option key={item.id} value={item.id}>{item.name} ({item.quantityOnHand} {item.unit})</option>
                ))}
              </select>
            </label>
            <label className="field field--full">
              <span>Notes</span>
              <textarea value={inventoryNotes} onChange={(event) => setInventoryNotes(event.target.value)} rows={2} placeholder="Store preferred usage, reorder thresholds, or category hints" disabled={pendingKey !== null} />
            </label>
            <div className="inline-actions inline-actions--end field--full">
              <button type="submit" className="button button--primary button--sm" disabled={pendingKey !== null || !inventoryItemId}>
                {pendingKey === "inventory-add" ? "Linking…" : "Link Supply"}
              </button>
            </div>
            </form>
          </div>
        </section>
      </SectionFilterProvider>

      <section className="panel">
        <div className="panel__header">
          <h2>Related Projects</h2>
          <span className="pill">{projectLinks.length}</span>
        </div>
        <div className="panel__body--padded hobby-manager-stack">
          {projectLinks.length === 0 ? <p className="panel__empty">No projects linked yet.</p> : (
            <div className="hobby-link-list">
              {projectLinks.map((link) => (
                <div key={link.id} className="hobby-link-item">
                  <div className="hobby-link-meta">
                    <strong>{link.project.name}</strong>
                    <span>Status: {link.project.status}</span>
                    {link.notes ? <span>{link.notes}</span> : null}
                  </div>
                  <button type="button" className="button button--ghost button--sm" onClick={() => void handleProjectRemove(link.id)} disabled={pendingKey !== null}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          <form className="form-grid" onSubmit={handleProjectSubmit}>
            <label className="field">
              <span>Project</span>
              <select value={projectId} onChange={(event) => setProjectId(event.target.value)} disabled={pendingKey !== null || availableProjectOptions.length === 0}>
                <option value="">{availableProjectOptions.length === 0 ? "All visible projects are already linked" : "Select a project"}</option>
                {availableProjectOptions.map((project) => (
                  <option key={project.id} value={project.id}>{project.name} ({project.status})</option>
                ))}
              </select>
            </label>
            <label className="field field--full">
              <span>Notes</span>
              <textarea value={projectNotes} onChange={(event) => setProjectNotes(event.target.value)} rows={2} placeholder="Capture why this project belongs in the hobby timeline" disabled={pendingKey !== null} />
            </label>
            <div className="inline-actions inline-actions--end field--full">
              <button type="submit" className="button button--primary button--sm" disabled={pendingKey !== null || !projectId}>
                {pendingKey === "project-add" ? "Linking…" : "Link Project"}
              </button>
            </div>
          </form>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <h2>Inventory Categories</h2>
          <span className="pill">{categories.length}</span>
        </div>
        <div className="panel__body--padded hobby-manager-stack">
          <p className="hobby-manager-note">Use categories to organize supply planning and make the hobby record easier to review over time.</p>
          {sortedCategories.length === 0 ? <p className="panel__empty">No categories yet.</p> : (
            <div className="inline-actions">
              {sortedCategories.map((category) => (
                <span key={category.id} className="pill">
                  {category.categoryName}
                  <button type="button" className="button button--ghost button--sm hobby-pill-button" onClick={() => void handleCategoryRemove(category.id)} disabled={pendingKey !== null}>
                    Remove
                  </button>
                </span>
              ))}
            </div>
          )}

          <form className="inline-actions" onSubmit={handleCategorySubmit}>
            <input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="e.g. Grains, Cleaning, Replacement Parts" disabled={pendingKey !== null} />
            <button type="submit" className="button button--secondary button--sm" disabled={pendingKey !== null || !categoryName.trim()}>
              {pendingKey === "category-add" ? "Adding…" : "Add Category"}
            </button>
          </form>

          {error ? <p className="workbench-error">{error}</p> : null}
        </div>
      </section>
    </div>
  );
}