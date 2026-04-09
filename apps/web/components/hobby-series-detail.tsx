"use client";

import type { HobbySeriesDetail, HobbySessionSummary } from "@aegis/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent, type JSX } from "react";
import {
  getHobbySeriesDetail,
  getHobbySessions,
  linkHobbySeriesSession,
  unlinkHobbySeriesSession,
  updateHobbySeries,
  updateHobbySeriesSession,
} from "../lib/api";
import { Card } from "./card";
import { EntryTimeline } from "./entry-system";
import { InlineError } from "./inline-error";
import { useFormattedDate } from "../lib/formatted-date";

type HobbySeriesDetailProps = {
  householdId: string;
  hobbyId: string;
  series: HobbySeriesDetail;
  allSessions: HobbySessionSummary[];
  deleteHobbySeriesAction: (formData: FormData) => Promise<void>;
};

function previewText(value: string | null | undefined, fallback = "-"): string {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "active":
      return "pill pill--success";
    case "completed":
      return "pill pill--muted";
    case "archived":
      return "pill pill--warning";
    default:
      return "pill";
  }
}

function batchLabel(batchNumber: number | null | undefined, fallback = "Unbatched"): string {
  return batchNumber ? `Batch ${batchNumber}` : fallback;
}

type SeriesFormState = {
  name: string;
  description: string;
  status: string;
  tags: string;
  coverImageUrl: string;
  notes: string;
};

function createSeriesFormState(series: HobbySeriesDetail): SeriesFormState {
  return {
    name: series.name,
    description: series.description ?? "",
    status: series.status,
    tags: series.tags.join(", "),
    coverImageUrl: series.coverImageUrl ?? "",
    notes: series.notes ?? "",
  };
}

