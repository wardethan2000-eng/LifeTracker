"use client";

import type { NoteTemplate } from "@lifekeeper/types";
import type { JSX } from "react";
import { useState } from "react";

type TemplatePickerProps = {
  templates: NoteTemplate[];
  onSelect: (template: NoteTemplate) => void;
  onSkip: () => void;
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

export function TemplatePicker({ templates, onSelect, onSkip }: TemplatePickerProps): JSX.Element {
  const [filter, setFilter] = useState<"all" | "built-in" | "custom">("all");

  const filtered = templates.filter((t) => {
    if (filter === "built-in") return t.isBuiltIn;
    if (filter === "custom") return !t.isBuiltIn;
    return true;
  });

  return (
    <div className="template-picker">
      <div className="template-picker__header">
        <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Start from a template</h3>
        <div className="template-picker__filters">
          {(["all", "built-in", "custom"] as const).map((f) => (
            <button
              key={f}
              type="button"
              className={`pill${filter === f ? " pill--accent" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "All" : f === "built-in" ? "Built-in" : "Custom"}
            </button>
          ))}
        </div>
      </div>

      <div className="template-picker__grid">
        <button
          type="button"
          className="template-picker__card template-picker__card--blank"
          onClick={onSkip}
        >
          <span className="template-picker__card-icon">📝</span>
          <span className="template-picker__card-name">Blank Note</span>
          <span className="template-picker__card-desc">Start from scratch</span>
        </button>

        {filtered.map((template) => (
          <button
            key={template.id}
            type="button"
            className="template-picker__card"
            onClick={() => onSelect(template)}
          >
            <span className="template-picker__card-icon">
              {template.isBuiltIn ? "📋" : "📄"}
            </span>
            <span className="template-picker__card-name">{template.name}</span>
            {template.description ? (
              <span className="template-picker__card-desc">{template.description}</span>
            ) : null}
            <span className="template-picker__card-meta">
              {ENTRY_TYPE_LABELS[template.entryType] ?? template.entryType}
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 && filter === "custom" ? (
        <p className="panel__empty" style={{ marginTop: 12 }}>
          No custom templates yet. Create one from the Templates page or save an existing note as a template.
        </p>
      ) : null}
    </div>
  );
}
