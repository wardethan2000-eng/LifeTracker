"use client";

import type {
  HobbyAnalyticsOverviewPayload,
  HobbyGoalProgressPayload,
  HobbyPracticeStreaksPayload,
  HobbySessionFrequencyPayload,
  HobbySummary
} from "@lifekeeper/types";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { chartColors, LkAreaChart, LkBarChart, LkDonutChart, LkLineChart } from "./charts";
import {
  getHobbyAnalyticsOverview,
  getHobbyGoalProgress,
  getHobbyPracticeStreaks,
  getHobbySessionFrequency
} from "../lib/api";
import { formatCurrency, formatDate } from "../lib/formatters";

type HobbyAnalyticsWorkspaceProps = {
  householdId: string;
  hobbies: HobbySummary[];
};

type AnalyticsTab = "overview" | "sessions" | "practice" | "goals";

const tabs: Array<{ value: AnalyticsTab; label: string }> = [
  { value: "overview", label: "Overview" },
  { value: "sessions", label: "Sessions" },
  { value: "practice", label: "Practice" },
  { value: "goals", label: "Goals" }
];

const AnalyticsLoadingState = ({ rows = 4 }: { rows?: number }): JSX.Element => (
  <section className="panel">
    <div className="panel__header">
      <div className="skeleton-bar" style={{ width: 180, height: 20 }} />
    </div>
    <div className="panel__body" style={{ padding: 20, display: "grid", gap: 12 }}>
      <div className="skeleton-bar" style={{ width: "100%", height: 280, borderRadius: 12 }} />
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="skeleton-bar" style={{ width: "100%", height: 44, borderRadius: 10 }} />
      ))}
    </div>
  </section>
);

const EmptyState = ({ message }: { message: string }): JSX.Element => (
  <div className="panel">
    <div className="panel__body--padded">
      <p className="panel__empty">{message}</p>
    </div>
  </div>
);

const formatHours = (minutes: number): string => `${(minutes / 60).toFixed(minutes % 60 === 0 ? 0 : 1)}h`;

const formatPercent = (value: number | null): string => value === null ? "No target date" : `${Math.round(value * 100)}%`;

const getProgressBarWidth = (value: number): string => `${Math.max(0, Math.min(value, 100))}%`;

