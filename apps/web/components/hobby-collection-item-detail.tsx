"use client";

import type {
  HobbyCollectionItemDetail,
  HobbyMetricDefinition,
} from "@lifekeeper/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent, type JSX } from "react";
import { createHobbyMetricReading, updateHobbyCollectionItem } from "../lib/api";
import { LkLineChart } from "./charts";
import { EntryTimeline } from "./entry-system";
import { useFormattedDate } from "../lib/formatted-date";
import { toHouseholdDateInputValue, fromHouseholdDateInput } from "../lib/date-input-utils";
import { useTimezone } from "../lib/timezone-context";

type HobbyCollectionItemDetailProps = {
  householdId: string;
  hobbyId: string;
  item: HobbyCollectionItemDetail;
  metrics: HobbyMetricDefinition[];
};

function inferCustomFieldValue(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  const numeric = Number(trimmed);
  if (!Number.isNaN(numeric) && trimmed === String(numeric)) return numeric;
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

export function HobbyCollectionItemDetailSurface({ householdId, hobbyId, item, metrics }: HobbyCollectionItemDetailProps): JSX.Element {
  const { formatDate } = useFormattedDate();
  const { timezone } = useTimezone();
  const router = useRouter();
  const [itemState, setItemState] = useState(item);
  const [headerDraft, setHeaderDraft] = useState({
    name: item.name,
    status: item.status,
    location: item.location ?? "",
    acquiredDate: toHouseholdDateInputValue(item.acquiredDate, timezone),
    coverImageUrl: item.coverImageUrl ?? "",
    quantity: String(item.quantity),
  });
  const [customFieldRows, setCustomFieldRows] = useState<Array<{ key: string; value: string }>>(() => Object.entries(item.customFields).map(([key, value]) => ({ key, value: typeof value === "string" ? value : JSON.stringify(value) })));
  const [newField, setNewField] = useState({ key: "", value: "" });
  const [metricDraft, setMetricDraft] = useState({ metricId: metrics[0]?.id ?? "", sessionId: item.sessionHistory[0]?.id ?? "", value: "", readingDate: toHouseholdDateInputValue(new Date().toISOString(), timezone), notes: "" });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const groupedMetricReadings = useMemo(() => {
    const grouped = new Map<string, Array<{ date: string; value: number }>>();
    itemState.metricReadings.forEach((reading) => {
      const bucket = grouped.get(reading.metricDefinitionId) ?? [];
      bucket.push({ date: reading.readingDate, value: reading.value });
      grouped.set(reading.metricDefinitionId, bucket);
    });
    return grouped;
  }, [itemState.metricReadings]);

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const customFields = Object.fromEntries(customFieldRows.filter((row) => row.key.trim()).map((row) => [row.key.trim(), inferCustomFieldValue(row.value)]));
      const updated = await updateHobbyCollectionItem(householdId, hobbyId, itemState.id, {
        name: headerDraft.name,
        status: headerDraft.status,
        location: headerDraft.location || null,
        acquiredDate: fromHouseholdDateInput(headerDraft.acquiredDate, timezone),
        coverImageUrl: headerDraft.coverImageUrl || null,
        quantity: Number(headerDraft.quantity || 0),
        customFields,
      });
      setItemState((current) => ({ ...current, ...updated, customFields }));
      setMessage("Collection item updated.");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update collection item.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddCustomField = () => {
    if (!newField.key.trim()) return;
    setCustomFieldRows((current) => [...current, { key: newField.key.trim(), value: newField.value }]);
    setNewField({ key: "", value: "" });
  };

  const handleMetricSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!metricDraft.metricId || !metricDraft.value.trim()) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const created = await createHobbyMetricReading(householdId, hobbyId, metricDraft.metricId, {
        ...(metricDraft.sessionId ? { sessionId: metricDraft.sessionId } : {}),
        value: Number(metricDraft.value),
        readingDate: fromHouseholdDateInput(metricDraft.readingDate, timezone) ?? new Date().toISOString(),
        notes: metricDraft.notes.trim() || undefined,
      });
      const metric = metrics.find((entry) => entry.id === metricDraft.metricId);
      const session = itemState.sessionHistory.find((entry) => entry.id === metricDraft.sessionId);
      setItemState((current) => ({
        ...current,
        metricReadings: [{
          id: created.id,
          metricDefinitionId: created.metricDefinitionId,
          sessionId: created.sessionId,
          value: created.value,
          readingDate: created.readingDate,
          notes: created.notes,
          createdAt: created.createdAt,
          metricName: metric?.name ?? "Metric",
          metricUnit: metric?.unit ?? "",
          sessionName: session?.name ?? null,
        }, ...current.metricReadings],
      }));
      setMetricDraft((current) => ({ ...current, value: "", notes: "" }));
      setMessage("Metric reading recorded.");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to record metric reading.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mode-workspace mode-stack">
      <section className="panel panel--studio">
        <div className="panel__header mode-detail-header">
          <div>
            <h2>{itemState.name}</h2>
            <p>{itemState.description ?? "No description provided."}</p>
          </div>
          <div className="mode-detail-header__meta">
            <span className="pill pill--muted">{itemState.status}</span>
            {itemState.location ? <span className="pill">{itemState.location}</span> : null}
          </div>
        </div>
        <div className="panel__body--padded mode-stack">
          {message ? <p className="workbench-success">{message}</p> : null}
          {error ? <p className="workbench-error">{error}</p> : null}

          <form className="workbench-form" onSubmit={handleSave}>
            <div className="workbench-grid">
              <label className="workbench-field workbench-field--wide">
                <span className="workbench-field__label">Name</span>
                <input className="workbench-field__input" value={headerDraft.name} onChange={(event) => setHeaderDraft((current) => ({ ...current, name: event.target.value }))} required />
              </label>
              <label className="workbench-field">
                <span className="workbench-field__label">Status</span>
                <select className="workbench-field__input" value={headerDraft.status} onChange={(event) => setHeaderDraft((current) => ({ ...current, status: event.target.value as HobbyCollectionItemDetail["status"] }))}>
                  <option value="active">Active</option>
                  <option value="dormant">Dormant</option>
                  <option value="retired">Retired</option>
                  <option value="lost">Lost</option>
                  <option value="deceased">Deceased</option>
                </select>
              </label>
              <label className="workbench-field">
                <span className="workbench-field__label">Location</span>
                <input className="workbench-field__input" value={headerDraft.location} onChange={(event) => setHeaderDraft((current) => ({ ...current, location: event.target.value }))} />
              </label>
              <label className="workbench-field">
                <span className="workbench-field__label">Acquired date</span>
                <input type="date" className="workbench-field__input" value={headerDraft.acquiredDate} onChange={(event) => setHeaderDraft((current) => ({ ...current, acquiredDate: event.target.value }))} />
              </label>
              <label className="workbench-field">
                <span className="workbench-field__label">Quantity</span>
                <input className="workbench-field__input" value={headerDraft.quantity} onChange={(event) => setHeaderDraft((current) => ({ ...current, quantity: event.target.value }))} />
              </label>
              <label className="workbench-field workbench-field--wide">
                <span className="workbench-field__label">Cover image URL</span>
                <input className="workbench-field__input" value={headerDraft.coverImageUrl} onChange={(event) => setHeaderDraft((current) => ({ ...current, coverImageUrl: event.target.value }))} />
              </label>
            </div>

            <section className="mode-section-card">
              <div className="mode-section-card__head"><h3>Custom fields</h3></div>
              <div className="mode-stack">
                {customFieldRows.map((row, index) => (
                  <div key={`${row.key}-${index}`} className="mode-inline-form mode-inline-form--grid">
                    <input value={row.key} onChange={(event) => setCustomFieldRows((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, key: event.target.value } : entry))} placeholder="Field name" />
                    <input value={row.value} onChange={(event) => setCustomFieldRows((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, value: event.target.value } : entry))} placeholder="Field value" />
                    <button type="button" className="button button--ghost button--sm" onClick={() => setCustomFieldRows((current) => current.filter((_, entryIndex) => entryIndex !== index))}>Remove</button>
                  </div>
                ))}
                <div className="mode-inline-form mode-inline-form--grid">
                  <input value={newField.key} onChange={(event) => setNewField((current) => ({ ...current, key: event.target.value }))} placeholder="New field" />
                  <input value={newField.value} onChange={(event) => setNewField((current) => ({ ...current, value: event.target.value }))} placeholder="Value" />
                  <button type="button" className="button button--secondary button--sm" onClick={handleAddCustomField}>Add field</button>
                </div>
              </div>
            </section>

            <div className="workbench-bar">
              <button type="submit" className="button button--primary button--sm" disabled={saving}>Save item</button>
            </div>
          </form>
        </div>
      </section>

      <EntryTimeline
        householdId={householdId}
        entityType="hobby_collection_item"
        entityId={itemState.id}
        title="Item timeline"
        quickAddLabel="Observation"
        entryHrefBuilder={(entry) => `/hobbies/${hobbyId}/collection/${itemState.id}#entry-${entry.id}`}
      />

      <section className="panel panel--studio">
        <div className="panel__header"><h2>Item sessions</h2></div>
        <div className="panel__body--padded mode-stack">
          {itemState.sessionHistory.length === 0 ? <p className="panel__empty">No sessions linked to this item yet.</p> : (
            itemState.sessionHistory.map((session) => (
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
                  {session.routineName ? <span>Routine: {session.routineName}</span> : null}
                </div>
              </Link>
            ))
          )}
        </div>
      </section>

      <section className="panel panel--studio">
        <div className="panel__header"><h2>Lineage</h2></div>
        <div className="panel__body--padded mode-stack">
          {itemState.parentItemId ? <p>Parent item: <Link className="text-link" href={`/hobbies/${hobbyId}/collection/${itemState.parentItemId}`}>Open parent item</Link></p> : <p className="panel__empty">No parent item linked.</p>}
          {itemState.childItems.length === 0 ? <p className="panel__empty">No child items linked.</p> : (
            <div className="mode-stack">
              {itemState.childItems.map((child) => (
                <Link key={child.id} href={`/hobbies/${hobbyId}/collection/${child.id}`} className="mode-inline-row mode-inline-row--card">
                  <div>
                    <strong>{child.name}</strong>
                    <p>{child.location ?? "No location"}</p>
                  </div>
                  <span className="pill pill--muted">{child.status}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="panel panel--studio">
        <div className="panel__header"><h2>Item metrics</h2></div>
        <div className="panel__body--padded mode-stack">
          <form className="mode-inline-form mode-inline-form--grid" onSubmit={handleMetricSubmit}>
            <select value={metricDraft.metricId} onChange={(event) => setMetricDraft((current) => ({ ...current, metricId: event.target.value }))} required>
              {metrics.map((metric) => <option key={metric.id} value={metric.id}>{metric.name}</option>)}
            </select>
            <select value={metricDraft.sessionId} onChange={(event) => setMetricDraft((current) => ({ ...current, sessionId: event.target.value }))}>
              <option value="">No linked session</option>
              {itemState.sessionHistory.map((session) => <option key={session.id} value={session.id}>{session.name}</option>)}
            </select>
            <input value={metricDraft.value} onChange={(event) => setMetricDraft((current) => ({ ...current, value: event.target.value }))} placeholder="Value" required />
            <input type="date" value={metricDraft.readingDate} onChange={(event) => setMetricDraft((current) => ({ ...current, readingDate: event.target.value }))} required />
            <input value={metricDraft.notes} onChange={(event) => setMetricDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Notes" />
            <button type="submit" className="button button--secondary button--sm" disabled={saving}>Record reading</button>
          </form>

          {metrics.map((metric) => {
            const points = groupedMetricReadings.get(metric.id) ?? [];
            if (points.length === 0) return null;
            return (
              <section key={metric.id} className="mode-section-card">
                <div className="mode-section-card__head">
                  <h3>{metric.name}</h3>
                  <span className="pill pill--muted">{metric.unit}</span>
                </div>
                <LkLineChart
                  data={points}
                  xKey="date"
                  lines={[{ dataKey: "value", label: metric.name }]}
                  xTickFormatter="date"
                  height={240}
                  emptyMessage="No readings recorded."
                />
              </section>
            );
          })}
        </div>
      </section>
    </div>
  );
}