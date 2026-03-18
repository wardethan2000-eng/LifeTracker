import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  getHouseholdInventory: vi.fn(),
  getHouseholdSpacesTree: vi.fn(),
  getMe: vi.fn(),
  getSpace: vi.fn(),
  getSpaceHistory: vi.fn()
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => <a href={href} {...props}>{children}</a>
}));

vi.mock("../../../../../components/space-detail-actions", () => ({
  SpaceDetailActions: () => <div>Space Detail Actions</div>
}));

vi.mock("../../../../../components/space-quick-place", () => ({
  SpaceQuickPlace: () => <div>Quick Place</div>
}));

vi.mock("../../../../../lib/api", () => ({
  ApiError: class ApiError extends Error {},
  getHouseholdInventory: apiMocks.getHouseholdInventory,
  getHouseholdSpacesTree: apiMocks.getHouseholdSpacesTree,
  getMe: apiMocks.getMe,
  getSpace: apiMocks.getSpace,
  getSpaceHistory: apiMocks.getSpaceHistory
}));

import SpaceDetailPage from "./page";

const householdId = "clkeeperhouse000000000001";
const spaceId = "clkeeperspace000000000001";

describe("SpaceDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.getMe.mockResolvedValue({
      households: [{
        id: householdId,
        name: "Home"
      }]
    });
    apiMocks.getHouseholdSpacesTree.mockResolvedValue([]);
    apiMocks.getHouseholdInventory.mockResolvedValue({ items: [] });
    apiMocks.getSpace.mockResolvedValue({
      id: spaceId,
      householdId,
      name: "Garage Shelf",
      type: "shelf",
      shortCode: "A3K7",
      scanTag: "sp_TESTSPACE01",
      description: "Storage for filters",
      notes: null,
      breadcrumb: [{ id: spaceId, name: "Garage Shelf", type: "shelf" }],
      spaceItems: [],
      generalItems: [],
      children: []
    });
    apiMocks.getSpaceHistory.mockResolvedValue({
      items: [{
        id: "clkeeperhistory00000000001",
        spaceId,
        inventoryItemId: "clkeeperitem0000000000001",
        generalItemName: null,
        householdId,
        action: "removed",
        quantity: 2,
        previousQuantity: null,
        performedBy: "clkeeperuser0000000000001",
        notes: "Moved to workbench",
        createdAt: "2026-03-18T10:00:00.000Z",
        itemName: "Oil Filter",
        itemDeleted: false,
        entityUrl: "/inventory/clkeeperitem0000000000001?householdId=clkeeperhouse000000000001",
        actor: {
          id: "clkeeperuser0000000000001",
          displayName: "Casey"
        },
        space: {
          id: spaceId,
          name: "Garage Shelf",
          type: "shelf",
          shortCode: "A3K7",
          breadcrumb: [{ id: spaceId, name: "Garage Shelf", type: "shelf" }]
        }
      }],
      nextCursor: "clkeeperhistory00000000002"
    });
  });

  it("requests filtered history and renders the history timeline with pagination", async () => {
    const view = await SpaceDetailPage({
      params: Promise.resolve({ spaceId }),
      searchParams: Promise.resolve({
        householdId,
        tab: "history",
        historyAction: "removed",
        historySince: "2026-03-01",
        historyUntil: "2026-03-31",
        historyCursor: "clkeeperhistory00000000000"
      })
    });

    render(view);

    const expectedSince = new Date("2026-03-01T00:00:00").toISOString();
    const expectedUntil = new Date("2026-03-31T23:59:59").toISOString();

    expect(apiMocks.getSpaceHistory).toHaveBeenCalledWith(householdId, spaceId, {
      actions: ["removed"],
      since: expectedSince,
      until: expectedUntil,
      cursor: "clkeeperhistory00000000000",
      limit: 25
    });
    expect(screen.getByRole("heading", { name: "History" })).toBeInTheDocument();
    expect(screen.getByText("Oil Filter")).toBeInTheDocument();
    expect(screen.getByText(/Quantity: 2/i)).toBeInTheDocument();
    expect(screen.getByText(/By Casey/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Load More History" })).toHaveAttribute(
      "href",
      expect.stringContaining("historyCursor=clkeeperhistory00000000002")
    );
  });

  it("does not load history when another tab is active", async () => {
    const view = await SpaceDetailPage({
      params: Promise.resolve({ spaceId }),
      searchParams: Promise.resolve({
        householdId,
        tab: "contents"
      })
    });

    render(view);

    expect(apiMocks.getSpaceHistory).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Inventory Items" })).toBeInTheDocument();
  });
});