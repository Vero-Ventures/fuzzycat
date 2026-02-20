import { eq } from 'drizzle-orm';
import { stripe } from '@/lib/stripe';
import { db } from '@/server/db';
import { auditLog, payments } from '@/server/db/schema';

/**
 * Create a Stripe Checkout session for the deposit payment (debit card).
 * Updates the payment record to `processing` and logs an audit entry.
 */
export async function createDepositCheckoutSession(params: {
  paymentId: string;
  planId: string;
  stripeCustomerId: string;
  depositCents: number;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ sessionId: string; sessionUrl: string }> {
  const session = await stripe().checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    customer: params.stripeCustomerId,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'FuzzyCat Payment Plan — Deposit',
          },
          unit_amount: params.depositCents,
        },
        quantity: 1,
      },
    ],
    metadata: {
      paymentId: params.paymentId,
      planId: params.planId,
    },
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  });

  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  await db
    .update(payments)
    .set({
      status: 'processing',
      stripePaymentIntentId: paymentIntentId,
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
    sessionId: session.id,
    sessionUrl: session.url ?? '',
  };
}
