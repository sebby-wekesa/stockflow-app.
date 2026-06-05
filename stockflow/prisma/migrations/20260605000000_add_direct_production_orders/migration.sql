-- Direct production orders can be created without a saved design template.
ALTER TABLE "ProductionOrder" ALTER COLUMN "designId" DROP NOT NULL;

ALTER TABLE "ProductionOrder"
  ADD COLUMN "productName" TEXT,
  ADD COLUMN "expectedPieces" INTEGER,
  ADD COLUMN "actualPieces" INTEGER,
  ADD COLUMN "actualWeightOut" DECIMAL(10,4),
  ADD COLUMN "outputRecordedAt" TIMESTAMP(3),
  ADD COLUMN "outputRecordedBy" TEXT;

CREATE TABLE "ProductionOrderMaterial" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "productionOrderId" TEXT NOT NULL,
  "rawMaterialId" TEXT NOT NULL,
  "cutLength" DECIMAL(10,4),
  "pieces" INTEGER NOT NULL,
  "totalLength" DECIMAL(10,4),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProductionOrderMaterial_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductionOrderMaterial_organizationId_idx" ON "ProductionOrderMaterial"("organizationId");
CREATE INDEX "ProductionOrderMaterial_productionOrderId_idx" ON "ProductionOrderMaterial"("productionOrderId");
CREATE INDEX "ProductionOrderMaterial_rawMaterialId_idx" ON "ProductionOrderMaterial"("rawMaterialId");

ALTER TABLE "ProductionOrderMaterial"
  ADD CONSTRAINT "ProductionOrderMaterial_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductionOrderMaterial"
  ADD CONSTRAINT "ProductionOrderMaterial_productionOrderId_fkey"
  FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductionOrderMaterial"
  ADD CONSTRAINT "ProductionOrderMaterial_rawMaterialId_fkey"
  FOREIGN KEY ("rawMaterialId") REFERENCES "RawMaterial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
