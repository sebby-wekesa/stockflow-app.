-- CreateTable
CREATE TABLE "ProductBranchStock" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "availableQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reservedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "ProductBranchStock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductBranchStock_branchId_productId_key"
    ON "ProductBranchStock"("branchId", "productId");

-- CreateIndex
CREATE INDEX "ProductBranchStock_organizationId_idx"
    ON "ProductBranchStock"("organizationId");

-- CreateIndex
CREATE INDEX "ProductBranchStock_organizationId_branchId_idx"
    ON "ProductBranchStock"("organizationId", "branchId");

-- AddForeignKey
ALTER TABLE "ProductBranchStock"
    ADD CONSTRAINT "ProductBranchStock_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductBranchStock"
    ADD CONSTRAINT "ProductBranchStock_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductBranchStock"
    ADD CONSTRAINT "ProductBranchStock_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON UPDATE CASCADE;
