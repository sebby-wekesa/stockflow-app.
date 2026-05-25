# Tenant Isolation Tests

This directory contains tests that prove data isolation between organizations.

## Current Approach

We are using **application-level tenant scoping** via `getTenantPrisma(user.organizationId)`.

All reads and writes go through this scoped client, which injects `organizationId` filters.

## Running the Tests

```bash
cd stockflow
pnpm test __tests__/tenant
```

For realistic integration tests you currently need either:

1. A real PostgreSQL test database with at least two organizations seeded, or
2. PGlite (already present in the dependency tree)

## Current Test Coverage (as of 2026-05-25)

- Products (visibility + cross-org findUnique)
- ProductionOrder
- StageLog

## Recommended Future Coverage (Week 3)

- SaleOrder + SaleItem
- RawMaterial + MaterialReceipt + consumption paths
- FinishedGoods
- StockMovement
- All create/update paths that must stamp organizationId
- Transaction boundaries (`consumeMaterialsForOrder`, stage handoff, fulfillOrder, etc.)
- Negative tests for create paths with wrong organizationId

## RLS Decision Point — **RECORDED 2026-05-25**

**Decision: Application-level scoping only**

We are **not** implementing Postgres RLS at this stage.

Rationale:
- Application-level scoping via `getTenantPrisma()` is already comprehensive.
- For the pilot, tests + code review provide sufficient guarantees.
- RLS adds operational overhead that can be evaluated after the first customer pilot.

All tests in this directory assume and enforce application-level isolation.

## Next Steps

1. Extend seed script to support multiple organizations for testing.
2. Add real data assertions once test DB strategy is chosen.
3. Add negative tests (user from Org A tries to access Org B data directly).
4. Add transaction isolation tests.
