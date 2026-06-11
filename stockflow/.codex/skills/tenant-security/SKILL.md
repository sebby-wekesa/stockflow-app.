---
name: tenant-security
description: Use this skill when reviewing or changing organization scoping, role permissions, authorization, branch access, or tenant-safe database queries in StockFlow.
---

# Tenant Security Skill

StockFlow is a multi-tenant ERP. Organization isolation is critical.

## Golden Rule

Never allow data from one organization to be visible or editable by another organization.

## Required Pattern

Prefer tenant-aware helpers:

```ts
getTenantPrisma(organizationId)
```

Avoid raw Prisma client usage except in:

- seeds
- tests
- reviewed infrastructure code

## Role Permissions

Common roles:

- `ADMIN`: system administration and reporting
- `MANAGER`: production approval and management
- `ACCOUNTS`: accounting, journals, banking, debtors, and creditors
- `OPERATOR`: department stage work only
- `SALES`: sales orders and customer management
- `PACKAGING`: packaging and fulfillment
- `WAREHOUSE`: raw material intake

## Authorization Checks

Before data access, verify:

1. authenticated user exists
2. local app user exists
3. user belongs to organization
4. user has required role
5. branch access is valid where needed

## Security Rules

- Never trust client-provided `organizationId` without server validation.
- Never expose service role keys.
- Never bypass middleware or server-side auth checks.
- Never return cross-tenant records in list views, reports, exports, or APIs.
- Validate tenant ownership of accounting foreign keys before posting ledger lines or payments.
- Use tenant-scoped transactions for journals and payments so their related writes stay atomic.
- Add tests for tenant-scoped behavior when changing shared data access.
