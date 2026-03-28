import { CompactPreview } from "./compact-preview";

type TaskEntry = {
  id: string;
  title: string;
  status: "pending" | "in_progress" | "completed" | "skipped";
  phaseId: string | null;
  isBlocked?: boolean;
  isCriticalPath?: boolean;
};

type Props = {
  tasks: TaskEntry[];
};

const TASK_STATUS_PILL: Record<TaskEntry["status"], string> = {
  pending: "pill--muted",
  in_progress: "pill--info",
  completed: "pill--success",
  skipped: "pill--muted",
};

const TASK_STATUS_LABEL: Record<TaskEntry["status"], string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
  skipped: "Skipped",
};

export function CompactTaskPreview({ tasks }: Props) {
  if (tasks.length === 0) {
    return (
      <div className="compact-preview">
        <p className="compact-preview__empty">No tasks added yet</p>
      </div>
    );
  }

  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const inProgressCount = tasks.filter((t) => t.status === "in_progress").length;
  const unphasedCount = tasks.filter((t) => t.phaseId === null).length;
  const blockedCount = tasks.filter((t) => t.isBlocked).length;
  const criticalCount = tasks.filter((t) => t.isCriticalPath).length;

  const pending = tasks.filter((t) => t.status === "pending" || t.status === "in_progress").slice(0, 4);
  const overflow = Math.max(tasks.length - 4, 0);

  return (
    <div className="compact-preview">
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
        <span className="compact-preview__pill">{completedCount} / {tasks.length} done</span>
        {inProgressCount > 0 ? (
          <span className="pill pill--info">{inProgressCount} in progress</span>
        ) : null}
        {unphasedCount > 0 ? (
          <span className="compact-preview__pill compact-preview__pill--muted">{unphasedCount} unphased</span>
        ) : null}
        {blockedCount > 0 ? (
          <span className="pill pill--danger">{blockedCount} blocked</span>
        ) : null}
        {criticalCount > 0 ? (
          <span className="compact-preview__pill">{criticalCount} critical</span>
        ) : null}
      </div>
      {pending.length > 0 ? (
        <CompactPreview
          layout="table"
          ariaLabel="Task preview"
          items={pending.map((task) => ({
            id: task.id,
            label: task.title,
            value: <span className={`pill ${TASK_STATUS_PILL[task.status]}`}>{TASK_STATUS_LABEL[task.status]}</span>,
          }))}
          emptyMessage="No tasks added yet"
        />
      ) : null}
      {overflow > 0 ? (
        <p className="compact-preview__overflow">+{overflow} more — expand to see all</p>
      ) : null}
    </div>
  );
}
