import { CompactPreview } from "./compact-preview";

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
      <CompactPreview
        layout="table"
        ariaLabel="Schedules preview"
        items={preview.map((schedule) => ({
          id: schedule.id,
          label: schedule.name,
          value: <span className={`status-chip status-chip--${schedule.status}`}>{schedule.status}</span>,
        }))}
        emptyMessage="No active schedules"
      />
      {overflow > 0 ? (
        <p className="compact-preview__overflow">+{overflow} more — click to expand</p>
      ) : null}
    </div>
  );
}
