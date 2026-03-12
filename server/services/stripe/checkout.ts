import { eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { stripe } from '@/lib/stripe';
import { db } from '@/server/db';
import { payments } from '@/server/db/schema';
import { logAuditEvent } from '@/server/services/audit';

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
  clinicStripeAccountId: string;
  applicationFeeCents: number;
}): Promise<{ sessionId: string; sessionUrl: string }> {
  const session = await stripe().checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    customer: params.stripeCustomerId,
    payment_intent_data: {
      setup_future_usage: 'off_session',
      application_fee_amount: params.applicationFeeCents,
      transfer_data: {
        destination: params.clinicStripeAccountId,
      },
    },
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

  // If the DB update below fails after the Stripe session was already created,
  // the Stripe session becomes orphaned (exists in Stripe but our DB still shows
  // 'pending'). This is eventually consistent — Stripe webhooks will reconcile
  // the state when the session expires (24h) or is completed by the customer.
  // The webhook handler checks payment status and will process accordingly.
  try {
    await db
      .update(payments)
      .set({
        status: 'processing',
        stripePaymentIntentId: paymentIntentId,
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
    logger.error('DB update failed after Stripe Checkout session created', {
      paymentId: params.paymentId,
      stripeSessionId: session.id,
      error: dbError instanceof Error ? dbError.message : String(dbError),
    });
    throw dbError;
  }

  return {
    sessionId: session.id,
    sessionUrl: session.url ?? '',
  };
}
