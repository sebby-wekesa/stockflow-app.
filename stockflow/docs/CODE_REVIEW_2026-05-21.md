# StockFlow Full Codebase Review & Advice

**Date:** 2026-05-21  
**Reviewer:** Kilo (AI Software Engineer)  
**Project:** StockFlow - Manufacturing Management System (Next.js + Prisma + Supabase)  
**Working Directory:** `C:\Users\sebby\Desktop\stockflow-app\stockflow`

---

## Executive Summary

StockFlow is an ambitious manufacturing ERP system covering production orders with multi-stage tracking and yield calculation, inventory (raw materials + finished goods), sales, BOMs, Excel imports, user roles, branches, and reporting.

**Tech stack is modern**: Next.js 16, React 19, TypeScript, Prisma 7, PostgreSQL (Supabase), Supabase Auth, Tailwind.

**Core problem**: The multi-tenant architecture is fundamentally broken and inconsistent. Tenant isolation is half-implemented, creating a high risk of cross-organization data leakage. This is the #1 blocker for any real production deployment with multiple customers.

**Secondary problems**: Heavy use of `any`, disabled TypeScript error checking, unsafe raw SQL, per-tenant Prisma clients that leak connections, massive monolithic components, scattered auth/role logic, and many other maintainability issues.

The feature set and domain understanding are strong. With focused fixes on the foundation (especially tenant isolation + type safety), this can become a solid, professional product.

---

## Critical Issues

### 1. Tenant Isolation / Multi-Tenancy is Broken (Highest Priority)

**Evidence**:
- In `prisma/schema.prisma`, only `Branch` and `User` have `organizationId`. All core domain models lack it:
  - `ProductionOrder`
  - `Design`
  - `Stage`
  - `BillOfMaterials`
  - `RawMaterial`
  - `FinishedGoods`
  - `SaleOrder`
  - `StageLog`
  - `InventoryRawMaterial`
  - `InventoryFinishedGoods`
  - `MaterialReceipt`
  - etc.

- Two conflicting tenant mechanisms:
  - `lib/tenant.ts` + `withTenant()` — correct pattern using `SET LOCAL app.current_org_id` for Postgres RLS.
  - `lib/tenant-prisma.ts` — application-level Prisma extension that only covers a hardcoded list of ~12 models and **creates a brand new `new PrismaClient()` per organization** (no pooling, memory leak, connection exhaustion risk).

- Most of the application still calls the **global `prisma`** directly (e.g. `app/actions/production.ts`, dashboard, stock pages, jobs, sales, etc.) with only ad-hoc `branchId` filters or no filter.

- `lib/tenant-prisma.ts:121` uses `$executeRawUnsafe` with string interpolation of `organizationId`.

**Impact**: Real risk of one organization seeing another organization's production orders, inventory, sales, etc. The "multi-tenant" system is currently theater.

**Recommendation**: Stop all new feature work until this is fixed.

---

### 2. Type Safety is Effectively Disabled

- 140+ occurrences of `: any` and `any[]` across the codebase (dashboard alone has dozens).
- `next.config.ts`:
  ```ts
  typescript: {
    ignoreBuildErrors: true,
  },
  ```
- This hides real bugs and defeats the purpose of using TypeScript.

**Fix**: Remove `ignoreBuildErrors`, introduce proper types/DTOs, and gradually eliminate `any`.

---

### 3. Security & Authentication Weaknesses

- Middleware trusts `user_metadata.role` and `orgStatus` directly from Supabase JWT. Client-side metadata can be manipulated unless strictly controlled server-side.
- `lib/auth.ts:getUser()` performs a DB lookup but does **not** consistently enforce org status gating (tenant.ts does it in some paths).
- Raw SQL risks in two places:
  - `lib/tenant.ts:121`
  - `app/api/production-orders/[id]/status/route.ts:148`
- Overly permissive CSP (`'unsafe-inline' 'unsafe-eval'`).
- Role checks are scattered across middleware, layouts, `RoleGuard`, and individual actions — easy to miss a route.
- No rate limiting on sensitive endpoints.
- Minimal audit logging.

---

### 4. Prisma / Database Connection Management is Dangerous

- `lib/tenant-prisma.ts` creates a fresh `PrismaClient()` for every organization and caches them forever. This will exhaust Supabase connection limits very quickly.
- No `prisma.$disconnect()` anywhere.
- The correct `withTenant` pattern in `tenant.ts` is rarely used.
- Many N+1 query patterns (especially around orders + stages + designs).
- Legacy duplicate models (`ProductMaster`, `SalesTransaction`, `inventory_transactions`) coexist with the new normalized schema.

---

### 5. Code Quality & Maintainability Issues

