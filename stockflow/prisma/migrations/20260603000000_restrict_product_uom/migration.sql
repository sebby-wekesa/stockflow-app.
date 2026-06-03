UPDATE "Product"
SET "uom" = CASE
  WHEN upper(trim("uom")) IN ('SET', 'SETS') THEN 'SETS'
  ELSE 'PCS'
END;

ALTER TABLE "Product"
DROP CONSTRAINT IF EXISTS "Product_uom_pcs_sets_check";

ALTER TABLE "Product"
ADD CONSTRAINT "Product_uom_pcs_sets_check"
CHECK ("uom" IN ('PCS', 'SETS'));
