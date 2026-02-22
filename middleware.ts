import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import { getUserRole, ROLE_HOME } from '@/lib/auth';
import { publicEnv } from '@/lib/env';

const PROTECTED_PREFIXES = ['/clinic', '/owner', '/admin'];
const AUTH_PAGES = ['/login', '/signup'];

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

function buildCspHeader(nonce: string, sentryDsn?: string): string {
  const reportUri = buildCspReportUri(sentryDsn);

  const directives = [
    "default-src 'self'",
    `script-src 'nonce-${nonce}' 'strict-dynamic' https: 'unsafe-inline'`,
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

export async function middleware(request: NextRequest) {
  const nonce = crypto.randomUUID();

  // Set x-nonce request header so Server Components can access it via headers()
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

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
    passThrough.headers.set('Content-Security-Policy', buildCspHeader(nonce));
    return passThrough;
  }

  const cspHeader = buildCspHeader(nonce, env.NEXT_PUBLIC_SENTRY_DSN);

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

  // Refresh session — required by @supabase/ssr to keep cookies in sync.
  // Wrapped in try/catch so the middleware doesn't crash if Supabase is unreachable
  // (e.g. CI environments, transient outages). Treat as unauthenticated on failure.
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Supabase unreachable — treat as unauthenticated
  }

  const { pathname } = request.nextUrl;

  // Redirect unauthenticated users away from protected routes
  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from auth pages to their portal
  const isAuthPage = AUTH_PAGES.some((page) => pathname.startsWith(page));
  if (isAuthPage && user) {
    const role = getUserRole(user);
    const home = ROLE_HOME[role];
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = home;
    return NextResponse.redirect(homeUrl);
  }

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
