"use client";

import type { HobbyMetricDefinition, HobbyMetricReading } from "@aegis/types";
import { useState, type FormEvent, type JSX } from "react";
import {
  createHobbyMetric,
  createHobbyMetricReading,
  deleteHobbyMetric,
  deleteHobbyMetricReading,
  updateHobbyMetric,
} from "../lib/api";
import {
  SectionFilterBar,
  SectionFilterChildren,
  SectionFilterProvider,
  SectionFilterToggle
} from "./section-filter";
import { useFormattedDate } from "../lib/formatted-date";
import { toHouseholdDateInputValue, fromHouseholdDateInput } from "../lib/date-input-utils";
import { useTimezone } from "../lib/timezone-context";

type HobbyMetricsManagerProps = {
  householdId: string;
  hobbyId: string;
  initialMetrics: HobbyMetricDefinition[];
  initialReadingsMap: Record<string, HobbyMetricReading[]>;
};

type MetricDraft = {
  name: string;
  unit: string;
  description: string;
  metricType: string;
};

type ReadingDraft = {
  value: string;
  readingDate: string;
  notes: string;
};

const emptyReadingDraft = (timezone = "UTC"): ReadingDraft => ({
  value: "",
  readingDate: toHouseholdDateInputValue(new Date().toISOString(), timezone),
  notes: "",
});

const emptyMetricDraft = (): MetricDraft => ({
  name: "",
  unit: "",
  description: "",
  metricType: "numeric",
});

