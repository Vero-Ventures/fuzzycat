# FuzzyCat

## Project Overview

FuzzyCat is a **Guaranteed Payment Plan** platform for veterinary clinics. It enables pet owners to split veterinary bills into biweekly installments over 12 weeks (25% deposit upfront, remainder in equal payments). Pet owners pay a flat 6% platform fee. Clinics earn a 3% revenue share on each enrollment — the only BNPL-adjacent product in the market that **pays clinics** instead of charging them.

**FuzzyCat is NOT a lender.** It is a payment facilitation platform that guarantees clinic payment through a risk pool model. However, regulators may classify it as consumer credit regardless of labeling. The legal structure must be resolved before writing a single line of production code.

### What FuzzyCat Is

- A technology platform that automates payment plans between pet owners and veterinary clinics
- A "Guaranteed Payment Plan" — clinics receive payments as they come in, but FuzzyCat guarantees payment if the pet owner defaults (funded by a risk pool)
- A revenue-sharing partner to clinics (3% of each enrollment)

### What FuzzyCat Is NOT

- A lender (no credit checks, no interest, no loan origination)
- A factoring company (does not buy invoices or pay clinics upfront)
- A credit card or revolving line of credit

### Core Value Propositions

| Stakeholder | Value |
|-------------|-------|
| **Pet Owner** | No credit check. Split bills over 12 weeks. Flat 6% fee (transparent, no surprise interest). Only needs a debit card or bank account. |
| **Vet Clinic** | Earns 3% on every enrollment (no other BNPL does this). Guaranteed payment even if owner defaults. Increases treatment plan acceptance. Zero setup cost. |
| **FuzzyCat** | Retains ~3% of transaction volume as gross revenue. Asset-light model (no upfront capital to float invoices). Network effects as clinic count grows. |

---

## Critical Path: Legal Classification (RESOLVE BEFORE DEVELOPMENT)

> **This is the single highest-priority item in the entire project. Everything else depends on it.**

The 6% fee charged to pet owners for deferred payment is almost certainly "finance charges" under Truth in Lending Act (TILA) and state consumer credit laws, regardless of how FuzzyCat labels it. The CFPB and NY DFS are actively closing the "platform fee" loophole.

### Action Items (Week 1)

1. **Hire a fintech regulatory attorney** with BNPL experience in CA and NY. Budget: $5,000–$15,000 for a written legal opinion.
   - Firms to contact: Ballard Spahr (fintech practice), Hudson Cook LLP, Venable LLP, or Buckley LLP
   - Ask for opinion on: lender vs. broker vs. payment facilitator classification; usury analysis (6% over 12 weeks ≈ 26% APR annualized); money transmission implications; healthcare "kickback" risk of 3% clinic share
2. **Do NOT launch in New York** until DFS finalizes BNPL Act regulations (expected late 2026). The NY BNPL Act (enacted May 2025, Banking Law Article 14-B) has a broad definition that will likely capture FuzzyCat's model.
3. **File California DFPI registration** via NMLS immediately ($350 application + $500/year minimum assessment). This is cheap insurance regardless of final classification.
4. **Evaluate three legal structures** with counsel:
   - **Option A — "0% APR + Platform Fee"**: Frame the deferred payment as 0% interest credit (legal everywhere), with the 6% as a separate technology access fee. Risk: CFPB and states are treating mandatory fees as finance charges.
   - **Option B — "Retail Installment Sale Contract" (RISC)**: The clinic sells services on credit and immediately assigns the payment contract to FuzzyCat. Follows the auto-loan model. Risk: FuzzyCat becomes liable for disputes about service quality under Holder in Due Course rules.
   - **Option C — "Licensed BNPL Broker"**: Register as a broker/facilitator in each state. Most compliant but highest cost and longest timeline.

### Healthcare "Kickback" Warning

Paying a clinic 3% to recommend a financial product to patients has optics risk. In human healthcare, this would potentially violate anti-kickback statutes. Veterinary medicine has fewer restrictions, but the framing matters. Structure the 3% as **"platform administration compensation"** or **"technology partnership fees"** — never as a referral commission. Get this language reviewed by counsel.

---

## Competitive Landscape

### Tier 1: Credit-Based Lenders (FuzzyCat picks up their rejected clients)

| Competitor | Model | Vet Practices | FuzzyCat Advantage |
|-----------|-------|---------------|-------------------|
| **CareCredit** (Synchrony) | Reusable healthcare credit card. Hard pull. 26.99–29.99% APR after promo. | 270,000+ providers | No credit check. No interest trap. Clinic earns money instead of paying 5–15% merchant fee. |
| **Scratchpay** | Vet-specific loans, 12–36 months, $200–$10K. Soft pull. | 17,000+ | No credit check. Clinic earns 3% instead of paying merchant fees. |
| **Cherry** | Healthcare BNPL. Soft pull. 80%+ approval. True 0% APR for qualified. | Growing | FuzzyCat approves 100% (no credit check at all). Clinic revenue share. |
| **Sunbit** | POS financing. 30-sec tablet approval. 90% approval. | 3.7M users | Some Sunbit plans have deferred interest. FuzzyCat has flat transparent fee. |
| **Affirm** | General BNPL expanding to healthcare. 0–36% APR. | General | $17.5K cap. 5.99%+$0.30 merchant fee. Not vet-specialized. |

### Tier 2: Payment Plan Managers (Direct functional competitors)

| Competitor | Model | Key Weakness vs. FuzzyCat |
|-----------|-------|--------------------------|
| **VetBilling** | Admin tool for clinics to create in-house plans. Clinic bears all default risk. | No payment guarantee. No clinic revenue share. Older UX. |
| **Varidi** | "Guaranteed payments" — approves 100% of clients. | High fees charged TO the clinic for the guarantee. FuzzyCat charges the pet owner instead. |

