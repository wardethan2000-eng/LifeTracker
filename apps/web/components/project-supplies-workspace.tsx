"use client";

import type { InventoryItemSummary, ProjectPhaseSupply } from "@lifekeeper/types";
import type { DragEvent, JSX } from "react";
import { useMemo, useState, useTransition } from "react";
import {
  createProjectPhaseSupplyAction,
  createProjectPurchaseRequestsAction,
  updateProjectPhaseSupplyCategoryAction
} from "../app/actions";
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
  const [newCategoryName, setNewCategoryName] = useState("");
  const [draggedSupplyId, setDraggedSupplyId] = useState<string | null>(null);
  const [hoveredCategory, setHoveredCategory] = useState<string | null | undefined>(undefined);
  const [optimisticCategories, setOptimisticCategories] = useState<Record<string, string | null>>({});
  const [isMovePending, startMoveTransition] = useTransition();

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
  const requestedCount = visibleSupplies.filter((supply) => supply.activePurchaseRequest !== null).length;
  const purchasedCount = visibleSupplies.filter((supply) => supply.isProcured).length;
  const outstandingCount = visibleSupplies.length - purchasedCount;

  const suppliesByCategory = new Map<string | null, WorkspaceSupply[]>();

  for (const category of [null, ...categories]) {
    suppliesByCategory.set(category, []);
  }

  for (const supply of sortSupplies(visibleSupplies)) {
    const category = normalizeCategory(supply.category);
    const bucket = suppliesByCategory.get(category) ?? [];
    bucket.push(supply);
    suppliesByCategory.set(category, bucket);
  }

  const handleCreateCategory = () => {
    const normalized = normalizeCategory(newCategoryName);

    if (!normalized || customCategories.includes(normalized)) {
      setNewCategoryName("");
      return;
    }

    setCustomCategories((current) => [...current, normalized].sort((left, right) => left.localeCompare(right)));
    setNewCategoryName("");
  };

  const handleDrop = (targetCategory: string | null) => {
    if (!draggedSupplyId) {
      return;
    }

    const supply = visibleSupplies.find((item) => item.id === draggedSupplyId);

    if (!supply) {
      return;
    }

    const previousCategory = normalizeCategory(supply.category);
    const normalizedTargetCategory = normalizeCategory(targetCategory);

    if (previousCategory === normalizedTargetCategory) {
      setDraggedSupplyId(null);
      setHoveredCategory(undefined);
      return;
    }

    setOptimisticCategories((current) => ({
      ...current,
      [supply.id]: normalizedTargetCategory
    }));

    if (normalizedTargetCategory) {
      setCustomCategories((current) => current.includes(normalizedTargetCategory)
        ? current
        : [...current, normalizedTargetCategory].sort((left, right) => left.localeCompare(right)));
    }

    setDraggedSupplyId(null);
    setHoveredCategory(undefined);

    startMoveTransition(() => {
      void (async () => {
        const formData = new FormData();
        formData.set("householdId", householdId);
        formData.set("projectId", projectId);
        formData.set("phaseId", supply.phaseId);
        formData.set("supplyId", supply.id);
        formData.set("category", normalizedTargetCategory ?? "");

        try {
          await updateProjectPhaseSupplyCategoryAction(formData);
        } catch (error) {
          setOptimisticCategories((current) => ({
            ...current,
            [supply.id]: previousCategory
          }));
          throw error;
        }
      })();
    });
  };

  return (
    <div className="project-supplies-workspace">
      <Card
        title="Supplies Workspace"
        actions={
          <form action={createProjectPurchaseRequestsAction}>
            <input type="hidden" name="householdId" value={householdId} />
            <input type="hidden" name="projectId" value={projectId} />
            <button type="submit" className="button button--sm">Create Draft Purchases</button>
          </form>
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
            <span>Requested</span>
            <strong>{requestedCount}</strong>
          </div>
          <div>
            <span>Estimated remaining</span>
            <strong>{formatCurrency(totalEstimatedRemaining, "$0.00")}</strong>
          </div>
        </div>

        <div className="project-supplies-workspace__bar">
          <div className="project-supplies-workspace__hint">
            Drag any supply card into a category lane to reorganize the plan. Purchased state, staging, stock allocation, and editing stay on the card.
          </div>
          <div className="project-supplies-workspace__category-maker">
            <input
              value={newCategoryName}
              onChange={(event) => setNewCategoryName(event.currentTarget.value)}
              placeholder="Create category"
            />
            <button type="button" className="button button--ghost button--sm" onClick={handleCreateCategory}>Add Category</button>
          </div>
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
                <input name="category" list="project-supplies-categories" placeholder="Materials, decor, logistics" />
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
                  <option key={item.id} value={item.id}>{item.name} · {formatQuantity(item.quantityOnHand, item.unit)} on hand</option>
                ))}
              </select>
            </label>
          </div>
          <div className="inline-actions" style={{ marginTop: 16 }}>
            <button type="submit" className="button">Add Supply</button>
          </div>
        </form>
      </Card>

      <div className="project-supplies-board" aria-busy={isMovePending}>
        <CategoryColumn
          title="Uncategorized"
          description="Catch-all lane for anything that still needs a home."
          supplies={suppliesByCategory.get(null) ?? []}
          isActiveDropTarget={hoveredCategory === null}
          onDragOver={(event) => {
            event.preventDefault();
            setHoveredCategory(null);
          }}
          onDragLeave={() => setHoveredCategory(undefined)}
          onDrop={(event) => {
            event.preventDefault();
            handleDrop(null);
          }}
        >
          {(suppliesByCategory.get(null) ?? []).map((supply) => (
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
              categorySuggestions={categorySuggestions}
              draggable
              onDragStart={() => setDraggedSupplyId(supply.id)}
              onDragEnd={() => {
                setDraggedSupplyId(null);
                setHoveredCategory(undefined);
              }}
            />
          ))}
        </CategoryColumn>

        {categories.map((category) => {
          const laneSupplies = suppliesByCategory.get(category) ?? [];
          const purchasedInLane = laneSupplies.filter((supply) => supply.isProcured).length;
          const outstandingInLane = laneSupplies.length - purchasedInLane;

          return (
            <CategoryColumn
              key={category}
              title={category}
              description={`${outstandingInLane} outstanding · ${purchasedInLane} purchased`}
              supplies={laneSupplies}
              isActiveDropTarget={hoveredCategory === category}
              onDragOver={(event) => {
                event.preventDefault();
                setHoveredCategory(category);
              }}
              onDragLeave={() => setHoveredCategory(undefined)}
              onDrop={(event) => {
                event.preventDefault();
                handleDrop(category);
              }}
            >
              {laneSupplies.map((supply) => (
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
                  categorySuggestions={categorySuggestions}
                  draggable
                  onDragStart={() => setDraggedSupplyId(supply.id)}
                  onDragEnd={() => {
                    setDraggedSupplyId(null);
                    setHoveredCategory(undefined);
                  }}
                />
              ))}
            </CategoryColumn>
          );
        })}
      </div>
    </div>
  );
}

function CategoryColumn({
  title,
  description,
  supplies,
  isActiveDropTarget,
  onDragOver,
  onDragLeave,
  onDrop,
  children,
}: {
  title: string;
  description: string;
  supplies: WorkspaceSupply[];
  isActiveDropTarget: boolean;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  children: JSX.Element[];
}): JSX.Element {
  return (
    <section
      className={`project-supplies-column${isActiveDropTarget ? " project-supplies-column--active" : ""}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="project-supplies-column__header">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <span className="pill pill--muted">{supplies.length}</span>
      </div>
      <div className="project-supplies-column__body">
        {children}
        {supplies.length === 0 ? <p className="project-supplies-column__empty">Drop supplies here.</p> : null}
      </div>
    </section>
  );
}
