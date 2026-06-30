# Spliit 💸

A Splitwise-style expense splitter for trips and shared houses. Create a group,
invite people, add expenses (split equally, by exact amounts, by percentage, or
by shares), track who owes whom in **any currency**, and settle up with the
fewest payments.

Built to run entirely on **Next.js** and deploy to **Vercel's free tier**.

## Stack

| Concern        | Choice |
|----------------|--------|
| Framework      | Next.js 16 (App Router, React 19, Server Actions) |
| Auth           | [better-auth](https://better-auth.com) — Google sign-in only |
| Database       | Postgres ([Neon](https://neon.tech), serverless HTTP driver) |
| ORM            | Drizzle ORM + drizzle-kit |
| Validation     | zod (shared client/server schemas) |
| UI             | Tailwind CSS v4, shadcn/ui, [cult.ui](https://cult-ui.com) |
| Flair          | [@shadergradient/react](https://shadergradient.org) animated hero |
| FX rates       | [Frankfurter](https://frankfurter.dev) (ECB, free, no key) |
| Money          | integer minor units (no floats), cents-accurate |

## Key design notes

- **Money** is stored as integer minor units (e.g. cents) with an ISO-4217
  currency code — never floats. Currency decimals vary (USD=2, JPY=0, KWD=3),
  handled in `lib/currency.ts`.
- **Splits** (equal / exact / percentage / shares) all reduce to a concrete
  per-person amount that sums exactly to the total. Rounding remainders are
  distributed deterministically — see `lib/splits.ts`.
- **Balances** are computed on read in the group's base currency and are always
  zero-sum. The greedy debt-simplification minimises the number of payments —
  see `lib/balances.ts`.
- **Multi-currency**: each expense keeps its original currency + the exchange
  rate used; a cached base-currency amount drives balances. Rates auto-fill from
  Frankfurter (`lib/fx.ts`) and are editable per expense.
- The core money/split/balance logic is **pure and unit-tested** (`pnpm test`).

## Local setup

### 1. Install

```bash
pnpm install
```

### 2. Create a Neon database

Sign up at [neon.tech](https://neon.tech), create a project, and copy the
**pooled** connection string.

### 3. Create Google OAuth credentials

[Google Cloud Console](https://console.cloud.google.com/) → APIs & Services →
Credentials → **Create OAuth client ID** → Web application. Add this authorized
redirect URI:

```
http://localhost:3000/api/auth/callback/google
```

(Add your production URL too once deployed — see below.)

### 4. Configure environment

```bash
cp .env.example .env.local
```

Fill in `DATABASE_URL`, a 32+ char `BETTER_AUTH_SECRET`
(`openssl rand -base64 32`), and your Google client id/secret. Keep
`BETTER_AUTH_URL` / `NEXT_PUBLIC_BETTER_AUTH_URL` as `http://localhost:3000`
for local dev.

### 5. Run migrations

```bash
pnpm db:migrate
```

### 6. Start the app

```bash
pnpm dev
```

Open http://localhost:3000.

## Scripts

| Script | What it does |
|--------|--------------|
| `pnpm dev` | Start the dev server |
| `pnpm build` / `pnpm start` | Production build / serve |
| `pnpm test` | Run the unit tests (money, splits, balances) |
| `pnpm lint` | ESLint |
| `pnpm db:generate` | Generate a SQL migration from the schema |
| `pnpm db:migrate` | Apply migrations to the database |
| `pnpm db:studio` | Open Drizzle Studio |

## Deploying to Vercel (free tier)

1. Push to GitHub and import the repo in Vercel.
2. Add the Neon integration from the Vercel Marketplace (sets `DATABASE_URL`),
   or paste the connection string manually.
3. Add env vars in Vercel: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (your prod
   URL, e.g. `https://your-app.vercel.app`), `NEXT_PUBLIC_BETTER_AUTH_URL`
   (same), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
4. Add the production redirect URI in Google Cloud:
   `https://your-app.vercel.app/api/auth/callback/google`.
5. Run `pnpm db:migrate` against the production database once (locally with the
   prod `DATABASE_URL`, or as a one-off). Migrations are **not** run
   automatically on deploy.
6. Deploy.

## Project layout

```
app/
  page.tsx                     landing (shader-gradient hero + Google sign-in)
  invite/[token]/              accept-invite flow
  (app)/                       authenticated shell
    dashboard/                 all groups + overall balance
    groups/new/                create group
    groups/[id]/               expenses · balances · settle · members tabs
  api/auth/[...all]/           better-auth handler
lib/
  auth.ts, auth-client.ts, session.ts
  db/                          drizzle client + schema
  currency.ts, splits.ts, balances.ts, fx.ts   ← pure core logic
  queries.ts, validators.ts
server/actions/                groups · expenses · settlements · invites · fx
components/                    UI (shadcn + cult.ui under components/ui)
```
