"use client";

import type {
  HobbyMetricDefinition,
  HobbyPracticeGoalDetail,
  HobbyPracticeRoutineComplianceSummary,
  HobbyPracticeRoutineSummary,
  HobbySessionSummary,
} from "@lifekeeper/types";
import Link from "next/link";
import { LkLineChart } from "./charts";
import { EntryTimeline } from "./entry-system";
import { useFormattedDate } from "../lib/formatted-date";
import type { JSX } from "react";

type HobbyPracticeGoalDetailProps = {
  householdId: string;
  hobbyId: string;
  goal: HobbyPracticeGoalDetail;
  sessions: HobbySessionSummary[];
  metrics: HobbyMetricDefinition[];
};

type HobbyPracticeRoutineDetailProps = {
  hobbyId: string;
  routine: HobbyPracticeRoutineSummary;
  compliance: HobbyPracticeRoutineComplianceSummary;
  sessions: HobbySessionSummary[];
};

function formatMinutes(value: number | null | undefined): string {
  if (value == null) return "-";
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function goalStatusClass(status: string): string {
  switch (status) {
    case "active":
      return "pill pill--info";
    case "achieved":
      return "pill pill--success";
    case "paused":
      return "pill pill--warning";
    case "abandoned":
      return "pill pill--danger";
    default:
      return "pill";
  }
}

function routineCells(summary: HobbyPracticeRoutineComplianceSummary): Array<{ date: string; completed: boolean; count: number }> {
  const counts = new Map<string, number>();

  summary.periods.forEach((period) => {
    const start = new Date(period.periodStart);
    const end = new Date(period.periodEnd);
    for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
      const key = cursor.toISOString().slice(0, 10);
      counts.set(key, period.completedSessions > 0 ? period.completedSessions : (counts.get(key) ?? 0));
    }
  });

  const cells: Array<{ date: string; completed: boolean; count: number }> = [];
  const start = new Date(summary.startDate);
  const end = new Date(summary.endDate);
  for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const key = cursor.toISOString().slice(0, 10);
    const count = counts.get(key) ?? 0;
    cells.push({ date: key, completed: count > 0, count });
  }
  return cells;
}

