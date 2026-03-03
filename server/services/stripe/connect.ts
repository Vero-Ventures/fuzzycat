import { eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { stripe } from '@/lib/stripe';
import { db } from '@/server/db';
import { auditLog, clinics } from '@/server/db/schema';

/**
 * Create a Stripe Connect Standard account for a clinic.
 * Stores the account ID in the clinics table.
 */
export async function createConnectAccount(params: {
  clinicId: string;
  email: string;
  businessName: string;
}): Promise<{ accountId: string }> {
  const account = await stripe().accounts.create({
    type: 'standard',
    email: params.email,
    business_profile: {
      name: params.businessName,
    },
    metadata: { clinicId: params.clinicId },
  });

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(clinics)
        .set({ stripeAccountId: account.id })
        .where(eq(clinics.id, params.clinicId));

      await tx.insert(auditLog).values({
        entityType: 'clinic',
        entityId: params.clinicId,
        action: 'stripe_connect_created',
        newValue: JSON.stringify({ stripeAccountId: account.id }),
        actorType: 'system',
      });
    });
  } catch (dbError) {
    logger.error('DB update failed after Stripe Connect account created', {
      clinicId: params.clinicId,
      stripeAccountId: account.id,
      error: dbError instanceof Error ? dbError.message : String(dbError),
    });
    throw dbError;
  }

  return { accountId: account.id };
}

/**
 * Generate a Stripe Connect onboarding link for a clinic.
 */
export async function createOnboardingLink(params: {
  stripeAccountId: string;
  returnUrl: string;
  refreshUrl: string;
}): Promise<{ url: string }> {
  const accountLink = await stripe().accountLinks.create({
    account: params.stripeAccountId,
    type: 'account_onboarding',
    return_url: params.returnUrl,
    refresh_url: params.refreshUrl,
  });

  return { url: accountLink.url };
}
