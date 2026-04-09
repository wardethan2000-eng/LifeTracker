"use client";

import type { NoteTemplate } from "@lifekeeper/types";
import { useRef, useState, useTransition } from "react";
import { createProjectNoteAction } from "../app/actions";
import { RichEditor } from "./rich-editor";
import { TemplatePicker } from "./template-picker";

type NoteCreateFormProps = {
  householdId: string;
  projectId: string;
  phases: { id: string; name: string }[];
  templates?: NoteTemplate[];
};

export function NoteCreateForm({ householdId, projectId, phases, templates = [] }: NoteCreateFormProps) {
  const [body, setBody] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const handleTemplateSelect = (template: NoteTemplate) => {
    setBody(template.bodyTemplate);
    if (titleRef.current) {
      titleRef.current.value = template.name;
    }
    setShowPicker(false);
  };

  const handleSubmit = (formData: FormData) => {
    formData.set("body", body);
    setError(null);
    startTransition(async () => {
      try {
        await createProjectNoteAction(formData);
        setBody("");
        formRef.current?.reset();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save note. Please try again.");
      }
    });
  };

  return (
    <form ref={formRef} action={handleSubmit}>
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="projectId" value={projectId} />

      {templates.length > 0 ? (
        <div style={{ marginBottom: 12 }}>
          <button
            type="button"
            className="button button--ghost button--small"
            onClick={() => setShowPicker(!showPicker)}
          >
            {showPicker ? "Cancel" : "Start from Template"}
          </button>
          {showPicker ? (
            <div style={{ marginTop: 8 }}>
              <TemplatePicker
                templates={templates}
                onSelect={handleTemplateSelect}
                onSkip={() => setShowPicker(false)}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="workbench-grid" style={{ marginBottom: 12 }}>
        <label className="field">
          <span className="field__label">Title *</span>
          <input ref={titleRef} type="text" name="title" required maxLength={300} placeholder="Note title" />
        </label>
        <label className="field">
          <span className="field__label">Category</span>
          <select name="category" defaultValue="general">
            <option value="general">General</option>
            <option value="research">Research</option>
            <option value="reference">Reference</option>
            <option value="decision">Decision</option>
            <option value="measurement">Measurement</option>
          </select>
        </label>
        <label className="field">
          <span className="field__label">Phase (optional)</span>
          <select name="phaseId" defaultValue="">
            <option value="">No phase</option>
            {phases.map((phase) => (
              <option key={phase.id} value={phase.id}>{phase.name}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">URL (optional)</span>
          <input type="url" name="url" placeholder="https://…" />
        </label>
      </div>
      <div style={{ marginBottom: 12 }}>
        <span className="field__label">Body</span>
        <RichEditor
          content={body}
          onChange={setBody}
          placeholder="Write your note…"
        />
      </div>
      <div className="inline-actions">
        <button type="submit" className="button" disabled={isPending}>
          {isPending ? "Saving…" : "Save Note"}
        </button>
        {error ? <p className="form-error">{error}</p> : null}
      </div>
    </form>
  );
}
