"use client";

import type {
  CreateHobbyRecipeIngredientInput,
  CreateHobbyRecipeStepInput,
  HobbyRecipeDetail,
  HobbyRecipeIngredient,
  HobbyRecipeStep,
  UpdateHobbyRecipeIngredientInput,
  UpdateHobbyRecipeStepInput,
} from "@lifekeeper/types";
import {
  createHobbyRecipeIngredient,
  createHobbyRecipeStep,
  deleteHobbyRecipeIngredient,
  deleteHobbyRecipeStep,
  reorderHobbyRecipeSteps,
  updateHobbyRecipeIngredient,
  updateHobbyRecipeStep,
} from "../lib/api";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type JSX, type KeyboardEvent } from "react";
import { SortableList, type DragHandleProps } from "./ui/sortable-list";

type InventoryLinkOption = {
  inventoryItemId: string;
  inventoryItem: {
    id: string;
    name: string;
    unit: string;
    quantityOnHand: number;
  };
};

type RecipeAction = (formData: FormData) => Promise<void>;

type IngredientDraft = {
  clientId: string;
  id: string | null;
  name: string;
  quantity: string;
  unit: string;
  category: string;
  inventoryItemId: string;
  notes: string;
  isNew: boolean;
};

type StepDraft = {
  clientId: string;
  id: string | null;
  title: string;
  description: string;
  durationMinutes: string;
  stepType: string;
  isNew: boolean;
};

type PersistedIngredientSnapshot = {
  name: string;
  quantity: number;
  unit: string;
  category: string | null;
  inventoryItemId: string | null;
  notes: string | null;
  sortOrder: number;
};

type PersistedStepSnapshot = {
  title: string;
  description: string | null;
  durationMinutes: number | null;
  stepType: string;
  sortOrder: number;
};

type HobbyRecipeWorkbenchProps = {
  mode: "create" | "edit";
  householdId: string;
  hobbyId: string;
  createAction?: RecipeAction;
  updateAction?: RecipeAction;
  initialRecipe: HobbyRecipeDetail | null;
  hobbyInventoryLinks: InventoryLinkOption[];
};

const suggestedStepTypes = ["generic", "mash", "boil", "chill", "pitch", "ferment", "package", "condition"];

const createLocalId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `local-${Math.random().toString(36).slice(2, 10)}`;
};

const toIngredientDraft = (ingredient: HobbyRecipeDetail["ingredients"][number]): IngredientDraft => ({
  clientId: ingredient.id,
  id: ingredient.id,
  name: ingredient.name,
  quantity: String(ingredient.quantity),
  unit: ingredient.unit,
  category: ingredient.category ?? "",
  inventoryItemId: ingredient.inventoryItemId ?? "",
  notes: ingredient.notes ?? "",
  isNew: false,
});

const toStepDraft = (step: HobbyRecipeDetail["steps"][number]): StepDraft => ({
  clientId: step.id,
  id: step.id,
  title: step.title,
  description: step.description ?? "",
  durationMinutes: step.durationMinutes == null ? "" : String(step.durationMinutes),
  stepType: step.stepType,
  isNew: false,
});

const createEmptyIngredient = (): IngredientDraft => ({
  clientId: createLocalId(),
  id: null,
  name: "",
  quantity: "0",
  unit: "",
  category: "",
  inventoryItemId: "",
  notes: "",
  isNew: true,
});

const createEmptyStep = (): StepDraft => ({
  clientId: createLocalId(),
  id: null,
  title: "",
  description: "",
  durationMinutes: "",
  stepType: "generic",
  isNew: true,
});

const buildIngredientSnapshot = (row: IngredientDraft, sortOrder: number): PersistedIngredientSnapshot => ({
  name: row.name.trim(),
  quantity: Number(row.quantity),
  unit: row.unit.trim(),
  category: row.category.trim() || null,
  inventoryItemId: row.inventoryItemId || null,
  notes: row.notes.trim() || null,
  sortOrder,
});

const buildStepSnapshot = (row: StepDraft, sortOrder: number): PersistedStepSnapshot => ({
  title: row.title.trim(),
  description: row.description.trim() || null,
  durationMinutes: row.durationMinutes.trim() ? Number(row.durationMinutes) : null,
  stepType: row.stepType.trim() || "generic",
  sortOrder,
});

