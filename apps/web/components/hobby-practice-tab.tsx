"use client";

import type {
  HobbyActivityMode,
  HobbyMetricDefinition,
  HobbyPracticeGoalStatus,
  HobbyPracticeGoalSummary,
  HobbyPracticeRoutineSummary,
  HobbyPracticeGoalType,
  HobbyPracticeRoutineFrequency,
} from "@aegis/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type JSX } from "react";
import { createHobbyPracticeGoal, createHobbyPracticeRoutine } from "../lib/api";
import { useFormattedDate } from "../lib/formatted-date";

type HobbyPracticeTabProps = {
  householdId: string;
  hobbyId: string;
  activityMode: HobbyActivityMode;
  goals: HobbyPracticeGoalSummary[];
  routines: HobbyPracticeRoutineSummary[];
  metrics: HobbyMetricDefinition[];
};

const goalStatusOptions: Array<{ value: HobbyPracticeGoalStatus | "all"; label: string }> = [
  { value: "all", label: "All goals" },
  { value: "active", label: "Active" },
  { value: "achieved", label: "Achieved" },
  { value: "paused", label: "Paused" },
  { value: "abandoned", label: "Abandoned" },
];

function goalStatusClass(status: HobbyPracticeGoalStatus): string {
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

function routineUrgencyLabel(targetDate: string | null): string | null {
  if (!targetDate) return null;
  const days = Math.ceil((new Date(targetDate).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return "Overdue";
  if (days <= 7) return `${days}d left`;
  return null;
}

export function HobbyPracticeTab({ householdId, hobbyId, activityMode, goals, routines, metrics }: HobbyPracticeTabProps): JSX.Element {
  const { formatDate } = useFormattedDate();
  const router = useRouter();
  const [goalFilter, setGoalFilter] = useState<HobbyPracticeGoalStatus | "all">("all");
  const metricNameById = useMemo(() => new Map(metrics.map((metric) => [metric.id, metric.name])), [metrics]);

  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalName, setGoalName] = useState("");
  const [goalType, setGoalType] = useState<HobbyPracticeGoalType>("cumulative");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalUnit, setGoalUnit] = useState("");
  const [goalSaving, setGoalSaving] = useState(false);

  const handleCreateGoal = async () => {
    const target = parseFloat(goalTarget);
    if (!goalName.trim() || !goalUnit.trim() || isNaN(target)) return;
    setGoalSaving(true);
    try {
      await createHobbyPracticeGoal(householdId, hobbyId, {
        name: goalName.trim(),
        goalType,
        targetValue: target,
        unit: goalUnit.trim(),
      });
      setGoalName("");
      setGoalTarget("");
      setGoalUnit("");
      setShowGoalForm(false);
      router.refresh();
    } finally {
      setGoalSaving(false);
    }
  };

  const [showRoutineForm, setShowRoutineForm] = useState(false);
  const [routineName, setRoutineName] = useState("");
  const [routineFreq, setRoutineFreq] = useState<HobbyPracticeRoutineFrequency>("weekly");
  const [routineSessions, setRoutineSessions] = useState("1");
  const [routineSaving, setRoutineSaving] = useState(false);

  const handleCreateRoutine = async () => {
    const sessionsCount = parseInt(routineSessions, 10);
    if (!routineName.trim() || isNaN(sessionsCount) || sessionsCount < 1) return;
    setRoutineSaving(true);
    try {
      await createHobbyPracticeRoutine(householdId, hobbyId, {
        name: routineName.trim(),
        targetFrequency: routineFreq,
        targetSessionsPerPeriod: sessionsCount,
      });
      setRoutineName("");
      setRoutineSessions("1");
      setShowRoutineForm(false);
      router.refresh();
    } finally {
      setRoutineSaving(false);
    }
  };

  const visibleGoals = useMemo(() => goals
    .filter((goal) => goalFilter === "all" || goal.status === goalFilter)
    .sort((left, right) => {
      if (left.status === "active" && right.status !== "active") return -1;
      if (left.status !== "active" && right.status === "active") return 1;
      return (new Date(left.targetDate ?? "9999-12-31").getTime()) - (new Date(right.targetDate ?? "9999-12-31").getTime());
    }), [goalFilter, goals]);

  const visibleRoutines = useMemo(() => [...routines].sort((left, right) => {
    if (left.isActive && !right.isActive) return -1;
    if (!left.isActive && right.isActive) return 1;
    return right.currentStreak - left.currentStreak;
  }), [routines]);

  return (
    <div className="mode-workspace mode-workspace--split">
      <section className="panel panel--studio">
        <div className="panel__header mode-workspace__header">
          <div>
            <h2>Goals</h2>
            <p className="mode-workspace__subcopy">Target progress, metric milestones, and deliberate practice outcomes.</p>
          </div>
          <div className="mode-workspace__header-meta">
            {activityMode === "practice" ? <span className="pill pill--info">Primary mode</span> : null}
            <span className="pill">{goals.filter((goal) => goal.status === "active").length} active</span>
            <button type="button" className="button button--secondary button--sm" onClick={() => setShowGoalForm((prev) => !prev)}>
              {showGoalForm ? "Cancel" : "New Goal"}
            </button>
          </div>
        </div>

        {showGoalForm ? (
          <div className="practice-inline-form">
            <div className="practice-inline-form__fields">
              <label className="field">
                <span>Goal name</span>
                <input type="text" value={goalName} onChange={(e) => setGoalName(e.target.value)} placeholder="e.g. Run 100 miles" />
              </label>
              <label className="field">
                <span>Type</span>
                <select value={goalType} onChange={(e) => setGoalType(e.target.value as HobbyPracticeGoalType)}>
                  <option value="cumulative">Cumulative</option>
                  <option value="threshold">Threshold</option>
                  <option value="streak">Streak</option>
                  <option value="completion">Completion</option>
                </select>
              </label>
              <label className="field">
                <span>Target value</span>
                <input type="number" value={goalTarget} onChange={(e) => setGoalTarget(e.target.value)} placeholder="100" min="0" />
              </label>
              <label className="field">
                <span>Unit</span>
                <input type="text" value={goalUnit} onChange={(e) => setGoalUnit(e.target.value)} placeholder="miles, sessions, hours…" />
              </label>
            </div>
            <div className="practice-inline-form__actions">
              <button type="button" className="button button--primary button--sm" onClick={() => void handleCreateGoal()} disabled={goalSaving || !goalName.trim() || !goalUnit.trim() || !goalTarget}>
                {goalSaving ? "Saving…" : "Add Goal"}
              </button>
            </div>
          </div>
        ) : null}
        <div className="section-filter__bar">
          <label className="section-filter__field">
            <span>Status</span>
            <select value={goalFilter} onChange={(event) => setGoalFilter(event.target.value as HobbyPracticeGoalStatus | "all")}>
              {goalStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        </div>
        <div className="panel__body--padded">
          {visibleGoals.length === 0 ? <p className="panel__empty">No goals match the current filter.</p> : (
            <div className="mode-stack">
              {visibleGoals.map((goal) => {
                const urgency = routineUrgencyLabel(goal.targetDate);
                return (
                  <Link key={goal.id} href={`/hobbies/${hobbyId}/goals/${goal.id}`} className="mode-list-card">
                    <div className="mode-list-card__header">
                      <div>
                        <h3>{goal.name}</h3>
                        <p>{goal.description ?? "No description provided."}</p>
                      </div>
                      <span className={goalStatusClass(goal.status)}>{goal.status}</span>
                    </div>
                    <div className="mode-progress">
                      <div className="mode-progress__meta">
                        <span>{goal.currentValue} / {goal.targetValue} {goal.unit}</span>
                        <strong>{Math.round(goal.progressPercentage)}%</strong>
                      </div>
                      <div className="mode-progress__bar">
                        <span style={{ width: `${Math.max(0, Math.min(100, goal.progressPercentage))}%` }} />
                      </div>
                    </div>
                    <div className="mode-list-card__meta">
                      <span>Target {formatDate(goal.targetDate)}</span>
                      {urgency ? <span className="pill pill--warning">{urgency}</span> : null}
                      {goal.metricDefinitionId ? <span className="pill pill--muted">Metric: {metricNameById.get(goal.metricDefinitionId) ?? "Linked"}</span> : null}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="panel panel--studio">
        <div className="panel__header mode-workspace__header">
          <div>
            <h2>Routines</h2>
            <p className="mode-workspace__subcopy">Stay consistent with repeatable drills, streak visibility, and adherence trends.</p>
          </div>
          <div className="mode-workspace__header-meta">
            <span className="pill">{routines.filter((routine) => routine.isActive).length} active</span>
            <button type="button" className="button button--secondary button--sm" onClick={() => setShowRoutineForm((prev) => !prev)}>
              {showRoutineForm ? "Cancel" : "New Routine"}
            </button>
          </div>
        </div>

        {showRoutineForm ? (
          <div className="practice-inline-form">
            <div className="practice-inline-form__fields">
              <label className="field">
                <span>Routine name</span>
                <input type="text" value={routineName} onChange={(e) => setRoutineName(e.target.value)} placeholder="e.g. Morning drills" />
              </label>
              <label className="field">
                <span>Frequency</span>
                <select value={routineFreq} onChange={(e) => setRoutineFreq(e.target.value as HobbyPracticeRoutineFrequency)}>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </label>
              <label className="field">
                <span>Sessions per period</span>
                <input type="number" value={routineSessions} onChange={(e) => setRoutineSessions(e.target.value)} min="1" max="100" />
              </label>
            </div>
            <div className="practice-inline-form__actions">
              <button type="button" className="button button--primary button--sm" onClick={() => void handleCreateRoutine()} disabled={routineSaving || !routineName.trim()}>
                {routineSaving ? "Saving…" : "Add Routine"}
              </button>
            </div>
          </div>
        ) : null}
        <div className="panel__body--padded">
          {visibleRoutines.length === 0 ? <p className="panel__empty">No routines created yet.</p> : (
            <div className="mode-stack">
              {visibleRoutines.map((routine) => (
                <Link key={routine.id} href={`/hobbies/${hobbyId}/routines/${routine.id}`} className="mode-list-card">
                  <div className="mode-list-card__header">
                    <div>
                      <h3>{routine.name}</h3>
                      <p>{routine.description ?? "No description provided."}</p>
                    </div>
                    <span className={routine.isActive ? "pill pill--success" : "pill pill--muted"}>{routine.isActive ? "active" : "inactive"}</span>
                  </div>
                  <div className="mode-kv-grid mode-kv-grid--compact">
                    <div><span>Target frequency</span><strong>{routine.targetSessionsPerPeriod} / {routine.targetFrequency}</strong></div>
                    <div><span>Current streak</span><strong>{routine.currentStreak > 0 ? `Flame ${routine.currentStreak}` : "0"}</strong></div>
                    <div><span>Longest streak</span><strong>{routine.longestStreak}</strong></div>
                    <div><span>Next session</span><strong>{formatDate(routine.nextExpectedSessionDate)}</strong></div>
                  </div>
                  <div className="mode-progress">
                    <div className="mode-progress__meta">
                      <span>Last 30 days adherence</span>
                      <strong>{Math.round(routine.adherenceRate)}%</strong>
                    </div>
                    <div className="mode-progress__bar">
                      <span style={{ width: `${Math.max(0, Math.min(100, routine.adherenceRate))}%` }} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}