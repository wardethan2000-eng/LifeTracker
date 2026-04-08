"use client";

import type { InventoryItemSummary, ProjectPhaseSupply } from "@aegis/types";
import type { JSX } from "react";
import { useMemo, useState, useTransition } from "react";
import {
  deleteProjectPhaseSupplyAction,
  toggleProjectPhaseSupplyPurchasedAction,
  updateProjectPhaseSupplyCategoryAction,
} from "../app/actions";
import { formatCurrency } from "../lib/formatters";

type PhaseInfo = { id: string; name: string };

type PlanningSuppliesTableProps = {
  householdId: string;
  projectId: string;
  supplies: (ProjectPhaseSupply & { phaseName: string })[];
  phases: PhaseInfo[];
  inventoryItems: InventoryItemSummary[];
};

const normalizeCategory = (value: string | null | undefined): string | null => {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
};

const DEFAULT_CATEGORIES = ["Materials", "Hardware", "Finishes", "Fixtures", "Logistics"];

function SupplyRow({
  householdId,
  projectId,
  supply,
  categories,
  onCategoryChange,
}: {
  householdId: string;
  projectId: string;
  supply: ProjectPhaseSupply & { phaseName: string };
  categories: string[];
  onCategoryChange: (supplyId: string, category: string | null) => void;
}): JSX.Element {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(() => {
      void (async () => {
        const fd = new FormData();
        fd.set("householdId", householdId);
        fd.set("projectId", projectId);
        fd.set("phaseId", supply.phaseId);
        fd.set("supplyId", supply.id);
        await deleteProjectPhaseSupplyAction(fd);
      })();
    });
  };

  const handleTogglePurchased = () => {
    startTransition(() => {
      void (async () => {
        const fd = new FormData();
        fd.set("householdId", householdId);
        fd.set("projectId", projectId);
        fd.set("phaseId", supply.phaseId);
        fd.set("supplyId", supply.id);
        fd.set("isProcured", supply.isProcured ? "false" : "true");
        await toggleProjectPhaseSupplyPurchasedAction(fd);
      })();
    });
  };

  const handleCategorySelect = (value: string) => {
    const category = value === "" ? null : value;
    onCategoryChange(supply.id, category);
    startTransition(() => {
      void (async () => {
        const fd = new FormData();
        fd.set("householdId", householdId);
        fd.set("projectId", projectId);
        fd.set("phaseId", supply.phaseId);
        fd.set("supplyId", supply.id);
        fd.set("category", category ?? "");
        await updateProjectPhaseSupplyCategoryAction(fd);
      })();
    });
  };

  const remaining = Math.max(0, supply.quantityNeeded - supply.quantityOnHand);
  const estCost = supply.estimatedUnitCost != null ? supply.estimatedUnitCost * supply.quantityNeeded : null;

  return (
    <tr className={isPending ? "planning-supply-row--pending" : ""}>
      <td>
        <div className="data-table__primary">{supply.name}</div>
        {supply.supplier ? <div className="data-table__secondary">{supply.supplier}</div> : null}
      </td>
      <td style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>{supply.phaseName}</td>
      <td style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>
        {supply.quantityOnHand}/{supply.quantityNeeded} {supply.unit}
      </td>
      <td style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>
        {estCost != null ? formatCurrency(estCost, "$0.00") : "—"}
      </td>
      <td>
        <button
          type="button"
          className="button button--ghost button--xs"
          onClick={handleTogglePurchased}
          disabled={isPending}
        >
          {supply.isProcured
            ? <span className="pill pill--success">Yes</span>
            : <span className="pill pill--danger">No</span>}
        </button>
      </td>
      <td>
        <select
          className="supply-row__category-select"
          value={supply.category ?? ""}
          onChange={(e) => handleCategorySelect(e.currentTarget.value)}
          title="Category"
        >
          <option value="">Uncategorized</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </td>
      <td>
        <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
          {isDeleting ? (
            <>
              <button
                type="button"
                className="button button--danger button--xs"
                onClick={handleDelete}
                disabled={isPending}
              >
                {isPending ? "..." : "Confirm"}
              </button>
              <button
                type="button"
                className="button button--ghost button--xs"
                onClick={() => setIsDeleting(false)}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              className="button button--danger button--xs"
              onClick={() => setIsDeleting(true)}
            >
              Delete
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

export function PlanningSuppliesTable({
  householdId,
  projectId,
  supplies,
  phases,
  inventoryItems,
}: PlanningSuppliesTableProps): JSX.Element {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "purchased" | "outstanding">("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [phaseFilter, setPhaseFilter] = useState("all");
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => new Set());
  const [optimisticCategories, setOptimisticCategories] = useState<Record<string, string | null>>({});

  const visibleSupplies = useMemo(() => supplies.map((s) => ({
    ...s,
    category: Object.prototype.hasOwnProperty.call(optimisticCategories, s.id)
      ? optimisticCategories[s.id] ?? null
      : s.category
  })), [supplies, optimisticCategories]);

  const allCategories = useMemo(() => {
    const fromSupplies = visibleSupplies.map((s) => normalizeCategory(s.category)).filter((c): c is string => c !== null);
    return Array.from(new Set([...DEFAULT_CATEGORIES, ...fromSupplies])).sort((a, b) => a.localeCompare(b));
  }, [visibleSupplies]);

  const filtered = useMemo(() => {
    return visibleSupplies.filter((s) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const fields = [s.name, s.category, s.supplier, s.description, s.notes].filter(Boolean) as string[];
        if (!fields.some((f) => f.toLowerCase().includes(q))) return false;
      }
      if (statusFilter === "purchased" && !s.isProcured) return false;
      if (statusFilter === "outstanding" && s.isProcured) return false;
      if (categoryFilter !== "all") {
        const cat = normalizeCategory(s.category);
        if (categoryFilter === "uncategorized" && cat !== null) return false;
        if (categoryFilter !== "uncategorized" && cat !== categoryFilter) return false;
      }
      if (phaseFilter !== "all" && s.phaseId !== phaseFilter) return false;
      return true;
    });
  }, [visibleSupplies, searchQuery, statusFilter, categoryFilter, phaseFilter]);

  const suppliesByCategory = useMemo(() => {
    const map = new Map<string | null, typeof filtered>();
    for (const s of filtered) {
      const cat = normalizeCategory(s.category);
      const bucket = map.get(cat) ?? [];
      bucket.push(s);
      map.set(cat, bucket);
    }
    return map;
  }, [filtered]);

  const sectionOrder = useMemo((): (string | null)[] => {
    const result: (string | null)[] = [];
    if (suppliesByCategory.has(null)) result.push(null);
    for (const cat of allCategories) {
      if (suppliesByCategory.has(cat)) result.push(cat);
    }
    return result;
  }, [allCategories, suppliesByCategory]);

  const hasActiveFilter = searchQuery.length > 0 || statusFilter !== "all" || categoryFilter !== "all" || phaseFilter !== "all";

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
  };

  if (supplies.length === 0) {
    return <p className="panel__empty">No supplies added yet.</p>;
  }

  return (
    <div className="planning-supplies">
      <div className="supply-search-bar" style={{ marginBottom: 10 }}>
        <input
          type="search"
          className="supply-search-bar__input"
          placeholder="Search supplies..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.currentTarget.value)}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.currentTarget.value as "all" | "purchased" | "outstanding")}
          style={{ fontSize: "0.86rem" }}
        >
          <option value="all">All statuses</option>
          <option value="outstanding">Outstanding</option>
          <option value="purchased">Purchased</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.currentTarget.value)}
          style={{ fontSize: "0.86rem" }}
        >
          <option value="all">All categories</option>
          <option value="uncategorized">Uncategorized</option>
          {allCategories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        {phases.length > 1 ? (
          <select
            value={phaseFilter}
            onChange={(e) => setPhaseFilter(e.currentTarget.value)}
            style={{ fontSize: "0.86rem" }}
          >
            <option value="all">All phases</option>
            {phases.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        ) : null}
        {hasActiveFilter ? (
          <button
            type="button"
            className="button button--ghost button--xs"
            onClick={() => { setSearchQuery(""); setStatusFilter("all"); setCategoryFilter("all"); setPhaseFilter("all"); }}
          >
            Clear
          </button>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <p className="supply-sections__empty">No supplies match your filters.</p>
      ) : null}

      {sectionOrder.length > 1 ? (
        <div className="supply-section-controls" style={{ marginBottom: 6 }}>
          <button type="button" className="button button--ghost button--xs" onClick={() => setCollapsedSections(new Set())}>Expand all</button>
          <button type="button" className="button button--ghost button--xs" onClick={() => setCollapsedSections(new Set(sectionOrder.map((c) => c ?? "__uncategorized")))}>Collapse all</button>
          <span className="supply-section-controls__count">{filtered.length} item{filtered.length !== 1 ? "s" : ""}</span>
        </div>
      ) : null}

      {sectionOrder.map((category) => {
        const key = category ?? "__uncategorized";
        const items = suppliesByCategory.get(category) ?? [];
        if (items.length === 0) return null;
        const isCollapsed = collapsedSections.has(key);
        const sectionExpanded = hasActiveFilter || !isCollapsed;
        const purchasedInSection = items.filter((s) => s.isProcured).length;

        return (
          <section key={key} className="supply-section" style={{ marginBottom: 8 }}>
            <button
              type="button"
              className="supply-section__header"
              onClick={() => toggleSection(key)}
              aria-expanded={sectionExpanded}
            >
              <span className="supply-section__chevron">{sectionExpanded ? "\u25BE" : "\u25B8"}</span>
              <h3 className="supply-section__title">{category ?? "Uncategorized"}</h3>
              <span className="pill pill--sm pill--muted">{items.length}</span>
              <span className="supply-section__meta">
                {purchasedInSection > 0 ? <span className="supply-section__tag supply-section__tag--success">{purchasedInSection} purchased</span> : null}
                {items.length - purchasedInSection > 0 ? <span className="supply-section__tag supply-section__tag--warning">{items.length - purchasedInSection} outstanding</span> : null}
              </span>
            </button>
            {sectionExpanded ? (
              <div className="supply-section__body">
                <table className="workbench-table" style={{ marginBottom: 0 }}>
                  <thead>
                    <tr>
                      <th>Supply</th>
                      <th>Phase</th>
                      <th>Qty</th>
                      <th>Est. Cost</th>
                      <th>Procured</th>
                      <th>Category</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((supply) => (
                      <SupplyRow
                        key={supply.id}
                        householdId={householdId}
                        projectId={projectId}
                        supply={supply}
                        categories={allCategories}
                        onCategoryChange={handleCategoryChange}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
