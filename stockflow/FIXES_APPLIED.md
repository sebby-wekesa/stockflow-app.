# Stockflow Project Fixes — May 2026

This document summarises every change made to your stockflow-production codebase, what the original errors were, and what you need to do to deploy.

## How to deploy these fixes

```bash
# 1. Replace your existing project folder with this one (back up first)
mv stockflow stockflow.backup
unzip stockflow-fixed.zip
cd stockflow

# 2. Install dependencies
npm install

# 3. Regenerate Prisma client against the patched schema
npx prisma generate

# 4. Create a fresh migration covering all the missing tables
#    (your current migration only creates 5 of ~30 tables)
npx prisma migrate dev --name fix_schema

# 5. Build to confirm everything compiles
npm run build

# 6. Start dev server
npm run dev
```

If step 4 complains that the database is out of sync, you can reset it for a clean slate (WARNING — this wipes data):

```bash
npx prisma migrate reset
```

For production, instead use `npx prisma migrate deploy` after running step 4 locally to generate the migration file.

## Issues fixed

### 1. Schema problems (prisma/schema.prisma)

**Problem:** 12 models had `updatedAt DateTime` without the `@updatedAt` directive, forcing manual values on every create. Three models had `id String @id` without `@default(uuid())`.

**Fixed:**
- Added `@updatedAt` to: BillOfMaterials, Customer, InventoryFinishedGoods, InventoryRawMaterial, NotificationSettings, Organization, Product, PurchaseOrder, SaleOrder, Supplier, UnitOfMeasure, User
- Added `@default(uuid())` to: AuditLog.id, CustomerPortalAccess.id, ImportRow.id
- Added `@updatedAt` to ImportRow.updated_at
- Extended ImportBatch with fields needed for specialized imports: `file_url`, `mapping_config`, `imported_at`, `ok_count`, `skipped_count`, `error_count`, `error_summary`

### 2. CookieOptions import (actions/auth.ts)

**Problem:** Imported `CookieOptions` from `next/headers`, but Next.js never exported that. It comes from `@supabase/ssr`.

**Fixed:**
- Changed import to `import type { CookieOptions } from "@supabase/ssr"`
- Made `createSupabaseClient()` async (Next 15+ requires awaiting `cookies()`)
- Updated all 4 call sites to `await createSupabaseClient()`

### 3. Wrong relation names in design/BOM code

**Problem:** Code called the BOM relation `bomItems` and `rawMaterial`, but the schema defines them as `billOfMaterials` and `RawMaterial` (capital R). Also `Design` (capital D) used where the lowercase relation `design` was needed.

**Fixed in:**
- `app/actions/designs.ts` — both `include` blocks renamed
- `app/actions/material-consumption.ts` — renames + relation capitalization
- `app/actions/dashboard.ts` — `Design` → `design`, `bomItems` → `billOfMaterials`, `rawMaterial` → `RawMaterial`
- `actions/production-order.ts` — same renames

### 4. Branch enum / Branch model confusion

**Problem:** 14 files imported `Branch` from `@prisma/client` and treated it like a string enum. In your schema, `Branch` is a **model** with UUIDs — the import returns the row type, not a string union.

**Fixed:**
- `lib/branches.ts` — rewrote to export a `BranchCode` string union (`'mombasa' | 'nairobi' | 'bonje'`) independent of Prisma
- 14 component/action files now import `BranchCode as Branch` from `@/lib/branches`
- Import flow resolves the BranchCode string to an actual Branch UUID at commit time via lookup

### 5. SalesOrderStatus enum (doesn't exist)

**Problem:** Code referenced `SalesOrderStatus` from `@prisma/client`, but your schema names the enum `SaleStatus`.

**Fixed:** Aliased the import as `import type { SaleStatus as SalesOrderStatus } from '@prisma/client'` in:
- `components/sales/OrderActions.tsx`
- `app/(dashboard)/sales/page.tsx`
- `lib/sales-utils.ts`
- `lib/sales.ts`

### 6. Client Components importing server-only modules

**Problem:**
- `components/DashboardShell.tsx` imported `Role` from `@/lib/auth` (server-only, pulls Prisma)
- `components/Sidebar.tsx` same
- `components/RoleGuard.tsx` same (Server Component, but using stale source)
- `components/DashboardShell.tsx` had a duplicate `useSearchParams` import
- `app/(dashboard)/orders/page.tsx` (a `'use client'` page) imported unused `prisma`

**Fixed:**
- Switched type imports to `UserRole as Role` from `@/lib/types` (pure type, no server deps)
- Removed duplicate `useSearchParams` import
- Removed unused `prisma` import from orders page

### 7. Broken import flow (lib/import/specialized-commit.ts + actions)

**Problem:** Original file was written for a different schema (snake_case fields, `BranchStock` model, `SalesOrderLine`, `created_by` on stock movements, etc) — none of which match your real schema.

