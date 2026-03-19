"use client";

import type {
  CustomFieldTemplateType,
  HobbyDetail,
  HobbyPreset,
  HobbyWorkflowChecklistTemplate,
  HobbyWorkflowSupplyTemplate,
  PresetCustomFieldTemplate,
} from "@lifekeeper/types";
import type { JSX } from "react";

export type WorkflowStageDraft = {
  id?: string;
  label: string;
  description: string;
  instructions: string;
  futureNotes: string;
  color: string;
  isFinal: boolean;
  fieldDefinitions: PresetCustomFieldTemplate[];
  checklistTemplates: HobbyWorkflowChecklistTemplate[];
  supplyTemplates: HobbyWorkflowSupplyTemplate[];
};

type HobbyWorkflowStageEditorProps = {
  stages: WorkflowStageDraft[];
  inventoryLinks: HobbyDetail["inventoryLinks"];
  onChange: (stages: WorkflowStageDraft[]) => void;
};

const fieldTypeOptions: CustomFieldTemplateType[] = [
  "string",
  "number",
  "boolean",
  "date",
  "select",
  "multiselect",
  "textarea",
  "url",
  "currency",
];

const buildFieldKey = (label: string, existingKeys: string[]): string => {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "stage-field";

  if (!existingKeys.includes(base)) {
    return base;
  }

  let suffix = 2;
  while (existingKeys.includes(`${base}-${suffix}`)) {
    suffix += 1;
  }

  return `${base}-${suffix}`;
};

export const defaultWorkflowStages = (): WorkflowStageDraft[] => [
  {
    label: "In Progress",
    description: "Primary execution stage for this hobby session.",
    instructions: "Capture the core work, mark the checklist as you go, and log the important measurements before moving on.",
    futureNotes: "Note what would make this stage smoother next time.",
    color: "#0f766e",
    isFinal: false,
    fieldDefinitions: [],
    checklistTemplates: [],
    supplyTemplates: [],
  },
  {
    label: "Completed",
    description: "Closeout and wrap-up stage.",
    instructions: "Confirm the work is actually done, capture outcome notes, and record any final readings or packaging details.",
    futureNotes: "What should be repeated or avoided the next time this hobby reaches completion?",
    color: "#14532d",
    isFinal: true,
    fieldDefinitions: [],
    checklistTemplates: [],
    supplyTemplates: [],
  },
];

export const toWorkflowStageDrafts = (
  pipeline: HobbyDetail["statusPipeline"] | HobbyPreset["pipelineSteps"] | undefined
): WorkflowStageDraft[] => {
  if (!pipeline || pipeline.length === 0) {
    return [];
  }

  return [...pipeline]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((stage) => ({
      ...("id" in stage ? { id: stage.id } : {}),
      label: stage.label,
      description: stage.description ?? "",
      instructions: stage.instructions ?? "",
      futureNotes: stage.futureNotes ?? "",
      color: stage.color ?? "",
      isFinal: stage.isFinal,
      fieldDefinitions: [...(stage.fieldDefinitions ?? [])],
      checklistTemplates: [...(stage.checklistTemplates ?? [])].sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0)),
      supplyTemplates: [...(stage.supplyTemplates ?? [])].sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0)),
    }));
};

