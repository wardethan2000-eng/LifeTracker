"use client";

import type {
  ProjectBudgetBurnPayload,
  ProjectPortfolioHealthPayload,
  ProjectSummary,
  ProjectTaskVelocityPayload,
  ProjectTimelinePayload
} from "@aegis/types";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { LkAreaChart, LkBarChart, LkDonutChart, LkLineChart } from "./charts";
import {
  getProjectBudgetBurn,
  getProjectPortfolioHealth,
  getProjectTaskVelocity,
  getProjectTimeline
} from "../lib/api";
import { formatCurrency, formatDate } from "../lib/formatters";
import { useTimezone } from "../lib/timezone-context";

type ProjectAnalyticsWorkspaceProps = {
  householdId: string;
  projects: ProjectSummary[];
};

type AnalyticsTab = "portfolio" | "timeline" | "budget" | "velocity";

const statusLabels: Record<ProjectSummary["status"], string> = {
  planning: "Planning",
  active: "Active",
  on_hold: "On Hold",
  completed: "Completed",
  cancelled: "Cancelled"
};

const statusColors: Record<ProjectSummary["status"], string> = {
  planning: "#94a3b8",
  active: "#4f6ef7",
  on_hold: "#f59e0b",
  completed: "#22c55e",
  cancelled: "#ef4444"
};

const phaseStatusColors: Record<string, string> = {
  pending: "#94a3b8",
  in_progress: "#4f6ef7",
  completed: "#22c55e",
  skipped: "#f59e0b"
};

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "2-digit",
  timeZone: "UTC"
});

const decimalFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1
});

const formatMonthKey = (value: string): string => {
  const [year, month] = value.split("-").map((part) => Number.parseInt(part, 10));

  if (!year || !month) {
    return value;
  }

  return monthFormatter.format(new Date(Date.UTC(year, month - 1, 1)));
};

const formatRatio = (value: number | null): string => value === null ? "No budget" : `${Math.round(value * 100)}%`;

const formatLeadTime = (value: number | null): string => value === null ? "No completions yet" : `${decimalFormatter.format(value)} days`;

const formatPercent = (value: number | null): string => value === null ? "No budget" : `${Math.round(value * 100)}%`;

const getDayDelta = (targetDate: string | null, comparisonDate: string | Date | null): number | null => {
  if (!targetDate || !comparisonDate) {
    return null;
  }

  const target = new Date(targetDate).getTime();
  const comparison = comparisonDate instanceof Date ? comparisonDate.getTime() : new Date(comparisonDate).getTime();
  return Math.ceil((comparison - target) / 86_400_000);
};

const getRiskBarColor = (riskScore: number): string => {
  if (riskScore >= 5) {
    return "#dc2626";
  }

  if (riskScore >= 3) {
    return "#f59e0b";
  }

  if (riskScore >= 1) {
    return "#2563eb";
  }

  return "#22c55e";
};

const AnalyticsLoadingState = ({ title }: { title: string }): JSX.Element => (
  <section className="panel">
    <div className="panel__header">
      <h2>{title}</h2>
    </div>
    <div className="panel__body project-analytics-loading">
      <div className="skeleton-bar" style={{ width: "100%", height: 280, borderRadius: 16 }} />
      <div className="skeleton-bar" style={{ width: "100%", height: 48, borderRadius: 12 }} />
      <div className="skeleton-bar" style={{ width: "72%", height: 48, borderRadius: 12 }} />
    </div>
  </section>
);

const EmptyState = ({ message }: { message: string }): JSX.Element => (
  <section className="panel">
    <div className="panel__body--padded">
      <p className="panel__empty">{message}</p>
    </div>
  </section>
);