**Fixed:** Completely rewrote `lib/import/specialized-commit.ts` for your schema:
- Uses camelCase (`productId`, `branchId`, `currentStock`, `quantity`)
- Updates `Product.currentStock` directly (your schema doesn't have a per-branch BranchStock table — stock is global)
- StockMovement only has `productId`, `branchId`, `movementType`, `quantity`, `reference`, `notes` — no `unit_price`, `customer_name`, `created_by`
- Sales import creates a FinishedGoods shadow record per Product because `SaleItem` requires a `finishedGoodsId` (not productId)
- Creates an `IMPORTED` placeholder Design for those shadow records
- Resolves branch codes (`'mombasa'`/etc) to real Branch UUIDs via lookup with caching

`app/(dashboard)/import/actions.ts` also rewritten to match: removed bad Branch enum import, fixed `batch.target_branch` (not `batch.branch`), correct call signatures.

### 8. Broken `actions/sales.ts`

**Problem:** Referenced `product_code`, `canonical_name`, `branchStock`, `salesOrderLine`, `order.branch`, `order_number` field, `notes` field — none exist in your schema. The `cancelOrder` function was entirely broken.

**Fixed:** Rewrote from scratch:
- Uses real `SaleOrder` fields: `customerId`, `customerName`, `totalAmount`, `status`, `createdBy`
- Creates FinishedGoods shadow per product so SaleItem can link to it
- Status values match enum: `PENDING`/`CONFIRMED`/`SHIPPED`/`CANCELLED`
- Cancel returns stock by writing reverse StockMovement + incrementing `Product.currentStock`

### 9. Broken `actions/stock.ts`

**Problem:** Called `tx.StockMovement` (capital S), used snake_case fields, referenced nonexistent `branchStock` model.

**Fixed:** Rewrote with correct casing (`tx.stockMovement`), camelCase fields, resolves branch UUIDs, logs transfer-out + transfer-in pair (since stock is global, no balance change — just an audit trail).

### 10. Broken `actions/products.ts`

**Problem:** Wrote to many Product fields that don't exist: `org_id`, `product_code`, `canonical_name`, `vehicle_make`, `spring_position`, `shaft_size_mm`, etc.

**Fixed:** Rewrote to use only the real Product fields: `sku`, `name`, `category`, `uom`, `unitCost`, `vendor`, `reorderLevel`, `currentStock`. Kept snake_case form keys for backwards compat (Zod schema maps them to camelCase Prisma fields).

### 11. Broken `actions/raw-materials.ts`

**Problem:** Referenced `rawMaterialBalance` and `rawMaterialMovement` models that don't exist (your schema has `MaterialReceipt` and tracks balance on `RawMaterial.availableKg`).

**Fixed:** Rewrote to:
- Create RawMaterial records with correct fields (`sku`, `materialName`, `diameter`, `costPerKg`, `availableKg`)
- Receive stock via `MaterialReceipt` + increment `availableKg`
- Added the `receiveRawMaterialsBatch(rows)` function that `components/inventory/ExcelRawMaterialUpload.tsx` needs

### 12. Broken `actions/production.ts`

**Problem:** Written against an entirely different production schema (JobCard, productionOrderStage, rawMaterialBalance). None of those models exist. **Not imported anywhere** in current code.

**Fixed:** Replaced with an empty stub. Active production workflow lives in `app/actions/production.ts`, `app/actions/production-order.ts`, and `app/actions/material-consumption.ts` (which we patched separately).

### 13. Sales detail page (app/(dashboard)/sales/[id]/page.tsx)

**Problem:** Used `prisma.salesOrder` (model is `saleOrder` singular Sale), referenced fields that don't exist: `branch`, `order_number`, `invoice_date`, `lines`, `notes`.

**Fixed:** Rewrote against the actual SaleOrder schema — uses `order.id` as invoice number, lists items via the `SaleItem` relation, links to `FinishedGoods.design.name`.

### 14. Customer detail page

**Problem:** Referenced `order.order_number`, `order.invoice_date`, `order.branch`, `line.qty`, `line.product.product_code` (none exist). Wrong relation casing on `finishedGoods`.

**Fixed:** Uses real SaleOrder fields, capital-F `FinishedGoods` relation, correct selects.

### 15. Approvals page

**Problem:** `order.branch?.location` — ProductionOrder has no branch relation.

**Fixed:** Hardcoded as 'Mombasa' (since production happens at Mombasa HQ in this schema).

### 16. nextInvoiceNumber (lib/sales.ts)

**Problem:** Used `prisma.salesOrder` (wrong model name), queried `branch` and `order_number` fields that don't exist.

**Fixed:** Uses `prisma.saleOrder`, parses the `id` field directly (since invoice number IS the id in this schema), filters out drafts and cross-branch prefixes.

## What's now in place

After applying these fixes:

1. **Schema** correctly auto-updates timestamps and auto-generates UUIDs everywhere
2. **Excel upload** at `/import` accepts QuickBooks sales exports, the Springs/U-bolt master sheets, and branch consumables stock files — with preview before commit
3. **Sales orders** create properly with FinishedGoods shadow records, decrement product stock, write audit movements
4. **Stock transfers** log paired movements + audit entry (no actual stock change since stock is global)
5. **Product management** works against the real Product schema with sku/name/uom/unitCost
6. **Raw material batch upload** works via `ExcelRawMaterialUpload` component

## Caveats and follow-ups

1. **Stock is global, not per-branch** in your current schema. `Product.currentStock` is one number. If you want per-branch stock visibility, you'd need to switch to `InventoryFinishedGoods` (which IS per-branch) for finished goods. For consumables that aren't FinishedGoods, you'd need a new model.

2. **FinishedGoods shadow records** — every imported product creates a paired FinishedGoods record with a placeholder "IMPORTED" Design. This is needed because `SaleItem.finishedGoodsId` is required. If you later create proper Designs for your products, you can re-link the SaleItems.

3. **Production workflow** wasn't fully audited. The active files (`app/actions/production.ts` etc.) were patched for BOM relation names but the broader flow needs end-to-end testing against your actual data.

4. **The Excel import preview** stores the file buffer base64-encoded in `ImportBatch.file_url` between upload and commit. For files over ~5MB this could be slow. If you want to upload bigger files, move this storage to Supabase Storage instead.
