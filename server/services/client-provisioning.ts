// ── Client provisioning: post-enrollment account setup ────────────────
// Creates Supabase auth account, Stripe customer, and sends enrollment
// invite email. Runs AFTER the enrollment DB transaction. All operations
// are non-blocking — enrollment is valid even if provisioning fails.

import { eq } from 'drizzle-orm';
import { publicEnv } from '@/lib/env';
import { logger } from '@/lib/logger';
import { createAdminClient } from '@/lib/supabase/admin';
import type { PaymentSchedule } from '@/lib/utils/schedule';
import { db } from '@/server/db';
import { clients } from '@/server/db/schema';
import { sendEnrollmentInvite } from '@/server/services/email';
import { getOrCreateCustomer } from '@/server/services/stripe/customer';

export interface ProvisionParams {
  clientId: string;
  clientEmail: string;
  clientName: string;
  petName: string;
  planId: string;
  clinicName: string;
  schedule: PaymentSchedule;
}

export interface ProvisionResult {
  setupUrl: string | null;
}

/** Create a Supabase auth account for the client if they don't have one. */
async function ensureAuthAccount(clientId: string, clientEmail: string): Promise<boolean> {
  const [existing] = await db
    .select({ authId: clients.authId })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (existing?.authId) return false;

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: clientEmail,
    password: crypto.randomUUID(),
    email_confirm: true,
    app_metadata: { role: 'client' },
  });

  if (error) {
    logger.error('Failed to create Supabase auth account for client', {
      clientId,
      clientEmail,
      error: error.message,
    });
    return false;
  }

  if (data.user) {
    await db.update(clients).set({ authId: data.user.id }).where(eq(clients.id, clientId));
    logger.info('Created Supabase auth account for client', {
      clientId,
      authId: data.user.id,
    });
    return true;
  }

  return false;
}

/** Generate setup URL: recovery link for new users, direct link for existing. */
async function generateSetupUrl(
  isNewAuthUser: boolean,
  clientEmail: string,
  clientId: string,
  appUrl: string,
  depositPath: string,
): Promise<string> {
  const directUrl = `${appUrl}${depositPath}`;

  if (!isNewAuthUser) return directUrl;

  const admin = createAdminClient();
  const redirectTo = `${appUrl}/reset-password?next=${encodeURIComponent(depositPath)}`;
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: clientEmail,
    options: { redirectTo },
  });

  if (error) {
    logger.error('Failed to generate recovery link', { clientId, error: error.message });
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
export async function provisionClientAccount(params: ProvisionParams): Promise<ProvisionResult> {
  const { clientId, clientEmail, clientName, petName, planId, clinicName, schedule } = params;

  const appUrl = publicEnv().NEXT_PUBLIC_APP_URL ?? 'https://www.fuzzycatapp.com';
  const depositPath = `/client/payments/${planId}/deposit`;

  // 1. Create Supabase auth account if needed
  let isNewAuthUser = false;
  try {
    isNewAuthUser = await ensureAuthAccount(clientId, clientEmail);
  } catch (err) {
    logger.error('Unexpected error creating auth account', {
      clientId,
      clientEmail,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // 2. Create Stripe customer if needed
  try {
    await getOrCreateCustomer({ clientId, email: clientEmail, name: clientName });
  } catch (err) {
    logger.error('Failed to create Stripe customer during provisioning', {
      clientId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // 3. Generate setup URL
  let setupUrl: string | null = null;
  try {
    setupUrl = await generateSetupUrl(isNewAuthUser, clientEmail, clientId, appUrl, depositPath);
  } catch (err) {
    logger.error('Unexpected error generating recovery link', {
      clientId,
      error: err instanceof Error ? err.message : String(err),
    });
    setupUrl = `${appUrl}${depositPath}`;
  }

  // 4. Send enrollment invite email
  try {
    await sendEnrollmentInvite(clientEmail, {
      ownerName: clientName,
      petName,
      clinicName,
      totalBillCents: schedule.totalBillCents,
      feeCents: schedule.feeCents,
      depositCents: schedule.depositCents,
      installmentCents: schedule.installmentCents,
      numInstallments: schedule.numInstallments,
      setupUrl: setupUrl ?? `${appUrl}${depositPath}`,
    });

    logger.info('Sent enrollment invite email', { clientId, clientEmail, planId });
  } catch (err) {
    logger.error('Failed to send enrollment invite email', {
      clientId,
      clientEmail,
      planId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return { setupUrl };
}
