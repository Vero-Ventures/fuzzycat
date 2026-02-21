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
| Stripe | Configured (test mode, webhook endpoint on `fuzzycatapp.com`) |
| Plaid | Configured (sandbox) |
| Resend | Configured |
| Twilio | Configured (trial account) |

All accounts use `fuzzycatapp@gmail.com`. Secrets in `.env.local` (local) and Vercel env vars (production). Never commit secrets.

## Repository Rules

- **`main` branch is protected.** No direct commits to main — ever. All changes go through feature branches and pull requests. PRs require CI checks to pass before merging.
- **All work goes through PRs.** Even documentation-only changes (like CLAUDE.md updates) must be on their own branch with a PR.
- **Squash merge** is the standard merge strategy. Use `gh pr merge N --squash --auto` or `gh pr merge N --squash --delete-branch`.

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
│   ├── (auth)/                   # Login, signup, password reset flows
│   ├── clinic/                   # Clinic portal (onboarding, dashboard, clients, payouts, settings) [implemented]
│   ├── owner/                    # Pet owner portal (enroll, payments, settings) [implemented]
│   ├── admin/                    # Admin portal (dashboard, clinics, payments, risk) [stubs]
│   └── api/
│       ├── webhooks/stripe/      # Stripe webhook handler
│       ├── webhooks/plaid/       # Plaid webhook handler
│       └── trpc/                 # tRPC API handler
├── components/ui/                # shadcn/ui components (14 installed)
├── lib/
│   ├── env.ts                    # Zod-validated env vars
│   ├── logger.ts                 # Structured JSON logger
│   ├── rate-limit.ts             # Upstash Redis rate limiter
│   ├── stripe.ts                 # Stripe client singleton
│   ├── plaid.ts                  # Plaid client singleton
│   ├── resend.ts                 # Resend email client singleton
│   ├── twilio.ts                 # Twilio SMS client singleton
│   ├── constants.ts              # Business constants (fees, rates)
│   ├── auth.ts                   # Role extraction + role-based routing
│   ├── supabase/                 # Supabase client (browser, server, admin, mfa)
│   ├── posthog/                  # PostHog analytics (client, server, provider)
│   ├── trpc/                     # tRPC client + React Query provider
│   └── utils/
│       ├── money.ts              # Integer cents helpers (formatCents, toCents, etc.)
│       ├── phone.ts              # Phone number validation (E.164)
│       ├── date.ts               # Date formatting + countdown helpers
│       └── schedule.ts           # Payment schedule calculator
├── server/
│   ├── db/
│   │   ├── index.ts              # Drizzle client
│   │   └── schema.ts             # Drizzle schema (source of truth)
│   ├── emails/                   # React Email templates (7 templates)
│   ├── routers/                  # tRPC routers (enrollment, payment, payout, plaid, owner, clinic, plan, admin)
│   ├── services/
│   │   ├── stripe/               # Stripe API layer (checkout, ach, connect, customer)
│   │   ├── audit.ts              # Audit log service (compliance-critical)
│   │   ├── authorization.ts      # Role-based access control helpers
│   │   ├── email.ts              # Email send functions (Resend)
│   │   ├── enrollment.ts         # Enrollment business logic
│   │   ├── payment.ts            # Payment processing
│   │   ├── payout.ts             # Clinic payouts
│   │   ├── plaid.ts              # Plaid Link + balance check
│   │   ├── collection.ts         # Failed payment retry logic
│   │   ├── guarantee.ts          # Risk pool (contributions, claims, recoveries)
│   │   └── sms.ts                # SMS notifications (Twilio)
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

## User Stories (Unvalidated Hypotheses)

These are early-stage hypotheses about pet owner needs. They may be wrong. Use them as directional guidance for frontend work, not as rigid specs.

- As a pet owner, I want to see all my payment dates clearly displayed so that I can plan my finances.
- As a pet owner, I want to access a payment history screen so that I can track completed and upcoming payments.
- As a pet owner, I want a simple way to create an account so that I can register for FuzzyCat.
- As a pet owner, I want a simple way to add my pet & plan details so that I can see the details of my plan.
- As a pet owner, I want a simple way to link my bank account so that payments can be made automatically.
- As a pet owner, I want to receive notifications if a payment fails so that I can quickly resolve the issue.

### Clinic Stories (Unvalidated)

- As a clinic owner, I want to register my clinic with contact details and payment account information so that I can begin offering FuzzyCat to clients.
- As a clinic, I want a dashboard showing active plans, completed payments, and earnings so that I can monitor revenue from FuzzyCat.
- As a clinic, I want a page showing a list of my clients as well as client details so that I can see all my clients and track payments.
- As a clinic, I want to receive guaranteed payments even if a pet owner defaults so that I reduce financial risk.
- As a clinic, I want to earn a 3% revenue share on each enrollment so that I benefit financially from offering FuzzyCat.

## Development Workflow

### Parallel Agent Workflow (Standard)

When working on multiple issues concurrently, use **git worktrees** for isolation:

```bash
# Setup (one worktree per issue)
mkdir -p /path/to/fuzzycat-worktrees
git worktree add /path/to/fuzzycat-worktrees/issue-N -b feat/branch-name origin/main
cd /path/to/fuzzycat-worktrees/issue-N && bun install --frozen-lockfile
```

Each sub-agent gets its own worktree and follows this lifecycle:

