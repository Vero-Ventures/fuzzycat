# FuzzyCat

Payment plan platform for veterinary clinics. Pet owners split vet bills into biweekly installments over 12 weeks (25% deposit + 6 installments). 6% platform fee to owner, 3% revenue share to clinic.

**Not a lender.** No credit checks, no interest, no loan origination. FuzzyCat does **not** guarantee clinic payment — clinics are responsible for collecting from defaulting owners.

## Key Business Rules

- **Bill range**: $500–$25,000. Enforced in `lib/constants.ts` and enrollment router Zod schema.
- **Fee structure**: 6% platform fee to pet owner, 3% revenue share to clinic, 1% platform reserve
- **Deposit**: 25% of total (incl. fee), charged immediately via debit card (not ACH)
- **Installments**: remaining 75% split into 6 biweekly ACH debits
- **Default handling**: 3 failed retries → plan "defaulted" → clinic notified, responsible for collection. Retries are payday-aligned (next Friday, 1st, or 15th at least 2 days out).
- **Soft collection**: Escalating email reminders at day 1, 7, 14 after missed payment
- **Clinic 3% share**: Structure as "platform administration compensation", never "referral commission" (anti-kickback risk)
- **No NY launch** until DFS finalizes BNPL Act regulations

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
| Linting | Biome (not ESLint/Prettier) |
| Testing | Bun test runner (not Jest/Vitest), Playwright E2E |
| Email / SMS | Resend / Twilio |
| Monitoring | Sentry + PostHog + Vercel Analytics |
| Hosting | Vercel + Supabase |

## Commands

```bash
bun run dev                      # Dev server (localhost:3000)
bun run build                    # Production build
bun run typecheck                # tsc --noEmit
bun run check                    # Biome lint + format check
bun run check:fix                # Biome auto-fix
bun run test                     # Unit tests (scoped to lib/ server/ app/)
bun run test:e2e                 # Playwright E2E (all projects)
bun run ci                       # Full CI suite
bunx drizzle-kit push            # Push schema to DB (dev only)
bunx drizzle-kit generate        # Generate SQL migrations
```

## Code Style

- **TypeScript strict mode** everywhere. No `any` in payment/financial logic.
- **Biome** for linting + formatting. `noNonNullAssertion` is error-level — use `as Type` with prior null checks instead of `!`. Run `bun run check:fix` before committing.
- **Integer cents** for all monetary values (`amountCents`). Display via `formatCents()` at UI layer only.
- **Drizzle ORM** for all queries. Financial operations must use `db.transaction()`.
- **ILIKE escaping**: Always use `escapeIlike()` when interpolating user input into SQL ILIKE patterns.
- **Naming**: `camelCase` variables/functions, `PascalCase` components/types, `SCREAMING_SNAKE` env vars.
- **Bun test runner**: Always `bun run test` (not bare `bun test`, which picks up `node_modules`).
- **Error handling**: All Stripe/Plaid calls in try/catch. Never expose internals to users.
- **Audit trail** (NON-NEGOTIABLE): Every payment state change must log to `audit_log` with timestamp, actor, previous state, and new state.

## Security

- **PCI SAQ A**: Servers never touch card data. Use Stripe Checkout and Plaid Link (both hosted). Never store PAN, CVV, bank account numbers, or routing numbers.
- **Authorization**: All tRPC procedures guarded by `assertClinicOwnership()`, `assertPlanAccess()`, or `assertPlanOwnership()`.
- **CSP**: Per-request nonce via middleware. `'strict-dynamic'` + nonce for scripts.
- **Webhook verification**: Plaid via JWT validation, Stripe via signature verification. Stripe webhooks return 200 even on handler errors (prevents retry storms).
- **MFA**: Feature-flagged via `ENABLE_MFA`. Enforced at middleware for clinic/admin routes.
- **Stripe Connect**: Validate `stripeAccountId` non-null before Connect API calls. Account creation uses `db.transaction()` with conditional UPDATE for race safety.

## Environment Variables

- All env vars declared in Zod schemas in `lib/env.ts`. Access via `serverEnv()` or `publicEnv()`.
- **Never access `process.env` directly** in application code (CI enforced).
- New env vars must also be added to `.env.example`.
- Required env vars must be configured in Vercel before merging.

## Repository Rules

- **`main` is protected.** All changes through feature branches and PRs.
- **Squash merge** standard. Use `gh pr merge N --squash --delete-branch`.
- **`strict: true`** — PRs must be up-to-date with `main` before merging.
- **All CI checks must pass** before merge.

## Payment Flow

```
ENROLLMENT:
  1. Owner enters vet bill → system calculates 6% fee, 25% deposit, 6 installments
  2. Owner connects bank (Plaid) OR enters debit card (Stripe Checkout)
  3. Deposit charged immediately → plan becomes "active"
  4. Remaining 75% split into 6 biweekly ACH debits

COLLECTION (biweekly cron):
  1. Identify due payments → initiate Stripe ACH Direct Debit
  2. On success → update status, trigger clinic payout via Stripe Connect
  3. On failure → retry in 3 days (up to 3 retries), notify owner
  4. Soft collection: reminders at day 1, 7, 14
  5. After 3 failures → plan "defaulted", clinic notified

PAYOUTS:
  1. Stripe Connect transfer after each successful installment
  2. Transfer = installment minus FuzzyCat share; clinic's 3% included
```

## Development Workflow

### Parallel Agent Workflow

Use **git worktrees** for concurrent work on multiple issues. Each sub-agent follows this lifecycle:

1. Read the issue (`gh issue view N`) and CLAUDE.md
2. Implement with tests
3. Verify: `bun run test`, `bun run check`, `bun run typecheck`
4. Commit with conventional format (`feat:`, `fix:`, `chore:`)
5. Push and create PR (`gh pr create`)
6. Wait for CI (`gh pr checks N`)
7. Address review comments — reply with `FIXED: <one-liner>` via GitHub API
8. Merge (`gh pr merge N --squash --delete-branch`)
9. If merge fails (not up to date), rebase on main and push

### Post-Merge Review (Mandatory)

1. Verify no open PRs remain
2. Pull latest main, clean up worktrees
3. Run full test suite (`bun run test`)
4. Verify production deployment: `curl -sL https://fuzzycatapp.com/api/health | jq .status`
5. Update CLAUDE.md if needed (via PR)

## Testing

- All new features must include unit tests
- Mock external services — never call real APIs in tests
- **`mock.module()` cross-contamination**: Bun's `mock.module()` is global across all test files. **Preferred pattern**: set `process.env` directly + call `_resetEnvCache()` from `@/lib/env`. Use `delete process.env.VAR` to truly unset (`= undefined` becomes the string `"undefined"`).
- Run full suite before pushing — cross-contamination only shows up when files run together
- **E2E auth**: Global setup saves cookies to `e2e/auth-state/`. External services mocked via `page.route()`.

## Confidentiality

All aspects of FuzzyCat's development, business model, and the clinic revenue-share concept must be kept confidential until market launch. The 3% clinic share is the sole defensible differentiator.
