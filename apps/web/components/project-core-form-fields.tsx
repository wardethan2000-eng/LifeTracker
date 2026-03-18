"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Project, ProjectStatus } from "@lifekeeper/types";
import Link from "next/link";
import type { JSX } from "react";
import { useState } from "react";
import { useForm } from "react-hook-form";
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

type ProjectTemplate = {
  key: string;
  label: string;
  description: string;
  status: ProjectStatus;
  scopeSummary: string;
  executionNotes: string;
  checklist: string[];
  suggestedPhases: string[];
};

export const projectTemplates: ProjectTemplate[] = [
  {
    key: "renovation",
    label: "Renovation / Improvement",
    description: "For upgrades, remodels, replacements, or larger multi-step improvements tied to a room, building, or system.",
    status: "planning",
    scopeSummary: "Define the area being improved, the target outcome, and any structural, finish, or contractor dependencies.",
    executionNotes: "Capture bid comparisons, permit constraints, lead-time items, finish selections, and any sequencing dependencies across trades.",
    checklist: ["Link affected assets or spaces", "Add procurement-driven inventory lines", "Track outside vendor quotes"],
    suggestedPhases: ["Planning & Permitting", "Demolition & Prep", "Rough-In Work", "Finish Work", "Punch List & Closeout"]
  },
  {
    key: "seasonal-maintenance",
    label: "Seasonal Maintenance Push",
    description: "For household-wide preventive maintenance campaigns that happen on a schedule or before a season change.",
    status: "planning",
    scopeSummary: "Bundle the recurring work to prepare equipment, property systems, or vehicles for the next operating season.",
    executionNotes: "Call out consumables, inspection checkpoints, weather windows, and the list of systems that must be closed out before completion.",
    checklist: ["Break work into repeatable tasks", "Reserve common consumables", "Use due dates to pace completion"],
    suggestedPhases: ["Inspection & Assessment", "Parts & Supplies Procurement", "Execution", "Verification & Storage"]
  },
  {
    key: "repair-response",
    label: "Repair / Recovery",
    description: "For corrective work responding to a breakdown, failure, inspection finding, or urgent issue.",
    status: "active",
    scopeSummary: "Describe the fault, the impact, and the definition of done needed to return the asset or system to service.",
    executionNotes: "Track diagnostic findings, temporary mitigations, parts on order, and any safety or downtime considerations until the repair is closed.",
    checklist: ["Document the failure clearly", "Track spent vs estimate closely", "Flag missing parts immediately"],
    suggestedPhases: ["Diagnosis & Scoping", "Parts Procurement", "Repair Execution", "Testing & Verification"]
  },
  {
    key: "equipment-upgrade",
    label: "Equipment Upgrade",
    description: "For modernization work where hardware, tools, or systems are being replaced or expanded.",
    status: "planning",
    scopeSummary: "Outline what is being upgraded, what capability is changing, and what installation or commissioning steps are required.",
    executionNotes: "Include compatibility checks, retirement or transfer plans for old equipment, and the validation steps needed before cutover.",
    checklist: ["Link old and new assets", "Stage install materials", "Plan testing or commissioning"],
    suggestedPhases: ["Research & Selection", "Procurement & Delivery", "Installation & Configuration", "Commissioning & Validation"]
  },
  {
    key: "vendor-coordination",
    label: "Vendor / Service Coordination",
    description: "For projects centered on outside providers, quotes, scheduling windows, and tracked service spend.",
    status: "planning",
    scopeSummary: "Summarize the contracted scope, the service window, and the external deliverables expected from the provider.",
    executionNotes: "Store provider notes, approval checkpoints, warranty follow-up, and any household prep needed before the vendor arrives.",
    checklist: ["Assign the primary provider", "Track quoted and actual costs", "Capture follow-up and warranty notes"],
    suggestedPhases: ["Scope Definition & Quotes", "Vendor Selection & Scheduling", "Execution & Supervision", "Inspection & Acceptance"]
  }
];

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
  const selectedTemplate = projectTemplates.find((template) => template.key === selectedTemplateKey);
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
                const tpl = projectTemplates.find((t) => t.key === key);
                if (tpl) {
                  setValue("status", tpl.status, { shouldDirty: true, shouldValidate: true });
                  setValue("description", tpl.scopeSummary, { shouldDirty: true, shouldValidate: true });
                  setValue("notes", tpl.executionNotes, { shouldDirty: true, shouldValidate: true });
                  if (isCreateMode) {
                    setPhaseDrafts([...tpl.suggestedPhases]);
                  }
                }
              }}
            >
              <option value="">None (blank project)</option>
              {projectTemplates.map((template) => (
                <option key={template.key} value={template.key}>{template.label}</option>
              ))}
            </select>
          </label>
          {selectedTemplate && (
            <div className="project-template-summary">
              <span>About this template</span>
              <p>{selectedTemplate.description}</p>
              <details>
                <summary>Suggested phases ({selectedTemplate.suggestedPhases.length})</summary>
                <ol>
                  {selectedTemplate.suggestedPhases.map((phase) => <li key={phase}>{phase}</li>)}
                </ol>
              </details>
            </div>
          )}
        </div>
        {isCreateMode && (
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