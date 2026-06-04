ALTER TABLE "FinishedGoods"
  ADD COLUMN IF NOT EXISTS "reservedQuantity" INTEGER NOT NULL DEFAULT 0;

-- Legacy sales paths could drive finished-goods stock below zero. Negative
-- available stock cannot participate in reservations, so normalize it first.
UPDATE "FinishedGoods"
SET "quantity" = 0
WHERE "quantity" < 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'FinishedGoods_reservedQuantity_nonnegative'
  ) THEN
    ALTER TABLE "FinishedGoods"
      ADD CONSTRAINT "FinishedGoods_reservedQuantity_nonnegative"
      CHECK ("reservedQuantity" >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'FinishedGoods_quantity_nonnegative'
  ) THEN
    ALTER TABLE "FinishedGoods"
      ADD CONSTRAINT "FinishedGoods_quantity_nonnegative"
      CHECK ("quantity" >= 0);
  END IF;
END $$;

-- Existing catalogue shadows previously held zero stock while Product held
-- the physical quantity. Seed those shadows once so they enter the lifecycle.
UPDATE "FinishedGoods" fg
SET "quantity" = GREATEST(0, FLOOR(p."currentStock")::INTEGER)
FROM "Product" p, "Design" d
WHERE fg."sku" = p."sku"
  AND fg."designId" = d."id"
  AND fg."organizationId" = p."organizationId"
  AND d."organizationId" = fg."organizationId"
  AND d."code" = 'IMPORTED'
  AND fg."quantity" = 0;
