# PCI DSS Compliance Audit — FuzzyCat

**Date**: 2026-03-04
**Scope**: PCI DSS v4.0 (12 requirements) + NY DFS BNPL Act
**Classification**: SAQ A (all cardholder data handled by Stripe)

---

## Executive Summary

FuzzyCat qualifies for **PCI DSS SAQ A** — the simplest compliance tier. All cardholder data (card numbers, CVV, bank account/routing numbers) is handled exclusively by Stripe. FuzzyCat servers never receive, process, store, or transmit sensitive payment credentials.

The platform stores only Stripe-issued tokenized references (`pm_*`, `pi_*`, `cus_*`) and display-safe fields (`last4`, `brand`, `bankName`).

---

## Requirement-by-Requirement Audit

### 1. Install and Maintain Network Security Controls

| Control | Status | Implementation |
|---------|--------|----------------|
| CSP headers | ✅ | `proxy.ts` — strict `default-src 'self'` with allowlisted domains |
| HTTPS enforcement | ✅ | CSP `upgrade-insecure-requests` directive |
| CORS | ✅ | `server/api/middleware/cors.ts` — explicit method/header allowlists |
| Clickjacking protection | ✅ | `frame-ancestors 'self'` in CSP |
| Permissions-Policy | ✅ | Camera, geolocation, microphone, payment all restricted |
| X-Content-Type-Options | ✅ | `nosniff` header set |

**Note**: `'unsafe-inline'` in `script-src` is required by Next.js App Router (SPA navigation injects inline scripts without nonces). Documented in `proxy.ts`.

### 2. Apply Secure Configurations to All System Components

| Control | Status | Implementation |
|---------|--------|----------------|
| Env var validation | ✅ | `lib/env.ts` — Zod schemas with format prefixes (`sk_`, `whsec_`, `pk_`, `re_`, `AC`) |
| No direct `process.env` | ✅ | CI-enforced; all access via `serverEnv()` / `publicEnv()` |
| Lazy initialization | ✅ | Stripe client, DB connection initialized lazily (no build-time secrets) |
| Secret scanning | ✅ | Gitleaks in CI (`.github/workflows/ci.yml`) scans full git history |
| Dependency audit | ✅ | `npm audit --audit-level=critical` in CI; blocks on critical vulns |
| SAST scanning | ✅ | Semgrep + CodeQL in CI for static analysis |

### 3. Protect Stored Account Data

| Control | Status | Implementation |
|---------|--------|----------------|
| No PAN/CVV/routing stored | ✅ | Only Stripe tokens stored: `stripePaymentMethodId`, `stripeCustomerId` |
| Display-safe fields only | ✅ | `last4` (4 digits), `brand` (card network), `bankName` (display only) |
| API keys SHA-256 hashed | ✅ | `server/services/api-key.ts` — plaintext returned once at creation |
| No secrets in URLs | ✅ | Stripe session IDs used; no card data in query strings |

**Database fields reviewed** (`server/db/schema.ts`):
- `clients.stripeCustomerId` → Stripe token only
- `clients.stripePaymentMethodId` → Stripe token only
- `clients.last4` → Last 4 digits (display)
- `clients.brand` → Card network name
- `clients.bankName` → Bank name (display)
- No CVV, PAN, routing number, or account number fields exist.

### 4. Protect Cardholder Data with Strong Cryptography During Transmission

| Control | Status | Implementation |
|---------|--------|----------------|
| TLS enforcement | ✅ | CSP `upgrade-insecure-requests`; Vercel enforces HTTPS |
| Stripe SDK over HTTPS | ✅ | Official Stripe SDK; all API calls use HTTPS by default |
| Webhook HTTPS-only | ✅ | `server/services/webhook.ts` rejects non-HTTPS webhook URLs |
| HMAC-SHA256 signing | ✅ | Custom webhooks use `crypto.createHmac('sha256', ...)` |
| Timing-safe comparison | ✅ | `crypto.timingSafeEqual()` for webhook signature verification |

### 5. Protect All Systems and Networks from Malicious Software

