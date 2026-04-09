"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { JSX } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

type InventoryFilterBarProps = {
  currentFilter: "all" | "consumable" | "equipment" | "expiring";
  categoryOptions?: string[];
};

export function InventoryFilterBar({ currentFilter, categoryOptions = [] }: InventoryFilterBarProps): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentSearch = searchParams.get("search") ?? "";
  const currentCategory = searchParams.get("category") ?? "";
  const currentSort = searchParams.get("sort") ?? "";
  const [searchValue, setSearchValue] = useState(currentSearch);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pushParams = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }
    router.push(`/inventory?${params.toString()}`);
  }, [router, searchParams]);

  const setFilter = useCallback((value: "all" | "consumable" | "equipment" | "expiring") => {
    if (value === "expiring") {
      pushParams({ itemType: null, expiring: "1" });
    } else {
      pushParams({ itemType: value === "all" ? null : value, expiring: null });
    }
  }, [pushParams]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (searchValue !== currentSearch) {
        pushParams({ search: searchValue || null });
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchValue, currentSearch, pushParams]);

  return (
    <div className="inventory-filter-bar">
      <div className="inventory-filter-bar__tabs">
        <button
          type="button"
          className={`inventory-filter-bar__tab${currentFilter === "all" ? " inventory-filter-bar__tab--active" : ""}`}
          onClick={() => setFilter("all")}
        >
          All
        </button>
        <button
          type="button"
          className={`inventory-filter-bar__tab${currentFilter === "consumable" ? " inventory-filter-bar__tab--active" : ""}`}
          onClick={() => setFilter("consumable")}
        >
          Consumables
        </button>
        <button
          type="button"
          className={`inventory-filter-bar__tab${currentFilter === "equipment" ? " inventory-filter-bar__tab--active" : ""}`}
          onClick={() => setFilter("equipment")}
        >
          Equipment
        </button>
        <button
          type="button"
          className={`inventory-filter-bar__tab${currentFilter === "expiring" ? " inventory-filter-bar__tab--active" : ""}`}
          onClick={() => setFilter("expiring")}
        >
          Expiring
        </button>
      </div>

      <input
        type="search"
        className="inventory-filter-bar__search"
        placeholder="Search items…"
        value={searchValue}
        onChange={(e) => setSearchValue(e.target.value)}
      />

      {categoryOptions.length > 0 && (
        <select
          className="inventory-filter-bar__select"
          value={currentCategory}
          onChange={(e) => pushParams({ category: e.target.value || null })}
        >
          <option value="">All Categories</option>
          {categoryOptions.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      )}

      <select
        className="inventory-filter-bar__select"
        value={currentSort}
        onChange={(e) => pushParams({ sort: e.target.value || null })}
      >
        <option value="">Sort: Default</option>
        <option value="name-asc">Name A–Z</option>
        <option value="name-desc">Name Z–A</option>
        <option value="qty-asc">Qty: Low → High</option>
        <option value="qty-desc">Qty: High → Low</option>
        <option value="updated-desc">Recently Updated</option>
      </select>
    </div>
  );
}
