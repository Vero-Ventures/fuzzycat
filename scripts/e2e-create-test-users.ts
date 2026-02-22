#!/usr/bin/env bun
/**
 * Standalone script to provision E2E test users in Supabase AND create
 * corresponding identity rows in the database (clinics/owners tables).
 *
 * Run manually: `bun run scripts/e2e-create-test-users.ts`
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { eq } from 'drizzle-orm';
import { db } from '@/server/db';
import { clinics, owners } from '@/server/db/schema';

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
] as const;

const PASSWORD = process.env.E2E_TEST_PASSWORD ?? 'TestPassword123!';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  console.error('Make sure .env.local is loaded (bun auto-loads it).');
  process.exit(1);
}

const validatedKey = SERVICE_KEY;

type AuthUser = { id: string; email?: string };

async function createOrGetUser(email: string, role: string): Promise<string | null> {
  // Try to create the user
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

  if (createRes.ok) {
    const created = (await createRes.json()) as AuthUser;
    console.log(`  Auth: created (${created.id})`);
    return created.id;
  }

  const responseText = await createRes.text();

  if (
    createRes.status === 422 &&
    (responseText.includes('email_exists') || responseText.includes('already been registered'))
  ) {
    // User exists — look up their ID
    const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=50`, {
      headers: {
        Authorization: `Bearer ${validatedKey}`,
        apikey: validatedKey,
      },
    });

    if (listRes.ok) {
      const data = (await listRes.json()) as { users: AuthUser[] };
      const existing = data.users.find((u) => u.email === email);
      if (existing) {
        console.log(`  Auth: already exists (${existing.id})`);
        return existing.id;
      }
    }

    console.log(`  Auth: already exists (ID unknown)`);
    return null;
  }

  console.error(`  Auth: FAILED — ${createRes.status}: ${responseText}`);
  return null;
}

async function ensureClinicRow(authId: string, email: string) {
  const [existing] = await db
    .select({ id: clinics.id })
    .from(clinics)
    .where(eq(clinics.authId, authId))
    .limit(1);

  if (existing) {
    console.log(`  DB: clinic row exists (${existing.id})`);
    return;
  }

  const [created] = await db
    .insert(clinics)
    .values({
      authId,
      name: 'E2E Test Clinic',
      email,
      phone: '(555) 000-0000',
      addressState: 'CA',
      addressZip: '90210',
    })
    .returning({ id: clinics.id });

  console.log(`  DB: clinic row created (${created.id})`);
}

async function ensureOwnerRow(authId: string, email: string) {
  const [existing] = await db
    .select({ id: owners.id })
    .from(owners)
    .where(eq(owners.authId, authId))
    .limit(1);

  if (existing) {
    console.log(`  DB: owner row exists (${existing.id})`);
    return;
  }

  const [created] = await db
    .insert(owners)
    .values({
      authId,
      name: 'E2E Test Owner',
      email,
      phone: '(555) 000-0001',
      petName: 'TestPet',
      paymentMethod: 'debit_card',
    })
    .returning({ id: owners.id });

  console.log(`  DB: owner row created (${created.id})`);
}

console.log('Provisioning E2E test users...\n');

for (const user of USERS) {
  console.log(`${user.email} (${user.role}):`);

  const authId = await createOrGetUser(user.email, user.role);

  if (authId) {
    if (user.role === 'clinic') {
      await ensureClinicRow(authId, user.email);
    } else if (user.role === 'owner') {
      await ensureOwnerRow(authId, user.email);
    } else {
      console.log(`  DB: admin role — no identity row needed`);
    }
  }

  console.log();
}

console.log('Done.');
