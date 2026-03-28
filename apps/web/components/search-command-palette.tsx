"use client";

import type { SearchEntityType, SearchResult, SearchResultGroup } from "@lifekeeper/types";
import { useRouter, useSearchParams } from "next/navigation";
import type { JSX, KeyboardEvent as ReactKeyboardEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getHouseholdSpaces, searchHousehold } from "../lib/api";
import { useTimezone } from "../lib/timezone-context";
import { getSpaceTypeBadge, getSpaceTypeLabel } from "../lib/spaces";

type SearchCommandPaletteProps = {
  fallbackHouseholdId: string | null;
};

type SearchFilter = "all" | "items" | "spaces" | "historical";

type QuickAction = {
  id: string;
  label: string;
  description: string;
  href: string;
};

const QUICK_ACTIONS: QuickAction[] = [
  { id: "new-asset", label: "New Asset", description: "Track a new appliance, vehicle, or other asset", href: "/assets/new" },
  { id: "new-project", label: "New Project", description: "Start a new home improvement or maintenance project", href: "/projects/new" },
  { id: "new-hobby", label: "New Hobby", description: "Track a new hobby or activity", href: "/hobbies/new" },
  { id: "new-idea", label: "New Idea", description: "Capture a new idea for later", href: "/ideas/new" },
  { id: "new-inventory", label: "New Inventory Item", description: "Add a new item to your inventory", href: "/inventory/items/new" },
];

type NavCommand = {
  id: string;
  label: string;
  href: string;
};

const NAVIGATION_COMMANDS: NavCommand[] = [
  { id: "nav-dashboard", label: "Dashboard", href: "/" },
  { id: "nav-assets", label: "Assets", href: "/assets" },
  { id: "nav-maintenance", label: "Maintenance", href: "/maintenance" },
  { id: "nav-projects", label: "Projects", href: "/projects" },
  { id: "nav-hobbies", label: "Hobbies", href: "/hobbies" },
  { id: "nav-inventory", label: "Inventory", href: "/inventory" },
  { id: "nav-ideas", label: "Ideas", href: "/ideas" },
  { id: "nav-notes", label: "Notes", href: "/notes" },
  { id: "nav-analytics", label: "Analytics", href: "/analytics" },
  { id: "nav-providers", label: "Service Providers", href: "/service-providers" },
  { id: "nav-activity", label: "Activity Log", href: "/activity" },
  { id: "nav-settings", label: "User Settings", href: "/settings" },
];

const FILTER_OPTIONS: Array<{ value: SearchFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "items", label: "Items" },
  { value: "spaces", label: "Spaces" },
  { value: "historical", label: "Historical" }
];

const formatEntityType = (group: SearchResultGroup): string => group.label;

const formatDateTime = (value: string | null | undefined, timeZone?: string): string | null => {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone,
  }).format(date);
};

const getSearchOptionsForFilter = (filter: SearchFilter): {
  include?: SearchEntityType[];
  includeHistory: boolean;
} => {
  switch (filter) {
    case "items":
      return { include: ["inventory_item"], includeHistory: false };
    case "spaces":
      return { include: ["space"], includeHistory: false };
    case "historical":
      return { include: ["inventory_item"], includeHistory: true };
    default:
      return { includeHistory: true };
  }
};

