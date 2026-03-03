# Comprehensive Playwright Walkthrough Bug Report

**Date**: March 3, 2026
**Environment**: Production (https://www.fuzzycatapp.com)

## Pages Tested

### Marketing Pages (All OK)
- Homepage - OK (8% fee, correct CTAs)
- How It Works - OK (calculator works, 8% fee)
- Support/FAQ - OK (accordions work, content correct)
- Privacy Policy - OK (comprehensive, correct)
- Terms of Service - OK (comprehensive, 8% fee)
- API Documentation - OK (links to Scalar docs)
- Request FuzzyCat at Your Clinic - **BUG #1** (missing CA state)

### Registration Flows
- Clinic Signup (`/signup/clinic`) - **BUG #2** (CAPTCHA timeout)
- Owner Signup (`/signup/owner`) - OK (password toggle works)
- Generic Signup (`/signup`) - OK (tabs work, both roles)

### Login Flows
- Clinic Login (`/login/clinic`) - OK (redirects correctly with proper app_metadata)
- Owner Login (`/login/owner`) - OK
- Generic Login (`/login`) - OK (portal links + direct login)
- Forgot Password (`/forgot-password`) - OK (form renders)

### Clinic Dashboard (Authenticated)
- Dashboard (`/clinic/dashboard`) - OK (stats, activity, upcoming payments)
- Getting Started (`/clinic/getting-started`) - OK (5-step checklist)
- Clients (`/clinic/clients`) - OK (search, filter, stats)
- Payouts (`/clinic/payouts`) - OK (history, stats)
- Reports (`/clinic/reports`) - OK (revenue, trends, export)
- Settings (`/clinic/settings`) - OK (profile, Stripe, API keys, MFA)
- Enroll (`/clinic/enroll`) - OK (client search, form, payment method)
- Onboarding (`/clinic/onboarding`) - OK (2-step setup)
- Materials (`/clinic/materials`) - OK (3 tabs, QR code, print)
- Referrals (`/clinic/referrals`) - OK (code, invite, history)

### Owner Dashboard (Authenticated)
- Dashboard (`/owner/payments`) - OK (stats, quick links)
- Referrals (`/owner/referrals`) - OK ($20 referral, code, history)
- Settings (`/owner/settings`) - OK (profile, pets, payment, deactivate)

### Admin Panel (Authenticated)
- Dashboard (`/admin/dashboard`) - OK (metrics, clinics table, audit log)
- Clinics (`/admin/clinics`) - OK (tabs, approve/suspend/reactivate)
- Payments (`/admin/payments`) - OK (49 payments, tabs, pagination)
- Platform Reserve (`/admin/risk`) - OK (reserve health, soft collections, defaults)

### API
- `/api/health` - OK
- `/api/v1/health` - OK
- `/api/v1/docs` (Scalar) - **BUG #3** (font loading errors)

---

## Bugs Found

### BUG #1: California (CA) Missing from State Dropdown [CRITICAL]
- **Location**: `app/(marketing)/request/page.tsx` line 12, `US_STATES` array
- **Impact**: California residents cannot select their state on the clinic request form. This is the company's home state.
- **Details**: The array jumps from 'AR' (Arkansas) to 'CO' (Colorado), skipping 'CA' (California).
- **Fix**: Add `'CA'` between `'AR'` and `'CO'` in the US_STATES array.

### BUG #2: CAPTCHA Timeout - Form Hangs Forever [MEDIUM]
- **Location**: `components/shared/captcha.tsx`
- **Impact**: If the Turnstile CAPTCHA challenge fails to resolve (e.g., timeout, network issue, automated browser), the form button stays on "Registering..." / "Creating account..." forever with no error message. Users must refresh the page (losing form data).
- **Details**: The `execute()` method returns a Promise that may never resolve if the Turnstile widget fails silently.
- **Fix**: Add a timeout (e.g., 30 seconds) to the CAPTCHA execute promise. If it times out, reject with a user-friendly error.

### BUG #3: Stale "Feedback Button" References [MEDIUM]
- **Location**: 6 files reference a non-existent feedback button
  - `app/(marketing)/support/page.tsx` (3 occurrences)
  - `app/(marketing)/api-docs/page.tsx` (1 occurrence)
  - `app/clinic/getting-started/page.tsx` (1 occurrence)
  - `app/owner/settings/_components/account-safety-section.tsx` (1 occurrence)
- **Impact**: Users are told to use a "feedback button in the bottom-right corner" that doesn't exist since the Sentry feedbackIntegration was removed.
- **Fix**: Replace with "contact us at support@fuzzycatapp.com" or similar.

### BUG #4: Scalar API Docs Font Loading Errors [LOW]
- **Location**: `/api/v1/docs`
- **Impact**: 14 console errors loading fonts from `fonts.scalar.com`. CSP blocks the font domain. Docs are still functional but use fallback fonts.
- **Fix**: Add `fonts.scalar.com` to the CSP font-src directive, or accept fallback fonts.

### BUG #5: Password Reset Email Sender [UX]
- **Location**: Supabase Auth configuration (dashboard only — not a code change)
- **Impact**: Password reset emails come from Supabase's default sender (noreply@mail.app.supabase.io) instead of a FuzzyCat-branded address. This confuses users.
- **Fix**: Configure custom SMTP in Supabase Dashboard:
  1. Go to https://supabase.com/dashboard → Production project → Authentication → SMTP Settings
  2. Enable Custom SMTP
  3. Set: Host = `smtp.resend.com`, Port = `465`, Username = `resend`, Password = Resend API key
  4. Set Sender email = `noreply@fuzzycatapp.com` (domain must be verified in Resend)
  5. Set Sender name = `FuzzyCat`
  6. Also update email templates (Authentication → Email Templates) to use FuzzyCat branding
- **Status**: Requires manual dashboard configuration — cannot be automated via code

---

## Non-Issues (Expected Behavior)
- Permissions-Policy warnings for 'browsing-topics' and 'interest-cohort' - Browser noise
- Turnstile CAPTCHA blocking automated browsers - Expected bot protection
- NY state excluded from state dropdowns - Intentional per business rules
