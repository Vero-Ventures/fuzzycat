import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { serverEnv } from '@/lib/env';
import { logger } from '@/lib/logger';
import { stripe } from '@/lib/stripe';
import { db } from '@/server/db';
import { clinics } from '@/server/db/schema';
import { logAuditEvent } from '@/server/services/audit';
import {
  findPaymentByStripeId,
  handlePaymentFailure,
  handlePaymentSuccess,
  triggerPayout,
} from '@/server/services/payment';

/**
 * Stripe webhook handler.
 *
 * Verifies the webhook signature using the validated STRIPE_WEBHOOK_SECRET,
 * then routes to the appropriate handler based on the event type.
 * All payment state changes are logged to the audit_log table for compliance.
 *
 * Idempotency: handlers check the current status before updating to avoid
 * duplicate processing from Stripe's at-least-once delivery.
 */
export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  let event: Stripe.Event;

  try {
    const { STRIPE_WEBHOOK_SECRET } = serverEnv();

    if (!signature) {
      logger.error('Stripe webhook signature missing');
      return NextResponse.json({ error: 'Webhook signature missing' }, { status: 400 });
    }

    event = stripe().webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Stripe webhook signature verification failed', { error: message });
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      case 'account.updated':
        await handleAccountUpdated(event.data.object as Stripe.Account);
        break;

      default:
        // Unhandled event type -- log but don't fail.
        break;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Stripe webhook handler error', { eventType: event.type, error: message });
    return NextResponse.json({ error: 'Webhook handler error' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

/**
 * Handle successful Checkout Session (deposit payment).
 * Resolves the Stripe PaymentIntent ID to the internal payment record,
 * then delegates to the canonical handlePaymentSuccess service function
 * which handles status update, audit logging, risk pool contribution,
 * plan activation, and payout initiation.
 */
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id;

  if (!paymentIntentId) return;

  const existingPayment = await findPaymentByStripeId(paymentIntentId);
  if (!existingPayment) return;

  // Idempotency: skip if already processed
  if (existingPayment.status === 'succeeded') return;

  await handlePaymentSuccess(existingPayment.id, paymentIntentId);
  await triggerPayout(existingPayment.id);
}

/**
 * Handle successful PaymentIntent (installment ACH payment).
 * Resolves the Stripe PaymentIntent ID to the internal payment record,
 * then delegates to the canonical handlePaymentSuccess service function
 * which handles status update, audit logging, risk pool contribution,
 * plan completion check, and payout initiation.
 */
async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const existingPayment = await findPaymentByStripeId(paymentIntent.id);
  if (!existingPayment) return;

  // Idempotency: skip if already processed
  if (existingPayment.status === 'succeeded') return;

  await handlePaymentSuccess(existingPayment.id, paymentIntent.id);
  await triggerPayout(existingPayment.id);
}

/**
 * Handle failed PaymentIntent (installment ACH failure).
 * Resolves the Stripe PaymentIntent ID to the internal payment record,
 * then delegates to the canonical handlePaymentFailure service function
 * which handles status update, retry logic, and audit logging.
 */
async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  const failureReason = paymentIntent.last_payment_error?.message ?? 'Unknown failure';

  const existingPayment = await findPaymentByStripeId(paymentIntent.id);
  if (!existingPayment) return;

  await handlePaymentFailure(existingPayment.id, failureReason);
}

/**
 * Handle Stripe Connect account.updated events.
 * When a clinic completes Stripe Connect onboarding (charges_enabled + payouts_enabled),
 * transition the clinic status from 'pending' to 'active'.
 */
async function handleAccountUpdated(account: Stripe.Account) {
  if (!account.id) return;

  const [clinic] = await db
    .select({ id: clinics.id, status: clinics.status })
    .from(clinics)
    .where(eq(clinics.stripeAccountId, account.id))
    .limit(1);

  if (!clinic) return;

  const isFullyOnboarded = account.charges_enabled && account.payouts_enabled;

  if (isFullyOnboarded && clinic.status === 'pending') {
    await db.update(clinics).set({ status: 'active' }).where(eq(clinics.id, clinic.id));

    await logAuditEvent({
      entityType: 'clinic',
      entityId: clinic.id,
      action: 'status_changed',
      oldValue: { status: 'pending' },
      newValue: { status: 'active', chargesEnabled: true, payoutsEnabled: true },
      actorType: 'system',
    });

    logger.info('Clinic activated via Stripe Connect onboarding', {
      clinicId: clinic.id,
      stripeAccountId: account.id,
    });
  }
}
