type ScheduleEntry = {
  id: string;
  name: string;
  status: "upcoming" | "due" | "overdue";
  isActive: boolean;
  nextDueAt: string | null;
};

type Props = {
  schedules: ScheduleEntry[];
};

export function CompactMaintenanceSchedulePreview({ schedules }: Props) {
  if (schedules.length === 0) {
    return (
      <div className="compact-preview">
        <p className="compact-preview__empty">No active schedules</p>
      </div>
    );
  }

  const overdueCount = schedules.filter((s) => s.status === "overdue").length;
  const dueCount = schedules.filter((s) => s.status === "due").length;
  const upcomingCount = schedules.filter((s) => s.status === "upcoming").length;
  const inactiveCount = schedules.filter((s) => !s.isActive).length;

  const preview = schedules.slice(0, 4);
  const overflow = schedules.length - preview.length;

  return (
    <div className="compact-preview">
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
        {overdueCount > 0 ? (
          <span className="status-chip status-chip--overdue">{overdueCount} overdue</span>
        ) : null}
        {dueCount > 0 ? (
          <span className="status-chip status-chip--due">{dueCount} due</span>
        ) : null}
        {upcomingCount > 0 ? (
          <span className="compact-preview__pill">{upcomingCount} upcoming</span>
        ) : null}
        {inactiveCount > 0 ? (
          <span className="compact-preview__pill compact-preview__pill--muted">{inactiveCount} paused</span>
        ) : null}
      </div>
      <table className="compact-preview__mini-table" aria-label="Schedules preview">
        <tbody>
          {preview.map((s) => (
            <tr key={s.id}>
              <td>{s.name}</td>
              <td>
                <span className={`status-chip status-chip--${s.status}`}>{s.status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {overflow > 0 ? (
        <p className="compact-preview__overflow">+{overflow} more — click to expand</p>
      ) : null}
    </div>
  );
}