export function ProjectAnalyticsWorkspace({ householdId, projects }: ProjectAnalyticsWorkspaceProps): JSX.Element {
  const { timezone } = useTimezone();
  const shortDateFormatter = useMemo(
    () => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: timezone }),
    [timezone]
  );
  const sortedProjects = useMemo(() => [...projects].sort((left, right) => {
    const leftActive = left.status === "active" || left.status === "planning" || left.status === "on_hold";
    const rightActive = right.status === "active" || right.status === "planning" || right.status === "on_hold";

    if (leftActive !== rightActive) {
      return leftActive ? -1 : 1;
    }

    return left.name.localeCompare(right.name);
  }), [projects]);
  const defaultProjectId = sortedProjects.find((project) => (
    project.status === "active" || project.status === "planning" || project.status === "on_hold"
  ))?.id ?? sortedProjects[0]?.id ?? "";

  const [activeTab, setActiveTab] = useState<AnalyticsTab>("portfolio");
  const [selectedProjectId, setSelectedProjectId] = useState(defaultProjectId);
  const [velocityProjectId, setVelocityProjectId] = useState("");

  const [portfolioData, setPortfolioData] = useState<ProjectPortfolioHealthPayload | null>(null);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);

  const [timelineData, setTimelineData] = useState<ProjectTimelinePayload | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineError, setTimelineError] = useState<string | null>(null);

  const [budgetData, setBudgetData] = useState<ProjectBudgetBurnPayload | null>(null);
  const [budgetLoading, setBudgetLoading] = useState(false);
  const [budgetError, setBudgetError] = useState<string | null>(null);

  const [velocityData, setVelocityData] = useState<ProjectTaskVelocityPayload | null>(null);
  const [velocityLoading, setVelocityLoading] = useState(false);
  const [velocityError, setVelocityError] = useState<string | null>(null);

  useEffect(() => {
    if (!sortedProjects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(defaultProjectId);
    }
  }, [defaultProjectId, selectedProjectId, sortedProjects]);

  useEffect(() => {
    let cancelled = false;

    const load = async (): Promise<void> => {
      setPortfolioLoading(true);
      setPortfolioError(null);

      try {
        const next = await getProjectPortfolioHealth(householdId);

        if (!cancelled) {
          setPortfolioData(next);
        }
      } catch (error) {
        if (!cancelled) {
          setPortfolioData(null);
          setPortfolioError(error instanceof Error ? error.message : "Failed to load project portfolio health.");
        }
      } finally {
        if (!cancelled) {
          setPortfolioLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [householdId]);

  useEffect(() => {
    if (activeTab !== "timeline" || !selectedProjectId) {
      return;
    }

    let cancelled = false;

    const load = async (): Promise<void> => {
      setTimelineLoading(true);
      setTimelineError(null);

      try {
        const next = await getProjectTimeline(householdId, { projectId: selectedProjectId });

        if (!cancelled) {
          setTimelineData(next);
        }
      } catch (error) {
        if (!cancelled) {
          setTimelineData(null);
          setTimelineError(error instanceof Error ? error.message : "Failed to load project timeline.");
        }
      } finally {
        if (!cancelled) {
          setTimelineLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [activeTab, householdId, selectedProjectId]);

  useEffect(() => {
    if (activeTab !== "budget" || !selectedProjectId) {
      return;
    }

    let cancelled = false;

    const load = async (): Promise<void> => {
      setBudgetLoading(true);
      setBudgetError(null);

      try {
        const next = await getProjectBudgetBurn(householdId, selectedProjectId);

        if (!cancelled) {
          setBudgetData(next);
        }
      } catch (error) {
        if (!cancelled) {
          setBudgetData(null);
          setBudgetError(error instanceof Error ? error.message : "Failed to load budget burn data.");
        }
      } finally {
        if (!cancelled) {
          setBudgetLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [activeTab, householdId, selectedProjectId]);

  useEffect(() => {
    if (activeTab !== "velocity") {
      return;
    }

    let cancelled = false;

    const load = async (): Promise<void> => {
      setVelocityLoading(true);
      setVelocityError(null);

      try {
        const next = await getProjectTaskVelocity(householdId, velocityProjectId ? { projectId: velocityProjectId, months: 6 } : { months: 6 });

        if (!cancelled) {
          setVelocityData(next);
        }
      } catch (error) {
        if (!cancelled) {
          setVelocityData(null);
          setVelocityError(error instanceof Error ? error.message : "Failed to load task velocity data.");
        }
      } finally {
        if (!cancelled) {
          setVelocityLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [activeTab, householdId, velocityProjectId]);

  const selectedProject = sortedProjects.find((project) => project.id === selectedProjectId) ?? null;
  const now = useMemo(() => new Date(), []);
  const timelineBounds = useMemo(() => {
    const dates = (timelineData?.phases ?? []).flatMap((phase) => {
      const values = [phase.startDate, phase.targetEndDate, phase.actualEndDate]
        .filter((value): value is string => Boolean(value))
        .map((value) => new Date(value));

      return values;
    });

    if (dates.length === 0) {
      return null;
    }

    const start = new Date(Math.min(...dates.map((date) => date.getTime())));
    const end = new Date(Math.max(...dates.map((date) => date.getTime())));

    if (start.getTime() === end.getTime()) {
      end.setUTCDate(end.getUTCDate() + 1);
    }

    return {
      start,
      end,
      total: end.getTime() - start.getTime()
    };
  }, [timelineData]);

  const portfolioDonutData = useMemo(() => (portfolioData?.statusDistribution ?? [])
    .filter((entry) => entry.count > 0)
    .map((entry) => ({
      name: statusLabels[entry.status],
      value: entry.count,
      color: statusColors[entry.status]
    })), [portfolioData]);

  const riskBarData = useMemo(() => (portfolioData?.topProjects ?? []).map((project) => ({
    projectName: project.projectName,
    riskScore: project.riskScore,
    color: getRiskBarColor(project.riskScore)
  })), [portfolioData]);

  const budgetChartData = useMemo(() => (budgetData?.months ?? []).map((entry) => ({
    month: entry.month,
    spent: entry.spent,
    cumulativeSpent: entry.cumulativeSpent,
    budgetLine: entry.budgetLine
  })), [budgetData]);

  const velocityBarData = useMemo(() => (velocityData?.months ?? []).map((entry) => ({
    month: entry.month,
    tasksCompleted: entry.tasksCompleted,
    tasksCreated: entry.tasksCreated
  })), [velocityData]);

  const velocityLineData = useMemo(() => (velocityData?.months ?? []).map((entry) => ({
    month: entry.month,
    netBurn: entry.netBurn
  })), [velocityData]);

  const totalProjects = portfolioData?.statusDistribution.reduce((sum, item) => sum + item.count, 0) ?? 0;
  const budgetVarianceTone = budgetData && budgetData.totalBudget !== null && budgetData.projectedTotal !== null
    ? budgetData.projectedTotal > budgetData.totalBudget ? "over" : "on-track"
    : "unknown";
  const timelineTicks = useMemo(() => {
    if (!timelineBounds) {
      return [];
    }

    return Array.from({ length: 5 }, (_, index) => {
      const ratio = index / 4;
      const value = new Date(timelineBounds.start.getTime() + (timelineBounds.total * ratio));

      return {
        label: shortDateFormatter.format(value),
        left: `${ratio * 100}%`
      };
    });
  }, [timelineBounds]);
  const todayMarker = useMemo(() => {
    if (!timelineBounds) {
      return null;
    }

    const todayTime = now.getTime();

    if (todayTime < timelineBounds.start.getTime() || todayTime > timelineBounds.end.getTime()) {
      return null;
    }

    return {
      left: `${((todayTime - timelineBounds.start.getTime()) / timelineBounds.total) * 100}%`,
      label: `Today · ${shortDateFormatter.format(now)}`
    };
  }, [now, timelineBounds]);
  const timelineRiskSummary = useMemo(() => {
    const phases = timelineData?.phases ?? [];
    const overdue = phases.filter((phase) => {
      if (phase.actualEndDate || !phase.targetEndDate) {
        return false;
      }

      return new Date(phase.targetEndDate).getTime() < now.getTime();
    }).length;
    const slipped = phases.filter((phase) => {
      const delta = getDayDelta(phase.targetEndDate, phase.actualEndDate);
      return delta !== null && delta > 0;
    }).length;
    const onTrack = Math.max(phases.length - overdue - slipped, 0);

    return {
      overdue,
      slipped,
      onTrack
    };
  }, [now, timelineData]);
  const monthlyAverageSpend = useMemo(() => {
    if (!budgetData || budgetData.months.length === 0) {
      return 0;
    }

    return budgetData.totalSpent / budgetData.months.length;
  }, [budgetData]);
  const budgetRemaining = budgetData?.totalBudget !== null && budgetData?.totalBudget !== undefined
    ? budgetData.totalBudget - (budgetData.totalSpent ?? 0)
    : null;
  const projectedVariance = budgetData?.totalBudget !== null && budgetData?.totalBudget !== undefined && budgetData.projectedTotal !== null
    ? budgetData.projectedTotal - budgetData.totalBudget
    : null;
  const spentRatio = budgetData?.totalBudget !== null && budgetData?.totalBudget !== undefined && budgetData.totalBudget > 0
    ? (budgetData.totalSpent / budgetData.totalBudget)
    : null;

  return (
    <div className="project-analytics-stack">
      <nav className="analytics-tab-bar" aria-label="Project analytics sections">
        {[
          { id: "portfolio", label: "Portfolio" },
          { id: "timeline", label: "Timeline" },
          { id: "budget", label: "Budget" },
          { id: "velocity", label: "Velocity" }
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`analytics-tab-bar__tab${activeTab === tab.id ? " analytics-tab-bar__tab--active" : ""}`}
            onClick={() => setActiveTab(tab.id as AnalyticsTab)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === "portfolio" ? (
        portfolioLoading ? <AnalyticsLoadingState title="Portfolio Health" /> : portfolioError ? <EmptyState message={portfolioError} /> : (
          <>
            <section className="stats-row">
              <div className="stat-card stat-card--accent">
                <span className="stat-card__label">Total Projects</span>
                <strong className="stat-card__value">{totalProjects}</strong>
                <span className="stat-card__sub">Tracked across the current household</span>
              </div>
              <div className="stat-card stat-card--danger">
                <span className="stat-card__label">At Risk</span>
                <strong className="stat-card__value">{portfolioData?.riskBreakdown.atRisk ?? 0}</strong>
                <span className="stat-card__sub">{portfolioData?.riskBreakdown.late ?? 0} late, {portfolioData?.riskBreakdown.overBudget ?? 0} over budget</span>
              </div>
              <div className="stat-card stat-card--warning">
                <span className="stat-card__label">Total Budgeted</span>
                <strong className="stat-card__value">{formatCurrency(portfolioData?.budgetSummary.totalBudgeted ?? 0, "$0.00")}</strong>
                <span className="stat-card__sub">Portfolio funding baseline</span>
              </div>
              <div className="stat-card">
                <span className="stat-card__label">Total Spent</span>
                <strong className="stat-card__value">{formatCurrency(portfolioData?.budgetSummary.totalSpent ?? 0, "$0.00")}</strong>
                <span className="stat-card__sub">Remaining {formatCurrency(portfolioData?.budgetSummary.totalRemaining ?? 0, "$0.00")}</span>
              </div>
            </section>

            <div className="project-analytics-grid">
              <section className="panel">
                <div className="panel__header">
                  <h2>Status Distribution</h2>
                </div>
                <div className="panel__body--padded">
                  <LkDonutChart
                    data={portfolioDonutData}
                    centerValue={String(totalProjects)}
                    centerLabel="Projects"
                    emptyMessage="No project status data is available yet."
                  />
                </div>
              </section>

              <section className="panel">
                <div className="panel__header">
                  <h2>Top Risk Projects</h2>
                </div>
                <div className="panel__body--padded">
                  <LkBarChart
                    data={riskBarData}
                    xKey="projectName"
                    layout="vertical"
                    bars={[{ dataKey: "riskScore", label: "Risk score", colorKey: "color" }]}
                    emptyMessage="No project risk data is available yet."
                    height={Math.max(320, riskBarData.length * 42)}
                  />
                </div>
              </section>
            </div>
          </>
        )
      ) : null}

      {activeTab === "timeline" ? (
        sortedProjects.length === 0 ? <EmptyState message="Create a project to unlock timeline analytics." /> : (
          <>
            <section className="panel">
              <div className="panel__header">
                <h2>Timeline Controls</h2>
              </div>
              <div className="panel__body--padded project-analytics-filter-grid project-analytics-filter-grid--single">
                <label className="field comparative-field comparative-field--full">
                  <span>Project</span>
                  <select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.currentTarget.value)}>
                    {sortedProjects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name} ({statusLabels[project.status]})
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>

            {timelineLoading ? <AnalyticsLoadingState title="Phase Timeline" /> : timelineError ? <EmptyState message={timelineError} /> : (
              <>
                <section className="panel">
                  <div className="panel__header">
                    <div>
                      <h2>Phase Timeline</h2>
                      {timelineBounds ? (
                        <p className="project-analytics-note">{formatDate(timelineBounds.start.toISOString())} through {formatDate(timelineBounds.end.toISOString())}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="panel__body--padded project-analytics-gantt">
                    <div className="project-analytics-timeline-summary">
                      <div className="project-analytics-timeline-summary__card project-analytics-timeline-summary__card--neutral">
                        <span>On track</span>
                        <strong>{timelineRiskSummary.onTrack}</strong>
                      </div>
                      <div className="project-analytics-timeline-summary__card project-analytics-timeline-summary__card--warning">
                        <span>Overdue now</span>
                        <strong>{timelineRiskSummary.overdue}</strong>
                      </div>
                      <div className="project-analytics-timeline-summary__card project-analytics-timeline-summary__card--danger">
                        <span>Finished late</span>
                        <strong>{timelineRiskSummary.slipped}</strong>
                      </div>
                    </div>
                    <div className="project-analytics-timeline-legend">
                      {Object.entries(phaseStatusColors).map(([status, color]) => (
                        <span key={status} className="project-analytics-timeline-legend__item">
                          <span className="project-analytics-timeline-legend__dot" style={{ backgroundColor: color }} />
                          {status.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                    {timelineTicks.length > 0 ? (
                      <div className="project-analytics-timeline-ruler" aria-hidden="true">
                        {timelineTicks.map((tick) => (
                          <span key={`${tick.label}-${tick.left}`} className="project-analytics-timeline-ruler__tick" style={{ left: tick.left }}>
                            {tick.label}
                          </span>
                        ))}
                        {todayMarker ? (
                          <span className="project-analytics-timeline-ruler__today" style={{ left: todayMarker.left }} data-label={todayMarker.label} />
                        ) : null}
                      </div>
                    ) : null}
                    {(timelineData?.phases.length ?? 0) === 0 ? (
                      <p className="panel__empty">No phases are available for {selectedProject?.name ?? "this project"}.</p>
                    ) : (
                      timelineData?.phases.map((phase) => {
                        const fallbackDate = phase.startDate ?? phase.targetEndDate ?? phase.actualEndDate ?? new Date().toISOString();
                        const barStart = new Date(phase.startDate ?? fallbackDate);
                        const barEnd = new Date(phase.actualEndDate ?? phase.targetEndDate ?? fallbackDate);
                        const safeEnd = barEnd >= barStart ? new Date(barEnd) : new Date(barStart);
                        safeEnd.setUTCDate(safeEnd.getUTCDate() + 1);
                        const left = timelineBounds ? ((barStart.getTime() - timelineBounds.start.getTime()) / timelineBounds.total) * 100 : 0;
                        const width = timelineBounds ? Math.max(((safeEnd.getTime() - barStart.getTime()) / timelineBounds.total) * 100, 6) : 100;
                        const color = phaseStatusColors[phase.status] ?? "#4f6ef7";
                        const overdueDelta = getDayDelta(phase.targetEndDate, now);
                        const lateCompletionDelta = getDayDelta(phase.targetEndDate, phase.actualEndDate);
                        const isOverdue = !phase.actualEndDate && overdueDelta !== null && overdueDelta > 0;
                        const finishedLate = lateCompletionDelta !== null && lateCompletionDelta > 0;
                        const todayOffset = timelineBounds ? ((now.getTime() - timelineBounds.start.getTime()) / timelineBounds.total) * 100 : null;

                        return (
                          <div key={phase.phaseId} className={`project-analytics-gantt__row${isOverdue ? " project-analytics-gantt__row--overdue" : finishedLate ? " project-analytics-gantt__row--late" : ""}`}>
                            <div className="project-analytics-gantt__meta">
                              <strong>{phase.phaseName}</strong>
                              <span>{phase.projectName}</span>
                              <small>{phase.completedTaskCount}/{phase.taskCount} tasks complete</small>
                              <span className="project-analytics-gantt__status">{phase.status.replace(/_/g, " ")}</span>
                              {isOverdue ? <span className="project-analytics-delay-pill project-analytics-delay-pill--overdue">{overdueDelta}d overdue</span> : null}
                              {finishedLate ? <span className="project-analytics-delay-pill project-analytics-delay-pill--late">Closed {lateCompletionDelta}d late</span> : null}
                            </div>
                            <div className="project-analytics-gantt__track">
                              {todayOffset !== null && todayOffset >= 0 && todayOffset <= 100 ? (
                                <span className="project-analytics-gantt__today" style={{ left: `${todayOffset}%` }} aria-hidden="true" />
                              ) : null}
                              <div
                                className={`project-analytics-gantt__bar${isOverdue ? " project-analytics-gantt__bar--overdue" : finishedLate ? " project-analytics-gantt__bar--late" : ""}`}
                                style={{
                                  left: `${Math.max(left, 0)}%`,
                                  width: `${Math.min(width, 100)}%`,
                                  background: color
                                }}
                              >
                                <div className="project-analytics-gantt__progress" style={{ width: `${phase.percentComplete}%` }} />
                                <span>{formatDate(phase.startDate, "Start pending")} to {formatDate(phase.actualEndDate ?? phase.targetEndDate, "No end date")}</span>
                                <strong>{phase.percentComplete}% complete</strong>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </section>

                <section className="panel">
                  <div className="panel__header">
                    <h2>Milestones</h2>
                  </div>
                  <div className="panel__body--padded project-analytics-milestones">
                    {(timelineData?.milestones.length ?? 0) === 0 ? (
                      <p className="panel__empty">No milestone markers are available yet.</p>
                    ) : (
                      timelineData?.milestones.map((milestone) => (
                        <div key={`${milestone.type}-${milestone.date}-${milestone.label}`} className="project-analytics-milestone">
                          <strong>{milestone.date}</strong>
                          <span>{milestone.label}</span>
                          <span className="project-analytics-pill">{milestone.type.replace(/_/g, " ")}</span>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </>
            )}
          </>
        )
      ) : null}

      {activeTab === "budget" ? (
        sortedProjects.length === 0 ? <EmptyState message="Create a project to unlock budget burn analytics." /> : (
          <>
            <section className="panel">
              <div className="panel__header">
                <h2>Budget Controls</h2>
              </div>
              <div className="panel__body--padded project-analytics-filter-grid project-analytics-filter-grid--single">
                <label className="field comparative-field comparative-field--full">
                  <span>Project</span>
                  <select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.currentTarget.value)}>
                    {sortedProjects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name} ({statusLabels[project.status]})
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>

            {budgetLoading ? <AnalyticsLoadingState title="Budget Burn" /> : budgetError ? <EmptyState message={budgetError} /> : (
              <>
                <section className="stats-row">
                  <div className="stat-card stat-card--accent">
                    <span className="stat-card__label">Total Budget</span>
                    <strong className="stat-card__value">{formatCurrency(budgetData?.totalBudget, "No budget")}</strong>
                    <span className="stat-card__sub">{selectedProject?.name ?? "Selected project"}</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-card__label">Total Spent</span>
                    <strong className="stat-card__value">{formatCurrency(budgetData?.totalSpent ?? 0, "$0.00")}</strong>
                    <span className="stat-card__sub">Recorded project expenses</span>
                  </div>
                  <div className="stat-card stat-card--warning">
                    <span className="stat-card__label">Burn Rate</span>
                    <strong className="stat-card__value">{formatCurrency(budgetData?.burnRate ?? 0, "$0.00")}</strong>
                    <span className="stat-card__sub">Approximate monthly burn</span>
                  </div>
                  <div className="stat-card stat-card--danger">
                    <span className="stat-card__label">Projected Total</span>
                    <strong className="stat-card__value">{formatCurrency(budgetData?.projectedTotal, "Insufficient data")}</strong>
                    <span className="stat-card__sub">Forward projection at current burn</span>
                  </div>
                </section>

                <section className="panel">
                  <div className="panel__header project-analytics-panel-header">
                    <div>
                      <h2>Monthly Spend and Runway</h2>
                    </div>
                    <span className={`project-analytics-variance project-analytics-variance--${budgetVarianceTone}`}>
                      {budgetVarianceTone === "over" ? "Projected over budget" : budgetVarianceTone === "on-track" ? "Projected on track" : "Projection pending more history"}
                    </span>
                  </div>
                  <div className="panel__body--padded">
                    <div className="project-analytics-budget-highlights">
                      <div className="project-analytics-budget-highlights__card">
                        <span>Budget consumed</span>
                        <strong>{formatPercent(spentRatio)}</strong>
                        <small>{formatCurrency(budgetRemaining, "Open-ended budget") } remaining</small>
                      </div>
                      <div className="project-analytics-budget-highlights__card">
                        <span>Projected variance</span>
                        <strong className={projectedVariance !== null && projectedVariance > 0 ? "project-analytics-budget-highlights__value--danger" : "project-analytics-budget-highlights__value--good"}>
                          {formatCurrency(projectedVariance, "Pending projection")}
                        </strong>
                        <small>Against current total budget</small>
                      </div>
                      <div className="project-analytics-budget-highlights__card">
                        <span>Average monthly spend</span>
                        <strong>{formatCurrency(monthlyAverageSpend, "$0.00")}</strong>
                        <small>{budgetData?.months.length ?? 0} month window</small>
                      </div>
                    </div>
                    <div className="project-analytics-series-key" aria-hidden="true">
                      <span><i style={{ backgroundColor: "#4f6ef7" }} />Monthly spend</span>
                      <span><i style={{ backgroundColor: "#0f766e" }} />Cumulative spend</span>
                      <span><i style={{ backgroundColor: "#f59e0b" }} />Budget line</span>
                    </div>
                    <LkAreaChart
                      data={budgetChartData}
                      xKey="month"
                      xTickFormatter="month"
                      yTickFormatter="currency"
                      areas={[
                        { dataKey: "spent", label: "Monthly spend", color: "#4f6ef7", fillOpacity: 0.12 },
                        { dataKey: "cumulativeSpent", label: "Cumulative spend", color: "#0f766e", fillOpacity: 0.28 },
                        { dataKey: "budgetLine", label: "Budget line", color: "#f59e0b", fillOpacity: 0.08 }
                      ]}
                      emptyMessage="No budget burn history is available yet."
                      height={340}
                    />
                  </div>
                </section>
              </>
            )}
          </>
        )
      ) : null}

      {activeTab === "velocity" ? (
        <>
          <section className="panel">
            <div className="panel__header">
              <h2>Velocity Controls</h2>
            </div>
            <div className="panel__body--padded project-analytics-filter-grid project-analytics-filter-grid--single">
              <label className="field comparative-field comparative-field--full">
                <span>Project filter</span>
                <select value={velocityProjectId} onChange={(event) => setVelocityProjectId(event.currentTarget.value)}>
                  <option value="">All projects</option>
                  {sortedProjects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name} ({statusLabels[project.status]})
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          {velocityLoading ? <AnalyticsLoadingState title="Task Velocity" /> : velocityError ? <EmptyState message={velocityError} /> : (
            <>
              <section className="stats-row">
                <div className="stat-card stat-card--accent">
                  <span className="stat-card__label">Avg Completion Rate</span>
                  <strong className="stat-card__value">{decimalFormatter.format(velocityData?.averageCompletionRate ?? 0)}</strong>
                  <span className="stat-card__sub">Tasks completed per month</span>
                </div>
                <div className="stat-card">
                  <span className="stat-card__label">Avg Lead Time</span>
                  <strong className="stat-card__value">{formatLeadTime(velocityData?.averageLeadTimeDays ?? null)}</strong>
                  <span className="stat-card__sub">Completion minus creation date</span>
                </div>
              </section>

              <div className="project-analytics-grid">
                <section className="panel">
                  <div className="panel__header">
                    <h2>Created vs Completed</h2>
                  </div>
                  <div className="panel__body--padded">
                    <LkBarChart
                      data={velocityBarData}
                      xKey="month"
                      xTickFormatter="month"
                      bars={[
                        { dataKey: "tasksCompleted", label: "Completed", color: "#22c55e" },
                        { dataKey: "tasksCreated", label: "Created", color: "#4f6ef7" }
                      ]}
                      emptyMessage="No task velocity history is available yet."
                      height={320}
                    />
                  </div>
                </section>

                <section className="panel">
                  <div className="panel__header">
                    <h2>Net Burn Trend</h2>
                  </div>
                  <div className="panel__body--padded">
                    <LkLineChart
                      data={velocityLineData}
                      xKey="month"
                      xTickFormatter="month"
                      lines={[{ dataKey: "netBurn", label: "Net burn", color: "#0f766e" }]}
                      emptyMessage="No net burn trend is available yet."
                      height={320}
                    />
                  </div>
                </section>
              </div>
            </>
          )}
        </>
      ) : null}
    </div>
  );
}