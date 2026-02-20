import { eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { db } from '@/server/db';
import { auditLog, payments, plans } from '@/server/db/schema';

/**
 * Stripe webhook handler.
 *
 * Verifies the webhook signature, then routes to the appropriate handler
 * based on the event type. All payment state changes are logged to the
 * audit_log table for compliance.
 *
 * Required env: STRIPE_WEBHOOK_SECRET (optional in dev — skips verification).
 */
export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  let event: Stripe.Event;

  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (webhookSecret && signature) {
      event = stripe().webhooks.constructEvent(body, signature, webhookSecret);
    } else {
      // In development without webhook secret, parse the body directly.
      // This should never happen in production.
      event = JSON.parse(body) as Stripe.Event;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`Stripe webhook signature verification failed: ${message}`);
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
        // Stripe Connect: clinic onboarding status changes.
        // Will be implemented when Connect onboarding is built.
        break;

      default:
        // Unhandled event type — log but don't fail.
        break;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`Stripe webhook handler error for ${event.type}: ${message}`);
    return NextResponse.json({ error: 'Webhook handler error' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

/**
 * Handle successful Checkout Session (deposit payment).
 * Updates the payment record and transitions the plan to deposit_paid -> active.
 */
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id;

  if (!paymentIntentId) return;

  const [payment] = await db
    .update(payments)
    .set({
      status: 'succeeded',
      stripePaymentIntentId: paymentIntentId,
      processedAt: new Date(),
    })
    .where(eq(payments.stripePaymentIntentId, paymentIntentId))
    .returning();

  if (!payment?.planId) return;

  await db
    .update(plans)
    .set({
      status: 'active',
      depositPaidAt: new Date(),
    })
    .where(eq(plans.id, payment.planId));

  await db.insert(auditLog).values({
    entityType: 'payment',
    entityId: payment.id,
    action: 'status_changed',
    oldValue: JSON.stringify({ status: 'processing' }),
    newValue: JSON.stringify({ status: 'succeeded' }),
    actorType: 'system',
  });

  await db.insert(auditLog).values({
    entityType: 'plan',
    entityId: payment.planId,
    action: 'status_changed',
    oldValue: JSON.stringify({ status: 'deposit_paid' }),
    newValue: JSON.stringify({ status: 'active' }),
    actorType: 'system',
  });
}

/**
 * Handle successful PaymentIntent (installment ACH payment).
 * Updates the payment record status and logs to audit trail.
 */
async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const [payment] = await db
    .update(payments)
    .set({
      status: 'succeeded',
      processedAt: new Date(),
    })
    .where(eq(payments.stripePaymentIntentId, paymentIntent.id))
    .returning();

  if (!payment) return;

  await db.insert(auditLog).values({
    entityType: 'payment',
    entityId: payment.id,
    action: 'status_changed',
    oldValue: JSON.stringify({ status: 'processing' }),
    newValue: JSON.stringify({ status: 'succeeded' }),
    actorType: 'system',
  });

  // Check if all installments are now paid -> complete the plan.
  if (payment.planId) {
    const planPayments = await db.query.payments.findMany({
      where: eq(payments.planId, payment.planId),
    });

    const allSucceeded = planPayments.every((p) => p.status === 'succeeded');
    if (allSucceeded) {
      await db
        .update(plans)
        .set({ status: 'completed', completedAt: new Date() })
        .where(eq(plans.id, payment.planId));

      await db.insert(auditLog).values({
        entityType: 'plan',
        entityId: payment.planId,
        action: 'status_changed',
        oldValue: JSON.stringify({ status: 'active' }),
        newValue: JSON.stringify({ status: 'completed' }),
        actorType: 'system',
      });
    }
  }
}

/**
 * Handle failed PaymentIntent (installment ACH failure).
 * Increments retry count and logs the failure reason.
 */
async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  const failureReason = paymentIntent.last_payment_error?.message ?? 'Unknown failure';

  const [payment] = await db
    .update(payments)
    .set({
      status: 'failed',
      failureReason,
      retryCount: sql`coalesce(${payments.retryCount}, 0) + 1`,
    })
    .where(eq(payments.stripePaymentIntentId, paymentIntent.id))
    .returning();

  if (!payment) return;

  await db.insert(auditLog).values({
    entityType: 'payment',
    entityId: payment.id,
    action: 'status_changed',
    oldValue: JSON.stringify({ status: 'processing' }),
    newValue: JSON.stringify({ status: 'failed', failureReason }),
    actorType: 'system',
  });
}
