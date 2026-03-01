import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';

// Mock modules before imports
const mockGetUser = mock(
  (): Promise<{ data: { user: unknown }; error: null }> =>
    Promise.resolve({ data: { user: null }, error: null }),
);

mock.module('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getUser: mockGetUser },
  }),
}));

mock.module('@/lib/auth', () => ({
  getUserRole: (user: { app_metadata?: { role?: string } }) => user.app_metadata?.role ?? 'owner',
  ROLE_HOME: {
    clinic: '/clinic/dashboard',
    admin: '/admin/dashboard',
    owner: '/owner/payments',
  },
  ROLE_PREFIXES: {
    clinic: ['/clinic'],
    admin: ['/admin'],
    owner: ['/owner'],
  },
  SAFE_REDIRECT_PREFIXES: ['/clinic', '/owner', '/admin', '/mfa'],
}));

let envShouldThrow = false;

mock.module('@/lib/env', () => ({
  publicEnv: () => {
    if (envShouldThrow) {
      throw new Error('Missing or invalid environment variables');
    }
    return {
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_abc123',
    };
  },
  serverEnv: () => ({
    SUPABASE_SERVICE_ROLE_KEY: 'test-key',
    DATABASE_URL: 'postgresql://localhost:5432/test',
    STRIPE_SECRET_KEY: 'sk_test_abc123',
    STRIPE_WEBHOOK_SECRET: 'whsec_test_abc123',
    RESEND_API_KEY: 're_test_abc123',
    PLAID_CLIENT_ID: 'test-plaid-client-id',
    PLAID_SECRET: 'test-plaid-secret',
    PLAID_ENV: 'sandbox',
    TWILIO_ACCOUNT_SID: 'ACtest1234567890abcdef1234567890ab',
    TWILIO_AUTH_TOKEN: 'test-twilio-auth-token',
    TWILIO_PHONE_NUMBER: '+15551234567',
  }),
  validateEnv: (_schema: unknown, source: Record<string, unknown>) => source,
  _resetEnvCache: () => {},
}));

const { middleware } = await import('./middleware');

describe('middleware', () => {
  let consoleSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    envShouldThrow = false;
    mockGetUser.mockImplementation(() => Promise.resolve({ data: { user: null }, error: null }));
    consoleSpy = spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('passes through when publicEnv() throws', async () => {
    envShouldThrow = true;

    const { NextRequest } = await import('next/server');
    const req = new NextRequest('http://localhost:3000/clinic/dashboard');
    const response = await middleware(req);

    // Should pass through (200) rather than crash
    expect(response.status).toBe(200);
  });

  it('redirects unauthenticated user on protected route to /login', async () => {
    mockGetUser.mockImplementation(() => Promise.resolve({ data: { user: null }, error: null }));

    const { NextRequest } = await import('next/server');
    const req = new NextRequest('http://localhost:3000/clinic/dashboard');
    const response = await middleware(req);

    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    expect(location).toContain('/login');
    expect(location).toContain('redirectTo=%2Fclinic%2Fdashboard');
  });

  it('redirects authenticated user on auth page to role home', async () => {
    mockGetUser.mockImplementation(() =>
      Promise.resolve({
        data: {
          user: {
            id: 'user-1',
            app_metadata: { role: 'clinic' },
          },
        },
        error: null,
      }),
    );

    const { NextRequest } = await import('next/server');
    const req = new NextRequest('http://localhost:3000/login');
    const response = await middleware(req);

    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    expect(location).toContain('/clinic/dashboard');
  });

  it('sets unified CSP with unsafe-inline for all routes', async () => {
    const { NextRequest } = await import('next/server');

    // Test a dynamic route
    const dynamicReq = new NextRequest('http://localhost:3000/owner/payments');
    mockGetUser.mockImplementation(() =>
      Promise.resolve({
        data: { user: { id: 'user-1', app_metadata: { role: 'owner' } } },
        error: null,
      }),
    );
    const dynamicResp = await middleware(dynamicReq);
    const dynamicCsp = dynamicResp.headers.get('Content-Security-Policy');
    expect(dynamicCsp).toBeTruthy();
    expect(dynamicCsp).toContain("default-src 'self'");
    expect(dynamicCsp).toContain("'unsafe-inline'");
    expect(dynamicCsp).toContain("object-src 'none'");
    expect(dynamicCsp).toContain('upgrade-insecure-requests');
    // Whitelisted external script domains instead of broad https:
    expect(dynamicCsp).toContain('https://js.stripe.com');
    expect(dynamicCsp).toContain('https://cdn.plaid.com');
    expect(dynamicCsp).toContain('https://*.sentry-cdn.com');
    // No nonce or strict-dynamic — Next.js SPA navigation injects inline
    // scripts without nonces, so strict-dynamic blocks framework scripts.
    expect(dynamicCsp).not.toContain("'strict-dynamic'");
    expect(dynamicCsp).not.toMatch(/nonce-/);

    // Test a static route — same CSP
    mockGetUser.mockImplementation(() => Promise.resolve({ data: { user: null }, error: null }));
    const staticReq = new NextRequest('http://localhost:3000/');
    const staticResp = await middleware(staticReq);
    const staticCsp = staticResp.headers.get('Content-Security-Policy');
    expect(staticCsp).toEqual(dynamicCsp);
  });

  it('sets CSP header even when env validation fails', async () => {
    envShouldThrow = true;

    const { NextRequest } = await import('next/server');
    const req = new NextRequest('http://localhost:3000/');
    const response = await middleware(req);

    const csp = response.headers.get('Content-Security-Policy');
    expect(csp).toBeTruthy();
    expect(csp).toContain("default-src 'self'");
    // Should not contain report-uri when env fails (no DSN available)
    expect(csp).not.toContain('report-uri');
  });

  it('treats Supabase errors as unauthenticated', async () => {
    mockGetUser.mockImplementation(() => {
      throw new Error('Supabase unreachable');
    });

    const { NextRequest } = await import('next/server');
    const req = new NextRequest('http://localhost:3000/owner/payments');
    const response = await middleware(req);

    // Should redirect to login (unauthenticated)
    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    expect(location).toContain('/login');
  });

  const roleRedirectCases = [
    { role: 'owner' as const, path: '/admin/dashboard', status: 307, redirect: '/owner/payments' },
    {
      role: 'clinic' as const,
      path: '/owner/payments',
      status: 307,
      redirect: '/clinic/dashboard',
    },
    {
      role: 'admin' as const,
      path: '/clinic/dashboard',
      status: 307,
      redirect: '/admin/dashboard',
    },
    { role: 'owner' as const, path: '/owner/payments', status: 200, redirect: null },
  ];

  it.each(roleRedirectCases)('authenticated $role accessing $path → $status', async ({
    role,
    path,
    status,
    redirect,
  }) => {
    mockGetUser.mockImplementation(() =>
      Promise.resolve({
        data: { user: { id: 'user-1', app_metadata: { role } } },
        error: null,
      }),
    );

    const { NextRequest } = await import('next/server');
    const req = new NextRequest(`http://localhost:3000${path}`);
    const response = await middleware(req);

    expect(response.status).toBe(status);
    if (redirect) {
      const location = response.headers.get('location');
      expect(location).toContain(redirect);
    }
  });
});