### Tier 3: Alternatives (Not direct competitors but affect the market)

- **Pet Insurance** (Trupanion, Lemonade, Pets Best): Must be purchased before the emergency. Doesn't help with immediate bills.
- **Charitable Grants** (RedRover, Waggle, The Pet Fund): Slow, limited, means-tested.
- **General BNPL** (Klarna, PayPal Pay in 4, Zip): Low transaction limits, no vet integration, no clinic incentive.
- **Personal Loans** (LendingClub, SoFi): Hard credit check, slow funding, no workflow integration.

### FuzzyCat's Defensible Position

FuzzyCat's **only** sustainable differentiator is the clinic revenue share model. Every other feature (no credit check, deferred payments, simple UX) can be copied. The 3% clinic share is structurally difficult for credit-model competitors to replicate because their economics require charging clinics, not paying them. Speed to market and clinic relationship lock-in are critical.

---

## Development

### Tech Stack (Final Recommendations)

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Runtime / Package Manager** | Bun (package manager + script runner + test runner) | 30x faster installs than npm. Built-in test runner replaces Jest. Native TypeScript execution (no ts-node). All-in-one binary eliminates toolchain sprawl. `bun.lockb` replaces `package-lock.json`. |
| **Frontend** | Next.js 15 (TypeScript) + Tailwind CSS v4 + shadcn/ui | SSR for SEO on marketing pages. Fast tablet experience for clinic staff. Same React ecosystem for future mobile app. Bun runs Next.js dev/build via `bun --bun next dev`. |
| **Backend** | Next.js API routes + tRPC (runs on Node.js in production) | Full-stack TypeScript in a single Next.js app. tRPC provides end-to-end type safety. Vercel deploys to Node.js runtime (Bun runtime not yet supported on Vercel's Lambda-based infra). |
| **ORM** | Drizzle ORM | SQL-first, schema-as-TypeScript-code. No codegen step (unlike Prisma). ~7KB bundle (90% smaller than Prisma). Edge-native. First-class Supabase/Postgres support. Ideal for financial queries requiring explicit SQL control. |
| **Database** | PostgreSQL via Supabase (MVP) → AWS RDS (scale) | ACID compliance mandatory for financial transactions. Supabase provides managed Postgres + auth + realtime. Drizzle connects via Supabase's connection pooler. |
| **Payments (Down Payment)** | Stripe (Debit Card via Checkout) | Down payment must be instant. ACH takes 3–5 days — too slow for the 25% deposit. Use Stripe Checkout (hosted) for SAQ-A PCI compliance. |
| **Payments (Installments)** | Stripe ACH Direct Debit | Biweekly installments can tolerate ACH settlement time. 0.8% fee capped at $5 per transfer (much cheaper than card processing). |
| **Bank Verification** | Plaid (Link + Balance) | Instant bank account verification (eliminates microdeposit wait). Balance check at enrollment to reduce defaults. Critical for the "no credit check" model. |
| **Payout to Clinics** | Stripe Connect (Standard) | Payments flow from pet owner → Stripe → clinic bank account. FuzzyCat never holds funds (avoids money transmission licensing). Platform fee deducted automatically. |
| **Auth** | Supabase Auth (MVP) → Better Auth (scale) | Supabase Auth is free and integrated. Better Auth is a rising self-hosted alternative with multi-tenancy and MFA built in. MFA required for clinic admin accounts. |
| **Linting / Formatting** | Biome | Replaces ESLint + Prettier with a single Rust binary. 10–25x faster. One `biome.json` config file instead of `.eslintrc` + `.prettierrc` + plugins. 200+ lint rules with 97% Prettier-compatible formatting. |
| **Hosting** | Vercel (frontend/API) + Supabase (DB/Auth) | Lowest DevOps burden. Git-push deploy. $40–150/mo at MVP scale. Migrate to AWS when PCI Level 1 or transaction volume demands it. Note: Vercel runs Node.js runtime in production even though we use Bun locally. |
| **Email** | Resend | Modern transactional email API (built by ex-SendGrid team). React Email for templating. Better DX than SendGrid. |
| **SMS** | Twilio | Payment reminders and failed payment notifications. SMS has higher open rates than email for payment collection. |
| **Monitoring** | Sentry (errors) + PostHog (analytics) + Stripe Dashboard | Sentry catches runtime errors. PostHog tracks enrollment funnels. Stripe Dashboard for payment monitoring. |
| **Browser Extension** | Plasmo (framework) + React | Phase 2: Chrome extension that overlays "Pay with FuzzyCat" button on cloud PMS screens (ezyVet, Pulse). See POS Integration section. |

> **Why Bun as package manager but Node.js in production?** Bun is the strongest choice for local development and CI (30x faster installs, built-in test runner, native TypeScript). However, Vercel's serverless infrastructure runs on AWS Lambda, which does not yet natively support the Bun runtime. Next.js on Vercel deploys to Node.js. This is the recommended hybrid approach for 2026: `bun` for dev tooling, Node.js for production runtime. When Bun releases an LTS version and Vercel/AWS add native support, the production runtime can be switched with zero code changes.

### Setup

```bash
# Prerequisites
bun >= 1.2.x          # https://bun.sh/docs/installation
git

# Install Bun (if not installed)
curl -fsSL https://bun.sh/install | bash

# Clone and install
git clone <repo-url>
cd fuzzycat
bun install             # 30x faster than npm install. Generates bun.lockb.

# Environment variables (create .env.local)
cp .env.example .env.local
# Required env vars:
#   NEXT_PUBLIC_SUPABASE_URL=         # Supabase project URL
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=    # Supabase anonymous key
#   SUPABASE_SERVICE_ROLE_KEY=        # Supabase service role key (server only)
#   STRIPE_SECRET_KEY=                # Stripe secret key
#   STRIPE_PUBLISHABLE_KEY=           # Stripe publishable key
#   STRIPE_WEBHOOK_SECRET=            # Stripe webhook signing secret
#   PLAID_CLIENT_ID=                  # Plaid client ID
#   PLAID_SECRET=                     # Plaid secret (sandbox/production)
#   PLAID_ENV=sandbox                 # sandbox | production
#   RESEND_API_KEY=                   # Resend API key
#   TWILIO_ACCOUNT_SID=              # Twilio account SID
#   TWILIO_AUTH_TOKEN=               # Twilio auth token
#   TWILIO_PHONE_NUMBER=             # Twilio phone number
#   DATABASE_URL=                    # Supabase Postgres connection string (for Drizzle)
#   NEXT_PUBLIC_APP_URL=http://localhost:3000

# Database setup
bunx supabase start              # Start local Supabase instance
bunx drizzle-kit push            # Push Drizzle schema to database
bunx drizzle-kit studio          # (Optional) Visual DB browser at https://local.drizzle.studio
bun run db:seed                  # Seed with test data

# Start development server
bun run dev                      # Runs `bun --bun next dev` → http://localhost:3000
```

### External Accounts Required

| Service | Purpose | Where to Get | Cost (MVP) |
|---------|---------|-------------|------------|
| **Supabase** | Database, Auth, API | [supabase.com](https://supabase.com) | Free tier → $25/mo Pro |
| **Stripe** | Payments (cards, ACH, Connect) | [stripe.com](https://stripe.com) | 2.9%+$0.30 (cards), 0.8% cap $5 (ACH) |
| **Plaid** | Bank verification + balance | [plaid.com](https://plaid.com) | Free sandbox. Production: $0.30/verification + usage |
| **Vercel** | Frontend hosting + deploy | [vercel.com](https://vercel.com) | Free tier → $20/mo Pro |
| **Resend** | Transactional email | [resend.com](https://resend.com) | Free (100/day) → $20/mo |
| **Twilio** | SMS notifications | [twilio.com](https://twilio.com) | ~$0.0079/SMS + $1/mo phone number |
| **Sentry** | Error monitoring | [sentry.io](https://sentry.io) | Free tier → $26/mo |
| **PostHog** | Product analytics | [posthog.com](https://posthog.com) | Free tier (1M events/mo) |
| **Plasmo** | Browser extension framework | [plasmo.com](https://plasmo.com) | Open source (free) |

### Dev Tooling (no accounts needed — installed locally via `bun install`)

| Tool | Purpose | Replaces | Why Better |
|------|---------|----------|------------|
| **Bun** | Package manager, script runner, test runner, TypeScript execution | npm, Jest, ts-node | Single binary. 30x faster installs. Built-in test runner. Native TS. |
| **Biome** | Linter + formatter | ESLint + Prettier | Single Rust binary. 10–25x faster. One config file (`biome.json`). Zero plugin hell. |
| **Drizzle ORM** | Type-safe SQL query builder + migrations | Raw Supabase client, Prisma | SQL-first (no DSL to learn). No codegen step. 7KB bundle. Schema = TypeScript. |
| **Drizzle Kit** | Migration generation + DB studio | Prisma Migrate, Prisma Studio | `bunx drizzle-kit push` to sync schema. `bunx drizzle-kit studio` for visual browser. |

### External Professional Services Required

| Service | Purpose | Where to Get | Estimated Cost |
|---------|---------|-------------|---------------|
| **Fintech Regulatory Attorney** | Legal classification opinion, license filings, disclosure drafting | Ballard Spahr, Hudson Cook, Buckley LLP, or Venable LLP | $5,000–$15,000 (opinion) + ongoing |
| **CA DFPI Registration** | Broker/facilitator registration via NMLS | [nmls.org](https://mortgage.nationwidelicensingsystem.org) | $350 application + $500/yr |
| **Trademark Attorney** | "FuzzyCat" and "Pawsible" trademark filing | USPTO via local IP attorney or LegalZoom | $1,000–$2,500 |
| **PCI QSA (if needed)** | PCI compliance validation | Coalfire, SecurityMetrics, or A-LIGN | $5,000–$15,000/yr (only if SAQ A isn't sufficient) |
| **ASV Scanner** | PCI-required external vulnerability scans | SecurityMetrics, Qualys, or Trustwave | $100–$500/yr |

### Build

```bash
# Production build (Next.js via Bun)
bun run build                # Runs `bun --bun next build`

# Type checking
bun run typecheck            # Runs `tsc --noEmit`

# Generate Drizzle migrations after schema changes
bunx drizzle-kit generate    # Creates SQL migration files in drizzle/migrations/
bunx drizzle-kit push        # Applies schema directly (dev only, no migration file)
bunx drizzle-kit migrate     # Runs pending migrations (production)

# Build browser extension (Phase 2)
cd packages/extension
bunx plasmo build
```

### Test

```bash
# Unit tests (Bun's built-in test runner — Jest-compatible API, 10–30x faster)
bun test

# Unit tests in watch mode
bun test --watch

# Integration tests (requires local Supabase)
bun test --test-name-pattern integration

# E2E tests (Playwright, requires running dev server)
bun run test:e2e

# Test Stripe webhooks locally
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Test Plaid in sandbox mode
# Use Plaid sandbox credentials in .env.local
# Sandbox bank login: user_good / pass_good
```

### Lint

```bash
# Biome: lint + format in a single command
bun run check                # Runs `biome check .` (lint + format check + import sorting)

# Auto-fix everything Biome can fix
bun run check:fix            # Runs `biome check --write .`

# Lint only (no formatting)
bun run lint                 # Runs `biome lint .`

# Format only
bun run format               # Runs `biome format --write .`

# Type check (separate from Biome — TypeScript compiler)
bun run typecheck            # Runs `tsc --noEmit`

# CI: all checks (runs in CI pipeline)
bun run ci                   # Runs `biome ci .` (strict mode, fails on warnings) && `tsc --noEmit`
```

### `package.json` Scripts

```jsonc
{
  "scripts": {
    "dev": "bun --bun next dev",
    "build": "bun --bun next build",
    "start": "next start",           // Production uses Node.js runtime (Vercel)
    "typecheck": "tsc --noEmit",
    "lint": "biome lint .",
    "format": "biome format --write .",
    "check": "biome check .",
    "check:fix": "biome check --write .",
    "ci": "biome ci . && tsc --noEmit",
    "test": "bun test",
    "test:e2e": "playwright test",
    "db:push": "drizzle-kit push",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio",
    "db:seed": "bun run scripts/seed.ts"
  }
}
```

---

## Code Style

- **Language**: TypeScript (strict mode) everywhere. No `any` types in payment/financial logic.
- **Framework**: Next.js App Router (not Pages Router). Server Components by default; Client Components only when interactivity is needed.
- **Styling**: Tailwind CSS v4 utility classes. shadcn/ui for complex components. No CSS modules or styled-components.
- **Linting & Formatting**: Biome handles both. Single `biome.json` config at project root. No ESLint, no Prettier, no `eslint-plugin-*` dependencies. Run `bun run check:fix` before committing.
- **Import Sorting**: Biome handles import organization automatically. No `eslint-plugin-import` needed.
- **API Layer**: tRPC for type-safe API calls between frontend and backend. Stripe webhooks handled via Next.js API routes.
- **Database Access**: Drizzle ORM for all queries. Schema defined in `src/server/db/schema.ts` as TypeScript. Drizzle's SQL-like API provides explicit control over financial queries. All financial operations must use `db.transaction()`.
- **Money Handling**: Use integer cents (not floating point) for all monetary values. `amountCents: number` not `amount: number`. All display formatting happens at the UI layer via a shared `formatCents()` utility.
- **Naming**: `camelCase` for variables/functions, `PascalCase` for components/types, `camelCase` for Drizzle schema columns (TypeScript convention; Drizzle maps to `snake_case` in SQL via column name config), `SCREAMING_SNAKE` for env vars.
- **File Structure**: Feature-based colocation. Each feature folder contains its components, hooks, server actions, and types.
- **Testing**: Bun's built-in test runner (`bun test`). Jest-compatible API (`describe`, `it`, `expect`). No Jest, no Vitest needed.
- **Error Handling**: All Stripe/Plaid API calls wrapped in try/catch with structured error logging to Sentry. User-facing errors must never expose internal details.
- **Financial Audit Trail**: Every payment state change (created, processing, succeeded, failed, retried) must be logged to an `audit_log` table with timestamp, actor, previous state, and new state. This is non-negotiable for compliance.

### `biome.json` (Root Config)

```jsonc
{
  "$schema": "https://biomejs.dev/schemas/2.0/schema.json",
  "organizeImports": { "enabled": true },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "semicolons": "always",
      "quoteStyle": "single",
      "trailingCommas": "all"
    }
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": {
        "noExplicitAny": "error"     // Enforce no `any` in financial code
      },
      "complexity": {
        "noForEach": "warn"          // Prefer for...of for clarity
      }
    }
  },
  "files": {
    "ignore": ["node_modules", ".next", "drizzle/migrations"]
  }
}
```

---

## Architecture

### Project Structure

```
fuzzycat/
├── apps/
│   └── web/                          # Next.js application
│       ├── app/
│       │   ├── (marketing)/          # Public pages (landing, how-it-works)
│       │   ├── (auth)/               # Login, signup flows
│       │   ├── clinic/               # Clinic portal (protected)
│       │   │   ├── dashboard/
│       │   │   ├── clients/
│       │   │   ├── payouts/
│       │   │   └── settings/
│       │   ├── owner/                # Pet owner portal (protected)
│       │   │   ├── enroll/
│       │   │   ├── payments/
│       │   │   └── settings/
│       │   ├── admin/                # FuzzyCat internal admin (protected)
│       │   │   ├── dashboard/
│       │   │   ├── clinics/
│       │   │   ├── payments/
│       │   │   └── risk/
│       │   └── api/
│       │       ├── webhooks/
│       │       │   ├── stripe/       # Stripe webhook handler
│       │       │   └── plaid/        # Plaid webhook handler
│       │       └── trpc/             # tRPC API handler
│       ├── components/               # Shared UI components
│       ├── lib/
│       │   ├── stripe.ts             # Stripe client config
│       │   ├── plaid.ts              # Plaid client config
│       │   ├── resend.ts             # Resend email client config
│       │   ├── supabase/
│       │   │   ├── client.ts         # Browser client (auth only)
│       │   │   └── server.ts         # Server client (auth only)
│       │   └── utils/
│       │       ├── money.ts          # Integer cents helpers (formatCents, toCents, etc.)
│       │       └── schedule.ts       # Payment schedule calculator
│       ├── server/
│       │   ├── db/
│       │   │   ├── index.ts          # Drizzle client (connects to Supabase Postgres)
│       │   │   ├── schema.ts         # Drizzle schema (all tables defined here)
│       │   │   └── seed.ts           # Database seeder script
│       │   ├── routers/              # tRPC routers
│       │   ├── services/
│       │   │   ├── enrollment.ts     # Enrollment business logic
│       │   │   ├── payment.ts        # Payment processing logic
│       │   │   ├── payout.ts         # Clinic payout logic
│       │   │   ├── collection.ts     # Failed payment retry logic
│       │   │   └── guarantee.ts      # Risk pool / guarantee logic
│       │   └── trpc.ts              # tRPC init
│       └── types/                    # Shared TypeScript types
├── packages/
│   └── extension/                    # Chrome extension (Phase 2)
│       ├── src/
│       │   ├── contents/             # Content scripts (PMS overlay)
│       │   ├── popup/                # Extension popup
│       │   └── background/           # Service worker
│       └── plasmo.config.ts
├── drizzle/
│   ├── migrations/                   # Generated SQL migration files
│   └── drizzle.config.ts            # Drizzle Kit configuration
├── scripts/
│   └── seed.ts                       # `bun run db:seed` entry point
├── biome.json                        # Biome config (linting + formatting)
├── bun.lockb                         # Bun lockfile (binary, committed to git)
├── package.json
├── tsconfig.json
└── docs/
    ├── legal/                        # Legal opinions, registrations
    ├── compliance/                   # PCI documentation, policies
    └── api/                          # API documentation
```

### Database Schema (Drizzle ORM — `server/db/schema.ts`)

```typescript
// All monetary values stored as integer cents
// All timestamps are UTC
// This file IS the schema — Drizzle Kit generates SQL migrations from it

import { pgTable, uuid, text, integer, timestamp, inet, jsonb, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ── Veterinary clinics ──────────────────────────────────────────────
export const clinics = pgTable('clinics', {
  id:               uuid('id').primaryKey().defaultRandom(),
  name:             text('name').notNull(),
  phone:            text('phone').notNull(),
  email:            text('email').notNull(),
  addressLine1:     text('address_line1'),
  addressCity:      text('address_city'),
  addressState:     text('address_state').notNull(),     // 2-letter state code
  addressZip:       text('address_zip').notNull(),
  stripeAccountId:  text('stripe_account_id'),           // Stripe Connect account ID
  status:           text('status').notNull().default('pending'), // pending | active | suspended
  createdAt:        timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt:        timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ── Pet owners ──────────────────────────────────────────────────────
export const owners = pgTable('owners', {
  id:               uuid('id').primaryKey().defaultRandom(),
  clinicId:         uuid('clinic_id').references(() => clinics.id),
  name:             text('name').notNull(),
  email:            text('email').notNull(),
  phone:            text('phone').notNull(),
  addressLine1:     text('address_line1'),
  addressCity:      text('address_city'),
  addressState:     text('address_state'),
  addressZip:       text('address_zip'),
  petName:          text('pet_name').notNull(),
  stripeCustomerId: text('stripe_customer_id'),          // Stripe customer ID
  plaidAccessToken: text('plaid_access_token'),          // Encrypted
  paymentMethod:    text('payment_method').notNull(),    // 'debit_card' | 'bank_account'
  createdAt:        timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ── Payment plans (one per enrollment) ──────────────────────────────
export const plans = pgTable('plans', {
  id:                 uuid('id').primaryKey().defaultRandom(),
  ownerId:            uuid('owner_id').references(() => owners.id),
  clinicId:           uuid('clinic_id').references(() => clinics.id),
  totalBillCents:     integer('total_bill_cents').notNull(),
  feeCents:           integer('fee_cents').notNull(),           // 6% platform fee
  totalWithFeeCents:  integer('total_with_fee_cents').notNull(),
  depositCents:       integer('deposit_cents').notNull(),       // 25% of total_with_fee
  remainingCents:     integer('remaining_cents').notNull(),
  installmentCents:   integer('installment_cents').notNull(),
  numInstallments:    integer('num_installments').notNull().default(6),
  status:             text('status').notNull().default('pending'),
    // pending | deposit_paid | active | completed | defaulted | cancelled
  depositPaidAt:      timestamp('deposit_paid_at', { withTimezone: true }),
  nextPaymentAt:      timestamp('next_payment_at', { withTimezone: true }),
  completedAt:        timestamp('completed_at', { withTimezone: true }),
  createdAt:          timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_plans_clinic').on(table.clinicId),
  index('idx_plans_owner').on(table.ownerId),
  index('idx_plans_status').on(table.status),
]);

// ── Individual payments (deposit + each installment) ────────────────
export const payments = pgTable('payments', {
  id:                     uuid('id').primaryKey().defaultRandom(),
  planId:                 uuid('plan_id').references(() => plans.id),
  type:                   text('type').notNull(),        // 'deposit' | 'installment'
  sequenceNum:            integer('sequence_num'),        // 0 for deposit, 1-6 for installments
  amountCents:            integer('amount_cents').notNull(),
  status:                 text('status').notNull().default('pending'),
    // pending | processing | succeeded | failed | retried | written_off
  stripePaymentIntentId:  text('stripe_payment_intent_id'),
  failureReason:          text('failure_reason'),
  retryCount:             integer('retry_count').default(0),
  scheduledAt:            timestamp('scheduled_at', { withTimezone: true }).notNull(),
  processedAt:            timestamp('processed_at', { withTimezone: true }),
  createdAt:              timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_payments_plan').on(table.planId),
  index('idx_payments_scheduled').on(table.scheduledAt),
  index('idx_payments_status').on(table.status),
]);

// ── Clinic payouts ──────────────────────────────────────────────────
export const payouts = pgTable('payouts', {
  id:                 uuid('id').primaryKey().defaultRandom(),
  clinicId:           uuid('clinic_id').references(() => clinics.id),
  planId:             uuid('plan_id').references(() => plans.id),
  paymentId:          uuid('payment_id').references(() => payments.id),
  amountCents:        integer('amount_cents').notNull(),
  clinicShareCents:   integer('clinic_share_cents').notNull(),  // 3% clinic bonus
  stripeTransferId:   text('stripe_transfer_id'),
  status:             text('status').notNull().default('pending'),
  createdAt:          timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_payouts_clinic').on(table.clinicId),
]);

// ── Risk pool (guarantee fund) ──────────────────────────────────────
export const riskPool = pgTable('risk_pool', {
  id:                 uuid('id').primaryKey().defaultRandom(),
  planId:             uuid('plan_id').references(() => plans.id),
  contributionCents:  integer('contribution_cents').notNull(),
  type:               text('type').notNull(),            // 'contribution' | 'claim' | 'recovery'
  createdAt:          timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ── Audit log (MANDATORY for compliance) ────────────────────────────
export const auditLog = pgTable('audit_log', {
  id:           uuid('id').primaryKey().defaultRandom(),
  entityType:   text('entity_type').notNull(),   // 'plan' | 'payment' | 'payout' | etc.
  entityId:     uuid('entity_id').notNull(),
  action:       text('action').notNull(),         // 'created' | 'status_changed' | 'retried'
  oldValue:     jsonb('old_value'),
  newValue:     jsonb('new_value'),
  actorType:    text('actor_type').notNull(),     // 'system' | 'admin' | 'owner' | 'clinic'
  actorId:      uuid('actor_id'),
  ipAddress:    inet('ip_address'),
  createdAt:    timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_audit_entity').on(table.entityType, table.entityId),
]);
```

### Drizzle Client (`server/db/index.ts`)

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString, { prepare: false }); // prepare: false for Supabase pooler
export const db = drizzle(client, { schema });
```

### Payment Flow

```
PET OWNER ENROLLMENT:
  1. Owner selects clinic (must be registered)
  2. Owner enters total vet bill amount
  3. System calculates: 6% fee, 25% deposit, 6 biweekly installments
  4. Owner connects bank via Plaid (balance check) OR enters debit card via Stripe Checkout
  5. Owner reviews total charges, acknowledges disclaimers (checkbox)
  6. Deposit (25% of total incl. fee) charged IMMEDIATELY via debit card
     (NOT ACH — too slow for deposit. Debit card = instant confirmation)
  7. Plan becomes "active" upon successful deposit
  8. Remaining 75% split into 6 equal biweekly ACH debits

INSTALLMENT COLLECTION (every 2 weeks):
  1. Cron job identifies payments due today
  2. Initiate Stripe ACH Direct Debit
  3. ACH settles in 3-5 business days
  4. On success: update payment status, trigger payout to clinic via Stripe Connect
  5. On failure: retry in 3 days (up to 3 retries), then SMS/email owner
  6. After 3 failed retries: flag plan for review, trigger guarantee claim from risk pool

CLINIC PAYOUT (after each successful installment):
  1. Stripe Connect transfer to clinic's connected bank account
  2. Transfer amount = installment amount minus FuzzyCat platform share
  3. Clinic's 3% bonus included in transfer
  4. Clinic sees payout in their FuzzyCat dashboard and Stripe Connect dashboard

GUARANTEE / DEFAULT HANDLING:
  1. Risk pool funded by 1% of every transaction (deducted from FuzzyCat's 3% share)
  2. After 3 failed retry cycles → plan marked "defaulted"
  3. Risk pool pays clinic the remaining balance (up to cap per plan)
  4. FuzzyCat may pursue soft collection (email/SMS reminders, not formal debt collection)
  5. Formal collections: DO NOT pursue without FDCPA compliance review by counsel
```

---

## POS Integration Strategy (Phased)

### Phase 1: Standalone "Sidecar" Portal (Months 1–4)

No PMS integration. FuzzyCat is a standalone web app. Clinic staff types the pet owner's info and bill amount into FuzzyCat directly.

- **Works with**: Every clinic regardless of their PMS (even pen and paper)
- **Friction**: Double data entry. Clinic staff must enter data in both their PMS and FuzzyCat.
- **Tech**: Next.js web app only
- **Target clinics**: 5–10 independent clinics in California for pilot

### Phase 2: Chrome Extension Overlay (Months 4–7)

Build a Chrome extension using Plasmo that detects when clinic staff are using cloud-based PMS (ezyVet, Pulse, Shepherd, Digitail) in their browser. The extension scrapes the patient name and invoice amount from the PMS screen and injects a "Pay with FuzzyCat" button.

- **Works with**: Any cloud-based PMS accessed via browser (ezyVet, Covetrus Pulse, Shepherd, Neo, Digitail, Hippo Manager)
- **Does NOT work with**: Desktop/server apps (Cornerstone, AVImark)
- **Advantage**: Looks integrated but requires ZERO permission from PMS vendors. Can be built without any business development.
- **Risk**: Brittle. If ezyVet updates their UI/CSS, the content script breaks. Requires ongoing maintenance per PMS.
- **Tech**: Plasmo framework, React content scripts, CSS selectors per PMS

### Phase 3: Official API Integrations (Months 7–14)

Once FuzzyCat has transaction volume and clinic testimonials, approach PMS vendors for official API partnership.

**Priority targets (ranked by API accessibility and market fit):**

| Priority | PMS | Why | Integration Path |
|----------|-----|-----|-----------------|
| 1 | **ezyVet** | Open REST API. 50+ existing partner integrations. Cloud-native. Premium clinic segment. | Apply to IDEXX partner program. Build read (invoice data) + write (payment posting) integration. |
| 2 | **Shepherd** | Modern API-first architecture. Startup-friendly. Growing fast. | Direct outreach. Likely most receptive to a new fintech partner. |
| 3 | **Digitail** | Cloud-native, AI-focused, open API. Emerging platform. | Direct outreach. Modern stack makes integration fast. |
| 4 | **IDEXX Neo** | Cloud-based. Integrates with Vello. Growing small/mid clinic segment. | Via IDEXX partner program (same as ezyVet application). |
| 5 | **Hippo Manager** | Cloud-based. Budget-friendly. Indie clinic segment. | Webhook/API integration. Simpler system = simpler integration. |

**Deprioritize or skip:**

| PMS | Why Skip (for now) |
|-----|-------------------|
| **Cornerstone** | Server-based. No cloud API. Would require a local agent installed on clinic servers. Enterprise-grade effort. |
| **AVImark** | Legacy database architecture. Very hard to integrate without on-premise middleware. |
| **Voyager (Banfield)** | Proprietary to Mars Petcare. Cannot integrate without a corporate business development deal. Save for Series A fundraise. |
| **Covetrus Pulse** | API access is gated behind partnership agreements with Patterson/Covetrus. Medium difficulty but requires BD. |

---

## PCI DSS Compliance

### Target: SAQ A (Simplest Path)

By using Stripe's hosted checkout (Stripe Checkout or Stripe Elements with client-side tokenization), FuzzyCat's servers **never touch card data**. This qualifies for SAQ A — the simplest PCI compliance path with approximately 22 requirements (vs. 300+ for SAQ D).

### Compliance Checklist (Minimum Viable)

1. **Use Stripe Checkout** (hosted payment page) for debit card collection. Card data never reaches FuzzyCat servers.
2. **Use Plaid Link** (hosted modal) for bank account connection. Bank credentials never reach FuzzyCat servers.
3. **Do NOT store** PAN, CVV, bank account numbers, or routing numbers anywhere in FuzzyCat's database. Store only Stripe customer IDs and Plaid access tokens.
4. **Implement HTTPS** everywhere (Vercel provides this by default via Let's Encrypt).
5. **Enable MFA** for all admin and clinic staff accounts.
6. **Complete SAQ A** and Attestation of Compliance (AOC). Submit to Stripe (your acquirer).
7. **Schedule quarterly ASV scans** (external vulnerability scan by an Approved Scanning Vendor). Cost: $100–$500/year. Providers: SecurityMetrics, Qualys, Trustwave.
8. **For New York** (when entering): All systems must comply with PCI DSS 4.0. The 4.0 standard adds requirements around e-commerce skimming protection and stronger authentication.
9. **Document everything**: Maintain written policies for data retention, incident response, access control. Templates available from PCI SSC community resources.

---

## Risk Model: The Guaranteed Payment Hybrid

### How It Works

FuzzyCat operates a **risk pool** funded by a portion of platform revenue:

1. For every enrollment, 1% of the transaction total is allocated to the risk pool (deducted from FuzzyCat's 3% gross margin, leaving ~2% net margin before processing costs).
2. If a pet owner defaults (3 failed retry cycles over 2+ weeks), the risk pool reimburses the clinic for the remaining unpaid balance.
3. The risk pool is capped per plan (e.g., maximum $2,000 guarantee per enrollment) to limit catastrophic losses.
4. FuzzyCat retains the right to pursue soft collection (reminders) on defaulted accounts.

### Default Mitigation Stack

Without credit checks, default rates could reach 15–25%. FuzzyCat must layer multiple mitigation strategies:

| Layer | Mechanism | Expected Impact |
|-------|-----------|----------------|
| **1. Plaid Balance Check** | At enrollment, verify the pet owner's bank account has sufficient balance for at least the deposit + first 2 installments. Decline if balance is too low. | Blocks ~30–40% of likely defaults |
| **2. 25% Deposit Requirement** | Requiring a meaningful upfront payment filters out borrowers who can't afford even the first payment. | Proves ability to pay. Reduces loss-given-default. |
| **3. Debit Card for Deposit** | Instant charge (not ACH). If the card declines, no plan is created. | Immediate signal of payment capacity. |
| **4. Clinic Selection Guidance** | Provide clinics with AVMA guidance on which clients to offer payment plans to. Clinics know their clients. | Leverages clinic's existing client knowledge. |
| **5. Automated SMS/Email Reminders** | 3 days before each installment: SMS + email reminder. On failure: immediate notification. | Reduces accidental failures (insufficient funds on payday). |
| **6. Smart Retry Timing** | Retry failed ACH on likely paydays (Fridays, 1st/15th of month). Up to 3 retries per installment. | Recovers ~40–60% of initially failed payments. |
| **7. Risk Pool Guarantee** | For remaining defaults, risk pool reimburses clinic. | Clinic confidence. Sales differentiator. |

### Financial Viability Check

```
Assumptions:
  Average bill:           $1,200
  FuzzyCat gross margin:  3% = $36/enrollment
  Risk pool allocation:   1% = $12/enrollment
  Stripe ACH cost:        ~$18/enrollment (deposit on card + 6 ACH installments)
  Net margin:             $36 - $12 - $18 = $6/enrollment

  At 5% default rate:
    Average default loss:   $1,200 × 75% × 5% = $45 loss per 20 enrollments
    Risk pool income:       $12 × 20 = $240 per 20 enrollments
    Pool surplus:           $240 - $45 = $195 ✓ (viable)

  At 15% default rate:
    Average default loss:   $1,200 × 75% × 15% = $135 loss per 20 enrollments
    Risk pool income:       $240 per 20 enrollments
    Pool surplus:           $240 - $135 = $105 ✓ (still viable but tight)

  At 25% default rate:
    Average default loss:   $1,200 × 75% × 25% = $225 loss per 20 enrollments
    Risk pool income:       $240 per 20 enrollments
    Pool surplus:           $240 - $225 = $15 ⚠️ (barely viable, zero profit)

  CONCLUSION: Model works up to ~20% default rate.
  Plaid balance checks + deposit requirement should keep defaults under 10%.
  If pilot default rates exceed 15%, add a soft credit check (Plaid Insights or similar).
```

### Minimum Transaction Amount

At bill amounts below $500, payment processing costs consume nearly all margin:

| Bill | FuzzyCat Gross (3%) | Processing Cost | Risk Pool (1%) | Net |
|------|--------------------|-----------------|--------------|----|
| $300 | $9 | ~$12 | $3 | **-$6** (loss) |
| $500 | $15 | ~$14 | $5 | **-$4** (loss) |
| $750 | $22.50 | ~$16 | $7.50 | **-$1** (loss) |
| $1,000 | $30 | ~$18 | $10 | **+$2** (profit) |
| $1,500 | $45 | ~$20 | $15 | **+$10** (profit) |

**Set minimum transaction at $500.** Below this, FuzzyCat loses money on every enrollment. Communicate this to clinics as: "FuzzyCat is designed for significant veterinary expenses — emergencies, surgeries, dental procedures, and multi-visit treatment plans."

---

## Phased Roadmap

### Phase 0: Legal & Compliance Foundation (Weeks 1–6)

**Deliverables:**
- [ ] Written legal opinion from fintech attorney on classification
- [ ] Business entity formed (LLC or C-Corp), EIN obtained, business bank account opened
- [ ] California DFPI registration filed via NMLS
- [ ] NDAs executed with all contractors
- [ ] Trademark application filed for "FuzzyCat" and "Pawsible"
- [ ] Stripe account created and verified
- [ ] Plaid account created (sandbox access)
- [ ] Supabase project created

**Cost estimate:** $8,000–$20,000 (legal fees, registrations, entity formation)

### Phase 1: MVP "Sidecar" Build (Weeks 4–14)

**Deliverables:**
- [ ] Clinic registration and onboarding portal
- [ ] Pet owner enrollment flow (with Stripe Checkout + Plaid Link)
- [ ] Payment schedule calculator and display
- [ ] Automated biweekly ACH collection via Stripe
- [ ] Clinic dashboard (active plans, payment history, revenue earned)
- [ ] Pet owner dashboard (upcoming payments, payment history)
- [ ] FuzzyCat admin dashboard (overview metrics, clinic management)
- [ ] Disclaimers and disclosures (drafted by legal counsel)
- [ ] Email notifications (payment confirmations, reminders, failures)
- [ ] SMS reminders (Twilio integration)
- [ ] Cat-themed UI with CAPTCHA (per SOW requirements)
- [ ] Basic failed payment retry logic (3 retries, 3-day intervals)

**Team:** 1–2 full-stack TypeScript developers, 1 designer (part-time)
**Cost estimate:** $30,000–$60,000 (development) + $500/mo (infrastructure)

### Phase 2: Chrome Extension + Guarantee Fund (Months 4–7)

**Deliverables:**
- [ ] Chrome extension (Plasmo) with content scripts for ezyVet and Covetrus Pulse
- [ ] Extension auto-detects patient/invoice on PMS screens, pre-fills FuzzyCat enrollment
- [ ] Risk pool / guarantee fund implementation
- [ ] Enhanced retry logic with smart timing (payday alignment)
- [ ] Clinic reporting and analytics
- [ ] Soft collection workflow (automated escalating reminders)
- [ ] Pilot with 10–20 California clinics

**Cost estimate:** $20,000–$40,000 (development) + marketing/sales costs

### Phase 3: Official PMS Integrations + Multi-State (Months 7–14)

**Deliverables:**
- [ ] Apply to IDEXX partner program (ezyVet/Neo)
- [ ] Direct outreach to Shepherd and Digitail for API partnership
- [ ] Build first official API integration (likely ezyVet or Shepherd)
- [ ] Expand to additional states (monitor licensing requirements per state)
- [ ] Monitor NY DFS BNPL Act rulemaking; prepare license application if regulations are finalized
- [ ] React Native mobile app (pet owner-facing)

**Cost estimate:** $40,000–$80,000 (development + BD)

### Phase 4: Scale (Months 14+)

- [ ] 50+ clinics target
- [ ] Evaluate unit economics; adjust minimum transaction, fee structure, or risk pool allocation if needed
- [ ] If default rates warrant it: add optional soft credit check (Plaid Insights)
- [ ] Consider NY launch if BNPL license is obtainable
- [ ] Explore Series A fundraise for Banfield/Mars corporate partnership and national expansion

---

## Confidentiality

> **All aspects of FuzzyCat's development, business model, and the clinic revenue-share concept must be kept confidential until market launch.** The 3% clinic revenue share is the sole defensible differentiator and can be replicated by a well-funded competitor (Scratchpay, CareCredit) within months of public disclosure. NDAs are required for all contractors, advisors, and pilot clinic contacts. Consider provisional patent protection for the revenue-share payment plan facilitation model if counsel advises it is defensible.
