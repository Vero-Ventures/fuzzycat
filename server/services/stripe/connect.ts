import { eq } from 'drizzle-orm';
import { CLINIC_SHARE_RATE } from '@/lib/constants';
import { logger } from '@/lib/logger';
import { stripe } from '@/lib/stripe';
import { percentOfCents } from '@/lib/utils/money';
import { db } from '@/server/db';
import { auditLog, clinics, payouts } from '@/server/db/schema';

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

/**
 * Transfer funds to a clinic's Stripe Connect account after a successful payment.
 *
 * The caller (orchestration layer) computes the correct `transferAmountCents`,
 * which is the payment amount minus the FuzzyCat platform fee. The 3% clinic
 * bonus is included in `transferAmountCents` and tracked separately in the
 * payout record as `clinicShareCents` for bookkeeping.
 */
export async function transferToClinic(params: {
  paymentId: string;
  planId: string;
  clinicId: string;
  clinicStripeAccountId: string;
  transferAmountCents: number;
}): Promise<{ transferId: string; payoutRecord: { id: string } }> {
  const transfer = await stripe().transfers.create({
    amount: params.transferAmountCents,
    currency: 'usd',
    destination: params.clinicStripeAccountId,
    metadata: {
      paymentId: params.paymentId,
      planId: params.planId,
      clinicId: params.clinicId,
    },
  });

  const clinicShareCents = percentOfCents(params.transferAmountCents, CLINIC_SHARE_RATE);

  let payoutRecordId: string;

  try {
    payoutRecordId = await db.transaction(async (tx) => {
      const [payoutRecord] = await tx
        .insert(payouts)
        .values({
          clinicId: params.clinicId,
          planId: params.planId,
          paymentId: params.paymentId,
          amountCents: params.transferAmountCents,
          clinicShareCents,
          stripeTransferId: transfer.id,
          status: 'succeeded',
        })
        .returning();

      await tx.insert(auditLog).values({
        entityType: 'payout',
        entityId: payoutRecord.id,
        action: 'created',
        newValue: JSON.stringify({
          amountCents: params.transferAmountCents,
          clinicShareCents,
          stripeTransferId: transfer.id,
        }),
        actorType: 'system',
      });

      return payoutRecord.id;
    });
  } catch (dbError) {
    logger.error('DB insert failed after Stripe transfer succeeded', {
      paymentId: params.paymentId,
      stripeTransferId: transfer.id,
      error: dbError instanceof Error ? dbError.message : String(dbError),
    });
    throw dbError;
  }

  return { transferId: transfer.id, payoutRecord: { id: payoutRecordId } };
}
