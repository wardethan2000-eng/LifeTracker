"use client";

import type { JSX } from "react";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createIdeaAction } from "../app/actions";

const STORAGE_KEY = "aegis_ideas";
const MIGRATED_KEY = "aegis_ideas_migrated";

type StoredIdea = {
  title?: string;
  description?: string;
  materials?: Array<{ name?: string; quantity?: string; notes?: string }>;
  tasks?: Array<{ label?: string; done?: boolean }>;
  escalateTo?: string;
};

type IdeaLocalMigrationProps = {
  householdId: string;
};

export function IdeaLocalMigration({ householdId }: IdeaLocalMigrationProps): JSX.Element | null {
  const router = useRouter();
  const [storedIdeas, setStoredIdeas] = useState<StoredIdea[]>([]);
  const [visible, setVisible] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    try {
      const migrated = localStorage.getItem(MIGRATED_KEY);
      if (migrated === "true") return;

      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) return;

      setStoredIdeas(parsed as StoredIdea[]);
      setVisible(true);
    } catch {
      // Malformed data — ignore gracefully
    }
  }, []);

  const handleImport = useCallback(async () => {
    setImporting(true);
    const total = storedIdeas.length;

    for (let i = 0; i < total; i++) {
      setProgress({ current: i + 1, total });
      const stored = storedIdeas[i];
      if (!stored) continue;

      const title = (stored.title ?? "").trim();
      if (!title) continue;

      const promotionTarget =
        stored.escalateTo === "project" || stored.escalateTo === "asset" || stored.escalateTo === "hobby"
          ? stored.escalateTo
          : undefined;

      const materials = Array.isArray(stored.materials)
        ? stored.materials
            .filter((m) => m && typeof m.name === "string" && m.name.trim())
            .map((m) => ({
              name: (m.name ?? "").trim(),
              quantity: (m.quantity ?? "").trim(),
              notes: (m.notes ?? "").trim(),
            }))
        : undefined;

      const steps = Array.isArray(stored.tasks)
        ? stored.tasks
            .filter((t) => t && typeof t.label === "string" && t.label.trim())
            .map((t) => ({ label: (t.label ?? "").trim() }))
        : undefined;

      try {
        await createIdeaAction(householdId, {
          title,
          description: stored.description?.trim() || undefined,
          stage: "spark",
          promotionTarget,
          materials: materials && materials.length > 0 ? materials : undefined,
          steps: steps && steps.length > 0 ? steps : undefined,
        });
      } catch {
        // Continue with remaining ideas if one fails
      }
    }

    localStorage.setItem(MIGRATED_KEY, "true");
    setDone(true);
    setImporting(false);
    router.refresh();
  }, [storedIdeas, householdId, router]);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(MIGRATED_KEY, "true");
    setVisible(false);
  }, []);

  if (!visible) return null;

  if (done) {
    return (
      <div className="migration-banner">
        All ideas imported!
      </div>
    );
  }

  return (
    <div className="migration-banner">
      <div>
        You have <strong>{storedIdeas.length}</strong> idea{storedIdeas.length !== 1 ? "s" : ""} saved locally from before the upgrade.
      </div>
      <div style={{ fontSize: "0.78rem", color: "var(--ink-muted)", marginTop: 2 }}>
        These will be created as new Spark-stage ideas.
      </div>
      {progress && importing && (
        <div className="migration-banner__progress">
          Importing {progress.current}/{progress.total}…
        </div>
      )}
      <div className="migration-banner__actions">
        <button
          type="button"
          className="button button--primary button--sm"
          onClick={handleImport}
          disabled={importing}
        >
          {importing ? "Importing…" : "Import to your account"}
        </button>
        <button
          type="button"
          className="button button--ghost button--sm"
          onClick={handleDismiss}
          disabled={importing}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
