import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigationMocks = vi.hoisted(() => ({
  push: vi.fn()
}));

const apiMocks = vi.hoisted(() => ({
  getHouseholdSpaces: vi.fn(),
  searchHousehold: vi.fn()
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: navigationMocks.push
  }),
  useSearchParams: () => new URLSearchParams("householdId=clkeeperhouse000000000001")
}));

vi.mock("../lib/api", async (importOriginal) => {
  return {
    getHouseholdSpaces: apiMocks.getHouseholdSpaces,
    searchHousehold: apiMocks.searchHousehold
  };
});

import { SearchCommandPalette } from "./search-command-palette";

describe("SearchCommandPalette", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.searchHousehold.mockResolvedValue({
      query: "garage",
      groups: [{
        entityType: "space",
        label: "Spaces",
        results: [{
          entityType: "space",
          entityId: "clkeeperspace000000000001",
          title: "Garage Shelf",
          subtitle: "A3K7",
          entityUrl: "/inventory/spaces/clkeeperspace000000000001?householdId=clkeeperhouse000000000001",
          parentEntityName: null,
          entityMeta: {
            type: "shelf",
            shortCode: "A3K7",
            breadcrumb: "Garage / Shelf"
          }
        }]
      }]
    });
  });

  it("requests space-only fuzzy search when the Spaces filter is selected", async () => {
    render(<SearchCommandPalette fallbackHouseholdId={null} />);

    fireEvent.click(screen.getByRole("button", { name: /open search/i }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "garage" } });

    await new Promise((resolve) => window.setTimeout(resolve, 300));

    await waitFor(() => {
      expect(apiMocks.searchHousehold).toHaveBeenCalledWith(
        "clkeeperhouse000000000001",
        "garage",
        {
          limit: 20,
          includeHistory: true,
          fuzzy: true
        }
      );
    });

    fireEvent.click(screen.getByRole("tab", { name: "Spaces" }));

    await waitFor(() => {
      expect(apiMocks.searchHousehold).toHaveBeenLastCalledWith(
        "clkeeperhouse000000000001",
        "garage",
        {
          limit: 20,
          include: ["space"],
          includeHistory: false,
          fuzzy: true
        }
      );
    });

    expect(screen.getByText("Garage Shelf")).toBeInTheDocument();
    expect(screen.getByText("A3K7")).toBeInTheDocument();
    expect(screen.getByText("Garage / Shelf")).toBeInTheDocument();
  });

  it("shows only historical results when the Historical filter is selected", async () => {
    apiMocks.searchHousehold.mockResolvedValue({
      query: "filter",
      groups: [
        {
          entityType: "inventory_item",
          label: "Inventory Items",
          results: [{
            entityType: "inventory_item",
            entityId: "clkeeperitem0000000000001",
            title: "Current Filter",
            subtitle: "In stock",
            entityUrl: "/inventory/clkeeperitem0000000000001?householdId=clkeeperhouse000000000001",
            parentEntityName: null,
            entityMeta: null
          }]
        },
        {
          entityType: "historical_inventory_item",
          label: "Historical",
          results: [{
            entityType: "historical_inventory_item",
            entityId: "clkeeperitem0000000000002",
            title: "Old Filter",
            subtitle: "Was in Garage Shelf",
            entityUrl: "/inventory/spaces/clkeeperspace000000000001?householdId=clkeeperhouse000000000001&tab=history",
            parentEntityName: null,
            entityMeta: {
              removedAt: "2026-03-18T10:00:00.000Z",
              lastSpaceBreadcrumb: "Garage Shelf"
            }
          }]
        }
      ]
    });

    render(<SearchCommandPalette fallbackHouseholdId={null} />);

    fireEvent.click(screen.getByRole("button", { name: /open search/i }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "filter" } });

    await new Promise((resolve) => window.setTimeout(resolve, 300));

    await waitFor(() => {
      expect(apiMocks.searchHousehold).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("tab", { name: "Historical" }));

    await waitFor(() => {
      expect(apiMocks.searchHousehold).toHaveBeenLastCalledWith(
        "clkeeperhouse000000000001",
        "filter",
        {
          limit: 20,
          include: ["inventory_item"],
          includeHistory: true,
          fuzzy: true
        }
      );
    });

    expect(screen.getByText("Old Filter")).toBeInTheDocument();
    expect(screen.getByText(/was in Garage Shelf/i)).toBeInTheDocument();
    expect(screen.queryByText("Current Filter")).not.toBeInTheDocument();
  });
});