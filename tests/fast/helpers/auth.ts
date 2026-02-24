const cookieCache = new Map<string, string>();

const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? 'TestPassword123!';

const ROLE_EMAILS: Record<string, string> = {
  owner: process.env.E2E_OWNER_EMAIL ?? 'e2e-owner@fuzzycatapp.com',
  clinic: process.env.E2E_CLINIC_EMAIL ?? 'e2e-clinic@fuzzycatapp.com',
  admin: process.env.E2E_ADMIN_EMAIL ?? 'e2e-admin@fuzzycatapp.com',
};

const MAX_CHUNK = 3180;

export async function getAuthCookies(role: 'owner' | 'clinic' | 'admin'): Promise<string> {
  const cached = cookieCache.get(role);
  if (cached) return cached;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  const email = ROLE_EMAILS[role];
  if (!email) {
    throw new Error(`No email configured for role: ${role}`);
  }

  const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
    },
    body: JSON.stringify({ email, password: TEST_PASSWORD }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Auth failed for ${role}: ${res.status} ${body}`);
  }

  const session = await res.json();
  const sessionJson = JSON.stringify(session);
  const base64Value = `base64-${Buffer.from(sessionJson).toString('base64url')}`;

  const ref = new URL(supabaseUrl).hostname.split('.')[0];
  const cookieName = `sb-${ref}-auth-token`;

  const cookieParts: string[] = [];
  if (base64Value.length <= MAX_CHUNK) {
    cookieParts.push(`${cookieName}=${base64Value}`);
  } else {
    let remaining = base64Value;
    let i = 0;
    while (remaining.length > 0) {
      const chunk = remaining.substring(0, MAX_CHUNK);
      cookieParts.push(`${cookieName}.${i}=${chunk}`);
      remaining = remaining.substring(MAX_CHUNK);
      i++;
    }
  }

  const cookieHeader = cookieParts.join('; ');
  cookieCache.set(role, cookieHeader);
  return cookieHeader;
}
