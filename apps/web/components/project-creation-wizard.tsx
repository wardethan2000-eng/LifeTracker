"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { ProjectStatus, ProjectTemplateList } from "@aegis/types";
import Link from "next/link";
import type { JSX } from "react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import {
  isSeededProjectBlueprint,
  projectBlueprints,
  summarizeProjectBlueprint,
} from "../lib/project-blueprints";
import {
  projectFormSchema,
  type ProjectFormValues,
  type ProjectResolvedValues,
} from "../lib/validation/forms";
import { InlineError } from "./inline-error";

type ProjectCreationWizardProps = {
  createAction: (formData: FormData) => Promise<void>;
  createFromTemplateAction: (formData: FormData) => Promise<void>;
  householdId: string;
  projectTemplates: ProjectTemplateList;
  cancelHref: string;
  parentProjectId?: string;
  parentProjectName?: string | null;
};

type ProjectStartMode = "blank" | "blueprint" | "saved-template";
type WizardStep = 1 | 2 | 3;

const projectStatusOptions: Array<{ value: ProjectStatus; label: string }> = [
  { value: "planning", label: "Planning" },
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const toDateInputValue = (value: string | null | undefined): string => (value ? value.slice(0, 10) : "");

export function ProjectCreationWizard({
  createAction,
  createFromTemplateAction,
  householdId,
  projectTemplates,
  cancelHref,
  parentProjectId,
  parentProjectName,
}: ProjectCreationWizardProps): JSX.Element {
  const [step, setStep] = useState<WizardStep>(1);
  const [startMode, setStartMode] = useState<ProjectStartMode>("blank");
  const [phaseDrafts, setPhaseDrafts] = useState<string[]>([]);
  const [selectedSavedTemplateId, setSelectedSavedTemplateId] = useState<string>("");
  const [wizardError, setWizardError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    trigger,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ProjectFormValues, unknown, ProjectResolvedValues>({
    resolver: zodResolver(projectFormSchema),
    mode: "onBlur",
    reValidateMode: "onBlur",
    defaultValues: {
      name: "",
      description: "",
      status: "planning",
      budgetAmount: "",
      startDate: "",
      targetEndDate: "",
      notes: "",
      parentProjectId: parentProjectId ?? "",
      suggestedPhasesJson: "[]",
      templateKey: "",
    },
  });

  const selectedBlueprintKey = watch("templateKey") ?? "";
  const selectedBlueprint = projectBlueprints.find((template) => template.key === selectedBlueprintKey);
  const selectedBlueprintSummary = selectedBlueprint ? summarizeProjectBlueprint(selectedBlueprint) : null;
  const selectedSavedTemplate = projectTemplates.find((template) => template.id === selectedSavedTemplateId) ?? null;
  const watchedStatus = watch("status");
  const watchedName = watch("name");
  const watchedDescription = watch("description");
  const watchedBudgetAmount = watch("budgetAmount");
  const watchedStartDate = watch("startDate");
  const watchedTargetEndDate = watch("targetEndDate");
  const watchedNotes = watch("notes");
  const status = watchedStatus ?? "planning";
  const name = typeof watchedName === "string" ? watchedName : "";
  const description = typeof watchedDescription === "string" ? watchedDescription : "";
  const budgetAmount = typeof watchedBudgetAmount === "string" || typeof watchedBudgetAmount === "number" ? watchedBudgetAmount : "";
  const startDate = typeof watchedStartDate === "string" ? watchedStartDate : "";
  const targetEndDate = typeof watchedTargetEndDate === "string" ? watchedTargetEndDate : "";
  const notes = typeof watchedNotes === "string" ? watchedNotes : "";
  const isSeededBlueprint = isSeededProjectBlueprint(selectedBlueprint);

  const blueprintsByFamily = useMemo(
    () => projectBlueprints.reduce<Record<string, typeof projectBlueprints>>((groups, blueprint) => {
      const current = groups[blueprint.family] ?? [];
      current.push(blueprint);
      groups[blueprint.family] = current;
      return groups;
    }, {}),
    [],
  );

  const phaseDraftsJson = JSON.stringify(
    phaseDrafts.map((phase) => phase.trim()).filter((phase) => phase.length > 0),
  );

  const syncBlueprintSelection = (key: string): void => {
    setValue("templateKey", key, { shouldDirty: true, shouldValidate: startMode === "blueprint" });
    const blueprint = projectBlueprints.find((item) => item.key === key);

    if (!blueprint) {
      setPhaseDrafts([]);
      return;
    }

    setValue("status", blueprint.status, { shouldDirty: true, shouldValidate: true });
    setValue("description", blueprint.scopeSummary, { shouldDirty: true, shouldValidate: false });
    setValue("notes", blueprint.executionNotes, { shouldDirty: true, shouldValidate: false });
    setPhaseDrafts(blueprint.kind === "manual" ? [...blueprint.suggestedPhases] : []);
  };

  const handleStartModeChange = (mode: ProjectStartMode): void => {
    setStartMode(mode);
    setWizardError(null);

    if (mode !== "blueprint") {
      setValue("templateKey", "", { shouldDirty: true, shouldValidate: false });
      setPhaseDrafts([]);
    }

    if (mode !== "saved-template") {
      setSelectedSavedTemplateId("");
    }
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

  const goToStep = async (targetStep: WizardStep): Promise<void> => {
    if (targetStep <= step) {
      setStep(targetStep);
      return;
    }

    if (step === 1) {
      if (startMode === "blueprint" && !selectedBlueprintKey) {
        setWizardError("Choose a blueprint or switch to a blank project start.");
        return;
      }

      if (startMode === "saved-template" && !selectedSavedTemplateId) {
        setWizardError("Choose a saved template before continuing.");
        return;
      }
    }

    if (step === 2) {
      const fieldsToValidate = startMode === "saved-template"
        ? ["name", "startDate", "targetEndDate"] as const
        : ["name", "description", "status"] as const;
      const isValid = await trigger(fieldsToValidate);

      if (!isValid) {
        return;
      }
    }

    setWizardError(null);
    setStep(targetStep);
  };

  const submitForm = handleSubmit(async (values) => {
    setWizardError(null);

    if (startMode === "saved-template" && !selectedSavedTemplateId) {
      setWizardError("Choose a saved template before creating the project.");
      return;
    }

    const formData = new FormData();
    formData.set("householdId", householdId);
    formData.set("name", values.name);

    if (parentProjectId) {
      formData.set("parentProjectId", parentProjectId);
    }

    if (values.startDate) {
      formData.set("startDate", values.startDate);
    }

    if (values.targetEndDate) {
      formData.set("targetEndDate", values.targetEndDate);
    }

    if (startMode === "saved-template") {
      formData.set("templateId", selectedSavedTemplateId);
      await createFromTemplateAction(formData);
      return;
    }

    formData.set("status", values.status);
    formData.set("suggestedPhasesJson", phaseDraftsJson);
    formData.set("templateKey", startMode === "blueprint" ? selectedBlueprintKey : "");

    if (values.description) {
      formData.set("description", values.description);
    }

    if (values.budgetAmount !== undefined) {
      formData.set("budgetAmount", String(values.budgetAmount));
    }

    if (values.notes) {
      formData.set("notes", values.notes);
    }

    await createAction(formData);
  });

  const stepLabels = ["Start", "Basics", "Plan & finish"] as const;
  const selectedStartLabel = startMode === "blank"
    ? "Blank project"
    : startMode === "blueprint"
      ? selectedBlueprint?.label ?? "Blueprint starter"
      : selectedSavedTemplate?.name ?? "Saved template";

  return (
    <form className="wizard project-wizard" noValidate onSubmit={submitForm}>
      <input type="hidden" value={selectedBlueprintKey} {...register("templateKey")} />
      <input type="hidden" value={phaseDraftsJson} {...register("suggestedPhasesJson")} />
      <input type="hidden" value={parentProjectId ?? ""} {...register("parentProjectId")} />

      <div className="wizard__steps" aria-label="Project creation steps">
        {([1, 2, 3] as const).map((stepNumber) => (
          <button
            key={stepNumber}
            type="button"
            className={`wizard__step${step === stepNumber ? " wizard__step--active" : ""}${step > stepNumber ? " wizard__step--done" : ""}`}
            onClick={() => { void goToStep(stepNumber); }}
            disabled={stepNumber > step}
            aria-current={step === stepNumber ? "step" : undefined}
          >
            <span className="wizard__step-num">{step > stepNumber ? "✓" : stepNumber}</span>
            <span className="wizard__step-label">{stepLabels[stepNumber - 1]}</span>
          </button>
        ))}
      </div>

      {parentProjectName ? (
        <div className="info-bar" style={{ marginBottom: 20 }}>
          <span>
            Creating a sub-project under{" "}
            <strong>{parentProjectName}</strong>.
          </span>
        </div>
      ) : null}

      {step === 1 ? (
        <section className="wizard__panel">
          <h2 className="wizard__heading">How do you want to start this project?</h2>
          <p className="wizard__subheading">
            Pick the starting point that best matches how much structure you already have.
          </p>

          <div className="wizard-tiles wizard-tiles--presets project-wizard__modes">
            <button
              type="button"
              className={`wizard-tile${startMode === "blank" ? " wizard-tile--selected" : ""}`}
              onClick={() => handleStartModeChange("blank")}
            >
              <span className="wizard-tile__label">Start blank</span>
              <span className="wizard-tile__description">Create a simple project and shape the plan yourself.</span>
            </button>
            <button
              type="button"
              className={`wizard-tile${startMode === "blueprint" ? " wizard-tile--selected" : ""}`}
              onClick={() => handleStartModeChange("blueprint")}
            >
              <span className="wizard-tile__label">Use a guided starter</span>
              <span className="wizard-tile__description">Begin from a built-in project blueprint with suggested structure.</span>
            </button>
            <button
              type="button"
              className={`wizard-tile${startMode === "saved-template" ? " wizard-tile--selected" : ""}`}
              onClick={() => handleStartModeChange("saved-template")}
            >
              <span className="wizard-tile__label">Reuse a saved template</span>
              <span className="wizard-tile__description">Clone a previously saved project template with phases and tasks included.</span>
            </button>
          </div>

          {startMode === "blueprint" ? (
            <div className="project-wizard__selector">
              <label className="field">
                <span>Starter blueprint</span>
                <select
                  value={selectedBlueprintKey}
                  onChange={(event) => syncBlueprintSelection(event.target.value)}
                >
                  <option value="">Choose a blueprint</option>
                  {Object.entries(blueprintsByFamily).map(([family, blueprints]) => (
                    <optgroup key={family} label={family}>
                      {blueprints.map((blueprint) => (
                        <option key={blueprint.key} value={blueprint.key}>{blueprint.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>

              {selectedBlueprint && selectedBlueprintSummary ? (
                <div className="project-template-summary">
                  <span>{selectedBlueprint.family}</span>
                  <strong>{selectedBlueprint.label}</strong>
                  <p>{selectedBlueprint.description}</p>
                  <div className="project-template-summary__stats">
                    <span>{selectedBlueprintSummary.phaseCount} phases</span>
                    <span>{selectedBlueprintSummary.taskCount} tasks</span>
                    <span>{selectedBlueprintSummary.budgetCategoryCount} budget buckets</span>
                    <span>{selectedBlueprintSummary.supplyCount} material groups</span>
                  </div>
                  <p>{selectedBlueprint.scopeSummary}</p>
                </div>
              ) : null}
            </div>
          ) : null}

          {startMode === "saved-template" ? (
            projectTemplates.length > 0 ? (
              <div className="wizard-tiles wizard-tiles--presets">
                {projectTemplates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    className={`wizard-tile wizard-tile--preset${selectedSavedTemplateId === template.id ? " wizard-tile--selected" : ""}`}
                    onClick={() => setSelectedSavedTemplateId(template.id)}
                  >
                    <span className="wizard-tile__label">{template.name}</span>
                    <span className="wizard-tile__meta">
                      <span>{template.phaseCount} phases</span>
                      <span>{template.taskCount} tasks</span>
                    </span>
                    {template.description ? (
                      <span className="wizard-tile__description">{template.description}</span>
                    ) : (
                      <span className="wizard-tile__description">Saved project structure ready to reuse.</span>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="project-phase-drafts__empty">
                No saved templates are available yet. Start blank or use a guided starter instead.
              </div>
            )
          ) : null}

          {wizardError ? <p className="inline-error" role="alert">{wizardError}</p> : null}

          <div className="wizard__submit-row">
            <Link href={cancelHref} className="button button--ghost">Cancel</Link>
            <button type="button" className="button button--primary" onClick={() => { void goToStep(2); }}>
              Continue
            </button>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="wizard__panel wizard__panel--submit">
          <h2 className="wizard__heading">
            {startMode === "saved-template" ? "Name the new project" : "Define the project"}
          </h2>
          <p className="wizard__subheading">
            <span className="wizard__breadcrumb">{selectedStartLabel}</span>
          </p>

          <div className="project-wizard__summary">
            <div className="project-wizard__summary-card">
              <span className="project-wizard__summary-label">Starting point</span>
              <strong>{selectedStartLabel}</strong>
              <p>
                {startMode === "saved-template"
                  ? "The template will bring in its saved phases and tasks."
                  : startMode === "blueprint"
                    ? "You can keep the suggested structure or adjust it before creating the project."
                    : "Start light, then add phases, tasks, budget, and notes as you go."}
              </p>
            </div>
          </div>

          <div className="wizard__fields">
            <label className={`field field--required${errors.name ? " field--error" : ""}`}>
              <span>Project name *</span>
              <input
                type="text"
                placeholder="Kitchen refresh, roof replacement, spring maintenance"
                autoFocus
                {...register("name")}
              />
              <InlineError message={errors.name?.message} size="sm" />
            </label>

            {startMode !== "saved-template" ? (
              <>
                <label className={`field${errors.status ? " field--error" : ""}`}>
                  <span>Status</span>
                  <select {...register("status")}>
                    {projectStatusOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <InlineError message={errors.status?.message} size="sm" />
                </label>

                <label className={`field${errors.description ? " field--error" : ""}`}>
                  <span>What is this project trying to accomplish?</span>
                  <textarea
                    rows={4}
                    placeholder="Summarize the scope, outcome, or major constraint."
                    {...register("description")}
                  />
                  <InlineError message={errors.description?.message} size="sm" />
                </label>
              </>
            ) : (
              <div className="project-phase-drafts__empty">
                You can refine the description, budget, and notes after the template is created. Right now, focus on the name and timing for this new copy.
              </div>
            )}
          </div>

          {wizardError ? <p className="inline-error" role="alert">{wizardError}</p> : null}

          <div className="wizard__submit-row">
            <button type="button" className="button button--ghost" onClick={() => { void goToStep(1); }}>
              Back
            </button>
            <button type="button" className="button button--primary" onClick={() => { void goToStep(3); }}>
              Continue
            </button>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="wizard__panel wizard__panel--submit">
          <h2 className="wizard__heading">Review the starting plan</h2>
          <p className="wizard__subheading">
            Set the initial timeline and any planning details you want ready on day one.
          </p>

          <div className="project-wizard__summary">
            <div className="project-wizard__summary-card">
              <span className="project-wizard__summary-label">Project</span>
              <strong>{name.trim() || "Untitled project"}</strong>
              <p>{description.trim() || "No scope summary added yet."}</p>
            </div>
            {startMode !== "saved-template" ? (
              <div className="project-wizard__summary-card">
                <span className="project-wizard__summary-label">Initial status</span>
                <strong>{projectStatusOptions.find((option) => option.value === status)?.label ?? status}</strong>
                <p>
                  {startMode === "blueprint"
                    ? "The blueprint will prefill planning structure for you."
                    : "You are creating a project without a predefined structure."}
                </p>
              </div>
            ) : (
              <div className="project-wizard__summary-card">
                <span className="project-wizard__summary-label">Saved template</span>
                <strong>{selectedSavedTemplate?.name ?? "No template selected"}</strong>
                <p>Phases and tasks will be copied from the saved template when this project is created.</p>
              </div>
            )}
          </div>

          {startMode === "blueprint" && selectedBlueprint && selectedBlueprintSummary ? (
            isSeededBlueprint ? (
              <div className="project-seeded-summary">
                <div className="workbench-section__head">
                  <h3>What this starter will create</h3>
                </div>
                <div className="project-seeded-summary__grid">
                  <div><strong>{selectedBlueprintSummary.phaseCount}</strong><span>Phases</span></div>
                  <div><strong>{selectedBlueprintSummary.taskCount}</strong><span>Tasks</span></div>
                  <div><strong>{selectedBlueprintSummary.noteCount}</strong><span>Planning notes</span></div>
                  <div><strong>{selectedBlueprintSummary.supplyCount}</strong><span>Material groups</span></div>
                  <div><strong>{selectedBlueprintSummary.budgetCategoryCount}</strong><span>Budget buckets</span></div>
                </div>
              </div>
            ) : (
              <div className="project-phase-drafts">
                <div className="workbench-section__head">
                  <h3>Starting phases</h3>
                  <button type="button" className="button button--ghost button--xs" onClick={addPhaseDraft}>Add Phase</button>
                </div>
                <p className="project-phase-drafts__hint">
                  Adjust the starter phases now so the project opens with the right structure.
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
                        <button type="button" className="button button--ghost button--xs" onClick={() => removePhaseDraft(index)}>
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="project-phase-drafts__empty">
                    No phases added yet. Add a first phase now or start with an empty structure.
                  </div>
                )}
              </div>
            )
          ) : null}

          {startMode === "blank" ? (
            <div className="project-phase-drafts">
              <div className="workbench-section__head">
                <h3>Starting phases</h3>
                <button type="button" className="button button--ghost button--xs" onClick={addPhaseDraft}>Add Phase</button>
              </div>
              <p className="project-phase-drafts__hint">
                Optional. Add the first phases now if you already know the shape of the work.
              </p>
              {phaseDrafts.length > 0 ? (
                <div className="project-phase-drafts__list">
                  {phaseDrafts.map((phase, index) => (
                    <div key={`blank-phase-draft-${index}`} className="project-phase-drafts__row">
                      <label className="field">
                        <span>Phase {index + 1}</span>
                        <input
                          value={phase}
                          onChange={(event) => updatePhaseDraft(index, event.target.value)}
                          placeholder="Planning, procurement, execution"
                        />
                      </label>
                      <button type="button" className="button button--ghost button--xs" onClick={() => removePhaseDraft(index)}>
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="project-phase-drafts__empty">
                  No phases added yet. You can add them later from the project plan.
                </div>
              )}
            </div>
          ) : null}

          <div className="wizard__fields">
            <label className={`field${errors.startDate ? " field--error" : ""}`}>
              <span>Start date</span>
              <input type="date" defaultValue={toDateInputValue(startDate)} {...register("startDate")} />
              <InlineError message={errors.startDate?.message} size="sm" />
            </label>
            <label className={`field${errors.targetEndDate ? " field--error" : ""}`}>
              <span>Target end date</span>
              <input type="date" defaultValue={toDateInputValue(targetEndDate)} {...register("targetEndDate")} />
              <InlineError message={errors.targetEndDate?.message} size="sm" />
            </label>

            {startMode !== "saved-template" ? (
              <>
                <label className={`field${errors.budgetAmount ? " field--error" : ""}`}>
                  <span>Budget</span>
                  <input type="number" step="0.01" placeholder="0.00" {...register("budgetAmount")} />
                  <InlineError message={errors.budgetAmount?.message} size="sm" />
                </label>
                <label className={`field${errors.notes ? " field--error" : ""}`}>
                  <span>Planning notes</span>
                  <textarea
                    rows={4}
                    placeholder="Dependencies, purchase plans, vendor notes, or constraints."
                    {...register("notes")}
                  />
                  <InlineError message={errors.notes?.message} size="sm" />
                </label>
              </>
            ) : null}
          </div>

          {wizardError ? <p className="inline-error" role="alert">{wizardError}</p> : null}

          <div className="wizard__submit-row">
            <button type="button" className="button button--ghost" onClick={() => { void goToStep(2); }}>
              Back
            </button>
            <button type="submit" className="button button--primary" disabled={isSubmitting || !name.trim()}>
              {isSubmitting
                ? "Creating…"
                : startMode === "saved-template"
                  ? "Create From Template"
                  : "Create Project"}
            </button>
          </div>
        </section>
      ) : null}
    </form>
  );
}
