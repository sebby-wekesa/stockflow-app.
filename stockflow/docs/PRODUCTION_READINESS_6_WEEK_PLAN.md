# StockFlow – 6-Week AI-Assisted Production Readiness Sprint Plan

**Date:** 2026-05-23  
**Author:** Kilo (AI Software Engineer) + Human Developer  
**Project:** StockFlow Manufacturing ERP (Next.js 16 + Prisma 7 + Supabase)  
**Target:** Production-ready for first real customer (single-org safe) by end of Week 6, with foundation for true multi-tenant rollout in Week 7+

## Progress (as of 2026-05-24)

**Week 1 – Type Safety**
- ✅ `ignoreBuildErrors: false` in next.config.ts
- ✅ `tsc --noEmit` clean (0 errors)
- ✅ Production build (`npm run build`) succeeds cleanly
- ✅ Major camelCase relation alignment + organizationId scoping completed in previous commit + this session

**Week 2 – Tenant Coverage (in progress)**
- ✅ Converted `app/actions/stage-completion.ts`
- ✅ Converted `app/(dashboard)/rawmaterials/page.tsx`
- ✅ Converted `app/(dashboard)/sales-orders/page.tsx`
- ✅ Converted `app/(dashboard)/pack_queue/page.tsx`
- ✅ Converted `app/(dashboard)/approvals/page.tsx`
- ✅ Converted `app/(dashboard)/admin/yield/page.tsx`
- ✅ Converted `app/api/production/log-stage/route.ts`
- ✅ Converted `app/api/stages/complete/route.ts`
- ✅ Converted `app/api/production-orders/create-with-reservation/route.ts`
- ✅ Converted `app/api/production-orders/[id]/status/route.ts`
- ✅ All `/api/production*` routes now fully tenant-scoped
- ✅ /api/stages group complete
- ✅ Converted `app/api/logs/route.ts`
- ✅ Converted `app/api/reports/export-csv/route.ts`
- ✅ All `/api/logs` + `/api/reports` routes now tenant-scoped

**Action files (Week 2 core business logic batch):**
- ✅ Converted `app/actions/production.ts` (operator queue, history, logging — critical)
- ✅ Converted `app/actions/materials.ts`
- ✅ Converted `app/actions/sales-orders.ts` (create, get, confirm, cancel)
- ✅ Converted `app/actions/sales.ts` (catalogue + my orders)
- ✅ Converted customer pages: app/(dashboard)/customers/page.tsx and [id]/page.tsx
- ✅ Converted inventory action: app/actions/inventory.ts
- ✅ Converted inventory APIs: intake, materials, products routes
- ✅ Converted reports action: app/actions/reports.ts
- ✅ Converted reports APIs: production, sales, stock routes
- ✅ Converted scanning action: app/actions/scanning.ts (scanBarcode + processScan + getRecentScans)
- ✅ Converted export action: app/actions/export.ts (exportYieldToCSV)
- ✅ Converted designs batch:
  - app/actions/designs.ts
  - app/api/designs/route.ts
  - app/(dashboard)/admin/designs/page.tsx
  - app/(dashboard)/designs/page.tsx
  - app/production/new/page.tsx (design fetching)
- ✅ Converted finished goods page: app/(dashboard)/finishedgoods/page.tsx
- ✅ Converted jobs pages: app/(dashboard)/jobs/page.tsx and [id]/page.tsx
- ✅ Converted sales pages: app/(dashboard)/sales/page.tsx, [id]/page.tsx, and new/page.tsx
- ✅ Converted stock/transfer page: app/(dashboard)/stock/transfer/page.tsx
- ✅ Converted user pages: app/(dashboard)/users/page.tsx and app/(dashboard)/admin/users/page.tsx
- ✅ Converted catalogue page: app/(dashboard)/catalogue/page.tsx
- ✅ Converted operator / stage-logger files:
  - app/(dashboard)/stage-logger/page.tsx
  - app/(dashboard)/operator/actions.ts
  - app/operator/history/page.tsx
- ✅ Converted packaging / barcodes actions:
  - app/actions/barcodes.ts (generateRawMaterialBarcode, generateFinishedGoodsBarcode, getBarcodeData)
  - app/actions/packaging.ts (getPackagingQueue, fulfillOrder, getPackagingStats)
- ✅ Converted stock alerts + warehouse routes:
  - app/actions/stock-alerts.ts (getLowStockAlerts, getStockLevelHistory, getReorderSuggestions)
  - app/api/warehouse/low-stock/route.ts
  - app/api/warehouse/stats/route.ts
- ✅ Converted customer portal actions: app/actions/customer-portal.ts
- ✅ Converted major dashboard actions file: app/actions/dashboard.ts (getDashboardStats, getManagerData, approveOrder + supporting queries)

