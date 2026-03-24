"use client";

import Link from "next/link";
import type { JSX } from "react";
import { useCallback, useMemo, useState, useTransition } from "react";
import type { IdeaCategory, IdeaPriority, IdeaStage, IdeaSummary } from "@lifekeeper/types";
import { updateIdeaStageAction, deleteIdeaAction } from "../app/actions";
import { useMultiSelect } from "../lib/use-multi-select";
import { useFormattedDate } from "../lib/formatted-date";
import { BulkActionBar } from "./bulk-action-bar";
import { IdeaBulkActions } from "./idea-bulk-actions";

type ViewMode = "board" | "table";

const stageLabels: Record<IdeaStage, string> = {
  spark: "Spark",
  developing: "Developing",
  ready: "Ready",
};

const stageOrder: IdeaStage[] = ["spark", "developing", "ready"];

const priorityLabels: Record<IdeaPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

const categoryLabels: Record<IdeaCategory, string> = {
  home_improvement: "Home Improvement",
  vehicle: "Vehicle",
  outdoor: "Outdoor",
  technology: "Technology",
  hobby_craft: "Hobby / Craft",
  financial: "Financial",
  health: "Health",
  travel: "Travel",
  learning: "Learning",
  other: "Other",
};

type IdeaListProps = {
  ideas: IdeaSummary[];
  householdId: string;
};

