---
name: deployment-debugging
description: Use this skill when fixing build, deployment, environment variable, Vercel, Next.js, Supabase, or production runtime errors in StockFlow.
---

# Deployment Debugging Skill

StockFlow is a Next.js 16 App Router application using Prisma, Supabase, and pnpm.

## Build Commands

Use:

```bash
pnpm install
pnpm build
pnpm start
```

Type-check:

```bash
npx tsc --noEmit
```

Lint:

```bash
pnpm lint
```

Tests:

```bash
pnpm test
```

## Environment Variables

Check production deployment has:

- `DATABASE_URL`
- `DIRECT_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Do not expose private secrets in client code.

## Common Runtime Errors

### Project URL and Key are required to create a Supabase client

Fix:

- confirm `NEXT_PUBLIC_SUPABASE_URL`
- confirm `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- redeploy after setting environment variables
- ensure variables are available to the correct environment

### Prisma Client not generated

Fix:

```bash
pnpm prisma generate
pnpm build
```

### Next.js 16 API changes

Before changing framework-sensitive code, inspect local docs:

```text
node_modules/next/dist/docs/
```

## Rules

- Keep changes scoped.
- Avoid unrelated refactors.
- Do not commit `.env.local`.
- Note Prisma migrations or environment changes in handoff.
