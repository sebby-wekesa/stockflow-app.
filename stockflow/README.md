# StockFlow - Manufacturing Management System

**StockFlow** is a modern, production-grade manufacturing ERP for tracking sales, inventory, production workflows, approvals, and operations across multiple branches and organizations.

It is currently in active development with a strong focus on **multi-tenant data isolation**.

---

## ✨ Current Features

- Full sales-to-production pipeline (customers → sales orders → Excel import → stock → production orders → stage logging → finished goods → packaging)
- Advanced multi-step Excel bulk importer with history, preview, and specialized flows
- Real-time stock ledger, transfers, low-stock alerts, and warehouse analytics
- Role-based dashboards for Admin, Manager, Operator, Sales, Warehouse, Packaging
- Tenant isolation: every read/write scoped by `organizationId` (Prisma extension + growing test suite)
- Barcode generation & scanning
- Comprehensive reporting + CSV export
- User invitations, approvals workflow, audit logging

---

## 🛠 Tech Stack

- **Next.js 16** (App Router) + **React 19** + TypeScript + Tailwind 4
- **Prisma 7** + PostgreSQL (30+ models, heavy tenant scoping)
- **Supabase Auth** (SSR)
- Server Actions + Route Handlers
- Zod + React Hook Form
- exceljs / xlsx for imports

---

## 🚀 Quick Start

```bash
# From the repository root
cd stockflow

pnpm install

# Set up env (Supabase + Postgres)
cp .env.example .env.local

# Database
pnpm prisma generate
pnpm prisma db push
pnpm prisma db seed

# Start dev server
pnpm dev
```

Open http://localhost:3000 and log in with seeded test accounts.

### Important Commands

```bash
pnpm build          # Full production build (includes prisma generate)
pnpm lint
npx tsc --noEmit    # Must be clean (0 errors on main)
pnpm test
pnpm prisma studio
```

---

## 📁 Project Structure

```
stockflow/
├── app/                    # Next.js App Router
│   ├── (dashboard)/        # Role-protected pages (admin, operator, manager, warehouse, etc.)
│   ├── api/                # Tenant-scoped API routes
│   └── actions/            # Feature server actions
├── actions/                # Shared server actions (also tenant-scoped)
├── components/             # UI + feature components
├── lib/                    # prisma, tenant-prisma.ts, auth, import engines, validations
├── prisma/
│   ├── schema.prisma       # 30+ models with RLS comments
│   └── seed.ts
├── __tests__/tenant/       # Isolation tests (expanding)
└── docs/                   # Project documentation (see DOCUMENTATION.md)
```

**Note on actions/**: Code is split between `actions/` (root) and `app/actions/`. Both are used. Tenant migration is the current priority.

---

## 🔐 User Roles

- **ADMIN** — Complete access, user management, system settings
- **MANAGER** — Approvals, reports, yield oversight
- **OPERATOR** — Production stage logging, job queues, packaging
- **SALES** — Customer & order management, catalogue
- **WAREHOUSE** — Intake, stock movements, alerts, transfers
- **PACKAGING** — Order fulfillment and scanning

All data access is (or is rapidly becoming) strictly isolated per organization.

---

## 🏗 Multi-Tenancy (Current Major Focus)

- Primary isolation via `getTenantPrisma(organizationId)` Prisma extension.
- `organizationId` enforced on nearly every model.
- Ongoing work to remove all raw `prisma` client usage outside of seed/tests.
- Isolation tests live in `__tests__/tenant/`.
- Schema prepared for Postgres RLS (comments already present).

See `docs/PRODUCTION_READINESS_6_WEEK_PLAN.md` and the active `reminiscent-traveler` branch for the latest sprint status.

---

## 📚 Documentation

- **`docs/DOCUMENTATION.md`** — The single up-to-date source of truth for the project.
- **`docs/PRODUCTION_READINESS_6_WEEK_PLAN.md`** — 6-week production readiness roadmap.
- **`docs/AGENTS.md`** — Special instructions for AI coding agents.

---

## 🚢 Deployment

Requires:

- PostgreSQL (with the schema from `prisma/schema.prisma`)
- Supabase project (for auth)

See `docs/DOCUMENTATION.md` for full environment variable list and build instructions.

---

## 🤝 Contributing

1. Work on `main` for stable features or the current feature branch for tenant work.
2. Keep `tsc --noEmit` clean at all times.
3. Use the tenant-scoped Prisma client for all data operations.
4. Add or update tests when changing tenant-scoped logic.

---

**Built with Next.js, Prisma, Supabase, and ❤️ for real manufacturing operations.**

*Last updated: 2026-05-25*
