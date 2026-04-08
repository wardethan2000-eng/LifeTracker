"use client";

import type { AssetTimelineItem } from "@aegis/types";
import type { JSX } from "react";
import { useEffect, useRef, useState } from "react";
import { formatCurrency, formatDateTime } from "../lib/formatters";

type TimelineItemProps = {
  item: AssetTimelineItem;
  assetId: string;
  householdId: string;
  updateAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
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

const formatSourceLabel = (sourceType: AssetTimelineItem["sourceType"]): string => {
  switch (sourceType) {
    case "maintenance_log":
      return "Maintenance";
    case "timeline_entry":
      return "Manual Entry";
    case "project_event":
      return "Project";
    case "inventory_transaction":
      return "Inventory";
    case "schedule_change":
      return "Schedule";
    case "comment":
      return "Comment";
    case "condition_assessment":
      return "Condition";
    case "usage_reading":
      return "Usage";
    default:
      return "Activity";
  }
};

const toDateTimeLocalValue = (value: string): string => {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const offsetMinutes = parsed.getTimezoneOffset();
  return new Date(parsed.getTime() - offsetMinutes * 60_000).toISOString().slice(0, 16);
};

const getMetadataRecord = (metadata: unknown): Record<string, unknown> | null => (
  typeof metadata === "object" && metadata !== null ? metadata as Record<string, unknown> : null
);

const getMetadataString = (metadata: Record<string, unknown> | null, key: string): string => {
  const value = metadata?.[key];
  return typeof value === "string" ? value : "";
};

const getMetadataTags = (metadata: Record<string, unknown> | null): string => {
  const value = metadata?.tags;

  if (!Array.isArray(value)) {
    return "";
  }

  return value.filter((entry): entry is string => typeof entry === "string").join(", ");
};

export function TimelineItem({ item, assetId, householdId, updateAction, deleteAction }: TimelineItemProps): JSX.Element {
  const descriptionRef = useRef<HTMLParagraphElement | null>(null);
  const metadata = getMetadataRecord(item.metadata);
  const initialCategory = item.category ?? "";
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [hasDescriptionOverflow, setHasDescriptionOverflow] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(
    categoryOptions.includes(initialCategory as (typeof categoryOptions)[number]) ? initialCategory : ""
  );
  const [customCategory, setCustomCategory] = useState(
    initialCategory && !categoryOptions.includes(initialCategory as (typeof categoryOptions)[number])
      ? initialCategory
      : ""
  );
  const finalCategory = customCategory.trim() || selectedCategory;
  const vendor = getMetadataString(metadata, "vendor");
  const tags = getMetadataTags(metadata);
  const sourceSystem = getMetadataString(metadata, "entrySystem") || "legacy";
  const isImported = metadata?.importedFromLegacy === true;

  useEffect(() => {
    if (!item.description || isDescriptionExpanded) {
      return;
    }

    const updateOverflowState = (): void => {
      const descriptionElement = descriptionRef.current;

      if (!descriptionElement) {
        return;
      }

      setHasDescriptionOverflow(descriptionElement.scrollHeight > descriptionElement.clientHeight + 1);
    };

    updateOverflowState();
    window.addEventListener("resize", updateOverflowState);

    return () => window.removeEventListener("resize", updateOverflowState);
  }, [isDescriptionExpanded, item.description]);

  const submitUpdate = async (formData: FormData): Promise<void> => {
    await updateAction(formData);
    setShowEditForm(false);
  };

  const submitDelete = async (formData: FormData): Promise<void> => {
    await deleteAction(formData);
    setShowDeleteConfirm(false);
  };

  return (
    <div className={`timeline-item timeline-item--${item.sourceType}`}>
      <div className="timeline-item__header">
        <div style={{ display: "grid", gap: "8px", flex: 1 }}>
          <h3 className="timeline-item__title">{item.title}</h3>
          {item.description ? (
            <div style={{ display: "grid", gap: "4px" }}>
              <p
                ref={descriptionRef}
                className={`timeline-item__description${isDescriptionExpanded ? " timeline-item__description--expanded" : ""}`}
              >
                {item.description}
              </p>
              {hasDescriptionOverflow ? (
                <button
                  type="button"
                  className="text-link"
                  onClick={() => setIsDescriptionExpanded((current) => !current)}
                >
                  {isDescriptionExpanded ? "Show less" : "Show more"}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {item.cost !== null ? <div className="timeline-item__cost">{formatCurrency(item.cost)}</div> : null}
      </div>

      <div className="timeline-item__meta">
        <span className={`timeline-item__source-badge timeline-item__source-badge--${item.sourceType}`}>
          {formatSourceLabel(item.sourceType)}
        </span>
        <span className="timeline-item__date">{formatDateTime(item.eventDate)}</span>
        {item.category ? <span className="pill">{item.category}</span> : null}
        {isImported ? <span className="pill pill--warning">Imported</span> : null}
        {sourceSystem === "legacy" ? <span className="pill pill--muted">Legacy</span> : null}
        {item.userName ? <span className="timeline-item__user">by {item.userName}</span> : null}
      </div>

      {item.parts && item.parts.length > 0 ? (
        <div className="timeline-item__parts">
          {item.parts.map((part, index) => (
            <span key={`${part.name}-${index}`} className="timeline-item__part-pill">
              {part.quantity}x {part.name}
              {part.partNumber ? ` (${part.partNumber})` : ""}
              {part.unitCost !== null ? ` • ${formatCurrency(part.unitCost)}` : ""}
            </span>
          ))}
        </div>
      ) : null}

      {item.isEditable ? (
        <div className="timeline-item__actions">
          <button
            type="button"
            className="button button--ghost button--sm"
            onClick={() => {
              setShowEditForm((current) => !current);
              setShowDeleteConfirm(false);
            }}
          >
            Edit
          </button>
          <button
            type="button"
            className="button button--danger button--sm"
            onClick={() => {
              setShowDeleteConfirm(true);
              setShowEditForm(false);
            }}
          >
            Delete
          </button>
        </div>
      ) : null}

      {showDeleteConfirm ? (
        <form action={submitDelete} className="schedule-card__delete-confirm">
          <input type="hidden" name="assetId" value={assetId} />
          <input type="hidden" name="entryId" value={item.sourceId} />
          <input type="hidden" name="householdId" value={householdId} />
          <input type="hidden" name="sourceSystem" value={sourceSystem} />
          <span style={{ fontSize: "0.82rem", color: "var(--danger)" }}>Delete this entry?</span>
          <button type="button" className="button button--ghost button--sm" onClick={() => setShowDeleteConfirm(false)}>
            Cancel
          </button>
          <button type="submit" className="button button--danger button--sm">Confirm Delete</button>
        </form>
      ) : null}

      {showEditForm ? (
        <div className="timeline-item__edit-form">
          <form action={submitUpdate} className="form-grid">
            <input type="hidden" name="assetId" value={assetId} />
            <input type="hidden" name="entryId" value={item.sourceId} />
            <input type="hidden" name="householdId" value={householdId} />
            <input type="hidden" name="sourceSystem" value={sourceSystem} />
            <input type="hidden" name="category" value={finalCategory} />

            <label className="field field--full">
              <span>Title</span>
              <input type="text" name="title" required defaultValue={item.title} />
            </label>

            <label className="field field--full">
              <span>Description</span>
              <textarea name="description" rows={3} defaultValue={item.description ?? ""} />
            </label>

            <label className="field">
              <span>Entry Date</span>
              <input type="datetime-local" name="entryDate" required defaultValue={toDateTimeLocalValue(item.eventDate)} />
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
              <input type="number" name="cost" min="0" step="0.01" defaultValue={item.cost ?? undefined} />
            </label>

            <label className="field">
              <span>Vendor</span>
              <input type="text" name="vendor" defaultValue={vendor} />
            </label>

            <label className="field field--full">
              <span>Tags</span>
              <input type="text" name="tags" defaultValue={tags} />
            </label>

            <div className="field field--full inline-actions">
              <button type="submit" className="button button--primary">Save</button>
              <button type="button" className="button button--ghost" onClick={() => setShowEditForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}