export function IdeaList({ ideas, householdId }: IdeaListProps): JSX.Element {
  const { formatDate } = useFormattedDate();
  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [stageFilter, setStageFilter] = useState<IdeaStage | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<IdeaStage | null>(null);
  const [stageMenu, setStageMenu] = useState<string | null>(null);

  const { selectedCount, isSelected, toggleItem, toggleGroup, clearSelection } = useMultiSelect();

  const filteredIdeas = useMemo(() => {
    return ideas.filter((idea) => {
      if (idea.archivedAt) return false;
      if (stageFilter !== "all" && idea.stage !== stageFilter) return false;
      if (categoryFilter !== "all" && idea.category !== categoryFilter) return false;
      if (priorityFilter !== "all" && idea.priority !== priorityFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (
          !idea.title.toLowerCase().includes(q) &&
          !(idea.description ?? "").toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [ideas, stageFilter, categoryFilter, priorityFilter, searchQuery]);

  const allFilteredIds = useMemo(() => filteredIdeas.map((i) => i.id), [filteredIdeas]);
  const allSelected = selectedCount > 0 && allFilteredIds.every((id) => isSelected(id));
  const selectedItems = useMemo(
    () => filteredIdeas.filter((i) => isSelected(i.id)),
    [filteredIdeas, isSelected]
  );

  const handleStageChange = useCallback(
    (ideaId: string, newStage: IdeaStage) => {
      startTransition(async () => {
        await updateIdeaStageAction(householdId, ideaId, newStage);
      });
    },
    [householdId]
  );

  const handleDelete = useCallback(
    (ideaId: string) => {
      if (!confirm("Archive this idea?")) return;
      startTransition(async () => {
        await deleteIdeaAction(householdId, ideaId);
      });
    },
    [householdId]
  );

  const handleDragStart = useCallback((e: React.DragEvent, ideaId: string) => {
    e.dataTransfer.setData("text/plain", ideaId);
    e.dataTransfer.effectAllowed = "move";
    setDraggingId(ideaId);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingId(null);
    setDragOverColumn(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, stage: IdeaStage) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(stage);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverColumn(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, stage: IdeaStage) => {
      e.preventDefault();
      setDragOverColumn(null);
      const ideaId = e.dataTransfer.getData("text/plain");
      if (!ideaId) return;
      const idea = ideas.find((i) => i.id === ideaId);
      if (idea && idea.stage !== stage) {
        handleStageChange(ideaId, stage);
      }
    },
    [ideas, handleStageChange]
  );

  if (ideas.length === 0) {
    return (
      <section className="panel">
        <div className="panel__body--padded panel__empty">
          <p>
            No ideas yet. Capture your first spark to get started.{" "}
            <Link href="/ideas/new" className="text-link">
              New Idea
            </Link>
          </p>
        </div>
      </section>
    );
  }

  return (
    <>
      {/* Filter bar */}
      <div className="inline-filter-form" style={{ marginBottom: 16 }}>
        <div className="hobby-status-strip">
          {(["all", ...stageOrder] as const).map((s) => {
            const count =
              s === "all"
                ? ideas.filter((i) => !i.archivedAt).length
                : ideas.filter((i) => !i.archivedAt && i.stage === s).length;
            return (
              <button
                key={s}
                type="button"
                className={`project-status-chip${stageFilter === s ? " project-status-chip--active" : ""}`}
                onClick={() => setStageFilter(s)}
              >
                <span>{s === "all" ? "All" : stageLabels[s]}</span>
                <strong>{count}</strong>
              </button>
            );
          })}
        </div>
        <select
          className="input input--sm"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="all">All Categories</option>
          {Object.entries(categoryLabels).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          className="input input--sm"
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
        >
          <option value="all">All Priorities</option>
          {Object.entries(priorityLabels).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <input
          type="search"
          className="input input--sm"
          placeholder="Search ideas\u2026"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <div className="view-toggle" style={{ marginLeft: "auto" }}>
          <button
            type="button"
            className={`button button--sm${viewMode === "board" ? " button--primary" : " button--ghost"}`}
            onClick={() => setViewMode("board")}
          >
            Board
          </button>
          <button
            type="button"
            className={`button button--sm${viewMode === "table" ? " button--primary" : " button--ghost"}`}
            onClick={() => setViewMode("table")}
          >
            Table
          </button>
        </div>
      </div>

      <BulkActionBar selectedCount={selectedCount} onClearSelection={clearSelection}>
        <IdeaBulkActions
          householdId={householdId}
          selectedItems={selectedItems}
          onBulkComplete={clearSelection}
        />
      </BulkActionBar>

      {isPending && <div className="skeleton-bar" style={{ width: "100%", height: 2, marginBottom: 8 }} />}

      {viewMode === "board" ? (
        <div className="idea-board">
          {stageOrder.map((stage) => {
            const columnIdeas = filteredIdeas.filter((i) => i.stage === stage);
            return (
              <div
                key={stage}
                className={`idea-board__column${dragOverColumn === stage ? " drag-over" : ""}`}
                role="list"
                aria-label={`${stageLabels[stage]} ideas`}
                onDragOver={(e) => handleDragOver(e, stage)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, stage)}
              >
                <h3 className="idea-board__column-header">
                  {stageLabels[stage]}
                  <span className="count">{columnIdeas.length}</span>
                </h3>
                {columnIdeas.length === 0 && (
                  <p style={{ color: "var(--ink-muted)", fontSize: "0.8rem", padding: "8px 0" }}>No ideas at this stage yet.</p>
                )}
                {columnIdeas.map((idea) => (
                  <div
                    key={idea.id}
                    className={`idea-board__card${draggingId === idea.id ? " dragging" : ""}`}
                    role="listitem"
                    tabIndex={0}
                    draggable
                    aria-grabbed={draggingId === idea.id}
                    onDragStart={(e) => handleDragStart(e, idea.id)}
                    onDragEnd={handleDragEnd}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <input
                        type="checkbox"
                        className="bulk-checkbox"
                        checked={isSelected(idea.id)}
                        onChange={() => toggleItem(idea.id)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Select ${idea.title}`}
                      />
                      <span className={`priority-dot priority-dot--${idea.priority}`} />
                      <Link href={`/ideas/${idea.id}`} className="idea-board__card-title">
                        {idea.title}
                      </Link>
                    </div>
                    {idea.description && (
                      <div className="idea-board__card-description">{idea.description}</div>
                    )}
                    <div className="idea-board__card-meta">
                      {idea.category && (
                        <span className="category-chip">{categoryLabels[idea.category]}</span>
                      )}
                      {idea.noteCount > 0 && <span className="category-chip">{idea.noteCount} note{idea.noteCount !== 1 ? "s" : ""}</span>}
                      {idea.materialCount > 0 && <span className="category-chip">{idea.materialCount} material{idea.materialCount !== 1 ? "s" : ""}</span>}
                      {idea.stepCount > 0 && (
                        <span className="category-chip">
                          {idea.stepsCompleted}/{idea.stepCount} steps
                        </span>
                      )}
                    </div>
                    {/* Quick stage move dropdown */}
                    <div style={{ position: "relative", marginTop: 6 }}>
                      <button
                        type="button"
                        className="button button--ghost button--xs"
                        onClick={() => setStageMenu(stageMenu === idea.id ? null : idea.id)}
                      >
                        Move \u25BE
                      </button>
                      {stageMenu === idea.id && (
                        <div className="dropdown-menu" style={{ position: "absolute", top: "100%", left: 0, zIndex: 10 }}>
                          {stageOrder
                            .filter((s) => s !== idea.stage)
                            .map((s) => (
                              <button
                                key={s}
                                type="button"
                                className="dropdown-menu__item"
                                onClick={() => {
                                  setStageMenu(null);
                                  handleStageChange(idea.id, s);
                                }}
                              >
                                {stageLabels[s]}
                              </button>
                            ))}
                          <button
                            type="button"
                            className="dropdown-menu__item dropdown-menu__item--danger"
                            onClick={() => {
                              setStageMenu(null);
                              handleDelete(idea.id);
                            }}
                          >
                            Archive
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      ) : (
        <section className="panel">
          <div className="panel__header">
            <h2>All Ideas ({filteredIdeas.length})</h2>
          </div>
          <div className="panel__body" style={{ padding: 0 }}>
            <table className="data-table idea-table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      className="bulk-checkbox"
                      checked={allSelected}
                      onChange={() => toggleGroup(allFilteredIds, !allSelected)}
                      aria-label="Select all ideas"
                      disabled={filteredIdeas.length === 0}
                    />
                  </th>
                  <th>Idea</th>
                  <th>Stage</th>
                  <th>Priority</th>
                  <th>Category</th>
                  <th>Notes</th>
                  <th className="col-links">Links</th>
                  <th className="col-materials">Materials</th>
                  <th>Steps</th>
                  <th>Captured</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredIdeas.map((idea) => (
                  <tr key={idea.id}>
                    <td>
                      <input
                        type="checkbox"
                        className="bulk-checkbox"
                        checked={isSelected(idea.id)}
                        onChange={() => toggleItem(idea.id)}
                        aria-label={`Select ${idea.title}`}
                      />
                    </td>
                    <td>
                      <Link href={`/ideas/${idea.id}`} className="data-table__primary">
                        {idea.title}
                      </Link>
                      {idea.description && (
                        <div className="data-table__secondary">
                          {idea.description.length > 80
                            ? `${idea.description.slice(0, 80)}\u2026`
                            : idea.description}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`status-chip status-chip--${idea.stage === "ready" ? "success" : idea.stage === "developing" ? "upcoming" : "clear"}`}>
                        {stageLabels[idea.stage]}
                      </span>
                    </td>
                    <td>
                      <span className={`priority-dot priority-dot--${idea.priority}`} />
                      {" "}{priorityLabels[idea.priority]}
                    </td>
                    <td>{idea.category ? categoryLabels[idea.category] : "-"}</td>
                    <td>{idea.noteCount || "-"}</td>
                    <td className="col-links">{idea.linkCount || "-"}</td>
                    <td className="col-materials">{idea.materialCount || "-"}</td>
                    <td>
                      {idea.stepCount > 0
                        ? `${idea.stepsCompleted}/${idea.stepCount}`
                        : "-"}
                    </td>
                    <td>
                      {formatDate(idea.createdAt)}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="button button--ghost button--sm"
                        onClick={() => handleDelete(idea.id)}
                      >
                        Archive
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
