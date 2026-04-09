import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { InventoryItemSummary } from "@aegis/types";
import { describe, expect, it, vi } from "vitest";

const actionMocks = vi.hoisted(() => ({
  updateInventoryItemAction: vi.fn(),
}));

vi.mock("../app/actions", () => ({
  updateInventoryItemAction: actionMocks.updateInventoryItemAction,
}));

vi.mock("./barcode-lookup-field", () => ({
  BarcodeLookupField: () => <div>Barcode Lookup Stub</div>,
}));

import { InventoryItemEditForm } from "./inventory-item-edit-form";

const sampleItem: InventoryItemSummary = {
  id: "inventory-item-1",
  householdId: "household-1",
  scanTag: null,
  name: "Oil Filter",
  itemType: "consumable",
  conditionStatus: null,
  partNumber: "OF-123",
  description: "Spin-on oil filter",
  category: "Filters",
  manufacturer: "Motorcraft",
  quantityOnHand: 4,
  unit: "each",
  reorderThreshold: 2,
  reorderQuantity: 6,
  preferredSupplier: "Parts Store",
  supplierUrl: "https://example.com/filter",
  unitCost: 12.5,
  storageLocation: "Garage shelf",
  notes: "Fits mower",
  deletedAt: null,
  createdAt: "2026-03-01T00:00:00.000Z",
  updatedAt: "2026-03-01T00:00:00.000Z",
  totalValue: 50,
  lowStock: false,
};

describe("InventoryItemEditForm", () => {
  it("submits the edited values through the server action and calls onSaved", async () => {
    actionMocks.updateInventoryItemAction.mockResolvedValueOnce(undefined);
    const onSaved = vi.fn();
    const onCancel = vi.fn();
    const user = userEvent.setup();

    render(
      <InventoryItemEditForm
        householdId="household-1"
        item={sampleItem}
        onSaved={onSaved}
        onCancel={onCancel}
      />
    );

    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Premium Oil Filter");
    await user.clear(screen.getByLabelText("Supplier"));
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(actionMocks.updateInventoryItemAction).toHaveBeenCalledTimes(1);

    const firstCall = actionMocks.updateInventoryItemAction.mock.calls[0];
    expect(firstCall).toBeDefined();

    const formData = firstCall![0] as FormData;
    expect(formData.get("householdId")).toBe("household-1");
    expect(formData.get("inventoryItemId")).toBe("inventory-item-1");
    expect(formData.get("name")).toBe("Premium Oil Filter");
    expect(formData.get("preferredSupplier")).toBe("");
    expect(formData.get("itemType")).toBe("consumable");

    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });
});