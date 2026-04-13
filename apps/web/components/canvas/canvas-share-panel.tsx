"use client";

import { useState, useCallback, type JSX } from "react";
import type { CanvasShareLink, CanvasSharePermission } from "@aegis/types";
import {
  getCanvasShareLinks,
  createCanvasShareLink,
  updateCanvasShareLink,
  deleteCanvasShareLink,
} from "../../lib/api";

interface CanvasSharePanelProps {
  householdId: string;
  canvasId: string;
  onClose: () => void;
}

export default function CanvasSharePanel({
  householdId,
  canvasId,
  onClose,
}: CanvasSharePanelProps): JSX.Element {
  const [links, setLinks] = useState<CanvasShareLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Load links on mount
  const loadLinks = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getCanvasShareLinks(householdId, canvasId);
      setLinks(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load share links");
    } finally {
      setLoading(false);
    }
  }, [householdId, canvasId]);

  // Load on first render
  useState(() => { loadLinks(); });

  const handleCreate = async (permission: CanvasSharePermission = "view") => {
    try {
      setCreating(true);
      const link = await createCanvasShareLink(householdId, canvasId, { permission });
      setLinks(prev => [link, ...prev]);
      setError(null);
      // Auto-copy the new link
      copyToClipboard(link);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create share link");
    } finally {
      setCreating(false);
    }
  };

  const handleTogglePermission = async (link: CanvasShareLink) => {
    const newPerm: CanvasSharePermission = link.permission === "view" ? "edit" : "view";
    try {
      const updated = await updateCanvasShareLink(householdId, canvasId, link.id, { permission: newPerm });
      setLinks(prev => prev.map(l => l.id === link.id ? updated : l));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update link");
    }
  };

  const handleDelete = async (linkId: string) => {
    try {
      await deleteCanvasShareLink(householdId, canvasId, linkId);
      setLinks(prev => prev.filter(l => l.id !== linkId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete link");
    }
  };

  const copyToClipboard = (link: CanvasShareLink) => {
    const url = `${window.location.origin}/shared/canvas/${link.token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(link.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div className="canvas-share-panel">
      <div className="canvas-share-panel__header">
        <h3>Share Canvas</h3>
        <button type="button" className="button--ghost button--xs" onClick={onClose}>✕</button>
      </div>

      {error && <p style={{ color: "var(--tone-danger, red)", fontSize: "0.8rem", margin: "0 0 0.5rem" }}>{error}</p>}

      <div className="canvas-share-panel__actions">
        <button
          type="button"
          className="button button--sm"
          onClick={() => handleCreate("view")}
          disabled={creating}
        >
          {creating ? "Creating…" : "Create view-only link"}
        </button>
        <button
          type="button"
          className="button button--sm button--subtle"
          onClick={() => handleCreate("edit")}
          disabled={creating}
        >
          {creating ? "Creating…" : "Create editable link"}
        </button>
      </div>

      {loading ? (
        <p className="note" style={{ padding: "0.5rem 0" }}>Loading…</p>
      ) : links.length === 0 ? (
        <div className="canvas-share-panel__empty">
          <p className="note">No share links yet. Create one to share this canvas.</p>
        </div>
      ) : (
        <ul className="canvas-share-panel__list">
          {links.map(link => (
            <li key={link.id} className="canvas-share-panel__link">
              <div className="canvas-share-panel__link-info">
                <span className={`pill pill--xs ${link.permission === "edit" ? "pill--warning" : "pill--info"}`}>
                  {link.permission}
                </span>
                <span className="canvas-share-panel__date">{formatDate(link.createdAt)}</span>
                {link.expiresAt && (
                  <span className="canvas-share-panel__expiry">
                    expires {formatDate(link.expiresAt)}
                  </span>
                )}
              </div>
              <div className="canvas-share-panel__link-actions">
                <button
                  type="button"
                  className="button--ghost button--xs"
                  onClick={() => copyToClipboard(link)}
                  title="Copy link"
                >
                  {copiedId === link.id ? "✓ Copied" : "Copy"}
                </button>
                <button
                  type="button"
                  className="button--ghost button--xs"
                  onClick={() => handleTogglePermission(link)}
                  title={`Switch to ${link.permission === "view" ? "edit" : "view"}`}
                >
                  → {link.permission === "view" ? "edit" : "view"}
                </button>
                <button
                  type="button"
                  className="button--ghost button--xs"
                  style={{ color: "var(--tone-danger)" }}
                  onClick={() => handleDelete(link.id)}
                  title="Revoke link"
                >
                  Revoke
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
