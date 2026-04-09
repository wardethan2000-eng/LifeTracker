"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  Entry,
  HouseholdMember,
  InventoryItemSummary,
  ProjectBudgetCategorySummary,
  ProjectExpense,
  ProjectPhaseDetail,
  ProjectPhaseSummary,
  ProjectTask,
  ServiceProvider
} from "@aegis/types";
import {
  createPhaseChecklistItemAction,
  createProjectExpenseAction,
  createProjectPhaseAction,
  createProjectPhaseSupplyAction,
  createProjectTaskAction,
  createTaskChecklistItemAction,
  deletePhaseChecklistItemAction,
  deleteProjectExpenseAction,
  deleteProjectPhaseAction,
  deleteProjectTaskAction,
  deleteTaskChecklistItemAction,
  updatePhaseChecklistItemAction,
  updateProjectExpenseAction,
  updateProjectPhaseAction,
  updateProjectTaskAction,
  updateTaskChecklistItemAction
} from "../app/actions";
import { formatCurrency, formatDate } from "../lib/formatters";
import { ConfirmActionForm } from "./confirm-action-form";
import { ProjectChecklist } from "./project-checklist";
import { ProjectSupplyCard } from "./project-supply-card";
import { ProjectSupplyCreateForm } from "./project-supply-create-form";
import { AttachmentSection } from "./attachment-section";
import { SegmentedControl } from "./segmented-control";
import { CategoryAccordionList } from "./category-accordion-list";
import { createEntry, getEntries, reorderPhaseChecklistItems, reorderProjectPhaseSupplies, reorderProjectPhases, reorderTaskChecklistItems, updateEntry, updateProjectTask } from "../lib/api";
import { SortableList, type DragHandleProps } from "./ui/sortable-list";
import { RichEditor } from "./rich-editor";
import { ProjectTaskDependencyEditor } from "./project-task-dependency-editor";

const statusOptions = [
  { value: "pending" as const, label: "Pending" },
  { value: "in_progress" as const, label: "In Progress" },
  { value: "completed" as const, label: "Completed" },
  { value: "skipped" as const, label: "Skipped" },
];



const toDateInputValue = (v: string | null | undefined): string => v ? v.slice(0, 10) : "";

type PhaseSubTab = "tasks" | "checklist" | "supplies" | "expenses" | "photos" | "notes";

type PhaseSplitPanelProps = {
  householdId: string;
  projectId: string;
  phases: ProjectPhaseSummary[];
  phaseDetails: ProjectPhaseDetail[];
  allTasks: ProjectTask[];
  householdMembers: HouseholdMember[];
  serviceProviders: ServiceProvider[];
  budgetCategories: ProjectBudgetCategorySummary[];
  inventoryItems: InventoryItemSummary[];
  initialPhaseId?: string;
  unphasedTasks: ProjectTask[];
};

