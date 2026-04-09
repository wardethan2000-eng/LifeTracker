"use client";

import type { EntryType, NoteTemplate } from "@aegis/types";
import type { JSX } from "react";
import { useCallback, useState } from "react";
import {
  createNoteTemplate,
  deleteNoteTemplate,
  getNoteTemplates,
  updateNoteTemplate,
} from "../lib/api";
import { RichEditor } from "./rich-editor";
import { RichEditorDisplay } from "./rich-editor-display";

type NoteTemplateManagerProps = {
  householdId: string;
  initialTemplates: NoteTemplate[];
};

const ENTRY_TYPE_LABELS: Record<string, string> = {
  note: "Note",
  observation: "Observation",
  measurement: "Measurement",
  lesson: "Lesson",
  decision: "Decision",
  issue: "Issue",
  milestone: "Milestone",
  reference: "Reference",
  comparison: "Comparison",
};

const ENTRY_TYPE_OPTIONS = Object.entries(ENTRY_TYPE_LABELS).map(([value, label]) => ({ value, label }));

export function NoteTemplateManager({ householdId, initialTemplates }: NoteTemplateManagerProps): JSX.Element {
  const [templates, setTemplates] = useState<NoteTemplate[]>(initialTemplates);
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async () => {
    const updated = await getNoteTemplates(householdId);
    setTemplates(updated);
  }, [householdId]);

  const handleDelete = useCallback(async (templateId: string) => {
    if (!confirm("Delete this template?")) return;
    await deleteNoteTemplate(householdId, templateId);
    setTemplates((prev) => prev.filter((t) => t.id !== templateId));
  }, [householdId]);

  const builtIn = templates.filter((t) => t.isBuiltIn);
  const custom = templates.filter((t) => !t.isBuiltIn);

  return (
    <div className="note-template-manager">
      <div style={{ marginBottom: 16 }}>
        <button
          type="button"
          className="button button--primary"
          onClick={() => setCreating(true)}
          disabled={creating}
        >
          + New Template
        </button>
      </div>

      {creating ? (
        <TemplateForm
          householdId={householdId}
          onSave={async () => {
            setCreating(false);
            await refresh();
          }}
          onCancel={() => setCreating(false)}
        />
      ) : null}

      {custom.length > 0 ? (
        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 12 }}>Custom Templates</h2>
          <div className="schedule-stack">
            {custom.map((template) => (
              editing === template.id ? (
                <TemplateForm
                  key={template.id}
                  householdId={householdId}
                  existing={template}
                  onSave={async () => {
                    setEditing(null);
                    await refresh();
                  }}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onEdit={() => setEditing(template.id)}
                  onDelete={() => handleDelete(template.id)}
                />
              )
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 12 }}>Built-in Templates</h2>
        <div className="schedule-stack">
          {builtIn.map((template) => (
            <TemplateCard key={template.id} template={template} />
          ))}
        </div>
      </section>
    </div>
  );
}

/* ─── Template Card ─── */

function TemplateCard({
  template,
  onEdit,
  onDelete,
}: {
  template: NoteTemplate;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="schedule-card">
      <div className="schedule-card__summary">
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
          <span className="pill">{ENTRY_TYPE_LABELS[template.entryType] ?? template.entryType}</span>
          {template.isBuiltIn ? <span className="pill pill--muted">Built-in</span> : null}
        </div>
        <div className="data-table__primary">{template.name}</div>
        {template.description ? (
          <div className="data-table__secondary" style={{ marginTop: 2 }}>{template.description}</div>
        ) : null}
        <div style={{ marginTop: 8 }}>
          <button
            type="button"
            className="button button--ghost button--small"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "Hide Preview" : "Show Preview"}
          </button>
          {!template.isBuiltIn && onEdit ? (
            <button
              type="button"
              className="button button--ghost button--small"
              onClick={onEdit}
              style={{ marginLeft: 6 }}
            >
              Edit
            </button>
          ) : null}
          {!template.isBuiltIn && onDelete ? (
            <button
              type="button"
              className="button button--ghost button--small button--danger"
              onClick={onDelete}
              style={{ marginLeft: 6 }}
            >
              Delete
            </button>
          ) : null}
        </div>
        {expanded ? (
          <div style={{ marginTop: 12, padding: 12, border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)" }}>
            <RichEditorDisplay content={template.bodyTemplate} bodyFormat="rich_text" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ─── Template Form (create / edit) ─── */

function TemplateForm({
  householdId,
  existing,
  onSave,
  onCancel,
}: {
  householdId: string;
  existing?: NoteTemplate;
  onSave: () => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [bodyTemplate, setBodyTemplate] = useState(existing?.bodyTemplate ?? "");
  const [entryType, setEntryType] = useState<EntryType>(existing?.entryType ?? "note");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      if (existing) {
        await updateNoteTemplate(householdId, existing.id, {
          name: name.trim(),
          description: description.trim() || null,
          bodyTemplate,
          entryType: entryType as "note",
        });
      } else {
        await createNoteTemplate(householdId, {
          name: name.trim(),
          description: description.trim() || undefined,
          bodyTemplate,
          entryType: entryType as "note",
        });
      }
      await onSave();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="schedule-card" style={{ background: "var(--surface-accent)" }}>
      <div style={{ padding: 16 }}>
        <h3 style={{ margin: "0 0 12px", fontSize: "0.95rem", fontWeight: 600 }}>
          {existing ? "Edit Template" : "New Template"}
        </h3>
        <div className="workbench-grid" style={{ marginBottom: 12 }}>
          <label className="field">
            <span className="field__label">Name *</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
              placeholder="Template name"
            />
          </label>
          <label className="field">
            <span className="field__label">Description</span>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              placeholder="Brief description"
            />
          </label>
          <label className="field">
            <span className="field__label">Entry Type</span>
            <select value={entryType} onChange={(e) => setEntryType(e.target.value as EntryType)}>
              {ENTRY_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
        </div>
        <div style={{ marginBottom: 12 }}>
          <span className="field__label">Template Body</span>
          <RichEditor
            content={bodyTemplate}
            onChange={setBodyTemplate}
            placeholder="Design your template structure…"
          />
        </div>
        <div className="inline-actions">
          <button
            type="button"
            className="button button--primary"
            onClick={handleSubmit}
            disabled={!name.trim() || saving}
          >
            {saving ? "Saving…" : existing ? "Update" : "Create"}
          </button>
          <button
            type="button"
            className="button button--ghost"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
