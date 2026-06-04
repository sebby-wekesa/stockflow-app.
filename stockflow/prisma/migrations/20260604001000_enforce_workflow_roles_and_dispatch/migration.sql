ALTER TABLE "User"
  ADD COLUMN "departments" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "User"
SET "departments" = ARRAY["department"]
WHERE "department" IS NOT NULL
  AND cardinality("departments") = 0;

ALTER TABLE "ProductionOrder"
  ADD COLUMN "rejectionReason" TEXT;

ALTER TYPE "SaleStatus" ADD VALUE IF NOT EXISTS 'READY_FOR_DISPATCH' BEFORE 'SHIPPED';