function normalizeTags(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function HobbySeriesDetail({
  householdId,
  hobbyId,
  series,
  allSessions,
  deleteHobbySeriesAction,
}: HobbySeriesDetailProps): JSX.Element {
  const { formatDate } = useFormattedDate();
  const router = useRouter();
  const [seriesState, setSeriesState] = useState(series);
  const [allSessionsState, setAllSessionsState] = useState(allSessions);
  const [formState, setFormState] = useState(() => createSeriesFormState(series));
  const [isEditing, setIsEditing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [batchDrafts, setBatchDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(series.sessions.map((sessionItem) => [sessionItem.id, String(sessionItem.batchNumber ?? "")])),
  );
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);

  useEffect(() => {
    setSeriesState(series);
    setAllSessionsState(allSessions);
    setFormState(createSeriesFormState(series));
    setBatchDrafts(Object.fromEntries(series.sessions.map((sessionItem) => [sessionItem.id, String(sessionItem.batchNumber ?? "")])));
  }, [allSessions, series]);

  const refreshData = async (): Promise<void> => {
    const [nextSeries, nextSessions] = await Promise.all([
      getHobbySeriesDetail(householdId, hobbyId, seriesState.id),
      getHobbySessions(householdId, hobbyId),
    ]);

    setSeriesState(nextSeries);
    setAllSessionsState(nextSessions);
    setFormState(createSeriesFormState(nextSeries));
    setBatchDrafts(Object.fromEntries(nextSeries.sessions.map((sessionItem) => [sessionItem.id, String(sessionItem.batchNumber ?? "")])));
    setSelectedBatchIds((previous) => previous.filter((sessionId) => nextSeries.sessions.some((item) => item.id === sessionId)));
    router.refresh();
  };

  const sortedSessions = useMemo(
    () => [...seriesState.sessions].sort((left, right) => (left.batchNumber ?? Number.MAX_SAFE_INTEGER) - (right.batchNumber ?? Number.MAX_SAFE_INTEGER)),
    [seriesState.sessions],
  );

  const availableSessions = useMemo(
    () => allSessionsState.filter(
      (sessionItem) => !sessionItem.seriesId && !seriesState.sessions.some((member) => member.id === sessionItem.id),
    ),
    [allSessionsState, seriesState.id, seriesState.sessions],
  );

  const selectedCount = selectedBatchIds.length;

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setIsSaving(true);

    try {
      await updateHobbySeries(householdId, hobbyId, seriesState.id, {
        name: formState.name.trim(),
        description: formState.description.trim() ? formState.description.trim() : null,
        status: formState.status as "active" | "completed" | "archived",
        tags: normalizeTags(formState.tags),
        coverImageUrl: formState.coverImageUrl.trim() ? formState.coverImageUrl.trim() : null,
        notes: formState.notes.trim() ? formState.notes.trim() : null,
      });
      await refreshData();
      setIsEditing(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save series.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleBestBatch = async (sessionId: string | null) => {
    setErrorMessage(null);
    setPendingSessionId(sessionId ?? "best-batch");

    try {
      await updateHobbySeries(householdId, hobbyId, seriesState.id, {
        bestBatchSessionId: sessionId,
      });
      await refreshData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to update best batch.");
    } finally {
      setPendingSessionId(null);
    }
  };

  const handleLinkSession = async () => {
    if (!selectedSessionId) {
      return;
    }

    setErrorMessage(null);
    setPendingSessionId(selectedSessionId);

    try {
      await linkHobbySeriesSession(householdId, hobbyId, seriesState.id, selectedSessionId);
      setSelectedSessionId("");
      await refreshData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to add session to series.");
    } finally {
      setPendingSessionId(null);
    }
  };

  const handleRemoveSession = async (sessionId: string) => {
    setErrorMessage(null);
    setPendingSessionId(sessionId);

    try {
      await unlinkHobbySeriesSession(householdId, hobbyId, seriesState.id, sessionId);
      await refreshData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to remove session from series.");
    } finally {
      setPendingSessionId(null);
    }
  };

  const handleBatchNumberSave = async (sessionId: string) => {
    const rawValue = batchDrafts[sessionId]?.trim();
    const batchNumber = Number(rawValue);

    if (!rawValue || Number.isNaN(batchNumber) || batchNumber < 1) {
      setErrorMessage("Batch numbers must be positive integers.");
      return;
    }

    setErrorMessage(null);
    setPendingSessionId(sessionId);

    try {
      await updateHobbySeriesSession(householdId, hobbyId, seriesState.id, sessionId, { batchNumber });
      await refreshData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to update batch number.");
    } finally {
      setPendingSessionId(null);
    }
  };

  return (
    <div className="resource-layout">
      <div className="resource-layout__primary hobby-series-detail-stack">
        <InlineError message={errorMessage} />

        <Card title="Series Header">
          <div className="hobby-series-hero">
            <div className="hobby-series-hero__media">
              {seriesState.coverImageUrl ? (
                <img src={seriesState.coverImageUrl} alt={`${seriesState.name} cover artwork`} className="hobby-series-hero__image" />
              ) : (
                <div className="hobby-series-hero__placeholder">Series</div>
              )}
            </div>

            <div className="hobby-series-hero__content">
              <div className="hobby-series-hero__topline">
                <h2>{seriesState.name}</h2>
                <span className={statusBadgeClass(seriesState.status)}>{seriesState.status}</span>
              </div>

              <p>{previewText(seriesState.description, "No description yet.")}</p>

              <div className="hobby-series-hero__meta">
                <span>{seriesState.batchCount} batches</span>
                <span>Recent {formatDate(seriesState.lastSessionDate)}</span>
                {seriesState.bestBatchSessionName ? <span>Best {seriesState.bestBatchSessionName}</span> : null}
              </div>

              {seriesState.tags.length > 0 ? (
                <div className="hobby-series-card__tags">
                  {seriesState.tags.map((tag) => (
                    <span key={tag} className="pill pill--muted">{tag}</span>
                  ))}
                </div>
              ) : null}

              <div className="hobby-series-detail-actions">
                <Link href={`/hobbies/${hobbyId}/sessions/new?seriesId=${seriesState.id}`} className="button button--primary button--sm">
                  New Session
                </Link>
                <Link
                  href={selectedCount >= 2
                    ? `/hobbies/${hobbyId}/series/${seriesState.id}/compare?sessions=${selectedBatchIds.join(",")}`
                    : `/hobbies/${hobbyId}/series/${seriesState.id}/compare`}
                  className="button button--secondary button--sm"
                >
                  {selectedCount >= 2 ? `Compare Selected (${selectedCount})` : "Compare All Batches"}
                </Link>
                <button type="button" className="button button--ghost button--sm" onClick={() => setIsEditing((previous) => !previous)}>
                  {isEditing ? "Close Edit" : "Edit Series"}
                </button>
              </div>
            </div>
          </div>
        </Card>

        {isEditing ? (
          <Card title="Edit Series">
            <form className="hobby-series-edit-grid" onSubmit={handleSave}>
              <label className="field field--full">
                <span>Name</span>
                <input value={formState.name} onChange={(event) => setFormState((previous) => ({ ...previous, name: event.target.value }))} required />
              </label>
              <label className="field">
                <span>Status</span>
                <select value={formState.status} onChange={(event) => setFormState((previous) => ({ ...previous, status: event.target.value }))}>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
              <label className="field">
                <span>Tags</span>
                <input value={formState.tags} onChange={(event) => setFormState((previous) => ({ ...previous, tags: event.target.value }))} placeholder="lager, baseline, dry hop" />
              </label>
              <label className="field field--full">
                <span>Description</span>
                <textarea rows={4} value={formState.description} onChange={(event) => setFormState((previous) => ({ ...previous, description: event.target.value }))} />
              </label>
              <label className="field field--full">
                <span>Cover Image URL</span>
                <input value={formState.coverImageUrl} onChange={(event) => setFormState((previous) => ({ ...previous, coverImageUrl: event.target.value }))} />
              </label>
              <label className="field field--full">
                <span>Notes</span>
                <textarea rows={6} value={formState.notes} onChange={(event) => setFormState((previous) => ({ ...previous, notes: event.target.value }))} />
              </label>
              <div className="session-inline-actions">
                <button type="submit" className="button button--primary" disabled={isSaving || !formState.name.trim()}>
                  {isSaving ? "Saving..." : "Save Series"}
                </button>
              </div>
            </form>
          </Card>
        ) : null}

        <Card title="Batch Timeline" actions={<span className="pill">{sortedSessions.length} sessions</span>}>
          <div className="hobby-series-timeline">
            {sortedSessions.length === 0 ? <p className="panel__empty">No sessions linked yet.</p> : null}

            {sortedSessions.map((sessionItem) => {
              const isBest = seriesState.bestBatchSessionId === sessionItem.id;
              const isPending = pendingSessionId === sessionItem.id;
              return (
                <article key={sessionItem.id} className={`hobby-series-batch-card${isBest ? " is-best" : ""}`}>
                  <div className="hobby-series-batch-card__header">
                    <label className="hobby-series-batch-card__select">
                      <input
                        type="checkbox"
                        checked={selectedBatchIds.includes(sessionItem.id)}
                        onChange={(event) => {
                          setSelectedBatchIds((previous) =>
                            event.target.checked
                              ? [...previous, sessionItem.id]
                              : previous.filter((id) => id !== sessionItem.id),
                          );
                        }}
                      />
                      <span>{batchLabel(sessionItem.batchNumber)}</span>
                    </label>

                    <div className="hobby-series-batch-card__badges">
                      <span className={statusBadgeClass(sessionItem.status)}>{sessionItem.status}</span>
                      {isBest ? <span className="pill pill--success">Best batch</span> : null}
                    </div>
                  </div>

                  <div className="hobby-series-batch-card__body">
                    <div>
                      <strong>{sessionItem.name}</strong>
                      <p className="hobby-series-batch-card__caption">
                        {formatDate(sessionItem.date)}
                        {sessionItem.recipeName ? ` · ${sessionItem.recipeName}` : ""}
                        {sessionItem.rating != null ? ` · ${sessionItem.rating}/5` : ""}
                      </p>
                    </div>

                    {sessionItem.metricReadings.length > 0 ? (
                      <div className="hobby-series-batch-card__metrics">
                        {sessionItem.metricReadings.slice(0, 4).map((reading) => (
                          <span key={reading.id} className="pill pill--muted">
                            {reading.metricName}: {reading.value} {reading.metricUnit}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="hobby-series-batch-card__caption">No metric readings recorded yet.</p>
                    )}

                    <div className="hobby-series-batch-card__footer">
                      <label className="field hobby-series-batch-card__batch-input">
                        <span>Batch #</span>
                        <input
                          type="number"
                          min="1"
                          value={batchDrafts[sessionItem.id] ?? ""}
                          onChange={(event) => setBatchDrafts((previous) => ({ ...previous, [sessionItem.id]: event.target.value }))}
                        />
                      </label>

                      <div className="hobby-series-batch-card__actions">
                        <button type="button" className="button button--secondary button--sm" onClick={() => void handleBatchNumberSave(sessionItem.id)} disabled={isPending}>
                          Save Batch
                        </button>
                        <button type="button" className="button button--ghost button--sm" onClick={() => void handleBestBatch(isBest ? null : sessionItem.id)} disabled={isPending || pendingSessionId === "best-batch"}>
                          {isBest ? "Clear Best" : "Mark Best"}
                        </button>
                        <button type="button" className="button button--ghost button--sm" onClick={() => void handleRemoveSession(sessionItem.id)} disabled={isPending}>
                          Remove
                        </button>
                        <Link href={`/hobbies/${hobbyId}/sessions/${sessionItem.id}`} className="button button--ghost button--sm">
                          Open Session
                        </Link>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </Card>

        <EntryTimeline
          householdId={householdId}
          entityType="hobby_series"
          entityId={seriesState.id}
          title="Series Timeline"
          quickAddLabel="Series Entry"
          entryHrefBuilder={(entry) => `/hobbies/${hobbyId}/series/${seriesState.id}#entry-${entry.id}`}
        />
      </div>

      <aside className="resource-layout__aside hobby-series-aside-stack">
        <Card title="Add Existing Session">
          <div className="session-section-stack">
            <label className="field">
              <span>Available sessions</span>
              <select value={selectedSessionId} onChange={(event) => setSelectedSessionId(event.target.value)}>
                <option value="">Select a session</option>
                {availableSessions.map((sessionItem) => (
                  <option key={sessionItem.id} value={sessionItem.id}>
                    {sessionItem.name}
                    {sessionItem.recipeName ? ` · ${sessionItem.recipeName}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="button button--primary" onClick={() => void handleLinkSession()} disabled={!selectedSessionId || pendingSessionId === selectedSessionId}>
              {pendingSessionId === selectedSessionId ? "Adding..." : "Add to Series"}
            </button>
          </div>
        </Card>

        <Card title="Series Notes">
          <div className="data-list">
            <div>
              <dt>Created</dt>
              <dd>{formatDate(seriesState.createdAt)}</dd>
            </div>
            <div>
              <dt>Updated</dt>
              <dd>{formatDate(seriesState.updatedAt)}</dd>
            </div>
            <div>
              <dt>Notes</dt>
              <dd>{previewText(seriesState.notes, "No series notes yet.")}</dd>
            </div>
          </div>
        </Card>

        <Card title="Danger Zone">
          <form action={deleteHobbySeriesAction} className="session-section-stack">
            <input type="hidden" name="householdId" value={householdId} />
            <input type="hidden" name="hobbyId" value={hobbyId} />
            <input type="hidden" name="seriesId" value={seriesState.id} />
            <p className="panel__empty">Deleting a series unlinks its sessions but leaves the sessions themselves intact.</p>
            <button type="submit" className="button button--danger">Delete Series</button>
          </form>
        </Card>
      </aside>
    </div>
  );
}