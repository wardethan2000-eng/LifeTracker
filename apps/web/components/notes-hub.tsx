"use client";

import type { IdeaCanvasThumbnail, NoteFolder, NoteTemplate, Entry } from "@lifekeeper/types";
import type { JSX } from "react";
import Link from "next/link";
import { useCallback, useState } from "react";
import {
  createEntry,
  createNoteFolder,
  deleteEntry,
  deleteNoteFolder,
  getEntries,
  getNoteFolders,
  updateNoteFolder,
} from "../lib/api";
import { CanvasList } from "./canvas-list";
import { NoteFolderTree } from "./note-folder-tree";
import { NoteList } from "./note-list";
import { QuickCapture } from "./quick-capture";
import { TemplatePicker } from "./template-picker";

type FolderWithCounts = NoteFolder & { entryCount: number; childCount: number };

type NotesHubProps = {
  householdId: string;
  initialFolders: FolderWithCounts[];
  initialEntries: Entry[];
  templates: NoteTemplate[];
  canvases: IdeaCanvasThumbnail[];
  initialTab?: "notes" | "canvases";
};

export function NotesHub({ householdId, initialFolders, initialEntries, templates, canvases, initialTab = "notes" }: NotesHubProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<"notes" | "canvases">(initialTab);
  const [folders, setFolders] = useState<FolderWithCounts[]>(initialFolders);
  const [entries, setEntries] = useState<Entry[]>(initialEntries);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);

  const refreshFolders = useCallback(async () => {
    const updated = await getNoteFolders(householdId);
    setFolders(updated);
  }, [householdId]);

  const refreshEntries = useCallback(async (folderId: string | null) => {
    setLoading(true);
    try {
      const result = await getEntries(householdId, {
        entityType: "notebook",
        entityId: householdId,
        ...(folderId !== null ? { folderId } : {}),
      });
      setEntries(result.items);
    } finally {
      setLoading(false);
    }
  }, [householdId]);

  const handleFolderSelect = useCallback(async (folderId: string | null) => {
    setActiveFolderId(folderId);
    await refreshEntries(folderId);
  }, [refreshEntries]);

  const handleCreateFolder = useCallback(async (name: string, parentFolderId?: string | null) => {
    await createNoteFolder(householdId, { name, parentFolderId: parentFolderId ?? null });
    await refreshFolders();
  }, [householdId, refreshFolders]);

  const handleRenameFolder = useCallback(async (folderId: string, name: string) => {
    await updateNoteFolder(householdId, folderId, { name });
    await refreshFolders();
  }, [householdId, refreshFolders]);

  const handleDeleteFolder = useCallback(async (folderId: string) => {
    await deleteNoteFolder(householdId, folderId);
    if (activeFolderId === folderId) {
      setActiveFolderId(null);
    }
    await Promise.all([refreshFolders(), refreshEntries(null)]);
  }, [householdId, activeFolderId, refreshFolders, refreshEntries]);

  const handleQuickCapture = useCallback(async (body: string) => {
    await createEntry(householdId, {
      body: `<p>${body}</p>`,
      bodyFormat: "rich_text",
      entryDate: new Date().toISOString(),
      entityType: "notebook",
      entityId: householdId,
      entryType: "note",
      flags: [],
      tags: [],
      measurements: [],
      folderId: activeFolderId,
    });
    await Promise.all([refreshEntries(activeFolderId), refreshFolders()]);
  }, [householdId, activeFolderId, refreshEntries, refreshFolders]);

  const handleDeleteEntry = useCallback(async (entryId: string) => {
    await deleteEntry(householdId, entryId);
    await Promise.all([refreshEntries(activeFolderId), refreshFolders()]);
  }, [householdId, activeFolderId, refreshEntries, refreshFolders]);

  const handleTemplateSelect = useCallback(async (template: NoteTemplate) => {
    await createEntry(householdId, {
      title: template.name,
      body: template.bodyTemplate,
      bodyFormat: "rich_text",
      entryDate: new Date().toISOString(),
      entityType: "notebook",
      entityId: householdId,
      entryType: template.entryType as "note",
      flags: template.defaultFlags as ("important" | "actionable" | "resolved" | "pinned" | "tip" | "warning" | "archived")[],
      tags: template.defaultTags,
      measurements: [],
      folderId: activeFolderId,
    });
    setShowTemplatePicker(false);
    await Promise.all([refreshEntries(activeFolderId), refreshFolders()]);
  }, [householdId, activeFolderId, refreshEntries, refreshFolders]);

  const activeFolder = activeFolderId
    ? folders.find((f) => f.id === activeFolderId) ?? null
    : null;

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
        <div className="notes-hub__content">
          <div className="notes-hub__sidebar">
            <NoteFolderTree
              folders={folders}
              activeFolderId={activeFolderId}
              onSelect={handleFolderSelect}
              onCreate={handleCreateFolder}
              onRename={handleRenameFolder}
              onDelete={handleDeleteFolder}
            />
          </div>
          <div className="notes-hub__main">
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <QuickCapture onCapture={handleQuickCapture} />
              </div>
              <button
                type="button"
                className="button button--small"
                onClick={() => setShowTemplatePicker(!showTemplatePicker)}
              >
                {showTemplatePicker ? "Cancel" : "From Template"}
              </button>
              <Link href="/notes/templates" className="button button--ghost button--small">
                Manage Templates
              </Link>
            </div>
            {showTemplatePicker ? (
              <TemplatePicker
                templates={templates}
                onSelect={handleTemplateSelect}
                onSkip={() => setShowTemplatePicker(false)}
              />
            ) : null}
            <NoteList
              householdId={householdId}
              entries={entries}
              loading={loading}
              activeFolder={activeFolder}
              onDelete={handleDeleteEntry}
            />
          </div>
        </div>
      )}
    </div>
  );
}
