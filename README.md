# FuzzyCat

Flexible payment plans for veterinary clinics. Pet owners split vet bills into biweekly installments over 12 weeks — no credit checks, no interest, no loan origination.

## How It Works

1. **Clinic enrolls pet owner** with vet bill amount ($500–$25,000)
2. **Owner pays 25% deposit** via debit card (Stripe Checkout)
3. **Remaining 75%** splits into 6 biweekly ACH installments (Plaid-verified bank account)
4. **Clinics receive payouts** after each successful installment via Stripe Connect

Competitive platform fee for owners. Revenue share for participating clinics.

FuzzyCat is **not a lender** — no credit checks, no interest, no loan origination.

## Features

### For Pet Owners
- Split vet bills into manageable biweekly payments
- Secure bank verification via Plaid Link
- Real-time payment tracking and history
- Automated email/SMS reminders

### For Clinics
- Revenue share on processed payments
- Dashboard with client management and reporting
- Automated payout tracking via Stripe Connect
- Onboarding wizard for Stripe Connect setup

### For Admins
- Full payment lifecycle management
- Collection monitoring and escalation tools
- Audit trail for all payment state changes

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Bun (dev + CI), Node.js (Vercel production) |
| Frontend | Next.js 16 (App Router) + Tailwind CSS v4 + shadcn/ui |
| Backend | Next.js API routes + tRPC |
| ORM | Drizzle ORM (`server/db/schema.ts`) |
| Database | PostgreSQL via Supabase |
| Payments | Stripe Checkout (deposits), Stripe ACH (installments), Stripe Connect (payouts) |
| Bank Verification | Plaid Link + Balance |
| Auth | Supabase Auth (role-based: owner, clinic, admin) |
| Linting | Biome |
| Testing | Bun test runner + Playwright E2E |
| Email / SMS | Resend / Twilio |
| Monitoring | Sentry + PostHog + Vercel Analytics |
| Hosting | Vercel + Supabase |

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) v1.1+
- PostgreSQL database (via [Supabase](https://supabase.com/))
- [Stripe](https://stripe.com/) account (test mode)
- [Plaid](https://plaid.com/) account (sandbox)

### Installation

```bash
git clone <repo-url>
cd fuzzycat
bun install
```

### Environment Setup

```bash
cp .env.example .env
```

Fill in your credentials — see `.env.example` for all required and optional variables. Key services:

- **Supabase**: Project URL, anon key, service role key, database URL
- **Stripe**: Secret key, publishable key, webhook secret
- **Plaid**: Client ID, secret, environment (`sandbox` for development)
- **Resend**: API key for transactional email
- **Twilio**: Account SID, auth token, phone number for SMS

### Database

```bash
bunx drizzle-kit push    # Push schema to database
bun run db:seed          # Seed with sample data (optional)
```

### Development Server

```bash
bun run dev              # http://localhost:3000
```

## Project Structure

```
app/                     # Next.js App Router
  (marketing)/           # Public pages (home, how-it-works, privacy, terms)
  (auth)/                # Auth pages (login, signup, forgot-password, MFA)
  owner/                 # Pet owner portal (payments, plans, enrollment, settings)
  clinic/                # Clinic portal (dashboard, clients, reports, payouts)
  admin/                 # Admin portal (dashboard, plans, payments, settings)
  api/                   # API routes
    webhooks/            #   Stripe + Plaid + Sentry webhooks
    cron/                #   Scheduled jobs (collect-payments, process-payouts)
    health/              #   Health check endpoint
    trpc/                #   tRPC handler
components/              # Shared UI components (shadcn/ui based)
lib/                     # Shared utilities (env, auth, stripe, plaid, logger)
server/
  db/                    # Drizzle ORM schema and database connection
  routers/               # tRPC routers (enrollment, payment, payout, plan, plaid)
  services/              # Business logic (enrollment, payment, collection, payout, audit)
  trpc.ts                # tRPC context, procedures, and middleware
drizzle/                 # Generated SQL migrations
e2e/                     # Playwright E2E test suites
scripts/                 # Utility scripts (seed, admin creation, QA, E2E setup)
```

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start dev server with Turbopack |
| `bun run build` | Production build |
| `bun run typecheck` | TypeScript type checking (`tsc --noEmit`) |
| `bun run check` | Biome lint + format check |
| `bun run check:fix` | Biome auto-fix |
| `bun run test` | Unit tests (Bun test runner) |
| `bun run test:e2e` | Playwright E2E tests |
| `bun run ci` | Full CI suite (Biome + typecheck + circular deps + secrets) |
| `bunx drizzle-kit push` | Push schema to database |
| `bunx drizzle-kit generate` | Generate SQL migrations |
| `bunx drizzle-kit studio` | Open Drizzle Studio (DB browser) |

## Testing

### Unit Tests

```bash
bun run test             # Run all unit tests
```

Tests use Bun's built-in test runner with `mock.module()` for dependency mocking. External services (Stripe, Plaid, Supabase) are fully mocked — no real API calls in tests.

### E2E Tests

```bash
bun run e2e:setup-users  # Create test users in Supabase
bun run test:e2e         # Run all Playwright test suites
bun run test:e2e:local   # Run against localhost
bun run test:e2e:prod    # Run against production
```

## Deployment

Deployed on **Vercel** with **Supabase** for database and auth.

1. Connect repository to Vercel
2. Set all environment variables from `.env.example` in Vercel dashboard
3. Configure Stripe and Plaid webhooks to point to your Vercel deployment
4. Set up Vercel Cron for scheduled payment collection and payout processing

## License

Proprietary. All rights reserved.
