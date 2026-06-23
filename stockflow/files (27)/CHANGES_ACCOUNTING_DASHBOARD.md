# Accounting Dashboard Redesign (TJ's notes)

The accounting dashboard is now a **statement-structured account tree** that
doubles as the data-entry point for your account structure — exactly as TJ
described. The old card grid is gone.

## What it looks like now

The dashboard is a list of headings, grouped into two statements:

**Balance Sheet**
- Non-Current Assets · Current Assets · Non-Current Liabilities · Current Liabilities · Equity

**Income Statement**
- Revenue · Other Income · Cost of Goods Sold · Administrative Expenses · Other Operating Expenses · Finance Charges

Each heading has a **"+" to expand** (showing the accounts under it) and one
**"Add Account"** button on the right. Expanding shows each account by **Name**,
**Type**, its **live balance**, and a **"Report"** link that opens every entry
posted to that account (running balance and all). The heading shows a rolling
total that updates from every posting — so the balance sheet and income
statement build themselves as you post.

## Add Account form (TJ's fields)

Opening "Add Account" under a heading gives a form with: **Account Name**,
**Currency** (defaults KES), **Classification** (the 15-option dropdown — Income,
Expense, Fixed Assets, Bank, Loan, Equity, Accounts Receivable, Other Current
Assets, Other Assets, Accounts Payable, Other Current Liability, Long Term
Liability, Cost of Goods Sold, Other Income, Other Expense), optional
**sub-account of** (parent), **description**, **note**, and a **VAT applies**
tick box.

The clerk never types an account code — it's generated automatically from the
account's type band (1000s assets, 2000s liabilities, etc.), keeping data entry
simple as TJ wanted.

## How classifications map (your choice: map to existing types/headings)

Each of the 15 classifications maps to one of the 5 base account types (so the
double-entry posting engine is unchanged) **and** to one of the 11 headings (so
the account lands in the right place):

- Fixed Assets / Other Assets → Non-Current Assets
- Bank / Accounts Receivable / Other Current Assets → Current Assets
- Loan / Long Term Liability → Non-Current Liabilities
- Accounts Payable / Other Current Liability → Current Liabilities
- Equity → Equity
- Income → Revenue · Other Income → Other Income
- Cost of Goods Sold → Cost of Goods Sold
- Expense → Administrative Expenses · Other Expense → Other Operating Expenses

Finance Charges has no direct classification, so it's filled by adding an account
under that heading (the heading you open "Add Account" from is remembered, so the
account files there even though its classification is an expense type).

Existing seeded accounts (which predate classifications) are placed by a
type+code fallback, so they show under the right headings immediately without any
data migration.

## Files

| File | State | Purpose |
|---|---|---|
| `prisma/schema.prisma` | already added (prior session) | `classification`, `statementGroup`, `currency`, `note`, `vatApplicable` on ChartAccount + enums `AccountClassification`, `StatementGroup`. |
| `prisma/migrations/20260614000000_account_classifications/` | already added | the migration for the above. |
| `lib/accounting/classifications.ts` | already added | the classification → type/heading mapping (single source of truth). |
| `actions/accounting-tree.ts` | **new** | `createClassifiedAccount` (TJ's form, auto-codes), `getAccountTree` (11 headings + accounts + live balances), `getParentAccountOptions`. |
| `components/accounting/AddAccountForm.tsx` | **new** | the Add Account form. |
| `components/accounting/AccountTree.tsx` | **new** | the expandable heading/tree UI. |
| `app/(dashboard)/accounting/page.tsx` | **replaced** | the new dashboard; a compact tools bar keeps Transactions, the reports, Banking, etc. reachable. |

## Deploy

The schema fields were added in a prior session, so the migration may already be
applied. If not:

```bash
cd stockflow
pnpm prisma migrate deploy   # applies 20260614000000_account_classifications (additive, nullable columns)
pnpm prisma generate
pnpm run build
```

If `prisma migrate status` shows the migration already applied, just
`pnpm prisma generate && pnpm run build`.

## Notes

- "Report" reuses the existing General Ledger page (`/accounting/ledger?account=…`),
  which already lists every entry for an account with a running balance — so it
  satisfies TJ's per-account Report with no extra page.
- The balance sheet / income statement reports we built earlier keep working and
  now share the same headings.
- I couldn't run `pnpm build` here (no node_modules in the upload, sandbox can't
  fetch Prisma's engine), so I verified the field names, exports, role usage, the
  `?account=` Report link, and the tree-grouping logic against your actual schema
  and code. Send any build error and I'll fix it.