export function HobbyWorkflowStageEditor({ stages, inventoryLinks, onChange }: HobbyWorkflowStageEditorProps): JSX.Element {
  const updateStage = (index: number, patch: Partial<WorkflowStageDraft>) => {
    onChange(stages.map((stage, stageIndex) => {
      if (stageIndex !== index) {
        return patch.isFinal ? { ...stage, isFinal: false } : stage;
      }

      return { ...stage, ...patch };
    }));
  };

  const moveStage = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= stages.length) {
      return;
    }

    const next = [...stages];
    const stage = next[index];
    if (!stage) {
      return;
    }

    next.splice(index, 1);
    next.splice(nextIndex, 0, stage);
    onChange(next);
  };

  const addStage = () => {
    const next = [
      ...stages,
      {
        label: `Stage ${stages.length + 1}`,
        description: "",
        instructions: "",
        futureNotes: "",
        color: "",
        isFinal: stages.length === 0,
        fieldDefinitions: [],
        checklistTemplates: [],
        supplyTemplates: [],
      },
    ];

    if (!next.some((stage) => stage.isFinal)) {
      const last = next[next.length - 1];
      if (last) {
        last.isFinal = true;
      }
    }

    onChange(next);
  };

  const removeStage = (index: number) => {
    const next = stages.filter((_, stageIndex) => stageIndex !== index);
    if (next.length > 0 && !next.some((stage) => stage.isFinal)) {
      const last = next[next.length - 1];
      if (last) {
        last.isFinal = true;
      }
    }
    onChange(next);
  };

  const addChecklistItem = (stageIndex: number) => {
    updateStage(stageIndex, {
      checklistTemplates: [
        ...stages[stageIndex]!.checklistTemplates,
        { title: "", sortOrder: stages[stageIndex]!.checklistTemplates.length },
      ],
    });
  };

  const updateChecklistItem = (stageIndex: number, itemIndex: number, patch: Partial<HobbyWorkflowChecklistTemplate>) => {
    updateStage(stageIndex, {
      checklistTemplates: stages[stageIndex]!.checklistTemplates.map((item, index) => index === itemIndex ? { ...item, ...patch } : item),
    });
  };

  const removeChecklistItem = (stageIndex: number, itemIndex: number) => {
    updateStage(stageIndex, {
      checklistTemplates: stages[stageIndex]!.checklistTemplates.filter((_, index) => index !== itemIndex),
    });
  };

  const addSupplyTemplate = (stageIndex: number) => {
    updateStage(stageIndex, {
      supplyTemplates: [
        ...stages[stageIndex]!.supplyTemplates,
        {
          name: "",
          quantityNeeded: 1,
          unit: "unit",
          isRequired: true,
          sortOrder: stages[stageIndex]!.supplyTemplates.length,
        },
      ],
    });
  };

  const updateSupplyTemplate = (stageIndex: number, supplyIndex: number, patch: Partial<HobbyWorkflowSupplyTemplate>) => {
    updateStage(stageIndex, {
      supplyTemplates: stages[stageIndex]!.supplyTemplates.map((item, index) => index === supplyIndex ? { ...item, ...patch } : item),
    });
  };

  const removeSupplyTemplate = (stageIndex: number, supplyIndex: number) => {
    updateStage(stageIndex, {
      supplyTemplates: stages[stageIndex]!.supplyTemplates.filter((_, index) => index !== supplyIndex),
    });
  };

  const addFieldDefinition = (stageIndex: number) => {
    const existingKeys = stages[stageIndex]!.fieldDefinitions.map((field) => field.key);
    updateStage(stageIndex, {
      fieldDefinitions: [
        ...stages[stageIndex]!.fieldDefinitions,
        {
          key: buildFieldKey(`stage field ${stages[stageIndex]!.fieldDefinitions.length + 1}`, existingKeys),
          label: `Stage Field ${stages[stageIndex]!.fieldDefinitions.length + 1}`,
          type: "string",
          required: false,
          options: [],
          wide: false,
          order: stages[stageIndex]!.fieldDefinitions.length,
        },
      ],
    });
  };

  const updateFieldDefinition = (stageIndex: number, fieldIndex: number, patch: Partial<PresetCustomFieldTemplate>) => {
    const currentField = stages[stageIndex]!.fieldDefinitions[fieldIndex];
    const existingKeys = stages[stageIndex]!.fieldDefinitions
      .filter((_, index) => index !== fieldIndex)
      .map((field) => field.key);
    const nextLabel = patch.label ?? currentField?.label ?? "Field";

    updateStage(stageIndex, {
      fieldDefinitions: stages[stageIndex]!.fieldDefinitions.map((field, index) => {
        if (index !== fieldIndex) {
          return field;
        }

        const nextType = patch.type ?? field.type;
        return {
          ...field,
          ...patch,
          key: (patch.key ?? field.key) || buildFieldKey(nextLabel, existingKeys),
          options: nextType === "select" || nextType === "multiselect"
            ? (patch.options ?? field.options ?? [])
            : [],
        };
      }),
    });
  };

  const removeFieldDefinition = (stageIndex: number, fieldIndex: number) => {
    updateStage(stageIndex, {
      fieldDefinitions: stages[stageIndex]!.fieldDefinitions.filter((_, index) => index !== fieldIndex),
    });
  };

  return (
    <section className="workbench-section" id="pipeline-workflow">
      <div className="workbench-section__head">
        <div>
          <h3>Workflow Stages</h3>
          <p className="workbench-section__hint">
            Define each stage like a lightweight phase: what happens here, what needs to be tracked, what materials are needed, and what a future run should remember.
          </p>
        </div>
        <button type="button" className="button button--ghost button--sm" onClick={addStage}>
          + Add Stage
        </button>
      </div>

      {stages.length === 0 ? (
        <div className="workbench-details">
          <p className="panel__empty">No workflow stages defined yet. Add at least one stage so sessions have meaningful progress and stage workspaces.</p>
        </div>
      ) : null}

      <div className="schedule-stack">
        {stages.map((stage, stageIndex) => (
          <article key={stage.id ?? `${stage.label}-${stageIndex}`} className="schedule-card hobby-stage-editor-card">
            <div className="hobby-stage-editor-card__header">
              <div>
                <strong>{stage.label.trim() || `Stage ${stageIndex + 1}`}</strong>
                <p className="workbench-section__hint">Sessions enter this stage in order and use its checklist, supply template, and logging fields.</p>
              </div>
              <div className="hobby-pipeline-table__actions">
                {stage.isFinal ? <span className="pill pill--muted">Final</span> : null}
                <button type="button" className="button button--ghost button--sm" onClick={() => moveStage(stageIndex, -1)} disabled={stageIndex === 0}>↑</button>
                <button type="button" className="button button--ghost button--sm" onClick={() => moveStage(stageIndex, 1)} disabled={stageIndex === stages.length - 1}>↓</button>
                <button type="button" className="button button--ghost button--sm" onClick={() => removeStage(stageIndex)}>Remove</button>
              </div>
            </div>

            <div className="workbench-grid" style={{ marginTop: "12px" }}>
              <label className="workbench-field">
                <span className="workbench-field__label">Stage Name</span>
                <input className="workbench-field__input" value={stage.label} onChange={(e) => updateStage(stageIndex, { label: e.target.value })} />
              </label>
              <label className="workbench-field">
                <span className="workbench-field__label">Color</span>
                <input className="workbench-field__input" value={stage.color} onChange={(e) => updateStage(stageIndex, { color: e.target.value })} placeholder="#0f766e" />
              </label>
              <label className="workbench-field hobby-stage-editor-card__checkbox">
                <span className="workbench-field__label">Marks Completion</span>
                <input type="checkbox" checked={stage.isFinal} onChange={(e) => updateStage(stageIndex, { isFinal: e.target.checked })} />
              </label>
              <label className="workbench-field workbench-field--wide">
                <span className="workbench-field__label">Purpose</span>
                <textarea className="workbench-field__input" rows={2} value={stage.description} onChange={(e) => updateStage(stageIndex, { description: e.target.value })} placeholder="What is this stage trying to accomplish?" />
              </label>
              <label className="workbench-field workbench-field--wide">
                <span className="workbench-field__label">Instructions</span>
                <textarea className="workbench-field__input" rows={3} value={stage.instructions} onChange={(e) => updateStage(stageIndex, { instructions: e.target.value })} placeholder="What should the user do, verify, or capture while in this stage?" />
              </label>
              <label className="workbench-field workbench-field--wide">
                <span className="workbench-field__label">Future Notes</span>
                <textarea className="workbench-field__input" rows={3} value={stage.futureNotes} onChange={(e) => updateStage(stageIndex, { futureNotes: e.target.value })} placeholder="Advice for the next run: what to repeat, avoid, prepare earlier, or watch closely." />
              </label>
            </div>

            <div className="hobby-stage-editor-grid">
              <section className="panel">
                <div className="panel__header">
                  <h4>Stage Checklist</h4>
                  <button type="button" className="button button--ghost button--sm" onClick={() => addChecklistItem(stageIndex)}>+ Item</button>
                </div>
                <div className="panel__body--padded">
                  {stage.checklistTemplates.length === 0 ? <p className="panel__empty">No default to-dos yet.</p> : null}
                  <div className="schedule-stack">
                    {stage.checklistTemplates.map((item, itemIndex) => (
                      <div key={`${stageIndex}-${itemIndex}`} className="hobby-stage-template-row">
                        <input className="workbench-field__input" value={item.title} onChange={(e) => updateChecklistItem(stageIndex, itemIndex, { title: e.target.value })} placeholder="Sanitize fermenter, confirm temperature target, record gravity" />
                        <button type="button" className="button button--ghost button--sm" onClick={() => removeChecklistItem(stageIndex, itemIndex)}>Remove</button>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="panel">
                <div className="panel__header">
                  <h4>Needed Inventory</h4>
                  <button type="button" className="button button--ghost button--sm" onClick={() => addSupplyTemplate(stageIndex)}>+ Supply</button>
                </div>
                <div className="panel__body--padded">
                  {stage.supplyTemplates.length === 0 ? <p className="panel__empty">No stage supplies defined yet.</p> : null}
                  <div className="schedule-stack">
                    {stage.supplyTemplates.map((supply, supplyIndex) => (
                      <div key={`${stageIndex}-supply-${supplyIndex}`} className="hobby-stage-supply-grid">
                        <input className="workbench-field__input" value={supply.name} onChange={(e) => updateSupplyTemplate(stageIndex, supplyIndex, { name: e.target.value })} placeholder="US-05 yeast, sanitizer, CO2" />
                        <input className="workbench-field__input" type="number" min="0.01" step="0.01" value={String(supply.quantityNeeded)} onChange={(e) => updateSupplyTemplate(stageIndex, supplyIndex, { quantityNeeded: Number(e.target.value || 0) })} />
                        <input className="workbench-field__input" value={supply.unit} onChange={(e) => updateSupplyTemplate(stageIndex, supplyIndex, { unit: e.target.value })} placeholder="oz, packet, gal" />
                        <select className="workbench-field__input" value={supply.inventoryItemId ?? ""} onChange={(e) => updateSupplyTemplate(stageIndex, supplyIndex, { inventoryItemId: e.target.value || null })}>
                          <option value="">No linked inventory item</option>
                          {inventoryLinks.map((link) => (
                            <option key={link.inventoryItemId} value={link.inventoryItemId}>{link.inventoryItem.name} · {link.inventoryItem.quantityOnHand} {link.inventoryItem.unit}</option>
                          ))}
                        </select>
                        <label className="hobby-stage-editor-card__checkbox">
                          <span className="workbench-section__hint">Required</span>
                          <input type="checkbox" checked={supply.isRequired ?? true} onChange={(e) => updateSupplyTemplate(stageIndex, supplyIndex, { isRequired: e.target.checked })} />
                        </label>
                        <textarea className="workbench-field__input" rows={2} value={supply.notes ?? ""} onChange={(e) => updateSupplyTemplate(stageIndex, supplyIndex, { notes: e.target.value })} placeholder="Why it matters, target lot, supplier note, or substitution guidance" />
                        <button type="button" className="button button--ghost button--sm" onClick={() => removeSupplyTemplate(stageIndex, supplyIndex)}>Remove</button>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </div>

            <section className="panel" style={{ marginTop: "12px" }}>
              <div className="panel__header">
                <h4>Stage Logging Fields</h4>
                <button type="button" className="button button--ghost button--sm" onClick={() => addFieldDefinition(stageIndex)}>+ Field</button>
              </div>
              <div className="panel__body--padded">
                {stage.fieldDefinitions.length === 0 ? <p className="panel__empty">No stage-specific logging fields yet.</p> : null}
                <div className="schedule-stack">
                  {stage.fieldDefinitions.map((field, fieldIndex) => (
                    <div key={`${stageIndex}-field-${fieldIndex}`} className="hobby-stage-field-grid">
                      <input className="workbench-field__input" value={field.label} onChange={(e) => updateFieldDefinition(stageIndex, fieldIndex, { label: e.target.value })} placeholder="Target gravity" />
                      <input className="workbench-field__input" value={field.key} onChange={(e) => updateFieldDefinition(stageIndex, fieldIndex, { key: e.target.value })} placeholder="target-gravity" />
                      <select className="workbench-field__input" value={field.type} onChange={(e) => updateFieldDefinition(stageIndex, fieldIndex, { type: e.target.value as CustomFieldTemplateType })}>
                        {fieldTypeOptions.map((fieldType) => (
                          <option key={fieldType} value={fieldType}>{fieldType}</option>
                        ))}
                      </select>
                      <input className="workbench-field__input" value={field.unit ?? ""} onChange={(e) => updateFieldDefinition(stageIndex, fieldIndex, { unit: e.target.value || undefined })} placeholder="Unit" />
                      <label className="hobby-stage-editor-card__checkbox">
                        <span className="workbench-section__hint">Required</span>
                        <input type="checkbox" checked={field.required} onChange={(e) => updateFieldDefinition(stageIndex, fieldIndex, { required: e.target.checked })} />
                      </label>
                      <input className="workbench-field__input" value={field.helpText ?? ""} onChange={(e) => updateFieldDefinition(stageIndex, fieldIndex, { helpText: e.target.value || undefined })} placeholder="Help text" />
                      {(field.type === "select" || field.type === "multiselect") ? (
                        <input className="workbench-field__input" value={(field.options ?? []).join(", ")} onChange={(e) => updateFieldDefinition(stageIndex, fieldIndex, { options: e.target.value.split(",").map((option) => option.trim()).filter(Boolean) })} placeholder="Option A, Option B, Option C" />
                      ) : null}
                      <button type="button" className="button button--ghost button--sm" onClick={() => removeFieldDefinition(stageIndex, fieldIndex)}>Remove</button>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </article>
        ))}
      </div>
    </section>
  );
}