"use client";

import type { InventoryItemSummary, ProjectPhaseSupply } from "@lifekeeper/types";
import type { JSX } from "react";
import { useMemo, useState } from "react";
import { createProjectPhaseSupplyAction } from "../app/actions";
import { formatCurrency, formatQuantity } from "../lib/formatters";
import { Card } from "./card";
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

const DEFAULT_CATEGORIES = ["Materials", "Hardware", "Finishes", "Fixtures", "Logistics"];

const normalizeCategory = (value: string | null | undefined): string | null => {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
};

const sortSupplies = (supplies: WorkspaceSupply[]): WorkspaceSupply[] => [...supplies].sort((left, right) => {
  if (left.isProcured !== right.isProcured) {
    return left.isProcured ? 1 : -1;
  }

  const leftOrder = left.sortOrder ?? Number.MAX_SAFE_INTEGER;
  const rightOrder = right.sortOrder ?? Number.MAX_SAFE_INTEGER;

  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }

  return left.name.localeCompare(right.name);
});

export function ProjectSuppliesWorkspace({ householdId, projectId, phases, supplies, inventoryItems }: ProjectSuppliesWorkspaceProps): JSX.Element {
  const [customCategories, setCustomCategories] = useState<string[]>(() => Array.from(new Set(supplies.map((supply) => normalizeCategory(supply.category)).filter((category): category is string => category !== null))));
  const [showCategoryInput, setShowCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "purchased" | "outstanding">("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [optimisticCategories, setOptimisticCategories] = useState<Record<string, string | null>>({});

  const categorySuggestions = useMemo(() => Array.from(new Set([...DEFAULT_CATEGORIES, ...customCategories])).sort((left, right) => left.localeCompare(right)), [customCategories]);

  const visibleSupplies = useMemo(() => supplies.map((supply) => ({
    ...supply,
    category: Object.prototype.hasOwnProperty.call(optimisticCategories, supply.id)
      ? optimisticCategories[supply.id] ?? null
      : supply.category
  })), [optimisticCategories, supplies]);

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

  const filteredSupplies = useMemo(() => sortSupplies(visibleSupplies).filter((supply) => {
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
    return true;
  }), [visibleSupplies, searchQuery, statusFilter, categoryFilter]);

  const suppliesByCategory = useMemo(() => {
    const map = new Map<string | null, WorkspaceSupply[]>();
    for (const supply of filteredSupplies) {
      const cat = normalizeCategory(supply.category);
      const bucket = map.get(cat) ?? [];
      bucket.push(supply);
      map.set(cat, bucket);
    }
    return map;
  }, [filteredSupplies]);

  const sectionOrder = useMemo((): (string | null)[] => {
    const result: (string | null)[] = [null];
    for (const cat of categories) {
      result.push(cat);
    }
    return result;
  }, [categories]);

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

  return (
    <div className="project-supplies-workspace">
      <Card
        title="Supplies Workspace"
        actions={
          showCategoryInput ? (
            <div className="project-supplies-workspace__category-maker">
              <input
                autoFocus
                value={newCategoryName}
                onChange={(event) => setNewCategoryName(event.currentTarget.value)}
                onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); handleCreateCategory(); } if (event.key === "Escape") { setShowCategoryInput(false); setNewCategoryName(""); } }}
                placeholder="Category name"
              />
              <button type="button" className="button button--ghost button--sm" onClick={handleCreateCategory}>Add</button>
              <button type="button" className="button button--ghost button--sm" onClick={() => { setShowCategoryInput(false); setNewCategoryName(""); }}>Cancel</button>
            </div>
          ) : (
            <button type="button" className="button button--ghost button--sm" onClick={() => setShowCategoryInput(true)}>+ Create Category</button>
          )
        }
      >
        <div className="project-supplies-workspace__summary">
          <div>
            <span>Supplies</span>
            <strong>{visibleSupplies.length}</strong>
          </div>
          <div>
            <span>Outstanding</span>
            <strong>{outstandingCount}</strong>
          </div>
          <div>
            <span>Purchased</span>
            <strong>{purchasedCount}</strong>
          </div>
          <div>
            <span>Estimated remaining</span>
            <strong>{formatCurrency(totalEstimatedRemaining, "$0.00")}</strong>
          </div>
        </div>

        <div className="supply-filters">
          <input
            type="search"
            className="supply-filters__search"
            placeholder="Search supplies…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
          />
          <select
            className="supply-filters__select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.currentTarget.value as "all" | "purchased" | "outstanding")}
          >
            <option value="all">All statuses</option>
            <option value="outstanding">Outstanding</option>
            <option value="purchased">Purchased</option>
          </select>
          <select
            className="supply-filters__select"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.currentTarget.value)}
          >
            <option value="all">All categories</option>
            <option value="uncategorized">Uncategorized</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <form action={createProjectPhaseSupplyAction} className="project-supplies-create">
          <input type="hidden" name="householdId" value={householdId} />
          <input type="hidden" name="projectId" value={projectId} />
          <div className="project-supplies-create__grid">
            <label className="field">
              <span>Phase</span>
              <select name="phaseId" required defaultValue={phases[0]?.id ?? ""}>
                {phases.map((phase) => (
                  <option key={phase.id} value={phase.id}>{phase.name}</option>
                ))}
              </select>
            </label>
            <label className="field field--full">
              <span>Supply Name</span>
              <input name="name" placeholder="Joint compound, screws, vapor barrier" required />
            </label>
            <label className="field">
              <span>Category</span>
              <>
                <input name="category" list="project-supplies-categories" placeholder="Materials, hardware, finishes" />
                <datalist id="project-supplies-categories">
                  {categorySuggestions.map((category) => (
                    <option key={category} value={category} />
                  ))}
                </datalist>
              </>
            </label>
            <label className="field">
              <span>Quantity Needed</span>
              <input name="quantityNeeded" type="number" min="0" step="1" defaultValue="1" required />
            </label>
            <label className="field">
              <span>Unit</span>
              <input name="unit" defaultValue="each" />
            </label>
            <label className="field">
              <span>Estimated Unit Cost</span>
              <input name="estimatedUnitCost" type="number" min="0" step="0.01" />
            </label>
            <label className="field">
              <span>Supplier</span>
              <input name="supplier" />
            </label>
            <label className="field">
              <span>Linked Inventory Item</span>
              <select name="inventoryItemId" defaultValue="">
                <option value="">None</option>
                {inventoryItems.map((item) => (
                  <option key={item.id} value={item.id}>{item.name} Â· {formatQuantity(item.quantityOnHand, item.unit)} on hand</option>
                ))}
              </select>
            </label>
          </div>
          <div className="inline-actions" style={{ marginTop: 16 }}>
            <button type="submit" className="button">Add Supply</button>
          </div>
        </form>
      </Card>

      {visibleSupplies.length === 0 ? (
        <p className="supply-sections__empty">
          No supplies yet. Add your first supply above.
        </p>
      ) : null}

      {sectionOrder.map((category) => {
        const key = category ?? "__uncategorized";
        const sectionSupplies = suppliesByCategory.get(category) ?? [];
        const isCollapsed = collapsedSections.has(key);
        const purchasedInSection = sectionSupplies.filter((s) => s.isProcured).length;

        return (
          <section key={key} className="supply-section">
            <button
              type="button"
              className="supply-section__header"
              onClick={() => toggleSection(key)}
              aria-expanded={!isCollapsed}
            >
              <span className="supply-section__chevron">{isCollapsed ? "\u25B8" : "\u25BE"}</span>
              <h3 className="supply-section__title">{category ?? "Uncategorized"}</h3>
              <span className="pill pill--muted">{sectionSupplies.length}</span>
              {sectionSupplies.length > 0 ? (
                <span className="supply-section__meta">
                  {purchasedInSection} purchased &middot; {sectionSupplies.length - purchasedInSection} outstanding
                </span>
              ) : null}
            </button>
            {!isCollapsed ? (
              <div className="supply-section__body">
                {sectionSupplies.length === 0 ? (
                  <p className="supply-section__empty">No supplies in this category.</p>
                ) : null}
                {sectionSupplies.map((supply) => (
                  <ProjectSupplyCard
                    key={supply.id}
                    householdId={householdId}
                    projectId={projectId}
                    phaseId={supply.phaseId}
                    phaseName={supply.phaseName}
                    openPhaseHref={supply.openPhaseHref}
                    supply={supply}
                    inventoryItems={inventoryItems}
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
