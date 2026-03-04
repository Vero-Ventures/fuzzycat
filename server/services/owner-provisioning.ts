// ── Owner provisioning: post-enrollment account setup ─────────────────
// Creates Supabase auth account, Stripe customer, and sends enrollment
// invite email. Runs AFTER the enrollment DB transaction. All operations
// are non-blocking — enrollment is valid even if provisioning fails.

import { eq } from 'drizzle-orm';
import { publicEnv } from '@/lib/env';
import { logger } from '@/lib/logger';
import { createAdminClient } from '@/lib/supabase/admin';
import type { PaymentSchedule } from '@/lib/utils/schedule';
import { db } from '@/server/db';
import { owners } from '@/server/db/schema';
import { sendEnrollmentInvite } from '@/server/services/email';
import { getOrCreateCustomer } from '@/server/services/stripe/customer';

export interface ProvisionParams {
  ownerId: string;
  ownerEmail: string;
  ownerName: string;
  petName: string;
  planId: string;
  clinicName: string;
  schedule: PaymentSchedule;
}

export interface ProvisionResult {
  setupUrl: string | null;
}

/** Create a Supabase auth account for the owner if they don't have one. */
async function ensureAuthAccount(ownerId: string, ownerEmail: string): Promise<boolean> {
  const [owner] = await db
    .select({ authId: owners.authId })
    .from(owners)
    .where(eq(owners.id, ownerId))
    .limit(1);

  if (owner?.authId) return false;

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: ownerEmail,
    password: crypto.randomUUID(),
    email_confirm: true,
    app_metadata: { role: 'owner' },
  });

  if (error) {
    logger.error('Failed to create Supabase auth account for owner', {
      ownerId,
      ownerEmail,
      error: error.message,
    });
    return false;
  }

  if (data.user) {
    await db.update(owners).set({ authId: data.user.id }).where(eq(owners.id, ownerId));
    logger.info('Created Supabase auth account for owner', {
      ownerId,
      authId: data.user.id,
    });
    return true;
  }

  return false;
}

/** Generate setup URL: recovery link for new users, direct link for existing. */
async function generateSetupUrl(
  isNewAuthUser: boolean,
  ownerEmail: string,
  ownerId: string,
  appUrl: string,
  depositPath: string,
): Promise<string> {
  const directUrl = `${appUrl}${depositPath}`;

  if (!isNewAuthUser) return directUrl;

  const admin = createAdminClient();
  const redirectTo = `${appUrl}/reset-password?next=${encodeURIComponent(depositPath)}`;
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: ownerEmail,
    options: { redirectTo },
  });

  if (error) {
    logger.error('Failed to generate recovery link', { ownerId, error: error.message });
    return directUrl;
  }

  return data.properties.action_link;
}

/**
 * Provision an owner account after enrollment creation.
 *
 * 1. Creates a Supabase auth account if the owner doesn't have one
 * 2. Creates a Stripe customer if one doesn't exist
 * 3. Generates a setup URL (recovery link for new users, direct link for existing)
 * 4. Sends an enrollment invite email
 *
 * All steps are best-effort — failures are logged but do not throw.
 * The enrollment is already committed to the database at this point.
 */
export async function provisionOwnerAccount(params: ProvisionParams): Promise<ProvisionResult> {
  const { ownerId, ownerEmail, ownerName, petName, planId, clinicName, schedule } = params;

  const appUrl = publicEnv().NEXT_PUBLIC_APP_URL ?? 'https://www.fuzzycatapp.com';
  const depositPath = `/owner/payments/${planId}/deposit`;

  // 1. Create Supabase auth account if needed
  let isNewAuthUser = false;
  try {
    isNewAuthUser = await ensureAuthAccount(ownerId, ownerEmail);
  } catch (err) {
    logger.error('Unexpected error creating auth account', {
      ownerId,
      ownerEmail,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // 2. Create Stripe customer if needed
  try {
    await getOrCreateCustomer({ ownerId, email: ownerEmail, name: ownerName });
  } catch (err) {
    logger.error('Failed to create Stripe customer during provisioning', {
      ownerId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // 3. Generate setup URL
  let setupUrl: string | null = null;
  try {
    setupUrl = await generateSetupUrl(isNewAuthUser, ownerEmail, ownerId, appUrl, depositPath);
  } catch (err) {
    logger.error('Unexpected error generating recovery link', {
      ownerId,
      error: err instanceof Error ? err.message : String(err),
    });
    setupUrl = `${appUrl}${depositPath}`;
  }

  // 4. Send enrollment invite email
  try {
    await sendEnrollmentInvite(ownerEmail, {
      ownerName,
      petName,
      clinicName,
      totalBillCents: schedule.totalBillCents,
      feeCents: schedule.feeCents,
      depositCents: schedule.depositCents,
      installmentCents: schedule.installmentCents,
      numInstallments: schedule.numInstallments,
      setupUrl: setupUrl ?? `${appUrl}${depositPath}`,
    });

    logger.info('Sent enrollment invite email', { ownerId, ownerEmail, planId });
  } catch (err) {
    logger.error('Failed to send enrollment invite email', {
      ownerId,
      ownerEmail,
      planId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return { setupUrl };
}
