"use client";

import type { JSX, ReactNode } from "react";
import { useMemo, useState } from "react";

/* ─── Public types ─── */

export type StatusFilterOption = { value: string; label: string };

export type SectionTag = { label: string; variant: "success" | "warning" | "muted" };

export type CategoryAccordionListProps<T> = {
  /** The full set of items — filtering + grouping is applied internally. */
  items: T[];

  /** Return a space-joined string of all searchable fields for an item. */
  getSearchText: (item: T) => string;

  /** Return the category string for an item, or null for uncategorized. */
  getCategory: (item: T) => string | null;

  /** Categories that always appear in the dropdown / accordions even when empty. */
  defaultCategories?: string[];

  searchPlaceholder?: string;
  emptyMessage?: string;
  noMatchMessage?: string;

  /** Optional status / state filter dropdown alongside search. */
  statusFilter?: {
    options: StatusFilterOption[];
    /** Return true when the item matches the given status filter value. */
    getMatch: (item: T, filterValue: string) => boolean;
  };

  /**
   * Render a group of items within one accordion section.
   * Receives the items for that section and the full list of known categories.
   */
  renderItems: (items: T[], allCategories: string[]) => ReactNode;

  /** Per-section summary tags (e.g. "3 purchased", "2 outstanding"). */
  getSectionTags?: (items: T[]) => SectionTag[];

  /** Content rendered above the list (e.g. an add form). */
  header?: ReactNode;

  /** Content rendered below the list (e.g. an add form). */
  footer?: ReactNode;
};

/* ─── Component ─── */

const TAG_CLASS_MAP: Record<SectionTag["variant"], string> = {
  success: "supply-section__tag supply-section__tag--success",
  warning: "supply-section__tag supply-section__tag--warning",
  muted: "supply-section__tag supply-section__tag--muted",
};

export function CategoryAccordionList<T>({
  items,
  getSearchText,
  getCategory,
  defaultCategories = [],
  searchPlaceholder = "Search...",
  emptyMessage = "No items yet.",
  noMatchMessage = "No items match your filters.",
  statusFilter,
  renderItems,
  getSectionTags,
  header,
  footer,
}: CategoryAccordionListProps<T>): JSX.Element {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusValue, setStatusValue] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => new Set());

  /* ── Derived data ── */

  const allCategories = useMemo(() => {
    const fromItems = items
      .map((item) => getCategory(item)?.trim() || null)
      .filter((c): c is string => c !== null);
    return Array.from(new Set([...defaultCategories, ...fromItems])).sort();
  }, [items, getCategory, defaultCategories]);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (searchQuery) {
        if (!getSearchText(item).toLowerCase().includes(searchQuery.toLowerCase())) return false;
      }
      if (statusFilter && statusValue !== "all") {
        if (!statusFilter.getMatch(item, statusValue)) return false;
      }
      if (categoryFilter !== "all") {
        const cat = getCategory(item)?.trim() || null;
        if (categoryFilter === "uncategorized" && cat !== null) return false;
        if (categoryFilter !== "uncategorized" && cat !== categoryFilter) return false;
      }
      return true;
    });
  }, [items, searchQuery, statusFilter, statusValue, categoryFilter, getSearchText, getCategory]);

  const groupedByCategory = useMemo(() => {
    const map = new Map<string | null, T[]>();
    for (const item of filtered) {
      const cat = getCategory(item)?.trim() || null;
      const bucket = map.get(cat) ?? [];
      bucket.push(item);
      map.set(cat, bucket);
    }
    return map;
  }, [filtered, getCategory]);

  const sectionOrder = useMemo((): (string | null)[] => {
    const result: (string | null)[] = [];
    if (groupedByCategory.has(null)) result.push(null);
    for (const cat of allCategories) {
      if (groupedByCategory.has(cat)) result.push(cat);
    }
    return result;
  }, [allCategories, groupedByCategory]);

  const hasActiveFilter = searchQuery.length > 0 || statusValue !== "all" || categoryFilter !== "all";
  const hasManyCategories = sectionOrder.length > 1;

  /* ── Handlers ── */

  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const clearFilters = () => {
    setSearchQuery("");
    setStatusValue("all");
    setCategoryFilter("all");
  };

  /* ── Render ── */

  return (
    <div className="category-accordion">
      {/* Search + filters */}
      <div className="supply-search-bar">
        <input
          type="search"
          className="supply-search-bar__input"
          placeholder={searchPlaceholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.currentTarget.value)}
        />
        {statusFilter ? (
          <select
            value={statusValue}
            onChange={(e) => setStatusValue(e.currentTarget.value)}
            style={{ fontSize: "0.86rem" }}
          >
            <option value="all">All statuses</option>
            {statusFilter.options.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        ) : null}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.currentTarget.value)}
          style={{ fontSize: "0.86rem" }}
        >
          <option value="all">All categories</option>
          <option value="uncategorized">Uncategorized</option>
          {allCategories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        {hasActiveFilter ? (
          <button type="button" className="button button--ghost button--xs" onClick={clearFilters}>
            Clear
          </button>
        ) : null}
      </div>

      {header}

      {/* Empty / no-match states */}
      {items.length === 0 ? (
        <p className="panel__empty">{emptyMessage}</p>
      ) : filtered.length === 0 ? (
        <p style={{ padding: "8px 0", color: "var(--ink-muted)", fontSize: "0.88rem" }}>{noMatchMessage}</p>
      ) : null}

      {/* Expand/Collapse controls */}
      {hasManyCategories && filtered.length > 0 ? (
        <div className="supply-section-controls">
          <button type="button" className="button button--ghost button--xs" onClick={() => setCollapsedSections(new Set())}>Expand all</button>
          <button type="button" className="button button--ghost button--xs" onClick={() => setCollapsedSections(new Set(sectionOrder.map((c) => c ?? "__uncategorized")))}>Collapse all</button>
          <span className="supply-section-controls__count">{filtered.length} item{filtered.length !== 1 ? "s" : ""}</span>
        </div>
      ) : null}

      {/* Category accordion sections */}
      {sectionOrder.map((category) => {
        const key = category ?? "__uncategorized";
        const sectionItems = groupedByCategory.get(category) ?? [];
        if (sectionItems.length === 0) return null;

        const isCollapsed = collapsedSections.has(key) && !hasActiveFilter;
        const tags = getSectionTags?.(sectionItems) ?? [];

        return (
          <section key={key} className="supply-section">
            <button
              type="button"
              className="supply-section__header"
              onClick={() => toggleSection(key)}
              aria-expanded={!isCollapsed}
            >
              <span className="supply-section__chevron">{isCollapsed ? "\u25B8" : "\u25BE"}</span>
              <h3 className="supply-section__title">{category ?? "Uncategorized"}</h3>
              <span className="pill pill--sm pill--muted">{sectionItems.length}</span>
              {tags.length > 0 ? (
                <span className="supply-section__meta">
                  {tags.map((tag) => (
                    <span key={tag.label} className={TAG_CLASS_MAP[tag.variant]}>{tag.label}</span>
                  ))}
                </span>
              ) : null}
            </button>
            {!isCollapsed ? (
              <div className="supply-section__body">
                {renderItems(sectionItems, allCategories)}
              </div>
            ) : null}
          </section>
        );
      })}

      {footer}
    </div>
  );
}
