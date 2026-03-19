import Link from "next/link";
import { isLegacyImportedEntrySourceType, parseProjectEntryPayload } from "@lifekeeper/utils";
import type { JSX } from "react";
import { Suspense } from "react";
import {
  deleteProjectNoteAction,
  toggleProjectNotePinAction,
} from "../../../../actions";
import { ExpandableCard } from "../../../../../components/expandable-card";
import { AttachmentSection } from "../../../../../components/attachment-section";
import { NoteCreateForm } from "../../../../../components/note-create-form";
import { RichEditorDisplay } from "../../../../../components/rich-editor-display";
import {
  ApiError,
  getEntries,
  getMe,
  getProjectDetail,
  getProjectNotes,
} from "../../../../../lib/api";
import { formatDate } from "../../../../../lib/formatters";

type ProjectNotesPageProps = {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProjectNotesPage({ params, searchParams }: ProjectNotesPageProps): Promise<JSX.Element> {
  const { projectId } = await params;
  const query = searchParams ? await searchParams : {};
  const householdId = typeof query.householdId === "string" ? query.householdId : undefined;

  try {
    const me = await getMe();
    const household = me.households.find((item) => item.id === householdId) ?? me.households[0];

    if (!household) {
      return <p>No household found.</p>;
    }

    const project = await getProjectDetail(household.id, projectId);

    return (
      <section id="project-notes">
        <Suspense fallback={<ProjectNotesSkeleton />}>
          <ProjectNotesPanelAsync householdId={household.id} project={project} />
        </Suspense>
      </section>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <div className="panel">
          <div className="panel__body--padded">
            <p>Failed to load notes: {error.message}</p>
          </div>
        </div>
      );
    }
    throw error;
  }
}

const ProjectNotesSkeleton = (): JSX.Element => (
  <ExpandableCard
    title="Research & Notes"
    modalTitle="Research & Notes"
    previewContent={<span className="data-table__secondary">Loading notes…</span>}
  >
    <div className="panel__empty">Loading notes…</div>
  </ExpandableCard>
);

