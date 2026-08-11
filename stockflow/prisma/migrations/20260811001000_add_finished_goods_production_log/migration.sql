CREATE TABLE "FinishedGoodsProductionLog" (
    "id" TEXT NOT NULL,
    "jobCardNo" TEXT NOT NULL,
    "productionDate" TIMESTAMP(3) NOT NULL,
    "springProductId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "pcsProduced" INTEGER NOT NULL,
    "weightPerPiece" DECIMAL(10,4) NOT NULL,
    "totalWeight" DECIMAL(10,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "FinishedGoodsProductionLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FinishedGoodsProductionLog_organizationId_idx" ON "FinishedGoodsProductionLog"("organizationId");
CREATE INDEX "FinishedGoodsProductionLog_branchId_productionDate_idx" ON "FinishedGoodsProductionLog"("branchId", "productionDate");
CREATE INDEX "FinishedGoodsProductionLog_springProductId_idx" ON "FinishedGoodsProductionLog"("springProductId");

ALTER TABLE "FinishedGoodsProductionLog"
ADD CONSTRAINT "FinishedGoodsProductionLog_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON UPDATE NO ACTION ON DELETE RESTRICT;

ALTER TABLE "FinishedGoodsProductionLog"
ADD CONSTRAINT "FinishedGoodsProductionLog_springProductId_fkey"
FOREIGN KEY ("springProductId") REFERENCES "Product"("id") ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "FinishedGoodsProductionLog"
ADD CONSTRAINT "FinishedGoodsProductionLog_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON UPDATE CASCADE ON DELETE RESTRICT;
