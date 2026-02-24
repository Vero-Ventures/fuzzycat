import { existsSync } from 'node:fs';
import { chromium, type FullConfig } from '@playwright/test';
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

/** Log in as a role via browser and save storage state, with retry. */
async function loginAndSaveState(
  baseURL: string,
  roleName: string,
  user: (typeof TEST_USERS)[keyof typeof TEST_USERS],
  browser: Awaited<ReturnType<typeof chromium.launch>>,
) {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(
      `[e2e:global-setup] Logging in as ${roleName}...${attempt > 1 ? ` (attempt ${attempt}/${maxAttempts})` : ''}`,
    );
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await page.waitForSelector('input[name="email"], input[type="email"]', { timeout: 10_000 });
      await page.fill('input[name="email"], input[type="email"]', user.email);
      await page.fill('input[name="password"], input[type="password"]', TEST_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30_000 });
      await context.storageState({ path: user.storageStatePath });
      console.log(`  ✓ Saved auth state → ${user.storageStatePath}`);
      return;
    } catch (error) {
      const isLastAttempt = attempt === maxAttempts;
      if (isLastAttempt) {
        const hasExisting = existsSync(user.storageStatePath);
        if (hasExisting) {
          console.warn(
            `[e2e:global-setup] Login failed for ${roleName} after ${maxAttempts} attempts — using existing auth state from ${user.storageStatePath}`,
          );
        } else {
          console.error(
            '[e2e:global-setup] Login failed for %s after %d attempts and no existing auth state:',
            roleName,
            maxAttempts,
            error,
          );
        }
      } else {
        console.warn(
          `[e2e:global-setup] Login attempt ${attempt} failed for ${roleName}, retrying...`,
        );
      }
    } finally {
      await context.close();
    }
  }
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
 * Global setup: creates E2E test users via Supabase admin API (idempotent),
 * then logs in as each role via browser and saves storage state (cookies).
 */
async function globalSetup(config: FullConfig) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
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

  const browser = await chromium.launch();

  for (const [roleName, user] of Object.entries(TEST_USERS)) {
    await loginAndSaveState(baseURL, roleName, user, browser);
  }

  await browser.close();
}

export default globalSetup;
