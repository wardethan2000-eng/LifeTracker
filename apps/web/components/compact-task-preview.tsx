type TaskEntry = {
  id: string;
  title: string;
  status: "pending" | "in_progress" | "completed" | "skipped";
  phaseId: string | null;
};

type Props = {
  tasks: TaskEntry[];
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

  const pending = tasks.filter((t) => t.status === "pending" || t.status === "in_progress").slice(0, 4);
  const overflow = Math.max(tasks.length - 4, 0);

  return (
    <div className="compact-preview">
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
        <span className="compact-preview__pill">{completedCount} / {tasks.length} done</span>
        {inProgressCount > 0 ? (
          <span className="status-chip status-chip--due">{inProgressCount} in progress</span>
        ) : null}
        {unphasedCount > 0 ? (
          <span className="compact-preview__pill compact-preview__pill--muted">{unphasedCount} unphased</span>
        ) : null}
      </div>
      {pending.length > 0 ? (
        <table className="compact-preview__mini-table" aria-label="Task preview">
          <tbody>
            {pending.map((task) => (
              <tr key={task.id}>
                <td>{task.title}</td>
                <td>
                  <span className={`status-chip status-chip--${task.status}`}>{task.status.replace("_", " ")}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {overflow > 0 ? (
        <p className="compact-preview__overflow">+{overflow} more — expand to see all</p>
      ) : null}
    </div>
  );
}
