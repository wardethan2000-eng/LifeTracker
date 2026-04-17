"use client";

import type { Entry, EntryEntityType, EntryFlag, EntryType, NoteFolder, NoteTemplate } from "@aegis/types";
import Link from "next/link";
import type { JSX } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createEntry,
  createNoteFolder,
  deleteEntry,
  deleteNoteFolder,
  getEntries,
  getNoteFolders,
  updateEntry,
  updateNoteFolder,
} from "../lib/api";
import { NoteFolderTree } from "./note-folder-tree";
import { QuickCapture } from "./quick-capture";
import { RichEditor } from "./rich-editor";
import { RichEditorDisplay } from "./rich-editor-display";
import { TemplatePicker } from "./template-picker";

type FolderWithCounts = NoteFolder & { entryCount: number; childCount: number };

type NotebookWorkspaceOptions = {
  templates: NoteTemplate[];
  manageTemplatesHref: string;
};

type EntityNotesWorkspaceProps = {
  householdId: string;
  entityType: EntryEntityType;
  entityId: string;
  backToHref: string;
  compact?: boolean;
  notebookOptions?: NotebookWorkspaceOptions;
};

type NoteDraft = {
  title: string;
  body: string;
  entryType: EntryType;
  flags: EntryFlag[];
  tags: string;
  folderId: string;
  reminderAt: string;
  reminderRepeatDays: string;
  reminderUntil: string;
};

const DISCUSSION_TAG = "discussion";

const entryTypeOptions: Array<{ value: EntryType; label: string }> = [
  { value: "note", label: "Note" },
  { value: "decision", label: "Decision" },
  { value: "issue", label: "Issue" },
  { value: "observation", label: "Observation" },
  { value: "reference", label: "Reference" },
  { value: "lesson", label: "Lesson" },
  { value: "milestone", label: "Milestone" },
  { value: "comparison", label: "Comparison" },
  { value: "measurement", label: "Measurement" },
];

const flagOptions: Array<{ value: EntryFlag; label: string }> = [
  { value: "important", label: "Important" },
  { value: "pinned", label: "Pinned" },
  { value: "actionable", label: "Actionable" },
  { value: "resolved", label: "Resolved" },
  { value: "tip", label: "Tip" },
  { value: "warning", label: "Warning" },
  { value: "archived", label: "Archived" },
];

const repeatOptions: Array<{ value: string; label: string }> = [
  { value: "", label: "No repeat" },
  { value: "1", label: "Daily" },
  { value: "7", label: "Weekly" },
  { value: "14", label: "Biweekly" },
  { value: "30", label: "Monthly" },
];

const stripHtml = (html: string): string => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const truncate = (value: string, maxLength: number): string => (
  value.length <= maxLength ? value : `${value.slice(0, maxLength).trimEnd()}…`
);

const toLocalDateTimeInput = (value: string | null | undefined): string => (
  value ? value.slice(0, 16) : ""
);

const toLocalDateInput = (value: string | null | undefined): string => (
  value ? value.slice(0, 10) : ""
);

const parseTagString = (value: string): string[] => Array.from(new Set(
  value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
));

const buildDraft = (entry: Entry | null, defaultFolderId?: string | null): NoteDraft => {
  const tags = entry?.tags.filter((tag) => tag !== DISCUSSION_TAG) ?? [];

  return {
    title: entry?.title ?? "",
    body: entry?.body ?? "",
    entryType: entry?.entryType ?? "note",
    flags: entry?.flags ?? [],
    tags: tags.join(", "),
    folderId: entry?.folderId ?? defaultFolderId ?? "",
    reminderAt: toLocalDateTimeInput(entry?.reminderAt),
    reminderRepeatDays: entry?.reminderRepeatDays ? String(entry.reminderRepeatDays) : "",
    reminderUntil: toLocalDateInput(entry?.reminderUntil),
  };
};