| Control | Status | Implementation |
|---------|--------|----------------|
| SAST (Semgrep) | ✅ | CI pipeline blocks on security findings |
| CodeQL analysis | ✅ | Weekly + on PR; JavaScript/TypeScript rules |
| Dependency vulnerabilities | ✅ | `npm audit` in CI; critical vulns block merge |
| License compliance | ✅ | `check:licenses` script validates allowed licenses |
| Lockfile integrity | ✅ | `bun.lock` ensures reproducible builds |

### 6. Develop and Maintain Secure Systems and Software

| Control | Status | Implementation |
|---------|--------|----------------|
| TypeScript strict mode | ✅ | No `any` in payment/financial logic |
| SQL injection prevention | ✅ | Drizzle ORM parameterized queries; `escapeIlike()` for ILIKE patterns |
| SSRF protection | ✅ | `server/services/webhook.ts` — DNS resolution, private IP blocking |
| Error sanitization | ✅ | `server/api/middleware/error-handler.ts` — generic messages to users |
| Input validation | ✅ | Zod schemas on all tRPC + REST API inputs |
| Integer cents | ✅ | All monetary values as `amountCents`; display via `formatCents()` only |
| Atomic transactions | ✅ | All financial operations use `db.transaction()` |

### 7. Restrict Access by Business Need to Know

| Control | Status | Implementation |
|---------|--------|----------------|
| Role-based access | ✅ | Three roles: `client`, `clinic`, `admin` (`lib/auth.ts`) |
| Ownership assertions | ✅ | `assertClinicOwnership()`, `assertPlanAccess()` on all procedures |
| API key permissions | ✅ | Scoped permissions per key (e.g., `enrollments:read`, `clinic:write`) |
| IP allowlists | ✅ | Optional per-API-key IP restriction |
| Route-level guards | ✅ | Middleware enforces role prefixes (`/clinic`, `/admin`, `/client`) |

### 8. Identify Users and Authenticate Access

| Control | Status | Implementation |
|---------|--------|----------------|
| Supabase Auth | ✅ | Industry-standard auth with JWT tokens |
| MFA (TOTP) | ✅ | Feature-flagged via `ENABLE_MFA`; Supabase native TOTP |
| API key auth | ✅ | `fc_live_*` format; SHA-256 hashed; revocable |
| Session management | ✅ | Supabase SSR with auto-refresh tokens |
| Password reset flow | ✅ | New users receive recovery links; random UUID as initial password |

**Recommendation**: Enable `ENABLE_MFA=true` for clinic and admin users before production launch.

### 9. Restrict Physical Access to Cardholder Data

| Control | Status | Implementation |
|---------|--------|----------------|
| Cloud-hosted | ✅ | Vercel (US) + Supabase (US) — no on-premise servers |
| Separate DB instances | ✅ | Dev (`nkndduzbzshjaaeicmad`) and prod (`wrqwmpptetipbccxzeai`) |
| No local card data | ✅ | SAQ A — no cardholder data on any FuzzyCat systems |

### 10. Log and Monitor All Access to System Components and Cardholder Data

| Control | Status | Implementation |
|---------|--------|----------------|
| Audit log table | ✅ | `audit_log` in `server/db/schema.ts` — immutable event log |
| Mandatory state logging | ✅ | Every payment state change logged with actor, old/new values |
| API request logging | ✅ | `server/api/middleware/audit.ts` logs all REST API requests |
| Stripe webhook logging | ✅ | Signature failures and handler errors logged |
| API key events | ✅ | Creation, expiry, IP rejection, revocation all logged |
| Error monitoring | ✅ | Sentry integration for runtime errors |
| Analytics | ✅ | PostHog for user behavior; Vercel Analytics for performance |

**Audit log fields**: `entityType`, `entityId`, `action`, `oldValue`, `newValue`, `actorType`, `actorId`, `ipAddress`, `createdAt`.

### 11. Test Security of Systems and Networks Regularly

| Control | Status | Implementation |
|---------|--------|----------------|
| Unit tests | ✅ | 484+ main tests, 242+ isolated tests |
| E2E tests | ✅ | Playwright across desktop/mobile/auth flows |
| CI pipeline | ✅ | TypeScript check, Biome lint, tests, security scans on every PR |
| Semgrep SAST | ✅ | Auto-config security pattern scanning |
| CodeQL | ✅ | Weekly scheduled + PR-triggered analysis |
| Gitleaks | ✅ | Full history secret scanning |

