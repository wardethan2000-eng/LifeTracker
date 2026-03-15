"use client";

import type { Project, ProjectStatus } from "@lifekeeper/types";
import { useState } from "react";

type ProjectCoreFormFieldsProps = {
  householdId: string;
  project?: Project;
  includeProjectId?: boolean;
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
  householdId,
  project,
  includeProjectId = false
}: ProjectCoreFormFieldsProps) {
  const isCreateMode = !project;
  const [selectedTemplateKey, setSelectedTemplateKey] = useState("");
  const [draft, setDraft] = useState<ProjectDraft>({
    name: project?.name ?? "",
    description: project?.description ?? "",
    status: project?.status ?? "planning",
    budgetAmount: project?.budgetAmount !== null && project?.budgetAmount !== undefined ? String(project.budgetAmount) : "",
    startDate: toDateInputValue(project?.startDate),
    targetEndDate: toDateInputValue(project?.targetEndDate),
    notes: project?.notes ?? ""
  });
  const [phaseDrafts, setPhaseDrafts] = useState<string[]>([]);

  const selectedTemplate = projectTemplates.find((template) => template.key === selectedTemplateKey);
  const serializedPhaseDrafts = JSON.stringify(
    phaseDrafts.map((phase) => phase.trim()).filter((phase) => phase.length > 0)
  );

  const updateDraft = <Field extends keyof ProjectDraft>(field: Field, value: ProjectDraft[Field]): void => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const updatePhaseDraft = (index: number, value: string): void => {
    setPhaseDrafts((current) => current.map((phase, phaseIndex) => (phaseIndex === index ? value : phase)));
  };

  const addPhaseDraft = (): void => {
    setPhaseDrafts((current) => [...current, ""]);
  };

  const removePhaseDraft = (index: number): void => {
    setPhaseDrafts((current) => current.filter((_, phaseIndex) => phaseIndex !== index));
  };

  return (
    <>
      <input type="hidden" name="householdId" value={householdId} />
      {includeProjectId && project ? <input type="hidden" name="projectId" value={project.id} /> : null}
      <input type="hidden" name="templateKey" value={selectedTemplate?.key ?? ""} />
      <input type="hidden" name="suggestedPhasesJson" value={serializedPhaseDrafts} />

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
                setSelectedTemplateKey(key);
                const tpl = projectTemplates.find((t) => t.key === key);
                if (tpl) {
                  setDraft((current) => ({
                    ...current,
                    status: tpl.status,
                    description: tpl.scopeSummary,
                    notes: tpl.executionNotes
                  }));
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
            <input id="project-name" name="name" value={draft.name} onChange={(event) => updateDraft("name", event.target.value)} placeholder="Kitchen refresh, roof replacement, spring maintenance" required />
          </label>
          <label className="field">
            <span>Status</span>
            <select id="project-status" name="status" value={draft.status} onChange={(event) => updateDraft("status", event.target.value as ProjectStatus)}>
              {projectStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="field field--full">
            <span>Description</span>
            <textarea
              id="project-description"
              name="description"
              rows={3}
              value={draft.description}
              onChange={(event) => updateDraft("description", event.target.value)}
              placeholder="Scope, intent, or expected outcome"
            />
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
            <input id="project-budget" name="budgetAmount" type="number" min="0" step="0.01" value={draft.budgetAmount} onChange={(event) => updateDraft("budgetAmount", event.target.value)} placeholder="0.00" />
          </label>
          <label className="field">
            <span>Start Date</span>
            <input id="project-start-date" name="startDate" type="date" value={draft.startDate} onChange={(event) => updateDraft("startDate", event.target.value)} />
          </label>
          <label className="field">
            <span>Target End Date</span>
            <input id="project-target-end-date" name="targetEndDate" type="date" value={draft.targetEndDate} onChange={(event) => updateDraft("targetEndDate", event.target.value)} />
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
              name="notes"
              rows={4}
              value={draft.notes}
              onChange={(event) => updateDraft("notes", event.target.value)}
              placeholder="Dependencies, purchase plans, constraints, vendor notes"
            />
          </label>
        </div>
      </section>
    </>
  );
}