# FuzzyCat

Guaranteed Payment Plan platform for veterinary clinics. Pet owners split vet bills into biweekly installments over 12 weeks (25% deposit + 6 installments). Pet owners pay a flat 6% platform fee. Clinics earn a 3% revenue share per enrollment.

**Not a lender.** No credit checks, no interest, no loan origination. FuzzyCat guarantees clinic payment through a risk pool model. Legal classification must be resolved before production launch (see GitHub issues #1–#7).

## Key Business Rules

- **Bill range**: $500 minimum (processing costs exceed margin below this), $25,000 maximum (risk exposure cap). Enforced in `lib/constants.ts` and enrollment router Zod schema.
- **Fee structure**: 6% platform fee to pet owner, 3% revenue share to clinic, 1% to risk pool
- **Deposit**: 25% of total (incl. fee), charged immediately via debit card (not ACH — too slow)
- **Installments**: remaining 75% split into 6 biweekly ACH debits
- **Default handling**: 3 failed retries -> plan marked "defaulted" -> risk pool reimburses clinic. Retries are payday-aligned (next Friday, 1st, or 15th at least 2 days out).
- **Soft collection**: Escalating email reminders at day 1, 7, and 14 after a missed payment before hard default
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
| Monitoring | Sentry (errors) + PostHog (analytics) + Vercel Analytics + Speed Insights |
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

**GitHub Secrets**: `SENTRY_AUTH_TOKEN`, `E2E_TEST_PASSWORD`, `CODECOV_TOKEN`, plus Supabase/Stripe/Plaid/Resend/Twilio keys.

## Security

- **CSP**: Per-request nonce via `crypto.randomUUID()` in middleware. `'strict-dynamic'` + nonce for scripts. Sentry `report-uri` auto-parsed from DSN.
- **HSTS**: `max-age=63072000; includeSubDomains; preload` via `vercel.json`.
- **GitHub Actions**: All pinned to commit SHAs for supply chain protection.
- **CI permissions**: Least-privilege (`contents: read`) on all workflows.
- **Root layout**: `force-dynamic` to ensure all pages go through SSR for nonce injection.
- **Authorization**: All tRPC procedures guarded by `assertClinicOwnership()`, `assertPlanAccess()`, or `assertPlanOwnership()`. IDOR vulnerabilities in payout, plaid, and payment routers fixed (PRs #141–#142).
- **Webhook verification**: Plaid webhook signatures cryptographically verified via `plaid.webhookVerificationKeyGet()` + JWT validation. Stripe webhooks return 200 after signature verification even on handler errors (prevents retry storms).
- **MFA**: Feature-flagged via `ENABLE_MFA` env var. Enforced at middleware level for clinic/admin routes. `enforceMfa()` checks AAL2 level.
- **ILIKE escaping**: All user search inputs passed through `escapeIlike()` helper before use in SQL ILIKE patterns (prevents `%`/`_` wildcard injection).
- **Stripe Connect safety**: `stripeAccountId` validated as non-null before Connect API calls. Account creation uses `db.transaction()` with conditional UPDATE for race safety.
- **Request ID tracing**: Middleware sets `x-request-id` header (reuses CSP nonce UUID). Available in tRPC context for log correlation.
- **Sentry audit alerting**: Audit events with `action: 'status_changed'` and default/write-off actions can trigger Sentry alerts for compliance monitoring.

## Repository Rules

- **`main` branch is protected.** No direct commits to main — ever. All changes go through feature branches and pull requests. PRs require CI checks to pass before merging.
- **All work goes through PRs.** Even documentation-only changes (like CLAUDE.md updates) must be on their own branch with a PR.
- **Squash merge** is the standard merge strategy. Use `gh pr merge N --squash --auto` or `gh pr merge N --squash --delete-branch`.
- **Required CI checks** (14) — configured via GitHub Branch Protection API (Settings > Branches > main), not in any repo file. All must pass before a PR can merge:
  1. `Lint & Format (Biome)` — Biome lint + format
  2. `Type Check` — `tsc --noEmit`
  3. `Build` — `next build`
  4. `Unit Tests` — `bun run test`
  5. `Unused Code (Knip)` — dead code / unused dependency detection
  6. `Circular Dependencies` — import cycle detection
  7. `Secret Detection (Gitleaks)` — leaked secrets scan
  8. `Security Scan (Semgrep)` — static security analysis
  9. `No Direct process.env` — enforces Zod-validated env access
  10. `Dependency Audit` — npm audit for known vulnerabilities
  11. `License Compliance` — license compatibility check
  12. `Type Coverage (≥95%)` — TypeScript type coverage threshold
  13. `E2E Tests (Playwright)` — end-to-end browser tests
  14. `codecov/patch` — code coverage threshold on changed lines
- **Informational checks** (not required): CodeQL, Vercel Preview, Smoke Test, E2E Production Tests.
- **`strict: true`** — PRs must be up-to-date with `main` before merging.

## Commands

```bash
bun install                      # Install dependencies
bun run dev                      # Dev server (localhost:3000)
bun run build                    # Production build
bun run typecheck                # tsc --noEmit
bun run check                    # Biome lint + format check
bun run check:fix                # Biome auto-fix
bun run test                     # Unit tests (scoped to lib/ server/ app/)
bun run test:e2e                 # Playwright E2E (all projects)
bun run test:e2e:local           # E2E localhost projects only
bun run test:e2e:prod            # E2E production (fuzzycatapp.com)
bun run test:e2e:mobile          # E2E mobile responsive (Pixel 5)
bun run e2e:setup-users          # Provision E2E test users in Supabase
bun run e2e:populate-data        # Populate E2E accounts with test plans/payments
bun run ci                       # Full CI (biome ci + tsc + circular deps + secrets)
bun run check:bundle             # Bundle size budget (run after build)
bunx drizzle-kit push            # Push schema to DB (dev only)
bunx drizzle-kit generate        # Generate SQL migrations
bunx drizzle-kit migrate         # Run migrations (production)
bun run db:seed                  # Seed test data
```

## Code Style

- **TypeScript strict mode** everywhere. No `any` types in payment/financial logic.
- **Next.js App Router** (not Pages). Server Components by default.
- **Tailwind CSS v4** + shadcn/ui. No CSS modules or styled-components.
- **Biome** for linting + formatting. No ESLint, no Prettier. Run `bun run check:fix` before committing. `noNonNullAssertion` is error-level — use `as Type` assertions with prior null checks instead of `!`.
- **tRPC** for type-safe API. Stripe/Plaid webhooks via Next.js API routes.
- **Drizzle ORM** for all queries. All financial operations must use `db.transaction()`. Stripe Connect account creation uses conditional UPDATE with `isNull()` guard for race safety.
- **Integer cents** for all monetary values (`amountCents: number`, not `amount: number`). Display formatting via `formatCents()` at UI layer only.
- **ILIKE escaping**: Always use `escapeIlike()` helper when interpolating user input into SQL ILIKE patterns. Escapes `%` and `_` wildcards.
- **Naming**: `camelCase` variables/functions, `PascalCase` components/types, `SCREAMING_SNAKE` env vars.
- **Bun test runner** (`bun run test`). Jest-compatible API (`describe`, `it`, `expect`). Note: `bun test` without args picks up `node_modules` — always use `bun run test` which scopes to `lib server app`.
- **Error handling**: All Stripe/Plaid calls in try/catch with structured logging. Never expose internals to users.
- **Audit trail** (NON-NEGOTIABLE): Every payment state change must be logged to `audit_log` with timestamp, actor, previous state, and new state.

## PCI Compliance

Target SAQ A: FuzzyCat servers never touch card data. Use Stripe Checkout (hosted) for deposits, Plaid Link (hosted) for bank connections. Never store PAN, CVV, bank account numbers, or routing numbers. Store only Stripe customer IDs and Plaid access tokens. MFA required for admin and clinic accounts.

## Environment Variables

- **All env vars must be declared in the Zod schemas** in `lib/env.ts` (`serverSchema` or `publicSchema`). Access them via `serverEnv()` or `publicEnv()`.
- **Never access `process.env` directly** in application code. CI enforces this via `scripts/check-process-env.ts`. Exempt files: Sentry configs, `instrumentation.ts`, `drizzle.config.ts`, `playwright.config.ts`, `next.config.ts`, `lib/logger.ts` (NODE_ENV only).
- **Every new env var must also be added to `.env.example`** with a comment. CI tests enforce parity between `lib/env.ts` schemas and `.env.example`.
- **New required env vars must be configured in Vercel before merging the PR.** Optional vars (`z.string().optional()`) are safe to merge without Vercel config.
- **Use `NEXT_PUBLIC_` prefix only for vars that must be available on the client.** These are inlined at build time.

## Deployment

- **Health check:** `GET /api/health` validates public env vars, server env vars, and database connectivity. Returns `200/ok` or `503/degraded`. Used by the post-deploy smoke test.
- **Post-deploy smoke test:** `.github/workflows/post-deploy.yml` runs automatically after Vercel deployments. Hits `/api/health` and `/` — creates a visible failed check on GitHub if either returns non-200.
- **Startup validation:** `instrumentation.ts` validates all env vars at cold start. Errors are logged to Vercel deploy logs but don't crash the app (so `/api/health` can report the failure).
- **Middleware resilience:** `middleware.ts` catches env validation failures and passes through instead of crashing. Public pages stay accessible.
- **Error boundaries:** Each portal (`/clinic`, `/owner`, `/admin`) and route group (`(auth)`, `(marketing)`) has an `error.tsx` boundary that catches rendering errors, reports to Sentry, and shows a recovery UI. Root `not-found.tsx` handles 404s.
- **robots.txt:** Generated via Next.js Metadata API (`app/robots.ts`). Allows `/`, disallows `/clinic/`, `/owner/`, `/admin/`, `/api/`.
- **SEO:** `metadataBase` set to `https://fuzzycatapp.com` in root layout. OpenGraph tags on marketing pages.
- **Vercel Analytics:** `<Analytics />` and `<SpeedInsights />` in root layout. Both use first-party routing (`/_vercel/insights/*`, `/_vercel/speed-insights/*`) — no CSP changes needed.

## Vercel CLI (Observability)

The Vercel CLI (`vercel`, v32+) is installed locally and authenticated. Use it to inspect deployments, view logs, and debug issues.

**Web Analytics and Speed Insights are dashboard-only** — no CLI or API access. View them at:
- **Analytics:** https://vercel.com/fuzzy-cat-apps-projects/fuzzycat/analytics
- **Speed Insights:** https://vercel.com/fuzzy-cat-apps-projects/fuzzycat/speed-insights

### Deployment Commands

```bash
# List recent deployments (production or preview)
vercel ls                                    # All deployments
vercel ls --environment production           # Production only
vercel ls -m githubCommitSha=<sha>           # Filter by commit SHA

# Inspect a specific deployment
vercel inspect <deployment-url>              # Show deployment info
vercel inspect <deployment-url> --wait       # Wait for build to finish

# View deployment logs
vercel logs <deployment-url>                 # Last 100 log entries
vercel logs <deployment-url> -f              # Stream live logs
vercel logs <deployment-url> -n 50           # Limit entries
vercel logs <deployment-url> --since 1h      # Logs from last hour
vercel logs <deployment-url> --output raw    # Full untruncated output

# Bisect to find which deployment introduced a regression
vercel bisect --good <good-url> --bad <bad-url> --path /api/health
vercel bisect --run ./test.sh                # Automated regression test
```

### Post-PR Deployment Review

After merging a PR, follow this process to verify the deployment:

1. **Find the deployment:** `vercel ls --environment production` — newest entry is the latest deploy
2. **Wait for it:** `vercel inspect <url> --wait` — blocks until READY
3. **Check logs for errors:** `vercel logs <url> -n 20` — scan for 5xx or errors
4. **Verify health:** `curl -sL https://fuzzycatapp.com/api/health | jq .status`
5. **Check Analytics dashboard** (manual): Open the Vercel Analytics tab to confirm data is flowing
6. **Check Speed Insights dashboard** (manual): Open the Speed Insights tab for Core Web Vitals

## Project Structure

```
fuzzycat/
├── app/
│   ├── (marketing)/              # Public pages (landing, how-it-works) + error.tsx
│   ├── (auth)/                   # Login, signup, password reset flows + error.tsx
│   ├── clinic/                   # Clinic portal (onboarding, dashboard, clients, payouts, settings)
│   ├── owner/                    # Pet owner portal (enroll, payments, settings)
│   ├── admin/                    # Admin portal (dashboard, clinics, payments, risk)
│   ├── not-found.tsx             # Custom 404 page
│   ├── robots.ts                 # robots.txt via Next.js Metadata API
│   └── api/
│       ├── health/               # Health check endpoint (env + DB validation)
│       ├── webhooks/stripe/      # Stripe webhook handler
│       ├── webhooks/plaid/       # Plaid webhook handler
│       └── trpc/                 # tRPC API handler
├── components/
│   ├── ui/                       # shadcn/ui components (14 installed)
│   ├── shared/                   # captcha, currency-display, empty-state, error-boundary, loading-skeleton, page-header, portal-error, status-badge
│   ├── theme-provider.tsx        # next-themes wrapper (accepts nonce for CSP)
│   └── theme-toggle.tsx          # Dark/light mode toggle
├── lib/
│   ├── env.ts                    # Zod-validated env vars
│   ├── logger.ts                 # Structured JSON logger + withRequestId() for correlated logging
│   ├── rate-limit.ts             # Upstash Redis rate limiter (optional, graceful fallback)
│   ├── stripe.ts                 # Stripe client singleton
│   ├── plaid.ts                  # Plaid client singleton
│   ├── resend.ts                 # Resend email client singleton
│   ├── twilio.ts                 # Twilio SMS client singleton
│   ├── constants.ts              # Business constants (fees, rates, min/max bill)
│   ├── auth.ts                   # Role extraction + role-based routing
│   ├── supabase/                 # Supabase client (browser, server, admin, mfa)
│   ├── posthog/                  # PostHog analytics (client, server, provider)
│   ├── trpc/                     # tRPC client + React Query provider (staleTime: 60s, gcTime: 5min)
│   └── utils/
│       ├── money.ts              # Integer cents helpers (formatCents, toCents, etc.)
│       ├── phone.ts              # Phone number validation (E.164)
│       ├── date.ts               # Date formatting + countdown helpers
│       ├── schedule.ts           # Payment schedule calculator
│       ├── csv.ts                # CSV export helpers
│       └── payday.ts             # Payday calculation
├── server/
│   ├── db/
│   │   ├── index.ts              # Drizzle client (pool: max 20, idle_timeout 20s, connect_timeout 10s)
│   │   └── schema.ts             # Drizzle schema (source of truth)
│   ├── emails/                   # React Email templates (10 templates)
│   │   ├── clinic-payout.tsx, clinic-welcome.tsx
│   │   ├── enrollment-confirmation.tsx
│   │   ├── payment-failed.tsx, payment-reminder.tsx, payment-success.tsx
│   │   ├── plan-completed.tsx
│   │   ├── soft-collection-day1.tsx, soft-collection-day7.tsx, soft-collection-day14.tsx
│   │   ├── helpers.ts
│   │   └── components/           # Shared email layout + styles
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
│   │   ├── soft-collection.ts    # Escalating email reminders (day 1/7/14)
│   │   ├── guarantee.ts          # Risk pool (contributions, claims, recoveries)
│   │   └── sms.ts                # SMS notifications (Twilio)
│   └── trpc.ts                   # tRPC init
├── scripts/                      # seed.ts, create-admin.ts, e2e-create-test-users.ts
├── drizzle/                      # Migration files + config
├── e2e/                          # Playwright E2E tests (30 spec files)
│   ├── auth-state/               # Stored auth cookies per role (gitignored)
│   ├── fixtures/                 # Playwright fixtures (auth, mocks, screenshots, logging)
│   ├── helpers/                  # Test utilities (test-users, screenshot, trpc-mock)
│   ├── global-setup.ts           # Creates test users + saves auth state
│   └── tests/                    # Test specs by category
│       ├── public/               # Landing, how-it-works, forgot/reset password
│       ├── auth/                 # Login, signup, redirects, MFA
│       ├── owner/                # Payments, enrollment, settings
│       ├── clinic/               # Dashboard, clients, payouts, reports, settings
│       ├── admin/                # Dashboard, clinics, payments, risk
│       ├── api/                  # Health endpoint
│       ├── cross-cutting/        # Navigation, responsive, 404, accessibility
│       └── production/           # fuzzycatapp.com smoke tests
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
  4. Soft collection: escalating email reminders at day 1, 7, 14 after missed payment
  5. After 3 failures → plan "defaulted", risk pool reimburses clinic

PAYOUTS:
  1. Stripe Connect transfer to clinic after each successful installment
  2. Transfer = installment minus FuzzyCat share; clinic's 3% bonus included
```

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
4. **Run full test suite** — `bun run test` (all tests must pass)
5. **Verify deployment** — `vercel ls --environment production` to find latest deploy, then `vercel inspect <url> --wait` and `vercel logs <url> -n 20` to check for errors. Verify `curl -sL https://fuzzycatapp.com/api/health | jq .status` returns `"ok"`.
6. **Review project state** — check file structure, test coverage, and overall consistency
7. **Update CLAUDE.md** — update implementation status, fix any stale documentation, add new utilities/components/routers that were added
8. **Commit via PR** — create a `chore/` maintenance branch, commit changes, create PR, merge

### Gemini CLI Offloading

Use `gemini --yolo` to offload appropriate tasks and conserve Claude tokens:

**Good for Gemini:** Boilerplate components, test fixtures, docs, regex/SQL, CSS patterns, format translations.
**Keep on Claude:** Multi-file changes, git/PR workflows, security logic, project context, debugging, architecture.

Always **review Gemini output** before applying — treat it as a draft, not final code.

### Testing Requirements

- All new features must include unit tests
- Mock external services (Stripe, Plaid, Twilio, Resend) — never call real APIs in tests
- **`mock.module()` cross-contamination**: Bun's `mock.module()` is **global across all test files** in the same process. Mocking `@/lib/supabase/mfa` in one file will poison every other file that imports it. **Preferred pattern**: Instead of `mock.module('@/lib/env')` or `mock.module('@/lib/supabase/mfa')`, set environment variables directly via `process.env` and call `_resetEnvCache()` from `@/lib/env` to clear the cached singleton. Use `delete process.env.VAR_NAME` (with `// biome-ignore lint/performance/noDelete`) to truly unset — `process.env.VAR = undefined` becomes the string `"undefined"`.
- Run the full suite (`bun run test`) before pushing, not just individual test files — cross-contamination only shows up when files run together

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
| Resend email (10 React Email templates incl. soft-collection) | #21 | Done |
| Twilio SMS (payment reminders, failure notifications) | #22 | Done |
| Marketing pages (landing, how-it-works, interactive calculator) | #23 | Done |
| Pet owner enrollment flow (5-step form, Plaid Link, Stripe Checkout) | #24 | Done |
| Pet owner dashboard (payments, history, settings) | #25 | Done |
| Clinic onboarding (Stripe Connect, profile, onboarding checklist) | #26 | Done |
| Clinic dashboard (stats, clients, payouts, revenue, settings) | #27 | Done |
| Admin dashboard (metrics, clinic management, payments, risk) | #28 | Done |
| Cat-themed UI design system + CAPTCHA | #29 | Done |
| Security hardening (CSP, HSTS, SHA pinning, CI permissions) | #104 | Done |
| Performance & observability (DB pool, staleTime, request IDs, PostHog) | #127, #134 | Done |
| Security audit — CRITICAL (auth bypass, double payouts, N+1 query) | #136, #137 | Done (PR #141) |
| Security audit — HIGH (IDOR, SQLi, missing indexes, rate limiting) | #136, #138 | Done (PR #142) |
| Security audit — MEDIUM (race conditions, payout calc, error handling) | #136, #139 | Done (PR #143) |
| Security audit — LOW (a11y, testing, code quality, frontend) | #136, #140 | Done (PR #144) |
| Vercel Web Analytics + Speed Insights | #154, #155 | Done (PR #156) |
| Save debit card during deposit checkout | #165 | Done (PR #170) |
| Codecov coverage threshold enforcement (80% project, 70% patch) | #171 | Done (PR #173) |
| Client-side bundle size budget (750 kB gzip) | #172 | Done (PR #174) |

### Open — Security (Remaining)

| Issue | Severity | Summary |
|-------|----------|---------|
| #100 | MEDIUM | MFA bypass: tRPC API layer does not enforce AAL2 |
| #101 | — | DevSecOps: Integrate security tooling into CI/CD pipeline |
| #102 | — | Add authorization test harness for all tRPC procedures |

Issues #96–#99 (IDOR, missing AuthZ, Plaid webhook forgery) were resolved in PRs #141–#142.

### Open — Human/Legal (Blocks Production)

Issues #1–#5, #7: Regulatory attorney, business entity, DFPI registration, NDAs, trademarks, legal disclaimers.
Issues #32, #33: PCI SAQ A self-assessment, pilot clinic recruitment.

### Open — Bugs & Enhancements

| Issue | Summary |
|-------|---------|
| #125 | Enable "Update Payment Method" in owner settings |
| #150 | Fix non-functional "Initiate Enrollment" button on Clinic Dashboard (supersedes #130) |
| #151 | All dashboards show "Unable to load" — tRPC identity resolution failures (supersedes #123, #131) |
| #152 | Clinic portal pages stuck in loading state (blocked by #151, supersedes #132) |
| #153 | Comprehensive E2E data population, workflow testing, and documentation (supersedes #133) |

### Open — Future Phases

| Issue | Summary |
|-------|---------|
| #34 | Chrome extension with Plasmo for cloud PMS overlay |
| #37–#40 | Pilot clinics, IDEXX partnership, PMS API integration, multi-state licensing |
| #41 | React Native mobile app |

### Test Suite

757 unit tests across 41 test files. Bun test runner. All external services mocked. Run via `bun run test` (not bare `bun test`, which picks up `node_modules`).

**E2E Tests:** 30 Playwright spec files covering all page routes + API health endpoint.

```bash
bun run test:e2e              # Run all projects (including production)
bun run test:e2e:local        # Run localhost projects only
bun run test:e2e:prod         # Run production tests (fuzzycatapp.com)
bun run test:e2e:mobile       # Run mobile responsive tests (Pixel 5)
bun run e2e:setup-users       # Provision E2E test users in Supabase
```

**E2E architecture:**
- **Auth via storage state:** Global setup logs in as owner/clinic/admin, saves cookies to `e2e/auth-state/`. Playwright projects load these via `storageState`.
- **External service mocking:** Stripe.js, Plaid Link, Turnstile, and analytics are intercepted via `page.route()` — no real API keys needed for these in CI.
- **Real Supabase in CI:** Auth and DB tests use real Supabase credentials (GitHub Secrets).
- **Test user emails:** `e2e-owner@fuzzycatapp.com`, `e2e-clinic@fuzzycatapp.com`, `e2e-admin@fuzzycatapp.com`.

## Confidentiality

All aspects of FuzzyCat's development, business model, and the clinic revenue-share concept must be kept confidential until market launch. The 3% clinic share is the sole defensible differentiator. NDAs required for all contractors and pilot contacts.
