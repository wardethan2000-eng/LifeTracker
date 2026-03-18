import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  getScheduleInventoryItems: vi.fn()
}));

vi.mock("../lib/api", () => ({
  getScheduleInventoryItems: apiMocks.getScheduleInventoryItems
}));

import { ScheduleCardActions } from "./schedule-card-actions";

const formAction = "/test-action" as unknown as (formData: FormData) => void | Promise<void>;

describe("ScheduleCardActions", () => {
  it("loads linked parts when the completion form opens and lets the user opt out", async () => {
    apiMocks.getScheduleInventoryItems.mockResolvedValueOnce([
      {
        id: "link-1",
        scheduleId: "schedule-1",
        inventoryItemId: "item-1",
        quantityPerService: 2,
        notes: null,
        inventoryItem: {
          id: "item-1",
          householdId: "household-1",
          name: "Oil filter",
          sku: null,
          partNumber: "OF-123",
          manufacturer: null,
          category: null,
          location: null,
          quantityOnHand: 4,
          reorderThreshold: null,
          unit: "each",
          unitCost: 12.5,
          preferredSupplier: null,
          notes: null,
          itemType: "consumable",
          isCritical: false,
          createdAt: "2026-03-01T00:00:00.000Z",
          updatedAt: "2026-03-01T00:00:00.000Z"
        }
      }
    ]);

    const user = userEvent.setup();

    const { container } = render(
      <ScheduleCardActions
        assetId="asset-1"
        scheduleId="schedule-1"
        scheduleName="Oil change"
        isActive
        completeAction={formAction}
        toggleAction={formAction}
        deleteAction={formAction}
      />
    );

    await user.click(screen.getByRole("button", { name: /log completion/i }));

    expect(apiMocks.getScheduleInventoryItems).toHaveBeenCalledWith("asset-1", "schedule-1");
    expect(await screen.findByText("Oil filter")).toBeInTheDocument();

    const consumeToggle = screen.getByRole("checkbox", { name: /consume linked required parts/i });
    const hiddenApplyField = container.querySelector('input[name="applyLinkedParts"]') as HTMLInputElement | null;

    expect(hiddenApplyField).not.toBeNull();
    if (!hiddenApplyField) {
      throw new Error("Expected applyLinkedParts hidden input.");
    }
    expect(hiddenApplyField.name).toBe("applyLinkedParts");
    await user.click(consumeToggle);
    expect(hiddenApplyField.value).toBe("false");
  });

  it("shows a recoverable error when linked parts fail to load", async () => {
    apiMocks.getScheduleInventoryItems.mockRejectedValueOnce(new Error("Inventory service offline"));

    const user = userEvent.setup();

    const { container } = render(
      <ScheduleCardActions
        assetId="asset-1"
        scheduleId="schedule-1"
        scheduleName="Oil change"
        isActive
        completeAction={formAction}
        toggleAction={formAction}
        deleteAction={formAction}
      />
    );

    await user.click(screen.getByRole("button", { name: /log completion/i }));

    await waitFor(() => {
      expect(screen.getByText("Inventory service offline")).toBeInTheDocument();
    });

    const hiddenApplyField = container.querySelector('input[name="applyLinkedParts"]') as HTMLInputElement | null;

    expect(hiddenApplyField).not.toBeNull();
    if (!hiddenApplyField) {
      throw new Error("Expected applyLinkedParts hidden input.");
    }
    expect(hiddenApplyField.value).toBe("false");
  });

  it("shows delete confirmation inline and allows cancellation", async () => {
    const user = userEvent.setup();

    render(
      <ScheduleCardActions
        assetId="asset-1"
        scheduleId="schedule-1"
        scheduleName="Oil change"
        isActive
        completeAction={formAction}
        toggleAction={formAction}
        deleteAction={formAction}
      />
    );

    await user.click(screen.getByRole("button", { name: /^delete$/i }));

    expect(screen.getByText(/confirm delete\?/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /yes, delete/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^no$/i }));

    expect(screen.queryByText(/confirm delete\?/i)).not.toBeInTheDocument();
  });
});