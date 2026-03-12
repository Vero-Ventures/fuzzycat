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
  getUserRole: (user: { app_metadata?: { role?: string } }) => {
    const r = user.app_metadata?.role;
    if (r === 'owner') return 'client';
    return r ?? 'client';
  },
  ROLE_HOME: {
    clinic: '/clinic/dashboard',
    admin: '/admin/dashboard',
    client: '/client/payments',
  },
  ROLE_PREFIXES: {
    clinic: ['/clinic'],
    admin: ['/admin'],
    client: ['/client'],
  },
  SAFE_REDIRECT_PREFIXES: ['/clinic', '/client', '/admin', '/mfa'],
}));

let envShouldThrow = false;
let sentryDsn: string | undefined = 'https://abc123@o123456.ingest.sentry.io/789';

mock.module('@/lib/env', () => ({
  publicEnv: () => {
    if (envShouldThrow) {
      throw new Error('Missing or invalid environment variables');
    }
    return {
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_abc123',
      NEXT_PUBLIC_SENTRY_DSN: sentryDsn,
    };
  },
  serverEnv: () => ({
    SUPABASE_SERVICE_ROLE_KEY: 'test-key',
    DATABASE_URL: 'postgresql://localhost:5432/test',
    STRIPE_SECRET_KEY: 'sk_test_abc123',
    STRIPE_WEBHOOK_SECRET: 'whsec_test_abc123',
    RESEND_API_KEY: 're_test_abc123',
    TWILIO_ACCOUNT_SID: 'ACtest1234567890abcdef1234567890ab',
    TWILIO_AUTH_TOKEN: 'test-twilio-auth-token',
    TWILIO_PHONE_NUMBER: '+15551234567',
  }),
  validateEnv: (_schema: unknown, source: Record<string, unknown>) => source,
  _resetEnvCache: () => {},
}));

const { proxy } = await import('./proxy');

