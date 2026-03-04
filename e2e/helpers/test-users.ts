// ── E2E test user constants and route definitions ─────────────────────

export const TEST_USERS = {
  client: {
    email: process.env.E2E_CLIENT_EMAIL ?? 'e2e-client@fuzzycatapp.com',
    role: 'client' as const,
    home: '/client/payments',
    storageStatePath: 'e2e/auth-state/client.json',
  },
  clinic: {
    email: process.env.E2E_CLINIC_EMAIL ?? 'e2e-clinic@fuzzycatapp.com',
    role: 'clinic' as const,
    home: '/clinic/dashboard',
    storageStatePath: 'e2e/auth-state/clinic.json',
  },
  admin: {
    email: process.env.E2E_ADMIN_EMAIL ?? 'e2e-admin@fuzzycatapp.com',
    role: 'admin' as const,
    home: '/admin/dashboard',
    storageStatePath: 'e2e/auth-state/admin.json',
  },
} as const;

export const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? 'TestPassword123!';

/** Public pages that do not require authentication. */
export const PUBLIC_ROUTES = [
  '/',
  '/how-it-works',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
] as const;

/** Routes that require authentication and redirect to /login when unauthenticated. */
export const PROTECTED_ROUTES = [
  '/client/payments',
  '/client/settings',
  '/clinic/dashboard',
  '/clinic/onboarding',
  '/clinic/clients',
  '/clinic/payouts',
  '/clinic/reports',
  '/clinic/settings',
  '/admin/dashboard',
  '/admin/clinics',
  '/admin/payments',
] as const;

/** Client portal routes. */
export const CLIENT_ROUTES = ['/client/payments', '/client/settings'] as const;

/** Clinic portal routes. */
export const CLINIC_ROUTES = [
  '/clinic/dashboard',
  '/clinic/onboarding',
  '/clinic/clients',
  '/clinic/payouts',
  '/clinic/reports',
  '/clinic/settings',
] as const;

/** Admin portal routes. */
export const ADMIN_ROUTES = [
  '/admin/dashboard',
  '/admin/clinics',
  '/admin/payments',
  '/admin/risk',
] as const;
