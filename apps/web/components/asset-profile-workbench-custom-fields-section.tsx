import type { AssetFieldDefinition, AssetFieldType, AssetFieldValue } from "@lifekeeper/types";
import type { JSX } from "react";
import { Fragment } from "react";
import { CompactFieldPreview } from "./compact-field-preview";
import { ExpandableCard } from "./expandable-card";
import { SectionFilterBar, SectionFilterChildren, SectionFilterProvider, SectionFilterToggle } from "./section-filter";

type CustomFieldSearchItem = {
  index: number;
  key: string;
  label: string;
  group: string;
  type: string;
};

type CustomFieldsSectionProps = {
  inputIdPrefix: string;
  fieldDefinitions: AssetFieldDefinition[];
  fieldValues: Record<string, AssetFieldValue>;
  detailSections: string[];
  lifecycleSectionNames: readonly string[];
  groupedFieldDefinitions: Record<string, Array<{ field: AssetFieldDefinition; index: number }>>;
  unsectionedFieldDefinitions: Array<{ field: AssetFieldDefinition; index: number }>;
  customFieldSearchItems: CustomFieldSearchItem[];
  availableSuggestedFields: AssetFieldDefinition[];
  detailPickerValue: string;
  detailTargetSection: string;
  newSectionName: string;
  expandedFieldEditors: number[];
  fieldTypeOptions: Array<{ value: AssetFieldType; label: string }>;
  setDetailPickerValue: (value: string) => void;
  setDetailTargetSection: (value: string) => void;
  setNewSectionName: (value: string) => void;
  setFieldValues: (updater: (current: Record<string, AssetFieldValue>) => Record<string, AssetFieldValue>) => void;
  toggleFieldEditor: (index: number) => void;
  handleFieldLabelChange: (index: number, nextLabel: string) => void;
  updateFieldDefinition: (index: number, update: Partial<AssetFieldDefinition>) => void;
  removeFieldDefinition: (index: number) => void;
  removeSection: (sectionLabel: string) => void;
  addFieldDefinition: () => void;
  addSuggestedField: () => void;
  addSection: () => void;
  addFieldDefinitionToSection: (sectionName: string) => void;
  getFieldTypeLabel: (type: AssetFieldType) => string;
  buildDefaultFieldValue: (field: AssetFieldDefinition) => AssetFieldValue;
  renderFieldValueInput: (
    field: AssetFieldDefinition,
    value: AssetFieldValue,
    onChange: (nextValue: AssetFieldValue) => void
  ) => JSX.Element;
};

