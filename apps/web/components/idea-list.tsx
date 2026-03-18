"use client";

import Link from "next/link";
import type { JSX } from "react";
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "lifekeeper_ideas";

type StoredIdea = {
  id: string;
  title: string;
  description: string;
  materials: { name: string; quantity: string; notes: string }[];
  tasks: { label: string }[];
  escalateTo: string;
  createdAt: string;
};

const escalateLabels: Record<string, string> = {
  project: "Project",
  asset: "Asset",
  hobby: "Hobby",
};

const escalateHrefs: Record<string, string> = {
  project: "/projects/new",
  asset: "/assets/new",
  hobby: "/hobbies/new",
};

export function IdeaList(): JSX.Element {
  const [ideas, setIdeas] = useState<StoredIdea[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setIdeas(JSON.parse(stored));
      } catch {
        // ignore parse errors
      }
    }
    setLoaded(true);
  }, []);

  const removeIdea = useCallback((id: string) => {
    setIdeas((prev) => {
      const next = prev.filter((idea) => idea.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  if (!loaded) {
    return (
      <section className="panel">
        <div className="panel__body">
          <div className="skeleton-bar" style={{ width: "100%", height: 60 }} />
        </div>
      </section>
    );
  }

  if (ideas.length === 0) {
    return (
      <section className="panel">
        <div className="panel__body">
          <p className="panel__empty">
            No ideas captured yet.{" "}
            <Link href="/ideas/new" className="text-link">
              Capture your first idea
            </Link>{" "}
            to get started.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel__header">
        <h2>All Ideas ({ideas.length})</h2>
      </div>
      <div className="panel__body" style={{ padding: 0 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Idea</th>
              <th>Materials</th>
              <th>Tasks</th>
              <th>Escalate To</th>
              <th>Captured</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {ideas.map((idea) => (
              <tr key={idea.id}>
                <td>
                  <div className="data-table__primary">{idea.title}</div>
                  {idea.description && (
                    <div className="data-table__secondary">
                      {idea.description.length > 80
                        ? `${idea.description.slice(0, 80)}...`
                        : idea.description}
                    </div>
                  )}
                </td>
                <td>{idea.materials.length || "-"}</td>
                <td>{idea.tasks.length || "-"}</td>
                <td>
                  {idea.escalateTo ? (
                    <Link
                      href={escalateHrefs[idea.escalateTo] ?? "#"}
                      className="status-chip status-chip--upcoming"
                    >
                      {escalateLabels[idea.escalateTo] ?? idea.escalateTo}
                    </Link>
                  ) : (
                    <span className="status-chip status-chip--clear">
                      Undecided
                    </span>
                  )}
                </td>
                <td>
                  {new Date(idea.createdAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </td>
                <td>
                  <button
                    type="button"
                    className="button button--ghost button--sm"
                    onClick={() => removeIdea(idea.id)}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
