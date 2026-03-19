"use client";

import { useState } from "react";
import { createNoteTemplate } from "../lib/api";

type SaveAsTemplateButtonProps = {
  householdId: string;
  body: string;
  entryType?: string;
  tags?: string[];
  flags?: string[];
};

export function SaveAsTemplateButton({
  householdId,
  body,
  entryType = "note",
  tags = [],
  flags = [],
}: SaveAsTemplateButtonProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName || saving) return;
    setSaving(true);
    try {
      await createNoteTemplate(householdId, {
        name: trimmedName,
        description: description.trim() || undefined,
        bodyTemplate: body,
        entryType: entryType as "note",
        defaultTags: tags,
        defaultFlags: flags as ("important" | "actionable" | "resolved" | "pinned" | "tip" | "warning" | "archived")[],
      });
      setSaved(true);
      setTimeout(() => {
        setOpen(false);
        setSaved(false);
        setName("");
        setDescription("");
      }, 1500);
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        className="button button--ghost button--small"
        onClick={() => setOpen(true)}
      >
        Save as Template
      </button>
    );
  }

  return (
    <div className="save-as-template">
      {saved ? (
        <span className="save-as-template__success">✓ Template saved</span>
      ) : (
        <>
          <input
            type="text"
            className="save-as-template__input"
            placeholder="Template name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={200}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") setOpen(false);
            }}
          />
          <input
            type="text"
            className="save-as-template__input"
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
          />
          <div className="inline-actions">
            <button
              type="button"
              className="button button--primary button--small"
              onClick={handleSave}
              disabled={!name.trim() || saving}
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              className="button button--ghost button--small"
              onClick={() => { setOpen(false); setName(""); setDescription(""); }}
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}
