"use client";

import type {
  HobbyActivityMode,
  HobbyCollectionItem,
  HobbyPracticeGoalSummary,
  HobbyPracticeRoutineSummary,
  HobbyRecipe,
  HobbySeriesDetail,
} from "@lifekeeper/types";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent, type JSX } from "react";
import { EntryTipsSurface } from "./entry-system";

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
  const [name, setName] = useState("");
  const [recipeId, setRecipeId] = useState("");
  const [startDate, setStartDate] = useState(todayInputValue());
  const [notes, setNotes] = useState("");
  const [seriesChoice, setSeriesChoice] = useState(initialSeriesSelection ?? "");
  const [routineId, setRoutineId] = useState("");
  const [collectionItemId, setCollectionItemId] = useState("");
  const [newSeriesName, setNewSeriesName] = useState("");
  const [newSeriesDescription, setNewSeriesDescription] = useState("");
  const [newSeriesTags, setNewSeriesTags] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setRecipeId(latestSession.recipeId);
    }

    if (!name.trim()) {
      const nextBatchNumber = (latestSession?.batchNumber ?? selectedExistingSeries.batchCount) + 1;
      setName(`${selectedExistingSeries.name} Batch ${nextBatchNumber}`);
    }
  }, [name, selectedExistingSeries]);

  const handleRecipeChange = (nextRecipeId: string) => {
    setRecipeId(nextRecipeId);

    if (name.trim()) {
      return;
    }

    const recipe = recipes.find((candidate) => candidate.id === nextRecipeId);

    if (recipe) {
      setName(`Session from ${recipe.name}`);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("householdId", householdId);
      formData.set("hobbyId", hobbyId);
      formData.set("name", name);
      if (recipeId) formData.set("recipeId", recipeId);
      if (routineId) formData.set("routineId", routineId);
      if (collectionItemId) formData.set("collectionItemId", collectionItemId);
      if (startDate) formData.set("startDate", startDate);
      formData.set("notes", notes);
      if (selectedExistingSeries) {
        formData.set("seriesId", selectedExistingSeries.id);
      }
      if (isCreatingSeries && newSeriesName.trim()) {
        formData.set("newSeriesName", newSeriesName.trim());
        if (newSeriesDescription.trim()) formData.set("newSeriesDescription", newSeriesDescription.trim());
        if (newSeriesTags.trim()) formData.set("newSeriesTags", newSeriesTags.trim());
      }
      await action(formData);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to create session.");
      setSubmitting(false);
    }
  };

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

      <form className="workbench-form" onSubmit={handleSubmit}>
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
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Oatmeal Stout Brew Day"
                required
              />
            </label>

            <label className="workbench-field">
              <span className="workbench-field__label">Add to Series</span>
              <select className="workbench-field__input" value={seriesChoice} onChange={(event) => setSeriesChoice(event.target.value)}>
                <option value="">No series</option>
                {activeSeries.map((series) => (
                  <option key={series.id} value={series.id}>
                    {series.name} ({series.batchCount} batches)
                  </option>
                ))}
                <option value="__new__">Create new series</option>
              </select>
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
            </label>

            <label className="workbench-field">
              <span className="workbench-field__label">Start Date</span>
              <input
                type="date"
                className="workbench-field__input"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </label>

            {(activityMode === "practice" || activeRoutines.length > 0) ? (
              <label className="workbench-field">
                <span className="workbench-field__label">Practice Routine</span>
                <select className="workbench-field__input" value={routineId} onChange={(event) => setRoutineId(event.target.value)}>
                  <option value="">No routine</option>
                  {activeRoutines.map((routine) => (
                    <option key={routine.id} value={routine.id}>
                      {routine.name} ({routine.currentStreak} streak)
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {(activityMode === "collection" || collectionItems.length > 0) ? (
              <label className="workbench-field">
                <span className="workbench-field__label">Collection Item</span>
                <select className="workbench-field__input" value={collectionItemId} onChange={(event) => setCollectionItemId(event.target.value)}>
                  <option value="">No collection item</option>
                  {collectionItems.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
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
                    value={newSeriesName}
                    onChange={(event) => setNewSeriesName(event.target.value)}
                    placeholder="e.g. House Pilsner Iterations"
                    required={isCreatingSeries}
                  />
                </label>
                <label className="workbench-field workbench-field--wide">
                  <span className="workbench-field__label">Series Description</span>
                  <textarea
                    className="workbench-field__input workbench-field__textarea"
                    rows={3}
                    value={newSeriesDescription}
                    onChange={(event) => setNewSeriesDescription(event.target.value)}
                    placeholder="What will this series compare across batches?"
                  />
                </label>
                <label className="workbench-field workbench-field--wide">
                  <span className="workbench-field__label">Series Tags</span>
                  <input
                    type="text"
                    className="workbench-field__input"
                    value={newSeriesTags}
                    onChange={(event) => setNewSeriesTags(event.target.value)}
                    placeholder="lager, house beer, spring"
                  />
                </label>
              </>
            ) : null}

            <label className="workbench-field workbench-field--wide">
              <span className="workbench-field__label">Notes</span>
              <textarea
                className="workbench-field__input workbench-field__textarea"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={4}
                placeholder="Capture goals, batch targets, or anything you want visible in the session detail."
              />
            </label>
          </div>
        </section>

        {error ? <p className="workbench-error">{error}</p> : null}

        <div className="workbench-bar">
          <button type="button" className="button button--ghost" disabled={submitting} onClick={() => router.back()}>
            Cancel
          </button>
          <button type="submit" className="button button--primary" disabled={submitting || !name.trim() || (isCreatingSeries && !newSeriesName.trim())}>
            {submitting ? "Creating…" : "Create Session"}
          </button>
        </div>
      </form>
    </div>
  );
}