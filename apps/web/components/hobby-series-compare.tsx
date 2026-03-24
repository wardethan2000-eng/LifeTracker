"use client";

import type { Entry, HobbySeriesComparison, HobbySessionSummary } from "@lifekeeper/types";
import Link from "next/link";
import { useMemo, useState, type JSX } from "react";
import { useFormattedDate } from "../lib/formatted-date";

type HobbySeriesCompareProps = {
  hobbyId: string;
  comparison: HobbySeriesComparison;
  sessionSummaries: HobbySessionSummary[];
  sessionEntries: Record<string, Entry[]>;
  selectedSessionIds: string[];
};

function formatDelta(current: number, baseline: number): string {
  const delta = current - baseline;
  if (delta === 0) {
    return "No change";
  }

  return `${delta > 0 ? "+" : ""}${delta.toFixed(2)}`;
}

function noteTypeSummary(entries: Entry[]): Record<"lesson" | "issue" | "observation", Entry[]> {
  return {
    lesson: entries.filter((entry) => entry.entryType === "lesson"),
    issue: entries.filter((entry) => entry.entryType === "issue"),
    observation: entries.filter((entry) => entry.entryType === "observation"),
  };
}

export function HobbySeriesCompare({
  hobbyId,
  comparison,
  sessionSummaries,
  sessionEntries,
  selectedSessionIds,
}: HobbySeriesCompareProps): JSX.Element {
  const { formatDate } = useFormattedDate();
  const [showNotes, setShowNotes] = useState(false);

  const sessions = useMemo(() => {
    const pool = comparison.sessions.filter((sessionItem) =>
      selectedSessionIds.length === 0 || selectedSessionIds.includes(sessionItem.sessionId),
    );

    return [...pool].sort((left, right) => (left.batchNumber ?? Number.MAX_SAFE_INTEGER) - (right.batchNumber ?? Number.MAX_SAFE_INTEGER));
  }, [comparison.sessions, selectedSessionIds]);

  const summaryMap = useMemo(
    () => new Map(sessionSummaries.map((sessionItem) => [sessionItem.id, sessionItem])),
    [sessionSummaries],
  );

  const metricDefinitions = useMemo(() => {
    const order: Array<{ metricDefinitionId: string; metricName: string; metricUnit: string }> = [];
    const seen = new Set<string>();

    for (const sessionItem of sessions) {
      for (const group of sessionItem.metricGroups) {
        if (seen.has(group.metricDefinitionId)) {
          continue;
        }
        seen.add(group.metricDefinitionId);
        order.push({
          metricDefinitionId: group.metricDefinitionId,
          metricName: group.metricName,
          metricUnit: group.metricUnit,
        });
      }
    }

    return order;
  }, [sessions]);

  const highestMetricValueById = useMemo(() => {
    const values = new Map<string, number>();

    for (const definition of metricDefinitions) {
      const numericValues = sessions
        .map((sessionItem) => sessionItem.metricGroups.find((group) => group.metricDefinitionId === definition.metricDefinitionId)?.readings[0]?.value)
        .filter((value): value is number => value != null);

      if (numericValues.length > 0) {
        values.set(definition.metricDefinitionId, Math.max(...numericValues));
      }
    }

    return values;
  }, [metricDefinitions, sessions]);

  return (
    <div className="hobby-series-compare-stack">
      <section className="panel">
        <div className="panel__header">
          <div>
            <h2>Batch Comparison</h2>
            <p className="hobby-series-panel-heading__copy">
              Reviewing {sessions.length} batches from {comparison.series.name}.
            </p>
          </div>
          <div className="panel__header-actions">
            <button type="button" className="button button--ghost button--sm" onClick={() => setShowNotes((previous) => !previous)}>
              {showNotes ? "Hide note details" : "Show note details"}
            </button>
          </div>
        </div>

        <div className="panel__body--padded">
          <div className="hobby-series-compare-scroll">
            <table className="hobby-series-compare-table">
              <thead>
                <tr>
                  <th>Field</th>
                  {sessions.map((sessionItem) => (
                    <th key={sessionItem.sessionId}>
                      <div className="hobby-series-compare-columnhead">
                        <strong>{sessionItem.name}</strong>
                        <span>{sessionItem.batchNumber ? `Batch ${sessionItem.batchNumber}` : "Batch pending"}</span>
                        <Link href={`/hobbies/${hobbyId}/sessions/${sessionItem.sessionId}`} className="text-link">
                          Open session
                        </Link>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="hobby-series-compare-table__group">
                  <td colSpan={sessions.length + 1}>Basic Info</td>
                </tr>
                <tr>
                  <th>Date</th>
                  {sessions.map((sessionItem) => <td key={sessionItem.sessionId}>{formatDate(sessionItem.date)}</td>)}
                </tr>
                <tr>
                  <th>Status</th>
                  {sessions.map((sessionItem) => <td key={sessionItem.sessionId}>{sessionItem.status}</td>)}
                </tr>
                <tr>
                  <th>Rating</th>
                  {sessions.map((sessionItem) => {
                    const bestRating = Math.max(...sessions.map((candidate) => candidate.rating ?? 0));
                    const isBest = (sessionItem.rating ?? 0) > 0 && (sessionItem.rating ?? 0) === bestRating;
                    return (
                      <td key={sessionItem.sessionId} className={isBest ? "is-best" : undefined}>
                        {sessionItem.rating != null ? `${sessionItem.rating}/5` : "-"}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <th>Duration</th>
                  {sessions.map((sessionItem) => (
                    <td key={sessionItem.sessionId}>{summaryMap.get(sessionItem.sessionId)?.durationMinutes != null ? `${summaryMap.get(sessionItem.sessionId)?.durationMinutes} min` : "-"}</td>
                  ))}
                </tr>
                <tr>
                  <th>Recipe</th>
                  {sessions.map((sessionItem, index) => {
                    const baseline = sessions[0]?.recipeName ?? null;
                    const changed = index > 0 && sessionItem.recipeName !== baseline;
                    return (
                      <td key={sessionItem.sessionId} className={changed ? "is-warning" : undefined}>
                        {sessionItem.recipeName ?? "-"}
                      </td>
                    );
                  })}
                </tr>

                <tr className="hobby-series-compare-table__group">
                  <td colSpan={sessions.length + 1}>Metrics</td>
                </tr>
                {metricDefinitions.map((definition) => (
                  <tr key={definition.metricDefinitionId}>
                    <th>{definition.metricName} ({definition.metricUnit})</th>
                    {sessions.map((sessionItem, index) => {
                      const reading = sessionItem.metricGroups.find((group) => group.metricDefinitionId === definition.metricDefinitionId)?.readings[0];
                      const baseline = sessions[0]?.metricGroups.find((group) => group.metricDefinitionId === definition.metricDefinitionId)?.readings[0]?.value;
                      const highest = highestMetricValueById.get(definition.metricDefinitionId);
                      const warnings = sessionEntries[sessionItem.sessionId]?.some((entry) => entry.flags.includes("warning") || entry.entryType === "issue");
                      const className = warnings ? "is-warning" : reading?.value === highest ? "is-best" : undefined;

                      return (
                        <td key={sessionItem.sessionId} className={className}>
                          {reading ? (
                            <div className="hobby-series-compare-metric-cell">
                              <strong>{reading.value}</strong>
                              {index > 0 && baseline != null ? <span>{formatDelta(reading.value, baseline)}</span> : null}
                            </div>
                          ) : "-"}
                        </td>
                      );
                    })}
                  </tr>
                ))}

                <tr className="hobby-series-compare-table__group">
                  <td colSpan={sessions.length + 1}>Recipe Variations</td>
                </tr>
                <tr>
                  <th>Variation Summary</th>
                  {sessions.map((sessionItem, index) => {
                    const baseline = sessions[0]?.recipeName ?? null;
                    let summary = "Baseline batch";
                    if (index > 0 && sessionItem.recipeName && baseline && sessionItem.recipeName !== baseline) {
                      summary = `Recipe shifted from ${baseline}`;
                    } else if (index > 0) {
                      summary = "Recipe held steady";
                    }
                    return <td key={sessionItem.sessionId}>{summary}</td>;
                  })}
                </tr>

                <tr className="hobby-series-compare-table__group">
                  <td colSpan={sessions.length + 1}>Notes Summary</td>
                </tr>
                <tr>
                  <th>Lessons / Issues / Observations</th>
                  {sessions.map((sessionItem) => {
                    const grouped = noteTypeSummary(sessionEntries[sessionItem.sessionId] ?? []);
                    const warning = grouped.issue.length > 0 || (sessionEntries[sessionItem.sessionId] ?? []).some((entry) => entry.flags.includes("warning"));
                    return (
                      <td key={sessionItem.sessionId} className={warning ? "is-warning" : undefined}>
                        <div className="hobby-series-note-summary">
                          <span>{grouped.lesson.length} lessons</span>
                          <span>{grouped.issue.length} issues</span>
                          <span>{grouped.observation.length} observations</span>
                        </div>
                        {showNotes ? (
                          <div className="hobby-series-note-detail">
                            {[...grouped.lesson, ...grouped.issue, ...grouped.observation].slice(0, 4).map((entry) => (
                              <div key={entry.id} className="hobby-series-note-detail__item">
                                <strong>{entry.title ?? entry.entryType}</strong>
                                <p>{entry.body}</p>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}