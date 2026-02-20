import { eq } from 'drizzle-orm';
import { CLINIC_SHARE_RATE } from '@/lib/constants';
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

  await db
    .update(clinics)
    .set({ stripeAccountId: account.id })
    .where(eq(clinics.id, params.clinicId));

  await db.insert(auditLog).values({
    entityType: 'clinic',
    entityId: params.clinicId,
    action: 'stripe_connect_created',
    newValue: JSON.stringify({ stripeAccountId: account.id }),
    actorType: 'system',
  });

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
 * Creates a payout record with the clinic's 3% share calculation.
 */
export async function transferToClinic(params: {
  paymentId: string;
  planId: string;
  clinicId: string;
  clinicStripeAccountId: string;
  amountCents: number;
}): Promise<{ transferId: string; payoutRecord: { id: string } }> {
  const transfer = await stripe().transfers.create({
    amount: params.amountCents,
    currency: 'usd',
    destination: params.clinicStripeAccountId,
    metadata: {
      paymentId: params.paymentId,
      planId: params.planId,
      clinicId: params.clinicId,
    },
  });

  const clinicShareCents = percentOfCents(params.amountCents, CLINIC_SHARE_RATE);

  const [payoutRecord] = await db
    .insert(payouts)
    .values({
      clinicId: params.clinicId,
      planId: params.planId,
      paymentId: params.paymentId,
      amountCents: params.amountCents,
      clinicShareCents,
      stripeTransferId: transfer.id,
      status: 'succeeded',
    })
    .returning();

  await db.insert(auditLog).values({
    entityType: 'payout',
    entityId: payoutRecord.id,
    action: 'created',
    newValue: JSON.stringify({
      amountCents: params.amountCents,
      clinicShareCents,
      stripeTransferId: transfer.id,
    }),
    actorType: 'system',
  });

  return { transferId: transfer.id, payoutRecord: { id: payoutRecord.id } };
}
