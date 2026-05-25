# StockFlow Manufacturing ERP

**StockFlow** is a full-featured, multi-tenant manufacturing management system built with Next.js 16, Prisma, and Supabase.

It handles the complete production lifecycle: sales & customer orders, bulk Excel import, real-time inventory, production orders with stage tracking, approvals, packaging, reporting, and analytics — all with strong tenant isolation.

---

## Repository Structure

```
stockflow-app./
├── stockflow/                  # The actual Next.js application (this is where all the code lives)
│   ├── app/                    # Pages, API routes, server actions
│   ├── components/
│   ├── prisma/                 # Schema + seed (30+ models)
│   ├── docs/                   # Full project documentation
│   └── README.md               # Detailed developer guide
└── README.md                   # You are here
```

**All development happens inside the `stockflow/` directory.**

---

## Quick Links

- **[stockflow/README.md](stockflow/README.md)** — Full developer documentation, tech stack, setup, and commands.
- **[stockflow/docs/DOCUMENTATION.md](stockflow/docs/DOCUMENTATION.md)** — Single source of truth for the current state of the app (features, architecture, tenant isolation).
- **[stockflow/docs/PRODUCTION_READINESS_6_WEEK_PLAN.md](stockflow/docs/PRODUCTION_READINESS_6_WEEK_PLAN.md)** — Current 6-week production readiness sprint plan.

---

## Getting Started

```bash
cd stockflow

pnpm install
cp .env.example .env.local   # fill in your Supabase + Postgres credentials

pnpm prisma generate
pnpm prisma db push
pnpm prisma db seed

pnpm dev
```

See the detailed instructions in `stockflow/README.md`.

---

## Current Focus (May 2026)

- Completing tenant data isolation across the entire application
- Expanding automated isolation test coverage
- Cleaning up legacy import code and dead files
- Preparing for first real-customer pilot

The project is actively developed with heavy use of AI pair-programming (Kilo).

---

## License

MIT

---

*Maintained by the StockFlow team. For questions, open an issue or check the docs.*
