import { existsSync, writeFileSync } from 'node:fs';
import type { FullConfig } from '@playwright/test';
import { TEST_PASSWORD, TEST_USERS } from './helpers/test-users';

/** Ensure a single test user exists via Supabase Admin API (create-first approach). */
async function ensureUser(
  supabaseUrl: string,
  serviceRoleKey: string,
  email: string,
  role: string,
  roleName: string,
) {
  console.log(`[e2e:global-setup] Ensuring user: ${email} (${roleName})`);

  const createRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password: TEST_PASSWORD,
      email_confirm: true,
      app_metadata: { role },
    }),
  });

  if (createRes.ok) {
    const created = (await createRes.json()) as { id: string };
    console.log(`  ✓ Created (${created.id})`);
    return;
  }

  const responseText = await createRes.text();

  if (
    createRes.status === 422 &&
    (responseText.includes('already') || responseText.includes('email_exists'))
  ) {
    console.log('  ✓ Already exists');
    return;
  }

  console.error(
    '[e2e:global-setup] Failed to create %s: %d %s',
    email,
    createRes.status,
    responseText,
  );
}

/**
 * Authenticate via Supabase Auth API and write a Playwright-compatible
 * storage state file with the auth cookie. This bypasses the browser
 * login form entirely, avoiding React hydration timing issues.
 */
async function loginViaAPI(
  supabaseUrl: string,
  anonKey: string,
  baseURL: string,
  roleName: string,
  user: (typeof TEST_USERS)[keyof typeof TEST_USERS],
) {
  console.log(`[e2e:global-setup] Authenticating ${roleName} via API...`);

  const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
    },
    body: JSON.stringify({ email: user.email, password: TEST_PASSWORD }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`[e2e:global-setup] Auth API failed for ${roleName}: ${res.status} ${body}`);
    return;
  }

  const session = await res.json();

  // Build the cookie value in the format @supabase/ssr expects:
  // "base64-" + base64url(JSON.stringify(session))
  const sessionJson = JSON.stringify(session);
  const base64Value = `base64-${Buffer.from(sessionJson).toString('base64url')}`;

  // Extract project ref from Supabase URL (e.g. "nkndduzbzshjaaeicmad")
  const ref = new URL(supabaseUrl).hostname.split('.')[0];
  const cookieName = `sb-${ref}-auth-token`;

  // @supabase/ssr chunks cookies at 3180 chars (after URI-encoding).
  // Build the cookie array — single cookie or chunked.
  const MAX_CHUNK = 3180;
  const encoded = encodeURIComponent(base64Value);

  type CookieEntry = {
    name: string;
    value: string;
    domain: string;
    path: string;
    httpOnly: boolean;
    secure: boolean;
    sameSite: string;
    expires: number;
  };

  const domain = new URL(baseURL).hostname;
  const cookies: CookieEntry[] = [];

  if (encoded.length <= MAX_CHUNK) {
    cookies.push({
      name: cookieName,
      value: base64Value,
      domain,
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
      expires: -1,
    });
  } else {
    // Chunk the encoded value
    let remaining = encoded;
    let i = 0;
    while (remaining.length > 0) {
      cookies.push({
        name: `${cookieName}.${i}`,
        value: decodeURIComponent(remaining.substring(0, MAX_CHUNK)),
        domain,
        path: '/',
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
        expires: -1,
      });
      remaining = remaining.substring(MAX_CHUNK);
      i++;
    }
  }

  const storageState = { cookies, origins: [] };
  writeFileSync(user.storageStatePath, JSON.stringify(storageState, null, 2));
  console.log(`  ✓ Saved auth state → ${user.storageStatePath}`);
}

/** Warm up the dev server by hitting the homepage before running login flows. */
async function warmUpServer(baseURL: string) {
  console.log('[e2e:global-setup] Warming up dev server...');
  try {
    const res = await fetch(`${baseURL}/api/health`, { signal: AbortSignal.timeout(15_000) });
    console.log(`  ✓ Server responded (${res.status})`);
  } catch {
    console.warn('  ⚠ Health check failed — continuing anyway');
  }
}

/**
 * Create empty (unauthenticated) storage state files so Playwright does not
 * crash with ENOENT when a test references a missing auth state path.
 * Portal tests that depend on real auth will fail assertions in
 * `gotoPortalPage()` but at least the test runner can start.
 */
function ensureStorageStateFiles() {
  const emptyState = JSON.stringify({ cookies: [], origins: [] });
  for (const user of Object.values(TEST_USERS)) {
    if (!existsSync(user.storageStatePath)) {
      writeFileSync(user.storageStatePath, emptyState, 'utf-8');
      console.log(`[e2e:global-setup] Created empty auth state → ${user.storageStatePath}`);
    }
  }
}

/**
 * Global setup: creates E2E test users via Supabase admin API (idempotent),
 * then authenticates each role via the Auth REST API and saves storage state.
 */
async function globalSetup(config: FullConfig) {
  // Always ensure storage state files exist so Playwright doesn't crash
  ensureStorageStateFiles();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const isPlaceholder = !supabaseUrl || !serviceRoleKey || supabaseUrl.includes('placeholder');
  if (isPlaceholder) {
    console.warn(
      '[e2e:global-setup] Missing or placeholder SUPABASE env vars — skipping user provisioning.',
    );
    return;
  }

  for (const [roleName, user] of Object.entries(TEST_USERS)) {
    await ensureUser(supabaseUrl, serviceRoleKey, user.email, user.role, roleName);
  }

  const baseURL = config.projects[0]?.use?.baseURL ?? 'http://localhost:3000';
  await warmUpServer(baseURL);

  // Authenticate via API — no browser needed, no hydration dependency
  if (!anonKey) {
    console.warn('[e2e:global-setup] Missing SUPABASE_ANON_KEY — skipping API login.');
    return;
  }

  for (const [roleName, user] of Object.entries(TEST_USERS)) {
    await loginViaAPI(supabaseUrl, anonKey, baseURL, roleName, user);
  }
}

export default globalSetup;
