"use client";

import type { HobbyActivityMode, HobbySeriesSummary } from "@lifekeeper/types";
import Link from "next/link";
import { useMemo, useState, type JSX } from "react";
import {
  SectionFilterBar,
  SectionFilterChildren,
  SectionFilterProvider,
  SectionFilterToggle,
} from "./section-filter";
import { useFormattedDate } from "../lib/formatted-date";

type HobbySeriesListProps = {
  hobbyId: string;
  activityMode: HobbyActivityMode;
  series: HobbySeriesSummary[];
};

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

function previewText(value: string | null | undefined, maxLength = 140): string {
  if (!value) {
    return "No description yet.";
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1)}…`;
}

function sortSeries(items: HobbySeriesSummary[]): HobbySeriesSummary[] {
  return [...items].sort((left, right) => {
    const leftActive = left.status === "active" ? 1 : 0;
    const rightActive = right.status === "active" ? 1 : 0;

    if (leftActive !== rightActive) {
      return rightActive - leftActive;
    }

    const leftTime = left.lastSessionDate ? Date.parse(left.lastSessionDate) : 0;
    const rightTime = right.lastSessionDate ? Date.parse(right.lastSessionDate) : 0;

    if (leftTime !== rightTime) {
      return rightTime - leftTime;
    }

    return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
  });
}

export function HobbySeriesList({ hobbyId, activityMode, series }: HobbySeriesListProps): JSX.Element {
  const { formatDate } = useFormattedDate();
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "completed" | "archived">("all");

  const activeCount = useMemo(
    () => series.filter((item) => item.status === "active").length,
    [series],
  );

  return (
    <SectionFilterProvider
      items={series}
      keys={["name", "description", "bestBatchSessionName"]}
      placeholder="Filter series by name, description, or best batch"
    >
      <section className="panel">
        <div className="panel__header">
          <div className="hobby-series-panel-heading">
            <h2>Series</h2>
            {activityMode === "session" ? (
              <p className="hobby-series-panel-heading__copy">
                Track recipe lineages, compare batches, and keep shared lessons attached to the series instead of a single session.
              </p>
            ) : null}
          </div>
          <div className="panel__header-actions hobby-series-panel-actions">
            <label className="field hobby-series-panel-actions__status">
              <span>Status</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <SectionFilterToggle />
            <Link href={`/hobbies/${hobbyId}/series/new`} className="button button--primary button--sm">
              New Series
            </Link>
          </div>
        </div>

        <SectionFilterBar />

        <div className="panel__body--padded">
          <div className="hobby-series-summary-row">
            <span className="pill pill--success">{activeCount} active</span>
            <span className="pill">{series.length} total</span>
          </div>

          <SectionFilterChildren<HobbySeriesSummary>>
            {(filteredSeries) => {
              const visibleSeries = sortSeries(
                filteredSeries.filter((item) => statusFilter === "all" || item.status === statusFilter),
              );

              return (
                <>
                  {series.length === 0 ? (
                    <p className="panel__empty">
                      No series yet. Create one to group repeat batches, tasting lessons, or iterative recipe changes.
                    </p>
                  ) : null}

                  {series.length > 0 && visibleSeries.length === 0 ? (
                    <p className="panel__empty">No series match the current filters.</p>
                  ) : null}

                  {visibleSeries.length > 0 ? (
                    <div className="hobby-series-grid">
                      {visibleSeries.map((item) => (
                        <div key={item.id} className="hobby-series-card">
                          <Link href={`/hobbies/${hobbyId}/series/${item.id}`} className="hobby-series-card__inner">
                            <div className="hobby-series-card__media">
                              {item.coverImageUrl ? (
                                <img src={item.coverImageUrl} alt="" className="hobby-series-card__image" />
                              ) : (
                                <div className="hobby-series-card__placeholder">Series</div>
                              )}
                            </div>
                            <div className="hobby-series-card__content">
                              <div className="hobby-series-card__topline">
                                <strong>{item.name}</strong>
                                <span className={statusBadgeClass(item.status)}>{item.status}</span>
                              </div>

                              <p className="hobby-series-card__description">{previewText(item.description)}</p>

                              <div className="hobby-series-card__stats">
                                <span>{item.batchCount} batches</span>
                                <span>Recent {formatDate(item.lastSessionDate)}</span>
                              </div>

                              {item.bestBatchSessionName ? (
                                <p className="hobby-series-card__best">Best batch: {item.bestBatchSessionName}</p>
                              ) : null}

                              {item.tags.length > 0 ? (
                                <div className="hobby-series-card__tags">
                                  {item.tags.slice(0, 5).map((tag) => (
                                    <span key={tag} className="pill pill--muted">{tag}</span>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          </Link>
                          {item.batchCount > 1 ? (
                            <div className="hobby-series-card__actions">
                              <Link href={`/hobbies/${hobbyId}/series/${item.id}`} className="button button--ghost button--sm">
                                Compare batches →
                              </Link>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </>
              );
            }}
          </SectionFilterChildren>
        </div>
      </section>
    </SectionFilterProvider>
  );
}