**Recommendation**: Schedule quarterly ASV (Approved Scanning Vendor) scans per PCI DSS requirement (see issue #32).

### 12. Support Information Security with Organizational Policies

| Control | Status | Implementation |
|---------|--------|----------------|
| Terms of Service | ✅ | `app/(marketing)/terms/page.tsx` — comprehensive user agreement |
| Privacy Policy | ✅ | `app/(marketing)/privacy/page.tsx` — CCPA/CPRA compliant |
| Data retention policy | ✅ | 7 years payment records (IRS); 2 years account data |
| Breach notification | ✅ | 72-hour notification standard in privacy policy |
| No-lender disclaimer | ✅ | Explicit TILA/ECOA non-applicability statement |
| Fee transparency | ✅ | 6% fee, 25% deposit, 6 installments clearly disclosed |

---

## NY DFS BNPL Act Compliance

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| NY state restriction | ✅ | `server/routers/enrollment.ts` rejects `addressState === 'NY'` |
| REST API enforcement | ✅ | `server/api/routes/enrollments.ts` same NY check |
| Public disclosure | ✅ | Terms of Service: "excluding New York, pending regulatory review" |
| Unit test coverage | ✅ | `tests/isolated/enrollment-router.test.ts` (lines 216-242) |

**Note**: NY restriction remains until DFS finalizes BNPL Act regulations per CLAUDE.md policy.

---

## SAQ A Eligibility Checklist

FuzzyCat qualifies for SAQ A because:

- [x] All payment processing outsourced to PCI DSS Level 1 service provider (Stripe)
- [x] No electronic storage, processing, or transmission of cardholder data
- [x] Only Stripe-issued tokenized references retained
- [x] Hosted payment pages (Stripe Checkout) for card entry
- [x] No direct connection between merchant systems and cardholder data
- [x] Company confirmed to not store cardholder data in paper form

---

## Gaps and Recommendations

### Action Required Before Launch

1. **Enable MFA** (`ENABLE_MFA=true`) for clinic and admin users
2. **Complete SAQ A self-assessment** (issue #32 — human action required)
3. **Schedule quarterly ASV scans** (issue #32)

### Recommended Improvements

4. **API key rotation policy**: Document recommended rotation interval (e.g., 90 days)
5. **Session timeout configuration**: Configure explicit session timeouts in Supabase Auth settings
6. **WAF**: Consider Cloudflare WAF or Vercel Firewall for additional edge protection

### No Code Changes Needed

The codebase meets all PCI DSS SAQ A requirements. The gaps above are operational/procedural items, not code deficiencies.

---

## Key Security Files Reference

| File | Purpose |
|------|---------|
| `proxy.ts` | CSP, security headers, auth middleware |
| `lib/env.ts` | Environment variable validation |
| `lib/auth.ts` | Role-based access control |
| `lib/supabase/mfa.ts` | MFA enforcement |
| `lib/utils/sql.ts` | ILIKE escaping for SQL injection prevention |
| `server/db/schema.ts` | Database schema (no sensitive payment fields) |
| `server/services/audit.ts` | Audit logging service |
| `server/services/api-key.ts` | API key generation, hashing, validation |
| `server/services/webhook.ts` | Webhook SSRF protection, HMAC signing |
| `server/services/authorization.ts` | Ownership and access assertions |
| `server/api/middleware/auth.ts` | API authentication middleware |
| `server/api/middleware/rate-limit.ts` | Rate limiting (Redis + in-memory fallback) |
| `server/api/middleware/error-handler.ts` | Error sanitization |
| `server/api/middleware/audit.ts` | API request logging |
| `server/api/middleware/idempotency.ts` | Idempotency key handling |
| `.github/workflows/ci.yml` | Security scanning (Gitleaks, Semgrep, npm audit) |
| `.github/workflows/codeql.yml` | CodeQL static analysis |
| `app/(marketing)/terms/page.tsx` | Terms of Service |
| `app/(marketing)/privacy/page.tsx` | Privacy Policy |
