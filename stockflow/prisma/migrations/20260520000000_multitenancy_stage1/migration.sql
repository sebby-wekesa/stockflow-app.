-- ─────────────────────────────────────────────────────────────────────────────
-- Stage 1 — Multitenancy migration for stockflow-production
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Strategy:
--   1. Add new columns nullable, backfill, then set NOT NULL.
--   2. Re-scope global uniques to per-org composites.
--   3. Enable Row-Level Security on every public-schema business table.
--   4. Policies check a session variable `app.current_org_id` set by the app.
--
-- Existing Springtech data lands in Organization #1 (id = a constant UUID so
-- code can reference it). New orgs must sign up via /signup.
--
-- IMPORTANT: run this in a transaction. If anything fails partway through,
-- the whole thing rolls back.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 1 — New enum + Organization columns
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "public"."OrgStatus" AS ENUM ('PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED', 'CLOSED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "public"."Organization"
  ADD COLUMN IF NOT EXISTS "slug"            TEXT,
  ADD COLUMN IF NOT EXISTS "status"          "public"."OrgStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
  ADD COLUMN IF NOT EXISTS "ownerUserId"     TEXT,
  ADD COLUMN IF NOT EXISTS "approvedAt"      TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "disabledAt"      TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "disabledReason"  TEXT;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 2 — Seed Springtech as Organization #1 (idempotent)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO "public"."Organization" (id, name, code, slug, status, "approvedAt", "createdAt", "updatedAt")
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Springtech (K) Ltd',
  'SPRINGTECH',
  'springtech',
  'ACTIVE',
  NOW(),
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Backfill slug for any orgs missing one (only #1 should exist right now)
UPDATE "public"."Organization"
SET slug = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))
WHERE slug IS NULL;

ALTER TABLE "public"."Organization" ALTER COLUMN "slug" SET NOT NULL;

-- Unique constraints
DO $$ BEGIN
  ALTER TABLE "public"."Organization" ADD CONSTRAINT "Organization_slug_key" UNIQUE (slug);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "public"."Organization" ADD CONSTRAINT "Organization_ownerUserId_key" UNIQUE ("ownerUserId");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 3 — Create Invitation table
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "public"."Invitation" (
  id              TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  email           TEXT NOT NULL,
  role            "public"."Role" NOT NULL DEFAULT 'OPERATOR',
  "branchId"      TEXT,
  token           TEXT NOT NULL,
  "invitedBy"     TEXT NOT NULL,
  "expiresAt"     TIMESTAMP(3) NOT NULL,
  "acceptedAt"    TIMESTAMP(3),
  "cancelledAt"   TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Invitation_token_key"  UNIQUE (token),
  CONSTRAINT "Invitation_org_email_key" UNIQUE ("organizationId", email),
  CONSTRAINT "Invitation_org_fk"  FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"(id) ON DELETE CASCADE,
  CONSTRAINT "Invitation_branch_fk" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"(id) ON DELETE SET NULL,
  CONSTRAINT "Invitation_inviter_fk" FOREIGN KEY ("invitedBy") REFERENCES "public"."User"(id)
);

CREATE INDEX IF NOT EXISTS "Invitation_organizationId_idx" ON "public"."Invitation" ("organizationId");
CREATE INDEX IF NOT EXISTS "Invitation_token_idx" ON "public"."Invitation" (token);

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 4 — Add organizationId column to all 28 business tables
--
-- Nullable first, backfilled to Springtech, then set NOT NULL + FK.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'AuditLog', 'BillOfMaterials', 'Customer', 'CustomerPortalAccess',
    'DemandForecast', 'Design', 'FinishedGoods', 'ImportBatch', 'ImportRow',
    'InventoryFinishedGoods', 'InventoryRawMaterial', 'MaterialConsumptionLog',
    'MaterialReceipt', 'NotificationSettings', 'Product', 'ProductAlias',
    'ProductReceipt', 'ProductionOrder', 'PurchaseOrder', 'PurchaseOrderItem',
    'RawMaterial', 'SaleItem', 'SaleOrder', 'Stage', 'StageLog',
    'StockMovement', 'Supplier', 'UnitOfMeasure'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE "public".%I ADD COLUMN IF NOT EXISTS "organizationId" TEXT', t);
    EXECUTE format('UPDATE "public".%I SET "organizationId" = %L WHERE "organizationId" IS NULL', t, '00000000-0000-0000-0000-000000000001');
    EXECUTE format('ALTER TABLE "public".%I ALTER COLUMN "organizationId" SET NOT NULL', t);

    -- Add FK constraint (idempotent via DO/EXCEPTION block)
    BEGIN
      EXECUTE format(
        'ALTER TABLE "public".%I ADD CONSTRAINT %I FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"(id) ON DELETE RESTRICT',
        t,
        t || '_organizationId_fk'
      );
    EXCEPTION WHEN duplicate_object THEN NULL; END;

    -- Add index on organizationId
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON "public".%I ("organizationId")', t || '_organizationId_idx', t);
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 5 — Replace global uniques with per-org composites
--
-- Drop the old global uniques and create composite (organizationId, field) ones.
-- ─────────────────────────────────────────────────────────────────────────────

