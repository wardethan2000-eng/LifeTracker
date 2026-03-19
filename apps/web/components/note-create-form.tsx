"use client";

import { useRef, useState } from "react";
import { createProjectNoteAction } from "../app/actions";
import { RichEditor } from "./rich-editor";

type NoteCreateFormProps = {
  householdId: string;
  projectId: string;
  phases: { id: string; name: string }[];
};

export function NoteCreateForm({ householdId, projectId, phases }: NoteCreateFormProps) {
  const [body, setBody] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (formData: FormData) => {
        formData.set("body", body);
        await createProjectNoteAction(formData);
        setBody("");
        formRef.current?.reset();
      }}
    >
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="projectId" value={projectId} />
      <div className="workbench-grid" style={{ marginBottom: 12 }}>
        <label className="field">
          <span className="field__label">Title *</span>
          <input type="text" name="title" required maxLength={300} placeholder="Note title" />
        </label>
        <label className="field">
          <span className="field__label">Category</span>
          <select name="category" defaultValue="general">
            <option value="research">Research</option>
            <option value="reference">Reference</option>
            <option value="decision">Decision</option>
            <option value="measurement">Measurement</option>
            <option value="general">General</option>
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
        <button type="submit" className="button">Save Note</button>
      </div>
    </form>
  );
}