const createIngredientSnapshots = (recipe: HobbyRecipeDetail | null): Record<string, PersistedIngredientSnapshot> => {
  const snapshots: Record<string, PersistedIngredientSnapshot> = {};

  for (const ingredient of recipe?.ingredients ?? []) {
    snapshots[ingredient.id] = {
      name: ingredient.name,
      quantity: ingredient.quantity,
      unit: ingredient.unit,
      category: ingredient.category,
      inventoryItemId: ingredient.inventoryItemId,
      notes: ingredient.notes,
      sortOrder: ingredient.sortOrder,
    };
  }

  return snapshots;
};

const createStepSnapshots = (recipe: HobbyRecipeDetail | null): Record<string, PersistedStepSnapshot> => {
  const snapshots: Record<string, PersistedStepSnapshot> = {};

  for (const step of recipe?.steps ?? []) {
    snapshots[step.id] = {
      title: step.title,
      description: step.description,
      durationMinutes: step.durationMinutes,
      stepType: step.stepType,
      sortOrder: step.sortOrder,
    };
  }

  return snapshots;
};

const toIngredientDraftFromApi = (ingredient: HobbyRecipeIngredient): IngredientDraft => ({
  clientId: ingredient.id,
  id: ingredient.id,
  name: ingredient.name,
  quantity: String(ingredient.quantity),
  unit: ingredient.unit,
  category: ingredient.category ?? "",
  inventoryItemId: ingredient.inventoryItemId ?? "",
  notes: ingredient.notes ?? "",
  isNew: false,
});

const toStepDraftFromApi = (step: HobbyRecipeStep): StepDraft => ({
  clientId: step.id,
  id: step.id,
  title: step.title,
  description: step.description ?? "",
  durationMinutes: step.durationMinutes == null ? "" : String(step.durationMinutes),
  stepType: step.stepType,
  isNew: false,
});

const moveItem = <T,>(items: T[], fromIndex: number, toIndex: number): T[] => {
  const nextItems = [...items];
  const [moved] = nextItems.splice(fromIndex, 1);

  if (moved === undefined) {
    return nextItems;
  }

  nextItems.splice(toIndex, 0, moved);
  return nextItems;
};