-- Branch: name & code now unique per-org
ALTER TABLE "public"."Branch" DROP CONSTRAINT IF EXISTS "Branch_name_key";
ALTER TABLE "public"."Branch" DROP CONSTRAINT IF EXISTS "Branch_code_key";
DO $$ BEGIN
  ALTER TABLE "public"."Branch" ADD CONSTRAINT "Branch_org_name_key" UNIQUE ("organizationId", name);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "public"."Branch" ADD CONSTRAINT "Branch_org_code_key" UNIQUE ("organizationId", code);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Customer.code
ALTER TABLE "public"."Customer" DROP CONSTRAINT IF EXISTS "Customer_code_key";
DO $$ BEGIN
  ALTER TABLE "public"."Customer" ADD CONSTRAINT "Customer_org_code_key" UNIQUE ("organizationId", code);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Design.code
ALTER TABLE "public"."Design" DROP CONSTRAINT IF EXISTS "Design_code_key";
DO $$ BEGIN
  ALTER TABLE "public"."Design" ADD CONSTRAINT "Design_org_code_key" UNIQUE ("organizationId", code);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Product.sku and .barcode
ALTER TABLE "public"."Product" DROP CONSTRAINT IF EXISTS "Product_sku_key";
ALTER TABLE "public"."Product" DROP CONSTRAINT IF EXISTS "Product_barcode_key";
DO $$ BEGIN
  ALTER TABLE "public"."Product" ADD CONSTRAINT "Product_org_sku_key" UNIQUE ("organizationId", sku);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Product'
      AND column_name = 'barcode'
  ) THEN
    ALTER TABLE "public"."Product" ADD CONSTRAINT "Product_org_barcode_key" UNIQUE ("organizationId", barcode);
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- RawMaterial.sku and .barcode
ALTER TABLE "public"."RawMaterial" DROP CONSTRAINT IF EXISTS "RawMaterial_sku_key";
ALTER TABLE "public"."RawMaterial" DROP CONSTRAINT IF EXISTS "RawMaterial_barcode_key";
DO $$ BEGIN
  ALTER TABLE "public"."RawMaterial" ADD CONSTRAINT "RawMaterial_org_sku_key" UNIQUE ("organizationId", sku);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "public"."RawMaterial" ADD CONSTRAINT "RawMaterial_org_barcode_key" UNIQUE ("organizationId", barcode);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Supplier.code
ALTER TABLE "public"."Supplier" DROP CONSTRAINT IF EXISTS "Supplier_code_key";
DO $$ BEGIN
  ALTER TABLE "public"."Supplier" ADD CONSTRAINT "Supplier_org_code_key" UNIQUE ("organizationId", code);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ProductionOrder.orderNumber
ALTER TABLE "public"."ProductionOrder" DROP CONSTRAINT IF EXISTS "ProductionOrder_orderNumber_key";
DO $$ BEGIN
  ALTER TABLE "public"."ProductionOrder" ADD CONSTRAINT "ProductionOrder_org_orderNumber_key" UNIQUE ("organizationId", "orderNumber");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- PurchaseOrder.poNumber
ALTER TABLE "public"."PurchaseOrder" DROP CONSTRAINT IF EXISTS "PurchaseOrder_poNumber_key";
DO $$ BEGIN
  ALTER TABLE "public"."PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_org_poNumber_key" UNIQUE ("organizationId", "poNumber");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- FinishedGoods.sku and .barcode
ALTER TABLE "public"."FinishedGoods" DROP CONSTRAINT IF EXISTS "FinishedGoods_sku_key";
ALTER TABLE "public"."FinishedGoods" DROP CONSTRAINT IF EXISTS "FinishedGoods_barcode_key";
DO $$ BEGIN
  ALTER TABLE "public"."FinishedGoods" ADD CONSTRAINT "FinishedGoods_org_sku_key" UNIQUE ("organizationId", sku);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "public"."FinishedGoods" ADD CONSTRAINT "FinishedGoods_org_barcode_key" UNIQUE ("organizationId", barcode);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 6 — Make existing Springtech user the owner of Organization #1
