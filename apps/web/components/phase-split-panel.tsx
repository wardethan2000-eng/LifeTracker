"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type {
  HouseholdMember,
  InventoryItemSummary,
  ProjectBudgetCategorySummary,
  ProjectExpense,
  ProjectPhaseDetail,
  ProjectPhaseSummary,
  ProjectTask,
  ServiceProvider
} from "@lifekeeper/types";
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
import { RichEditor } from "./rich-editor";

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

  const selectedPhase = phaseDetails.find((p) => p.id === selectedPhaseId);
  const selectedPhaseSummary = phases.find((p) => p.id === selectedPhaseId);

  const totalTasks = phases.reduce((s, p) => s + p.taskCount, 0) + unphasedTasks.length;
  const totalBudget = phases.reduce((s, p) => s + (p.budgetAmount ?? 0), 0);
  const totalSpent = phases.reduce((s, p) => s + p.expenseTotal, 0);

  return (
    <div>
      {/* Summary bar */}
      <div className="workspace-summary-bar" style={{ marginBottom: 16 }}>
        <span><strong>{phases.length}</strong> phases</span>
        <span><strong>{totalTasks}</strong> tasks</span>
        {totalBudget > 0 && <span><strong>{formatCurrency(totalBudget)}</strong> budget</span>}
        {totalSpent > 0 && <span><strong>{formatCurrency(totalSpent)}</strong> spent</span>}
      </div>

      <div className="phase-split">
        {/* ── Left: Phase list ── */}
        <div className="phase-split__list">
          <div className="phase-split__list-header">
            <h3>Phases</h3>
            <AddPhaseButton householdId={householdId} projectId={projectId} />
          </div>

          {phases.map((phase, index) => (
            <button
              key={phase.id}
              type="button"
              className={`phase-list-item${selectedPhaseId === phase.id && !showUnphased ? " phase-list-item--active" : ""}`}
              onClick={() => { setSelectedPhaseId(phase.id); setShowUnphased(false); }}
            >
              <div className="phase-list-item__top">
                <span className={`phase-list-item__dot phase-list-item__dot--${phase.status}`} />
                <span className="phase-list-item__name">{index + 1}. {phase.name}</span>
              </div>
              <span className="phase-list-item__progress">
                {phase.completedTaskCount}/{phase.taskCount} tasks · {phase.completedChecklistItemCount}/{phase.checklistItemCount} checks
              </span>
            </button>
          ))}

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

  const subTabs: { id: PhaseSubTab; label: string; count?: number }[] = [
    { id: "tasks", label: "Tasks", count: phase.tasks.length },
    { id: "checklist", label: "Checklist", count: phase.checklistItemCount },
    { id: "supplies", label: "Supplies", count: phase.supplies.length },
    { id: "expenses", label: "Expenses", count: phase.expenses.length },
    { id: "photos", label: "Photos" },
    { id: "notes", label: "Notes" },
  ];

  return (
    <div>
      {/* ── Phase header ── */}
      <div className="phase-detail-header">
        <form action={updateProjectPhaseAction} style={{ display: "contents" }}>
          <input type="hidden" name="householdId" value={householdId} />
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="phaseId" value={phase.id} />

          <input
            name="name"
            defaultValue={phase.name}
            className="phase-detail-header__title"
            style={{ border: "none", background: "transparent", fontFamily: "inherit", outline: "none", padding: 0, width: "100%" }}
            onBlur={(e) => e.currentTarget.form?.requestSubmit()}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}
          />

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
          householdMembers={householdMembers}
          dependencyCandidates={dependencyCandidates}
        />
      )}

      {subTab === "checklist" && (
        <div style={{ padding: "8px 0" }}>
          <ProjectChecklist
            items={phase.checklistItems}
            householdId={householdId}
            projectId={projectId}
            parentFieldName="phaseId"
            parentId={phase.id}
            addAction={createPhaseChecklistItemAction}
            toggleAction={updatePhaseChecklistItemAction}
            deleteAction={deletePhaseChecklistItemAction}
            addPlaceholder="Add a readiness check"
            emptyMessage="No checklist items yet."
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
          confirmLabel="Yes, delete"
          triggerClassName="button button--danger button--sm"
          confirmClassName="button button--danger button--sm"
          cancelClassName="button button--ghost button--sm"
        />
      </div>
    </div>
  );
}

/* ─── Tasks subtab (compact rows) ─── */

