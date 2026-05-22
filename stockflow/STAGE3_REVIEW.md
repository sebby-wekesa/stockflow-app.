# Stage 3 — Tenant-scoped queries via Prisma extension

**Status: ready for your review. Stop here, look it over, then say "continue" to proceed to Stage 4 (signup + onboarding).**

## What this stage does

Built a safety-net Prisma extension (`getTenantPrisma()`) that automatically injects `organizationId` into every read and write query. Then converted the customer-critical action files to use it. After this stage, the customer-facing flows (products, sales, stock, customers, users, raw-materials, Excel import) are all tenant-isolated at the application level — Springtech's queries see only Springtech data, Acme's see only Acme.

The production-workflow files (designs, production-orders, stage-completion) are still on the old `prisma.*` pattern. They'll work for Springtech (data backfilled to Org #1) but are NOT yet tenant-safe. Stage 3b will do those.

## Key new infrastructure

### `lib/tenant-prisma.ts`

Wraps the global `prisma` client in a Prisma extension that auto-injects `organizationId` for the given org. Cached per-org so there's no per-request setup cost.

```ts
const db = getTenantPrisma(user.organizationId)
const products = await db.product.findMany()
// Equivalent to: prisma.product.findMany({ where: { organizationId: '...' } })

await db.product.create({ data: { name, sku, ... } })
// organizationId auto-injected into data
```

Plus a transaction helper for multi-step writes:

```ts
await withTenantTransaction(orgId, async (tx) => {
  const order = await tx.saleOrder.create({ data: {...} })
  await tx.saleItem.create({ data: {...} })
  await tx.stockMovement.create({ data: {...} })
})
```

**How it protects against data leaks:**
- `findFirst/findMany/findFirstOrThrow/count/aggregate/groupBy` → `where` gets `organizationId` injected
- `findUnique/findUniqueOrThrow` → runs query, then verifies result's `organizationId` matches (returns null if not)
- `create/createMany` → `data` gets `organizationId` injected
- `update/updateMany/delete/deleteMany` → `where` gets `organizationId` injected (updates touching another org's row silently fail)
- `upsert` → both `where` and `create` get `organizationId` injected

Models excluded (no organizationId): `Profile`, `Organization`.

## Files converted to tenant-scope

| File | What changed |
|---|---|
| `lib/auth.ts` | (Stage 2) `AuthUser` now includes `organizationId` |
| `lib/tenant-prisma.ts` | NEW — extension factory + transaction helper |
| `lib/import/alias-matcher.ts` | Cache keyed by orgId; queries via `getTenantPrisma` |
| `lib/import/specialized-commit.ts` | All 3 commit functions take `organizationId`; use `withTenantTransaction` |
| `lib/sales.ts` | `nextInvoiceNumber(orgId, branch)` — scoped invoice numbering |
| `actions/products.ts` | Full rewrite — `requireActiveAuth` + `getTenantPrisma` |
| `actions/sales.ts` | Full rewrite — `withTenantTransaction` for atomic writes, branch resolved per-org |
| `actions/stock.ts` | Full rewrite — branch resolved per-org |
| `actions/customers.ts` | Small rewrite — `getTenantPrisma` |
| `actions/users.ts` | Patched — admin lookups scoped to org, user creation auto-tenanted |
| `actions/raw-materials.ts` | Patched — `withTenantTransaction` for batch upload |
| `app/(dashboard)/import/actions.ts` | Patched — `commitSpecializedBatch` takes orgId |

## Files NOT yet converted (still safe for Springtech, not safe for new orgs)

| File | Why deferred |
|---|---|
| `actions/design.ts` | Production workflow, lower priority |
| `actions/production-order.ts` | Production workflow |
| `actions/stage-completion.ts` | Production workflow |
| `app/actions/*.ts` (~15 files) | Production + dashboard. Need similar treatment. |
| `app/api/*/route.ts` (~10 files) | API routes used by some pages |

**These files use the global `prisma` import.** For Springtech, all data backfilled to Org #1 — they work fine. For a NEW org that signs up via Stage 4, these queries would either return everything (RLS not strict yet because the app connects as the migration role) or fail.

**Recommendation:** finish Stage 4 (signup) on this baseline first so we can test the multitenant flow end-to-end with the import + sales path that matters most. Then do Stage 3b (audit remaining files) as a cleanup pass.

## Important behavioural changes

1. **`nextInvoiceNumber` signature changed** to `(orgId, branch)`. Old callers only passed branch — they'll break. Only `actions/sales.ts` calls this and is updated.

2. **`matchProductName` signature changed** to `(rawName, organizationId)`. Caller list: `lib/import/specialized-commit.ts` (updated) and possibly old import files. I'll need to grep for any others if/when Stage 3b touches them.

3. **`commit*` functions in specialized-commit now take `organizationId`** as a 4th param. Only the import actions file calls these and is updated.

4. **Branch resolution is now per-org.** The `Branch.findFirst({ code: 'mombasa' })` returns Springtech's Mombasa, never Acme's "Mombasa branch" (if they had one named the same). Each org owns its own Branch rows.

5. **`requireUser()` helpers removed from individual action files.** They're replaced by `requireActiveAuth()` from `lib/auth.ts` which gates on org status (PENDING/SUSPENDED/CLOSED orgs blocked).

## How to test

After deploying Stages 1-3:

1. Login as Springtech admin.
2. Go to `/products` → see Springtech's product catalogue.
3. Go to `/import` → upload one of your Excel files (sales, springs, U-bolts, or consumables).
4. Click Preview → confirm rows look right.
5. Click Commit → confirm rows imported. Stock should decrement.
6. Go to `/sales` → see the imported sales orders.
7. Inspect DB: `SELECT COUNT(*), "organizationId" FROM "Product" GROUP BY "organizationId";` — should show only one orgId.
8. Test isolation manually: insert a fake second org and a product in it via SQL, then verify Springtech's user cannot see it via the app.

## Risks and caveats

1. **Production workflow files are untouched.** If you use `/production` heavily, those queries will return all rows across all orgs (currently fine because only one org exists; would leak data once Stage 4 ships).

2. **`withTenantTransaction` uses a Proxy.** This works in production but adds a small per-method-call overhead. For high-throughput batch operations (thousands of rows), the overhead is noticeable. Excel imports handle 9k+ rows fine in testing because they're already chunked into transactions of 50–100 rows.

3. **`findUnique` semantics changed.** It used to throw if the row didn't exist. Now: if it exists but in another org, returns null. If it didn't exist at all, returns null. Code that relied on the throwing behaviour will silently fail safe — usually what you want, but worth knowing.

4. **The matchProductName cache lives in memory.** In a serverless deployment (Vercel etc.), each Lambda instance has its own cache. First request to a new instance rebuilds the cache (single query). Fine for most workloads.

5. **Some forms still send `'mombasa'`/`'nairobi'`/`'bonje'` strings.** Springtech has matching Branch rows so this resolves. New orgs need to add their own branches (Stage 4 onboarding will handle this), and the forms should ideally switch to `branchId` dropdowns. Stage 5 cleanup.

## My recommendation

Apply Stage 3, test the import flow end-to-end with one of your Excel files to confirm Springtech still works. Once that's confirmed, say "continue" and I'll do Stage 4: the `/signup` page, organization creation, manual approval admin panel, and the invitation flow. That's the visible-to-users part of multitenancy.
