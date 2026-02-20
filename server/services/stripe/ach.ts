import { eq } from 'drizzle-orm';
import { stripe } from '@/lib/stripe';
import { db } from '@/server/db';
import { auditLog, payments } from '@/server/db/schema';

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
}): Promise<{ paymentIntentId: string; clientSecret: string; status: string }> {
  const paymentIntent = await stripe().paymentIntents.create({
    amount: params.amountCents,
    currency: 'usd',
    customer: params.stripeCustomerId,
    payment_method_types: ['us_bank_account'],
    ...(params.paymentMethodId && {
      payment_method: params.paymentMethodId,
      confirm: true,
    }),
    metadata: {
      paymentId: params.paymentId,
      planId: params.planId,
    },
  });

  await db
    .update(payments)
    .set({
      status: 'processing',
      stripePaymentIntentId: paymentIntent.id,
      updatedAt: new Date(),
    })
    .where(eq(payments.id, params.paymentId));

  await db.insert(auditLog).values({
    entityType: 'payment',
    entityId: params.paymentId,
    action: 'status_changed',
    oldValue: JSON.stringify({ status: 'pending' }),
    newValue: JSON.stringify({ status: 'processing' }),
    actorType: 'system',
  });

  return {
    paymentIntentId: paymentIntent.id,
    clientSecret: paymentIntent.client_secret ?? '',
    status: paymentIntent.status,
  };
}
