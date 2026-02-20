import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import { getUserRole, ROLE_HOME } from '@/lib/auth';
import { publicEnv } from '@/lib/env';

const PROTECTED_PREFIXES = ['/clinic', '/owner', '/admin'];
const AUTH_PAGES = ['/login', '/signup'];

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const env = publicEnv();
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
          supabaseResponse = NextResponse.next({ request });
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
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