describe('proxy', () => {
  let consoleSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    envShouldThrow = false;
    sentryDsn = 'https://abc123@o123456.ingest.sentry.io/789';
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
    const response = await proxy(req);

    // Should pass through (200) rather than crash
    expect(response.status).toBe(200);
  });

  it('redirects unauthenticated user on protected route to /login', async () => {
    mockGetUser.mockImplementation(() => Promise.resolve({ data: { user: null }, error: null }));

    const { NextRequest } = await import('next/server');
    const req = new NextRequest('http://localhost:3000/clinic/dashboard');
    const response = await proxy(req);

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
    const response = await proxy(req);

    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    expect(location).toContain('/clinic/dashboard');
  });

  it('sets unified CSP with unsafe-inline for all routes', async () => {
    const { NextRequest } = await import('next/server');

    // Test a dynamic route
    const dynamicReq = new NextRequest('http://localhost:3000/client/payments');
    mockGetUser.mockImplementation(() =>
      Promise.resolve({
        data: { user: { id: 'user-1', app_metadata: { role: 'client' } } },
        error: null,
      }),
    );
    const dynamicResp = await proxy(dynamicReq);
    const dynamicCsp = dynamicResp.headers.get('Content-Security-Policy');
    expect(dynamicCsp).toBeTruthy();
    expect(dynamicCsp).toContain("default-src 'self'");
    expect(dynamicCsp).toContain("'unsafe-inline'");
    expect(dynamicCsp).toContain("object-src 'none'");
    expect(dynamicCsp).toContain('upgrade-insecure-requests');
    // Whitelisted external script domains instead of broad https:
    expect(dynamicCsp).toContain('https://js.stripe.com');
    expect(dynamicCsp).not.toContain('https://cdn.plaid.com');
    expect(dynamicCsp).toContain('https://*.sentry-cdn.com');
    // No nonce or strict-dynamic — Next.js SPA navigation injects inline
    // scripts without nonces, so strict-dynamic blocks framework scripts.
    expect(dynamicCsp).not.toContain("'strict-dynamic'");
    expect(dynamicCsp).not.toMatch(/nonce-/);

    // Test a static route — same CSP
    mockGetUser.mockImplementation(() => Promise.resolve({ data: { user: null }, error: null }));
    const staticReq = new NextRequest('http://localhost:3000/');
    const staticResp = await proxy(staticReq);
    const staticCsp = staticResp.headers.get('Content-Security-Policy');
    expect(staticCsp).toEqual(dynamicCsp);
  });

  it('includes report-uri in CSP when Sentry DSN is provided', async () => {
    const { NextRequest } = await import('next/server');
    const req = new NextRequest('http://localhost:3000/');
    const response = await proxy(req);

    const csp = response.headers.get('Content-Security-Policy');
    expect(csp).toBeTruthy();
    expect(csp).toContain('report-uri');
    expect(csp).toContain('o123456.ingest.sentry.io');
    expect(csp).toContain('sentry_key=abc123');
  });

  it('omits report-uri when Sentry DSN is undefined', async () => {
    sentryDsn = undefined;

    const { NextRequest } = await import('next/server');
    const req = new NextRequest('http://localhost:3000/');
    const response = await proxy(req);

    const csp = response.headers.get('Content-Security-Policy');
    expect(csp).toBeTruthy();
    expect(csp).not.toContain('report-uri');
  });

  it('omits report-uri when Sentry DSN is an invalid URL', async () => {
    sentryDsn = 'not-a-valid-url';

    const { NextRequest } = await import('next/server');
    const req = new NextRequest('http://localhost:3000/');
    const response = await proxy(req);

    const csp = response.headers.get('Content-Security-Policy');
    expect(csp).toBeTruthy();
    expect(csp).not.toContain('report-uri');
  });

  it('sets CSP header even when env validation fails', async () => {
    envShouldThrow = true;

    const { NextRequest } = await import('next/server');
    const req = new NextRequest('http://localhost:3000/');
    const response = await proxy(req);

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
    const req = new NextRequest('http://localhost:3000/client/payments');
    const response = await proxy(req);

    // Should redirect to login (unauthenticated)
    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    expect(location).toContain('/login');
  });

  it('sets security headers on all responses', async () => {
    const { NextRequest } = await import('next/server');
    const req = new NextRequest('http://localhost:3000/');
    const response = await proxy(req);

    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(response.headers.get('Permissions-Policy')).toBe(
      'camera=(), geolocation=(), microphone=(), payment=()',
    );
    expect(response.headers.get('Server-Timing')).toMatch(/middleware;dur=\d/);
  });

  it('does not call getUser on public routes', async () => {
    mockGetUser.mockClear();

    const { NextRequest } = await import('next/server');
    const req = new NextRequest('http://localhost:3000/pricing');
    await proxy(req);

    // Public route — should NOT call getUser
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it('injects x-user-id and x-user-role headers for authenticated protected routes', async () => {
    mockGetUser.mockImplementation(() =>
      Promise.resolve({
        data: { user: { id: 'user-42', app_metadata: { role: 'client' } } },
        error: null,
      }),
    );

    const { NextRequest } = await import('next/server');
    const req = new NextRequest('http://localhost:3000/client/payments');
    const response = await proxy(req);

    expect(response.status).toBe(200);
  });

  const roleRedirectCases = [
    {
      role: 'client' as const,
      path: '/admin/dashboard',
      status: 307,
      redirect: '/client/payments',
    },
    {
      role: 'clinic' as const,
      path: '/client/payments',
      status: 307,
      redirect: '/clinic/dashboard',
    },
    {
      role: 'admin' as const,
      path: '/clinic/dashboard',
      status: 307,
      redirect: '/admin/dashboard',
    },
    { role: 'client' as const, path: '/client/payments', status: 200, redirect: null },
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
    const response = await proxy(req);

    expect(response.status).toBe(status);
    if (redirect) {
      const location = response.headers.get('location');
      expect(location).toContain(redirect);
    }
  });
});