--
-- Find the first ADMIN user already associated with Springtech and link them.
-- If no admin exists yet, ownerUserId stays NULL (set after first signup).
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE "public"."Organization" o
SET "ownerUserId" = u.id
FROM "public"."User" u
WHERE o.id = '00000000-0000-0000-0000-000000000001'
  AND o."ownerUserId" IS NULL
  AND u."organizationId" = o.id
  AND u.role = 'ADMIN'
  AND u.id = (
    SELECT id FROM "public"."User"
    WHERE "organizationId" = '00000000-0000-0000-0000-000000000001'
      AND role = 'ADMIN'
    ORDER BY "createdAt" ASC
    LIMIT 1
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 7 — Row-Level Security
--
-- Defense-in-depth: even if application code forgets to filter by
-- organizationId, the database itself refuses cross-tenant access.
--
-- Mechanism: each request sets `app.current_org_id` via SET LOCAL.
-- Policies on each table check that the row's organizationId matches.
--
-- Special cases:
--   - The Prisma migration runner uses the role that owns the tables,
--     which BYPASSES RLS. So migrations still work.
--   - The app connects via the `app_user` role (which we create below)
--     and gets RLS enforced.
--   - If app.current_org_id is unset, NO rows are visible. This is by
--     design — it forces the app to set it explicitly.
-- ─────────────────────────────────────────────────────────────────────────────

-- Create a role for application connections that gets RLS enforced
DO $$ BEGIN
  CREATE ROLE app_user;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Grant the role basic privileges
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_user;

-- Helper function: returns the current org id from the session variable,
-- or NULL if not set. NULL means "no org context" → no rows visible.
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS TEXT AS $$
  SELECT current_setting('app.current_org_id', true);
$$ LANGUAGE SQL STABLE;

-- Enable RLS on every public-schema business table
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'AuditLog', 'BillOfMaterials', 'Branch', 'Customer', 'CustomerPortalAccess',
    'DemandForecast', 'Design', 'FinishedGoods', 'ImportBatch', 'ImportRow',
    'InventoryFinishedGoods', 'InventoryRawMaterial', 'Invitation',
    'MaterialConsumptionLog', 'MaterialReceipt', 'NotificationSettings',
    'Product', 'ProductAlias', 'ProductReceipt', 'ProductionOrder',
    'PurchaseOrder', 'PurchaseOrderItem', 'RawMaterial', 'SaleItem',
    'SaleOrder', 'Stage', 'StageLog', 'StockMovement', 'Supplier',
    'UnitOfMeasure', 'User'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE "public".%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE "public".%I FORCE ROW LEVEL SECURITY', t);

    -- Drop existing policy if any (idempotent)
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON "public".%I', t);

    -- Create the isolation policy
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON "public".%I '
      'USING ("organizationId" = public.current_org_id()) '
      'WITH CHECK ("organizationId" = public.current_org_id())',
      t
    );
  END LOOP;
END $$;

-- Organization table: special case. A user can read their own org row, and
-- the signup flow needs to create new ones. We allow reads of one's own org;
-- creates and updates go through the app code (which uses the migration role).
ALTER TABLE "public"."Organization" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Organization" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_self ON "public"."Organization";
CREATE POLICY tenant_isolation_self ON "public"."Organization"
  USING (id = public.current_org_id())
  WITH CHECK (id = public.current_org_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 8 — Bypass policy for the schema owner / migration runner
--
-- The role that owns these tables (typically `postgres` or your migration role)
-- automatically bypasses RLS unless we set BYPASSRLS off. We want migrations
-- to work, so we leave owner bypass on. App connections via app_user get RLS.
-- ─────────────────────────────────────────────────────────────────────────────

-- Grant BYPASSRLS to nobody for now. The table owner (postgres) bypasses RLS
-- by default (you can verify with `\dp+ in psql). app_user does NOT have
-- BYPASSRLS so it gets the policies enforced.

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- POST-DEPLOY CHECKS (run these as `psql` after the migration commits)
-- ─────────────────────────────────────────────────────────────────────────────
--
-- 1. Verify Springtech org exists:
--    SELECT id, name, slug, status FROM "public"."Organization";
--
-- 2. Verify every Product is in Springtech:
--    SELECT "organizationId", COUNT(*) FROM "public"."Product" GROUP BY 1;
--    (Should be one row, all rows in Springtech org)
--
-- 3. Test RLS isolation:
--    SET ROLE app_user;
--    SET LOCAL app.current_org_id = '00000000-0000-0000-0000-000000000001';
--    SELECT COUNT(*) FROM "public"."Product";   -- should see Springtech rows
--    SET LOCAL app.current_org_id = 'bogus-id';
--    SELECT COUNT(*) FROM "public"."Product";   -- should return 0
--    RESET ROLE;