export function HobbyMetricsManager({
  householdId,
  hobbyId,
  initialMetrics,
  initialReadingsMap,
}: HobbyMetricsManagerProps): JSX.Element {
  const { formatDate } = useFormattedDate();
  const { timezone } = useTimezone();
  const [metrics, setMetrics] = useState(initialMetrics);
  const [readingsMap, setReadingsMap] = useState(initialReadingsMap);
  const [newMetric, setNewMetric] = useState<MetricDraft>(emptyMetricDraft());
  const [editingMetricId, setEditingMetricId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<MetricDraft>(emptyMetricDraft());
  const [readingDrafts, setReadingDrafts] = useState<Record<string, ReadingDraft>>({});
  const [error, setError] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const getReadingDraft = (metricId: string): ReadingDraft => readingDrafts[metricId] ?? emptyReadingDraft(timezone);

  const handleCreateMetric = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pendingKey) return;

    setPendingKey("metric-create");
    setError(null);

    try {
      const created = await createHobbyMetric(householdId, hobbyId, {
        name: newMetric.name.trim(),
        unit: newMetric.unit.trim(),
        ...(newMetric.description.trim() ? { description: newMetric.description.trim() } : {}),
        ...(newMetric.metricType.trim() ? { metricType: newMetric.metricType.trim() } : {}),
      });
      setMetrics((current) => [...current, created]);
      setReadingsMap((current) => ({ ...current, [created.id]: [] }));
      setNewMetric(emptyMetricDraft());
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to create metric.");
    } finally {
      setPendingKey(null);
    }
  };

  const beginEditingMetric = (metric: HobbyMetricDefinition) => {
    setEditingMetricId(metric.id);
    setEditDraft({
      name: metric.name,
      unit: metric.unit,
      description: metric.description ?? "",
      metricType: metric.metricType,
    });
  };

  const handleSaveMetric = async (metricId: string) => {
    if (pendingKey) return;

    setPendingKey(`metric-save-${metricId}`);
    setError(null);

    try {
      const updated = await updateHobbyMetric(householdId, hobbyId, metricId, {
        name: editDraft.name.trim(),
        unit: editDraft.unit.trim(),
        description: editDraft.description.trim() ? editDraft.description.trim() : null,
        metricType: editDraft.metricType.trim() || "numeric",
      });
      setMetrics((current) => current.map((metric) => metric.id === metricId ? updated : metric));
      setEditingMetricId(null);
      setEditDraft(emptyMetricDraft());
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update metric.");
    } finally {
      setPendingKey(null);
    }
  };

  const handleDeleteMetric = async (metricId: string) => {
    if (pendingKey) return;

    setPendingKey(`metric-delete-${metricId}`);
    setError(null);

    try {
      await deleteHobbyMetric(householdId, hobbyId, metricId);
      setMetrics((current) => current.filter((metric) => metric.id !== metricId));
      setReadingsMap((current) => {
        const next = { ...current };
        delete next[metricId];
        return next;
      });
      if (editingMetricId === metricId) {
        setEditingMetricId(null);
        setEditDraft(emptyMetricDraft());
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete metric.");
    } finally {
      setPendingKey(null);
    }
  };

  const handleReadingSubmit = async (event: FormEvent<HTMLFormElement>, metric: HobbyMetricDefinition) => {
    event.preventDefault();
    if (pendingKey) return;

    const draft = getReadingDraft(metric.id);
    setPendingKey(`reading-create-${metric.id}`);
    setError(null);

    try {
      const created = await createHobbyMetricReading(householdId, hobbyId, metric.id, {
        value: Number(draft.value),
        readingDate: fromHouseholdDateInput(draft.readingDate, timezone) ?? new Date().toISOString(),
        ...(draft.notes.trim() ? { notes: draft.notes.trim() } : {}),
      });
      setReadingsMap((current) => ({
        ...current,
        [metric.id]: [created, ...(current[metric.id] ?? [])],
      }));
      setReadingDrafts((current) => ({ ...current, [metric.id]: emptyReadingDraft(timezone) }));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to record reading.");
    } finally {
      setPendingKey(null);
    }
  };

  const handleDeleteReading = async (metricId: string, readingId: string) => {
    if (pendingKey) return;

    setPendingKey(`reading-delete-${readingId}`);
    setError(null);

    try {
      await deleteHobbyMetricReading(householdId, hobbyId, metricId, readingId);
      setReadingsMap((current) => ({
        ...current,
        [metricId]: (current[metricId] ?? []).filter((reading) => reading.id !== readingId),
      }));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete reading.");
    } finally {
      setPendingKey(null);
    }
  };

  return (
    <SectionFilterProvider items={metrics} keys={["name"]} placeholder="Filter metric definitions by name">
      <div className="hobby-manager-stack">
        <section className="panel">
          <div className="panel__header">
            <h2>Metric Definitions</h2>
            <div className="panel__header-actions">
              <SectionFilterToggle />
            </div>
          </div>
          <SectionFilterBar />
        <div className="panel__body--padded hobby-manager-stack">
          <p className="hobby-manager-note">Track measurements over time so the hobby keeps a real operational history, not just a snapshot.</p>
          <form className="form-grid" onSubmit={handleCreateMetric}>
            <label className="field">
              <span>Name</span>
              <input value={newMetric.name} onChange={(event) => setNewMetric((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. Gravity, Kiln Temp, Yield" disabled={pendingKey !== null} />
            </label>
            <label className="field">
              <span>Unit</span>
              <input value={newMetric.unit} onChange={(event) => setNewMetric((current) => ({ ...current, unit: event.target.value }))} placeholder="e.g. SG, deg F, items" disabled={pendingKey !== null} />
            </label>
            <label className="field">
              <span>Metric Type</span>
              <input value={newMetric.metricType} onChange={(event) => setNewMetric((current) => ({ ...current, metricType: event.target.value }))} placeholder="numeric" disabled={pendingKey !== null} />
            </label>
            <label className="field field--full">
              <span>Description</span>
              <textarea value={newMetric.description} onChange={(event) => setNewMetric((current) => ({ ...current, description: event.target.value }))} rows={2} placeholder="Why this metric matters to the hobby history" disabled={pendingKey !== null} />
            </label>
            <div className="inline-actions inline-actions--end field--full">
              <button type="submit" className="button button--primary button--sm" disabled={pendingKey !== null || !newMetric.name.trim() || !newMetric.unit.trim()}>
                {pendingKey === "metric-create" ? "Adding…" : "Add Metric"}
              </button>
            </div>
          </form>
          {error ? <p className="workbench-error">{error}</p> : null}
        </div>
        </section>

        <SectionFilterChildren<HobbyMetricDefinition>>
          {(filteredMetrics) => (
            <>
              {metrics.length === 0 ? (
                <section className="panel">
                  <div className="panel__body--padded">
                    <p className="panel__empty">No metrics configured yet.</p>
                  </div>
                </section>
              ) : null}
              {metrics.length > 0 && filteredMetrics.length === 0 ? (
                <section className="panel">
                  <div className="panel__body--padded">
                    <p className="panel__empty">No metrics match that search.</p>
                  </div>
                </section>
              ) : null}
              {filteredMetrics.map((metric) => {
        const readings = readingsMap[metric.id] ?? [];
        const readingDraft = getReadingDraft(metric.id);

        return (
          <section key={metric.id} className="panel">
            <div className="panel__header">
              <div>
                <h2>{metric.name}</h2>
                <p>{metric.description ?? "No description provided."}</p>
              </div>
              <div className="inline-actions">
                <span className="pill">{metric.unit}</span>
                <button type="button" className="button button--secondary button--sm" onClick={() => beginEditingMetric(metric)} disabled={pendingKey !== null}>
                  Edit
                </button>
                <button type="button" className="button button--ghost button--sm" onClick={() => void handleDeleteMetric(metric.id)} disabled={pendingKey !== null}>
                  Delete
                </button>
              </div>
            </div>
            <div className="panel__body--padded hobby-manager-stack">
              {editingMetricId === metric.id ? (
                <div className="hobby-manager-card">
                  <div className="form-grid">
                    <label className="field">
                      <span>Name</span>
                      <input value={editDraft.name} onChange={(event) => setEditDraft((current) => ({ ...current, name: event.target.value }))} />
                    </label>
                    <label className="field">
                      <span>Unit</span>
                      <input value={editDraft.unit} onChange={(event) => setEditDraft((current) => ({ ...current, unit: event.target.value }))} />
                    </label>
                    <label className="field">
                      <span>Metric Type</span>
                      <input value={editDraft.metricType} onChange={(event) => setEditDraft((current) => ({ ...current, metricType: event.target.value }))} />
                    </label>
                    <label className="field field--full">
                      <span>Description</span>
                      <textarea value={editDraft.description} onChange={(event) => setEditDraft((current) => ({ ...current, description: event.target.value }))} rows={2} />
                    </label>
                  </div>
                  <div className="inline-actions inline-actions--end">
                    <button type="button" className="button button--ghost button--sm" onClick={() => setEditingMetricId(null)} disabled={pendingKey !== null}>
                      Cancel
                    </button>
                    <button type="button" className="button button--primary button--sm" onClick={() => void handleSaveMetric(metric.id)} disabled={pendingKey !== null || !editDraft.name.trim() || !editDraft.unit.trim()}>
                      {pendingKey === `metric-save-${metric.id}` ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
              ) : null}

              <form className="form-grid" onSubmit={(event) => void handleReadingSubmit(event, metric)}>
                <label className="field">
                  <span>Value</span>
                  <input type="number" step="any" value={readingDraft.value} onChange={(event) => setReadingDrafts((current) => ({ ...current, [metric.id]: { ...readingDraft, value: event.target.value } }))} placeholder={`Value in ${metric.unit}`} disabled={pendingKey !== null} />
                </label>
                <label className="field">
                  <span>Date</span>
                  <input type="date" value={readingDraft.readingDate} onChange={(event) => setReadingDrafts((current) => ({ ...current, [metric.id]: { ...readingDraft, readingDate: event.target.value } }))} disabled={pendingKey !== null} />
                </label>
                <label className="field field--full">
                  <span>Notes</span>
                  <textarea value={readingDraft.notes} onChange={(event) => setReadingDrafts((current) => ({ ...current, [metric.id]: { ...readingDraft, notes: event.target.value } }))} rows={2} placeholder="Capture what changed, what succeeded, or what went wrong" disabled={pendingKey !== null} />
                </label>
                <div className="inline-actions inline-actions--end field--full">
                  <button type="submit" className="button button--secondary button--sm" disabled={pendingKey !== null || !readingDraft.value.trim() || !readingDraft.readingDate}>
                    {pendingKey === `reading-create-${metric.id}` ? "Recording…" : "Record Reading"}
                  </button>
                </div>
              </form>

              {readings.length === 0 ? <p className="panel__empty">No readings yet. Start recording values to build the history.</p> : (
                <table className="data-table" style={{ width: "100%" }}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Value</th>
                      <th>Notes</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {readings.map((reading) => (
                      <tr key={reading.id}>
                        <td>{formatDate(reading.readingDate)}</td>
                        <td>{reading.value} {metric.unit}</td>
                        <td>{reading.notes ?? "-"}</td>
                        <td>
                          <button type="button" className="button button--ghost button--sm" onClick={() => void handleDeleteReading(metric.id, reading.id)} disabled={pendingKey !== null}>
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        );
              })}
            </>
          )}
        </SectionFilterChildren>
      </div>
    </SectionFilterProvider>
  );
}