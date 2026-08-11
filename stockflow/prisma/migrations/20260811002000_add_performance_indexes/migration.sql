CREATE INDEX "MaterialConsumptionLog_organizationId_consumedAt_idx"
ON "MaterialConsumptionLog"("organizationId", "consumedAt");

CREATE INDEX "ProductionOrder_organizationId_status_createdAt_idx"
ON "ProductionOrder"("organizationId", "status", "createdAt");

CREATE INDEX "ProductionOrder_organizationId_status_completedAt_idx"
ON "ProductionOrder"("organizationId", "status", "completedAt");

CREATE INDEX "RawMaterial_organizationId_category_materialName_idx"
ON "RawMaterial"("organizationId", "category", "materialName");

CREATE INDEX "SaleOrder_organizationId_createdAt_idx"
ON "SaleOrder"("organizationId", "createdAt");

CREATE INDEX "SaleOrder_organizationId_status_createdAt_idx"
ON "SaleOrder"("organizationId", "status", "createdAt");

CREATE INDEX "StageLog_organizationId_completedAt_idx"
ON "StageLog"("organizationId", "completedAt");

CREATE INDEX "StockMovement_organizationId_createdAt_idx"
ON "StockMovement"("organizationId", "createdAt");

CREATE INDEX "FinishedGoodsProductionLog_organizationId_branchId_productionDate_idx"
ON "FinishedGoodsProductionLog"("organizationId", "branchId", "productionDate");
