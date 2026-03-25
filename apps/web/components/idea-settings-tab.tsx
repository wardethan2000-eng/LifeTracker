"use client";

import { useRouter } from "next/navigation";
import { useState, type JSX } from "react";
import { bulkArchiveIdeas, deleteIdea as apiDeleteIdea, updateIdea } from "../lib/api";

type IdeaSettingsTabProps = {
  householdId: string;
  ideaId: string;
  ideaTitle: string;
  isArchived: boolean;
};

export function IdeaSettingsTab({ householdId, ideaId, ideaTitle, isArchived }: IdeaSettingsTabProps): JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleArchive = async () => {
    if (!confirm(`Archive "${ideaTitle}"? It will be moved to the trash.`)) return;
    setBusy(true);
    setError(null);
    try {
      await bulkArchiveIdeas(householdId, [ideaId]);
      router.push("/ideas");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Archive failed");
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async () => {
    setBusy(true);
    setError(null);
    try {
      await updateIdea(householdId, ideaId, { stage: "spark" });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Restore failed");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Permanently delete "${ideaTitle}"? This cannot be undone.`)) return;
    setBusy(true);
    setError(null);
    try {
      await apiDeleteIdea(householdId, ideaId);
      router.push("/ideas");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel panel--danger">
      <div className="panel__header">
        <h2>Danger Zone</h2>
      </div>
      <div className="panel__body--padded">
        {error && <p style={{ color: "var(--danger)", marginBottom: 12 }}>{error}</p>}

        {isArchived ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <p style={{ fontWeight: 600, marginBottom: 4 }}>Restore Idea</p>
              <p style={{ fontSize: "0.88rem", color: "var(--ink-muted)" }}>
                Move this idea out of the trash and back to the Spark stage.
              </p>
              <button
                type="button"
                className="button button--ghost button--sm"
                disabled={busy}
                onClick={handleRestore}
                style={{ marginTop: 8 }}
              >
                {busy ? "Restoring…" : "Restore"}
              </button>
            </div>
            <div>
              <p style={{ fontWeight: 600, marginBottom: 4 }}>Permanently Delete</p>
              <p style={{ fontSize: "0.88rem", color: "var(--ink-muted)" }}>
                This idea and all associated data will be permanently removed.
              </p>
              <button
                type="button"
                className="button button--danger button--sm"
                disabled={busy}
                onClick={handleDelete}
                style={{ marginTop: 8 }}
              >
                {busy ? "Deleting…" : "Permanently Delete"}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p style={{ fontWeight: 600, marginBottom: 4 }}>Archive Idea</p>
            <p style={{ fontSize: "0.88rem", color: "var(--ink-muted)" }}>
              Move this idea to the trash. You can restore it later.
            </p>
            <button
              type="button"
              className="button button--danger button--sm"
              disabled={busy}
              onClick={handleArchive}
              style={{ marginTop: 8 }}
            >
              {busy ? "Archiving…" : "Archive"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
