ALTER TABLE "InventoryTransaction"
ADD COLUMN "correctionOfTransactionId" TEXT;

CREATE INDEX "InventoryTransaction_correctionOfTransactionId_idx"
ON "InventoryTransaction"("correctionOfTransactionId");

ALTER TABLE "InventoryTransaction"
ADD CONSTRAINT "InventoryTransaction_correctionOfTransactionId_fkey"
FOREIGN KEY ("correctionOfTransactionId") REFERENCES "InventoryTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;