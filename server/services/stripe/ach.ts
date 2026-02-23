import { eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { stripe } from '@/lib/stripe';
import { db } from '@/server/db';
import { payments } from '@/server/db/schema';
import { logAuditEvent } from '@/server/services/audit';

/**
 * Create a Stripe PaymentIntent for an ACH installment payment.
 * If a paymentMethodId is provided, the intent is confirmed immediately.
 * Otherwise, a client secret is returned for frontend confirmation.
 */
export async function createInstallmentPaymentIntent(params: {
  paymentId: string;
  planId: string;
  stripeCustomerId: string;
  amountCents: number;
  paymentMethodId?: string;
  paymentMethodType?: 'card' | 'us_bank_account';
}): Promise<{ paymentIntentId: string; clientSecret: string; status: string }> {
  const methodType = params.paymentMethodType ?? 'us_bank_account';

  const paymentIntent = await stripe().paymentIntents.create({
    amount: params.amountCents,
    currency: 'usd',
    customer: params.stripeCustomerId,
    payment_method_types: [methodType],
    ...(params.paymentMethodId && {
      payment_method: params.paymentMethodId,
      confirm: true,
      ...(methodType === 'card' && { off_session: true }),
    }),
    metadata: {
      paymentId: params.paymentId,
      planId: params.planId,
    },
  });

  try {
    await db
      .update(payments)
      .set({
        status: 'processing',
        stripePaymentIntentId: paymentIntent.id,
      })
      .where(eq(payments.id, params.paymentId));

    await logAuditEvent({
      entityType: 'payment',
      entityId: params.paymentId,
      action: 'status_changed',
      oldValue: { status: 'pending' },
      newValue: { status: 'processing' },
      actorType: 'system',
    });
  } catch (dbError) {
    logger.error('DB update failed after Stripe PaymentIntent created', {
      paymentId: params.paymentId,
      stripePaymentIntentId: paymentIntent.id,
      error: dbError instanceof Error ? dbError.message : String(dbError),
    });
    throw dbError;
  }

  return {
    paymentIntentId: paymentIntent.id,
    clientSecret: paymentIntent.client_secret ?? '',
    status: paymentIntent.status,
  };
}
