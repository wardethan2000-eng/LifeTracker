"use client";

import type {
  HobbyActivityMode,
  HobbyCollectionItem,
  HobbyPracticeGoalSummary,
  HobbyPracticeRoutineSummary,
  HobbyRecipe,
  HobbySeriesDetail,
} from "@aegis/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type JSX } from "react";
import { useForm } from "react-hook-form";
import {
  hobbySessionFormSchema,
  type HobbySessionFormValues,
  type HobbySessionResolvedValues
} from "../lib/validation/forms";
import { EntryTipsSurface } from "./entry-system";
import { InlineError } from "./inline-error";

type HobbySessionWorkbenchProps = {
  action: (formData: FormData) => Promise<void>;
  householdId: string;
  hobbyId: string;
  activityMode: HobbyActivityMode;
  recipes: HobbyRecipe[];
  activeSeries: HobbySeriesDetail[];
  activeGoals: HobbyPracticeGoalSummary[];
  activeRoutines: HobbyPracticeRoutineSummary[];
  collectionItems: HobbyCollectionItem[];
  initialSeriesSelection?: string | undefined;
};

const todayInputValue = (): string => new Date().toISOString().slice(0, 10);

export function HobbySessionWorkbench({
  action,
  householdId,
  hobbyId,
  activityMode,
  recipes,
  activeSeries,
  activeGoals,
  activeRoutines,
  collectionItems,
  initialSeriesSelection,
}: HobbySessionWorkbenchProps): JSX.Element {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors }
  } = useForm<HobbySessionFormValues, unknown, HobbySessionResolvedValues>({
    resolver: zodResolver(hobbySessionFormSchema),
    mode: "onBlur",
    reValidateMode: "onBlur",
    defaultValues: {
      name: "",
      recipeId: "",
      startDate: todayInputValue(),
      notes: "",
      seriesChoice: initialSeriesSelection ?? "",
      routineId: "",
      collectionItemId: "",
      newSeriesName: "",
      newSeriesDescription: "",
      newSeriesTags: ""
    }
  });

  const name = watch("name") ?? "";
  const recipeId = watch("recipeId") ?? "";
  const startDate = watch("startDate") ?? "";
  const notes = watch("notes") ?? "";
  const seriesChoice = watch("seriesChoice") ?? "";
  const routineId = watch("routineId") ?? "";
  const collectionItemId = watch("collectionItemId") ?? "";
  const newSeriesName = watch("newSeriesName") ?? "";
  const newSeriesDescription = watch("newSeriesDescription") ?? "";
  const newSeriesTags = watch("newSeriesTags") ?? "";

  const selectedExistingSeries = useMemo(
    () => activeSeries.find((series) => series.id === seriesChoice) ?? null,
    [activeSeries, seriesChoice],
  );

  const isCreatingSeries = seriesChoice === "__new__";

  useEffect(() => {
    if (!selectedExistingSeries) {
      return;
    }

    const latestSession = [...selectedExistingSeries.sessions]
      .sort((left, right) => (right.batchNumber ?? 0) - (left.batchNumber ?? 0))[0];

    if (latestSession?.recipeId) {
      setValue("recipeId", latestSession.recipeId, { shouldValidate: true });
    }

    if (!name.trim()) {
      const nextBatchNumber = (latestSession?.batchNumber ?? selectedExistingSeries.batchCount) + 1;
      setValue("name", `${selectedExistingSeries.name} Batch ${nextBatchNumber}`, { shouldValidate: true });
    }
  }, [name, selectedExistingSeries, setValue]);

  const handleRecipeChange = (nextRecipeId: string) => {
    setValue("recipeId", nextRecipeId, { shouldValidate: true });

    if (getValues("name")?.trim()) {
      return;
    }

    const recipe = recipes.find((candidate) => candidate.id === nextRecipeId);

    if (recipe) {
      setValue("name", `Session from ${recipe.name}`, { shouldValidate: true });
    }
  };

  const submitForm = handleSubmit(async (values) => {
    setSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("householdId", householdId);
      formData.set("hobbyId", hobbyId);
      formData.set("name", values.name);
      if (values.recipeId) formData.set("recipeId", values.recipeId);
      if (values.routineId) formData.set("routineId", values.routineId);
      if (values.collectionItemId) formData.set("collectionItemId", values.collectionItemId);
      if (values.startDate) formData.set("startDate", values.startDate);
      formData.set("notes", values.notes ?? "");
      if (selectedExistingSeries) {
        formData.set("seriesId", selectedExistingSeries.id);
      }
      if (isCreatingSeries && values.newSeriesName?.trim()) {
        formData.set("newSeriesName", values.newSeriesName.trim());
        if (values.newSeriesDescription?.trim()) formData.set("newSeriesDescription", values.newSeriesDescription.trim());
        if (values.newSeriesTags?.trim()) formData.set("newSeriesTags", values.newSeriesTags.trim());
      }
      await action(formData);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to create session.");
      setSubmitting(false);
    }
  });

  return (
    <div className="session-workbench-stack">
      {selectedExistingSeries ? (
        <EntryTipsSurface
          householdId={householdId}
          queries={[{ entityType: "hobby_series", entityId: selectedExistingSeries.id }]}
          title={`Series notes for ${selectedExistingSeries.name}`}
          entryHrefBuilder={(entry) => `/hobbies/${hobbyId}/series/${selectedExistingSeries.id}#entry-${entry.id}`}
        />
      ) : null}

      <form className="workbench-form" noValidate onSubmit={submitForm}>
        <section className="workbench-section">
          <div className="workbench-section__head">
            <h3>Session Setup</h3>
          </div>

          <div className="workbench-grid">
            <label className="workbench-field workbench-field--wide">
              <span className="workbench-field__label">Session Name <span className="workbench-field__required">*</span></span>
              <input
                type="text"
                className="workbench-field__input"
                {...register("name")}
                placeholder="e.g. Oatmeal Stout Brew Day"
              />
              <InlineError message={errors.name?.message} size="sm" />
            </label>

            <label className="workbench-field">
              <span className="workbench-field__label">Add to Series</span>
              <select className="workbench-field__input" {...register("seriesChoice")}>
                <option value="">No series</option>
                {activeSeries.map((series) => (
                  <option key={series.id} value={series.id}>
                    {series.name} ({series.batchCount} batches)
                  </option>
                ))}
                <option value="__new__">Create new series</option>
              </select>
              <InlineError message={errors.seriesChoice?.message} size="sm" />
            </label>

            <label className="workbench-field">
              <span className="workbench-field__label">Source Recipe</span>
              <select
                className="workbench-field__input"
                value={recipeId}
                onChange={(event) => handleRecipeChange(event.target.value)}
              >
                <option value="">None — start from scratch</option>
                {recipes.map((recipe) => (
                  <option key={recipe.id} value={recipe.id}>{recipe.name}</option>
                ))}
              </select>
              <InlineError message={errors.recipeId?.message} size="sm" />
            </label>

            <label className="workbench-field">
              <span className="workbench-field__label">Start Date</span>
              <input
                type="date"
                className="workbench-field__input"
                {...register("startDate")}
              />
              <InlineError message={errors.startDate?.message} size="sm" />
            </label>

            {(activityMode === "practice" || activeRoutines.length > 0) ? (
              <label className="workbench-field">
                <span className="workbench-field__label">Practice Routine</span>
                <select className="workbench-field__input" {...register("routineId")}>
                  <option value="">No routine</option>
                  {activeRoutines.map((routine) => (
                    <option key={routine.id} value={routine.id}>
                      {routine.name} ({routine.currentStreak} streak)
                    </option>
                  ))}
                </select>
                <InlineError message={errors.routineId?.message} size="sm" />
              </label>
            ) : null}

            {(activityMode === "collection" || collectionItems.length > 0) ? (
              <label className="workbench-field">
                <span className="workbench-field__label">Collection Item</span>
                <select className="workbench-field__input" {...register("collectionItemId")}>
                  <option value="">No collection item</option>
                  {collectionItems.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
                <InlineError message={errors.collectionItemId?.message} size="sm" />
              </label>
            ) : null}

            {selectedExistingSeries ? (
              <div className="workbench-callout workbench-field--wide">
                <strong>{selectedExistingSeries.name}</strong>
                <p>
                  This session will join the active series as the next batch. The most recent batch recipe is preloaded when available.
                </p>
              </div>
            ) : null}

            {(activityMode === "practice" || activeGoals.length > 0) ? (
              <div className="workbench-callout workbench-field--wide">
                <strong>Active goals</strong>
                {activeGoals.length === 0 ? (
                  <p>No active goals yet.</p>
                ) : (
                  <div className="session-goal-preview-list">
                    {activeGoals.map((goal) => (
                      <div key={goal.id} className="session-goal-preview">
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                          <strong>{goal.name}</strong>
                          <span>{Math.round(goal.progressPercentage)}%</span>
                        </div>
                        <div className="mode-progress__bar">
                          <span style={{ width: `${Math.max(0, Math.min(100, goal.progressPercentage))}%` }} />
                        </div>
                        <p>{goal.currentValue} / {goal.targetValue} {goal.unit}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {isCreatingSeries ? (
              <>
                <label className="workbench-field workbench-field--wide">
                  <span className="workbench-field__label">New Series Name <span className="workbench-field__required">*</span></span>
                  <input
                    type="text"
                    className="workbench-field__input"
                    {...register("newSeriesName")}
                    placeholder="e.g. House Pilsner Iterations"
                  />
                  <InlineError message={errors.newSeriesName?.message} size="sm" />
                </label>
                <label className="workbench-field workbench-field--wide">
                  <span className="workbench-field__label">Series Description</span>
                  <textarea
                    className="workbench-field__input workbench-field__textarea"
                    rows={3}
                    {...register("newSeriesDescription")}
                    placeholder="What will this series compare across batches?"
                  />
                  <InlineError message={errors.newSeriesDescription?.message} size="sm" />
                </label>
                <label className="workbench-field workbench-field--wide">
                  <span className="workbench-field__label">Series Tags</span>
                  <input
                    type="text"
                    className="workbench-field__input"
                    {...register("newSeriesTags")}
                    placeholder="lager, house beer, spring"
                  />
                  <InlineError message={errors.newSeriesTags?.message} size="sm" />
                </label>
              </>
            ) : null}

            <label className="workbench-field workbench-field--wide">
              <span className="workbench-field__label">Notes</span>
              <textarea
                className="workbench-field__input workbench-field__textarea"
                {...register("notes")}
                rows={4}
                placeholder="Capture goals, batch targets, or anything you want visible in the session detail."
              />
              <InlineError message={errors.notes?.message} size="sm" />
            </label>
          </div>
        </section>

        {error ? <p className="workbench-error">{error}</p> : null}

        <div className="workbench-bar">
          <button type="button" className="button button--ghost" disabled={submitting} onClick={() => router.back()}>
            Cancel
          </button>
          <button type="submit" className="button button--primary" disabled={submitting}>
            {submitting ? "Creating…" : "Create Session"}
          </button>
        </div>
      </form>
    </div>
  );
}