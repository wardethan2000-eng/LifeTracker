import type { ProjectPhaseProgress } from "@lifekeeper/types";

type ProjectProgressBarProps = {
  phases: ProjectPhaseProgress[];
  totalTaskCount: number;
  completedTaskCount: number;
  variant?: "default" | "compact";
  showLabel?: boolean;
};

const MIN_SEGMENT_PERCENT = 2;

const getSegmentFillClassName = (status: string): string => {
  switch (status) {
    case "completed":
      return "project-progress-bar__segment-fill--completed";
    case "in_progress":
    case "active":
      return "project-progress-bar__segment-fill--in_progress";
    case "skipped":
      return "project-progress-bar__segment-fill--skipped";
    case "pending":
    default:
      return "project-progress-bar__segment-fill--pending";
  }
};

const getNormalizedSegmentWidths = (phases: ProjectPhaseProgress[], totalTaskCount: number): number[] => {
  if (phases.length === 0 || totalTaskCount <= 0) {
    return [];
  }

  const rawWidths = phases.map((phase) => (
    phase.taskCount > 0 ? (phase.taskCount / totalTaskCount) * 100 : MIN_SEGMENT_PERCENT
  ));
  const widthTotal = rawWidths.reduce((sum, width) => sum + width, 0);

  if (widthTotal <= 100) {
    return rawWidths;
  }

  return rawWidths.map((width) => (width / widthTotal) * 100);
};

export function ProjectProgressBar({
  phases,
  totalTaskCount,
  completedTaskCount,
  variant = "default",
  showLabel = true
}: ProjectProgressBarProps) {
  const isCompact = variant === "compact";
  const labelClassName = isCompact
    ? "project-progress-bar__label project-progress-bar__label--compact"
    : "project-progress-bar__label";
  const trackClassName = isCompact
    ? "project-progress-bar__track project-progress-bar__track--compact"
    : "project-progress-bar__track";
  const shouldShowLabel = showLabel || totalTaskCount === 0;

  if (totalTaskCount === 0) {
    return (
      <div className="project-progress-bar">
        <div className={trackClassName}>
          <span className="project-progress-bar__segment" style={{ flex: "1 1 auto" }} />
        </div>
        {shouldShowLabel ? <span className={labelClassName}>No tasks</span> : null}
      </div>
    );
  }

  if (isCompact) {
    const phase = phases[0] ?? {
      name: "Phase",
      status: "pending",
      taskCount: totalTaskCount,
      completedTaskCount
    };
    const fillPercent = phase.taskCount > 0
      ? Math.min((phase.completedTaskCount / phase.taskCount) * 100, 100)
      : 0;

    return (
      <div className="project-progress-bar">
        <div className={trackClassName}>
          <span
            className="project-progress-bar__segment"
            style={{ flex: "1 1 auto" }}
            title={`${phase.name}: ${phase.completedTaskCount}/${phase.taskCount} tasks`}
          >
            <span
              className={`project-progress-bar__segment-fill ${getSegmentFillClassName(phase.status)}`}
              style={{ width: `${fillPercent}%` }}
            />
          </span>
        </div>
        {shouldShowLabel ? (
          <span className={labelClassName}>{completedTaskCount} of {totalTaskCount} tasks completed</span>
        ) : null}
      </div>
    );
  }

  const segmentWidths = getNormalizedSegmentWidths(phases, totalTaskCount);

  return (
    <div className="project-progress-bar">
      <div className={trackClassName}>
        {phases.map((phase, index) => {
          const fillPercent = phase.taskCount > 0
            ? Math.min((phase.completedTaskCount / phase.taskCount) * 100, 100)
            : 0;

          return (
            <span
              key={`${phase.name}-${index}`}
              className="project-progress-bar__segment"
              style={{ flex: `0 0 ${segmentWidths[index] ?? MIN_SEGMENT_PERCENT}%` }}
              title={`${phase.name}: ${phase.completedTaskCount}/${phase.taskCount} tasks`}
            >
              <span
                className={`project-progress-bar__segment-fill ${getSegmentFillClassName(phase.status)}`}
                style={{ width: `${fillPercent}%` }}
              />
            </span>
          );
        })}
      </div>
      {shouldShowLabel ? (
        <span className={labelClassName}>{completedTaskCount} of {totalTaskCount} tasks completed</span>
      ) : null}
    </div>
  );
}