- Massive monolithic file: `app/(dashboard)/dashboard/page.tsx` (~660 lines) contains 6 completely different role-specific dashboards.
- Duplicate logic for sales imports, stock calculations, and production flows in multiple places.
- Inconsistent project structure (`app/actions/` vs root `actions/`, mixed API routes and server actions).
- Hardcoded strings and magic values ("current-operator", "org-1", branch codes like `'mombasa'`).
- 7+ TODO comments left in production code.
- Excessive `console.log` statements in hot paths (middleware, prisma init).
- Large components that mix UI, data fetching, and business logic.
- Very minimal ESLint config (just stock Next.js presets).

---

### 6. Performance & Scalability Concerns

- Entire Excel files loaded into memory during imports.
- No pagination on any list views (jobs, stock, sales, import history, etc.).
- Per-tenant Prisma clients + repeated full scans.
- Dashboard performs many separate queries on every load with no caching or materialized views.
- No connection pooling tuning visible beyond very conservative limits.

---

## Positive Aspects

- Ambitious and mostly correct domain model for a real manufacturing environment (stages, yield, scrap reasons, BOM, multi-branch inventory).
- Sophisticated import system (column mapping, alias matching, preview/commit workflow, specialized parsers).
- Good intent with tenant context + RLS + Prisma extension pattern.
- Heavy use of server actions and Zod validation in newer code.
- Comprehensive documentation in `/docs`.
- Feature completeness is impressive for the stage of the project.

---

## Recommended Roadmap (Priority Order)

### Phase 1: Foundation (Must Fix Before Anything Else)

1. **Tenant Isolation Fix** (1–2 weeks)
   - Add `organizationId` (and `branchId` where needed) to **all** relevant models via Prisma migration.
   - Choose **one** tenant strategy and enforce it everywhere:
     - Preferred: Use `withTenant(ctx, tx => ...)` + Row-Level Security (the pattern in `lib/tenant.ts`).
     - Or make the Prisma extension the single source of truth and remove all direct `prisma.` calls.
   - Delete or heavily refactor `tenant-prisma.ts` (never create new clients per tenant).
   - Audit every single `prisma.` usage and wrap it with tenant context.
   - Remove all string-based branchId hacks.

2. **Type Safety Restoration**
   - Set `ignoreBuildErrors: false`.
   - Introduce proper types for all queries and components.
   - Eliminate `any` usage (start with the dashboard and import modules).

3. **Security Hardening**
   - Stop relying on JWT metadata for roles/org status — always re-validate from the DB inside tenant context.
   - Replace the two `$executeRawUnsafe` calls with safe parameterized queries.
   - Tighten CSP.
   - Add basic rate limiting.
   - Centralize all role/tenant checks.

### Phase 2: Code Health

4. Split the monster dashboard into role-specific components.
5. Remove duplicate import/sales/stock logic.
6. Add proper pagination, loading states, and error boundaries.
7. Clean up console.logs and TODOs.
8. Improve ESLint with custom rules for security and Prisma usage.

### Phase 3: Operational & Testing

9. Set up real monitoring (connection pool, query performance).
10. Add integration tests for:
    - Tenant isolation (cross-org leakage tests)
    - Production order lifecycle
    - Import commit flows
11. Implement proper error tracking (Sentry, etc.).
12. Update seed data to use proper UUIDs and current schema.

---

## Quick Wins (Low Effort, High Value)

- Remove `ignoreBuildErrors: true` today.
- Add a barrel export `lib/db.ts` that always returns the tenant-aware client.
- Replace the 6-role monster dashboard with a router or proper component split.
- Add `organizationId` to `ProductionOrder` as the very first migration.

---

## Files & Areas That Need Immediate Attention

| Area                        | Risk Level | Key Files |
|----------------------------|------------|-----------|
| Tenant isolation           | Critical   | `lib/tenant.ts`, `lib/tenant-prisma.ts`, `prisma/schema.prisma`, all `prisma.` calls |
| Type safety                | High       | `next.config.ts`, dashboard page, import modules, actions |
| Auth & roles               | High       | `middleware.ts`, `lib/auth.ts`, `components/RoleGuard.tsx` |
| Prisma client management   | High       | `lib/prisma.ts`, `lib/tenant-prisma.ts` |
| Dashboard & UI architecture| Medium     | `app/(dashboard)/dashboard/page.tsx` |
| Import system              | Medium     | `lib/import/*`, `app/(dashboard)/import/*` |
| Production flow            | Medium     | `app/actions/production.ts`, stage logging components |

---

## Final Verdict

**Strengths**: Excellent domain coverage and feature ambition. The team clearly understands manufacturing workflows.

**Weaknesses**: The current multi-tenancy implementation makes the app unsafe for real multi-customer use. TypeScript is largely disabled. Connection management will fail under load.

**Advice**: Treat tenant isolation + type safety as **P0 bugs**, not future improvements. Once those are fixed, the rest of the codebase becomes maintainable and the existing feature work will shine.

This project has strong potential. With 3–4 weeks of focused foundation work, it can go from "risky prototype" to "production-ready manufacturing system."

---

**Generated by Kilo on 2026-05-21**  
Location: `stockflow/docs/CODE_REVIEW_2026-05-21.md`
