-- CreateTable
CREATE TABLE "BarcodeLookup" (
    "id" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "barcodeFormat" TEXT NOT NULL,
    "productName" TEXT,
    "brand" TEXT,
    "description" TEXT,
    "category" TEXT,
    "imageUrl" TEXT,
    "sourceProvider" TEXT NOT NULL,
    "rawResponse" JSONB NOT NULL DEFAULT '{}',
    "lookupCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BarcodeLookup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BarcodeLookup_barcode_key" ON "BarcodeLookup"("barcode");

-- CreateIndex
CREATE INDEX "BarcodeLookup_barcode_idx" ON "BarcodeLookup"("barcode");

-- CreateIndex
CREATE INDEX "BarcodeLookup_createdAt_idx" ON "BarcodeLookup"("createdAt");