- Production build succeeds cleanly
- `tsc --noEmit` now exits with 0 errors
- Current raw `@/lib/prisma` direct imports: **19 files** (target: 3–5 exceptions by end of week)

---

## Executive Goal

By the end of Week 6 we will have:

- Zero TypeScript errors (`tsc --noEmit` clean)
- Full tenant isolation on every active data path
- Basic isolation tests passing
- Security surface hardened
- One trusted customer (Springtech) successfully running their full workflow on a production-like deployment

True multi-tenant (multiple external organizations) will be ready for controlled pilot immediately after Week 6.

---

## Working Assumptions

- Developer works 5–6 focused hours per day.
- AI (Kilo) is used as a pair-programming partner for code generation, refactoring, test writing, and error triage.
- Real Excel files and production-like data are available for testing from Week 1.
- The hardest architectural work (multi-tenancy Stage 3) is already complete.

---

## Week-by-Week Plan

### Week 1: Type Safety – Eliminate the 465 Errors

**Goal**  
`ignoreBuildErrors: false` and `tsc --noEmit` passes (or ≤ 20 non-blocking errors remaining).

**Key Tasks**
- Remove `ignoreBuildErrors: true` from `stockflow/next.config.ts`
- Systematically fix the dominant error patterns:
  - Relation casing: `Design` → `design`, `BillOfMaterials` → `billOfMaterials`, `Stage` → `stages`
  - Add `organizationId` (and `Organization` relation) to all `create`/`createMany` calls for:
    - `StageLog`, `FinishedGoods`, `Product`, `RawMaterial`, `SaleItem`, `StockMovement`, `AuditLog`, `ProductionOrder`
  - Remove implicit `any` across actions, API routes, and import modules
- Priority files to attack first:
  - `app/api/production-orders/**/*`
  - `app/api/production/log-stage/route.ts`
  - `app/api/stages/complete/route.ts`
  - `lib/import/importEngine.ts`, `mombasa-processors.ts`, `specialized-commit.ts`
  - `actions/stage-completion.ts`
  - `app/(dashboard)/admin/yield/page.tsx`, `approvals/page.tsx`
  - `components/sales/SalesForm.tsx`, `SalesOrderForm.tsx`, `OrderActions.tsx`

**AI Collaboration Points**
- Paste daily `tsc --noEmit` output (or top 30 errors) → AI returns exact `edit` patches.
- AI generates safe helper functions for `organizationId` injection and relation fixes.

**Definition of Done**
- `cd stockflow && npx tsc --noEmit` succeeds locally.
- Production build succeeds with the flag removed.

---

### Week 2: Complete Tenant Coverage – Remove All Raw `prisma` Calls

**Goal**  
Every read/write that touches tenant-scoped data goes through `getTenantPrisma(user.organizationId)` or `withTenantTransaction`.

**Key Tasks**
- Convert all remaining raw `prisma` usage:
  - `app/(dashboard)/rawmaterials/page.tsx`
  - `app/(dashboard)/sales-orders/page.tsx`
  - `app/(dashboard)/pack_queue/page.tsx`
  - `app/(dashboard)/approvals/page.tsx`
  - `app/(dashboard)/admin/yield/page.tsx`
  - All `/api/production*`, `/api/logs`, `/api/stages`, `/api/reports` routes
  - `actions/stage-completion.ts`
- Fix type errors inside `lib/tenant-prisma.ts` (proxy casting)
- Update any legacy import paths still bypassing the tenant client
- Add `requireActiveAuth()` + tenant client to any missed action files

**AI Collaboration Points**
- Point AI at any file → it produces the converted, tenant-scoped version.
- Request a lightweight “tenant wrapper” helper to reduce boilerplate if desired.

**Definition of Done**
- Grep for direct `from ['"]@/lib/prisma['"]` (outside seed, tests, super-admin) returns only 3–5 explicitly approved exceptions.
- All customer-facing flows are provably tenant-isolated.

---

### Week 3: Prove Isolation – Tests + Boundary Hardening

**Goal**  
Demonstrate that tenant isolation is reliable and cannot be accidentally broken.

**Key Tasks**
- Create integration-style tests (`lib/__tests__/tenant` or `__tests__/tenant`):
  - Two organizations → user from Org A cannot read Org B’s products, orders, stock, stage logs, etc.
  - `findUnique` on another org’s record returns `null`
  - Transaction paths respect scoping
- Run tests against real seeded data for two organizations
- Decision point: implement Postgres Row-Level Security (RLS) policies **or** document that application-level scoping + tests are the permanent control (with mandatory code review)
- If choosing RLS: generate and apply policies for all 25+ tenant tables

**AI Collaboration Points**
- AI writes the test scaffolding and the first 8–10 isolation test cases.
- AI generates the full RLS migration SQL if that path is selected.