function PhaseTasksSubtab({
  householdId,
  projectId,
  phaseId,
  tasks,
  householdMembers,
  dependencyCandidates,
}: {
  householdId: string;
  projectId: string;
  phaseId: string;
  tasks: ProjectTask[];
  householdMembers: HouseholdMember[];
  dependencyCandidates: ProjectTask[];
}) {
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  return (
    <div>
      {tasks.length === 0 ? (
        <p style={{ padding: "16px 0", color: "var(--ink-muted)", fontSize: "0.88rem" }}>No tasks in this phase yet.</p>
      ) : (
        <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
          {tasks.map((task) => (
            <TaskCompactRow
              key={task.id}
              householdId={householdId}
              projectId={projectId}
              phaseId={phaseId}
              task={task}
              expanded={expandedTaskId === task.id}
              onToggle={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
              householdMembers={householdMembers}
              dependencyCandidates={dependencyCandidates.filter((c) => c.id !== task.id)}
            />
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
}: {
  householdId: string;
  projectId: string;
  phaseId: string;
  task: ProjectTask;
  expanded: boolean;
  onToggle: () => void;
  householdMembers: HouseholdMember[];
  dependencyCandidates: ProjectTask[];
}) {
  const isDone = task.status === "completed";

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
      <div className={`task-row${expanded ? " task-row--expanded" : ""}`} onClick={onToggle}>
        <input
          type="checkbox"
          className="task-row__check"
          checked={isDone}
          onChange={handleCheckToggle}
          onClick={(e) => e.stopPropagation()}
        />
        <span className={`task-row__title${isDone ? " task-row__title--done" : ""}`}>{task.title}</span>
        <span className="task-row__meta">{task.assignedToId ? "👤" : ""}</span>
        <span className="task-row__meta">{task.dueDate ? formatDate(task.dueDate) : ""}</span>
        <div style={{ display: "flex", gap: 4 }}>
          {task.isBlocked && <span className="pill pill--warning" style={{ fontSize: "0.72rem" }}>Blocked</span>}
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
              <label className="field field--full">
                <span>Depends On</span>
                <select name="predecessorTaskIds" multiple size={Math.min(Math.max(dependencyCandidates.length, 2), 4)} defaultValue={task.predecessorTaskIds}>
                  {dependencyCandidates.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="inline-actions" style={{ marginTop: 12 }}>
              <button type="submit" className="button button--ghost button--sm">Save</button>
            </div>
          </form>

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
              confirmLabel="Yes, delete"
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
  const [optimisticCategories, setOptimisticCategories] = useState<Record<string, string | null>>({});

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
        items={supplies}
        getSearchText={getSearchText}
        getCategory={getCategory}
        defaultCategories={DEFAULT_SUPPLY_CATEGORIES}
        searchPlaceholder="Search supplies..."
        emptyMessage="No supplies for this phase."
        noMatchMessage="No supplies match your filters."
        statusFilter={supplyStatusFilter}
        getSectionTags={getSectionTags}
        renderItems={(items, allCategories) =>
          items.map((supply) => (
            <ProjectSupplyCard
              key={supply.id}
              householdId={householdId}
              projectId={projectId}
              phaseId={phaseId}
              supply={supply}
              inventoryItems={inventoryItems}
              categories={allCategories}
              onCategoryChange={handleCategoryChange}
              {...(supply.inventoryItemId && inventoryLookup.has(supply.inventoryItemId)
                ? { linkedInventoryItem: inventoryLookup.get(supply.inventoryItemId)! }
                : {})}
            />
          ))
        }
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

/* ─── Expenses subtab ─── */

function PhaseExpensesSubtab({
  householdId,
  projectId,
  phaseId,
  expenses,
  serviceProviders,
  budgetCategories,
}: {
  householdId: string;
  projectId: string;
  phaseId: string;
  expenses: ProjectExpense[];
  serviceProviders: ServiceProvider[];
  budgetCategories: ProjectBudgetCategorySummary[];
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div>
      {expenses.length === 0 && (
        <p style={{ padding: "16px 0", color: "var(--ink-muted)", fontSize: "0.88rem" }}>No expenses for this phase.</p>
      )}

      {expenses.length > 0 && (
        <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", marginBottom: 12 }}>
          {expenses.map((expense) => (
            <div key={expense.id}>
              <div
                className={`task-row${expandedId === expense.id ? " task-row--expanded" : ""}`}
                style={{ gridTemplateColumns: "1fr auto auto" }}
                onClick={() => setExpandedId(expandedId === expense.id ? null : expense.id)}
              >
                <span className="task-row__title">{expense.description}</span>
                <span className="task-row__meta">{expense.category}</span>
                <strong style={{ fontSize: "0.88rem" }}>{formatCurrency(expense.amount)}</strong>
              </div>
              {expandedId === expense.id && (
                <div className="task-row__detail" style={{ paddingLeft: 12 }}>
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
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Quick add expense */}
      <form action={createProjectExpenseAction}>
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="phaseId" value={phaseId} />
        <div className="form-grid">
          <label className="field field--full">
            <span>Description</span>
            <input name="description" placeholder="Expense description" required />
          </label>
          <label className="field">
            <span>Amount</span>
            <input name="amount" type="number" min="0" step="0.01" required />
          </label>
          <label className="field">
            <span>Category</span>
            <input name="category" placeholder="Materials, Labor" />
          </label>
          <label className="field">
            <span>Date</span>
            <input name="date" type="date" />
          </label>
        </div>
        <div className="inline-actions" style={{ marginTop: 12 }}>
          <button type="submit" className="button button--sm">Add Expense</button>
        </div>
      </form>
    </div>
  );
}

/* ─── Phase Notes Editor ─── */

function PhaseNotesEditor({
  householdId,
  projectId,
  phase,
}: {
  householdId: string;
  projectId: string;
  phase: ProjectPhaseDetail;
}) {
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback(
    (html: string) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        const form = new FormData();
        form.set("householdId", householdId);
        form.set("projectId", projectId);
        form.set("phaseId", phase.id);
        form.set("name", phase.name);
        form.set("status", phase.status);
        form.set("notes", html);
        updateProjectPhaseAction(form);
      }, 800);
    },
    [householdId, projectId, phase.id, phase.name, phase.status]
  );

  return (
    <div style={{ padding: "8px 0" }}>
      <RichEditor
        content={phase.notes ?? ""}
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
