---
name: accounting-management
description: Use this skill when building or fixing StockFlow chart of accounts, journal entries, general ledger, trial balance, banking, payments, debtors, creditors, or sales-to-ledger posting.
---

# Accounting Management Skill

StockFlow accounting is tenant-scoped double-entry bookkeeping.

## Access

- Restrict accounting pages and actions to `ADMIN` and `MANAGER`.
- Use `getTenantPrisma(organizationId)` for reads and `withTenantTransaction` for multi-write operations.
- Validate every referenced account, customer, supplier, and bank account belongs to the active organization.

## Posting Rules

- Route every journal through `postJournalEntry`; never write ledger lines directly.
- A journal needs at least two active tenant accounts, non-negative single-sided lines, and equal debit and credit totals.
- Use stable system-account keys from `lib/accounting/chart-of-accounts.ts`.
- Auto-post only confirmed, ready-for-dispatch, or shipped sales:
  - Debit Accounts Receivable
  - Credit Sales Revenue
- Void the posted sale journal when a confirmed sale is cancelled.
- Keep source document posting idempotent through `source`, `sourceType`, and `sourceId`.

## Payments

- Customer receipt: Debit Bank/Cash, Credit Accounts Receivable.
- Supplier payment: Debit Accounts Payable, Credit Bank/Cash.
- `RECEIVED` requires a tenant customer and no supplier.
- `PAID` requires a tenant supplier and no customer.
- Reject an invalid requested bank account; only fall back to Cash on Hand when no bank account was requested.

## Reports

- Trial balance and ledger only include `POSTED` journals.
- Date-only report filters must include the full selected end date.
- Debtors include confirmed or later sales, less received payments.
- Creditors include approved or later purchases, less paid payments.

## Verification

Run:

```bash
pnpm prisma validate --schema=./prisma/schema.prisma
pnpm prisma generate --schema=./prisma/schema.prisma
npx tsc --noEmit
pnpm test -- lib/accounting
```
