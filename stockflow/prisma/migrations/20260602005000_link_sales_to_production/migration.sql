ALTER TABLE "ProductionOrder" ADD COLUMN "saleOrderId" TEXT;
ALTER TABLE "ProductionOrder" ADD COLUMN "saleItemId" TEXT;

CREATE UNIQUE INDEX "ProductionOrder_saleItemId_key" ON "ProductionOrder"("saleItemId");
CREATE INDEX "ProductionOrder_saleOrderId_idx" ON "ProductionOrder"("saleOrderId");

ALTER TABLE "ProductionOrder"
  ADD CONSTRAINT "ProductionOrder_saleOrderId_fkey"
  FOREIGN KEY ("saleOrderId") REFERENCES "SaleOrder"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProductionOrder"
  ADD CONSTRAINT "ProductionOrder_saleItemId_fkey"
  FOREIGN KEY ("saleItemId") REFERENCES "SaleItem"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
