#!/usr/bin/env bun
/**
 * Standalone script to provision E2E test users in Supabase.
 * Run manually: `bun run scripts/e2e-create-test-users.ts`
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

const USERS = [
  {
    email: process.env.E2E_OWNER_EMAIL ?? 'e2e-owner@fuzzycatapp.com',
    role: 'owner',
  },
  {
    email: process.env.E2E_CLINIC_EMAIL ?? 'e2e-clinic@fuzzycatapp.com',
    role: 'clinic',
  },
  {
    email: process.env.E2E_ADMIN_EMAIL ?? 'e2e-admin@fuzzycatapp.com',
    role: 'admin',
  },
];

const PASSWORD = process.env.E2E_TEST_PASSWORD ?? 'TestPassword123!';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  console.error('Make sure .env.local is loaded (bun auto-loads it).');
  process.exit(1);
}

const validatedKey = SERVICE_KEY;

async function createUser(email: string, role: string) {
  const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=50`, {
    headers: {
      Authorization: `Bearer ${validatedKey}`,
      apikey: validatedKey,
    },
  });

  if (!listRes.ok) {
    console.error(`Failed to list users: ${listRes.status}`);
    return;
  }

  const { users } = (await listRes.json()) as {
    users: Array<{ id: string; email: string }>;
  };

  if (users.find((u) => u.email === email)) {
    console.log(`✓ ${email} (${role}) — already exists`);
    return;
  }

  const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${validatedKey}`,
      apikey: validatedKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password: PASSWORD,
      email_confirm: true,
      app_metadata: { role },
    }),
  });

  if (!createRes.ok) {
    console.error(`✗ ${email} (${role}) — ${createRes.status}: ${await createRes.text()}`);
    return;
  }

  const created = (await createRes.json()) as { id: string };
  console.log(`✓ ${email} (${role}) — created (${created.id})`);
}

console.log('Provisioning E2E test users...\n');

for (const user of USERS) {
  await createUser(user.email, user.role);
}

console.log('\nDone.');

export {};
