ALTER TABLE "Product"
DROP CONSTRAINT IF EXISTS "Product_uom_pcs_sets_check";

ALTER TABLE "Product"
DROP CONSTRAINT IF EXISTS "Product_uom_kg_check";

UPDATE "Product"
SET "uom" = 'KG';

ALTER TABLE "Product"
ALTER COLUMN "uom" SET DEFAULT 'KG';

ALTER TABLE "Product"
ADD CONSTRAINT "Product_uom_kg_check"
CHECK ("uom" = 'KG');