export function PhaseSplitPanel({
  householdId,
  projectId,
  phases,
  phaseDetails,
  allTasks,
  householdMembers,
  serviceProviders,
  budgetCategories,
  inventoryItems,
  initialPhaseId,
  unphasedTasks,
}: PhaseSplitPanelProps) {
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(
    initialPhaseId ?? phases[0]?.id ?? null
  );
  const [showUnphased, setShowUnphased] = useState(false);
  const [subTab, setSubTab] = useState<PhaseSubTab>("tasks");
  const [orderedPhases, setOrderedPhases] = useState<ProjectPhaseSummary[]>(phases);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const selectedPhase = phaseDetails.find((p) => p.id === selectedPhaseId);
  const selectedPhaseSummary = phases.find((p) => p.id === selectedPhaseId);

  return (
    <div>
      <div className={`phase-split${sidebarCollapsed ? " phase-split--collapsed" : ""}`}>
        {/* ── Left: Phase list (or collapsed rail) ── */}
        <div className="phase-split__list">
          {sidebarCollapsed ? (
            /* Collapsed icon rail */
            <div className="phase-list-rail">
              <button
                type="button"
                className="phase-rail-toggle"
                onClick={() => setSidebarCollapsed(false)}
                title="Expand phases"
                aria-label="Expand phases sidebar"
              >›</button>
              {orderedPhases.map((phase, index) => (
                <button
                  key={phase.id}
                  type="button"
                  className={`phase-rail-dot phase-rail-dot--${phase.status}${selectedPhaseId === phase.id && !showUnphased ? " phase-rail-dot--active" : ""}`}
                  title={phase.name}
                  aria-label={`Phase ${index + 1}: ${phase.name}`}
                  onClick={() => { setSelectedPhaseId(phase.id); setShowUnphased(false); }}
                >
                  {index + 1}
                </button>
              ))}
              {unphasedTasks.length > 0 && (
                <button
                  type="button"
                  className={`phase-rail-dot phase-rail-dot--unphased${showUnphased ? " phase-rail-dot--active" : ""}`}
                  title={`Unphased Tasks (${unphasedTasks.length})`}
                  aria-label={`Unphased Tasks: ${unphasedTasks.length}`}
                  onClick={() => { setShowUnphased(true); }}
                >·</button>
              )}
            </div>
          ) : (
            /* Full list view */
            <>
              <div className="phase-split__list-header">
                <h3>Phases</h3>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <AddPhaseButton householdId={householdId} projectId={projectId} />
                  <button
                    type="button"
                    className="phase-list-collapse-btn"
                    onClick={() => setSidebarCollapsed(true)}
                    title="Collapse sidebar"
                    aria-label="Collapse phases sidebar"
                  >‹</button>
                </div>
              </div>

              <SortableList
                items={orderedPhases}
                onReorder={(newIds) => {
                  const reordered = newIds.map((id) => orderedPhases.find((p) => p.id === id)!);
                  setOrderedPhases(reordered);
                  reorderProjectPhases(householdId, projectId, newIds);
                }}
                renderItem={(phase, dragHandleProps) => (
                  <button
                    type="button"
                    className={`phase-list-item${selectedPhaseId === phase.id && !showUnphased ? " phase-list-item--active" : ""}`}
                    onClick={() => { setSelectedPhaseId(phase.id); setShowUnphased(false); }}
                  >
                    <div className="phase-list-item__top">
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
                        onClick={(e) => e.stopPropagation()}
                        className="drag-handle"
                      />
                      <span className={`phase-list-item__dot phase-list-item__dot--${phase.status}`} />
                      <span className="phase-list-item__name">{phase.name}</span>
                    </div>
                    <span className="phase-list-item__progress">
                      {phase.completedTaskCount}/{phase.taskCount} tasks · {phase.completedChecklistItemCount}/{phase.checklistItemCount} checks
                    </span>
                  </button>
                )}
              />

              {unphasedTasks.length > 0 && (
                <button
                  type="button"
                  className={`phase-list-item phase-list-item--unphased${showUnphased ? " phase-list-item--active" : ""}`}
                  onClick={() => setShowUnphased(true)}
                >
                  <div className="phase-list-item__top">
                    <span className="phase-list-item__name">Unphased Tasks</span>
                    <span className="pill pill--muted">{unphasedTasks.length}</span>
                  </div>
                </button>
              )}
            </>
          )}
        </div>

        {/* ── Right: Detail panel ── */}
        <div className="phase-split__detail">
          {showUnphased ? (
            <UnphasedTasksPanel
              householdId={householdId}
              projectId={projectId}
              tasks={unphasedTasks}
              householdMembers={householdMembers}
              allTasks={allTasks}
            />
          ) : selectedPhase && selectedPhaseSummary ? (
            <PhaseDetailPanel
              householdId={householdId}
              projectId={projectId}
              phase={selectedPhase}
              phaseSummary={selectedPhaseSummary}
              allTasks={allTasks}
              phases={orderedPhases}
              householdMembers={householdMembers}
              serviceProviders={serviceProviders}
              budgetCategories={budgetCategories}
              inventoryItems={inventoryItems}
              subTab={subTab}
              onSubTabChange={setSubTab}
            />
          ) : (
            <div className="phase-split__empty">
              {phases.length === 0
                ? "No phases yet. Click + to create your first phase."
                : "Select a phase from the list."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Add Phase Button (inline form) ─── */

function AddPhaseButton({ householdId, projectId }: { householdId: string; projectId: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" className="button button--ghost button--sm" onClick={() => setOpen(true)}>
        + Phase
      </button>
    );
  }

  return (
    <form
      action={createProjectPhaseAction}
      onSubmit={() => setOpen(false)}
      style={{ display: "flex", gap: 6, alignItems: "center" }}
    >
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="projectId" value={projectId} />
      <input
        name="name"
        placeholder="Phase name"
        required
        autoFocus
        style={{ width: 140, padding: "4px 8px", fontSize: "0.82rem", border: "1px solid var(--border)", borderRadius: 6 }}
        onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
      />
      <button type="submit" className="button button--sm">Add</button>
    </form>
  );
}

/* ─── Phase Detail Panel ─── */

function PhaseDetailPanel({
  householdId,
  projectId,
  phase,
  phaseSummary,
  allTasks,
  phases,
  householdMembers,
  serviceProviders,
  budgetCategories,
  inventoryItems,
  subTab,
  onSubTabChange,
}: {
  householdId: string;
  projectId: string;
  phase: ProjectPhaseDetail;
  phaseSummary: ProjectPhaseSummary;
  allTasks: ProjectTask[];
  phases: ProjectPhaseSummary[];
  householdMembers: HouseholdMember[];
  serviceProviders: ServiceProvider[];
  budgetCategories: ProjectBudgetCategorySummary[];
  inventoryItems: InventoryItemSummary[];
  subTab: PhaseSubTab;
  onSubTabChange: (tab: PhaseSubTab) => void;
}) {
  const onStatusChange = useCallback((status: string) => {
    const form = new FormData();
    form.set("householdId", householdId);
    form.set("projectId", projectId);
    form.set("phaseId", phase.id);
    form.set("name", phase.name);
    form.set("status", status);
    updateProjectPhaseAction(form);
  }, [householdId, projectId, phase.id, phase.name]);

  const inventoryLookup = new Map(inventoryItems.map((item) => [item.id, item]));
  const dependencyCandidates = allTasks.filter((task) => task.taskType !== "quick");

  const [phaseHasNotes, setPhaseHasNotes] = useState(Boolean(phase.notes));
  const [headerExpanded, setHeaderExpanded] = useState(false);

  const statusLabel: Record<string, string> = {
    pending: "Pending",
    in_progress: "In Progress",
    completed: "Completed",
    skipped: "Skipped",
  };

  const deleteHiddenFields = [
    { name: "householdId", value: householdId },
    { name: "projectId", value: projectId },
    { name: "phaseId", value: phase.id },
  ];

  const subTabs: { id: PhaseSubTab; label: string; count?: number }[] = [
    { id: "tasks", label: "Tasks", count: phase.tasks.length },
    { id: "checklist", label: "Milestones", count: phase.checklistItemCount },
    { id: "supplies", label: "Supplies", count: phase.supplies.length },
    { id: "expenses", label: "Expenses", count: phase.expenses.length },
    { id: "photos", label: "Photos" },
    { id: "notes", label: "Notes", count: phaseHasNotes ? 1 : undefined },
  ];

  return (
    <div>
      {/* ── Phase header ── */}
      {!headerExpanded ? (
        <div className="phase-detail-header--bar">
          <span className="phase-detail-header__title-static">{phase.name}</span>
          <span className={`phase-status-badge phase-status-badge--${phase.status}`}>
            {statusLabel[phase.status] ?? phase.status}
          </span>
          <span className="phase-detail-header__stats">
            {phase.startDate ? formatDate(phase.startDate) : ""}
            {phase.startDate && phase.targetEndDate ? " → " : ""}
            {phase.targetEndDate ? formatDate(phase.targetEndDate) : ""}
            {phase.budgetAmount ? ` · ${formatCurrency(phase.budgetAmount)} budget` : ""}
          </span>
          <div className="phase-detail-header__bar-actions">
            <button
              type="button"
              className="button button--ghost button--sm"
              onClick={() => setHeaderExpanded(true)}
            >Edit</button>
          </div>
        </div>
      ) : (
        <div className="phase-detail-header">
          <form action={updateProjectPhaseAction} style={{ display: "contents" }}>
            <input type="hidden" name="householdId" value={householdId} />
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="phaseId" value={phase.id} />

            <div className="phase-detail-header__title-row">
              <input
                name="name"
                defaultValue={phase.name}
                className="phase-detail-header__title"
                style={{ border: "none", background: "transparent", fontFamily: "inherit", outline: "none", padding: 0, flex: 1 }}
                onBlur={(e) => e.currentTarget.form?.requestSubmit()}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}
              />
              <button type="button" className="button button--ghost button--sm" onClick={() => setHeaderExpanded(false)}>Collapse</button>
              <ConfirmActionForm
                action={deleteProjectPhaseAction}
                hiddenFields={deleteHiddenFields}
                prompt="Delete this phase and everything attached to it?"
                triggerLabel="Delete"
                confirmLabel="Yes, delete"
                triggerClassName="button button--ghost button--sm phase-header-trash"
                confirmClassName="button button--danger button--sm"
                cancelClassName="button button--ghost button--sm"
              />
            </div>

            <div className="phase-detail-status-control">
              <SegmentedControl
                options={statusOptions}
                value={phase.status}
                onChange={onStatusChange}
                size="sm"
              />
            </div>

            <div className="phase-detail-meta">
              <div className="phase-detail-meta__item">
                <span className="phase-detail-meta__label">Start</span>
                <input type="date" name="startDate" defaultValue={toDateInputValue(phase.startDate)} onBlur={(e) => e.currentTarget.form?.requestSubmit()} />
              </div>
              <div className="phase-detail-meta__item">
                <span className="phase-detail-meta__label">Target End</span>
                <input type="date" name="targetEndDate" defaultValue={toDateInputValue(phase.targetEndDate)} onBlur={(e) => e.currentTarget.form?.requestSubmit()} />
              </div>
              <div className="phase-detail-meta__item">
                <span className="phase-detail-meta__label">Budget</span>
                <input type="number" name="budgetAmount" min="0" step="0.01" defaultValue={phase.budgetAmount ?? ""} placeholder="$0" style={{ width: 90 }} onBlur={(e) => e.currentTarget.form?.requestSubmit()} />
              </div>
              <div className="phase-detail-meta__item">
                <span className="phase-detail-meta__label">Spent</span>
                <span className="phase-detail-meta__value">{formatCurrency(phaseSummary.expenseTotal, "$0")}</span>
              </div>
              <div className="phase-detail-meta__item">
                <span className="phase-detail-meta__label">Labor</span>
                <span className="phase-detail-meta__value">{phaseSummary.totalActualHours.toFixed(1)}h / {phaseSummary.totalEstimatedHours.toFixed(1)}h</span>
              </div>
            </div>

            <textarea
              name="description"
              className="phase-detail-description"
              defaultValue={phase.description ?? ""}
              placeholder="Phase description..."
              rows={2}
              onBlur={(e) => e.currentTarget.form?.requestSubmit()}
            />
            {/* Hidden submit for auto-save */}
            <input type="hidden" name="status" value={phase.status} />
          </form>
        </div>
      )}

      {/* ── Sub-tabs ── */}
      <div className="phase-subtabs">
        {subTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`phase-subtab${subTab === tab.id ? " phase-subtab--active" : ""}`}
            onClick={() => onSubTabChange(tab.id)}
          >
            {tab.label}
            {tab.count !== undefined ? <span className="phase-subtab__count">({tab.count})</span> : null}
          </button>
        ))}
      </div>

      {/* ── Sub-tab content ── */}
      {subTab === "tasks" && (
        <PhaseTasksSubtab
          householdId={householdId}
          projectId={projectId}
          phaseId={phase.id}
          tasks={phase.tasks}
          phases={phases}
          householdMembers={householdMembers}
          dependencyCandidates={dependencyCandidates}
        />
      )}

      {subTab === "checklist" && (
        <div style={{ padding: "8px 0" }}>
          <p style={{ fontSize: "0.82rem", color: "var(--ink-muted)", marginBottom: 8 }}>
            Phase-level go/no-go gates. Check these off before advancing to the next phase.
          </p>
          <ProjectChecklist
            items={phase.checklistItems}
            householdId={householdId}
            projectId={projectId}
            parentFieldName="phaseId"
            parentId={phase.id}
            addAction={createPhaseChecklistItemAction}
            toggleAction={updatePhaseChecklistItemAction}
            deleteAction={deletePhaseChecklistItemAction}
            addPlaceholder="Add milestone or go/no-go check"
            emptyMessage="No milestones yet. Add acceptance criteria that must be met before this phase is done."
            onReorder={(orderedIds) => reorderPhaseChecklistItems(householdId, projectId, phase.id, orderedIds)}
          />
        </div>
      )}

      {subTab === "supplies" && (
        <PhaseSuppliesSubtab
          householdId={householdId}
          projectId={projectId}
          phaseId={phase.id}
          supplies={phase.supplies}
          inventoryItems={inventoryItems}
          inventoryLookup={inventoryLookup}
        />
      )}

      {subTab === "expenses" && (
        <PhaseExpensesSubtab
          householdId={householdId}
          projectId={projectId}
          phaseId={phase.id}
          expenses={phase.expenses}
          serviceProviders={serviceProviders}
          budgetCategories={budgetCategories}
          budgetAmount={phase.budgetAmount}
          expenseTotal={phaseSummary.expenseTotal}
        />
      )}

      {subTab === "photos" && (
        <div style={{ padding: "8px 0" }}>
          <AttachmentSection
            householdId={householdId}
            entityType="project_phase"
            entityId={phase.id}
            label=""
          />
        </div>
      )}

      {subTab === "notes" && (
        <PhaseNotesEditor
          householdId={householdId}
          projectId={projectId}
          phase={phase}
          onNotesLoaded={setPhaseHasNotes}
        />
      )}

      {/* ── Danger zone ── */}
      <div className="phase-detail-danger">
        <ConfirmActionForm
          action={deleteProjectPhaseAction}
          hiddenFields={[
            { name: "householdId", value: householdId },
            { name: "projectId", value: projectId },
            { name: "phaseId", value: phase.id },
          ]}
          prompt="Delete this phase and everything attached to it?"
          triggerLabel="Delete Phase"
          confirmLabel="Confirm"
          triggerClassName="button button--danger button--sm"
          confirmClassName="button button--danger button--sm"
          cancelClassName="button button--ghost button--sm"
        />
      </div>
    </div>
  );
}

