"use client";

import type { SearchResult, SearchResultGroup } from "@lifekeeper/types";
import { useRouter, useSearchParams } from "next/navigation";
import type { JSX, KeyboardEvent as ReactKeyboardEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { searchHousehold } from "../lib/api";

type SearchCommandPaletteProps = {
  fallbackHouseholdId: string | null;
};

const formatEntityType = (group: SearchResultGroup): string => group.label;

const formatDateTime = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
};

const resultMeta = (result: SearchResult): string[] => {
  const parts: string[] = [];

  if (result.parentEntityName) {
    parts.push(result.parentEntityName);
  }

  if (result.entityType === "log") {
    const completedAt = typeof result.entityMeta?.completedAt === "string"
      ? formatDateTime(result.entityMeta.completedAt)
      : null;

    if (completedAt) {
      parts.push(completedAt);
    }
  }

  if (result.entityType === "project") {
    const status = typeof result.entityMeta?.status === "string" ? result.entityMeta.status : result.subtitle;

    if (status) {
      parts.push(status);
    }
  }

  return parts;
};

export function SearchCommandPalette({ fallbackHouseholdId }: SearchCommandPaletteProps): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [groups, setGroups] = useState<SearchResultGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [recentQueries, setRecentQueries] = useState<string[]>([]);
  const [shortcutLabel, setShortcutLabel] = useState("Ctrl K");

  const householdId = searchParams.get("householdId") ?? fallbackHouseholdId;
  const results = useMemo(
    () => groups.flatMap((group) => group.results),
    [groups]
  );

  useEffect(() => {
    if (typeof navigator !== "undefined" && /mac/i.test(navigator.platform)) {
      setShortcutLabel("Cmd K");
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsOpen(true);
      }

      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setDebouncedQuery("");
      setGroups([]);
      setFetchError(null);
      setIsLoading(false);
      setActiveIndex(0);
      return;
    }

    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 225);

    return () => window.clearTimeout(timer);
  }, [isOpen, query]);

  useEffect(() => {
    if (!isOpen || !householdId) {
      return;
    }

    if (!debouncedQuery) {
      setGroups([]);
      setFetchError(null);
      setIsLoading(false);
      setActiveIndex(0);
      return;
    }

    let active = true;
    setIsLoading(true);
    setFetchError(null);

    searchHousehold(householdId, debouncedQuery, { limit: 20 })
      .then((response) => {
        if (!active) {
          return;
        }

        setGroups(response.groups);
        setActiveIndex(0);
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        setGroups([]);
        setFetchError(error instanceof Error ? error.message : "Search failed.");
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [debouncedQuery, householdId, isOpen]);

  useEffect(() => {
    if (results.length === 0) {
      setActiveIndex(0);
      return;
    }

    if (activeIndex >= results.length) {
      setActiveIndex(0);
    }
  }, [activeIndex, results.length]);

  const close = (): void => {
    setIsOpen(false);
  };

  const rememberQuery = (value: string): void => {
    const trimmed = value.trim();

    if (!trimmed) {
      return;
    }

    setRecentQueries((current) => [trimmed, ...current.filter((entry) => entry !== trimmed)].slice(0, 5));
  };

  const selectResult = (result: SearchResult): void => {
    rememberQuery(query || debouncedQuery);
    close();
    router.push(result.entityUrl);
  };

  const handleInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "ArrowDown") {
      event.preventDefault();

      if (results.length > 0) {
        setActiveIndex((current) => (current + 1) % results.length);
      }
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();

      if (results.length > 0) {
        setActiveIndex((current) => (current - 1 + results.length) % results.length);
      }
    }

    if (event.key === "Enter") {
      event.preventDefault();

      if (results[activeIndex]) {
        selectResult(results[activeIndex]);
      }
    }

    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  };

  return (
    <>
      <button
        type="button"
        className="search-trigger"
        onClick={() => setIsOpen(true)}
        disabled={!householdId}
        aria-label="Open search"
      >
        <span className="search-trigger__icon" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        </span>
        <span className="search-trigger__label">Search LifeKeeper</span>
        <span className="search-trigger__hint">{shortcutLabel}</span>
      </button>

      {isOpen ? (
        <div className="search-palette" role="dialog" aria-modal="true" onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            close();
          }
        }}>
          <div className="search-palette__panel">
            <div className="search-palette__header">
              <div className="search-palette__icon" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              </div>
              <input
                ref={inputRef}
                className="search-palette__input"
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="Search assets, schedules, logs, projects, providers, inventory, and comments"
              />
              <button type="button" className="search-palette__close" onClick={close} aria-label="Close search">
                Esc
              </button>
            </div>

            <div className="search-palette__body">
              {!householdId ? (
                <div className="search-palette__empty">Select a household before searching.</div>
              ) : null}

              {householdId && !debouncedQuery ? (
                recentQueries.length > 0 ? (
                  <div className="search-palette__recent">
                    <div className="search-palette__section-title">Recent Searches</div>
                    <div className="search-palette__recent-list">
                      {recentQueries.map((entry) => (
                        <button
                          key={entry}
                          type="button"
                          className="search-palette__recent-item"
                          onClick={() => {
                            setQuery(entry);
                            setDebouncedQuery(entry);
                          }}
                        >
                          {entry}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="search-palette__empty">Start typing to search across the household.</div>
                )
              ) : null}

              {householdId && debouncedQuery && isLoading ? (
                <div className="search-palette__loading">
                  <span className="search-palette__spinner" aria-hidden="true" />
                  Searching...
                </div>
              ) : null}

              {householdId && debouncedQuery && fetchError ? (
                <div className="search-palette__empty">{fetchError}</div>
              ) : null}

              {householdId && debouncedQuery && !isLoading && !fetchError && groups.length === 0 ? (
                <div className="search-palette__empty">No results found.</div>
              ) : null}

              {groups.map((group) => {
                let itemOffset = 0;

                for (const priorGroup of groups) {
                  if (priorGroup.entityType === group.entityType) {
                    break;
                  }

                  itemOffset += priorGroup.results.length;
                }

                return (
                  <section key={group.entityType} className="search-palette__group">
                    <div className="search-palette__section-title">{formatEntityType(group)}</div>
                    <div className="search-palette__results">
                      {group.results.map((result, index) => {
                        const absoluteIndex = itemOffset + index;
                        const metadata = resultMeta(result);

                        return (
                          <button
                            key={`${result.entityType}:${result.entityId}`}
                            type="button"
                            className={`search-palette__result${absoluteIndex === activeIndex ? " search-palette__result--active" : ""}`}
                            onClick={() => selectResult(result)}
                            onMouseEnter={() => setActiveIndex(absoluteIndex)}
                          >
                            <span className="search-palette__result-title">{result.title}</span>
                            {result.subtitle ? (
                              <span className="search-palette__result-subtitle">{result.subtitle}</span>
                            ) : null}
                            {metadata.length > 0 ? (
                              <span className="search-palette__result-meta">{metadata.join(" • ")}</span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}