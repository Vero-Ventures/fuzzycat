# FuzzyCat

Guaranteed Payment Plan platform for veterinary clinics. Pet owners split vet bills into biweekly installments over 12 weeks (25% deposit + 6 installments). Pet owners pay a flat 6% platform fee. Clinics earn a 3% revenue share per enrollment.

**Not a lender.** No credit checks, no interest, no loan origination. FuzzyCat guarantees clinic payment through a risk pool model. Legal classification must be resolved before production launch (see GitHub issues #1–#7).

## Key Business Rules

- **Minimum bill**: $500 (below this, processing costs exceed margin)
- **Fee structure**: 6% platform fee to pet owner, 3% revenue share to clinic, 1% to risk pool
- **Deposit**: 25% of total (incl. fee), charged immediately via debit card (not ACH — too slow)
- **Installments**: remaining 75% split into 6 biweekly ACH debits
- **Default handling**: 3 failed retries -> plan marked "defaulted" -> risk pool reimburses clinic
- **Clinic 3% share**: Structure as "platform administration compensation", never "referral commission" (anti-kickback risk)
- **No NY launch** until DFS finalizes BNPL Act regulations (expected late 2026)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime / PM | Bun (dev + CI), Node.js (Vercel production) |
| Frontend | Next.js 16 (App Router) + Tailwind CSS v4 + shadcn/ui |
| Backend | Next.js API routes + tRPC |
| ORM | Drizzle ORM (schema in `server/db/schema.ts`) |
| Database | PostgreSQL via Supabase |
| Payments | Stripe Checkout (deposits), Stripe ACH (installments), Stripe Connect (payouts) |
| Bank Verification | Plaid Link + Balance |
| Auth | Supabase Auth (role-based: owner, clinic, admin) |
| Linting | Biome (not ESLint/Prettier) |
| Testing | Bun test runner (not Jest/Vitest) |
| Email / SMS | Resend / Twilio |
| Monitoring | Sentry (errors) + PostHog (analytics) |
| Hosting | Vercel + Supabase |

## Infrastructure

| Service | Status |
|---------|--------|
| Supabase | Configured (`wrqwmpptetipbccxzeai`) |
| Sentry | Configured (`fuzzycatapp` / `javascript-nextjs`) |
| PostHog | Configured (Project `318239`, US Cloud) |
| Vercel | Configured (`fuzzy-cat-apps-projects`, `fuzzycatapp.com`) |
| Stripe | Not configured |
| Plaid | Not configured |
| Resend | Not configured |
| Twilio | Not configured |

All accounts use `fuzzycatapp@gmail.com`. Secrets in `.env.local` (local) and Vercel env vars (production). Never commit secrets.

## Commands

```bash
bun install                      # Install dependencies
bun run dev                      # Dev server (localhost:3000)
bun run build                    # Production build
bun run typecheck                # tsc --noEmit
bun run check                    # Biome lint + format check
bun run check:fix                # Biome auto-fix
bun test                         # Unit tests
bun run test:e2e                 # Playwright E2E
bun run ci                       # Full CI (biome ci + tsc + circular deps + secrets)
bunx drizzle-kit push            # Push schema to DB (dev only)
bunx drizzle-kit generate        # Generate SQL migrations
bunx drizzle-kit migrate         # Run migrations (production)
bun run db:seed                  # Seed test data
```

## Code Style

- **TypeScript strict mode** everywhere. No `any` types in payment/financial logic.
- **Next.js App Router** (not Pages). Server Components by default.
- **Tailwind CSS v4** + shadcn/ui. No CSS modules or styled-components.
- **Biome** for linting + formatting. No ESLint, no Prettier. Run `bun run check:fix` before committing.
- **tRPC** for type-safe API. Stripe/Plaid webhooks via Next.js API routes.
- **Drizzle ORM** for all queries. All financial operations must use `db.transaction()`.
- **Integer cents** for all monetary values (`amountCents: number`, not `amount: number`). Display formatting via `formatCents()` at UI layer only.
- **Naming**: `camelCase` variables/functions, `PascalCase` components/types, `SCREAMING_SNAKE` env vars.
- **Bun test runner** (`bun test`). Jest-compatible API (`describe`, `it`, `expect`).
- **Error handling**: All Stripe/Plaid calls in try/catch with structured logging. Never expose internals to users.
- **Audit trail** (NON-NEGOTIABLE): Every payment state change must be logged to `audit_log` with timestamp, actor, previous state, and new state.

## PCI Compliance

Target SAQ A: FuzzyCat servers never touch card data. Use Stripe Checkout (hosted) for deposits, Plaid Link (hosted) for bank connections. Never store PAN, CVV, bank account numbers, or routing numbers. Store only Stripe customer IDs and Plaid access tokens. MFA required for admin and clinic accounts.

## Project Structure

```
fuzzycat/
├── app/
│   ├── (marketing)/              # Public pages (landing, how-it-works)
│   ├── (auth)/                   # Login, signup flows
│   ├── clinic/                   # Clinic portal (dashboard, clients, payouts, settings)
│   ├── owner/                    # Pet owner portal (enroll, payments, settings)
│   ├── admin/                    # Admin portal (dashboard, clinics, payments, risk)
│   └── api/
│       ├── webhooks/stripe/      # Stripe webhook handler
│       ├── webhooks/plaid/       # Plaid webhook handler (stub)
│       └── trpc/                 # tRPC API handler
├── components/                   # Shared UI components (shadcn/ui)
├── lib/
│   ├── env.ts                    # Zod-validated env vars
│   ├── logger.ts                 # Structured JSON logger
│   ├── rate-limit.ts             # Upstash Redis rate limiter
│   ├── stripe.ts                 # Stripe client singleton
│   ├── constants.ts              # Business constants (fees, rates)
│   ├── supabase/                 # Supabase client (browser + server)
│   └── utils/
│       ├── money.ts              # Integer cents helpers
│       └── schedule.ts           # Payment schedule calculator
├── server/
│   ├── db/
│   │   ├── index.ts              # Drizzle client
│   │   └── schema.ts             # Drizzle schema (source of truth)
│   ├── routers/                  # tRPC routers
│   ├── services/
│   │   ├── stripe/               # Stripe API layer (checkout, ach, connect, customer)
│   │   ├── enrollment.ts         # Enrollment business logic (stub)
│   │   ├── payment.ts            # Payment processing (stub)
│   │   ├── payout.ts             # Clinic payouts (stub)
│   │   ├── collection.ts         # Retry logic (stub)
│   │   └── guarantee.ts          # Risk pool (stub)
│   └── trpc.ts                   # tRPC init
├── types/                        # Shared TypeScript types
├── scripts/                      # seed.ts, create-admin.ts
├── drizzle/                      # Migration files + config
├── e2e/                          # Playwright tests
└── packages/extension/           # Chrome extension (Phase 2, Plasmo)
```

## Payment Flow

```
ENROLLMENT:
  1. Owner enters vet bill → system calculates 6% fee, 25% deposit, 6 installments
  2. Owner connects bank (Plaid balance check) OR enters debit card (Stripe Checkout)
  3. Deposit charged immediately via debit card → plan becomes "active"
  4. Remaining 75% split into 6 biweekly ACH debits

COLLECTION (biweekly cron):
  1. Identify payments due → initiate Stripe ACH Direct Debit
  2. On success → update status, trigger clinic payout via Stripe Connect
  3. On failure → retry in 3 days (up to 3 retries), SMS/email owner
  4. After 3 failures → plan "defaulted", risk pool reimburses clinic

PAYOUTS:
  1. Stripe Connect transfer to clinic after each successful installment
  2. Transfer = installment minus FuzzyCat share; clinic's 3% bonus included
```

## Confidentiality

All aspects of FuzzyCat's development, business model, and the clinic revenue-share concept must be kept confidential until market launch. The 3% clinic share is the sole defensible differentiator. NDAs required for all contractors and pilot contacts.
