ALTER TABLE "InventoryItem"
  ADD CONSTRAINT "InventoryItem_reorderThreshold_nonnegative"
    CHECK ("reorderThreshold" IS NULL OR "reorderThreshold" >= 0),
  ADD CONSTRAINT "InventoryItem_reorderQuantity_nonnegative"
    CHECK ("reorderQuantity" IS NULL OR "reorderQuantity" >= 0);