"use client";

import type {
  HobbyProjectDetail,
  HobbyProjectInventoryLinkDetail,
  HobbyProjectMilestone,
  HobbyProjectWorkLog,
  InventoryItemSummary,
  MilestoneStatus,
} from "@lifekeeper/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent, type JSX } from "react";
import { SortableList } from "./ui/sortable-list";
import {
  createHobbyProjectInventoryItem,
  createHobbyProjectMilestone,
  createHobbyProjectWorkLog,
  reorderHobbyProjectMilestones,
  updateHobbyProject,
  updateHobbyProjectInventoryItem,
  updateHobbyProjectMilestone,
  listHobbyProjectInventoryItems,
  deleteHobbyProjectInventoryItem,
} from "../lib/api";
import { EntryTimeline, EntryTipsSurface } from "./entry-system";
import { CategoryAccordionList } from "./category-accordion-list";
import { useFormattedDate } from "../lib/formatted-date";
import { toHouseholdDateInputValue, fromHouseholdDateInput } from "../lib/date-input-utils";
import { useTimezone } from "../lib/timezone-context";

type HobbyProjectDetailProps = {
  householdId: string;
  hobbyId: string;
  project: HobbyProjectDetail;
  workLogs: HobbyProjectWorkLog[];
  availableInventoryItems: InventoryItemSummary[];
};

type MilestoneDraft = Record<string, { name: string; description: string; status: MilestoneStatus; targetDate: string; completedDate: string }>;