const resultMeta = (result: SearchResult, timezone?: string): string[] => {
  const parts: string[] = [];

  if (result.entityType === "space") {
    const type = typeof result.entityMeta?.type === "string" ? result.entityMeta.type : null;
    if (type) {
      parts.push(getSpaceTypeLabel(type as Parameters<typeof getSpaceTypeLabel>[0]));
    }
    return parts;
  }

  if (result.entityType === "historical_inventory_item") {
    const removedAt = typeof result.entityMeta?.removedAt === "string"
      ? formatDateTime(result.entityMeta.removedAt, timezone)
      : null;

    if (removedAt) {
      parts.push(`Removed ${removedAt}`);
    }

    return parts;
  }

  if (result.parentEntityName) {
    parts.push(result.parentEntityName);
  }

  if (result.entityType === "asset") {
    const spaceName = typeof result.entityMeta?.spaceName === "string" ? result.entityMeta.spaceName : null;
    if (spaceName) {
      parts.push(`📍 ${spaceName}`);
    }
  }

  if (result.entityType === "log") {
    const completedAt = typeof result.entityMeta?.completedAt === "string"
      ? formatDateTime(result.entityMeta.completedAt, timezone)
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

const resultSecondaryLine = (result: SearchResult, timezone?: string): string | null => {
  if (result.entityType === "space") {
    const breadcrumb = typeof result.entityMeta?.breadcrumb === "string" ? result.entityMeta.breadcrumb : null;
    return breadcrumb;
  }

  if (result.entityType === "historical_inventory_item") {
    const breadcrumb = typeof result.entityMeta?.lastSpaceBreadcrumb === "string"
      ? result.entityMeta.lastSpaceBreadcrumb
      : null;
    const removedAt = typeof result.entityMeta?.removedAt === "string"
      ? formatDateTime(result.entityMeta.removedAt, timezone)
      : null;

    if (breadcrumb && removedAt) {
      return `was in ${breadcrumb} — removed ${removedAt}`;
    }

    if (breadcrumb) {
      return `was in ${breadcrumb}`;
    }

    return removedAt ? `removed ${removedAt}` : null;
  }

  return result.subtitle;
};

export function SearchCommandPalette({ fallbackHouseholdId }: SearchCommandPaletteProps): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { timezone } = useTimezone();
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
  const [filter, setFilter] = useState<SearchFilter>("all");

  const householdId = searchParams.get("householdId") ?? fallbackHouseholdId;
  const normalizedCodeQuery = query.trim().toUpperCase();
  const trimmedQuery = query.trim().toLowerCase();
  const isGoCommand = trimmedQuery.startsWith("go ");
  const isCreateCommand = trimmedQuery.startsWith("create ");
  const canLookupSpaceCode = Boolean(householdId) && /^[A-Z0-9]{4,6}$/.test(normalizedCodeQuery);
  const matchedQuickActions = useMemo(() => {
    if (!householdId) return [];
    if (isGoCommand) return [];
    if (!trimmedQuery || isCreateCommand) return QUICK_ACTIONS;
    const q = isCreateCommand ? trimmedQuery.slice(7).trim() : trimmedQuery;
    return QUICK_ACTIONS.filter((a) =>
      a.label.toLowerCase().includes(q) || a.description.toLowerCase().includes(q)
    );
  }, [householdId, trimmedQuery, isGoCommand, isCreateCommand]);
  const matchedNavCommands = useMemo(() => {
    if (!householdId) return [];
    if (!trimmedQuery || isGoCommand) {
      const navQ = isGoCommand ? trimmedQuery.slice(3).trim() : "";
      if (!navQ) return NAVIGATION_COMMANDS;
      return NAVIGATION_COMMANDS.filter((n) => n.label.toLowerCase().includes(navQ));
    }
    return [];
  }, [householdId, trimmedQuery, isGoCommand]);
  const spaceCodeActionCount = canLookupSpaceCode ? 1 : 0;
  const navCommandCount = matchedNavCommands.length;
  const quickActionCount = (!debouncedQuery || matchedQuickActions.length > 0) ? matchedQuickActions.length : 0;
  const actionCount = spaceCodeActionCount + navCommandCount + quickActionCount;
  const visibleGroups = useMemo(() => groups.filter((group) => {
    if (filter === "historical") {
      return group.entityType === "historical_inventory_item";
    }

    return true;
  }), [filter, groups]);
  const results = useMemo(
    () => visibleGroups.flatMap((group) => group.results),
    [visibleGroups]
  );
  const totalItems = actionCount + results.length;

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
      setFilter("all");
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

    const searchOptions = getSearchOptionsForFilter(filter);

    searchHousehold(householdId, debouncedQuery, {
      limit: 20,
      includeHistory: searchOptions.includeHistory,
      fuzzy: true,
      ...(searchOptions.include ? { include: searchOptions.include } : {})
    })
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
  }, [debouncedQuery, filter, householdId, isOpen]);

  useEffect(() => {
    if (totalItems === 0) {
      setActiveIndex(0);
      return;
    }

    if (activeIndex >= totalItems) {
      setActiveIndex(0);
    }
  }, [activeIndex, totalItems]);

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

  const handleSpaceCodeLookup = async (): Promise<void> => {
    if (!householdId) {
      return;
    }

    try {
      setFetchError(null);
      const response = await getHouseholdSpaces(householdId, { search: normalizedCodeQuery, limit: 12 });
      const exactMatches = response.items.filter((space) => space.shortCode === normalizedCodeQuery);
      const [exactMatch] = exactMatches;
      const [onlyMatch] = response.items;

      if (exactMatch) {
        rememberQuery(query || debouncedQuery);
        close();
        router.push(`/inventory/spaces/${exactMatch.id}?householdId=${householdId}`);
        return;
      }

      if (onlyMatch && response.items.length === 1) {
        rememberQuery(query || debouncedQuery);
        close();
        router.push(`/inventory/spaces/${onlyMatch.id}?householdId=${householdId}`);
        return;
      }

      setFetchError(response.items.length === 0 ? "No spaces matched that code." : "Multiple spaces matched that code. Use the Spaces group to choose one.");
    } catch (error) {
      setFetchError(error instanceof Error ? error.message : "Space lookup failed.");
    }
  };

  const handleInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "ArrowDown") {
      event.preventDefault();

      if (totalItems > 0) {
        setActiveIndex((current) => (current + 1) % totalItems);
      }
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();

      if (totalItems > 0) {
        setActiveIndex((current) => (current - 1 + totalItems) % totalItems);
      }
    }

    if (event.key === "Enter") {
      event.preventDefault();

      if (canLookupSpaceCode && activeIndex === 0) {
        void handleSpaceCodeLookup();
        return;
      }

      const navCommandIndex = activeIndex - spaceCodeActionCount;
      if (navCommandIndex >= 0 && navCommandIndex < navCommandCount) {
        const navCmd = matchedNavCommands[navCommandIndex];
        if (navCmd) {
          close();
          router.push(navCmd.href);
          return;
        }
      }

      const quickActionIndex = activeIndex - spaceCodeActionCount - navCommandCount;
      if (quickActionIndex >= 0 && quickActionIndex < quickActionCount) {
        const action = matchedQuickActions[quickActionIndex];
        if (action) {
          close();
          router.push(action.href);
          return;
        }
      }

      const resultIndex = activeIndex - actionCount;

      if (resultIndex >= 0 && results[resultIndex]) {
        selectResult(results[resultIndex]);
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
                placeholder="Search items, spaces, maintenance, projects, and historical records"
              />
              <button type="button" className="search-palette__close" onClick={close} aria-label="Close search">
                Esc
              </button>
            </div>

            <div className="search-palette__body">
              {!householdId ? (
                <div className="search-palette__empty">Select a household before searching.</div>
              ) : null}

              {householdId ? (
                <div className="search-palette__filters" role="tablist" aria-label="Search filters">
                  {FILTER_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`search-palette__filter-chip${filter === option.value ? " search-palette__filter-chip--active" : ""}`}
                      onClick={() => {
                        setFilter(option.value);
                        setActiveIndex(0);
                      }}
                      role="tab"
                      aria-selected={filter === option.value}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
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
                ) : null
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

              {canLookupSpaceCode ? (
                <section className="search-palette__group">
                  <div className="search-palette__section-title">Quick Actions</div>
                  <div className="search-palette__results">
                    <button
                      type="button"
                      className={`search-palette__result${activeIndex === 0 ? " search-palette__result--active" : ""}`}
                      onClick={() => {
                        void handleSpaceCodeLookup();
                      }}
                      onMouseEnter={() => setActiveIndex(0)}
                    >
                      <span className="search-palette__result-heading">
                        <span className="search-palette__result-title">Look up Space Code</span>
                        <span className="search-palette__result-chip">{normalizedCodeQuery}</span>
                      </span>
                      <span className="search-palette__result-subtitle">Jump directly to the matching space code.</span>
                    </button>
                  </div>
                </section>
              ) : null}

              {navCommandCount > 0 ? (
                <section className="search-palette__group">
                  <div className="search-palette__section-title">Pages</div>
                  <div className="search-palette__results">
                    {matchedNavCommands.map((cmd, index) => {
                      const absoluteIndex = spaceCodeActionCount + index;
                      return (
                        <button
                          key={cmd.id}
                          type="button"
                          className={`search-palette__result${activeIndex === absoluteIndex ? " search-palette__result--active" : ""}`}
                          onClick={() => {
                            close();
                            router.push(cmd.href);
                          }}
                          onMouseEnter={() => setActiveIndex(absoluteIndex)}
                        >
                          <span className="search-palette__result-heading">
                            <span className="search-palette__result-title">{cmd.label}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ) : null}

              {quickActionCount > 0 ? (
                <section className="search-palette__group">
                  <div className="search-palette__section-title">Create</div>
                  <div className="search-palette__results">
                    {matchedQuickActions.map((action, index) => {
                      const absoluteIndex = spaceCodeActionCount + navCommandCount + index;
                      return (
                        <button
                          key={action.id}
                          type="button"
                          className={`search-palette__result${activeIndex === absoluteIndex ? " search-palette__result--active" : ""}`}
                          onClick={() => {
                            close();
                            router.push(action.href);
                          }}
                          onMouseEnter={() => setActiveIndex(absoluteIndex)}
                        >
                          <span className="search-palette__result-heading">
                            <span className="search-palette__result-title">{action.label}</span>
                          </span>
                          <span className="search-palette__result-subtitle">{action.description}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ) : null}

              {householdId && debouncedQuery && !isLoading && !fetchError && visibleGroups.length === 0 && actionCount === 0 ? (
                <div className="search-palette__empty">No results found.</div>
              ) : null}

              {visibleGroups.map((group) => {
                let itemOffset = 0;

                for (const priorGroup of visibleGroups) {
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
                        const metadata = resultMeta(result, timezone);
                        const secondaryLine = resultSecondaryLine(result, timezone);
                        const isActive = absoluteIndex + actionCount === activeIndex;
                        const isHistorical = result.entityType === "historical_inventory_item";
                        const spaceType = typeof result.entityMeta?.type === "string"
                          ? result.entityMeta.type
                          : null;
                        const spaceShortCode = typeof result.entityMeta?.shortCode === "string"
                          ? result.entityMeta.shortCode
                          : result.entityType === "space"
                            ? result.subtitle
                            : null;

                        return (
                          <button
                            key={`${result.entityType}:${result.entityId}`}
                            type="button"
                            className={`search-palette__result${isActive ? " search-palette__result--active" : ""}${isHistorical ? " search-palette__result--historical" : ""}`}
                            onClick={() => selectResult(result)}
                            onMouseEnter={() => setActiveIndex(absoluteIndex + actionCount)}
                          >
                            <span className="search-palette__result-heading">
                              {result.entityType === "space" && spaceType ? (
                                <span className="search-palette__result-icon">{getSpaceTypeBadge(spaceType as Parameters<typeof getSpaceTypeBadge>[0])}</span>
                              ) : null}
                              <span className="search-palette__result-title">{result.title}</span>
                              {result.entityType === "space" && spaceShortCode ? (
                                <span className="search-palette__result-chip">{spaceShortCode}</span>
                              ) : null}
                              {isHistorical ? (
                                <span className="pill pill--success">Historical</span>
                              ) : null}
                            </span>
                            {secondaryLine ? (
                              <span className="search-palette__result-subtitle">{secondaryLine}</span>
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