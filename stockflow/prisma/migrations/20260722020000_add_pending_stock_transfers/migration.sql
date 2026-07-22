CREATE TYPE "StockTransferStatus" AS ENUM ('PENDING', 'RECEIVED');

CREATE TABLE "StockTransfer" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sourceBranchId" TEXT NOT NULL,
    "destinationBranchId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "quantityUnit" TEXT NOT NULL DEFAULT 'KG',
    "status" "StockTransferStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedAt" TIMESTAMP(3),
    "receivedById" TEXT,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "StockTransfer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StockTransfer_organizationId_reference_key"
    ON "StockTransfer"("organizationId", "reference");

CREATE INDEX "StockTransfer_organizationId_idx"
    ON "StockTransfer"("organizationId");

CREATE INDEX "StockTransfer_organizationId_destinationBranchId_status_idx"
    ON "StockTransfer"("organizationId", "destinationBranchId", "status");

ALTER TABLE "StockTransfer"
    ADD CONSTRAINT "StockTransfer_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StockTransfer"
    ADD CONSTRAINT "StockTransfer_sourceBranchId_fkey"
    FOREIGN KEY ("sourceBranchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StockTransfer"
    ADD CONSTRAINT "StockTransfer_destinationBranchId_fkey"
    FOREIGN KEY ("destinationBranchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StockTransfer"
    ADD CONSTRAINT "StockTransfer_receivedById_fkey"
    FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StockTransfer"
    ADD CONSTRAINT "StockTransfer_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON UPDATE CASCADE;
