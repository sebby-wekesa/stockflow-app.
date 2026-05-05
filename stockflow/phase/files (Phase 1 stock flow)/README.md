# Springtech StockFlow — Phase 1 Setup

End-to-end setup for the inventory & manufacturing platform. After Phase 1 you have a working app with authentication and database, ready for Phase 2 (product master).

## Prerequisites

- Node.js 18+ installed
- A Supabase account (free tier works)

## Step 1 — Create the Supabase project

1. Go to **https://supabase.com** and sign up or log in
2. Click **New project**
3. Fill in:
   - Name: `springtech-stockflow`
   - Database password: (save this securely)
   - Region: pick the closest to Kenya (typically `Frankfurt (eu-central-1)` or `Mumbai (ap-south-1)`)
4. Wait ~2 minutes for the project to provision

## Step 2 — Get your connection details

In the Supabase dashboard, navigate to **Settings**:

**Settings → API**, copy:
- **Project URL** → goes into `NEXT_PUBLIC_SUPABASE_URL`
- **anon public** key → goes into `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role** key → goes into `SUPABASE_SERVICE_ROLE_KEY`

**Settings → Database → Connection string**, select **URI** mode, then:
- The **Transaction pooler** string (port 6543) → goes into `DATABASE_URL`
- The **Session pooler** or direct string (port 5432) → goes into `DIRECT_URL`

Replace `[YOUR-PASSWORD]` with the database password you set in Step 1.

## Step 3 — Configure the project

```bash
cd stockflow
cp .env.local.example .env.local
# edit .env.local with the values from Step 2
```

## Step 4 — Install and run migrations

```bash
npm install
npx prisma generate
npx prisma db push
```

The `db push` command creates all 25+ tables in your Supabase database directly from the Prisma schema. You can verify by going to **Table Editor** in the Supabase dashboard — you should see tables like `organisations`, `users`, `products`, `branch_stock`, etc.

## Step 5 — Configure Supabase Auth

In the Supabase dashboard:

**Authentication → Providers**:
- Make sure **Email** is enabled
- For development, you can disable "Confirm email" so signups work immediately
- For production, leave email confirmation enabled

**Authentication → URL Configuration**:
- Site URL: `http://localhost:3000` (for dev) or your deployed URL
- Redirect URLs: add `http://localhost:3000/auth/callback`

## Step 6 — Run the app

```bash
npm run dev
```

Open `http://localhost:3000`. You'll be redirected to `/login`.

## Step 7 — Create your admin account

1. Click **Sign up** on the login page
2. Fill in your full name, email, password
3. (If email confirmation is enabled) Check your email and click the confirmation link
4. Log in with your credentials
5. You should land on the dashboard with system health showing all green

The first user to sign up automatically becomes the admin. Subsequent self-signups are blocked — admins create users from the Users screen (Phase 2).

## What's working in Phase 1

- ✅ Email + password authentication
- ✅ All 25+ database tables provisioned in Supabase
- ✅ Sidebar with role-based navigation (placeholder pages for Phases 2+)
- ✅ Logout
- ✅ First-user admin bootstrap
- ✅ Multi-branch support in user records

## What's coming in Phase 2

- Product master CRUD (the 5 categories)
- CSV seed of your 4,712 spring codes
- Alias management UI
- New product form

## Troubleshooting

**"Failed to connect to database"**
Your `DATABASE_URL` is wrong or the password contains characters that need URL encoding. Reset the database password in Supabase, then update `.env.local`.

**"Invalid login credentials"**
You may not have confirmed your email. Check spam, or disable email confirmation in Supabase Auth → Providers for development.

**Sign up succeeded but logging in says "Account not provisioned"**
The Supabase user was created but the Prisma user record wasn't. Check the server logs — typically a database connection issue during signup. Delete the Supabase auth user, fix the connection, and try again.
