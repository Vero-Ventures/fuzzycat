import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import { getUserRole, ROLE_HOME, ROLE_PREFIXES } from '@/lib/auth';
import { publicEnv } from '@/lib/env';

const PROTECTED_PREFIXES = ['/clinic', '/owner', '/admin'];
const AUTH_PAGES = ['/login', '/signup'];

/**
 * Routes that are statically generated at build time.
 * These cannot use per-request CSP nonces (the HTML is fixed at build time),
 * so they use a relaxed CSP with 'unsafe-inline' instead of 'strict-dynamic'.
 */
const STATIC_ROUTES = new Set([
  '/',
  '/how-it-works',
  '/signup',
  '/forgot-password',
  '/reset-password',
]);

/**
 * Parse a Sentry DSN to build the CSP report-uri endpoint.
 * DSN format: https://<key>@<host>/<projectId>
 * Report URI: https://<host>/api/<projectId>/security/?sentry_key=<key>
 */
function buildCspReportUri(dsn: string | undefined): string | null {
  if (!dsn) return null;
  try {
    const url = new URL(dsn);
    const key = url.username;
    const projectId = url.pathname.replace('/', '');
    return `${url.protocol}//${url.host}/api/${projectId}/security/?sentry_key=${key}`;
  } catch {
    return null;
  }
}

function buildCspDirectives(scriptSrc: string, sentryDsn?: string): string {
  const reportUri = buildCspReportUri(sentryDsn);

  const directives = [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self'",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://*.plaid.com https://us.i.posthog.com https://*.ingest.us.sentry.io",
    'frame-src https://js.stripe.com https://cdn.plaid.com https://challenges.cloudflare.com https://connect-js.stripe.com',
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    'upgrade-insecure-requests',
    ...(reportUri ? [`report-uri ${reportUri}`] : []),
  ];

  return directives.join('; ');
}

/**
 * Build CSP header appropriate for the route type.
 *
 * Dynamic routes use 'strict-dynamic' + per-request nonce for maximum script
 * security. Static/pre-rendered routes cannot embed nonces in their HTML at
 * build time, so they fall back to 'unsafe-inline' for scripts like the
 * next-themes theme-detection snippet.
 */
function buildCspHeader(pathname: string, nonce: string, sentryDsn?: string): string {
  if (STATIC_ROUTES.has(pathname)) {
    return buildCspDirectives("script-src 'self' 'unsafe-inline' https:", sentryDsn);
  }
  return buildCspDirectives(
    `script-src 'nonce-${nonce}' 'strict-dynamic' https: 'unsafe-inline'`,
    sentryDsn,
  );
}

function buildAuthRedirect(request: NextRequest, pathname: string): NextResponse | null {
  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (isProtected) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }
  return null;
}

function buildRoleRedirect(
  request: NextRequest,
  pathname: string,
  role: string,
): NextResponse | null {
  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (isProtected) {
    const allowed = ROLE_PREFIXES[role as keyof typeof ROLE_PREFIXES];
    const hasAccess = allowed.some((prefix) => pathname.startsWith(prefix));
    if (!hasAccess) {
      const homeUrl = request.nextUrl.clone();
      homeUrl.pathname = ROLE_HOME[role as keyof typeof ROLE_HOME];
      return NextResponse.redirect(homeUrl);
    }
  }
  return null;
}

export async function middleware(request: NextRequest) {
  const startTime = performance.now();
  const nonce = crypto.randomUUID();
  const { pathname } = request.nextUrl;

  // Set x-nonce and x-request-id request headers so Server Components can access them via headers()
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('x-request-id', nonce);

  let env: ReturnType<typeof publicEnv>;
  try {
    env = publicEnv();
  } catch (error) {
    console.error(
      '[middleware] env validation failed — passing through:',
      error instanceof Error ? error.message : error,
    );
    const passThrough = NextResponse.next({
      request: { headers: requestHeaders },
    });
    passThrough.headers.set('Content-Security-Policy', buildCspHeader(pathname, nonce));
    return passThrough;
  }

  const cspHeader = buildCspHeader(pathname, nonce, env.NEXT_PUBLIC_SENTRY_DSN);

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });
  supabaseResponse.headers.set('Content-Security-Policy', cspHeader);

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          supabaseResponse = NextResponse.next({
            request: { headers: requestHeaders },
          });
          supabaseResponse.headers.set('Content-Security-Policy', cspHeader);
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Determine if the route needs authentication before making the network call.
  // This avoids ~100-200ms of latency on public routes (/, /pricing, etc.).
  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const isAuthPage = AUTH_PAGES.some((page) => pathname.startsWith(page));
  const needsAuth = isProtected || isAuthPage;

  // Only call getUser() when the route actually needs auth state.
  // The createServerClient() call above still handles cookie refresh on all routes.
  let user = null;
  if (needsAuth) {
    try {
      const { data } = await supabase.auth.getUser();
      user = data.user;
    } catch {
      // Supabase unreachable — treat as unauthenticated
    }
  }

  // Redirect unauthenticated users away from protected routes
  if (!user) {
    const redirect = buildAuthRedirect(request, pathname);
    if (redirect) return redirect;
  }

  // Redirect authenticated users accessing a portal that doesn't match their role
  if (user) {
    const role = getUserRole(user);
    const roleRedirect = buildRoleRedirect(request, pathname, role);
    if (roleRedirect) return roleRedirect;

    // Redirect authenticated users away from auth pages to their portal
    const isAuthPage = AUTH_PAGES.some((page) => pathname.startsWith(page));
    if (isAuthPage) {
      const homeUrl = request.nextUrl.clone();
      homeUrl.pathname = ROLE_HOME[role];
      return NextResponse.redirect(homeUrl);
    }

    // Inject auth headers so portal layouts and tRPC can skip redundant getUser() calls.
    // These headers are internal (set via NextResponse.next({ request: { headers } }))
    // and cannot be spoofed from the client.
    requestHeaders.set('x-user-id', user.id);
    requestHeaders.set('x-user-role', role);

    // Recreate supabaseResponse to include the new request headers,
    // preserving any cookies set by the Supabase SSR client.
    const existingCookies = [...supabaseResponse.cookies.getAll()];
    supabaseResponse = NextResponse.next({
      request: { headers: requestHeaders },
    });
    supabaseResponse.headers.set('Content-Security-Policy', cspHeader);
    for (const cookie of existingCookies) {
      supabaseResponse.cookies.set(cookie);
    }
  }

  const duration = performance.now() - startTime;
  supabaseResponse.headers.set('Server-Timing', `middleware;dur=${duration.toFixed(1)}`);

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt
     * - public files with extensions
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
