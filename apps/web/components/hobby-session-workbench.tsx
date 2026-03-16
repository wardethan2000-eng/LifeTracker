"use client";

import type { HobbyRecipe } from "@lifekeeper/types";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type JSX } from "react";

type HobbySessionWorkbenchProps = {
  action: (formData: FormData) => Promise<void>;
  householdId: string;
  hobbyId: string;
  recipes: HobbyRecipe[];
};

const todayInputValue = (): string => new Date().toISOString().slice(0, 10);

export function HobbySessionWorkbench({ action, householdId, hobbyId, recipes }: HobbySessionWorkbenchProps): JSX.Element {
  const router = useRouter();
  const [name, setName] = useState("");
  const [recipeId, setRecipeId] = useState("");
  const [startDate, setStartDate] = useState(todayInputValue());
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      if (startDate) formData.set("startDate", startDate);
      formData.set("notes", notes);
      await action(formData);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to create session.");
      setSubmitting(false);
    }
  };

  return (
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
        <button type="submit" className="button button--primary" disabled={submitting || !name.trim()}>
          {submitting ? "Creating…" : "Create Session"}
        </button>
      </div>
    </form>
  );
}