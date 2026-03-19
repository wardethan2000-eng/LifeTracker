"use client";

import type { Entry, NoteFolder } from "@lifekeeper/types";
import type { JSX } from "react";
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
import { NoteFolderTree } from "./note-folder-tree";
import { NoteList } from "./note-list";
import { QuickCapture } from "./quick-capture";

type FolderWithCounts = NoteFolder & { entryCount: number; childCount: number };

type NotesHubProps = {
  householdId: string;
  initialFolders: FolderWithCounts[];
  initialEntries: Entry[];
};

export function NotesHub({ householdId, initialFolders, initialEntries }: NotesHubProps): JSX.Element {
  const [folders, setFolders] = useState<FolderWithCounts[]>(initialFolders);
  const [entries, setEntries] = useState<Entry[]>(initialEntries);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refreshFolders = useCallback(async () => {
    const updated = await getNoteFolders(householdId);
    setFolders(updated);
  }, [householdId]);

  const refreshEntries = useCallback(async (folderId: string | null) => {
    setLoading(true);
    try {
      const query: Record<string, string> = {
        entityType: "notebook",
        entityId: householdId,
      };
      if (folderId) {
        query.folderId = folderId;
      }
      const result = await getEntries(householdId, {
        entityType: "notebook",
        entityId: householdId,
      });
      // Client-side folder filtering since the API doesn't have folderId query param
      const filtered = folderId
        ? result.items.filter((e) => (e as Entry & { folderId?: string | null }).folderId === folderId)
        : result.items;
      setEntries(filtered);
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
      body,
      bodyFormat: "plain_text",
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

  const activeFolder = activeFolderId
    ? folders.find((f) => f.id === activeFolderId) ?? null
    : null;

  return (
    <div className="notes-hub">
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
        <QuickCapture onCapture={handleQuickCapture} />
        <NoteList
          householdId={householdId}
          entries={entries}
          loading={loading}
          activeFolder={activeFolder}
          onDelete={handleDeleteEntry}
        />
      </div>
    </div>
  );
}
