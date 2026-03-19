import type { JSX } from "react";
import { Suspense } from "react";
import {
  createProjectTaskAction,
  createQuickTodoAction,
  deleteProjectTaskAction,
  promoteTaskAction,
  toggleQuickTodoAction,
  updateProjectTaskAction,
  createTaskChecklistItemAction,
  deleteTaskChecklistItemAction,
  updateTaskChecklistItemAction,
} from "../../../../actions";
import { CompactTaskPreview } from "../../../../../components/compact-task-preview";
import { ExpandableCard } from "../../../../../components/expandable-card";
import { ProjectChecklist } from "../../../../../components/project-checklist";
import {
  ApiError,
  getHouseholdMembers,
  getMe,
  getProjectDetail,
} from "../../../../../lib/api";
import { formatDate } from "../../../../../lib/formatters";

type ProjectTasksPageProps = {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const taskStatusOptions = ["pending", "in_progress", "completed", "skipped"] as const;
const taskStatusLabels: Record<(typeof taskStatusOptions)[number], string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
  skipped: "Skipped"
};

const toDateInputValue = (value: string | null | undefined): string => value ? value.slice(0, 10) : "";

export default async function ProjectTasksPage({ params, searchParams }: ProjectTasksPageProps): Promise<JSX.Element> {
  const { projectId } = await params;
  const query = searchParams ? await searchParams : {};
  const householdId = typeof query.householdId === "string" ? query.householdId : undefined;

  try {
    const me = await getMe();
    const household = me.households.find((item) => item.id === householdId) ?? me.households[0];

    if (!household) {
      return <p>No household found.</p>;
    }

    const project = await getProjectDetail(household.id, projectId);
    const phaseNameLookup = new Map(project.phases.map((phase) => [phase.id, phase.name]));
    const quickTodos = project.tasks.filter((task) => task.taskType === "quick");
    const completedQuickTodoCount = quickTodos.filter((task) => task.isCompleted).length;
    const fullTasks = project.tasks.filter((task) => task.taskType !== "quick");

    return (
      <>
        <div id="quick-todos">
          <ExpandableCard
            title={`Quick To-dos (${quickTodos.length})`}
            modalTitle="Quick To-dos"
            previewContent={
              <span className="data-table__secondary">
                {completedQuickTodoCount} of {quickTodos.length} done
              </span>
            }
          >
            <div>
              <form action={createQuickTodoAction} className="quick-todo-form">
                <input type="hidden" name="householdId" value={household.id} />
                <input type="hidden" name="projectId" value={project.id} />
                <input
                  name="title"
                  placeholder="Add a to-do…"
                  required
                  className="quick-todo-form__title"
                />
                {project.phases.length > 0 ? (
                  <select name="phaseId" defaultValue="" className="quick-todo-form__phase">
                    <option value="">No phase</option>
                    {project.phases.map((phase) => (
                      <option key={phase.id} value={phase.id}>{phase.name}</option>
                    ))}
                  </select>
                ) : null}
                <button type="submit" className="button button--sm">Add</button>
              </form>
              {quickTodos.length === 0 ? (
                <p className="panel__empty">No quick to-dos yet. Use the field above to add lightweight checkbox items.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {quickTodos.map((todo) => (
                    <div
                      key={todo.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "8px 0",
                        borderBottom: "1px solid var(--border)",
                        minHeight: "36px"
                      }}
                    >
                      <form action={toggleQuickTodoAction} style={{ display: "contents" }}>
                        <input type="hidden" name="householdId" value={household.id} />
                        <input type="hidden" name="projectId" value={project.id} />
                        <input type="hidden" name="taskId" value={todo.id} />
                        <input type="hidden" name="isCompleted" value={todo.isCompleted ? "false" : "true"} />
                        <button
                          type="submit"
                          style={{
                            width: "18px",
                            height: "18px",
                            flexShrink: 0,
                            border: "2px solid var(--border)",
                            borderRadius: "3px",
                            background: todo.isCompleted ? "var(--accent)" : "var(--surface)",
                            cursor: "pointer",
                            padding: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "white",
                            fontSize: "11px",
                            lineHeight: 1
                          }}
                          title={todo.isCompleted ? "Mark incomplete" : "Mark complete"}
                        >
                          {todo.isCompleted ? "✓" : ""}
                        </button>
                      </form>
                      <span
                        style={{
                          flex: 1,
                          fontSize: "0.875rem",
                          color: todo.isCompleted ? "var(--ink-muted)" : "var(--ink)",
                          textDecoration: todo.isCompleted ? "line-through" : "none"
                        }}
                      >
                        {todo.title}
                      </span>
                      {todo.phaseId ? (
                        <span className="pill pill--muted" style={{ fontSize: "0.75rem" }}>
                          {phaseNameLookup.get(todo.phaseId) ?? ""}
                        </span>
                      ) : null}
                      <form action={promoteTaskAction} style={{ display: "inline" }}>
                        <input type="hidden" name="householdId" value={household.id} />
                        <input type="hidden" name="projectId" value={project.id} />
                        <input type="hidden" name="taskId" value={todo.id} />
                        <button type="submit" className="button button--ghost button--small" title="Promote to full task">→ Full task</button>
                      </form>
                      <form action={deleteProjectTaskAction} style={{ display: "inline" }}>
                        <input type="hidden" name="householdId" value={household.id} />
                        <input type="hidden" name="projectId" value={project.id} />
                        <input type="hidden" name="taskId" value={todo.id} />
                        <button type="submit" className="button button--ghost button--small button--danger">Delete</button>
                      </form>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ExpandableCard>
        </div>

        <div id="project-tasks">
          <Suspense fallback={<TasksSkeleton fullTasks={fullTasks} />}>
            <ProjectTasksPanelAsync householdId={household.id} project={project} />
          </Suspense>
        </div>
      </>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <div className="panel">
          <div className="panel__body--padded">
            <p>Failed to load tasks: {error.message}</p>
          </div>
        </div>
      );
    }
    throw error;
  }
}

const TasksSkeleton = ({ fullTasks }: { fullTasks: Awaited<ReturnType<typeof getProjectDetail>>["tasks"] }): JSX.Element => (
  <ExpandableCard
    title="Tasks"
    modalTitle="Tasks"
    previewContent={<CompactTaskPreview tasks={fullTasks.filter((task) => task.taskType !== "quick")} />}
  >
    <div className="panel__empty">Loading task controls…</div>
  </ExpandableCard>
);

async function ProjectTasksPanelAsync({
  householdId,
  project
}: {
  householdId: string;
  project: Awaited<ReturnType<typeof getProjectDetail>>;
}): Promise<JSX.Element> {
  const householdMembers = await getHouseholdMembers(householdId);
  const fullTasks = project.tasks.filter((task) => task.taskType !== "quick");
  const unphasedTasks = fullTasks.filter((task) => task.phaseId === null);

  return (
    <ExpandableCard
      title="Tasks"
      modalTitle="Tasks"
      previewContent={<CompactTaskPreview tasks={fullTasks} />}
    >
      <div>
        <div style={{ marginBottom: 20 }}>
          <form action={createProjectTaskAction}>
            <input type="hidden" name="householdId" value={householdId} />
            <input type="hidden" name="projectId" value={project.id} />
            <div className="form-grid">
              <label className="field field--full">
                <span>Task Title</span>
                <input name="title" placeholder="General task not assigned to a phase yet" required />
              </label>
              <label className="field field--full">
                <span>Description</span>
                <textarea name="description" rows={2} placeholder="Why this is still unphased, or what needs to be decided before slotting it into the timeline." />
              </label>
              <label className="field">
                <span>Status</span>
                <select name="status" defaultValue="pending">
                  {taskStatusOptions.map((status) => (
                    <option key={status} value={status}>{taskStatusLabels[status]}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Assignee</span>
                <select name="assignedToId" defaultValue="">
                  <option value="">Unassigned</option>
                  {householdMembers.map((member) => (
                    <option key={member.id} value={member.userId}>{member.user.displayName ?? member.user.email ?? member.userId}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Estimated Hours</span>
                <input name="estimatedHours" type="number" min="0" step="0.25" />
              </label>
              <label className="field field--full">
                <span>Depends On</span>
                <select name="predecessorTaskIds" multiple size={Math.min(Math.max(fullTasks.length, 2), 6)}>
                  {fullTasks.map((task) => (
                    <option key={task.id} value={task.id}>{task.title}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="inline-actions" style={{ marginTop: 16 }}>
              <button type="submit" className="button">Add Task</button>
            </div>
          </form>
        </div>
        {unphasedTasks.length === 0 ? <p className="panel__empty">Every full task is assigned to a phase.</p> : null}
        <div className="schedule-stack">
          {unphasedTasks.map((task) => (
            <UnphasedTaskCard
              key={task.id}
              householdId={householdId}
              projectId={project.id}
              task={task}
              householdMembers={householdMembers}
              dependencyCandidates={fullTasks}
            />
          ))}
        </div>
      </div>
    </ExpandableCard>
  );
}

function UnphasedTaskCard({
  householdId,
  projectId,
  task,
  householdMembers,
  dependencyCandidates
}: {
  householdId: string;
  projectId: string;
  task: Awaited<ReturnType<typeof getProjectDetail>>["tasks"][number];
  householdMembers: Awaited<ReturnType<typeof getHouseholdMembers>>;
  dependencyCandidates: Awaited<ReturnType<typeof getProjectDetail>>["tasks"];
}) {
  const availableDependencyCandidates = dependencyCandidates.filter((candidate) => candidate.id !== task.id);

  return (
    <div className="schedule-card">
      <form action={updateProjectTaskAction}>
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="taskId" value={task.id} />
        <div className="schedule-card__summary" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {task.isBlocked ? <span className="pill pill--warning">Blocked</span> : null}
            {task.isCriticalPath ? <span className="pill pill--danger">Critical Path</span> : null}
            {task.status === "completed" ? <span className="pill pill--success">Completed</span> : null}
          </div>
        </div>
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
              {taskStatusOptions.map((status) => (
                <option key={status} value={status}>{taskStatusLabels[status]}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Assignee</span>
            <select name="assignedToId" defaultValue={task.assignedToId ?? ""}>
              <option value="">Unassigned</option>
              {householdMembers.map((member) => (
                <option key={member.id} value={member.userId}>{member.user.displayName ?? member.user.email ?? member.userId}</option>
              ))}
            </select>
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
            <span>Due Date</span>
            <input name="dueDate" type="date" defaultValue={toDateInputValue(task.dueDate)} />
          </label>
          <label className="field field--full">
            <span>Depends On</span>
            <select name="predecessorTaskIds" multiple size={Math.min(Math.max(availableDependencyCandidates.length, 2), 6)} defaultValue={task.predecessorTaskIds ?? []}>
              {availableDependencyCandidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>{candidate.title}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="inline-actions" style={{ marginTop: 16 }}>
          <button type="submit" className="button">Save Changes</button>
          <form action={deleteProjectTaskAction} style={{ display: "inline" }}>
            <input type="hidden" name="householdId" value={householdId} />
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="taskId" value={task.id} />
            <button type="submit" className="button button--ghost button--danger">Delete Task</button>
          </form>
        </div>
      </form>
      <div style={{ marginTop: 16 }}>
        <ProjectChecklist
          householdId={householdId}
          projectId={projectId}
          parentFieldName="taskId"
          parentId={task.id}
          items={task.checklistItems ?? []}
          addAction={createTaskChecklistItemAction}
          toggleAction={updateTaskChecklistItemAction}
          deleteAction={deleteTaskChecklistItemAction}
          addPlaceholder="Add checklist item…"
          emptyMessage="No checklist items yet."
        />
      </div>
    </div>
  );
}