export function HobbyRecipeWorkbench({
  mode,
  householdId,
  hobbyId,
  createAction,
  updateAction,
  initialRecipe,
  hobbyInventoryLinks,
}: HobbyRecipeWorkbenchProps): JSX.Element {
  const router = useRouter();
  const recipeId = initialRecipe?.id ?? null;
  const [name, setName] = useState(initialRecipe?.name ?? "");
  const [description, setDescription] = useState(initialRecipe?.description ?? "");
  const [styleCategory, setStyleCategory] = useState(initialRecipe?.styleCategory ?? "");
  const [estimatedDuration, setEstimatedDuration] = useState(initialRecipe?.estimatedDuration ?? "");
  const [estimatedCost, setEstimatedCost] = useState(initialRecipe?.estimatedCost == null ? "" : String(initialRecipe.estimatedCost));
  const [yieldValue, setYieldValue] = useState(initialRecipe?.yield ?? "");
  const [notes, setNotes] = useState(initialRecipe?.notes ?? "");
  const [ingredients, setIngredients] = useState<IngredientDraft[]>(() => initialRecipe
    ? [...initialRecipe.ingredients].sort((left, right) => left.sortOrder - right.sortOrder).map(toIngredientDraft)
    : []);
  const [steps, setSteps] = useState<StepDraft[]>(() => initialRecipe
    ? [...initialRecipe.steps].sort((left, right) => left.sortOrder - right.sortOrder).map(toStepDraft)
    : []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingIngredients, setSavingIngredients] = useState<Record<string, boolean>>({});
  const [savingSteps, setSavingSteps] = useState<Record<string, boolean>>({});
  const [savedIngredientRows, setSavedIngredientRows] = useState<Record<string, boolean>>({});
  const [savedStepRows, setSavedStepRows] = useState<Record<string, boolean>>({});
  const [expandedDescriptions, setExpandedDescriptions] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};

    for (const step of initialRecipe?.steps ?? []) {
      if (step.description) {
        initial[step.id] = true;
      }
    }

    return initial;
  });
  const ingredientSnapshotsRef = useRef<Record<string, PersistedIngredientSnapshot>>(createIngredientSnapshots(initialRecipe));
  const stepSnapshotsRef = useRef<Record<string, PersistedStepSnapshot>>(createStepSnapshots(initialRecipe));
  const savedTimersRef = useRef<Record<string, number>>({});

  useEffect(() => () => {
    for (const timerId of Object.values(savedTimersRef.current)) {
      window.clearTimeout(timerId);
    }
  }, []);

  const markSaved = (scope: "ingredient" | "step", clientId: string) => {
    const stateSetter = scope === "ingredient" ? setSavedIngredientRows : setSavedStepRows;
    const timerKey = `${scope}:${clientId}`;

    stateSetter((current) => ({ ...current, [clientId]: true }));

    if (savedTimersRef.current[timerKey]) {
      window.clearTimeout(savedTimersRef.current[timerKey]);
    }

    savedTimersRef.current[timerKey] = window.setTimeout(() => {
      stateSetter((current) => ({ ...current, [clientId]: false }));
    }, 2000);
  };

  const withIngredientSaving = (clientId: string, isSaving: boolean) => {
    setSavingIngredients((current) => ({ ...current, [clientId]: isSaving }));
  };

  const withStepSaving = (clientId: string, isSaving: boolean) => {
    setSavingSteps((current) => ({ ...current, [clientId]: isSaving }));
  };

  const inventoryOptionById = (inventoryItemId: string) => hobbyInventoryLinks.find((link) => link.inventoryItemId === inventoryItemId);

  const updateIngredientField = <K extends keyof IngredientDraft>(clientId: string, key: K, value: IngredientDraft[K]) => {
    setIngredients((current) => current.map((ingredient) => ingredient.clientId === clientId
      ? { ...ingredient, [key]: value }
      : ingredient));
  };

  const updateStepField = <K extends keyof StepDraft>(clientId: string, key: K, value: StepDraft[K]) => {
    setSteps((current) => current.map((step) => step.clientId === clientId
      ? { ...step, [key]: value }
      : step));
  };

  const handleIngredientInventoryChange = (clientId: string, inventoryItemId: string) => {
    const option = inventoryOptionById(inventoryItemId);

    setIngredients((current) => current.map((ingredient) => {
      if (ingredient.clientId !== clientId) {
        return ingredient;
      }

      return {
        ...ingredient,
        inventoryItemId,
        name: ingredient.name.trim() ? ingredient.name : option?.inventoryItem.name ?? ingredient.name,
        unit: ingredient.unit.trim() ? ingredient.unit : option?.inventoryItem.unit ?? ingredient.unit,
      };
    }));
  };

  const parseIngredientInput = (row: IngredientDraft, sortOrder: number): CreateHobbyRecipeIngredientInput => {
    const nameValue = row.name.trim();
    const unitValue = row.unit.trim();
    const quantityValue = Number(row.quantity);

    if (!nameValue) {
      throw new Error("Each ingredient needs a name.");
    }

    if (!Number.isFinite(quantityValue) || quantityValue < 0) {
      throw new Error(`Ingredient \"${nameValue}\" needs a valid quantity.`);
    }

    if (!unitValue) {
      throw new Error(`Ingredient \"${nameValue}\" needs a unit.`);
    }

    const input: CreateHobbyRecipeIngredientInput = {
      name: nameValue,
      quantity: quantityValue,
      unit: unitValue,
      sortOrder,
    };

    if (row.inventoryItemId) input.inventoryItemId = row.inventoryItemId;
    if (row.category.trim()) input.category = row.category.trim();
    if (row.notes.trim()) input.notes = row.notes.trim();

    return input;
  };

  const parseStepInput = (row: StepDraft, sortOrder: number): CreateHobbyRecipeStepInput => {
    const titleValue = row.title.trim();

    if (!titleValue) {
      throw new Error("Each step needs a title.");
    }

    const input: CreateHobbyRecipeStepInput = {
      title: titleValue,
      sortOrder,
    };

    if (row.description.trim()) input.description = row.description.trim();
    if (row.stepType.trim()) input.stepType = row.stepType.trim();

    if (row.durationMinutes.trim()) {
      const durationValue = Number(row.durationMinutes);

      if (!Number.isInteger(durationValue) || durationValue < 0) {
        throw new Error(`Step \"${titleValue}\" needs a valid whole-number duration.`);
      }

      input.durationMinutes = durationValue;
    }

    return input;
  };

  const saveExistingIngredient = async (clientId: string) => {
    if (mode !== "edit" || !recipeId) {
      return;
    }

    const row = ingredients.find((ingredient) => ingredient.clientId === clientId);

    if (!row || !row.id || row.isNew) {
      return;
    }

    const sortOrder = ingredients.findIndex((ingredient) => ingredient.clientId === clientId);
    const nextSnapshot = buildIngredientSnapshot(row, sortOrder);
    const previousSnapshot = ingredientSnapshotsRef.current[row.id];

    if (!previousSnapshot) {
      return;
    }

    const changes: UpdateHobbyRecipeIngredientInput = {};

    if (previousSnapshot.name !== nextSnapshot.name) changes.name = nextSnapshot.name;
    if (previousSnapshot.quantity !== nextSnapshot.quantity) changes.quantity = nextSnapshot.quantity;
    if (previousSnapshot.unit !== nextSnapshot.unit) changes.unit = nextSnapshot.unit;
    if (previousSnapshot.category !== nextSnapshot.category) changes.category = nextSnapshot.category;
    if (previousSnapshot.inventoryItemId !== nextSnapshot.inventoryItemId) changes.inventoryItemId = nextSnapshot.inventoryItemId;
    if (previousSnapshot.notes !== nextSnapshot.notes) changes.notes = nextSnapshot.notes;
    if (previousSnapshot.sortOrder !== nextSnapshot.sortOrder) changes.sortOrder = nextSnapshot.sortOrder;

    if (Object.keys(changes).length === 0) {
      return;
    }

    withIngredientSaving(clientId, true);
    setError(null);

    try {
      const updatedIngredient = await updateHobbyRecipeIngredient(householdId, hobbyId, recipeId, row.id, changes);

      setIngredients((current) => current.map((ingredient) => ingredient.clientId === clientId
        ? toIngredientDraftFromApi(updatedIngredient)
        : ingredient));

      ingredientSnapshotsRef.current[row.id] = {
        name: updatedIngredient.name,
        quantity: updatedIngredient.quantity,
        unit: updatedIngredient.unit,
        category: updatedIngredient.category,
        inventoryItemId: updatedIngredient.inventoryItemId,
        notes: updatedIngredient.notes,
        sortOrder: updatedIngredient.sortOrder,
      };
      markSaved("ingredient", clientId);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save ingredient.");
    } finally {
      withIngredientSaving(clientId, false);
    }
  };

  const saveNewIngredient = async (clientId: string) => {
    if (mode !== "edit" || !recipeId) {
      return;
    }

    const row = ingredients.find((ingredient) => ingredient.clientId === clientId);

    if (!row || !row.isNew) {
      return;
    }

    withIngredientSaving(clientId, true);
    setError(null);

    try {
      const createdIngredient = await createHobbyRecipeIngredient(
        householdId,
        hobbyId,
        recipeId,
        parseIngredientInput(row, ingredients.findIndex((ingredient) => ingredient.clientId === clientId))
      );

      const nextRow = toIngredientDraftFromApi(createdIngredient);

      setIngredients((current) => current.map((ingredient) => ingredient.clientId === clientId ? nextRow : ingredient));
      ingredientSnapshotsRef.current[createdIngredient.id] = {
        name: createdIngredient.name,
        quantity: createdIngredient.quantity,
        unit: createdIngredient.unit,
        category: createdIngredient.category,
        inventoryItemId: createdIngredient.inventoryItemId,
        notes: createdIngredient.notes,
        sortOrder: createdIngredient.sortOrder,
      };
      markSaved("ingredient", nextRow.clientId);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to add ingredient.");
    } finally {
      withIngredientSaving(clientId, false);
    }
  };

  const removeIngredient = async (clientId: string) => {
    const row = ingredients.find((ingredient) => ingredient.clientId === clientId);

    if (!row) {
      return;
    }

    if (mode === "create" || !row.id || row.isNew || !recipeId) {
      setIngredients((current) => current.filter((ingredient) => ingredient.clientId !== clientId));
      return;
    }

    withIngredientSaving(clientId, true);
    setError(null);

    try {
      await deleteHobbyRecipeIngredient(householdId, hobbyId, recipeId, row.id);
      setIngredients((current) => current.filter((ingredient) => ingredient.clientId !== clientId));
      delete ingredientSnapshotsRef.current[row.id];
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to remove ingredient.");
    } finally {
      withIngredientSaving(clientId, false);
    }
  };

  const reorderIngredients = async (fromIndex: number, toIndex: number) => {
    const reordered = moveItem(ingredients, fromIndex, toIndex);
    setIngredients(reordered);

    if (mode !== "edit" || !recipeId) {
      return;
    }

    const persistedRows = reordered.filter((ingredient) => ingredient.id && !ingredient.isNew);

    if (persistedRows.length === 0) {
      return;
    }

    setError(null);

    try {
      await Promise.all(persistedRows.map(async (ingredient, index) => {
        if (!ingredient.id) {
          return;
        }

        const snapshot = ingredientSnapshotsRef.current[ingredient.id];

        if (snapshot && snapshot.sortOrder === index) {
          return;
        }

        const updatedIngredient = await updateHobbyRecipeIngredient(householdId, hobbyId, recipeId, ingredient.id, { sortOrder: index });
        ingredientSnapshotsRef.current[ingredient.id] = {
          name: updatedIngredient.name,
          quantity: updatedIngredient.quantity,
          unit: updatedIngredient.unit,
          category: updatedIngredient.category,
          inventoryItemId: updatedIngredient.inventoryItemId,
          notes: updatedIngredient.notes,
          sortOrder: updatedIngredient.sortOrder,
        };
      }));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to reorder ingredients.");
    }
  };

  const saveExistingStep = async (clientId: string) => {
    if (mode !== "edit" || !recipeId) {
      return;
    }

    const row = steps.find((step) => step.clientId === clientId);

    if (!row || !row.id || row.isNew) {
      return;
    }

    const sortOrder = steps.findIndex((step) => step.clientId === clientId);
    const nextSnapshot = buildStepSnapshot(row, sortOrder);
    const previousSnapshot = stepSnapshotsRef.current[row.id];

    if (!previousSnapshot) {
      return;
    }

    const changes: UpdateHobbyRecipeStepInput = {};

    if (previousSnapshot.title !== nextSnapshot.title) changes.title = nextSnapshot.title;
    if (previousSnapshot.description !== nextSnapshot.description) changes.description = nextSnapshot.description;
    if (previousSnapshot.durationMinutes !== nextSnapshot.durationMinutes) changes.durationMinutes = nextSnapshot.durationMinutes;
    if (previousSnapshot.stepType !== nextSnapshot.stepType) changes.stepType = nextSnapshot.stepType;
    if (previousSnapshot.sortOrder !== nextSnapshot.sortOrder) changes.sortOrder = nextSnapshot.sortOrder;

    if (Object.keys(changes).length === 0) {
      return;
    }

    withStepSaving(clientId, true);
    setError(null);

    try {
      const updatedStep = await updateHobbyRecipeStep(householdId, hobbyId, recipeId, row.id, changes);
      const nextRow = toStepDraftFromApi(updatedStep);

      setSteps((current) => current.map((step) => step.clientId === clientId ? nextRow : step));
      stepSnapshotsRef.current[row.id] = {
        title: updatedStep.title,
        description: updatedStep.description,
        durationMinutes: updatedStep.durationMinutes,
        stepType: updatedStep.stepType,
        sortOrder: updatedStep.sortOrder,
      };
      markSaved("step", clientId);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save step.");
    } finally {
      withStepSaving(clientId, false);
    }
  };

  const saveNewStep = async (clientId: string) => {
    if (mode !== "edit" || !recipeId) {
      return;
    }

    const row = steps.find((step) => step.clientId === clientId);

    if (!row || !row.isNew) {
      return;
    }

    withStepSaving(clientId, true);
    setError(null);

    try {
      const createdStep = await createHobbyRecipeStep(
        householdId,
        hobbyId,
        recipeId,
        parseStepInput(row, steps.findIndex((step) => step.clientId === clientId))
      );

      const nextRow = toStepDraftFromApi(createdStep);

      setSteps((current) => current.map((step) => step.clientId === clientId ? nextRow : step));
      stepSnapshotsRef.current[createdStep.id] = {
        title: createdStep.title,
        description: createdStep.description,
        durationMinutes: createdStep.durationMinutes,
        stepType: createdStep.stepType,
        sortOrder: createdStep.sortOrder,
      };
      markSaved("step", nextRow.clientId);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to add step.");
    } finally {
      withStepSaving(clientId, false);
    }
  };

  const removeStep = async (clientId: string) => {
    const row = steps.find((step) => step.clientId === clientId);

    if (!row) {
      return;
    }

    if (mode === "create" || !row.id || row.isNew || !recipeId) {
      setSteps((current) => current.filter((step) => step.clientId !== clientId));
      return;
    }

    withStepSaving(clientId, true);
    setError(null);

    try {
      await deleteHobbyRecipeStep(householdId, hobbyId, recipeId, row.id);
      setSteps((current) => current.filter((step) => step.clientId !== clientId));
      delete stepSnapshotsRef.current[row.id];
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to remove step.");
    } finally {
      withStepSaving(clientId, false);
    }
  };

  const handleStepReorder = async (newIds: string[]) => {
    const reordered = newIds.map((id) => steps.find((s) => s.clientId === id)!);
    setSteps(reordered);

    if (mode !== "edit" || !recipeId) {
      return;
    }

    const persistedStepIds = reordered.map((step) => step.id).filter((stepId): stepId is string => Boolean(stepId));

    if (persistedStepIds.length !== reordered.length) {
      return;
    }

    setError(null);

    try {
      await reorderHobbyRecipeSteps(householdId, hobbyId, recipeId, persistedStepIds);

      reordered.forEach((step, index) => {
        if (!step.id) {
          return;
        }

        const snapshot = stepSnapshotsRef.current[step.id];

        if (snapshot) {
          stepSnapshotsRef.current[step.id] = {
            ...snapshot,
            sortOrder: index,
          };
        }
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to reorder steps.");
    }
  };

  const handleCommitKey = (commit: () => Promise<void>) => async (event: KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    await commit();
    event.currentTarget.blur();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const action = mode === "create" ? createAction : updateAction;

      if (!action) {
        throw new Error(`Missing ${mode} action.`);
      }

      const formData = new FormData();
      formData.set("householdId", householdId);
      formData.set("hobbyId", hobbyId);
      formData.set("name", name);
      formData.set("description", description);
      formData.set("styleCategory", styleCategory);
      formData.set("estimatedDuration", estimatedDuration);
      formData.set("estimatedCost", estimatedCost);
      formData.set("yield", yieldValue);
      formData.set("notes", notes);

      if (mode === "create") {
        const ingredientsJson = JSON.stringify(ingredients.map((ingredient, index) => parseIngredientInput(ingredient, index)));
        const stepsJson = JSON.stringify(steps.map((step, index) => parseStepInput(step, index)));

        formData.set("ingredientsJson", ingredientsJson);
        formData.set("stepsJson", stepsJson);
      }

      if (mode === "edit" && recipeId) {
        formData.set("recipeId", recipeId);
      }

      await action(formData);

      if (mode === "edit") {
        setSubmitting(false);
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to save recipe.");
      setSubmitting(false);
    }
  };

  return (
    <form className="workbench-form" onSubmit={handleSubmit}>
      <section className="workbench-section">
        <div className="workbench-section__head">
          <h3>Recipe Identity</h3>
        </div>

        <div className="workbench-grid">
          <label className="workbench-field workbench-field--wide">
            <span className="workbench-field__label">Name <span className="workbench-field__required">*</span></span>
            <input
              type="text"
              className="workbench-field__input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. House Pale Ale"
              required
            />
          </label>

          <label className="workbench-field workbench-field--wide">
            <span className="workbench-field__label">Description</span>
            <textarea
              className="workbench-field__input workbench-field__textarea"
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What makes this recipe distinct?"
            />
          </label>

          <label className="workbench-field">
            <span className="workbench-field__label">Style Category</span>
            <input
              type="text"
              className="workbench-field__input"
              value={styleCategory}
              onChange={(event) => setStyleCategory(event.target.value)}
              placeholder="e.g., American Pale Ale"
            />
          </label>

          <label className="workbench-field">
            <span className="workbench-field__label">Estimated Duration</span>
            <input
              type="text"
              className="workbench-field__input"
              value={estimatedDuration}
              onChange={(event) => setEstimatedDuration(event.target.value)}
              placeholder="e.g., 4 hours"
            />
          </label>

          <label className="workbench-field">
            <span className="workbench-field__label">Estimated Cost</span>
            <input
              type="number"
              className="workbench-field__input"
              min="0"
              step="0.01"
              value={estimatedCost}
              onChange={(event) => setEstimatedCost(event.target.value)}
              placeholder="0.00"
            />
          </label>

          <label className="workbench-field">
            <span className="workbench-field__label">Yield</span>
            <input
              type="text"
              className="workbench-field__input"
              value={yieldValue}
              onChange={(event) => setYieldValue(event.target.value)}
              placeholder="e.g., 5 gallons"
            />
          </label>

          <label className="workbench-field workbench-field--wide">
            <span className="workbench-field__label">Notes</span>
            <textarea
              className="workbench-field__input workbench-field__textarea"
              rows={4}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Timing cues, substitutions, or reminders."
            />
          </label>
        </div>
      </section>

      <section className="workbench-section">
        <div className="workbench-section__head">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <h3>Ingredients</h3>
            <span className="pill">{ingredients.length}</span>
          </div>
          <button type="button" className="button button--secondary button--sm" onClick={() => setIngredients((current) => [...current, createEmptyIngredient()])}>
            Add Ingredient
          </button>
        </div>

        <div className="workbench-table">
          <table className="data-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Move</th>
                <th>Name</th>
                <th>Quantity</th>
                <th>Unit</th>
                <th>Category</th>
                <th>Inventory Link</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {ingredients.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ color: "var(--ink-muted)" }}>No ingredients yet.</td>
                </tr>
              ) : ingredients.map((ingredient, index) => {
                const inventoryOption = ingredient.inventoryItemId ? inventoryOptionById(ingredient.inventoryItemId) : undefined;

                return (
                  <tr
                    key={ingredient.clientId}
                    className={`recipe-ingredient-row${ingredient.isNew ? " recipe-ingredient-row--new" : ""}`}
                  >
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <button
                          type="button"
                          className="button button--ghost button--sm"
                          onClick={() => void reorderIngredients(index, index - 1)}
                          disabled={index === 0}
                        >
                          Up
                        </button>
                        <button
                          type="button"
                          className="button button--ghost button--sm"
                          onClick={() => void reorderIngredients(index, index + 1)}
                          disabled={index === ingredients.length - 1}
                        >
                          Down
                        </button>
                      </div>
                    </td>
                    <td>
                      <input
                        type="text"
                        value={ingredient.name}
                        onChange={(event) => updateIngredientField(ingredient.clientId, "name", event.target.value)}
                        onBlur={() => { void saveExistingIngredient(ingredient.clientId); }}
                        onKeyDown={handleCommitKey(() => saveExistingIngredient(ingredient.clientId))}
                        placeholder="Ingredient name"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={ingredient.quantity}
                        onChange={(event) => updateIngredientField(ingredient.clientId, "quantity", event.target.value)}
                        onBlur={() => { void saveExistingIngredient(ingredient.clientId); }}
                        onKeyDown={handleCommitKey(() => saveExistingIngredient(ingredient.clientId))}
                        placeholder="0"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={ingredient.unit}
                        onChange={(event) => updateIngredientField(ingredient.clientId, "unit", event.target.value)}
                        onBlur={() => { void saveExistingIngredient(ingredient.clientId); }}
                        onKeyDown={handleCommitKey(() => saveExistingIngredient(ingredient.clientId))}
                        placeholder="oz"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={ingredient.category}
                        onChange={(event) => updateIngredientField(ingredient.clientId, "category", event.target.value)}
                        onBlur={() => { void saveExistingIngredient(ingredient.clientId); }}
                        onKeyDown={handleCommitKey(() => saveExistingIngredient(ingredient.clientId))}
                        placeholder="Grain"
                      />
                    </td>
                    <td>
                      <select
                        value={ingredient.inventoryItemId}
                        onChange={(event) => handleIngredientInventoryChange(ingredient.clientId, event.target.value)}
                        onBlur={() => { void saveExistingIngredient(ingredient.clientId); }}
                      >
                        <option value="">None</option>
                        {hobbyInventoryLinks.map((link) => (
                          <option key={link.inventoryItemId} value={link.inventoryItemId}>
                            {link.inventoryItem.name}
                          </option>
                        ))}
                      </select>
                      {inventoryOption ? (
                        <small>On hand: {inventoryOption.inventoryItem.quantityOnHand} {inventoryOption.inventoryItem.unit}</small>
                      ) : null}
                    </td>
                    <td>
                      <textarea
                        rows={2}
                        value={ingredient.notes}
                        onChange={(event) => updateIngredientField(ingredient.clientId, "notes", event.target.value)}
                        onBlur={() => { void saveExistingIngredient(ingredient.clientId); }}
                        placeholder="Optional notes"
                      />
                    </td>
                    <td>
                      <div style={{ display: "grid", gap: "6px", justifyItems: "start" }}>
                        {mode === "edit" && ingredient.isNew ? (
                          <button
                            type="button"
                            className="button button--secondary button--sm"
                            onClick={() => { void saveNewIngredient(ingredient.clientId); }}
                            disabled={Boolean(savingIngredients[ingredient.clientId])}
                          >
                            {savingIngredients[ingredient.clientId] ? "Saving..." : "Save"}
                          </button>
                        ) : null}
                        {!ingredient.isNew && savedIngredientRows[ingredient.clientId] ? <span className="recipe-field-saved">Saved</span> : null}
                        <button
                          type="button"
                          className="button button--danger button--sm"
                          onClick={() => { void removeIngredient(ingredient.clientId); }}
                          disabled={Boolean(savingIngredients[ingredient.clientId])}
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="workbench-section">
        <div className="workbench-section__head">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <h3>Steps</h3>
            <span className="pill">{steps.length}</span>
          </div>
          <button
            type="button"
            className="button button--secondary button--sm"
            onClick={() => {
              const nextStep = createEmptyStep();
              setSteps((current) => [...current, nextStep]);
              setExpandedDescriptions((current) => ({ ...current, [nextStep.clientId]: true }));
            }}
          >
            Add Step
          </button>
        </div>

        <datalist id="recipe-step-type-suggestions">
          {suggestedStepTypes.map((stepType) => <option key={stepType} value={stepType} />)}
        </datalist>

        <div className="recipe-steps-sortable" style={{ display: "grid", gap: "0" }}>
          {steps.length === 0 ? (
            <p style={{ color: "var(--ink-muted)" }}>No steps yet.</p>
          ) : (
            <SortableList
              items={steps.map((s) => ({ ...s, id: s.clientId }))}
              onReorder={(newIds) => { void handleStepReorder(newIds); }}
              renderItem={(step, dragHandleProps) => {
                const stepIndex = steps.findIndex((s) => s.clientId === step.clientId);
                const isDescriptionExpanded = Boolean(expandedDescriptions[step.clientId]);

                return (
                  <div className="recipe-step-item">
                    <span
                      ref={(el: HTMLSpanElement | null) => dragHandleProps.ref(el)}
                      role={dragHandleProps.role}
                      tabIndex={dragHandleProps.tabIndex}
                      aria-roledescription={dragHandleProps["aria-roledescription"]}
                      aria-describedby={dragHandleProps["aria-describedby"]}
                      aria-pressed={dragHandleProps["aria-pressed"]}
                      aria-disabled={dragHandleProps["aria-disabled"]}
                      onKeyDown={dragHandleProps.onKeyDown}
                      onPointerDown={dragHandleProps.onPointerDown}
                      className="drag-handle"
                      style={{ alignSelf: "center" }}
                    />
                    <div className="recipe-step-item__number">{stepIndex + 1}</div>
                    <div style={{ flex: 1, display: "grid", gap: "8px" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto auto auto", gap: "8px", alignItems: "center" }}>
                        <input
                          type="text"
                          value={step.title}
                          onChange={(event) => updateStepField(step.clientId, "title", event.target.value)}
                          onBlur={() => { void saveExistingStep(step.clientId); }}
                          onKeyDown={handleCommitKey(() => saveExistingStep(step.clientId))}
                          placeholder="Step title"
                        />
                        <input
                          type="text"
                          list="recipe-step-type-suggestions"
                          className="recipe-step-type-input"
                          value={step.stepType}
                          onChange={(event) => updateStepField(step.clientId, "stepType", event.target.value)}
                          onBlur={() => { void saveExistingStep(step.clientId); }}
                          onKeyDown={handleCommitKey(() => saveExistingStep(step.clientId))}
                          placeholder="generic"
                        />
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={step.durationMinutes}
                          onChange={(event) => updateStepField(step.clientId, "durationMinutes", event.target.value)}
                          onBlur={() => { void saveExistingStep(step.clientId); }}
                          onKeyDown={handleCommitKey(() => saveExistingStep(step.clientId))}
                          placeholder="min"
                        />
                        <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                          {mode === "edit" && step.isNew ? (
                            <button
                              type="button"
                              className="button button--secondary button--sm"
                              onClick={() => { void saveNewStep(step.clientId); }}
                              disabled={Boolean(savingSteps[step.clientId])}
                            >
                              {savingSteps[step.clientId] ? "Saving..." : "Save"}
                            </button>
                          ) : null}
                          {!step.isNew && savedStepRows[step.clientId] ? <span className="recipe-field-saved">Saved</span> : null}
                          <button
                            type="button"
                            className="button button--danger button--sm"
                            onClick={() => { void removeStep(step.clientId); }}
                            disabled={Boolean(savingSteps[step.clientId])}
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="recipe-step-description-toggle"
                        onClick={() => setExpandedDescriptions((current) => ({ ...current, [step.clientId]: !isDescriptionExpanded }))}
                      >
                        {isDescriptionExpanded ? "Hide description" : "Show description"}
                      </button>

                      {isDescriptionExpanded ? (
                        <textarea
                          rows={3}
                          value={step.description}
                          onChange={(event) => updateStepField(step.clientId, "description", event.target.value)}
                          onBlur={() => { void saveExistingStep(step.clientId); }}
                          placeholder="Describe the action, cues, or targets."
                        />
                      ) : null}
                    </div>
                  </div>
                );
              }}
            />
          )}
        </div>
      </section>

      {error ? <p className="workbench-error">{error}</p> : null}

      <div className="recipe-submit-bar">
        <button
          type="button"
          className="button button--ghost"
          onClick={() => router.push(`/hobbies/${hobbyId}?tab=recipes`)}
          disabled={submitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="button button--primary"
          disabled={submitting || !name.trim()}
        >
          {submitting ? (mode === "create" ? "Creating..." : "Saving...") : (mode === "create" ? "Create Recipe" : "Save Recipe")}
        </button>
      </div>
    </form>
  );
}