export function AssetProfileWorkbenchCustomFieldsSection({
  inputIdPrefix,
  fieldDefinitions,
  fieldValues,
  detailSections,
  lifecycleSectionNames,
  groupedFieldDefinitions,
  unsectionedFieldDefinitions,
  customFieldSearchItems,
  availableSuggestedFields,
  detailPickerValue,
  detailTargetSection,
  newSectionName,
  expandedFieldEditors,
  fieldTypeOptions,
  setDetailPickerValue,
  setDetailTargetSection,
  setNewSectionName,
  setFieldValues,
  toggleFieldEditor,
  handleFieldLabelChange,
  updateFieldDefinition,
  removeFieldDefinition,
  removeSection,
  addFieldDefinition,
  addSuggestedField,
  addSection,
  addFieldDefinitionToSection,
  getFieldTypeLabel,
  buildDefaultFieldValue,
  renderFieldValueInput,
}: CustomFieldsSectionProps): JSX.Element {
  return (
    <SectionFilterProvider items={customFieldSearchItems} keys={["label", "group", "type"]} placeholder="Filter custom fields by label, section, or type">
      <ExpandableCard
        title="Custom Fields"
        modalTitle="Custom Field Definitions"
        actions={<SectionFilterToggle />}
        headerContent={<SectionFilterBar />}
        previewContent={<CompactFieldPreview fieldDefinitions={fieldDefinitions} />}
      >
        <SectionFilterChildren<CustomFieldSearchItem>>
          {(filteredFieldItems) => {
            const filteredIndexes = new Set(filteredFieldItems.map((item) => item.index));
            const filteredUnsectionedFieldDefinitions = unsectionedFieldDefinitions.filter(({ index }) => filteredIndexes.has(index));
            const filteredGroupedFieldDefinitions = detailSections
              .filter((sectionName) => !lifecycleSectionNames.includes(sectionName))
              .map((sectionName) => ({
                sectionName,
                fields: (groupedFieldDefinitions[sectionName] ?? []).filter(({ index }) => filteredIndexes.has(index))
              }))
              .filter(({ fields }) => fields.length > 0);

            return (
              <div>
                <div style={{ display: "flex", gap: "8px", alignItems: "flex-end", flexWrap: "wrap", marginBottom: "12px" }}>
                  <label className="field" style={{ flex: "1 1 200px", minWidth: 0 }}>
                    <span>Add built-in field</span>
                    <select value={detailPickerValue} onChange={(event) => setDetailPickerValue(event.target.value)}>
                      <option value="">Select built-in detail...</option>
                      {availableSuggestedFields.map((field) => (
                        <option key={field.key} value={field.key}>{field.label}{field.group ? ` (${field.group})` : ""}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field" style={{ flex: "0 1 180px", minWidth: 0 }}>
                    <span>Section</span>
                    <input
                      type="text"
                      list={`${inputIdPrefix}-detail-sections`}
                      value={detailTargetSection}
                      onChange={(event) => setDetailTargetSection(event.target.value)}
                      placeholder="Optional section..."
                    />
                  </label>
                  <div style={{ display: "flex", gap: "6px", paddingBottom: "1px" }}>
                    <button type="button" className="button button--secondary button--sm" onClick={addSuggestedField} disabled={!detailPickerValue}>Add Field</button>
                    <button type="button" className="button button--ghost button--sm" onClick={addFieldDefinition}>+ Custom</button>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "8px", alignItems: "flex-end", marginBottom: "16px" }}>
                  <label className="field" style={{ flex: 1 }}>
                    <span>New section name</span>
                    <input type="text" value={newSectionName} onChange={(event) => setNewSectionName(event.target.value)} placeholder="e.g. Specifications" />
                  </label>
                  <button type="button" className="button button--ghost button--sm" style={{ paddingBottom: "1px" }} onClick={addSection} disabled={!newSectionName.trim()}>+ Add Section</button>
                </div>

                <table className="workbench-table">
                  <thead>
                    <tr>
                      <th>Label</th>
                      <th>Type</th>
                      <th>Value</th>
                      <th style={{ width: "72px" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {fieldDefinitions.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="workbench-table__empty">No custom fields yet - add one above</td>
                      </tr>
                    ) : null}

                    {fieldDefinitions.length > 0 && filteredFieldItems.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="workbench-table__empty">No custom fields match that search.</td>
                      </tr>
                    ) : null}

                    {filteredUnsectionedFieldDefinitions.map(({ field, index }) => {
                      const isExpanded = expandedFieldEditors.includes(index);
                      const optionsValue = field.options.map((opt) => opt.value).join(", ");
                      return (
                        <Fragment key={`row-${field.key}-${index}`}>
                          <tr className={isExpanded ? "workbench-table__row--active" : undefined}>
                            <td style={{ fontWeight: 500 }}>{field.label || <em style={{ color: "var(--ink-muted)", fontStyle: "normal" }}>New field</em>}</td>
                            <td style={{ color: "var(--ink-muted)", fontSize: "0.78rem" }}>{getFieldTypeLabel(field.type)}</td>
                            <td>
                              {renderFieldValueInput(field, fieldValues[field.key] ?? buildDefaultFieldValue(field), (nextValue) => {
                                setFieldValues((current) => ({ ...current, [field.key]: nextValue }));
                              })}
                            </td>
                            <td>
                              <button type="button" className="button button--ghost button--sm" onClick={() => toggleFieldEditor(index)}>
                                {isExpanded ? "Done" : "Edit"}
                              </button>
                            </td>
                          </tr>
                          {isExpanded ? (
                            <tr className="workbench-table__edit">
                              <td colSpan={4}>
                                <div className="workbench-grid" style={{ padding: "8px 4px" }}>
                                  <label className="field"><span>Label</span><input type="text" value={field.label} onChange={(event) => handleFieldLabelChange(index, event.target.value)} placeholder="e.g. VIN" /></label>
                                  <label className="field"><span>Format</span><select value={field.type} onChange={(event) => updateFieldDefinition(index, { type: event.target.value as AssetFieldType })}>{fieldTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                                  <label className="field"><span>Section</span><input type="text" list={`${inputIdPrefix}-detail-sections`} value={field.group ?? ""} onChange={(event) => updateFieldDefinition(index, { group: event.target.value.trim() || undefined })} /></label>
                                  <label className="field"><span>Unit</span><input type="text" value={field.unit ?? ""} onChange={(event) => updateFieldDefinition(index, { unit: event.target.value.trim() || undefined })} /></label>
                                  {(field.type === "select" || field.type === "multiselect") ? (
                                    <label className="field field--full"><span>Options (comma separated)</span><input type="text" value={optionsValue} onChange={(event) => updateFieldDefinition(index, { options: event.target.value.split(",").map((item) => item.trim()).filter(Boolean).map((option) => ({ label: option, value: option })) })} /></label>
                                  ) : null}
                                  <label className="field field--full"><span>Help text</span><input type="text" value={field.helpText ?? ""} onChange={(event) => updateFieldDefinition(index, { helpText: event.target.value.trim() || undefined })} /></label>
                                  <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "space-between" }}>
                                    <button type="button" className="button button--danger button--sm" onClick={() => removeFieldDefinition(index)}>Remove</button>
                                    <button type="button" className="button button--ghost button--sm" onClick={() => toggleFieldEditor(index)}>Done</button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })}

                    {filteredGroupedFieldDefinitions.map(({ sectionName: groupLabel, fields }) => (
                      <Fragment key={`section-${groupLabel}`}>
                        <tr className="workbench-table__section-head">
                          <td colSpan={3}>{groupLabel}</td>
                          <td>
                            <button type="button" className="button button--ghost button--xs" onClick={() => removeSection(groupLabel)} title="Remove section">x Remove</button>
                          </td>
                        </tr>
                        {fields.map(({ field, index }) => {
                          const isExpanded = expandedFieldEditors.includes(index);
                          const optionsValue = field.options.map((opt) => opt.value).join(", ");
                          return (
                            <Fragment key={`row-${field.key}-${index}`}>
                              <tr className={isExpanded ? "workbench-table__row--active" : undefined}>
                                <td style={{ fontWeight: 500 }}>{field.label || <em style={{ color: "var(--ink-muted)", fontStyle: "normal" }}>New field</em>}</td>
                                <td style={{ color: "var(--ink-muted)", fontSize: "0.78rem" }}>{getFieldTypeLabel(field.type)}</td>
                                <td>
                                  {renderFieldValueInput(field, fieldValues[field.key] ?? buildDefaultFieldValue(field), (nextValue) => {
                                    setFieldValues((current) => ({ ...current, [field.key]: nextValue }));
                                  })}
                                </td>
                                <td>
                                  <button type="button" className="button button--ghost button--sm" onClick={() => toggleFieldEditor(index)}>
                                    {isExpanded ? "Done" : "Edit"}
                                  </button>
                                </td>
                              </tr>
                              {isExpanded ? (
                                <tr className="workbench-table__edit">
                                  <td colSpan={4}>
                                    <div className="workbench-grid" style={{ padding: "8px 4px" }}>
                                      <label className="field"><span>Label</span><input type="text" value={field.label} onChange={(event) => handleFieldLabelChange(index, event.target.value)} /></label>
                                      <label className="field"><span>Format</span><select value={field.type} onChange={(event) => updateFieldDefinition(index, { type: event.target.value as AssetFieldType })}>{fieldTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                                      <label className="field"><span>Section</span><input type="text" list={`${inputIdPrefix}-detail-sections`} value={field.group ?? ""} onChange={(event) => updateFieldDefinition(index, { group: event.target.value.trim() || undefined })} /></label>
                                      <label className="field"><span>Unit</span><input type="text" value={field.unit ?? ""} onChange={(event) => updateFieldDefinition(index, { unit: event.target.value.trim() || undefined })} /></label>
                                      {(field.type === "select" || field.type === "multiselect") ? (
                                        <label className="field field--full"><span>Options (comma separated)</span><input type="text" value={optionsValue} onChange={(event) => updateFieldDefinition(index, { options: event.target.value.split(",").map((item) => item.trim()).filter(Boolean).map((option) => ({ label: option, value: option })) })} /></label>
                                      ) : null}
                                      <label className="field field--full"><span>Help text</span><input type="text" value={field.helpText ?? ""} onChange={(event) => updateFieldDefinition(index, { helpText: event.target.value.trim() || undefined })} /></label>
                                      <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "space-between" }}>
                                        <button type="button" className="button button--danger button--sm" onClick={() => removeFieldDefinition(index)}>Remove</button>
                                        <button type="button" className="button button--ghost button--sm" onClick={() => toggleFieldEditor(index)}>Done</button>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              ) : null}
                            </Fragment>
                          );
                        })}
                      </Fragment>
                    ))}
                  </tbody>
                </table>

                {detailSections.filter((sectionName) => !lifecycleSectionNames.includes(sectionName)).map((sectionName) => {
                  if ((groupedFieldDefinitions[sectionName] ?? []).length > 0) {
                    return null;
                  }

                  return (
                    <div key={`empty-section-${sectionName}`} style={{ marginTop: "12px" }}>
                      <strong>{sectionName}</strong>
                      <div style={{ marginTop: "8px" }}>
                        <button type="button" className="button button--ghost button--sm" onClick={() => addFieldDefinitionToSection(sectionName)}>+ Add field</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          }}
        </SectionFilterChildren>
      </ExpandableCard>
    </SectionFilterProvider>
  );
}