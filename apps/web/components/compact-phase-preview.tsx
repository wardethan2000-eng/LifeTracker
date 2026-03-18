import { CompactPreview } from "./compact-preview";

type PhaseEntry = {
  id: string;
  name: string;
  status: "pending" | "in_progress" | "completed" | "skipped";
};

type Props = {
  phases: PhaseEntry[];
};

const statusLabels: Record<PhaseEntry["status"], string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
  skipped: "Skipped",
};

export function CompactPhasePreview({ phases }: Props) {
  if (phases.length === 0) {
    return (
      <div className="compact-preview">
        <p className="compact-preview__empty">No phases defined yet</p>
      </div>
    );
  }

  const completedCount = phases.filter((p) => p.status === "completed").length;
  const activePhase = phases.find((p) => p.status === "in_progress");
  const progressPct = Math.round((completedCount / phases.length) * 100);

  const preview = phases.slice(0, 4);
  const overflow = phases.length - preview.length;

  return (
    <div className="compact-preview">
      <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "10px", flexWrap: "wrap" }}>
        <span className="compact-preview__pill">{completedCount} / {phases.length} complete</span>
        {activePhase ? (
          <span className="status-chip status-chip--due">Active: {activePhase.name}</span>
        ) : null}
        <span style={{ fontSize: "0.82rem", color: "var(--ink-muted)" }}>{progressPct}%</span>
      </div>
      <CompactPreview
        layout="table"
        ariaLabel="Phases preview"
        items={preview.map((phase) => ({
          id: phase.id,
          label: phase.name,
          value: <span className={`status-chip status-chip--${phase.status}`}>{statusLabels[phase.status]}</span>,
        }))}
        emptyMessage="No phases defined yet"
      />
      {overflow > 0 ? (
        <p className="compact-preview__overflow">+{overflow} more phases — expand to manage</p>
      ) : null}
    </div>
  );
}
