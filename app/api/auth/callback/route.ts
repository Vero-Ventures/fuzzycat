import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { SAFE_REDIRECT_PREFIXES } from '@/lib/auth';
import { publicEnv } from '@/lib/env';

function isSafeRedirect(path: string): boolean {
  if (path === '/') return true;
  return SAFE_REDIRECT_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const rawRedirect = searchParams.get('redirectTo') ?? '/';
  const redirectTo = isSafeRedirect(rawRedirect) ? rawRedirect : '/';

  if (code) {
    const cookieStore = await cookies();
    const env = publicEnv();
    const supabase = createServerClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          },
        },
      },
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${redirectTo}`);
    }
  }

  // Return to login with error on failure
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
