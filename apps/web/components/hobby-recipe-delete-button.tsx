"use client";

import type { JSX } from "react";
import { useState } from "react";

type HobbyRecipeDeleteButtonProps = {
  householdId: string;
  hobbyId: string;
  recipeId: string;
  deleteAction: (formData: FormData) => Promise<void>;
};

export function HobbyRecipeDeleteButton({
  householdId,
  hobbyId,
  recipeId,
  deleteAction,
}: HobbyRecipeDeleteButtonProps): JSX.Element {
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!confirmDelete) {
    return (
      <button
        type="button"
        className="button button--danger"
        onClick={() => setConfirmDelete(true)}
      >
        Delete
      </button>
    );
  }

  return (
    <div className="inline-actions">
      <form action={deleteAction}>
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="hobbyId" value={hobbyId} />
        <input type="hidden" name="recipeId" value={recipeId} />
        <button type="submit" className="button button--danger">
          Confirm Delete
        </button>
      </form>
      <button
        type="button"
        className="button button--ghost"
        onClick={() => setConfirmDelete(false)}
      >
        Cancel
      </button>
    </div>
  );
}