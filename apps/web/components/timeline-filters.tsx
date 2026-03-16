"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { JSX } from "react";
import { useCallback, useEffect, useState } from "react";

type TimelineFiltersProps = {
  assetId: string;
  currentFilters: {
    sourceType?: string;
    category?: string;
    search?: string;
    since?: string;
    until?: string;
  };
  onAddEntry?: () => void;
};

const sourceOptions = [
  { label: "All Sources", value: "" },
  { label: "Maintenance", value: "maintenance_log" },
  { label: "Manual Entries", value: "timeline_entry" },
  { label: "Projects", value: "project_event" },
  { label: "Inventory", value: "inventory_transaction" },
  { label: "Schedule Changes", value: "schedule_change" },
  { label: "Comments", value: "comment" },
  { label: "Condition", value: "condition_assessment" },
  { label: "Usage", value: "usage_reading" }
];

const categoryOptions = [
  { label: "All Categories", value: "" },
  { label: "note", value: "note" },
  { label: "observation", value: "observation" },
  { label: "repair", value: "repair" },
  { label: "inspection", value: "inspection" },
  { label: "purchase", value: "purchase" },
  { label: "incident", value: "incident" },
  { label: "modification", value: "modification" },
  { label: "cleaning", value: "cleaning" },
  { label: "seasonal", value: "seasonal" },
  { label: "other", value: "other" }
];

export function TimelineFilters({ assetId, currentFilters, onAddEntry }: TimelineFiltersProps): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchValue, setSearchValue] = useState(currentFilters.search ?? "");

  const pushParams = useCallback((mutate: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString());

    params.set("tab", "history");
    params.delete("cursor");
    mutate(params);

    const query = params.toString();
    router.push(`/assets/${assetId}${query ? `?${query}` : ""}`);
  }, [assetId, router, searchParams]);

  useEffect(() => {
    setSearchValue(currentFilters.search ?? "");
  }, [currentFilters.search]);

  useEffect(() => {
    const currentSearch = searchParams.get("search") ?? "";

    if (searchValue === currentSearch) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      pushParams((params) => {
        const nextValue = searchValue.trim();

        if (nextValue) {
          params.set("search", nextValue);
        } else {
          params.delete("search");
        }
      });
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [pushParams, searchParams, searchValue]);

  const hasActiveFilters = Boolean(
    currentFilters.sourceType
    || currentFilters.category
    || currentFilters.search
    || currentFilters.since
    || currentFilters.until
  );

  return (
    <div className="timeline-controls">
      <div className="timeline-controls__filter">
        <label htmlFor="timeline-source-filter">Source</label>
        <select
          id="timeline-source-filter"
          value={currentFilters.sourceType ?? ""}
          onChange={(event) => {
            const value = event.target.value;
            pushParams((params) => {
              if (value) {
                params.set("sourceType", value);
              } else {
                params.delete("sourceType");
              }
            });
          }}
        >
          {sourceOptions.map((option) => (
            <option key={option.label} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      <div className="timeline-controls__filter">
        <label htmlFor="timeline-category-filter">Category</label>
        <select
          id="timeline-category-filter"
          value={currentFilters.category ?? ""}
          onChange={(event) => {
            const value = event.target.value;
            pushParams((params) => {
              if (value) {
                params.set("category", value);
              } else {
                params.delete("category");
              }
            });
          }}
        >
          {categoryOptions.map((option) => (
            <option key={option.label} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      <div className="timeline-controls__filter">
        <label htmlFor="timeline-since-filter">From</label>
        <input
          id="timeline-since-filter"
          type="date"
          value={currentFilters.since ?? ""}
          onChange={(event) => {
            const value = event.target.value;
            pushParams((params) => {
              if (value) {
                params.set("since", value);
              } else {
                params.delete("since");
              }
            });
          }}
        />
      </div>

      <div className="timeline-controls__filter">
        <label htmlFor="timeline-until-filter">To</label>
        <input
          id="timeline-until-filter"
          type="date"
          value={currentFilters.until ?? ""}
          onChange={(event) => {
            const value = event.target.value;
            pushParams((params) => {
              if (value) {
                params.set("until", value);
              } else {
                params.delete("until");
              }
            });
          }}
        />
      </div>

      <div className="timeline-controls__filter timeline-controls__search">
        <label htmlFor="timeline-search-filter">Search</label>
        <input
          id="timeline-search-filter"
          type="search"
          value={searchValue}
          placeholder="Search timeline..."
          onChange={(event) => setSearchValue(event.target.value)}
        />
      </div>

      <div className="timeline-controls__actions">
        <button
          type="button"
          className="button button--primary button--sm"
          onClick={() => {
            pushParams((params) => {
              params.set("showAddForm", "true");
            });
            onAddEntry?.();
          }}
        >
          + Add Entry
        </button>
        {hasActiveFilters ? (
          <button
            type="button"
            className="text-link"
            onClick={() => router.push(`/assets/${assetId}?tab=history`)}
          >
            Clear Filters
          </button>
        ) : null}
      </div>
    </div>
  );
}