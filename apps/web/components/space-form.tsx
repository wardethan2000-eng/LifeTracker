"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { SpaceResponse } from "@lifekeeper/types";
import type { JSX } from "react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { createSpace, updateSpace } from "../app/actions";
import { flattenSpaceOptions, getSpaceTypeLabel, spaceTypeLabels } from "../lib/spaces";
import {
  spaceFormSchema,
  type SpaceFormResolvedValues,
  type SpaceFormValues
} from "../lib/validation/forms";
import { InlineError } from "./inline-error";

type SpaceFormProps = {
  householdId: string;
  spaces: SpaceResponse[];
  initialSpace?: SpaceResponse;
  initialParentSpaceId?: string | null;
  onSaved?: () => void;
  onCancel?: () => void;
};

const collectDescendantIds = (space: SpaceResponse): Set<string> => {
  const ids = new Set<string>();
  const walk = (node: SpaceResponse) => {
    ids.add(node.id);

    for (const child of node.children ?? []) {
      walk(child);
    }
  };

  walk(space);
  return ids;
};

export function SpaceForm({ householdId, spaces, initialSpace, initialParentSpaceId, onSaved, onCancel }: SpaceFormProps): JSX.Element {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const disallowedIds = useMemo(() => initialSpace ? collectDescendantIds(initialSpace) : new Set<string>(), [initialSpace]);
  const options = useMemo(() => flattenSpaceOptions(spaces).filter((option) => !disallowedIds.has(option.id)), [disallowedIds, spaces]);
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<SpaceFormValues, unknown, SpaceFormResolvedValues>({
    resolver: zodResolver(spaceFormSchema),
    mode: "onBlur",
    reValidateMode: "onBlur",
    defaultValues: {
      name: initialSpace?.name ?? "",
      type: initialSpace?.type ?? "room",
      parentSpaceId: initialSpace?.parentSpaceId ?? initialParentSpaceId ?? "",
      description: initialSpace?.description ?? "",
      notes: initialSpace?.notes ?? ""
    }
  });

  const onSubmit = handleSubmit(async (values) => {
    setSaving(true);
    setError(null);

    try {
      if (initialSpace) {
        await updateSpace(householdId, initialSpace.id, {
          name: values.name,
          type: values.type,
          parentSpaceId: values.parentSpaceId || null,
          description: values.description ?? null,
          notes: values.notes ?? null,
        });
      } else {
        await createSpace(householdId, {
          name: values.name,
          type: values.type,
          ...(values.parentSpaceId ? { parentSpaceId: values.parentSpaceId } : {}),
          ...(values.description ? { description: values.description } : {}),
          ...(values.notes ? { notes: values.notes } : {}),
        });
      }

      onSaved?.();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Failed to save the space.");
    } finally {
      setSaving(false);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="form-grid">
      <label className={`field field--full${errors.name ? " field--error" : ""}`}>
        <span>Name</span>
        <input type="text" {...register("name")} />
        <InlineError message={errors.name?.message} size="sm" />
      </label>
      <label className={`field${errors.type ? " field--error" : ""}`}>
        <span>Type</span>
        <select {...register("type")}>
          {Object.entries(spaceTypeLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <InlineError message={errors.type?.message} size="sm" />
      </label>
      <label className={`field${errors.parentSpaceId ? " field--error" : ""}`}>
        <span>Parent Space</span>
        <select {...register("parentSpaceId")}>
          <option value="">Root level</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {`${"— ".repeat(option.depth)}${option.space.name} (${getSpaceTypeLabel(option.space.type)})`}
            </option>
          ))}
        </select>
        <InlineError message={errors.parentSpaceId?.message} size="sm" />
      </label>
      <label className={`field field--full${errors.description ? " field--error" : ""}`}>
        <span>Description</span>
        <textarea rows={3} {...register("description")} />
        <InlineError message={errors.description?.message} size="sm" />
      </label>
      <label className={`field field--full${errors.notes ? " field--error" : ""}`}>
        <span>Notes</span>
        <textarea rows={4} {...register("notes")} />
        <InlineError message={errors.notes?.message} size="sm" />
      </label>
      <InlineError message={error} className="field field--full" size="sm" />
      <div className="inline-actions inline-actions--end field field--full">
        {onCancel ? <button type="button" className="button button--ghost" onClick={onCancel} disabled={saving}>Cancel</button> : null}
        <button type="submit" className="button button--primary" disabled={saving}>{saving ? "Saving…" : initialSpace ? "Save Space" : "Create Space"}</button>
      </div>
    </form>
  );
}