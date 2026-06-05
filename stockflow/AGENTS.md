# Repository Guidelines

## Project Structure & Module Organization

This is a Next.js 16 App Router app for a multi-tenant manufacturing ERP. Routes, pages, layouts, and route handlers live in `app/`. Shared server actions are in `actions/`; some route-local actions remain under `app/actions/`. Reusable UI is in `components/`. Business logic, auth, Prisma clients, validators, import engines, and utilities are in `lib/`. Types are in `types/`, assets in `public/`, seed data in `data/`, and schema plus migrations in `prisma/`. Tests are colocated as `*.test.ts(x)` or placed under `__tests__/`.

## Build, Test, and Development Commands

Use pnpm; the repository declares `pnpm@11.2.2`.

- `pnpm dev`: start the local Next.js dev server.
- `pnpm build`: generate Prisma client and create a production build.
- `pnpm start`: run the production build.
- `pnpm lint`: run ESLint.
- `pnpm test`: run Jest once.
- `pnpm test:watch`: run Jest in watch mode.
- `pnpm test:coverage`: collect Jest coverage.
- `npx tsc --noEmit`: type-check without emitting files.
- `pnpm prisma generate`: refresh the Prisma client after schema changes.

## Coding Style & Naming Conventions

Write TypeScript for `strict` mode and prefer the `@/` alias for root imports. Use PascalCase components, camelCase functions and variables, kebab-case route folders where appropriate, and descriptive server action names. Keep tenant-aware database access in shared helpers. ESLint uses `eslint-config-next`; warnings for `any`, `@ts-comment`, unescaped entities, and set-state-in-effect should be addressed.

## Testing Guidelines

Jest runs with `jest-environment-jsdom` through `next/jest`. Name tests `*.test.ts`, `*.test.tsx`, `*.spec.ts`, or place them under `__tests__/`. Add focused utility tests and broader coverage for tenant-scoped data behavior, authorization, imports, and order lifecycle changes. Run `pnpm test` before handoff.

## Commit & Pull Request Guidelines

Recent history uses short imperative commit messages, for example `implement the set-password functionality`. Keep commits focused and behavior-oriented. Pull requests should include a concise summary, test results, linked issue or task, screenshots for UI changes, and notes for Prisma migrations or environment changes.

## Security & Configuration Tips

Do not commit secrets. Start from environment examples and keep local credentials in `.env.local` or deployment secret stores. Preserve organization scoping through `getTenantPrisma(organizationId)` and avoid raw Prisma client usage outside seeds, tests, or reviewed infrastructure code.

## Agent-Specific Notes

This project uses Next.js 16, whose APIs may differ from older versions. Before changing framework-sensitive code, consult `node_modules/next/dist/docs/`. Keep changes scoped, avoid unrelated refactors, and update Prisma generated artifacts only when schema changes require it.