1. **Read the issue ticket** on GitHub (`gh issue view N`)
2. **Read CLAUDE.md** and relevant existing code
3. **Implement** the feature with tests
4. **Verify locally**: `bun test`, `bun run check`, `bun run typecheck`
5. **Commit** with conventional commit format (`feat:`, `fix:`, `chore:`)
6. **Push** to origin (`git push -u origin feat/branch-name`)
7. **Create PR** (`gh pr create --title "..." --body "..."`)
8. **Wait for CI** — poll `gh pr checks N` until all 16 checks pass
9. **Read review comments** — `gh api repos/Vero-Ventures/fuzzycat/pulls/N/comments`
10. **Fix review comments**, commit, push
11. **Reply to each comment** — `gh api repos/Vero-Ventures/fuzzycat/pulls/N/comments/ID/replies -f body="FIXED: ..."`
12. **Wait for CI** again after fixes
13. **Merge** — `gh pr merge N --squash --delete-branch`
14. If merge fails (branch not up to date), **rebase on main** and push again

After all PRs merge, clean up:
```bash
git worktree remove /path/to/fuzzycat-worktrees/issue-N
git pull origin main
```

### Post-Merge Review (Mandatory)

After all sub-agents complete their work and all PRs are merged to main:

1. **Verify no open PRs** — `gh pr list --state open` must return empty
2. **Pull latest main** — `git checkout main && git pull origin main`
3. **Clean up worktrees** — `git worktree remove /path/to/worktree` for each
4. **Run full test suite** — `bun test` (all tests must pass)
5. **Review project state** — check file structure, test coverage, and overall consistency
6. **Update CLAUDE.md** — update implementation status, fix any stale documentation, add new utilities/components/routers that were added
7. **Commit via PR** — create a `chore/` maintenance branch, commit changes, create PR, merge

This ensures CLAUDE.md always reflects the true state of the repository and catches drift from parallel agent work.

### Gemini CLI Offloading

Use `gemini --yolo` to offload appropriate tasks and conserve Claude tokens:

```bash
# Example: generate boilerplate
gemini --yolo "Generate a React component for a payment history table with columns: date, amount, status, type. Use Tailwind CSS. TypeScript. No emojis." > /tmp/output.tsx

# Example: generate test fixtures
gemini --yolo "Generate 15 realistic seed records for a veterinary clinic payments table. Fields: id (uuid), planId (uuid), type (deposit|installment), sequenceNum (0-6), amountCents (integer), status, scheduledAt. Output as TypeScript array." > /tmp/fixtures.ts
```

**Good for Gemini:**
- Boilerplate React components (repetitive UI structure)
- Test fixture / seed data generation
- Documentation and JSDoc comments
- Regex patterns, SQL queries from natural language
- Simple single-file utilities
- CSS/Tailwind patterns
- Translating between formats (JSON <-> TypeScript types)

**Keep on Claude:**
- Multi-file coordinated changes
- Git operations, PR workflows, CI monitoring
- Security-sensitive logic (payments, auth, PCI)
- Tasks requiring conversation history or project context
- Iterative debugging across files
- Architectural decisions

Always **review Gemini output** before applying — treat it as a draft, not final code.

### Testing Requirements

- All new features must include unit tests
- Mock external services (Stripe, Plaid, Twilio, Resend) — never call real APIs in tests
- Bun's `mock.module()` is **global across test files** in the same process — be careful not to poison mocks between test files
- Run the full suite (`bun test`) before pushing, not just individual test files

### PR Review Comment Protocol

When addressing review comments:
1. Read the comment carefully
2. Make the code change
3. Reply with `FIXED: <concise one-liner>` using the GitHub API
4. Do NOT reply to ask for clarification — just fix it or make a reasonable judgment call

## Implementation Status

### Phase 1 — Completed

| Area | Issues | Status |
|------|--------|--------|
| Project scaffold, Biome, Drizzle, tRPC, Auth, CI | #8–#14 | Done |
| Backend services (enrollment, payment, payout, audit, risk pool) | #15–#18 | Done |
| Stripe integration (Checkout, ACH, Connect, webhooks) | #19 | Done |
| Plaid integration (Link, balance check, webhooks) | #20 | Done |
| Resend email (7 React Email templates) | #21 | Done |
| Twilio SMS (payment reminders, failure notifications) | #22 | Done |
| Marketing pages (landing, how-it-works, interactive calculator) | #23 | Done |
| Pet owner enrollment flow (5-step form, Plaid Link, Stripe Checkout) | #24 | Done |
| Pet owner dashboard (payments, history, settings) | #25 | Done |
| Clinic onboarding (Stripe Connect, profile, onboarding checklist) | #26 | Done |
| Clinic dashboard (stats, clients, payouts, revenue, settings) | #27 | Done |

### Phase 1 — Remaining

| Area | Issues | Status |
|------|--------|--------|
| Admin dashboard (metrics, clinic management, payments, risk) | #28 | Open |
| Cat-themed UI design system refinement + CAPTCHA | #29 | Open |
| PCI SAQ A self-assessment | #32 | Open (human) |
| Pilot clinic recruitment | #33 | Open (human) |

### Phase 0 (Human/Legal) — Outstanding

Issues #1–#7: Regulatory attorney, business entity, DFPI registration, NDAs, trademarks, legal disclaimers. These block production launch but not development.

### Test Suite

395 unit tests across 27 test files. Bun test runner. All external services mocked.
E2E smoke test via Playwright (runs separately with `bun run test:e2e`).

## Confidentiality

All aspects of FuzzyCat's development, business model, and the clinic revenue-share concept must be kept confidential until market launch. The 3% clinic share is the sole defensible differentiator. NDAs required for all contractors and pilot contacts.