export function HobbyAnalyticsWorkspace({ householdId, hobbies }: HobbyAnalyticsWorkspaceProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>("overview");
  const [selectedHobbyId, setSelectedHobbyId] = useState("all");
  const [selectedMonths, setSelectedMonths] = useState(6);
  const [selectedGoalId, setSelectedGoalId] = useState("");

  const [overviewData, setOverviewData] = useState<HobbyAnalyticsOverviewPayload | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const [sessionData, setSessionData] = useState<HobbySessionFrequencyPayload | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const [practiceData, setPracticeData] = useState<HobbyPracticeStreaksPayload | null>(null);
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [practiceError, setPracticeError] = useState<string | null>(null);

  const [goalData, setGoalData] = useState<HobbyGoalProgressPayload | null>(null);
  const [goalLoading, setGoalLoading] = useState(false);
  const [goalError, setGoalError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async (): Promise<void> => {
      setOverviewLoading(true);
      setOverviewError(null);

      try {
        const next = await getHobbyAnalyticsOverview(householdId);

        if (!cancelled) {
          setOverviewData(next);
        }
      } catch (error) {
        if (!cancelled) {
          setOverviewData(null);
          setOverviewError(error instanceof Error ? error.message : "Failed to load hobby overview analytics.");
        }
      } finally {
        if (!cancelled) {
          setOverviewLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [householdId]);

  useEffect(() => {
    let cancelled = false;

    const load = async (): Promise<void> => {
      setSessionLoading(true);
      setSessionError(null);

      try {
        const next = await getHobbySessionFrequency(householdId, {
          ...(selectedHobbyId !== "all" ? { hobbyId: selectedHobbyId } : {}),
          months: selectedMonths
        });

        if (!cancelled) {
          setSessionData(next);
        }
      } catch (error) {
        if (!cancelled) {
          setSessionData(null);
          setSessionError(error instanceof Error ? error.message : "Failed to load hobby session analytics.");
        }
      } finally {
        if (!cancelled) {
          setSessionLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [householdId, selectedHobbyId, selectedMonths]);

  useEffect(() => {
    let cancelled = false;

    const load = async (): Promise<void> => {
      setPracticeLoading(true);
      setPracticeError(null);

      try {
        const next = await getHobbyPracticeStreaks(householdId, {
          ...(selectedHobbyId !== "all" ? { hobbyId: selectedHobbyId } : {})
        });

        if (!cancelled) {
          setPracticeData(next);
        }
      } catch (error) {
        if (!cancelled) {
          setPracticeData(null);
          setPracticeError(error instanceof Error ? error.message : "Failed to load hobby practice analytics.");
        }
      } finally {
        if (!cancelled) {
          setPracticeLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [householdId, selectedHobbyId]);

  useEffect(() => {
    let cancelled = false;

    const load = async (): Promise<void> => {
      setGoalLoading(true);
      setGoalError(null);

      try {
        const next = await getHobbyGoalProgress(householdId, {
          ...(selectedHobbyId !== "all" ? { hobbyId: selectedHobbyId } : {}),
          status: "active"
        });

        if (!cancelled) {
          setGoalData(next);
        }
      } catch (error) {
        if (!cancelled) {
          setGoalData(null);
          setGoalError(error instanceof Error ? error.message : "Failed to load hobby goal analytics.");
        }
      } finally {
        if (!cancelled) {
          setGoalLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [householdId, selectedHobbyId]);

  useEffect(() => {
    const nextGoalId = goalData?.goals[0]?.goalId ?? "";

    if (!goalData?.goals.length) {
      if (selectedGoalId !== "") {
        setSelectedGoalId("");
      }
      return;
    }

    if (!goalData.goals.some((goal) => goal.goalId === selectedGoalId)) {
      setSelectedGoalId(nextGoalId);
    }
  }, [goalData, selectedGoalId]);

  const overviewBarData = useMemo(() => (
    [...(overviewData?.hobbies ?? [])]
      .sort((left, right) => right.totalSessions - left.totalSessions || right.totalDurationMinutes - left.totalDurationMinutes)
      .map((hobby) => ({
        hobbyName: hobby.hobbyName,
        totalSessions: hobby.totalSessions
      }))
  ), [overviewData]);

  const overviewCostData = useMemo(() => (
    (overviewData?.hobbies ?? [])
      .filter((hobby) => hobby.totalCost > 0)
      .map((hobby) => ({
        name: hobby.hobbyName,
        value: hobby.totalCost
      }))
  ), [overviewData]);

  const sessionLineData = useMemo(() => {
    if (!sessionData) {
      return [];
    }

    return sessionData.totals.map((total) => {
      const row: Record<string, unknown> = { month: total.month };

      for (const hobby of sessionData.hobbies) {
        const point = hobby.monthlyBreakdown.find((entry) => entry.month === total.month);
        row[hobby.hobbyId] = point?.sessionCount ?? 0;
      }

      return row;
    });
  }, [sessionData]);

  const sessionAreaData = useMemo(() => (
    (sessionData?.totals ?? []).map((total) => ({
      month: total.month,
      totalHours: Number((total.totalDurationMinutes / 60).toFixed(2))
    }))
  ), [sessionData]);

  const practiceAdherenceData = useMemo(() => (
    (practiceData?.routines ?? []).map((routine) => {
      const metPeriods = routine.recentPeriods.filter((period) => period.met).length;
      return {
        routineName: routine.routineName,
        metPeriods,
        missedPeriods: routine.recentPeriods.length - metPeriods
      };
    })
  ), [practiceData]);

  const selectedGoal = useMemo(() => goalData?.goals.find((goal) => goal.goalId === selectedGoalId) ?? null, [goalData, selectedGoalId]);

  const goalTrendData = useMemo(() => {
    if (!selectedGoal) {
      return [];
    }

    return selectedGoal.progressHistory.map((point) => ({
      date: point.date,
      progressValue: point.value,
      targetValue: selectedGoal.targetValue
    }));
  }, [selectedGoal]);

  const visibleHobbyOptions = useMemo(() => {
    const ids = new Set(hobbies.map((hobby) => hobby.id));
    return hobbies.filter((hobby) => ids.has(hobby.id));
  }, [hobbies]);

  const renderOverviewTab = (): JSX.Element => {
    if (overviewLoading) {
      return <AnalyticsLoadingState rows={4} />;
    }

    if (overviewError) {
      return <EmptyState message={overviewError} />;
    }

    if (!overviewData || overviewData.hobbies.length === 0) {
      return <EmptyState message="Add hobbies, sessions, and goals to see household hobby analytics." />;
    }

    return (
      <div style={{ display: "grid", gap: 24 }}>
        <section className="stats-row" style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}>
          <div className="stat-card stat-card--accent">
            <span className="stat-card__label">Total Hobbies</span>
            <strong className="stat-card__value">{overviewData.summary.totalHobbies}</strong>
            <span className="stat-card__sub">Tracked in this household</span>
          </div>
          <div className="stat-card">
            <span className="stat-card__label">Active Hobbies</span>
            <strong className="stat-card__value">{overviewData.summary.activeHobbies}</strong>
            <span className="stat-card__sub">Currently in rotation</span>
          </div>
          <div className="stat-card">
            <span className="stat-card__label">All-Time Sessions</span>
            <strong className="stat-card__value">{overviewData.summary.totalSessionsAllTime}</strong>
            <span className="stat-card__sub">Completed sessions on record</span>
          </div>
          <div className="stat-card stat-card--warning">
            <span className="stat-card__label">All-Time Hours</span>
            <strong className="stat-card__value">{formatHours(overviewData.summary.totalDurationAllTime)}</strong>
            <span className="stat-card__sub">Logged duration across hobbies</span>
          </div>
          <div className="stat-card stat-card--danger">
            <span className="stat-card__label">All-Time Cost</span>
            <strong className="stat-card__value">{formatCurrency(overviewData.summary.totalCostAllTime, "$0.00")}</strong>
            <span className="stat-card__sub">Session cost recorded to date</span>
          </div>
        </section>

        <div className="analytics-grid analytics-grid--2">
          <section className="panel">
            <div className="panel__header">
              <h2>Sessions by Hobby</h2>
            </div>
            <div className="panel__body--padded">
              <LkBarChart
                data={overviewBarData}
                xKey="hobbyName"
                bars={[{ dataKey: "totalSessions", label: "Sessions" }]}
                layout="vertical"
                emptyMessage="No session totals are available yet."
                height={Math.max(280, overviewBarData.length * 44)}
              />
            </div>
          </section>

          <section className="panel">
            <div className="panel__header">
              <h2>Cost Distribution</h2>
            </div>
            <div className="panel__body--padded">
              <LkDonutChart
                data={overviewCostData}
                centerValue={formatCurrency(overviewData.summary.totalCostAllTime, "$0.00")}
                centerLabel="All-Time Cost"
                emptyMessage="No hobby costs have been recorded yet."
              />
            </div>
          </section>
        </div>

        <section className="panel">
          <div className="panel__header">
            <h2>Household Hobby Snapshot</h2>
          </div>
          <div className="panel__body">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Hobby</th>
                  <th>Status</th>
                  <th>Mode</th>
                  <th>Sessions</th>
                  <th>Hours</th>
                  <th>Goals</th>
                  <th>Last Session</th>
                </tr>
              </thead>
              <tbody>
                {overviewData.hobbies.map((hobby) => (
                  <tr key={hobby.hobbyId}>
                    <td>{hobby.hobbyName}</td>
                    <td>{hobby.status}</td>
                    <td>{hobby.activityMode}</td>
                    <td>{hobby.totalSessions}</td>
                    <td>{formatHours(hobby.totalDurationMinutes)}</td>
                    <td>{hobby.activeGoals} active / {hobby.achievedGoals} achieved</td>
                    <td>{formatDate(hobby.lastSessionDate, "No sessions yet")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  };

  const renderSessionsTab = (): JSX.Element => {
    const allZero = !sessionData || sessionData.totals.every((point) => point.sessionCount === 0 && point.totalDurationMinutes === 0);

    return (
      <div style={{ display: "grid", gap: 24 }}>
        <section className="panel">
          <div className="panel__body--padded" style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <label className="field" style={{ minWidth: 220 }}>
              <span>Hobby</span>
              <select value={selectedHobbyId} onChange={(event) => setSelectedHobbyId(event.target.value)}>
                <option value="all">All Hobbies</option>
                {visibleHobbyOptions.map((hobby) => <option key={hobby.id} value={hobby.id}>{hobby.name}</option>)}
              </select>
            </label>
            <label className="field" style={{ minWidth: 160 }}>
              <span>Months</span>
              <select value={selectedMonths} onChange={(event) => setSelectedMonths(Number(event.target.value))}>
                {[3, 6, 12].map((value) => <option key={value} value={value}>{value} months</option>)}
              </select>
            </label>
          </div>
        </section>

        {sessionLoading ? <AnalyticsLoadingState rows={4} /> : null}
        {!sessionLoading && sessionError ? <EmptyState message={sessionError} /> : null}
        {!sessionLoading && !sessionError && allZero ? <EmptyState message="Complete a few hobby sessions to reveal monthly frequency and duration trends." /> : null}

        {!sessionLoading && !sessionError && sessionData && !allZero ? (
          <>
            <section className="panel">
              <div className="panel__header">
                <h2>Session Count Trend</h2>
              </div>
              <div className="panel__body--padded">
                <LkLineChart
                  data={sessionLineData}
                  xKey="month"
                  xTickFormatter="month"
                  lines={sessionData.hobbies.map((hobby, index) => ({
                    dataKey: hobby.hobbyId,
                    label: hobby.hobbyName,
                    color: chartColors.series[index % chartColors.series.length] ?? chartColors.primary
                  }))}
                  emptyMessage="No session counts are available for the selected view."
                />
              </div>
            </section>

            <section className="panel">
              <div className="panel__header">
                <h2>Total Duration</h2>
              </div>
              <div className="panel__body--padded">
                <LkAreaChart
                  data={sessionAreaData}
                  xKey="month"
                  xTickFormatter="month"
                  areas={[{ dataKey: "totalHours", label: "Hours" }]}
                  emptyMessage="No duration totals are available for the selected view."
                />
              </div>
            </section>
          </>
        ) : null}
      </div>
    );
  };

  const renderPracticeTab = (): JSX.Element => {
    if (practiceLoading) {
      return <AnalyticsLoadingState rows={5} />;
    }

    if (practiceError) {
      return <EmptyState message={practiceError} />;
    }

    if (!practiceData || practiceData.routines.length === 0) {
      return <EmptyState message="Create practice routines and attach sessions to see streaks and adherence." />;
    }

    return (
      <div style={{ display: "grid", gap: 24 }}>
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          {practiceData.routines.map((routine) => (
            <section key={routine.routineId} className="panel">
              <div className="panel__header">
                <div>
                  <h2>{routine.routineName}</h2>
                  <span>{routine.hobbyName}</span>
                </div>
              </div>
              <div className="panel__body--padded" style={{ display: "grid", gap: 12 }}>
                <div className="stats-row" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
                  <div className="stat-card stat-card--accent">
                    <span className="stat-card__label">Current</span>
                    <strong className="stat-card__value">{routine.currentStreak}</strong>
                    <span className="stat-card__sub">Streak</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-card__label">Longest</span>
                    <strong className="stat-card__value">{routine.longestStreak}</strong>
                    <span className="stat-card__sub">Best run</span>
                  </div>
                  <div className="stat-card stat-card--warning">
                    <span className="stat-card__label">Adherence</span>
                    <strong className="stat-card__value">{formatPercent(routine.adherenceRate)}</strong>
                    <span className="stat-card__sub">Last 12 periods</span>
                  </div>
                </div>
                <div style={{ color: "var(--ink-muted)", fontSize: "0.88rem" }}>
                  {routine.targetSessionsPerPeriod} sessions per {routine.targetFrequency} period
                </div>
              </div>
            </section>
          ))}
        </div>

        <section className="panel">
          <div className="panel__header">
            <h2>Adherence by Routine</h2>
          </div>
          <div className="panel__body--padded">
            <LkBarChart
              data={practiceAdherenceData}
              xKey="routineName"
              bars={[
                { dataKey: "metPeriods", label: "Met", stackId: "periods", color: chartColors.secondary },
                { dataKey: "missedPeriods", label: "Missed", stackId: "periods", color: chartColors.danger }
              ]}
              layout="vertical"
              emptyMessage="No routine adherence data is available yet."
              height={Math.max(280, practiceAdherenceData.length * 44)}
            />
          </div>
        </section>
      </div>
    );
  };

  const renderGoalsTab = (): JSX.Element => {
    if (goalLoading) {
      return <AnalyticsLoadingState rows={4} />;
    }

    if (goalError) {
      return <EmptyState message={goalError} />;
    }

    if (!goalData || goalData.goals.length === 0) {
      return <EmptyState message="Create active practice goals to monitor progress and completion pace." />;
    }

    return (
      <div style={{ display: "grid", gap: 24 }}>
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
          {goalData.goals.map((goal) => (
            <section key={goal.goalId} className="panel">
              <div className="panel__header">
                <div>
                  <h2>{goal.goalName}</h2>
                  <span>{goal.hobbyName}</span>
                </div>
              </div>
              <div className="panel__body--padded" style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: "0.9rem" }}>
                  <strong>{goal.currentValue} / {goal.targetValue} {goal.unit}</strong>
                  <span style={{ color: "var(--ink-muted)" }}>{goal.percentComplete}%</span>
                </div>
                <div style={{ height: 10, borderRadius: 999, background: "var(--surface-2, #e2e8f0)", overflow: "hidden" }}>
                  <div style={{ width: getProgressBarWidth(goal.percentComplete), height: "100%", background: goal.onTrack === false ? chartColors.warning : chartColors.primary }} />
                </div>
                <div style={{ display: "grid", gap: 6, color: "var(--ink-muted)", fontSize: "0.88rem" }}>
                  <span>Days remaining: {goal.daysRemaining === null ? "No target date" : goal.daysRemaining}</span>
                  <span>Projected completion: {goal.projectedCompletionDate ?? "Not enough recent progress"}</span>
                  <span>On track: {goal.onTrack === null ? "No target date" : goal.onTrack ? "Yes" : "No"}</span>
                </div>
                <button type="button" className="button button--secondary" onClick={() => setSelectedGoalId(goal.goalId)}>
                  View trend
                </button>
              </div>
            </section>
          ))}
        </div>

        <section className="panel">
          <div className="panel__body--padded" style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <label className="field" style={{ minWidth: 280 }}>
              <span>Selected Goal</span>
              <select value={selectedGoalId} onChange={(event) => setSelectedGoalId(event.target.value)}>
                {goalData.goals.map((goal) => <option key={goal.goalId} value={goal.goalId}>{goal.goalName} • {goal.hobbyName}</option>)}
              </select>
            </label>
          </div>
        </section>

        {!selectedGoal ? <EmptyState message="Select a goal to inspect its progress history." /> : (
          <section className="panel">
            <div className="panel__header">
              <h2>Goal Progress Over Time</h2>
            </div>
            <div className="panel__body--padded">
              <LkLineChart
                data={goalTrendData}
                xKey="date"
                xTickFormatter="date"
                lines={[
                  { dataKey: "progressValue", label: selectedGoal.goalName, color: chartColors.primary },
                  { dataKey: "targetValue", label: "Target", color: chartColors.warning }
                ]}
                emptyMessage="This goal has no progress history yet."
              />
            </div>
          </section>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <nav className="analytics-tab-bar" aria-label="Hobby analytics tabs">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            className={`analytics-tab-bar__tab${activeTab === tab.value ? " analytics-tab-bar__tab--active" : ""}`}
            onClick={() => setActiveTab(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === "overview" ? renderOverviewTab() : null}
      {activeTab === "sessions" ? renderSessionsTab() : null}
      {activeTab === "practice" ? renderPracticeTab() : null}
      {activeTab === "goals" ? renderGoalsTab() : null}
    </div>
  );
}