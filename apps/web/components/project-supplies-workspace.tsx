"use client";

import type { InventoryItemSummary, ProjectPhaseSupply } from "@aegis/types";
import type { JSX } from "react";
import { useMemo, useState } from "react";
import { createProjectPhaseSupplyAction } from "../app/actions";
import { formatCurrency, formatQuantity } from "../lib/formatters";
import { Card } from "./card";
import { ImageUploadField } from "./image-upload-field";
import { LinkPreviewDialog } from "./link-preview-dialog";
import { ProjectSupplyCard } from "./project-supply-card";

type WorkspacePhase = {
  id: string;
  name: string;
};

type WorkspaceSupply = ProjectPhaseSupply & {
  phaseName: string;
  openPhaseHref: string;
  linkedInventoryItem?: InventoryItemSummary;
};

type ProjectSuppliesWorkspaceProps = {
  householdId: string;
  projectId: string;
  phases: WorkspacePhase[];
  supplies: WorkspaceSupply[];
  inventoryItems: InventoryItemSummary[];
};

type SortField = "name" | "status" | "cost" | "remaining";
type SortDirection = "asc" | "desc";

const DEFAULT_CATEGORIES = ["Materials", "Hardware", "Finishes", "Fixtures", "Logistics"];

const normalizeCategory = (value: string | null | undefined): string | null => {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
};

const sortSupplies = (supplies: WorkspaceSupply[], sortField: SortField, sortDir: SortDirection): WorkspaceSupply[] => {
  const dir = sortDir === "asc" ? 1 : -1;
  return [...supplies].sort((left, right) => {
    switch (sortField) {
      case "name":
        return dir * left.name.localeCompare(right.name);
      case "status": {
        if (left.isProcured !== right.isProcured) return left.isProcured ? dir : -dir;
        return dir * left.name.localeCompare(right.name);
      }
      case "cost": {
        const lCost = (left.estimatedUnitCost ?? 0) * Math.max(0, left.quantityNeeded - left.quantityOnHand);
        const rCost = (right.estimatedUnitCost ?? 0) * Math.max(0, right.quantityNeeded - right.quantityOnHand);
        return dir * (lCost - rCost);
      }
      case "remaining": {
        const lRem = Math.max(0, left.quantityNeeded - left.quantityOnHand);
        const rRem = Math.max(0, right.quantityNeeded - right.quantityOnHand);
        return dir * (lRem - rRem);
      }
      default:
        return 0;
    }
  });
};

type ProcurementSection = {
  key: string;
  title: string;
  description: string;
  supplies: WorkspaceSupply[];
};

const buildProcurementSections = (supplies: WorkspaceSupply[]): ProcurementSection[] => {
  const needsPurchase = supplies.filter((supply) => !supply.isProcured && supply.quantityOnHand <= 0);
  const partialCoverage = supplies.filter((supply) => !supply.isProcured && supply.quantityOnHand > 0 && supply.quantityOnHand < supply.quantityNeeded);
  const stocked = supplies.filter((supply) => !supply.isProcured && supply.quantityOnHand >= supply.quantityNeeded);
  const purchased = supplies.filter((supply) => supply.isProcured);

  return [
    {
      key: "needs-purchase",
      title: "Needs purchase",
      description: "Nothing is on hand yet, so these items still need sourcing or a buy decision.",
      supplies: needsPurchase,
    },
    {
      key: "partial-coverage",
      title: "Partially covered",
      description: "Some quantity is already available, but more still needs to be bought or transferred.",
      supplies: partialCoverage,
    },
    {
      key: "stocked",
      title: "Ready from stock",
      description: "These items are already covered by current inventory or on-hand quantity.",
      supplies: stocked,
    },
    {
      key: "purchased",
      title: "Purchased",
      description: "Ordered or purchased items that can stay out of the active buy list.",
      supplies: purchased,
    },
  ].filter((section) => section.supplies.length > 0);
};

