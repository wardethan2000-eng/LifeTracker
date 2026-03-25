"use client";

import type { NoteFolder } from "@lifekeeper/types";
import type { JSX } from "react";
import { useCallback, useState } from "react";

type FolderWithCounts = NoteFolder & { entryCount: number; childCount: number };

type NoteFolderTreeProps = {
  folders: FolderWithCounts[];
  activeFolderId: string | null;
  onSelect: (folderId: string | null) => void;
  onCreate: (name: string, parentFolderId?: string | null) => Promise<void>;
  onRename: (folderId: string, name: string) => Promise<void>;
  onDelete: (folderId: string) => Promise<void>;
};

type TreeNode = FolderWithCounts & { children: TreeNode[] };

function buildTree(folders: FolderWithCounts[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  for (const f of folders) {
    map.set(f.id, { ...f, children: [] });
  }

  for (const f of folders) {
    const node = map.get(f.id)!;
    if (f.parentFolderId && map.has(f.parentFolderId)) {
      map.get(f.parentFolderId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function FolderNode({
  node,
  depth,
  activeFolderId,
  onSelect,
  onRename,
  onDelete,
  onCreate,
}: {
  node: TreeNode;
  depth: number;
  activeFolderId: string | null;
  onSelect: (id: string) => void;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onCreate: (name: string, parentId: string) => Promise<void>;
}): JSX.Element {
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(node.name);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [creatingChild, setCreatingChild] = useState(false);
  const [childName, setChildName] = useState("");
  const isActive = activeFolderId === node.id;

  const handleRename = useCallback(async () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== node.name) {
      await onRename(node.id, trimmed);
    }
    setEditing(false);
    setActionsOpen(false);
  }, [editName, node.id, node.name, onRename]);

  const handleCreateChild = useCallback(async () => {
    const trimmed = childName.trim();
    if (trimmed) {
      await onCreate(trimmed, node.id);
      setChildName("");
      setCreatingChild(false);
      setActionsOpen(false);
    }
  }, [childName, node.id, onCreate]);

  const handleDelete = useCallback(async () => {
    await onDelete(node.id);
    setConfirmingDelete(false);
    setActionsOpen(false);
  }, [node.id, onDelete]);

  return (
    <li className="folder-tree__item">
      <div
        className={`folder-tree__row${isActive ? " folder-tree__row--active" : ""}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {node.children.length > 0 ? (
          <button
            className="folder-tree__toggle"
            onClick={() => setExpanded(!expanded)}
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            <svg
              width="10" height="10" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round"
              aria-hidden="true"
              style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 150ms" }}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        ) : (
          <span className="folder-tree__toggle-spacer" />
        )}

        {editing ? (
          <input
            className="folder-tree__rename-input"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleRename();
              if (e.key === "Escape") { setEditing(false); setEditName(node.name); }
            }}
            autoFocus
          />
        ) : (
          <button
            className="folder-tree__label"
            onClick={() => onSelect(node.id)}
          >
            <span className="folder-tree__icon" style={node.color ? { color: node.color } : undefined}>
              {node.icon ?? "📁"}
            </span>
            <span className="folder-tree__name">{node.name}</span>
            {node.entryCount > 0 && (
              <span className="folder-tree__count">{node.entryCount}</span>
            )}
          </button>
        )}

        {!editing && (
          <button
            className="folder-tree__menu-btn"
            aria-label="Folder actions"
            aria-expanded={actionsOpen}
            onClick={() => { setActionsOpen(!actionsOpen); setConfirmingDelete(false); }}
          >
            ⋮
          </button>
        )}

        {actionsOpen && !editing && (
          <span className="folder-tree__actions">
            {depth < 2 && (
              <button
                className="folder-tree__action"
                onClick={() => { setCreatingChild(true); setActionsOpen(false); }}
                title="Add subfolder"
              >
                +
              </button>
            )}
            <button
              className="folder-tree__action"
              onClick={() => { setEditing(true); setEditName(node.name); setActionsOpen(false); }}
              title="Rename"
            >
              ✎
            </button>
            <button
              className="folder-tree__action folder-tree__action--danger"
              onClick={() => { setConfirmingDelete(true); setActionsOpen(false); }}
              title="Delete"
            >
              ×
            </button>
          </span>
        )}
      </div>

      {confirmingDelete && (
        <div className="folder-tree__confirm" style={{ paddingLeft: `${depth * 16 + 28}px` }}>
          <span className="folder-tree__confirm-label">Delete &ldquo;{node.name}&rdquo;? Notes move to root.</span>
          <span className="folder-tree__confirm-actions">
            <button
              className="folder-tree__action folder-tree__action--danger"
              onClick={() => void handleDelete()}
            >
              Delete
            </button>
            <button
              className="folder-tree__action"
              onClick={() => setConfirmingDelete(false)}
            >
              Cancel
            </button>
          </span>
        </div>
      )}

      {creatingChild && (
        <div className="folder-tree__create" style={{ paddingLeft: `${depth * 16 + 28}px` }}>
          <input
            className="folder-tree__rename-input"
            placeholder="Subfolder name…"
            value={childName}
            onChange={(e) => setChildName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleCreateChild();
              if (e.key === "Escape") { setCreatingChild(false); setChildName(""); }
            }}
            autoFocus
          />
          <button className="button button--small button--primary" onClick={() => void handleCreateChild()}>
            Add
          </button>
          <button className="button button--small button--ghost" onClick={() => { setCreatingChild(false); setChildName(""); }}>
            Cancel
          </button>
        </div>
      )}

      {expanded && node.children.length > 0 && (
        <ul className="folder-tree__children">
          {node.children.map((child) => (
            <FolderNode
              key={child.id}
              node={child}
              depth={depth + 1}
              activeFolderId={activeFolderId}
              onSelect={onSelect}
              onRename={onRename}
              onDelete={onDelete}
              onCreate={onCreate}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function NoteFolderTree({
  folders,
  activeFolderId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: NoteFolderTreeProps): JSX.Element {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const tree = buildTree(folders);

  const totalNotes = folders.reduce((sum, f) => sum + f.entryCount, 0);

  const handleCreate = useCallback(async () => {
    const trimmed = newName.trim();
    if (trimmed) {
      await onCreate(trimmed);
      setNewName("");
      setCreating(false);
    }
  }, [newName, onCreate]);

  return (
    <div className="folder-tree">
      <div className="folder-tree__header">
        <span className="folder-tree__title">Folders</span>
        <button
          className="folder-tree__add-btn"
          onClick={() => setCreating(true)}
          title="New folder"
        >
          +
        </button>
      </div>

      <ul className="folder-tree__list">
        <li className="folder-tree__item">
          <button
            className={`folder-tree__row folder-tree__label${activeFolderId === null ? " folder-tree__row--active" : ""}`}
            onClick={() => onSelect(null)}
            style={{ paddingLeft: "8px" }}
          >
            <span className="folder-tree__icon">📋</span>
            <span className="folder-tree__name">All Notes</span>
            {totalNotes > 0 && (
              <span className="folder-tree__count">{totalNotes}</span>
            )}
          </button>
        </li>

        {tree.map((node) => (
          <FolderNode
            key={node.id}
            node={node}
            depth={0}
            activeFolderId={activeFolderId}
            onSelect={onSelect}
            onRename={onRename}
            onDelete={onDelete}
            onCreate={onCreate}
          />
        ))}
      </ul>

      {creating && (
        <div className="folder-tree__create">
          <input
            className="folder-tree__rename-input"
            placeholder="Folder name…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleCreate();
              if (e.key === "Escape") { setCreating(false); setNewName(""); }
            }}
            autoFocus
          />
          <button className="button button--small button--primary" onClick={() => void handleCreate()}>
            Add
          </button>
        </div>
      )}
    </div>
  );
}
