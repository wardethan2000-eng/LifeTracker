import type { ProjectPhaseSummary } from "@lifekeeper/types";
import { formatCurrency, formatDate } from "../lib/formatters";

const phaseStatusLabels: Record<ProjectPhaseSummary["status"], string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
  skipped: "Skipped"
};

type ProjectPhaseCardProps = {
  phase: ProjectPhaseSummary;
};

export function ProjectPhaseCard({ phase }: ProjectPhaseCardProps) {
  const completionDenominator = phase.taskCount + phase.checklistItemCount;
  const completionNumerator = phase.completedTaskCount + phase.completedChecklistItemCount;
  const completionPercent = completionDenominator > 0
    ? Math.round((completionNumerator / completionDenominator) * 100)
    : 0;

  return (
    <div className="project-portfolio-card project-portfolio-card--neutral" style={{ minWidth: 280 }}>
      <div className="project-portfolio-card__topline">
        <span className="pill">{phaseStatusLabels[phase.status]}</span>
        <span className="data-table__secondary">Order {phase.sortOrder ?? "-"}</span>
      </div>

      <div className="project-portfolio-card__header" style={{ alignItems: "flex-start" }}>
        <div>
          <h3>{phase.name}</h3>
          <p>{phase.description ?? "Define the entry criteria, work scope, and closeout conditions for this phase."}</p>
        </div>
      </div>

      <div className="project-meter-stack">
        <div className="project-meter">
          <div className="project-meter__labels">
            <span>Tasks + checklist</span>
            <strong>{completionNumerator} / {completionDenominator || 0}</strong>
          </div>
          <div className="project-meter__track">
            <span className="project-meter__fill" style={{ width: `${Math.min(completionPercent, 100)}%` }} />
          </div>
        </div>
      </div>

      <dl className="project-kpi-list">
        <div>
          <dt>Budget</dt>
          <dd>{formatCurrency(phase.budgetAmount, "No phase budget")}</dd>
        </div>
        <div>
          <dt>Spend</dt>
          <dd>{formatCurrency(phase.expenseTotal, "$0.00")}</dd>
        </div>
        <div>
          <dt>Supplies</dt>
          <dd>{phase.procuredSupplyCount} of {phase.supplyCount} procured</dd>
        </div>
        <div>
          <dt>Target</dt>
          <dd>{formatDate(phase.targetEndDate, "No target")}</dd>
        </div>
      </dl>
    </div>
  );
}