**Definition of Done**
- All isolation tests pass consistently.
- Either RLS policies are live and verified, or a clear “why we chose app-level only” document exists.

---

### Week 4: Security Hardening

**Goal**  
Close obvious attack surface before real external data or users.

**Key Tasks**
- Tighten Content-Security-Policy in `next.config.ts` (remove `unsafe-inline` / `unsafe-eval` where possible; use nonces)
- Add rate limiting on sensitive endpoints (import, auth, admin actions) – e.g. Upstash or simple in-memory limiter
- Ensure every sensitive action writes an `AuditLog` entry with `organizationId`
- Remove magic branch strings (`'mombasa'`, `'nairobi'`, `'bonje'`) – replace with proper `branchId` resolution
- Lock down admin-only and super-admin routes
- Add basic structured error tracking (Sentry or equivalent)

**AI Collaboration Points**
- AI generates rate-limit middleware and updated CSP config.
- Point AI at any endpoint → it adds proper audit logging.

**Definition of Done**
- All high-priority security items from the May 2026 code review are green.
- CSP is production-grade.

---

### Week 5: Performance, Polish & Legacy Cleanup

**Goal**  
Make daily use fast and remove technical drag.

**Key Tasks**
- Add pagination (or virtualized tables) to:
  - Production jobs / orders list
  - Stock ledger
  - Sales list
  - Import history
- Delete or clearly archive dead code:
  - `lib/import/unified-*`
  - `excel-splitter.ts`
  - References to old `ProductMaster` / `SalesTransaction`
  - Duplicate import forms
- Add loading skeletons and error boundaries to major pages
- Basic connection-pool and slow-query visibility (structured logs or Supabase metrics)
- Remove noisy `console.log` statements from hot paths

**AI Collaboration Points**
- AI generates reusable pagination components and performs large-scale refactors.
- AI safely deletes dead code after you approve the list.

**Definition of Done**
- Major list pages load in < 2 seconds with realistic data volumes.
- Codebase feels noticeably lighter and more maintainable.

---

### Week 6: End-to-End Validation & Pilot Preparation

**Goal**  
You are confident shipping to the first real customer.

**Key Tasks**
- Full manual + scripted end-to-end test of the complete flow:
  - Excel import → Sales order → Stock movement → Production order → Stage logging → Finished goods
- Run the entire application with `ignoreBuildErrors: false` and `NODE_ENV=production` build
- Create and maintain a one-page “Production Readiness Checklist”
- Write a minimal runbook covering:
  - Onboarding a new organization
  - Handling a failed import
  - Rolling back bad data
- Deploy to a staging environment that mirrors production
- Run a 3–5 day pilot with Springtech on the staging URL
- Fix any issues discovered during the pilot

**AI Collaboration Points**
- AI helps draft the checklist and runbook.
- During the pilot you can paste any error or unexpected behaviour → AI delivers same-day fixes.

**Definition of Done**
- Green pilot with real data for 3+ days.
- Zero new critical bugs introduced during the pilot window.
- Production Readiness Checklist signed off.

---

## Overall Success Metrics (End of Week 6)

- `tsc --noEmit` passes cleanly
- Every active data path uses the tenant-scoped Prisma client
- Isolation tests pass
- Production build succeeds
- First real customer can run their full workflow without data leakage or type-related crashes
- Repeatable, documented process exists for safely adding the next customer

---

## How to Work With AI Throughout the Sprint

1. **Daily TypeScript triage**  
   Run `cd stockflow && npx tsc --noEmit > tsc-errors.txt 2>&1` and share the file (or the first 30 lines) with the AI.

2. **Refactoring requests**  
   `read` the target file, then say:  
   “Convert this file to use `getTenantPrisma(user.organizationId)`”  
   or “Write tenant-isolated version of this API route”.

3. **Test generation**  
   “Write isolation tests for products and stage logs” or “Generate RLS migration for all tenant tables”.

4. **Live debugging**  
   Paste any runtime error, stack trace, or unexpected behaviour during testing or pilot. The AI will produce the exact patch.

---

## Getting Started (Week 1 – Day 1)

1. Open `stockflow/next.config.ts` and set `ignoreBuildErrors: false`.
2. Run `cd stockflow && npx tsc --noEmit` and capture the output.
3. Share the output with the AI.
4. Begin burning down the error list together.

---

**This document is the single source of truth for the 6-week production readiness effort.**  
Update it weekly with actual progress, blockers, and any scope adjustments.

**Next step:** Begin Week 1 immediately by sharing the first TypeScript error report. The AI is ready.

---

*Generated by Kilo on 2026-05-23*  
*Location: `stockflow/docs/PRODUCTION_READINESS_6_WEEK_PLAN.md`*
