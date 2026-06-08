---
name: prisma-debugging
description: Use this skill when fixing Prisma, Supabase PostgreSQL, migrations, schema, Prisma Client, or database connection errors in StockFlow.
---

# Prisma Debugging Skill

This project uses Next.js 16, Prisma 7, Supabase PostgreSQL, and pnpm.

## First Checks

1. Confirm the project root contains:
   - `package.json`
   - `prisma/schema.prisma`
   - `prisma.config.ts`
   - `.env.local` or `.env`

2. Check required environment variables:
   - `DATABASE_URL`
   - `DIRECT_URL`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

3. Never expose secrets in logs, commits, screenshots, or responses.

## Prisma Commands

Use pnpm where possible:

```bash
pnpm prisma generate
pnpm prisma db pull
pnpm prisma db push
pnpm prisma migrate status
```

For type-checking:

```bash
npx tsc --noEmit
```

## Common Errors

### P1000 Authentication failed

Check:
- database password
- username format
- Supabase connection string
- URL encoding for special characters in passwords

### P1001 Cannot reach database server

Check:
- Supabase project status
- database host
- port `5432` for direct connection
- port `6543` for pooler connection
- local network or DNS issues

### Prepared statement already exists

Likely caused by PgBouncer transaction pooling.
Use Prisma-compatible pooling settings or direct connection where needed.

### Prisma Client validation errors

Check:
- generated Prisma Client is fresh
- schema model names match code
- includes/selects match actual relations

Run:

```bash
pnpm prisma generate
```

## Rules

- Do not run destructive database commands unless explicitly requested.
- Do not use `--force-reset` unless the user confirms data loss is acceptable.
- Preserve tenant scoping through `getTenantPrisma(organizationId)`.
- Avoid raw Prisma client usage outside seeds, tests, or reviewed infrastructure code.