export function EntityNotesWorkspace({
  householdId,
  entityType,
  entityId,
  backToHref,
  compact = false,
  notebookOptions,
}: EntityNotesWorkspaceProps): JSX.Element {
  const isNotebookWorkspace = Boolean(notebookOptions);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [folders, setFolders] = useState<FolderWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [remindersOnly, setRemindersOnly] = useState(false);
  const [actionableOnly, setActionableOnly] = useState(false);
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [draft, setDraft] = useState<NoteDraft>(() => buildDraft(null));
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);

  const fetchWorkspace = useCallback(async (folderIdOverride: string | null = activeFolderId) => {
    const [entryResponse, folderResponse] = await Promise.all([
      getEntries(householdId, {
        entityType,
        entityId,
        includeArchived: true,
        limit: 100,
        ...(isNotebookWorkspace && folderIdOverride !== null ? { folderId: folderIdOverride } : {}),
      }),
      getNoteFolders(householdId),
    ]);

    return {
      entries: entryResponse.items,
      folders: folderResponse,
    };
  }, [activeFolderId, entityId, entityType, householdId, isNotebookWorkspace]);

  const refreshWorkspace = useCallback(async (options?: {
    folderId?: string | null;
    selectedEntryId?: string | null;
  }): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const nextFolderId = options?.folderId ?? activeFolderId;
      const workspace = await fetchWorkspace(nextFolderId);
      setEntries(workspace.entries);
      setFolders(workspace.folders);

      if (options && "selectedEntryId" in options) {
        setSelectedEntryId(options.selectedEntryId ?? null);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load notes.");
    } finally {
      setLoading(false);
    }
  }, [activeFolderId, fetchWorkspace]);

  useEffect(() => {
    let cancelled = false;

    const load = async (): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        const workspace = await fetchWorkspace();

        if (!cancelled) {
          setEntries(workspace.entries);
          setFolders(workspace.folders);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load notes.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [fetchWorkspace]);

  const visibleEntries = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    return entries
      .filter((entry) => !remindersOnly || Boolean(entry.reminderAt))
      .filter((entry) => !actionableOnly || entry.flags.includes("actionable"))
      .filter((entry) => !pinnedOnly || entry.flags.includes("pinned"))
      .filter((entry) => {
        if (!query) {
          return true;
        }

        return [
          entry.title ?? "",
          stripHtml(entry.body),
          entry.tags.join(" "),
          entry.entryType,
        ].join(" ").toLowerCase().includes(query);
      })
      .sort((left, right) => {
        const leftPinned = left.flags.includes("pinned") ? 1 : 0;
        const rightPinned = right.flags.includes("pinned") ? 1 : 0;

        if (leftPinned !== rightPinned) {
          return rightPinned - leftPinned;
        }

        return right.updatedAt.localeCompare(left.updatedAt);
      });
  }, [actionableOnly, entries, pinnedOnly, remindersOnly, searchText]);

  const selectedEntry = visibleEntries.find((entry) => entry.id === selectedEntryId)
    ?? entries.find((entry) => entry.id === selectedEntryId)
    ?? null;

  const activeFolder = activeFolderId
    ? folders.find((folder) => folder.id === activeFolderId) ?? null
    : null;

  useEffect(() => {
    if (selectedEntry) {
      setDraft(buildDraft(selectedEntry, activeFolderId));
      return;
    }

    setDraft(buildDraft(null, activeFolderId));
  }, [activeFolderId, selectedEntry]);

  useEffect(() => {
    if (selectedEntryId && visibleEntries.some((entry) => entry.id === selectedEntryId)) {
      return;
    }

    const firstVisibleEntry = visibleEntries[0];

    if (firstVisibleEntry) {
      setSelectedEntryId(firstVisibleEntry.id);
    } else {
      setSelectedEntryId(null);
    }
  }, [selectedEntryId, visibleEntries]);

  const handleSelectEntry = (entry: Entry): void => {
    setSelectedEntryId(entry.id);
    setSaveMessage(null);
  };

  const handleCreateNew = (): void => {
    setSelectedEntryId(null);
    setDraft(buildDraft(null, activeFolderId));
    setDetailsOpen(false);
    setSaveMessage(null);
  };

  const handleSave = async (): Promise<void> => {
    if (saving || !stripHtml(draft.body).trim()) {
      return;
    }

    setSaving(true);
    setError(null);
    setSaveMessage(null);

    try {
      const reminderAt = draft.reminderAt ? new Date(draft.reminderAt).toISOString() : null;
      const reminderUntil = draft.reminderUntil ? new Date(`${draft.reminderUntil}T23:59:59`).toISOString() : null;
      const tags = parseTagString(draft.tags).filter((tag) => tag !== DISCUSSION_TAG);

      const payload = {
        title: draft.title.trim() || null,
        body: draft.body,
        bodyFormat: "rich_text" as const,
        entryType: draft.entryType,
        tags,
        flags: draft.flags,
        folderId: draft.folderId || null,
        reminderAt,
        reminderRepeatDays: draft.reminderRepeatDays ? Number(draft.reminderRepeatDays) : null,
        reminderUntil,
        entryDate: selectedEntry?.entryDate ?? new Date().toISOString(),
      };

      const saved = selectedEntry
        ? await updateEntry(householdId, selectedEntry.id, payload)
        : await createEntry(householdId, {
          ...payload,
          entityType,
          entityId,
        });

      if (isNotebookWorkspace) {
        await refreshWorkspace({ selectedEntryId: saved.id });
      } else {
        setEntries((current) => {
          const exists = current.some((entry) => entry.id === saved.id);
          return exists
            ? current.map((entry) => entry.id === saved.id ? saved : entry)
            : [saved, ...current];
        });
        setSelectedEntryId(saved.id);
      }

      setSaveMessage(selectedEntry ? "Saved." : "Note created.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save note.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!selectedEntry || saving || !confirm("Delete this note?")) {
      return;
    }

    setSaving(true);
    setError(null);
    setSaveMessage(null);

    try {
      await deleteEntry(householdId, selectedEntry.id);

      if (isNotebookWorkspace) {
        await refreshWorkspace({ selectedEntryId: null });
      } else {
        setEntries((current) => current.filter((entry) => entry.id !== selectedEntry.id));
        setSelectedEntryId(null);
      }

      setDraft(buildDraft(null, activeFolderId));
      setSaveMessage("Note deleted.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete note.");
    } finally {
      setSaving(false);
    }
  };

  const handleFolderSelect = useCallback((folderId: string | null): void => {
    setActiveFolderId(folderId);
    setSaveMessage(null);
  }, []);

  const handleCreateFolder = useCallback(async (name: string, parentFolderId?: string | null): Promise<void> => {
    await createNoteFolder(householdId, { name, parentFolderId: parentFolderId ?? null });
    await refreshWorkspace();
  }, [householdId, refreshWorkspace]);

  const handleRenameFolder = useCallback(async (folderId: string, name: string): Promise<void> => {
    await updateNoteFolder(householdId, folderId, { name });
    await refreshWorkspace();
  }, [householdId, refreshWorkspace]);

  const handleDeleteFolder = useCallback(async (folderId: string): Promise<void> => {
    await deleteNoteFolder(householdId, folderId);
    const nextFolderId = activeFolderId === folderId ? null : activeFolderId;

    if (activeFolderId === folderId) {
      setActiveFolderId(null);
    }

    await refreshWorkspace({
      folderId: nextFolderId,
      selectedEntryId: activeFolderId === folderId ? null : selectedEntryId,
    });
  }, [activeFolderId, householdId, refreshWorkspace, selectedEntryId]);

  const handleQuickCapture = useCallback(async (body: string): Promise<void> => {
    const created = await createEntry(householdId, {
      body: `<p>${body}</p>`,
      bodyFormat: "rich_text",
      entryDate: new Date().toISOString(),
      entityType,
      entityId,
      entryType: "note",
      flags: [],
      tags: [],
      measurements: [],
      folderId: activeFolderId,
    });

    await refreshWorkspace({ selectedEntryId: created.id });
  }, [activeFolderId, entityId, entityType, householdId, refreshWorkspace]);

  const handleTemplateSelect = useCallback(async (template: NoteTemplate): Promise<void> => {
    const created = await createEntry(householdId, {
      title: template.name,
      body: template.bodyTemplate,
      bodyFormat: "rich_text",
      entryDate: new Date().toISOString(),
      entityType,
      entityId,
      entryType: template.entryType as EntryType,
      flags: template.defaultFlags as EntryFlag[],
      tags: template.defaultTags,
      measurements: [],
      folderId: activeFolderId,
    });

    setShowTemplatePicker(false);
    await refreshWorkspace({ selectedEntryId: created.id });
  }, [activeFolderId, entityId, entityType, householdId, refreshWorkspace]);

  const currentTypeLabel = entryTypeOptions.find((option) => option.value === draft.entryType)?.label ?? draft.entryType;
  const currentTagCount = parseTagString(draft.tags).length;
  const hasActiveSearchFilters = Boolean(
    searchText.trim()
    || remindersOnly
    || actionableOnly
    || pinnedOnly
  );

  const clearFilters = (): void => {
    setSearchText("");
    setRemindersOnly(false);
    setActionableOnly(false);
    setPinnedOnly(false);
  };

  return (
    <section className={`entity-notes-workspace${compact ? " entity-notes-workspace--compact" : ""}`}>
      {isNotebookWorkspace && notebookOptions ? (
        <>
          <div className="entity-notes-workspace__notebook-tools">
            <div className="entity-notes-workspace__quick-capture">
              <QuickCapture onCapture={handleQuickCapture} />
            </div>
            <button
              type="button"
              className="button button--small"
              onClick={() => setShowTemplatePicker((current) => !current)}
            >
              {showTemplatePicker ? "Hide templates" : "Start from template"}
            </button>
            <Link href={notebookOptions.manageTemplatesHref} className="button button--ghost button--small">
              Manage Templates
            </Link>
          </div>

          {showTemplatePicker ? (
            <TemplatePicker
              templates={notebookOptions.templates}
              onSelect={(template) => { void handleTemplateSelect(template); }}
              onSkip={() => {
                setShowTemplatePicker(false);
                handleCreateNew();
              }}
            />
          ) : null}
        </>
      ) : null}

      <div className="entity-notes-workspace__toolbar">
        <input
          type="search"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder="Search notes…"
        />
        <label className="entity-notes-workspace__toggle">
          <input type="checkbox" checked={remindersOnly} onChange={(event) => setRemindersOnly(event.target.checked)} />
          <span>Reminders</span>
        </label>
        <label className="entity-notes-workspace__toggle">
          <input type="checkbox" checked={actionableOnly} onChange={(event) => setActionableOnly(event.target.checked)} />
          <span>Actionable</span>
        </label>
        <label className="entity-notes-workspace__toggle">
          <input type="checkbox" checked={pinnedOnly} onChange={(event) => setPinnedOnly(event.target.checked)} />
          <span>Pinned</span>
        </label>
        {activeFolder ? (
          <button
            type="button"
            className="button button--ghost button--sm"
            onClick={() => handleFolderSelect(null)}
          >
            All folders
          </button>
        ) : null}
        {hasActiveSearchFilters ? (
          <button type="button" className="button button--ghost button--sm" onClick={clearFilters}>
            Clear filters
          </button>
        ) : null}
        <button type="button" className="button button--primary button--sm" onClick={handleCreateNew}>New note</button>
      </div>

      {error ? <p className="workbench-error">{error}</p> : null}
      {saveMessage ? <p className="note">{saveMessage}</p> : null}

      <div className={`entity-notes-workspace__layout${isNotebookWorkspace ? " entity-notes-workspace__layout--notebook" : ""}`}>
        {isNotebookWorkspace ? (
          <aside className="entity-notes-workspace__folders">
            <NoteFolderTree
              folders={folders}
              activeFolderId={activeFolderId}
              onSelect={handleFolderSelect}
              onCreate={handleCreateFolder}
              onRename={handleRenameFolder}
              onDelete={handleDeleteFolder}
            />
          </aside>
        ) : null}

        <aside className="entity-notes-workspace__list">
          {loading ? (
            <div aria-hidden="true" style={{ display: "grid", gap: 8 }}>
              {[1, 2, 3].map((index) => (
                <div key={index} className="skeleton-bar" style={{ width: "100%", height: 72, borderRadius: 10 }} />
              ))}
            </div>
          ) : visibleEntries.length === 0 ? (
            <div className="entity-notes-workspace__empty">
              <p>{hasActiveSearchFilters || activeFolder ? "No notes match the current filters." : "No notes yet."}</p>
              <div className="entity-notes-workspace__empty-actions">
                <button type="button" className="button button--primary button--sm" onClick={handleCreateNew}>
                  New note
                </button>
                {isNotebookWorkspace && notebookOptions ? (
                  <button
                    type="button"
                    className="button button--ghost button--sm"
                    onClick={() => setShowTemplatePicker(true)}
                  >
                    Start from template
                  </button>
                ) : null}
                {hasActiveSearchFilters ? (
                  <button type="button" className="button button--ghost button--sm" onClick={clearFilters}>
                    Clear filters
                  </button>
                ) : null}
                {activeFolder ? (
                  <button
                    type="button"
                    className="button button--ghost button--sm"
                    onClick={() => handleFolderSelect(null)}
                  >
                    All folders
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="entity-notes-workspace__items">
              {visibleEntries.map((entry) => {
                const preview = truncate(stripHtml(entry.body), 160);
                const folderName = entry.folderId ? folders.find((folder) => folder.id === entry.folderId)?.name : null;

                return (
                  <button
                    key={entry.id}
                    type="button"
                    className={`entity-notes-workspace__item${selectedEntryId === entry.id ? " entity-notes-workspace__item--active" : ""}`}
                    onClick={() => handleSelectEntry(entry)}
                  >
                    <div className="entity-notes-workspace__item-top">
                      <strong>{entry.title?.trim() || "Untitled"}</strong>
                      <span>{entry.entryType}</span>
                    </div>
                    <p>{preview || "No preview yet."}</p>
                    <div className="entity-notes-workspace__item-meta">
                      {entry.reminderAt ? <span>🔔 Reminder</span> : null}
                      {entry.flags.includes("actionable") ? <span>Actionable</span> : null}
                      {entry.flags.includes("pinned") ? <span>Pinned</span> : null}
                      {folderName ? <span>{folderName}</span> : null}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        <div className="entity-notes-workspace__editor">
          {selectedEntry ? (
            <div className="entity-notes-workspace__editor-bar">
              <Link
                href={`/notes/${selectedEntry.id}?householdId=${householdId}&backTo=${encodeURIComponent(backToHref)}`}
                className="button button--ghost button--sm"
              >
                Open full page
              </Link>
            </div>
          ) : null}

          <label className="field field--full">
            <span>Title</span>
            <input
              value={draft.title}
              onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
              placeholder="Note title"
            />
          </label>

          <div className="entity-notes-workspace__editor-summary">
            <div className="entity-notes-workspace__editor-chips">
              <span className="pill pill--muted">{currentTypeLabel}</span>
              {draft.reminderAt ? <span className="pill pill--warning">Reminder set</span> : null}
              {draft.flags.length > 0 ? <span className="pill pill--muted">{draft.flags.length} flag{draft.flags.length === 1 ? "" : "s"}</span> : null}
              {currentTagCount > 0 ? <span className="pill pill--muted">{currentTagCount} tag{currentTagCount === 1 ? "" : "s"}</span> : null}
            </div>
            <button
              type="button"
              className="button button--ghost button--sm"
              onClick={() => setDetailsOpen((current) => !current)}
            >
              {detailsOpen ? "Hide details" : "Details"}
            </button>
          </div>

          <RichEditor
            content={draft.body}
            onChange={(body) => setDraft((current) => ({ ...current, body }))}
            debounceMs={0}
            placeholder="Write the note, reminder, checklist, or reference you want to keep…"
          />

          {detailsOpen ? (
            <section className="entity-notes-workspace__details">
              <div className="entity-notes-workspace__form-grid">
                <label className="field">
                  <span>Type</span>
                  <select
                    value={draft.entryType}
                    onChange={(event) => setDraft((current) => ({ ...current, entryType: event.target.value as EntryType }))}
                  >
                    {entryTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Folder</span>
                  <select
                    value={draft.folderId}
                    onChange={(event) => setDraft((current) => ({ ...current, folderId: event.target.value }))}
                  >
                    <option value="">No folder</option>
                    {folders.map((folder) => (
                      <option key={folder.id} value={folder.id}>{folder.name}</option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Reminder</span>
                  <input
                    type="datetime-local"
                    value={draft.reminderAt}
                    onChange={(event) => setDraft((current) => ({ ...current, reminderAt: event.target.value }))}
                  />
                </label>

                <label className="field">
                  <span>Repeat</span>
                  <select
                    value={draft.reminderRepeatDays}
                    onChange={(event) => setDraft((current) => ({ ...current, reminderRepeatDays: event.target.value }))}
                  >
                    {repeatOptions.map((option) => (
                      <option key={option.label} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>

                <label className="field field--full">
                  <span>Repeat Until</span>
                  <input
                    type="date"
                    value={draft.reminderUntil}
                    onChange={(event) => setDraft((current) => ({ ...current, reminderUntil: event.target.value }))}
                  />
                </label>

                <label className="field field--full">
                  <span>Tags</span>
                  <input
                    value={draft.tags}
                    onChange={(event) => setDraft((current) => ({ ...current, tags: event.target.value }))}
                    placeholder="Comma-separated tags"
                  />
                </label>

                <div className="field field--full">
                  <span>Flags</span>
                  <div className="entity-notes-workspace__flags">
                    {flagOptions.map((flag) => {
                      const active = draft.flags.includes(flag.value);
                      return (
                        <button
                          key={flag.value}
                          type="button"
                          className={`entity-notes-workspace__flag${active ? " entity-notes-workspace__flag--active" : ""}`}
                          onClick={() => setDraft((current) => ({
                            ...current,
                            flags: current.flags.includes(flag.value)
                              ? current.flags.filter((value) => value !== flag.value)
                              : [...current.flags, flag.value],
                          }))}
                        >
                          {flag.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {selectedEntry && stripHtml(selectedEntry.body).trim() ? (
            <details className="entity-notes-workspace__preview">
              <summary>Current saved preview</summary>
              <RichEditorDisplay content={selectedEntry.body} bodyFormat={selectedEntry.bodyFormat} />
            </details>
          ) : null}

          <div className="entity-notes-workspace__actions">
            {selectedEntry ? (
              <button type="button" className="button button--ghost" onClick={handleDelete} disabled={saving}>
                Delete
              </button>
            ) : null}
            <button type="button" className="button button--ghost" onClick={handleCreateNew} disabled={saving}>
              Reset
            </button>
            <button type="button" className="button button--primary" onClick={() => { void handleSave(); }} disabled={saving || !stripHtml(draft.body).trim()}>
              {saving ? "Saving…" : (selectedEntry ? "Save Note" : "Create Note")}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
