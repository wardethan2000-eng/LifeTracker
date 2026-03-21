"use client";

import type { JSX } from "react";
import { useCallback, useRef, useState, useTransition } from "react";
import { updateIdeaAction } from "../app/actions";
import { Card } from "./card";

type IdeaDescriptionCardProps = {
  householdId: string;
  ideaId: string;
  description: string | null;
};

export function IdeaDescriptionCard({ householdId, ideaId, description }: IdeaDescriptionCardProps): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(description ?? "");
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSave = useCallback(() => {
    const trimmed = value.trim();
    const newDescription = trimmed || null;
    if (newDescription === description) {
      setEditing(false);
      return;
    }
    startTransition(async () => {
      await updateIdeaAction(householdId, ideaId, { description: newDescription });
      setEditing(false);
    });
  }, [value, description, householdId, ideaId]);

  const handleCancel = useCallback(() => {
    setValue(description ?? "");
    setEditing(false);
  }, [description]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        handleCancel();
      } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        handleSave();
      }
    },
    [handleCancel, handleSave]
  );

  return (
    <Card
      title="Description"
      actions={
        !editing ? (
          <button
            type="button"
            className="button button--ghost button--xs"
            onClick={() => {
              setEditing(true);
              setTimeout(() => textareaRef.current?.focus(), 0);
            }}
          >
            Edit
          </button>
        ) : undefined
      }
    >
      {editing ? (
        <div>
          <textarea
            ref={textareaRef}
            className="input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={4}
            style={{ width: "100%", resize: "vertical" }}
            disabled={isPending}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              type="button"
              className="button button--primary button--sm"
              onClick={handleSave}
              disabled={isPending}
            >
              {isPending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              className="button button--ghost button--sm"
              onClick={handleCancel}
              disabled={isPending}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : description ? (
        <p
          style={{ fontSize: "0.88rem", lineHeight: 1.6, whiteSpace: "pre-wrap", cursor: "pointer" }}
          onClick={() => {
            setEditing(true);
            setTimeout(() => textareaRef.current?.focus(), 0);
          }}
        >
          {description}
        </p>
      ) : (
        <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>
          No description yet.{" "}
          <button
            type="button"
            className="button button--ghost button--xs"
            onClick={() => {
              setEditing(true);
              setTimeout(() => textareaRef.current?.focus(), 0);
            }}
          >
            Add description
          </button>
        </p>
      )}
    </Card>
  );
}
