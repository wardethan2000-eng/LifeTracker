"use client";

import type { AssetCategory } from "@aegis/types";
import { assetCategoryValues } from "@aegis/types";
import type { JSX } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { formatCategoryLabel } from "../lib/formatters";

type AssetListFiltersProps = {
  currentSearch: string;
  currentCategory: string;
  includeArchived: boolean;
  householdId: string;
};

const CATEGORY_OPTIONS = assetCategoryValues.map((v) => ({
  value: v,
  label: formatCategoryLabel(v as AssetCategory)
}));

export function AssetListFilters({
  currentSearch,
  currentCategory,
  includeArchived,
  householdId
}: AssetListFiltersProps): JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(currentSearch);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buildUrl = useCallback(
    (overrides: Record<string, string | undefined>) => {
      const params = new URLSearchParams();
      params.set("householdId", householdId);

      const merged = {
        search: searchInput,
        category: currentCategory,
        includeArchived: includeArchived ? "true" : undefined,
        ...overrides
      };

      if (merged.search) params.set("search", merged.search);
      if (merged.category) params.set("category", merged.category);
      if (merged.includeArchived) params.set("includeArchived", "true");

      return `${pathname}?${params.toString()}`;
    },
    [searchInput, currentCategory, includeArchived, householdId, pathname]
  );

  useEffect(() => {
    if (searchInput === currentSearch) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      router.replace(buildUrl({ search: searchInput, offset: undefined }));
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput, currentSearch, buildUrl, router]);

  const hasFilters = currentSearch.length > 0 || currentCategory.length > 0 || includeArchived;

  return (
    <div className="asset-list-filters">
      <label className="field asset-list-filters__search">
        <span className="sr-only">Search assets</span>
        <input
          type="search"
          placeholder="Search by name, make, model, serial…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="asset-list-filters__search-input"
        />
      </label>

      <label className="field asset-list-filters__select">
        <span className="sr-only">Filter by category</span>
        <select
          value={currentCategory}
          onChange={(e) => {
            router.replace(buildUrl({ category: e.target.value || undefined, offset: undefined }));
          }}
        >
          <option value="">All categories</option>
          {CATEGORY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </label>

      <label className="asset-list-filters__checkbox">
        <input
          type="checkbox"
          checked={includeArchived}
          onChange={(e) => {
            router.replace(buildUrl({ includeArchived: e.target.checked ? "true" : undefined, offset: undefined }));
          }}
        />
        <span>Include archived</span>
      </label>

      {hasFilters ? (
        <a
          href={`${pathname}?householdId=${householdId}`}
          className="button button--ghost button--sm"
        >
          Clear filters
        </a>
      ) : null}
    </div>
  );
}
