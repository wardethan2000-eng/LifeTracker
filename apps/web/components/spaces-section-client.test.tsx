import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  exportHouseholdSpaces: vi.fn(),
  getHouseholdSpaces: vi.fn(),
  getSpaceByShortCode: vi.fn(),
  getSpaceOrphans: vi.fn(),
  importHouseholdSpaces: vi.fn()
}));

const routerMocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn()
}));

const actionMocks = vi.hoisted(() => ({
  addItemToSpace: vi.fn()
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => <a href={href} {...props}>{children}</a>
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMocks
}));

vi.mock("../app/actions", () => ({
  addItemToSpace: actionMocks.addItemToSpace
}));

vi.mock("../lib/api", () => ({
  ApiError: class ApiError extends Error {
    status: number;

    constructor(message: string, status = 500) {
      super(message);
      this.status = status;
    }
  },
  exportHouseholdSpaces: apiMocks.exportHouseholdSpaces,
  getHouseholdSpaces: apiMocks.getHouseholdSpaces,
  getSpaceByShortCode: apiMocks.getSpaceByShortCode,
  getSpaceOrphans: apiMocks.getSpaceOrphans,
  importHouseholdSpaces: apiMocks.importHouseholdSpaces
}));

vi.mock("./space-form", () => ({
  SpaceForm: () => <div>Space Form Stub</div>
}));

vi.mock("./space-quick-place", () => ({
  SpaceQuickPlace: () => <div>Quick Place Stub</div>
}));

vi.mock("./space-tree-map", () => ({
  SpaceTreeMap: () => <div>Tree Map Stub</div>
}));

import { SpacesSectionClient } from "./spaces-section-client";

const householdId = "clkeeperhouse000000000001";
const spaceId = "clkeeperspace000000000001";

const spaces = [{
  id: spaceId,
  householdId,
  shortCode: "RM01",
  scanTag: "sp_room01",
  name: "Workshop",
  type: "room" as const,
  parentSpaceId: null,
  description: null,
  notes: null,
  sortOrder: 0,
  createdAt: "2026-03-01T00:00:00.000Z",
  updatedAt: "2026-03-01T00:00:00.000Z",
  deletedAt: null,
  breadcrumb: [{ id: spaceId, name: "Workshop", type: "room" as const }],
  children: [],
  spaceItems: [],
  generalItems: [],
  itemCount: 0,
  generalItemCount: 0,
  totalItemCount: 0
}];

const utilization = [{
  spaceId,
  shortCode: "RM01",
  name: "Workshop",
  type: "room" as const,
  breadcrumb: [{ id: spaceId, name: "Workshop", type: "room" as const }],
  itemCount: 1,
  generalItemCount: 1,
  totalItemCount: 2,
  lastActivityAt: "2026-03-18T10:00:00.000Z",
  isEmpty: false
}];

const recentScans = [{
  id: "clkeeperscanlog00000000001",
  householdId,
  spaceId,
  userId: "clkeeperuser0000000000001",
  scannedAt: "2026-03-18T10:00:00.000Z",
  method: "manual_lookup" as const,
  actor: {
    id: "clkeeperuser0000000000001",
    displayName: "Casey"
  },
  space: {
    id: spaceId,
    householdId,
    shortCode: "RM01",
    scanTag: "sp_room01",
    name: "Workshop",
    type: "room" as const,
    parentSpaceId: null,
    description: null,
    notes: null,
    sortOrder: 0,
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
    deletedAt: null,
    breadcrumb: [{ id: spaceId, name: "Workshop", type: "room" as const }]
  }
}];

describe("SpacesSectionClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.getSpaceByShortCode.mockRejectedValue(new Error("Not found"));
    apiMocks.getHouseholdSpaces.mockResolvedValue({ items: [], nextCursor: null });
    apiMocks.getSpaceOrphans.mockResolvedValue({
      items: [{
        id: "clkeeperitem0000000000001",
        householdId,
        scanTag: null,
        itemType: "consumable",
        conditionStatus: null,
        name: "Loose Fasteners",
        partNumber: "LF-10",
        description: "Bucket of mixed fasteners",
        category: "Hardware",
        manufacturer: null,
        quantityOnHand: 24,
        unit: "each",
        reorderThreshold: null,
        reorderQuantity: null,
        preferredSupplier: null,
        supplierUrl: null,
        unitCost: null,
        storageLocation: null,
        notes: null,
        deletedAt: null,
        createdAt: "2026-03-10T00:00:00.000Z",
        updatedAt: "2026-03-11T00:00:00.000Z",
        totalValue: null,
        lowStock: false
      }],
      nextCursor: null
    });
  });

  it("shows utilization analytics and loads orphan items in the dialog", async () => {
    const user = userEvent.setup();

    render(
      <SpacesSectionClient
        householdId={householdId}
        spaces={spaces}
        orphanCount={1}
        utilization={utilization}
        recentScans={recentScans}
      />
    );

    expect(screen.getByRole("heading", { name: "Recent Activity" })).toBeInTheDocument();
    expect(screen.getByText("Casey")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Space Utilization" }));

    expect(screen.getByText("2 total").closest("a")).toHaveAttribute(
      "href",
      `/inventory/spaces/${spaceId}?householdId=${householdId}`
    );
    expect(screen.getByText("2 total")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Unplaced Items/i }));

    expect(await screen.findByRole("heading", { name: "Unplaced Items" })).toBeInTheDocument();
    expect(await screen.findByText("Loose Fasteners")).toBeInTheDocument();

    await waitFor(() => {
      expect(apiMocks.getSpaceOrphans).toHaveBeenCalledWith(householdId, { limit: 25 });
    });
  });
});
