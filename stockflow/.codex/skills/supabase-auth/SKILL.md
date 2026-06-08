---
name: supabase-auth
description: Use this skill when working on signup, login, email verification, password reset, middleware auth, or Supabase user synchronization in StockFlow.
---

# Supabase Auth Skill

StockFlow uses Supabase Auth with a local application user model.

## Required Environment Variables

Check:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Supabase service role key only on trusted server-side code if absolutely needed

Never expose the service role key to the browser.

## Auth Rules

- Use `supabase.auth.getUser()` for secure server validation.
- Avoid trusting only `supabase.auth.getSession()` in middleware or protected server logic.
- A Supabase Auth user should also map to a local app user record.
- Preserve organization and branch scoping after login.

## Admin Verification Flow

When implementing admin-side user verification:

1. Keep Supabase Auth responsible for identity.
2. Store app-level approval status in the local database.
3. Let admins approve or reject users from the app UI.
4. Prevent unapproved users from accessing protected ERP pages.
5. Show clear pending-verification messages.

## Common Errors

### Email not confirmed

Options:
- ask the user to confirm via email
- configure Supabase email settings
- implement app-level admin approval separately from Supabase email confirmation

### Invalid login credentials

Check:
- email spelling
- password
- whether user exists in Supabase Auth
- whether email confirmation is required

### Missing Supabase URL or key

Check `.env.local` and server runtime environment.

## Rules

- Do not bypass authentication checks.
- Do not expose auth tokens in logs.
- Do not use service role keys in client components.
- Keep redirects clear for unauthenticated, pending, and unauthorized users.