function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null) return "-";
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${remainder}m`;
  if (remainder === 0) return `${hours}h`;
  return `${hours}h ${remainder}m`;
}

function statusClass(status: string): string {
  switch (status) {
    case "planned":
    case "pending":
      return "pill pill--muted";
    case "active":
    case "in_progress":
      return "pill pill--info";
    case "paused":
    case "skipped":
      return "pill pill--warning";
    case "completed":
      return "pill pill--success";
    case "abandoned":
      return "pill pill--danger";
    default:
      return "pill";
  }
}

function statusIcon(status: MilestoneStatus): string {
  switch (status) {
    case "completed":
      return "[x]";
    case "in_progress":
      return "[...]";
    case "skipped":
      return "[>>]";
    default:
      return "[ ]";
  }
}

export function HobbyProjectDetailSurface({ householdId, hobbyId, project, workLogs, availableInventoryItems }: HobbyProjectDetailProps): JSX.Element {
  const { formatDate } = useFormattedDate();
  const { timezone } = useTimezone();
  const router = useRouter();
  const [projectState, setProjectState] = useState(project);
  const [materials, setMaterials] = useState(project.inventoryItems);
  const [logs, setLogs] = useState(workLogs);
  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const [headerDraft, setHeaderDraft] = useState({
    name: project.name,
    description: project.description ?? "",
    status: project.status,
    difficulty: project.difficulty ?? "",
    startDate: toHouseholdDateInputValue(project.startDate, timezone),
    targetEndDate: toHouseholdDateInputValue(project.targetEndDate, timezone),
  });
  const [expandedMilestoneId, setExpandedMilestoneId] = useState<string | null>(project.milestones[0]?.id ?? null);
  const [milestoneDrafts, setMilestoneDrafts] = useState<MilestoneDraft>(() => Object.fromEntries(project.milestones.map((milestone) => [milestone.id, {
    name: milestone.name,
    description: milestone.description ?? "",
    status: milestone.status,
    targetDate: toHouseholdDateInputValue(milestone.targetDate, timezone),
    completedDate: toHouseholdDateInputValue(milestone.completedDate, timezone),
  }])));
  const [newMilestone, setNewMilestone] = useState({ name: "", description: "", targetDate: "" });
  const [quickLog, setQuickLog] = useState({ date: toHouseholdDateInputValue(new Date().toISOString(), timezone), durationMinutes: "", description: "", milestoneId: "" });
  const [materialDraft, setMaterialDraft] = useState({ inventoryItemId: "", quantityNeeded: "1", quantityUsed: "0", notes: "" });
  const [consumptionDrafts, setConsumptionDrafts] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const orderedMilestones = useMemo(() => [...projectState.milestones].sort((left, right) => left.sortOrder - right.sortOrder), [projectState.milestones]);
  const workLogSummary = useMemo(() => {
    const totalMinutes = logs.reduce((sum, log) => sum + (log.durationMinutes ?? 0), 0);
    const averageMinutes = logs.length > 0 ? totalMinutes / logs.length : 0;
    const latestLog = logs[0] ?? [...logs].sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())[0] ?? null;
    const daysSinceLast = latestLog ? Math.floor((Date.now() - new Date(latestLog.date).getTime()) / 86_400_000) : null;
    return { totalMinutes, averageMinutes, daysSinceLast };
  }, [logs]);

  const availableMaterialOptions = useMemo(() => availableInventoryItems.filter((item) => !materials.some((material) => material.inventoryItemId === item.id)), [availableInventoryItems, materials]);
  const inventoryCategoryLookup = useMemo(() => new Map(availableInventoryItems.map((item) => [item.id, item.category ?? null])), [availableInventoryItems]);

  const refreshMaterials = async (): Promise<void> => {
    const nextMaterials = await listHobbyProjectInventoryItems(householdId, hobbyId, projectState.id);
    setMaterials(nextMaterials);
  };

  const handleHeaderSave = async (event: FormEvent) => {
    event.preventDefault();
    setBusyKey("header");
    setError(null);
    setMessage(null);

    try {
      const updated = await updateHobbyProject(householdId, hobbyId, projectState.id, {
        name: headerDraft.name,
        description: headerDraft.description || null,
        status: headerDraft.status,
        difficulty: headerDraft.difficulty || null,
        startDate: fromHouseholdDateInput(headerDraft.startDate, timezone),
        targetEndDate: fromHouseholdDateInput(headerDraft.targetEndDate, timezone),
      });
      setProjectState((current) => ({ ...current, ...updated }));
      setIsEditingHeader(false);
      setMessage("Project updated.");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update project.");
    } finally {
      setBusyKey(null);
    }
  };

  const handleMilestoneSave = async (milestone: HobbyProjectMilestone) => {
    const draft = milestoneDrafts[milestone.id];
    if (!draft) return;
    setBusyKey(`milestone:${milestone.id}`);
    setError(null);
    setMessage(null);
    try {
      const updated = await updateHobbyProjectMilestone(householdId, hobbyId, projectState.id, milestone.id, {
        name: draft.name,
        description: draft.description || null,
        status: draft.status,
        targetDate: fromHouseholdDateInput(draft.targetDate, timezone),
        completedDate: fromHouseholdDateInput(draft.completedDate, timezone),
      });
      setProjectState((current) => ({
        ...current,
        milestones: current.milestones.map((candidate) => candidate.id === updated.id ? updated : candidate),
      }));
      setMessage(`Milestone \"${updated.name}\" updated.`);
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update milestone.");
    } finally {
      setBusyKey(null);
    }
  };

  const handleMilestoneCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!newMilestone.name.trim()) return;
    setBusyKey("milestone:new");
    setError(null);
    setMessage(null);
    try {
      const created = await createHobbyProjectMilestone(householdId, hobbyId, projectState.id, {
        name: newMilestone.name.trim(),
        description: newMilestone.description.trim() || undefined,
        targetDate: fromHouseholdDateInput(newMilestone.targetDate, timezone) ?? undefined,
        sortOrder: orderedMilestones.length,
      });
      setProjectState((current) => ({ ...current, milestones: [...current.milestones, created] }));
      setMilestoneDrafts((current) => ({
        ...current,
        [created.id]: {
          name: created.name,
          description: created.description ?? "",
          status: created.status,
          targetDate: toHouseholdDateInputValue(created.targetDate, timezone),
          completedDate: toHouseholdDateInputValue(created.completedDate, timezone),
        },
      }));
      setNewMilestone({ name: "", description: "", targetDate: "" });
      setExpandedMilestoneId(created.id);
      setMessage("Milestone created.");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to create milestone.");
    } finally {
      setBusyKey(null);
    }
  };

  const handleMilestoneReorder = async (newIds: string[]) => {
    const reordered = newIds.map((id) => orderedMilestones.find((m) => m.id === id)!);
    setProjectState((current) => ({
      ...current,
      milestones: reordered.map((milestone, index) => ({ ...milestone, sortOrder: index })),
    }));
    setBusyKey("milestone:reorder");
    try {
      const nextMilestones = await reorderHobbyProjectMilestones(householdId, hobbyId, projectState.id, {
        milestoneIds: newIds,
      });
      setProjectState((current) => ({ ...current, milestones: nextMilestones }));
      setMessage("Milestones reordered.");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to reorder milestones.");
      router.refresh();
    } finally {
      setBusyKey(null);
    }
  };

  const handleQuickLogSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!quickLog.description.trim()) return;
    setBusyKey("log:new");
    setError(null);
    setMessage(null);
    try {
      const created = await createHobbyProjectWorkLog(householdId, hobbyId, projectState.id, {
        date: fromHouseholdDateInput(quickLog.date, timezone) ?? new Date().toISOString(),
        durationMinutes: quickLog.durationMinutes.trim() ? Number(quickLog.durationMinutes) : undefined,
        description: quickLog.description.trim(),
        ...(quickLog.milestoneId ? { milestoneId: quickLog.milestoneId } : {}),
      });
      setLogs((current) => [created, ...current].sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime()));
      setQuickLog({ date: quickLog.date, durationMinutes: "", description: "", milestoneId: quickLog.milestoneId });
      setMessage("Work log added.");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to add work log.");
    } finally {
      setBusyKey(null);
    }
  };

  const handleMaterialCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!materialDraft.inventoryItemId) return;
    setBusyKey("material:new");
    setError(null);
    setMessage(null);
    try {
      await createHobbyProjectInventoryItem(householdId, hobbyId, projectState.id, {
        inventoryItemId: materialDraft.inventoryItemId,
        quantityNeeded: Number(materialDraft.quantityNeeded),
        quantityUsed: Number(materialDraft.quantityUsed || 0),
        notes: materialDraft.notes.trim() || undefined,
      });
      await refreshMaterials();
      setMaterialDraft({ inventoryItemId: "", quantityNeeded: "1", quantityUsed: "0", notes: "" });
      setMessage("Material linked.");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to link material.");
    } finally {
      setBusyKey(null);
    }
  };

  const handleConsumeMaterial = async (material: HobbyProjectInventoryLinkDetail) => {
    const delta = Number(consumptionDrafts[material.inventoryItemId] ?? 0);
    if (!delta || delta < 0) return;
    setBusyKey(`material:${material.inventoryItemId}`);
    setError(null);
    setMessage(null);
    try {
      await updateHobbyProjectInventoryItem(householdId, hobbyId, projectState.id, material.inventoryItemId, {
        quantityNeeded: material.quantityNeeded,
        quantityUsed: material.quantityUsed + delta,
      });
      await refreshMaterials();
      setConsumptionDrafts((current) => ({ ...current, [material.inventoryItemId]: "" }));
      setMessage("Material consumption recorded.");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to record material consumption.");
    } finally {
      setBusyKey(null);
    }
  };

  const handleMaterialDelete = async (material: HobbyProjectInventoryLinkDetail) => {
    setBusyKey(`material:delete:${material.inventoryItemId}`);
    setError(null);
    setMessage(null);
    try {
      await deleteHobbyProjectInventoryItem(householdId, hobbyId, projectState.id, material.inventoryItemId);
      await refreshMaterials();
      setMessage("Material link removed.");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to remove material link.");
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="mode-workspace mode-stack">
      <EntryTipsSurface
        householdId={householdId}
        queries={[{ entityType: "hobby_project", entityId: projectState.id }]}
        title={`Project notes for ${projectState.name}`}
        entryHrefBuilder={(entry) => `/hobbies/${hobbyId}/projects/${projectState.id}#entry-${entry.id}`}
      />

      <section className="panel panel--studio">
        <div className="panel__header mode-detail-header">
          <div>
            <h2>{projectState.name}</h2>
            <p>{projectState.description ?? "No description provided."}</p>
          </div>
          <div className="mode-detail-header__meta">
            <span className={statusClass(projectState.status)}>{projectState.status}</span>
            {projectState.difficulty ? <span className="pill pill--muted">{projectState.difficulty}</span> : null}
            <button type="button" className="button button--secondary button--sm" onClick={() => setIsEditingHeader((current) => !current)}>
              {isEditingHeader ? "Close editor" : "Edit project"}
            </button>
          </div>
        </div>
        <div className="panel__body--padded mode-stack">
          <div className="mode-kv-grid">
            <div><span>Date range</span><strong>{formatDate(projectState.startDate)} to {formatDate(projectState.completedDate ?? projectState.targetEndDate)}</strong></div>
            <div><span>Total hours</span><strong>{projectState.totalLoggedHours.toFixed(1)} hr</strong></div>
            <div><span>Milestones</span><strong>{projectState.completedMilestoneCount} of {projectState.milestoneCount}</strong></div>
            <div><span>Progress</span><strong>{Math.round(projectState.milestoneCompletionPercentage)}%</strong></div>
          </div>

          {isEditingHeader ? (
            <form className="workbench-form" onSubmit={handleHeaderSave}>
              <div className="workbench-grid">
                <label className="workbench-field workbench-field--wide">
                  <span className="workbench-field__label">Name</span>
                  <input className="workbench-field__input" value={headerDraft.name} onChange={(event) => setHeaderDraft((current) => ({ ...current, name: event.target.value }))} required />
                </label>
                <label className="workbench-field workbench-field--wide">
                  <span className="workbench-field__label">Description</span>
                  <textarea className="workbench-field__input workbench-field__textarea" rows={3} value={headerDraft.description} onChange={(event) => setHeaderDraft((current) => ({ ...current, description: event.target.value }))} />
                </label>
                <label className="workbench-field">
                  <span className="workbench-field__label">Status</span>
                  <select className="workbench-field__input" value={headerDraft.status} onChange={(event) => setHeaderDraft((current) => ({ ...current, status: event.target.value as HobbyProjectDetail["status"] }))}>
                    <option value="planned">Planned</option>
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="completed">Completed</option>
                    <option value="abandoned">Abandoned</option>
                  </select>
                </label>
                <label className="workbench-field">
                  <span className="workbench-field__label">Difficulty</span>
                  <input className="workbench-field__input" value={headerDraft.difficulty} onChange={(event) => setHeaderDraft((current) => ({ ...current, difficulty: event.target.value }))} />
                </label>
                <label className="workbench-field">
                  <span className="workbench-field__label">Start date</span>
                  <input type="date" className="workbench-field__input" value={headerDraft.startDate} onChange={(event) => setHeaderDraft((current) => ({ ...current, startDate: event.target.value }))} />
                </label>
                <label className="workbench-field">
                  <span className="workbench-field__label">Target end date</span>
                  <input type="date" className="workbench-field__input" value={headerDraft.targetEndDate} onChange={(event) => setHeaderDraft((current) => ({ ...current, targetEndDate: event.target.value }))} />
                </label>
              </div>
              <div className="workbench-bar">
                <button type="submit" className="button button--primary button--sm" disabled={busyKey === "header"}>Save project</button>
              </div>
            </form>
          ) : null}

          {message ? <p className="workbench-success">{message}</p> : null}
          {error ? <p className="workbench-error">{error}</p> : null}
        </div>
      </section>

      <section className="panel panel--studio">
        <div className="panel__header"><h2>Milestones</h2></div>
        <div className="panel__body--padded mode-stack">
          <form className="mode-inline-form" onSubmit={handleMilestoneCreate}>
            <input value={newMilestone.name} onChange={(event) => setNewMilestone((current) => ({ ...current, name: event.target.value }))} placeholder="Add milestone name" required />
            <input value={newMilestone.description} onChange={(event) => setNewMilestone((current) => ({ ...current, description: event.target.value }))} placeholder="Description preview" />
            <input type="date" value={newMilestone.targetDate} onChange={(event) => setNewMilestone((current) => ({ ...current, targetDate: event.target.value }))} />
            <button type="submit" className="button button--secondary button--sm" disabled={busyKey === "milestone:new"}>Add milestone</button>
          </form>

          <div className="mode-stack">
            <SortableList
              items={orderedMilestones}
              onReorder={(newIds) => { void handleMilestoneReorder(newIds); }}
              renderItem={(milestone, dragHandleProps) => {
                const draft = milestoneDrafts[milestone.id];
                const milestoneLogs = logs.filter((log) => log.milestoneId === milestone.id);
                const isExpanded = expandedMilestoneId === milestone.id;
                return (
                  <div
                    className={`milestone-card${isExpanded ? " milestone-card--expanded" : ""}`}
                  >
                    <span
                      ref={(el: HTMLSpanElement | null) => dragHandleProps.ref(el)}
                      role={dragHandleProps.role}
                      tabIndex={dragHandleProps.tabIndex}
                      aria-roledescription={dragHandleProps["aria-roledescription"]}
                      aria-describedby={dragHandleProps["aria-describedby"]}
                      aria-pressed={dragHandleProps["aria-pressed"]}
                      aria-disabled={dragHandleProps["aria-disabled"]}
                      onKeyDown={dragHandleProps.onKeyDown}
                      onPointerDown={dragHandleProps.onPointerDown}
                      className="drag-handle"
                      style={{ alignSelf: "flex-start", paddingTop: 20, paddingLeft: 12 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <button type="button" className="milestone-card__summary" onClick={() => setExpandedMilestoneId(isExpanded ? null : milestone.id)}>
                        <span className="milestone-card__icon">{statusIcon(milestone.status)}</span>
                        <div className="milestone-card__content">
                          <strong>{milestone.name}</strong>
                          <p>{milestone.description ?? "No description provided."}</p>
                        </div>
                        <div className="milestone-card__meta">
                          <span className={statusClass(milestone.status)}>{milestone.status.replaceAll("_", " ")}</span>
                          <span>Target {formatDate(milestone.targetDate)}</span>
                          <span>Done {formatDate(milestone.completedDate)}</span>
                        </div>
                      </button>
                      {isExpanded && draft ? (
                        <div className="milestone-card__details">
                          <div className="workbench-grid">
                            <label className="workbench-field workbench-field--wide">
                              <span className="workbench-field__label">Name</span>
                              <input className="workbench-field__input" value={draft.name} onChange={(event) => setMilestoneDrafts((current) => ({ ...current, [milestone.id]: { ...draft, name: event.target.value } }))} />
                            </label>
                            <label className="workbench-field workbench-field--wide">
                              <span className="workbench-field__label">Description</span>
                              <textarea className="workbench-field__input workbench-field__textarea" rows={2} value={draft.description} onChange={(event) => setMilestoneDrafts((current) => ({ ...current, [milestone.id]: { ...draft, description: event.target.value } }))} />
                            </label>
                            <label className="workbench-field">
                              <span className="workbench-field__label">Status</span>
                              <select className="workbench-field__input" value={draft.status} onChange={(event) => setMilestoneDrafts((current) => ({ ...current, [milestone.id]: { ...draft, status: event.target.value as MilestoneStatus } }))}>
                                <option value="pending">Pending</option>
                                <option value="in_progress">In progress</option>
                                <option value="completed">Completed</option>
                                <option value="skipped">Skipped</option>
                              </select>
                            </label>
                            <label className="workbench-field">
                              <span className="workbench-field__label">Target date</span>
                              <input type="date" className="workbench-field__input" value={draft.targetDate} onChange={(event) => setMilestoneDrafts((current) => ({ ...current, [milestone.id]: { ...draft, targetDate: event.target.value } }))} />
                            </label>
                            <label className="workbench-field">
                              <span className="workbench-field__label">Completed date</span>
                              <input type="date" className="workbench-field__input" value={draft.completedDate} onChange={(event) => setMilestoneDrafts((current) => ({ ...current, [milestone.id]: { ...draft, completedDate: event.target.value } }))} />
                            </label>
                          </div>
                          <div className="workbench-bar">
                            <button type="button" className="button button--secondary button--sm" onClick={() => void handleMilestoneSave(milestone)} disabled={busyKey === `milestone:${milestone.id}`}>
                              Save milestone
                            </button>
                          </div>

                          <div className="mode-stack">
                            <div className="mode-section-card">
                              <div className="mode-section-card__head"><h3>Work logs</h3></div>
                              {milestoneLogs.length === 0 ? <p className="panel__empty">No work logs linked to this milestone yet.</p> : (
                                <div className="mode-stack">
                                  {milestoneLogs.map((log) => (
                                    <div key={log.id} className="mode-inline-row mode-inline-row--card">
                                      <div>
                                        <strong>{log.description}</strong>
                                        <p>{formatDate(log.date)}</p>
                                      </div>
                                      <span className="pill pill--muted">{formatDuration(log.durationMinutes)}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <EntryTimeline
                              householdId={householdId}
                              entityType="hobby_project_milestone"
                              entityId={milestone.id}
                              title={`Milestone entries for ${milestone.name}`}
                              quickAddLabel="Milestone entry"
                              entryHrefBuilder={(entry) => `/hobbies/${hobbyId}/projects/${projectState.id}#entry-${entry.id}`}
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              }}
            />
          </div>
        </div>
      </section>

      <section className="panel panel--studio">
        <div className="panel__header"><h2>Work log</h2></div>
        <div className="panel__body--padded mode-stack">
          <div className="stats-row">
            <div className="stat-card stat-card--accent">
              <span className="stat-card__label">Total hours</span>
              <strong className="stat-card__value">{(workLogSummary.totalMinutes / 60).toFixed(1)}</strong>
              <span className="stat-card__sub">Across {logs.length} entries</span>
            </div>
            <div className="stat-card">
              <span className="stat-card__label">Average session</span>
              <strong className="stat-card__value">{formatDuration(Math.round(workLogSummary.averageMinutes))}</strong>
              <span className="stat-card__sub">Mean logged effort</span>
            </div>
            <div className="stat-card stat-card--success">
              <span className="stat-card__label">Days since last</span>
              <strong className="stat-card__value">{workLogSummary.daysSinceLast ?? "-"}</strong>
              <span className="stat-card__sub">Most recent work session</span>
            </div>
          </div>

          <form className="mode-inline-form mode-inline-form--grid" onSubmit={handleQuickLogSubmit}>
            <input type="date" value={quickLog.date} onChange={(event) => setQuickLog((current) => ({ ...current, date: event.target.value }))} />
            <input value={quickLog.durationMinutes} onChange={(event) => setQuickLog((current) => ({ ...current, durationMinutes: event.target.value }))} placeholder="Minutes" />
            <input value={quickLog.description} onChange={(event) => setQuickLog((current) => ({ ...current, description: event.target.value }))} placeholder="What did you work on?" required />
            <select value={quickLog.milestoneId} onChange={(event) => setQuickLog((current) => ({ ...current, milestoneId: event.target.value }))}>
              <option value="">No milestone</option>
              {orderedMilestones.map((milestone) => <option key={milestone.id} value={milestone.id}>{milestone.name}</option>)}
            </select>
            <button type="submit" className="button button--primary button--sm" disabled={busyKey === "log:new"}>Add log</button>
          </form>

          <div className="mode-stack">
            {logs.sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime()).map((log) => {
              const milestone = projectState.milestones.find((candidate) => candidate.id === log.milestoneId);
              return (
                <div key={log.id} className="mode-inline-row mode-inline-row--card">
                  <div>
                    <strong>{log.description}</strong>
                    <p>{formatDate(log.date)}{milestone ? ` · ${milestone.name}` : ""}</p>
                  </div>
                  <span className="pill pill--muted">{formatDuration(log.durationMinutes)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="panel panel--studio">
        <div className="panel__header"><h2>Materials</h2></div>
        <div className="panel__body--padded mode-stack">
          <CategoryAccordionList
            items={materials}
            getSearchText={(material) =>
              [material.inventoryItem.name, inventoryCategoryLookup.get(material.inventoryItemId) ?? "", material.notes ?? ""].join(" ")
            }
            getCategory={(material) => inventoryCategoryLookup.get(material.inventoryItemId)?.trim() || null}
            searchPlaceholder="Filter materials by name or category"
            emptyMessage="No materials linked to this project yet."
            noMatchMessage="No materials match your filters."
            statusFilter={{
              options: [
                { value: "outstanding", label: "Outstanding" },
                { value: "consumed", label: "Fully consumed" },
              ],
              getMatch: (material, v) =>
                v === "consumed" ? material.quantityRemaining <= 0 : material.quantityRemaining > 0,
            }}
            getSectionTags={(items) => {
              const consumed = items.filter((m) => m.quantityRemaining <= 0).length;
              const outstanding = items.length - consumed;
              const tags: { label: string; variant: "success" | "warning" | "muted" }[] = [];
              if (consumed > 0) tags.push({ label: `${consumed} consumed`, variant: "success" });
              if (outstanding > 0) tags.push({ label: `${outstanding} outstanding`, variant: "warning" });
              return tags;
            }}
            renderItems={(sectionItems) => (
              <div className="table-shell">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Needed</th>
                      <th>Used</th>
                      <th>Remaining</th>
                      <th>Consume</th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {sectionItems.map((material) => (
                      <tr key={material.id}>
                        <td><Link href={`/inventory/${material.inventoryItemId}`} className="data-table__link">{material.inventoryItem.name}</Link></td>
                        <td>{material.quantityNeeded}</td>
                        <td>{material.quantityUsed}</td>
                        <td>{material.quantityRemaining}</td>
                        <td>
                          <div className="mode-inline-actions">
                            <input
                              value={consumptionDrafts[material.inventoryItemId] ?? ""}
                              onChange={(event) => setConsumptionDrafts((current) => ({ ...current, [material.inventoryItemId]: event.target.value }))}
                              placeholder="Qty"
                            />
                            <button type="button" className="button button--ghost button--sm" onClick={() => void handleConsumeMaterial(material)} disabled={busyKey === `material:${material.inventoryItemId}`}>
                              Record
                            </button>
                          </div>
                        </td>
                        <td>
                          <button type="button" className="button button--ghost button--sm" onClick={() => void handleMaterialDelete(material)} disabled={busyKey === `material:delete:${material.inventoryItemId}`}>
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            header={
              <form className="mode-inline-form mode-inline-form--grid" onSubmit={handleMaterialCreate}>
                <select value={materialDraft.inventoryItemId} onChange={(event) => setMaterialDraft((current) => ({ ...current, inventoryItemId: event.target.value }))} required>
                  <option value="">Select inventory item</option>
                  {availableMaterialOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                <input value={materialDraft.quantityNeeded} onChange={(event) => setMaterialDraft((current) => ({ ...current, quantityNeeded: event.target.value }))} placeholder="Needed" />
                <input value={materialDraft.quantityUsed} onChange={(event) => setMaterialDraft((current) => ({ ...current, quantityUsed: event.target.value }))} placeholder="Used now" />
                <input value={materialDraft.notes} onChange={(event) => setMaterialDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Notes" />
                <button type="submit" className="button button--secondary button--sm" disabled={busyKey === "material:new"}>Add material</button>
              </form>
            }
          />
        </div>
      </section>

      <EntryTimeline
        householdId={householdId}
        entityType="hobby_project"
        entityId={projectState.id}
        title="Project entries"
        quickAddLabel="Project entry"
        entryHrefBuilder={(entry) => `/hobbies/${hobbyId}/projects/${projectState.id}#entry-${entry.id}`}
      />
    </div>
  );
}