async function ProjectNotesPanelAsync({
  householdId,
  project
}: {
  householdId: string;
  project: Awaited<ReturnType<typeof getProjectDetail>>;
}): Promise<JSX.Element> {
  const [projectNotes, projectEntries, phaseEntryResponses] = await Promise.all([
    getProjectNotes(householdId, project.id),
    getEntries(householdId, {
      entityType: "project",
      entityId: project.id,
      includeArchived: true,
      limit: 100
    }),
    Promise.all(project.phases.map((phase) => getEntries(householdId, {
      entityType: "project_phase",
      entityId: phase.id,
      includeArchived: true,
      limit: 100
    })))
  ]);

  type ProjectNoteCard = {
    id: string;
    title: string;
    body: string;
    bodyFormat: "plain_text" | "rich_text";
    category: string;
    url: string | null;
    phaseName: string | null;
    isPinned: boolean;
    createdAt: string;
    createdByName: string;
    sourceSystem: "legacy" | "entry";
    isImported: boolean;
    canManageAttachments: boolean;
  };

  const entryCards = [...projectEntries.items, ...phaseEntryResponses.flatMap((response) => response.items)]
    .filter((entry) => entry.sourceType === "project_note" || entry.tags.some((tag) => tag.startsWith("lk:project-note-category:")))
    .map((entry): ProjectNoteCard => {
      const parsed = parseProjectEntryPayload({
        title: entry.title,
        body: entry.body,
        entryType: entry.entryType,
        tags: entry.tags,
        flags: entry.flags,
        attachmentUrl: entry.attachmentUrl
      });

      return {
        id: entry.id,
        title: entry.title ?? "Project note",
        body: parsed.body,
        bodyFormat: (entry.bodyFormat === "rich_text" ? "rich_text" : "plain_text") as "plain_text" | "rich_text",
        category: parsed.category,
        url: parsed.url,
        phaseName: entry.entityType === "project_phase" ? entry.resolvedEntity.label : null,
        isPinned: parsed.isPinned,
        createdAt: entry.createdAt,
        createdByName: entry.createdBy.displayName ?? "Unknown",
        sourceSystem: "entry",
        isImported: isLegacyImportedEntrySourceType(entry.sourceType),
        canManageAttachments: false
      };
    });

  const migratedLegacyProjectNoteIds = new Set(
    entryCards.filter((entry) => entry.isImported).map((entry) => {
      const source = [...projectEntries.items, ...phaseEntryResponses.flatMap((response) => response.items)]
        .find((candidate) => candidate.id === entry.id);
      return source?.sourceId ?? "";
    }).filter(Boolean)
  );

  const legacyCards = projectNotes.map((note): ProjectNoteCard => ({
    id: note.id,
    title: note.title,
    body: note.body,
    bodyFormat: "plain_text",
    category: note.category,
    url: note.url ?? null,
    phaseName: note.phaseName ?? null,
    isPinned: note.isPinned,
    createdAt: note.createdAt,
    createdByName: note.createdBy?.displayName ?? "Unknown",
    sourceSystem: "legacy",
    isImported: false,
    canManageAttachments: true
  })).filter((note) => !migratedLegacyProjectNoteIds.has(note.id));

  const mergedNotes = [...entryCards, ...legacyCards]
    .sort((left, right) => {
      const leftPinned = left.isPinned ? 1 : 0;
      const rightPinned = right.isPinned ? 1 : 0;

      if (leftPinned !== rightPinned) {
        return rightPinned - leftPinned;
      }

      return right.createdAt.localeCompare(left.createdAt);
    });

  const importedCount = mergedNotes.filter((note) => note.isImported).length;
  const legacyCount = mergedNotes.filter((note) => note.sourceSystem === "legacy").length;

  return (
    <ExpandableCard
      title="Research & Notes"
      modalTitle="Research & Notes"
      previewContent={
        <span className="data-table__secondary">
          {mergedNotes.length} note{mergedNotes.length !== 1 ? "s" : ""}
          {mergedNotes.filter((note) => note.isPinned).length > 0 ? ` · ${mergedNotes.filter((note) => note.isPinned).length} pinned` : ""}
        </span>
      }
    >
      <div>
        {(importedCount > 0 || legacyCount > 0) ? (
          <p className="note" style={{ marginBottom: 12 }}>
            Older entries were imported from the previous system.
            {legacyCount > 0 ? ` ${legacyCount} legacy note${legacyCount === 1 ? " is" : "s are"} still shown for compatibility.` : ""}
          </p>
        ) : null}
        <details style={{ marginBottom: 16 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600, padding: "8px 0" }}>Add Note</summary>
          <div style={{ marginTop: 12 }}>
            <NoteCreateForm householdId={householdId} projectId={project.id} phases={project.phases} />
          </div>
        </details>
        {mergedNotes.length === 0 ? <p className="panel__empty">No notes yet. Add one above.</p> : null}
        <div className="schedule-stack">
          {mergedNotes.map((note) => (
            <div
              key={note.id}
              className="schedule-card"
              style={note.isPinned ? { background: "var(--surface-accent)", borderLeft: "3px solid var(--accent)" } : undefined}
            >
              <div className="schedule-card__summary">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginBottom: 4 }}>
                  <span className="pill">{({ research: "Research", reference: "Reference", decision: "Decision", measurement: "Measurement", general: "General" } as Record<string, string>)[note.category] ?? note.category}</span>
                  {note.phaseName ? <span className="pill pill--muted">{note.phaseName}</span> : null}
                  {note.isPinned ? <span className="pill pill--accent">PINNED</span> : null}
                  {note.isImported ? <span className="pill pill--warning">Imported</span> : null}
                  {note.sourceSystem === "legacy" ? <span className="pill pill--muted">Legacy</span> : null}
                </div>
                <div className="data-table__primary">{note.title}</div>
                {note.body ? (
                  <div style={{ margin: "8px 0 0", fontSize: "0.875rem" }}>
                    <RichEditorDisplay
                      content={note.bodyFormat === "rich_text" ? note.body : (note.body.length > 400 ? `${note.body.slice(0, 400)}…` : note.body)}
                      bodyFormat={note.bodyFormat}
                    />
                  </div>
                ) : null}
                {note.url ? (
                  <a href={note.url} target="_blank" rel="noopener noreferrer" className="text-link" style={{ display: "block", marginTop: 6, fontSize: "0.8125rem" }}>
                    {(() => { try { return new URL(note.url).hostname; } catch { return note.url; } })()}
                  </a>
                ) : null}
                <div className="data-table__secondary" style={{ marginTop: 8 }}>
                  {note.createdByName} · {formatDate(note.createdAt)}
                </div>
              </div>
              <div className="inline-actions" style={{ marginTop: 8 }}>
                <form action={toggleProjectNotePinAction} style={{ display: "inline" }}>
                  <input type="hidden" name="householdId" value={householdId} />
                  <input type="hidden" name="projectId" value={project.id} />
                  <input type="hidden" name="noteId" value={note.id} />
                  <input type="hidden" name="sourceSystem" value={note.sourceSystem} />
                  <input type="hidden" name="isPinned" value={note.isPinned ? "false" : "true"} />
                  <button type="submit" className="button button--ghost button--small">
                    {note.isPinned ? "Unpin" : "Pin"}
                  </button>
                </form>
                <form action={deleteProjectNoteAction} style={{ display: "inline" }}>
                  <input type="hidden" name="householdId" value={householdId} />
                  <input type="hidden" name="projectId" value={project.id} />
                  <input type="hidden" name="noteId" value={note.id} />
                  <input type="hidden" name="sourceSystem" value={note.sourceSystem} />
                  <button type="submit" className="button button--ghost button--small button--danger">Delete</button>
                </form>
              </div>
              {note.canManageAttachments ? (
                <AttachmentSection
                  householdId={householdId}
                  entityType="project_note"
                  entityId={note.id}
                  compact
                  label=""
                />
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </ExpandableCard>
  );
}