export function ProjectSuppliesWorkspace({ householdId, projectId, phases, supplies, inventoryItems }: ProjectSuppliesWorkspaceProps): JSX.Element {
  const [customCategories, setCustomCategories] = useState<string[]>(() => Array.from(new Set(supplies.map((supply) => normalizeCategory(supply.category)).filter((category): category is string => category !== null))));
  const [showCategoryInput, setShowCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "purchased" | "outstanding">("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [phaseFilter, setPhaseFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>("status");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");
  const [showFilters, setShowFilters] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => new Set());
  const [optimisticCategories, setOptimisticCategories] = useState<Record<string, string | null>>({});
  const [showAdvancedCreate, setShowAdvancedCreate] = useState(false);
  const [showLinkPreview, setShowLinkPreview] = useState(false);
  const [createPrefill, setCreatePrefill] = useState<{ name?: string; description?: string; estimatedUnitCost?: string; supplier?: string; supplierUrl?: string; imageUrl?: string }>({});
  const [createPrefillKey, setCreatePrefillKey] = useState(0);

  const categorySuggestions = useMemo(() => Array.from(new Set([...DEFAULT_CATEGORIES, ...customCategories])).sort((left, right) => left.localeCompare(right)), [customCategories]);

  const visibleSupplies = useMemo(() => supplies.map((supply) => ({
    ...supply,
    category: Object.prototype.hasOwnProperty.call(optimisticCategories, supply.id)
      ? optimisticCategories[supply.id] ?? null
      : supply.category
  })), [optimisticCategories, supplies]);

  const uniqueSuppliers = useMemo(() => {
    const set = new Set<string>();
    for (const s of visibleSupplies) {
      if (s.supplier) set.add(s.supplier);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [visibleSupplies]);

  const categories = useMemo(() => {
    const fromSupplies = visibleSupplies
      .map((supply) => normalizeCategory(supply.category))
      .filter((category): category is string => category !== null);
    return Array.from(new Set([...DEFAULT_CATEGORIES, ...customCategories, ...fromSupplies])).sort((left, right) => left.localeCompare(right));
  }, [customCategories, visibleSupplies]);

  const totalEstimatedRemaining = visibleSupplies.reduce((sum, supply) => {
    const remaining = Math.max(0, supply.quantityNeeded - supply.quantityOnHand);
    return sum + ((supply.estimatedUnitCost ?? 0) * remaining);
  }, 0);
  const purchasedCount = visibleSupplies.filter((supply) => supply.isProcured).length;
  const outstandingCount = visibleSupplies.length - purchasedCount;

  const filteredSupplies = useMemo(() => {
    const filtered = visibleSupplies.filter((supply) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const fields = [supply.name, supply.category, supply.supplier, supply.description, supply.notes].filter(Boolean) as string[];
        if (!fields.some((f) => f.toLowerCase().includes(q))) return false;
      }
      if (statusFilter === "purchased" && !supply.isProcured) return false;
      if (statusFilter === "outstanding" && supply.isProcured) return false;
      if (categoryFilter !== "all") {
        const cat = normalizeCategory(supply.category);
        if (categoryFilter === "uncategorized" && cat !== null) return false;
        if (categoryFilter !== "uncategorized" && cat !== categoryFilter) return false;
      }
      if (phaseFilter !== "all" && supply.phaseId !== phaseFilter) return false;
      if (supplierFilter !== "all") {
        if (supplierFilter === "none" && supply.supplier) return false;
        if (supplierFilter !== "none" && supply.supplier !== supplierFilter) return false;
      }
      return true;
    });
    return sortSupplies(filtered, sortField, sortDir);
  }, [visibleSupplies, searchQuery, statusFilter, categoryFilter, phaseFilter, supplierFilter, sortField, sortDir]);

  const procurementSections = useMemo(() => buildProcurementSections(filteredSupplies), [filteredSupplies]);

  const handleCreateCategory = () => {
    const normalized = normalizeCategory(newCategoryName);
    if (!normalized || customCategories.includes(normalized)) {
      setNewCategoryName("");
      setShowCategoryInput(false);
      return;
    }
    setCustomCategories((current) => [...current, normalized].sort((left, right) => left.localeCompare(right)));
    setNewCategoryName("");
    setShowCategoryInput(false);
  };

  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const expandAll = () => setCollapsedSections(new Set());
  const collapseAll = () => {
    const allKeys = procurementSections.map((section) => section.key);
    setCollapsedSections(new Set(allKeys));
  };

  const handleCategoryChange = (supplyId: string, category: string | null) => {
    setOptimisticCategories((prev) => ({ ...prev, [supplyId]: category }));
    if (category) {
      setCustomCategories((prev) =>
        prev.includes(category) ? prev : [...prev, category].sort((a, b) => a.localeCompare(b))
      );
    }
  };

  const handleCategoryCreated = (name: string) => {
    setCustomCategories((prev) =>
      prev.includes(name) ? prev : [...prev, name].sort((a, b) => a.localeCompare(b))
    );
  };

  const activeFilterCount = [
    statusFilter !== "all",
    categoryFilter !== "all",
    phaseFilter !== "all",
    supplierFilter !== "all",
  ].filter(Boolean).length;

  const hasActiveFilter = searchQuery.length > 0 || activeFilterCount > 0;

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setCategoryFilter("all");
    setPhaseFilter("all");
    setSupplierFilter("all");
  };

  return (
    <div className="project-supplies-workspace">
      <Card
        title="Materials"
        actions={
          <div className="supply-toolbar">
            <button type="button" className="button button--ghost button--sm" onClick={() => setShowAdvancedCreate((value) => !value)}>
              {showAdvancedCreate ? "Hide details" : "More details"}
            </button>
          </div>
        }
      >
        {showLinkPreview && (
          <LinkPreviewDialog
            householdId={householdId}
            onConfirm={(data) => {
              const priceRaw = data.fields.price?.replace(/[^\d.]/g, "") ?? "";
              setCreatePrefill({
                name: data.fields.name ?? "",
                description: data.fields.description ?? "",
                estimatedUnitCost: priceRaw,
                supplier: data.retailer ?? "",
                supplierUrl: data.sourceUrl ?? "",
                imageUrl: data.imageUrl ?? "",
              });
              setCreatePrefillKey((k) => k + 1);
              setShowAdvancedCreate(true);
              setShowLinkPreview(false);
            }}
            onCancel={() => setShowLinkPreview(false)}
          />
        )}
        <form action={createProjectPhaseSupplyAction} className="supply-create-form" key={createPrefillKey}>
          <input type="hidden" name="householdId" value={householdId} />
          <input type="hidden" name="projectId" value={projectId} />
          <div className="supply-quick-add">
            <div className="supply-create-form__grid supply-create-form__grid--quick">
              <label className="field">
                <span>Phase</span>
                <select name="phaseId" required defaultValue={phases[0]?.id ?? ""}>
                  {phases.map((phase) => (
                    <option key={phase.id} value={phase.id}>{phase.name}</option>
                  ))}
                </select>
              </label>
              <label className="field field--span-2">
                <span>Material</span>
                <input name="name" placeholder="Drywall, deck screws, primer" required defaultValue={createPrefill.name ?? ""} />
              </label>
              <label className="field">
                <span>Qty</span>
                <input name="quantityNeeded" type="number" min="0" step="1" defaultValue="1" required />
              </label>
              <label className="field">
                <span>Unit</span>
                <input name="unit" defaultValue="each" />
              </label>
            </div>
            <div className="supply-quick-add__actions">
              <button type="submit" className="button button--primary">Add material</button>
              <button type="button" className="button button--ghost button--sm" onClick={() => setShowAdvancedCreate((value) => !value)}>
                {showAdvancedCreate ? "Hide details" : "Add details"}
              </button>
              <button type="button" className="button button--ghost button--sm" onClick={() => setShowLinkPreview(true)}>Add from link</button>
            </div>
          </div>

          {showAdvancedCreate ? (
            <div className="supply-create-form__details">
              <div className="supply-create-form__grid">
                <label className="field">
                  <span>Category</span>
                  <>
                    <input name="category" list="project-supplies-categories" placeholder="Materials, hardware" />
                    <datalist id="project-supplies-categories">
                      {categorySuggestions.map((category) => (
                        <option key={category} value={category} />
                      ))}
                    </datalist>
                  </>
                </label>
                <label className="field">
                  <span>Est. Unit Cost</span>
                  <input name="estimatedUnitCost" type="number" min="0" step="0.01" defaultValue={createPrefill.estimatedUnitCost ?? ""} />
                </label>
                <label className="field field--span-2">
                  <span>Description</span>
                  <textarea name="description" rows={2} placeholder="Brand preference, sizing, or substitution notes" defaultValue={createPrefill.description ?? ""} />
                </label>
                <label className="field">
                  <span>Supplier</span>
                  <input name="supplier" defaultValue={createPrefill.supplier ?? ""} />
                </label>
                <label className="field">
                  <span>Supplier URL</span>
                  <input name="supplierUrl" type="url" defaultValue={createPrefill.supplierUrl ?? ""} />
                </label>
                <ImageUploadField
                  householdId={householdId}
                  fieldName="imageUrl"
                  label="Image"
                  defaultValue={createPrefill.imageUrl ?? ""}
                  placeholder="Paste an image URL or upload one"
                  containerClassName="field"
                />
                <label className="field">
                  <span>Linked Inventory</span>
                  <select name="inventoryItemId" defaultValue="">
                    <option value="">None</option>
                    {inventoryItems.map((item) => (
                      <option key={item.id} value={item.id}>{item.name} · {formatQuantity(item.quantityOnHand, item.unit)} on hand</option>
                    ))}
                  </select>
                </label>
                <label className="field field--full">
                  <span>Notes</span>
                  <textarea name="notes" rows={2} placeholder="Substitutions, source notes, brand preferences" />
                </label>
              </div>

              {showCategoryInput ? (
                <div className="supply-toolbar__inline-input">
                  <input
                    autoFocus
                    value={newCategoryName}
                    onChange={(event) => setNewCategoryName(event.currentTarget.value)}
                    onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); handleCreateCategory(); } if (event.key === "Escape") { setShowCategoryInput(false); setNewCategoryName(""); } }}
                    placeholder="Category name"
                  />
                  <button type="button" className="button button--ghost button--xs" onClick={handleCreateCategory}>Add</button>
                  <button type="button" className="button button--ghost button--xs" onClick={() => { setShowCategoryInput(false); setNewCategoryName(""); }}>Cancel</button>
                </div>
              ) : (
                <button type="button" className="button button--ghost button--sm" onClick={() => setShowCategoryInput(true)}>+ Category</button>
              )}
            </div>
          ) : null}
        </form>

        <div className="supply-stat-bar">
          <div className="supply-stat">
            <span>{visibleSupplies.length}</span>
            <label>Total</label>
          </div>
          <div className="supply-stat supply-stat--warning">
            <span>{outstandingCount}</span>
            <label>Outstanding</label>
          </div>
          <div className="supply-stat supply-stat--success">
            <span>{purchasedCount}</span>
            <label>Purchased</label>
          </div>
          <div className="supply-stat">
            <span>{formatCurrency(totalEstimatedRemaining, "$0.00")}</span>
            <label>Est. remaining</label>
          </div>
        </div>
      </Card>

      {/* ── Search & Filters — always visible, outside the card ── */}
      <div className="supply-filter-bar">
        <input
          type="search"
          className="supply-filter-bar__search"
          placeholder="Search supplies by name, category, supplier, notes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.currentTarget.value)}
        />
        <select
          className="supply-filter-bar__select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.currentTarget.value as "all" | "purchased" | "outstanding")}
        >
          <option value="all">All statuses</option>
          <option value="outstanding">Outstanding</option>
          <option value="purchased">Purchased</option>
        </select>
        <select
          className="supply-filter-bar__select"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.currentTarget.value)}
        >
          <option value="all">All categories</option>
          <option value="uncategorized">Uncategorized</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        {phases.length > 1 ? (
          <select
            className="supply-filter-bar__select"
            value={phaseFilter}
            onChange={(e) => setPhaseFilter(e.currentTarget.value)}
          >
            <option value="all">All phases</option>
            {phases.map((phase) => (
              <option key={phase.id} value={phase.id}>{phase.name}</option>
            ))}
          </select>
        ) : null}
        {uniqueSuppliers.length > 0 ? (
          <select
            className="supply-filter-bar__select"
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.currentTarget.value)}
          >
            <option value="all">All suppliers</option>
            <option value="none">No supplier</option>
            {uniqueSuppliers.map((sup) => (
              <option key={sup} value={sup}>{sup}</option>
            ))}
          </select>
        ) : null}
        <select
          className="supply-filter-bar__select"
          value={`${sortField}-${sortDir}`}
          onChange={(e) => {
            const [f, d] = e.currentTarget.value.split("-") as [SortField, SortDirection];
            setSortField(f);
            setSortDir(d);
          }}
        >
          <option value="status-asc">Sort: Status</option>
          <option value="name-asc">Sort: Name A-Z</option>
          <option value="name-desc">Sort: Name Z-A</option>
          <option value="cost-desc">Sort: Cost High-Low</option>
          <option value="cost-asc">Sort: Cost Low-High</option>
          <option value="remaining-desc">Sort: Most Remaining</option>
          <option value="remaining-asc">Sort: Least Remaining</option>
        </select>
        {activeFilterCount > 0 ? (
          <button type="button" className="button button--ghost button--sm" onClick={clearFilters}>Clear filters ({activeFilterCount})</button>
        ) : null}
      </div>

      {/* ── Empty states ── */}
      {filteredSupplies.length === 0 && visibleSupplies.length > 0 ? (
        <p className="supply-sections__empty">
          No supplies match your filters.
          {activeFilterCount > 0 ? <button type="button" className="button--link" onClick={clearFilters} style={{ marginLeft: 8 }}>Clear filters</button> : null}
        </p>
      ) : null}

      {visibleSupplies.length === 0 ? (
        <p className="supply-sections__empty">
          No materials yet. Add the first one above.
        </p>
      ) : null}

      {/* ── Expand/Collapse controls ── */}
      {procurementSections.length > 0 ? (
        <div className="supply-section-controls">
          <button type="button" className="button button--ghost button--xs" onClick={expandAll}>Expand all</button>
          <button type="button" className="button button--ghost button--xs" onClick={collapseAll}>Collapse all</button>
          <span className="supply-section-controls__count">{filteredSupplies.length} supply item{filteredSupplies.length !== 1 ? "s" : ""}</span>
        </div>
      ) : null}

      {/* ── Procurement-state sections ── */}
      {procurementSections.map((section) => {
        const key = section.key;
        const sectionSupplies = section.supplies;
        const isCollapsed = collapsedSections.has(key);
        const purchasedInSection = sectionSupplies.filter((s) => s.isProcured).length;
        const outstandingInSection = sectionSupplies.length - purchasedInSection;

        const sectionExpanded = hasActiveFilter || !isCollapsed;

        return (
          <section key={key} className="supply-section">
            <button
              type="button"
              className="supply-section__header"
              onClick={() => toggleSection(key)}
              aria-expanded={sectionExpanded}
            >
              <span className="supply-section__chevron">{sectionExpanded ? "\u25BE" : "\u25B8"}</span>
              <h3 className="supply-section__title">{section.title}</h3>
              <span className="pill pill--sm pill--muted">{sectionSupplies.length}</span>
              <span className="supply-section__meta">
                {purchasedInSection > 0 ? <span className="supply-section__tag supply-section__tag--success">{purchasedInSection} purchased</span> : null}
                {outstandingInSection > 0 ? <span className="supply-section__tag supply-section__tag--warning">{outstandingInSection} outstanding</span> : null}
              </span>
            </button>
            {sectionExpanded ? (
              <div className="supply-section__body">
                <p className="data-table__secondary" style={{ margin: "0 0 12px" }}>{section.description}</p>
                {sectionSupplies.map((supply) => (
                  <ProjectSupplyCard
                    key={supply.id}
                    householdId={householdId}
                    projectId={projectId}
                    phaseId={supply.phaseId}
                    phaseName={supply.phaseName}
                    supply={supply}
                    inventoryItems={inventoryItems}
                    openPhaseHref={supply.openPhaseHref}
                    {...(supply.linkedInventoryItem ? { linkedInventoryItem: supply.linkedInventoryItem } : {})}
                    categories={categorySuggestions}
                    onCategoryChange={handleCategoryChange}
                    onCategoryCreated={handleCategoryCreated}
                  />
                ))}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
