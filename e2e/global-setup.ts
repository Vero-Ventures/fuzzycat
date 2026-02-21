import { chromium, type FullConfig } from '@playwright/test';
import { TEST_PASSWORD, TEST_USERS } from './helpers/test-users';

type UserEntry = { id: string; email: string };

/** Ensure a single test user exists via Supabase Admin API. */
async function ensureUser(
  supabaseUrl: string,
  serviceRoleKey: string,
  email: string,
  role: string,
  roleName: string,
) {
  console.log(`[e2e:global-setup] Ensuring user: ${email} (${roleName})`);

  const listRes = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=1&per_page=50`, {
    headers: { Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey },
  });

  if (!listRes.ok) {
    console.error(`[e2e:global-setup] Failed to list users: ${listRes.status}`);
    return;
  }

  const { users } = (await listRes.json()) as { users: UserEntry[] };
  const existing = users.find((u) => u.email === email);

  if (existing) {
    console.log(`  ✓ Already exists (${existing.id})`);
    return;
  }

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

  if (!createRes.ok) {
    console.error(`[e2e:global-setup] Failed to create ${email}: ${createRes.status}`);
    return;
  }

  const created = (await createRes.json()) as { id: string };
  console.log(`  ✓ Created (${created.id})`);
}

/** Log in as a role via browser and save storage state. */
async function loginAndSaveState(
  baseURL: string,
  roleName: string,
  user: (typeof TEST_USERS)[keyof typeof TEST_USERS],
  browser: Awaited<ReturnType<typeof chromium.launch>>,
) {
  console.log(`[e2e:global-setup] Logging in as ${roleName}...`);
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(`${baseURL}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[name="email"], input[type="email"]', user.email);
    await page.fill('input[name="password"], input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15_000 });
    await context.storageState({ path: user.storageStatePath });
    console.log(`  ✓ Saved auth state → ${user.storageStatePath}`);
  } catch (error) {
    console.error('[e2e:global-setup] Login failed for %s:', roleName, error);
  } finally {
    await context.close();
  }
}

/**
 * Global setup: creates E2E test users via Supabase admin API (idempotent),
 * then logs in as each role via browser and saves storage state (cookies).
 */
async function globalSetup(config: FullConfig) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn('[e2e:global-setup] Missing SUPABASE env vars — skipping user provisioning.');
    return;
  }

  for (const [roleName, user] of Object.entries(TEST_USERS)) {
    await ensureUser(supabaseUrl, serviceRoleKey, user.email, user.role, roleName);
  }

  const baseURL = config.projects[0]?.use?.baseURL ?? 'http://localhost:3000';
  const browser = await chromium.launch();

  for (const [roleName, user] of Object.entries(TEST_USERS)) {
    await loginAndSaveState(baseURL, roleName, user, browser);
  }

  await browser.close();
}

export default globalSetup;