/* ─── Tasks subtab (grouped + filterable) ─── */

function PhaseTasksSubtab({
  householdId,
  projectId,
  phaseId,
  tasks,
  phases,
  householdMembers,
  dependencyCandidates,
}: {
  householdId: string;
  projectId: string;
  phaseId: string;
  tasks: ProjectTask[];
  phases: ProjectPhaseSummary[];
  householdMembers: HouseholdMember[];
  dependencyCandidates: ProjectTask[];
}) {
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [orderedTasks, setOrderedTasks] = useState<ProjectTask[]>(tasks);
  const [filterSearch, setFilterSearch] = useState("");
  const [filterAssigneeId, setFilterAssigneeId] = useState("");
  const [sortMode, setSortMode] = useState<"manual" | "dueDate" | "name">("manual");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [groupsCollapsed, setGroupsCollapsed] = useState<Record<string, boolean>>({ completed: true });

  useEffect(() => { setOrderedTasks(tasks); }, [tasks]);

  const filteredTasks = useMemo(() => {
    let t = orderedTasks;
    if (filterSearch) {
      const q = filterSearch.toLowerCase();
      t = t.filter((task) => task.title.toLowerCase().includes(q));
    }
    if (filterAssigneeId) {
      t = t.filter((task) => task.assignedToId === filterAssigneeId);
    }
    return t;
  }, [orderedTasks, filterSearch, filterAssigneeId]);

  const sortTasks = useCallback((taskList: ProjectTask[]) => {
    if (sortMode === "manual") return taskList;
    return [...taskList].sort((a, b) => {
      if (sortMode === "dueDate") {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      }
      return a.title.localeCompare(b.title);
    });
  }, [sortMode]);

  const groups = useMemo(() => [
    { id: "in_progress", label: "In Progress", colorClass: "task-group--in-progress", tasks: sortTasks(filteredTasks.filter((t) => t.status === "in_progress" && !t.isBlocked)) },
    { id: "blocked",    label: "Blocked",     colorClass: "task-group--blocked",     tasks: sortTasks(filteredTasks.filter((t) => t.isBlocked)) },
    { id: "pending",    label: "Pending",     colorClass: "task-group--pending",     tasks: sortTasks(filteredTasks.filter((t) => t.status === "pending" && !t.isBlocked)) },
    { id: "completed",  label: "Completed",   colorClass: "task-group--completed",   tasks: sortTasks(filteredTasks.filter((t) => t.status === "completed")) },
  ].filter((g) => g.tasks.length > 0), [filteredTasks, sortTasks]);

  const totalCount = orderedTasks.length;
  const completedCount = orderedTasks.filter((t) => t.status === "completed").length;
  const inProgressCount = orderedTasks.filter((t) => t.status === "in_progress" && !t.isBlocked).length;
  const blockedCount = orderedTasks.filter((t) => t.isBlocked).length;
  const pendingCount = orderedTasks.filter((t) => t.status === "pending" && !t.isBlocked).length;

  const toggleSelectTask = (taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId); else next.add(taskId);
      return next;
    });
  };

  const handleBulkStatus = (status: "completed" | "pending") => {
    for (const id of selectedTaskIds) {
      const task = orderedTasks.find((t) => t.id === id);
      if (!task) continue;
      const form = new FormData();
      form.set("householdId", householdId);
      form.set("projectId", projectId);
      form.set("taskId", id);
      form.set("phaseId", phaseId);
      form.set("title", task.title);
      form.set("status", status);
      updateProjectTaskAction(form);
    }
    setSelectedTaskIds(new Set());
    setSelectMode(false);
  };

  const handleBulkMoveTo = async (targetPhaseId: string) => {
    for (const id of selectedTaskIds) {
      await updateProjectTask(householdId, projectId, id, { phaseId: targetPhaseId });
    }
    setSelectedTaskIds(new Set());
    setSelectMode(false);
  };

  const handleBulkDelete = () => {
    for (const id of selectedTaskIds) {
      const form = new FormData();
      form.set("householdId", householdId);
      form.set("projectId", projectId);
      form.set("taskId", id);
      deleteProjectTaskAction(form);
    }
    setSelectedTaskIds(new Set());
    setSelectMode(false);
  };

  const otherPhases = phases.filter((p) => p.id !== phaseId);

  return (
    <div>
      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="task-progress">
          <div className="task-progress__bar">
            {completedCount > 0 && <div className="task-progress__segment task-progress__segment--completed" style={{ width: `${(completedCount / totalCount) * 100}%` }} />}
            {inProgressCount > 0 && <div className="task-progress__segment task-progress__segment--in-progress" style={{ width: `${(inProgressCount / totalCount) * 100}%` }} />}
            {blockedCount > 0 && <div className="task-progress__segment task-progress__segment--blocked" style={{ width: `${(blockedCount / totalCount) * 100}%` }} />}
            {pendingCount > 0 && <div className="task-progress__segment task-progress__segment--pending" style={{ width: `${(pendingCount / totalCount) * 100}%` }} />}
          </div>
          <span className="task-progress__label">{completedCount} / {totalCount} complete</span>
        </div>
      )}

      {/* Toolbar */}
      <div className="task-toolbar">
        <input
          type="text"
          className="task-toolbar__search"
          placeholder="Search"
          value={filterSearch}
          onChange={(e) => setFilterSearch(e.target.value)}
        />
        <div className="task-toolbar__row">
          {householdMembers.length > 0 && (
            <select
              className="task-toolbar__select"
              value={filterAssigneeId}
              onChange={(e) => setFilterAssigneeId(e.target.value)}
            >
              <option value="">All assignees</option>
              {householdMembers.map((m) => (
                <option key={m.userId} value={m.userId}>{m.user.displayName ?? m.user.email ?? m.userId}</option>
              ))}
            </select>
          )}
          <select
            className="task-toolbar__select"
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as typeof sortMode)}
          >
            <option value="manual">Sort: Manual</option>
            <option value="dueDate">Sort: Due Date</option>
            <option value="name">Sort: Name</option>
          </select>
          <button
            type="button"
            className={`button button--ghost button--sm${selectMode ? " button--active" : ""}`}
            onClick={() => { setSelectMode(!selectMode); setSelectedTaskIds(new Set()); }}
          >
            {selectMode ? "Cancel" : "Select"}
          </button>
        </div>
      </div>

      {/* Grouped task list */}
      {orderedTasks.length === 0 ? (
        <p style={{ padding: "8px 0 4px", color: "var(--ink-muted)", fontSize: "0.84rem" }}>No tasks yet.</p>
      ) : filteredTasks.length === 0 ? (
        <p style={{ padding: "8px 0 4px", color: "var(--ink-muted)", fontSize: "0.84rem" }}>No matches.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
          {groups.map((group) => (
            <div key={group.id} className={`task-group ${group.colorClass}`}>
              <button
                type="button"
                className="task-group__header"
                onClick={() => setGroupsCollapsed((prev) => ({ ...prev, [group.id]: !prev[group.id] }))}
              >
                <span className="task-group__chevron">{groupsCollapsed[group.id] ? "›" : "⌄"}</span>
                <span className="task-group__label">{group.label}</span>
                <span className="task-group__count">{group.tasks.length}</span>
              </button>
              {!groupsCollapsed[group.id] && (
                <div className="task-list-container" style={{ borderRadius: "0 0 8px 8px", overflow: "hidden", border: "1px solid var(--border)", borderTop: "none" }}>
                  <SortableList
                    items={group.tasks}
                    onReorder={(newIds) => {
                      const groupIds = new Set(group.tasks.map((t) => t.id));
                      const positions = orderedTasks.map((t, i) => (groupIds.has(t.id) ? i : -1)).filter((i) => i !== -1);
                      const reordered = newIds.map((id) => orderedTasks.find((t) => t.id === id)!);
                      const next = [...orderedTasks];
                      reordered.forEach((task, pos) => { next[positions[pos]!] = task; });
                      setOrderedTasks(next);
                      newIds.forEach((id, i) => { updateProjectTask(householdId, projectId, id, { sortOrder: i }); });
                    }}
                    renderItem={(task, dragHandleProps) => (
                      <TaskCompactRow
                        householdId={householdId}
                        projectId={projectId}
                        phaseId={phaseId}
                        task={task}
                        expanded={expandedTaskId === task.id}
                        onToggle={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                        householdMembers={householdMembers}
                        dependencyCandidates={dependencyCandidates.filter((c) => c.id !== task.id)}
                        dragHandleProps={dragHandleProps}
                        selectMode={selectMode}
                        selected={selectedTaskIds.has(task.id)}
                        onSelectToggle={() => toggleSelectTask(task.id)}
                      />
                    )}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Quick add row */}
      <form action={createProjectTaskAction} className="task-quick-add">
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="phaseId" value={phaseId} />
        <span style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>+</span>
        <input
          name="title"
          className="task-quick-add__input"
          placeholder="Add task — press Enter"
          required
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.currentTarget.form?.requestSubmit();
              setTimeout(() => { e.currentTarget.value = ""; }, 50);
            }
          }}
        />
      </form>

      {/* Bulk action bar */}
      {selectMode && selectedTaskIds.size > 0 && (
        <div className="task-bulk-bar">
          <span className="task-bulk-bar__count">{selectedTaskIds.size} selected</span>
          <button type="button" className="button button--ghost button--sm" onClick={() => handleBulkStatus("completed")}>Mark Complete</button>
          <button type="button" className="button button--ghost button--sm" onClick={() => handleBulkStatus("pending")}>Mark Pending</button>
          {otherPhases.length > 0 && (
            <select
              className="task-toolbar__select"
              defaultValue=""
              onChange={(e) => { if (e.target.value) { void handleBulkMoveTo(e.target.value); e.target.value = ""; } }}
            >
              <option value="" disabled>Move to phase…</option>
              {otherPhases.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
            </select>
          )}
          <button type="button" className="button button--danger button--sm" onClick={handleBulkDelete}>Delete</button>
        </div>
      )}
    </div>
  );
}

/* ─── Task Compact Row ─── */

function TaskCompactRow({
  householdId,
  projectId,
  phaseId,
  task,
  expanded,
  onToggle,
  householdMembers,
  dependencyCandidates,
  dragHandleProps,
  selectMode,
  selected,
  onSelectToggle,
}: {
  householdId: string;
  projectId: string;
  phaseId: string;
  task: ProjectTask;
  expanded: boolean;
  onToggle: () => void;
  householdMembers: HouseholdMember[];
  dependencyCandidates: ProjectTask[];
  dragHandleProps?: DragHandleProps;
  selectMode?: boolean;
  selected?: boolean;
  onSelectToggle?: () => void;
}) {
  const isDone = task.status === "completed";

  const assignee = task.assignedToId
    ? householdMembers.find((m) => m.userId === task.assignedToId)
    : null;
  const assigneeName = assignee?.user?.displayName ?? assignee?.user?.email ?? null;

  const checklistTotal = task.checklistItems.length;
  const checklistDone = task.checklistItems.filter((i) => i.isCompleted).length;

  const blockingTaskNames = (task.blockingTaskIds ?? [])
    .map((id) => dependencyCandidates.find((t) => t.id === id)?.title ?? "a task")
    .slice(0, 2);

  const handleCheckToggle = useCallback(() => {
    const form = new FormData();
    form.set("householdId", householdId);
    form.set("projectId", projectId);
    form.set("taskId", task.id);
    form.set("phaseId", phaseId);
    form.set("title", task.title);
    form.set("status", isDone ? "pending" : "completed");
    updateProjectTaskAction(form);
  }, [householdId, projectId, phaseId, task.id, task.title, isDone]);

  return (
    <>
      <div
        className={`task-row${expanded ? " task-row--expanded" : ""}${dragHandleProps ? " task-row--sortable" : ""}`}
        onClick={selectMode ? onSelectToggle : onToggle}
      >
        {selectMode ? (
          <input
            type="checkbox"
            className="task-row__check"
            checked={selected ?? false}
            onChange={onSelectToggle}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <>
            {dragHandleProps && (
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
                onClick={(e) => e.stopPropagation()}
                className="drag-handle"
              />
            )}
            <input
              type="checkbox"
              className="task-row__check"
              checked={isDone}
              onChange={handleCheckToggle}
              onClick={(e) => e.stopPropagation()}
            />
          </>
        )}
        <span className={`task-row__title${isDone ? " task-row__title--done" : ""}`}>{task.title}</span>
        {checklistTotal > 0 && (
          <span className="task-row__checklist-progress" title={`${checklistDone} of ${checklistTotal} sub-steps done`}>
            <span className="task-row__checklist-fraction" style={{ color: checklistDone === checklistTotal ? "var(--success)" : "var(--ink-muted)" }}>
              {checklistDone}/{checklistTotal}
            </span>
            <span className="progress-bar" style={{ width: 48 }}>
              <span
                className="progress-bar__fill"
                style={{
                  width: `${Math.round((checklistDone / checklistTotal) * 100)}%`,
                  background: checklistDone === checklistTotal ? "var(--success)" : undefined,
                }}
              />
            </span>
          </span>
        )}
        {assigneeName && (
          <span className="task-row__meta" style={{ fontSize: "0.75rem", color: "var(--ink-muted)", maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={assigneeName}>
            {assigneeName}
          </span>
        )}
        <span className="task-row__meta">{task.dueDate ? formatDate(task.dueDate) : ""}</span>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {task.isBlocked && (
            <span
              className="pill pill--warning"
              style={{ fontSize: "0.72rem" }}
              title={blockingTaskNames.length > 0 ? `Waiting on: ${blockingTaskNames.join(", ")}${(task.blockingTaskIds?.length ?? 0) > 2 ? " and more" : ""}` : "Blocked by an incomplete predecessor"}
            >
              Blocked{blockingTaskNames.length > 0 ? `: ${blockingTaskNames[0]}${(task.blockingTaskIds?.length ?? 0) > 1 ? ` +${(task.blockingTaskIds?.length ?? 0) - 1}` : ""}` : ""}
            </span>
          )}
          {task.isCriticalPath && <span className="pill pill--accent" style={{ fontSize: "0.72rem" }}>Critical</span>}
        </div>
      </div>

      {expanded && (
        <div className="task-row__detail">
          <form action={updateProjectTaskAction}>
            <input type="hidden" name="householdId" value={householdId} />
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="taskId" value={task.id} />
            <input type="hidden" name="phaseId" value={phaseId} />
            <div className="form-grid">
              <label className="field field--full">
                <span>Title</span>
                <input name="title" defaultValue={task.title} required />
              </label>
              <label className="field field--full">
                <span>Description</span>
                <textarea name="description" rows={2} defaultValue={task.description ?? ""} />
              </label>
              <label className="field">
                <span>Status</span>
                <select name="status" defaultValue={task.status}>
                  {statusOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Assignee</span>
                <select name="assignedToId" defaultValue={task.assignedToId ?? ""}>
                  <option value="">Unassigned</option>
                  {householdMembers.map((m) => (
                    <option key={m.id} value={m.userId}>{m.user.displayName ?? m.user.email ?? m.userId}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Due Date</span>
                <input name="dueDate" type="date" defaultValue={toDateInputValue(task.dueDate)} />
              </label>
              <label className="field">
                <span>Estimated Hours</span>
                <input name="estimatedHours" type="number" min="0" step="0.25" defaultValue={task.estimatedHours ?? ""} />
              </label>
              <label className="field">
                <span>Actual Hours</span>
                <input name="actualHours" type="number" min="0" step="0.25" defaultValue={task.actualHours ?? ""} />
              </label>
              <label className="field">
                <span>Estimated Cost</span>
                <input name="estimatedCost" type="number" min="0" step="0.01" defaultValue={task.estimatedCost ?? ""} />
              </label>
              <label className="field">
                <span>Actual Cost</span>
                <input name="actualCost" type="number" min="0" step="0.01" defaultValue={task.actualCost ?? ""} />
              </label>
            </div>
            <div className="inline-actions" style={{ marginTop: 12 }}>
              <button type="submit" className="button button--ghost button--sm">Save</button>
            </div>
          </form>

          <div style={{ marginTop: 16 }}>
            <ProjectTaskDependencyEditor
              householdId={householdId}
              projectId={projectId}
              taskId={task.id}
              allTasks={dependencyCandidates}
            />
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: "0.8rem", color: "var(--ink-muted)", marginBottom: 8 }}>Task checklist</div>
            <ProjectChecklist
              items={task.checklistItems}
              householdId={householdId}
              projectId={projectId}
              parentFieldName="taskId"
              parentId={task.id}
              addAction={createTaskChecklistItemAction}
              toggleAction={updateTaskChecklistItemAction}
              deleteAction={deleteTaskChecklistItemAction}
              addPlaceholder="Add step"
              emptyMessage="No sub-steps."
              onReorder={(orderedIds) => reorderTaskChecklistItems(householdId, projectId, task.id, orderedIds)}
            />
          </div>

          <div style={{ marginTop: 12 }}>
            <AttachmentSection householdId={householdId} entityType="project_task" entityId={task.id} compact label="" />
          </div>

          <div style={{ marginTop: 12 }}>
            <ConfirmActionForm
              action={deleteProjectTaskAction}
              hiddenFields={[
                { name: "householdId", value: householdId },
                { name: "projectId", value: projectId },
                { name: "taskId", value: task.id },
              ]}
              prompt="Delete this task?"
              triggerLabel="Delete Task"
              confirmLabel="Confirm"
              triggerClassName="button button--danger button--sm"
              confirmClassName="button button--danger button--sm"
              cancelClassName="button button--ghost button--sm"
            />
          </div>
        </div>
      )}
    </>
  );
}

/* ─── Supplies subtab ─── */

const DEFAULT_SUPPLY_CATEGORIES = ["Materials", "Hardware", "Finishes", "Fixtures", "Logistics"];

function PhaseSuppliesSubtab({
  householdId,
  projectId,
  phaseId,
  supplies,
  inventoryItems,
  inventoryLookup,
}: {
  householdId: string;
  projectId: string;
  phaseId: string;
  supplies: ProjectPhaseDetail["supplies"];
  inventoryItems: InventoryItemSummary[];
  inventoryLookup: Map<string, InventoryItemSummary>;
}) {
  const [localSupplies, setLocalSupplies] = useState(supplies);
  const [optimisticCategories, setOptimisticCategories] = useState<Record<string, string | null>>({});

  useEffect(() => {
    setLocalSupplies(supplies);
  }, [supplies]);

  type SupplyItem = ProjectPhaseDetail["supplies"][number];

  const getCategory = useCallback(
    (s: SupplyItem) => {
      const override = Object.prototype.hasOwnProperty.call(optimisticCategories, s.id)
        ? optimisticCategories[s.id]
        : s.category;
      return override?.trim() || null;
    },
    [optimisticCategories],
  );

  const getSearchText = useCallback(
    (s: SupplyItem) =>
      [s.name, s.category, s.supplier, s.description, s.notes].filter(Boolean).join(" "),
    [],
  );

  const handleCategoryChange = (supplyId: string, category: string | null) => {
    setOptimisticCategories((prev) => ({ ...prev, [supplyId]: category }));
  };

  const handleSectionReorder = async (newIds: string[]) => {
    const previousLocalSupplies = localSupplies;
    const sectionIds = new Set(newIds);
    const positions = previousLocalSupplies
      .map((s, i) => (sectionIds.has(s.id) ? i : -1))
      .filter((i) => i !== -1);
    const next = [...previousLocalSupplies];
    newIds.forEach((id, pos) => {
      next[positions[pos]!] = previousLocalSupplies.find((s) => s.id === id)!;
    });
    setLocalSupplies(next);
    try {
      await reorderProjectPhaseSupplies(householdId, projectId, phaseId, next.map((s) => s.id));
    } catch {
      setLocalSupplies(previousLocalSupplies);
    }
  };

  const supplyStatusFilter = useMemo(
    () => ({
      options: [
        { value: "outstanding", label: "Outstanding" },
        { value: "purchased", label: "Purchased" },
      ],
      getMatch: (s: SupplyItem, v: string) =>
        v === "purchased" ? s.isProcured : !s.isProcured,
    }),
    [],
  );

  const getSectionTags = useCallback((items: SupplyItem[]) => {
    const purchased = items.filter((s) => s.isProcured).length;
    const outstanding = items.length - purchased;
    const tags: { label: string; variant: "success" | "warning" | "muted" }[] = [];
    if (purchased > 0) tags.push({ label: `${purchased} purchased`, variant: "success" });
    if (outstanding > 0) tags.push({ label: `${outstanding} outstanding`, variant: "warning" });
    return tags;
  }, []);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <CategoryAccordionList
        items={localSupplies}
        getSearchText={getSearchText}
        getCategory={getCategory}
        defaultCategories={DEFAULT_SUPPLY_CATEGORIES}
        searchPlaceholder="Search supplies..."
        emptyMessage="No supplies for this phase."
        noMatchMessage="No supplies match your filters."
        statusFilter={supplyStatusFilter}
        getSectionTags={getSectionTags}
        renderItems={(items, allCategories) => (
          <SortableList
            items={items}
            onReorder={(newIds) => { void handleSectionReorder(newIds); }}
            renderItem={(supply, dragHandleProps) => (
              <ProjectSupplyCard
                householdId={householdId}
                projectId={projectId}
                phaseId={phaseId}
                supply={supply}
                inventoryItems={inventoryItems}
                categories={allCategories}
                onCategoryChange={handleCategoryChange}
                dragHandleProps={dragHandleProps}
                {...(supply.inventoryItemId && inventoryLookup.has(supply.inventoryItemId)
                  ? { linkedInventoryItem: inventoryLookup.get(supply.inventoryItemId)! }
                  : {})}
              />
            )}
          />
        )}
        footer={
          <ProjectSupplyCreateForm
            householdId={householdId}
            projectId={projectId}
            phaseId={phaseId}
            inventoryItems={inventoryItems}
            categorySuggestions={DEFAULT_SUPPLY_CATEGORIES}
          />
        }
      />
    </div>
  );
}

/* ─── Expenses subtab (ledger table) ─── */

function PhaseExpensesSubtab({
  householdId,
  projectId,
  phaseId,
  expenses,
  serviceProviders,
  budgetCategories,
  budgetAmount,
  expenseTotal,
}: {
  householdId: string;
  projectId: string;
  phaseId: string;
  expenses: ProjectExpense[];
  serviceProviders: ServiceProvider[];
  budgetCategories: ProjectBudgetCategorySummary[];
  budgetAmount?: number | null;
  expenseTotal?: number;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const total = expenseTotal ?? expenses.reduce((sum, e) => sum + e.amount, 0);
  const remaining = budgetAmount != null ? budgetAmount - total : null;
  const isOverBudget = remaining != null && remaining < 0;

  return (
    <div>
      {/* Budget summary card */}
      {budgetAmount != null && budgetAmount > 0 && (
        <div className="expense-budget-card">
          <div className="expense-budget-card__item">
            <span className="expense-budget-card__label">Budget</span>
            <span className="expense-budget-card__value">{formatCurrency(budgetAmount)}</span>
          </div>
          <div className="expense-budget-card__item">
            <span className="expense-budget-card__label">Spent</span>
            <span className="expense-budget-card__value">{formatCurrency(total)}</span>
          </div>
          <div className="expense-budget-card__item">
            <span className="expense-budget-card__label">Remaining</span>
            <span className={`expense-budget-card__value${isOverBudget ? " expense-budget-card__value--over" : ""}`}>
              {isOverBudget ? "-" : ""}{formatCurrency(Math.abs(remaining!))}
            </span>
          </div>
          <div className="expense-budget-card__bar-wrap">
            <div
              className={`expense-budget-card__bar${isOverBudget ? " expense-budget-card__bar--over" : ""}`}
              style={{ width: `${Math.min((total / budgetAmount) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Expense table */}
      {expenses.length === 0 ? (
        <p style={{ padding: "12px 0", color: "var(--ink-muted)", fontSize: "0.88rem" }}>No expenses for this phase.</p>
      ) : (
        <div className="expense-table-wrap">
          <table className="expense-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Category</th>
                <th>Provider</th>
                <th style={{ textAlign: "right" }}>Amount</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => (
                <Fragment key={expense.id}>
                  <tr
                    className={`expense-table__row${expandedId === expense.id ? " expense-table__row--expanded" : ""}`}
                    onClick={() => setExpandedId(expandedId === expense.id ? null : expense.id)}
                  >
                    <td className="expense-table__date">{expense.date ? formatDate(expense.date) : "—"}</td>
                    <td className="expense-table__desc">{expense.description}</td>
                    <td className="expense-table__cat">{expense.category ?? "—"}</td>
                    <td className="expense-table__provider">{serviceProviders.find((p) => p.id === expense.serviceProviderId)?.name ?? "—"}</td>
                    <td className="expense-table__amount">{formatCurrency(expense.amount)}</td>
                    <td><span className="expense-table__chevron">{expandedId === expense.id ? "⌄" : "›"}</span></td>
                  </tr>
                  {expandedId === expense.id && (
                    <tr className="expense-table__edit-row">
                      <td colSpan={6}>
                        <div style={{ padding: "8px 12px" }}>
                          <form action={updateProjectExpenseAction}>
                            <input type="hidden" name="householdId" value={householdId} />
                            <input type="hidden" name="projectId" value={projectId} />
                            <input type="hidden" name="expenseId" value={expense.id} />
                            <input type="hidden" name="phaseId" value={phaseId} />
                            <div className="form-grid">
                              <label className="field field--full">
                                <span>Description</span>
                                <input name="description" defaultValue={expense.description} required />
                              </label>
                              <label className="field">
                                <span>Amount</span>
                                <input name="amount" type="number" min="0" step="0.01" defaultValue={expense.amount} required />
                              </label>
                              <label className="field">
                                <span>Category</span>
                                <input name="category" defaultValue={expense.category ?? ""} />
                              </label>
                              <label className="field">
                                <span>Budget Category</span>
                                <select name="budgetCategoryId" defaultValue={expense.budgetCategoryId ?? ""}>
                                  <option value="">None</option>
                                  {budgetCategories.map((c) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                  ))}
                                </select>
                              </label>
                              <label className="field">
                                <span>Service Provider</span>
                                <select name="serviceProviderId" defaultValue={expense.serviceProviderId ?? ""}>
                                  <option value="">None</option>
                                  {serviceProviders.map((p) => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                  ))}
                                </select>
                              </label>
                              <label className="field">
                                <span>Date</span>
                                <input name="date" type="date" defaultValue={toDateInputValue(expense.date)} />
                              </label>
                              <label className="field field--full">
                                <span>Notes</span>
                                <textarea name="notes" rows={2} defaultValue={expense.notes ?? ""} />
                              </label>
                            </div>
                            <div className="inline-actions" style={{ marginTop: 12 }}>
                              <button type="submit" className="button button--ghost button--sm">Save</button>
                            </div>
                          </form>
                          <div style={{ marginTop: 8 }}>
                            <ConfirmActionForm
                              action={deleteProjectExpenseAction}
                              hiddenFields={[
                                { name: "householdId", value: householdId },
                                { name: "projectId", value: projectId },
                                { name: "expenseId", value: expense.id },
                              ]}
                              prompt="Delete this expense?"
                              triggerLabel="Delete"
                              confirmLabel="Yes"
                              triggerClassName="button button--danger button--sm"
                              confirmClassName="button button--danger button--sm"
                              cancelClassName="button button--ghost button--sm"
                            />
                          </div>
                          <div style={{ marginTop: 12 }}>
                            <AttachmentSection
                              householdId={householdId}
                              entityType="project_expense"
                              entityId={expense.id}
                              compact
                              label="Receipts &amp; Documentation"
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr className="expense-table__total-row">
                <td colSpan={4} />
                <td style={{ textAlign: "right", fontWeight: 600 }}>{formatCurrency(total)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Quick add expense */}
      <div className="expense-quick-add">
        <form action={createProjectExpenseAction} className="expense-quick-add__form">
          <input type="hidden" name="householdId" value={householdId} />
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="phaseId" value={phaseId} />
          <input name="description" className="expense-quick-add__input" placeholder="Description" required />
          <input name="category" className="expense-quick-add__input expense-quick-add__input--narrow" placeholder="Category" />
          <input name="date" type="date" className="expense-quick-add__input expense-quick-add__input--narrow" />
          <input name="amount" type="number" min="0" step="0.01" className="expense-quick-add__input expense-quick-add__input--amount" placeholder="Amount" required />
          <button type="submit" className="button button--sm">+ Add</button>
        </form>
      </div>
    </div>
  );
}

/* ─── Phase Notes Editor ─── */

function PhaseNotesEditor({
  householdId,
  phase,
  onNotesLoaded,
}: {
  householdId: string;
  projectId: string;
  phase: ProjectPhaseDetail;
  onNotesLoaded?: (hasNotes: boolean) => void;
}) {
  const [entryId, setEntryId] = useState<string | null>(null);
  const [content, setContent] = useState<string>("");
  const [ready, setReady] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingEntryIdRef = useRef<string | null>(null);

  useEffect(() => {
    getEntries(householdId, {
      entityType: "project_phase",
      entityId: phase.id,
      limit: 1,
    }).then((result) => {
      const entry: Entry | undefined = result.items[0];
      if (entry) {
        setEntryId(entry.id);
        pendingEntryIdRef.current = entry.id;
        setContent(entry.body ?? "");
        onNotesLoaded?.(true);
      } else if (phase.notes) {
        // Migrate legacy plain-text notes field: convert to HTML paragraphs
        const html = phase.notes
          .split(/\n\n+/)
          .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
          .join("");
        setContent(html);
        onNotesLoaded?.(true);
      } else {
        onNotesLoaded?.(false);
      }
      setReady(true);
    }).catch(() => {
      setReady(true);
    });
  }, [householdId, phase.id, phase.notes, onNotesLoaded]);

  const handleChange = useCallback(
    (html: string) => {
      setContent(html);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(async () => {
        const currentEntryId = pendingEntryIdRef.current;
        if (currentEntryId) {
          await updateEntry(householdId, currentEntryId, {
            body: html,
            bodyFormat: "rich_text",
          });
        } else {
          const created = await createEntry(householdId, {
            body: html,
            bodyFormat: "rich_text",
            entryDate: new Date().toISOString(),
            entityType: "project_phase",
            entityId: phase.id,
            entryType: "note",
            flags: [],
            tags: [],
            measurements: [],
          });
          pendingEntryIdRef.current = created.id;
          setEntryId(created.id);
          onNotesLoaded?.(true);
        }
      }, 800);
    },
    [householdId, phase.id, onNotesLoaded]
  );

  if (!ready) {
    return <div className="phase-notes-editor--loading" />;
  }

  return (
    <div style={{ padding: "8px 0" }}>
      <RichEditor
        content={content}
        onChange={handleChange}
        placeholder="Phase notes — anything relevant to planning or execution..."
      />
    </div>
  );
}

/* ─── Unphased Tasks Panel ─── */

function UnphasedTasksPanel({
  householdId,
  projectId,
  tasks,
  householdMembers,
  allTasks,
}: {
  householdId: string;
  projectId: string;
  tasks: ProjectTask[];
  householdMembers: HouseholdMember[];
  allTasks: ProjectTask[];
}) {
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const dependencyCandidates = allTasks.filter((t) => t.taskType !== "quick");

  return (
    <div>
      <h3 style={{ marginBottom: 12, fontSize: "1.1rem" }}>Unphased Tasks</h3>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginBottom: 16 }}>
        Tasks not assigned to any phase. Assign them to a phase from the task detail.
      </p>

      {tasks.length > 0 && (
        <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
          {tasks.map((task) => (
            <TaskCompactRow
              key={task.id}
              householdId={householdId}
              projectId={projectId}
              phaseId=""
              task={task}
              expanded={expandedTaskId === task.id}
              onToggle={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
              householdMembers={householdMembers}
              dependencyCandidates={dependencyCandidates.filter((c) => c.id !== task.id)}
            />
          ))}
        </div>
      )}

      <form action={createProjectTaskAction} className="task-quick-add">
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="projectId" value={projectId} />
        <span style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>+</span>
        <input
          name="title"
          className="task-quick-add__input"
          placeholder="Add unphased task — press Enter"
          required
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.currentTarget.form?.requestSubmit();
              setTimeout(() => { e.currentTarget.value = ""; }, 50);
            }
          }}
        />
      </form>
    </div>
  );
}
