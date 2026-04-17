"use client";

import type { IdeaCanvasThumbnail, NoteTemplate } from "@aegis/types";
import type { JSX } from "react";
import { useState } from "react";
import { CanvasList } from "./canvas-list";
import { EntityNotesWorkspace } from "./entity-notes-workspace";

type NotesHubProps = {
  householdId: string;
  templates: NoteTemplate[];
  canvases: IdeaCanvasThumbnail[];
  initialTab?: "notes" | "canvases";
};

export function NotesHub({ householdId, templates, canvases, initialTab = "notes" }: NotesHubProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<"notes" | "canvases">(initialTab);

  return (
    <div className="notes-hub">
      <div className="notes-hub__tabs">
        <button
          type="button"
          className={`notes-hub__tab${activeTab === "notes" ? " notes-hub__tab--active" : ""}`}
          onClick={() => setActiveTab("notes")}
        >
          Notes
        </button>
        <button
          type="button"
          className={`notes-hub__tab${activeTab === "canvases" ? " notes-hub__tab--active" : ""}`}
          onClick={() => setActiveTab("canvases")}
        >
          Canvases
        </button>
      </div>

      {activeTab === "canvases" ? (
        <CanvasList householdId={householdId} initialCanvases={canvases} />
      ) : (
        <EntityNotesWorkspace
          householdId={householdId}
          entityType="notebook"
          entityId={householdId}
          backToHref={`/notes?householdId=${householdId}`}
          notebookOptions={{
            templates,
            manageTemplatesHref: `/notes/templates?householdId=${householdId}`,
          }}
        />
      )}
    </div>
  );
}
