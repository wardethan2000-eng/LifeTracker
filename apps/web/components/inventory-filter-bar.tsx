"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { JSX } from "react";
import { useCallback } from "react";

type InventoryFilterBarProps = {
  currentFilter: "all" | "consumable" | "equipment";
};

export function InventoryFilterBar({ currentFilter }: InventoryFilterBarProps): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();

  const setFilter = useCallback((value: "all" | "consumable" | "equipment") => {
    const params = new URLSearchParams(searchParams.toString());

    if (value === "all") {
      params.delete("itemType");
    } else {
      params.set("itemType", value);
    }

    const query = params.toString();
    router.push(`/inventory${query ? `?${query}` : ""}`);
  }, [router, searchParams]);

  return (
    <div className="inventory-filter-bar">
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
    </div>
  );
}
