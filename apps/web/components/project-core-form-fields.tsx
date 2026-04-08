"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Project, ProjectStatus } from "@aegis/types";
import Link from "next/link";
import type { JSX } from "react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  isSeededProjectBlueprint,
  projectBlueprints,
  summarizeProjectBlueprint
} from "../lib/project-blueprints";
import {
  projectFormSchema,
  type ProjectFormValues,
  type ProjectResolvedValues
} from "../lib/validation/forms";
import { InlineError } from "./inline-error";

type ProjectCoreFormFieldsProps = {
  action: (formData: FormData) => Promise<void>;
  householdId: string;
  project?: Project;
  submitLabel: string;
  cancelHref?: string;
  parentProjectId?: string;
};

const projectStatusOptions = [
  { value: "planning", label: "Planning" },
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" }
] as const;

type ProjectDraft = {
  name: string;
  description: string;
  status: ProjectStatus;
  budgetAmount: string;
  startDate: string;
  targetEndDate: string;
  notes: string;
};

const toDateInputValue = (value: string | null | undefined): string => value ? value.slice(0, 10) : "";

export function ProjectCoreFormFields({
  action,
  householdId,
  project,
  submitLabel,
  cancelHref,
  parentProjectId,
}: ProjectCoreFormFieldsProps): JSX.Element {
  const isCreateMode = !project;
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm<ProjectFormValues, unknown, ProjectResolvedValues>({
    resolver: zodResolver(projectFormSchema),
    mode: "onBlur",
    reValidateMode: "onBlur",
    defaultValues: {
      name: project?.name ?? "",
      description: project?.description ?? "",
      status: project?.status ?? "planning",
      budgetAmount: project?.budgetAmount !== null && project?.budgetAmount !== undefined ? String(project.budgetAmount) : "",
      startDate: toDateInputValue(project?.startDate),
      targetEndDate: toDateInputValue(project?.targetEndDate),
      notes: project?.notes ?? "",
      parentProjectId: parentProjectId ?? project?.parentProjectId ?? "",
      suggestedPhasesJson: "[]",
      templateKey: ""
    }
  });
  const [phaseDrafts, setPhaseDrafts] = useState<string[]>([]);

  const selectedTemplateKey = watch("templateKey") ?? "";
  const selectedTemplate = projectBlueprints.find((template) => template.key === selectedTemplateKey);
  const selectedTemplateSummary = selectedTemplate ? summarizeProjectBlueprint(selectedTemplate) : null;
  const isSeededTemplate = isSeededProjectBlueprint(selectedTemplate);
  const blueprintsByFamily = projectBlueprints.reduce<Record<string, typeof projectBlueprints>>((groups, blueprint) => {
    const current = groups[blueprint.family] ?? [];
    current.push(blueprint);
    groups[blueprint.family] = current;
    return groups;
  }, {});
  const name = watch("name") ?? "";
  const description = watch("description") ?? "";
  const status = watch("status") ?? "planning";
  const budgetAmount = watch("budgetAmount") ?? "";
  const startDate = watch("startDate") ?? "";
  const targetEndDate = watch("targetEndDate") ?? "";
  const notes = watch("notes") ?? "";
  const serializedPhaseDrafts = JSON.stringify(
    phaseDrafts.map((phase) => phase.trim()).filter((phase) => phase.length > 0)
  );

  const updatePhaseDraft = (index: number, value: string): void => {
    setPhaseDrafts((current) => current.map((phase, phaseIndex) => (phaseIndex === index ? value : phase)));
  };

  const addPhaseDraft = (): void => {
    setPhaseDrafts((current) => [...current, ""]);
  };

  const removePhaseDraft = (index: number): void => {
    setPhaseDrafts((current) => current.filter((_, phaseIndex) => phaseIndex !== index));
  };

  const submitForm = handleSubmit(async (values) => {
    const formData = new FormData();
    formData.set("householdId", householdId);
    formData.set("name", values.name);
    formData.set("status", values.status);
    formData.set("suggestedPhasesJson", serializedPhaseDrafts);
    formData.set("templateKey", selectedTemplateKey);

    if (project) {
      formData.set("projectId", project.id);
    }

    if (values.description) {
      formData.set("description", values.description);
    }

    if (values.startDate) {
      formData.set("startDate", values.startDate);
    }

    if (values.targetEndDate) {
      formData.set("targetEndDate", values.targetEndDate);
    }

    if (values.budgetAmount !== undefined) {
      formData.set("budgetAmount", String(values.budgetAmount));
    }

    if (values.notes) {
      formData.set("notes", values.notes);
    }

    if (values.parentProjectId) {
      formData.set("parentProjectId", values.parentProjectId);
    }

    await action(formData);
  });

  return (
    <form className="workbench-form" noValidate onSubmit={submitForm}>
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" value={selectedTemplate?.key ?? ""} {...register("templateKey")} />
      <input type="hidden" value={serializedPhaseDrafts} {...register("suggestedPhasesJson")} />
      <input type="hidden" value={parentProjectId ?? project?.parentProjectId ?? ""} {...register("parentProjectId")} />

      <section className="workbench-section">
        <div className="workbench-section__head">
          <h3>Blueprint</h3>
        </div>
        <div className="project-blueprint-layout">
          <label className="field">
            <span>Start from a template</span>
            <select
              value={selectedTemplateKey}
              onChange={(event) => {
                const key = event.target.value;
                setValue("templateKey", key, { shouldDirty: true, shouldValidate: true });
                const tpl = projectBlueprints.find((t) => t.key === key);
                if (tpl) {
                  setValue("status", tpl.status, { shouldDirty: true, shouldValidate: true });
                  setValue("description", tpl.scopeSummary, { shouldDirty: true, shouldValidate: true });
                  setValue("notes", tpl.executionNotes, { shouldDirty: true, shouldValidate: true });
                  if (isCreateMode) {
                    setPhaseDrafts(tpl.kind === "manual" ? [...tpl.suggestedPhases] : []);
                  }
                } else if (isCreateMode) {
                  setPhaseDrafts([]);
                }
              }}
            >
              <option value="">None (blank project)</option>
              {Object.entries(blueprintsByFamily).map(([family, templates]) => (
                <optgroup key={family} label={family}>
                  {templates.map((template) => (
                    <option key={template.key} value={template.key}>{template.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          {selectedTemplate && (
            <div className="project-template-summary">
              <span>{selectedTemplate.family}</span>
              <strong>{selectedTemplate.label}</strong>
              <p>{selectedTemplate.description}</p>
              <div className="project-template-summary__stats">
                <span>{selectedTemplateSummary?.phaseCount ?? 0} phases</span>
                <span>{selectedTemplateSummary?.taskCount ?? 0} tasks</span>
                <span>{selectedTemplateSummary?.budgetCategoryCount ?? 0} budget buckets</span>
                <span>{selectedTemplateSummary?.supplyCount ?? 0} supply lines</span>
              </div>
              <p>{selectedTemplate.scopeSummary}</p>
              <div className="project-template-summary__chips">
                {selectedTemplate.featuredTools.map((tool) => <span key={tool}>{tool}</span>)}
              </div>
              <details>
                <summary>Suggested phases ({selectedTemplate.suggestedPhases.length})</summary>
                <ol>
                  {selectedTemplate.suggestedPhases.map((phase) => <li key={phase}>{phase}</li>)}
                </ol>
              </details>
              <details>
                <summary>Venue and experience focus</summary>
                <ul>
                  {selectedTemplate.venueFocus.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </details>
              <details>
                <summary>Ideas and inspiration prompts</summary>
                <ul>
                  {selectedTemplate.inspirationPrompts.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </details>
            </div>
          )}
        </div>
        {isCreateMode && !isSeededTemplate && (
          <div className="project-phase-drafts">
            <div className="workbench-section__head">
              <h3>Initial Phases</h3>
              <button type="button" className="button button--ghost button--xs" onClick={addPhaseDraft}>Add Phase</button>
            </div>
            <p className="project-phase-drafts__hint">
              Define the starting phases for this project now. Template suggestions can be edited before the project is created.
            </p>
            {phaseDrafts.length > 0 ? (
              <div className="project-phase-drafts__list">
                {phaseDrafts.map((phase, index) => (
                  <div key={`phase-draft-${index}`} className="project-phase-drafts__row">
                    <label className="field">
                      <span>Phase {index + 1}</span>
                      <input
                        value={phase}
                        onChange={(event) => updatePhaseDraft(index, event.target.value)}
                        placeholder="Planning, procurement, execution"
                      />
                    </label>
                    <button
                      type="button"
                      className="button button--ghost button--xs"
                      onClick={() => removePhaseDraft(index)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="project-phase-drafts__empty">
                No phases added yet. Start blank or add the first phase now.
              </div>
            )}
          </div>
        )}
        {isCreateMode && isSeededTemplate && selectedTemplateSummary && (
          <div className="project-seeded-summary">
            <div className="workbench-section__head">
              <h3>Seeded Project Structure</h3>
            </div>
            <p className="project-phase-drafts__hint">
              This blueprint creates the project structure automatically when you save it, including phases, tasks, budget buckets, notes, and supply lists.
            </p>
            <div className="project-seeded-summary__grid">
              <div><strong>{selectedTemplateSummary.phaseCount}</strong><span>Phases</span></div>
              <div><strong>{selectedTemplateSummary.taskCount}</strong><span>Tasks</span></div>
              <div><strong>{selectedTemplateSummary.noteCount}</strong><span>Planning notes</span></div>
              <div><strong>{selectedTemplateSummary.supplyCount}</strong><span>Supply lines</span></div>
              <div><strong>{selectedTemplateSummary.budgetCategoryCount}</strong><span>Budget buckets</span></div>
            </div>
          </div>
        )}
      </section>

      <section className="workbench-section">
        <div className="workbench-section__head">
          <h3>Core Identity</h3>
        </div>
        <div className="workbench-grid">
          <label className="field field--full">
            <span>Project Name</span>
            <input id="project-name" placeholder="Kitchen refresh, roof replacement, spring maintenance" {...register("name")} />
            <InlineError message={errors.name?.message} size="sm" />
          </label>
          <label className="field">
            <span>Status</span>
            <select id="project-status" {...register("status")}>
              {projectStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <InlineError message={errors.status?.message} size="sm" />
          </label>
          <label className="field field--full">
            <span>Description</span>
            <textarea
              id="project-description"
              rows={3}
              placeholder="Scope, intent, or expected outcome"
              {...register("description")}
            />
            <InlineError message={errors.description?.message} size="sm" />
          </label>
        </div>
      </section>

      <section className="workbench-section">
        <div className="workbench-section__head">
          <h3>Budget & Timeline</h3>
        </div>
        <div className="workbench-grid">
          <label className="field">
            <span>Budget</span>
            <input id="project-budget" type="number" step="0.01" placeholder="0.00" {...register("budgetAmount")} />
            <InlineError message={errors.budgetAmount?.message} size="sm" />
          </label>
          <label className="field">
            <span>Start Date</span>
            <input id="project-start-date" type="date" {...register("startDate")} />
            <InlineError message={errors.startDate?.message} size="sm" />
          </label>
          <label className="field">
            <span>Target End Date</span>
            <input id="project-target-end-date" type="date" {...register("targetEndDate")} />
            <InlineError message={errors.targetEndDate?.message} size="sm" />
          </label>
        </div>
      </section>

      <section className="workbench-section">
        <div className="workbench-section__head">
          <h3>Execution Notes</h3>
        </div>
        <div className="workbench-grid">
          <label className="field field--full">
            <span>Notes</span>
            <textarea
              id="project-notes"
              rows={4}
              placeholder="Dependencies, purchase plans, constraints, vendor notes"
              {...register("notes")}
            />
            <InlineError message={errors.notes?.message} size="sm" />
          </label>
        </div>
      </section>

      <div className="workbench-bar">
        {cancelHref ? <Link href={cancelHref} className="button button--ghost">Cancel</Link> : null}
        <button type="submit" className="button button--primary" disabled={isSubmitting || !name.trim()}>
          {isSubmitting ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}