export function HobbyPracticeGoalDetail({ householdId, hobbyId, goal, sessions, metrics }: HobbyPracticeGoalDetailProps): JSX.Element {
  const { formatDate } = useFormattedDate();
  const metricName = goal.metricDefinitionId ? metrics.find((metric) => metric.id === goal.metricDefinitionId)?.name ?? "Linked metric" : null;
  const sessionMap = new Map(sessions.map((session) => [session.id, session]));
  const relatedSessions = goal.progressHistory
    .filter((point) => point.sourceType === "session" && point.sourceId)
    .map((point) => sessionMap.get(point.sourceId ?? ""))
    .filter((session): session is HobbySessionSummary => Boolean(session));

  const chartData = goal.progressHistory.map((point) => ({
    date: point.date,
    progress: point.value,
  }));

  return (
    <div className="mode-workspace mode-stack">
      <section className="panel panel--studio">
        <div className="panel__header mode-detail-header">
          <div>
            <h2>{goal.name}</h2>
            <p>{goal.description ?? "No description provided."}</p>
          </div>
          <div className="mode-detail-header__meta">
            <span className={goalStatusClass(goal.status)}>{goal.status}</span>
            <span className="pill pill--muted">{goal.goalType.replaceAll("_", " ")}</span>
          </div>
        </div>
        <div className="panel__body--padded mode-stack">
          <div className="stats-row">
            <div className="stat-card stat-card--accent">
              <span className="stat-card__label">Current</span>
              <strong className="stat-card__value">{goal.currentValue}</strong>
              <span className="stat-card__sub">{goal.unit}</span>
            </div>
            <div className="stat-card">
              <span className="stat-card__label">Target</span>
              <strong className="stat-card__value">{goal.targetValue}</strong>
              <span className="stat-card__sub">Due {formatDate(goal.targetDate)}</span>
            </div>
            <div className="stat-card stat-card--success">
              <span className="stat-card__label">Progress</span>
              <strong className="stat-card__value">{Math.round(goal.progressPercentage)}%</strong>
              <span className="stat-card__sub">{metricName ?? "Manual or session based"}</span>
            </div>
          </div>

          <section className="mode-section-card">
            <div className="mode-section-card__head">
              <h3>Progress over time</h3>
              <span className="pill pill--muted">{goal.progressHistory.length} points</span>
            </div>
            <LkLineChart
              data={chartData}
              xKey="date"
              lines={[{ dataKey: "progress", label: `${goal.name} progress` }]}
              xTickFormatter="date"
              height={260}
              emptyMessage="No progress history recorded yet."
            />
          </section>

          <section className="mode-section-card">
            <div className="mode-section-card__head">
              <h3>Related sessions</h3>
            </div>
            {relatedSessions.length === 0 ? (
              <p className="panel__empty">
                {goal.goalType === "metric_target"
                  ? "This goal is driven by metric readings. Related sessions are only visible when the API exposes reading-to-session relationships in the goal detail payload."
                  : "No contributing sessions yet."}
              </p>
            ) : (
              <div className="mode-stack">
                {relatedSessions.map((session) => (
                  <Link key={session.id} href={`/hobbies/${hobbyId}/sessions/${session.id}`} className="mode-list-card">
                    <div className="mode-list-card__header">
                      <div>
                        <h3>{session.name}</h3>
                        <p>{session.notes ?? "No notes recorded."}</p>
                      </div>
                      <span className="pill pill--muted">{session.status}</span>
                    </div>
                    <div className="mode-list-card__meta">
                      <span>{formatDate(session.completedDate ?? session.startDate)}</span>
                      <span>{formatMinutes(session.durationMinutes)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}

export function HobbyPracticeRoutineDetail({ hobbyId, routine, compliance, sessions }: HobbyPracticeRoutineDetailProps): JSX.Element {
  const { formatDate } = useFormattedDate();
  const relatedSessions = sessions
    .filter((session) => session.routineId === routine.id)
    .sort((left, right) => new Date(right.completedDate ?? right.createdAt).getTime() - new Date(left.completedDate ?? left.createdAt).getTime());
  const heatmapCells = routineCells(compliance);

  return (
    <div className="mode-workspace">
      <section className="panel panel--studio">
        <div className="panel__header mode-detail-header">
          <div>
            <h2>{routine.name}</h2>
            <p>{routine.description ?? "No description provided."}</p>
          </div>
          <div className="mode-detail-header__meta">
            <span className={routine.isActive ? "pill pill--success" : "pill pill--muted"}>{routine.isActive ? "active" : "inactive"}</span>
            <span className="pill pill--muted">{routine.targetSessionsPerPeriod} / {routine.targetFrequency}</span>
          </div>
        </div>
        <div className="panel__body--padded mode-stack">
          <div className="stats-row">
            <div className="stat-card stat-card--accent">
              <span className="stat-card__label">Current streak</span>
              <strong className="stat-card__value">{routine.currentStreak}</strong>
              <span className="stat-card__sub">Longest {routine.longestStreak}</span>
            </div>
            <div className="stat-card">
              <span className="stat-card__label">Adherence</span>
              <strong className="stat-card__value">{Math.round(routine.adherenceRate)}%</strong>
              <span className="stat-card__sub">Last 30 days</span>
            </div>
            <div className="stat-card stat-card--success">
              <span className="stat-card__label">Next session</span>
              <strong className="stat-card__value">{formatDate(routine.nextExpectedSessionDate)}</strong>
              <span className="stat-card__sub">Target duration {formatMinutes(routine.targetDurationMinutes)}</span>
            </div>
          </div>

          <section className="mode-section-card">
            <div className="mode-section-card__head">
              <h3>Practice heatmap</h3>
              <span className="pill pill--muted">{heatmapCells.length} days</span>
            </div>
            <div className="routine-heatmap">
              {heatmapCells.map((cell) => (
                <div
                  key={cell.date}
                  className={`routine-heatmap__cell${cell.completed ? " routine-heatmap__cell--active" : ""}`}
                  title={`${cell.date}: ${cell.count} completed sessions`}
                />
              ))}
            </div>
          </section>

          <section className="mode-section-card">
            <div className="mode-section-card__head">
              <h3>Streak history</h3>
            </div>
            <div className="mode-stack">
              {compliance.periods.map((period) => (
                <div key={period.periodStart} className="mode-inline-row mode-inline-row--card">
                  <div>
                    <strong>{formatDate(period.periodStart)} to {formatDate(period.periodEnd)}</strong>
                    <p>{period.completedSessions} of {period.expectedSessions} sessions completed</p>
                  </div>
                  <span className={period.metTarget ? "pill pill--success" : "pill pill--warning"}>{period.metTarget ? "Met target" : "Below target"}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="mode-section-card">
            <div className="mode-section-card__head">
              <h3>Related sessions</h3>
            </div>
            {relatedSessions.length === 0 ? <p className="panel__empty">No sessions linked to this routine yet.</p> : (
              <div className="mode-stack">
                {relatedSessions.map((session) => (
                  <Link key={session.id} href={`/hobbies/${hobbyId}/sessions/${session.id}`} className="mode-list-card">
                    <div className="mode-list-card__header">
                      <div>
                        <h3>{session.name}</h3>
                        <p>{session.notes ?? "No notes recorded."}</p>
                      </div>
                      <span className="pill pill--muted">{session.status}</span>
                    </div>
                    <div className="mode-list-card__meta">
                      <span>{formatDate(session.completedDate ?? session.startDate)}</span>
                      <span>{formatMinutes(session.durationMinutes)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}