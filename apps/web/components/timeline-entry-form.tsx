"use client";

import type { AssetTimelineEntry } from "@aegis/types";
import { useRouter, useSearchParams } from "next/navigation";
import type { JSX } from "react";
import { useCallback, useState, useTransition } from "react";

type TimelineEntryFormProps = {
  assetId: string;
  householdId: string;
  createAction: (formData: FormData) => Promise<void>;
  onCancel?: () => void;
  editEntry?: AssetTimelineEntry;
  updateAction?: (formData: FormData) => Promise<void>;
};

const categoryOptions = [
  "note",
  "observation",
  "repair",
  "inspection",
  "purchase",
  "incident",
  "modification",
  "cleaning",
  "seasonal",
  "other"
] as const;

const toDateTimeLocalValue = (value?: string | null): string => {
  const parsed = value ? new Date(value) : new Date();

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const offsetMinutes = parsed.getTimezoneOffset();
  return new Date(parsed.getTime() - offsetMinutes * 60_000).toISOString().slice(0, 16);
};

export function TimelineEntryForm({
  assetId,
  householdId,
  createAction,
  onCancel,
  editEntry,
  updateAction
}: TimelineEntryFormProps): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formKey, setFormKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const initialCategory = editEntry?.category ?? "";
  const [selectedCategory, setSelectedCategory] = useState(
    categoryOptions.includes(initialCategory as (typeof categoryOptions)[number]) ? initialCategory : ""
  );
  const [customCategory, setCustomCategory] = useState(
    initialCategory && !categoryOptions.includes(initialCategory as (typeof categoryOptions)[number])
      ? initialCategory
      : ""
  );
  const finalCategory = customCategory.trim() || selectedCategory;

  const handleCancel = useCallback(() => {
    if (onCancel) {
      onCancel();
      return;
    }

    const params = new URLSearchParams(searchParams.toString());

    params.delete("showAddForm");

    const query = params.toString();
    router.push(`/assets/${assetId}${query ? `?${query}` : ""}`);
  }, [assetId, onCancel, router, searchParams]);

  const submitAction = (formData: FormData): void => {
    setError(null);
    startTransition(async () => {
      try {
        if (editEntry && updateAction) {
          await updateAction(formData);
        } else {
          await createAction(formData);
        }
        setFormKey((current) => current + 1);
        handleCancel();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save entry. Please try again.");
      }
    });
  };

  return (
    <div className="timeline-add-form">
      <form action={submitAction} key={formKey} className="form-grid">
        <input type="hidden" name="assetId" value={assetId} />
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="category" value={finalCategory} />
        {editEntry ? <input type="hidden" name="entryId" value={editEntry.id} /> : null}

        <label className="field field--full">
          <span>Title</span>
          <input
            type="text"
            name="title"
            placeholder="What happened?"
            required
            defaultValue={editEntry?.title ?? ""}
          />
        </label>

        <label className="field field--full">
          <span>Description</span>
          <textarea
            name="description"
            rows={3}
            placeholder="Add details, observations, or notes..."
            defaultValue={editEntry?.description ?? ""}
          />
        </label>

        <label className="field">
          <span>Entry Date</span>
          <input
            type="datetime-local"
            name="entryDate"
            required
            defaultValue={toDateTimeLocalValue(editEntry?.entryDate)}
          />
        </label>

        <div className="field">
          <span>Category</span>
          <div className="timeline-add-form__category-chips">
            {categoryOptions.map((option) => {
              const isActive = !customCategory.trim() && selectedCategory === option;

              return (
                <button
                  key={option}
                  type="button"
                  className={`timeline-add-form__category-chip${isActive ? " timeline-add-form__category-chip--active" : ""}`}
                  onClick={() => {
                    setSelectedCategory((current) => current === option ? "" : option);
                    setCustomCategory("");
                  }}
                >
                  {option}
                </button>
              );
            })}
          </div>
          <input
            type="text"
            placeholder="Or type a custom category..."
            value={customCategory}
            onChange={(event) => setCustomCategory(event.target.value)}
            style={{ marginTop: 10 }}
          />
        </div>

        <label className="field">
          <span>Cost</span>
          <input
            type="number"
            name="cost"
            min="0"
            step="0.01"
            placeholder="0.00"
            defaultValue={editEntry?.cost ?? undefined}
          />
        </label>

        <label className="field">
          <span>Vendor</span>
          <input
            type="text"
            name="vendor"
            placeholder="Who did the work or sold the part?"
            defaultValue={editEntry?.vendor ?? ""}
          />
        </label>

        <label className="field field--full">
          <span>Tags</span>
          <input
            type="text"
            name="tags"
            placeholder="Comma-separated tags (e.g., exterior, urgent, warranty)"
            defaultValue={editEntry?.tags.join(", ") ?? ""}
          />
        </label>

        <div className="field field--full inline-actions">
          <button type="submit" className="button button--primary" disabled={isPending}>
            {isPending ? "Saving…" : editEntry ? "Update Entry" : "Save Entry"}
          </button>
          <button type="button" className="button button--ghost" onClick={handleCancel} disabled={isPending}>Cancel</button>
        </div>
        {error ? <p className="form-error field field--full">{error}</p> : null}
      </form>
    </div>
  );
}