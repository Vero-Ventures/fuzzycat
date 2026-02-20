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
 * Required env: STRIPE_WEBHOOK_SECRET (required in production, optional in dev).
 */
export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  let event: Stripe.Event;

  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      if (process.env.NODE_ENV === 'production') {
        console.error('STRIPE_WEBHOOK_SECRET is not set in production environment.');
        return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
      }
      // In development without webhook secret, parse the body directly.
      event = JSON.parse(body) as Stripe.Event;
    } else if (signature) {
      event = stripe().webhooks.constructEvent(body, signature, webhookSecret);
    } else {
      console.error('Stripe webhook signature missing.');
      return NextResponse.json({ error: 'Webhook signature missing' }, { status: 400 });
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
 * Fetches current state before updating for accurate audit logs.
 * Updates the payment record and transitions the plan to active.
 */
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id;

  if (!paymentIntentId) return;

  // Fetch current payment state before updating
  const [existingPayment] = await db
    .select({ id: payments.id, status: payments.status, planId: payments.planId })
    .from(payments)
    .where(eq(payments.stripePaymentIntentId, paymentIntentId))
    .limit(1);

  if (!existingPayment) return;

  const oldPaymentStatus = existingPayment.status;

  await db
    .update(payments)
    .set({
      status: 'succeeded',
      stripePaymentIntentId: paymentIntentId,
      processedAt: new Date(),
    })
    .where(eq(payments.stripePaymentIntentId, paymentIntentId));

  await db.insert(auditLog).values({
    entityType: 'payment',
    entityId: existingPayment.id,
    action: 'status_changed',
    oldValue: JSON.stringify({ status: oldPaymentStatus }),
    newValue: JSON.stringify({ status: 'succeeded' }),
    actorType: 'system',
  });

  if (!existingPayment.planId) return;

  // Fetch current plan state before updating
  const [existingPlan] = await db
    .select({ id: plans.id, status: plans.status })
    .from(plans)
    .where(eq(plans.id, existingPayment.planId))
    .limit(1);

  if (!existingPlan) return;

  const oldPlanStatus = existingPlan.status;

  await db
    .update(plans)
    .set({
      status: 'active',
      depositPaidAt: new Date(),
    })
    .where(eq(plans.id, existingPayment.planId));

  await db.insert(auditLog).values({
    entityType: 'plan',
    entityId: existingPayment.planId,
    action: 'status_changed',
    oldValue: JSON.stringify({ status: oldPlanStatus }),
    newValue: JSON.stringify({ status: 'active' }),
    actorType: 'system',
  });
}

/**
 * Handle successful PaymentIntent (installment ACH payment).
 * Fetches current state before updating for accurate audit logs.
 * Uses a transaction for plan completion to prevent race conditions.
 */
async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  // Fetch current payment state before updating
  const [existingPayment] = await db
    .select({
      id: payments.id,
      status: payments.status,
      planId: payments.planId,
    })
    .from(payments)
    .where(eq(payments.stripePaymentIntentId, paymentIntent.id))
    .limit(1);

  if (!existingPayment) return;

  const oldPaymentStatus = existingPayment.status;

  await db
    .update(payments)
    .set({
      status: 'succeeded',
      processedAt: new Date(),
    })
    .where(eq(payments.stripePaymentIntentId, paymentIntent.id));

  await db.insert(auditLog).values({
    entityType: 'payment',
    entityId: existingPayment.id,
    action: 'status_changed',
    oldValue: JSON.stringify({ status: oldPaymentStatus }),
    newValue: JSON.stringify({ status: 'succeeded' }),
    actorType: 'system',
  });

  // Check if all installments are now paid -> complete the plan.
  // Wrapped in a transaction to prevent race conditions from concurrent webhooks.
  if (existingPayment.planId) {
    await db.transaction(async (tx) => {
      const planPayments = await tx.query.payments.findMany({
        where: eq(payments.planId, existingPayment.planId ?? ''),
      });

      const allSucceeded = planPayments.every((p) => p.status === 'succeeded');
      if (!allSucceeded) return;

      const [currentPlan] = await tx
        .select({ id: plans.id, status: plans.status })
        .from(plans)
        .where(eq(plans.id, existingPayment.planId ?? ''));

      if (!currentPlan || currentPlan.status === 'completed') return;

      await tx
        .update(plans)
        .set({ status: 'completed', completedAt: new Date() })
        .where(eq(plans.id, existingPayment.planId ?? ''));

      await tx.insert(auditLog).values({
        entityType: 'plan',
        entityId: existingPayment.planId ?? '',
        action: 'status_changed',
        oldValue: JSON.stringify({ status: currentPlan.status }),
        newValue: JSON.stringify({ status: 'completed' }),
        actorType: 'system',
      });
    });
  }
}

/**
 * Handle failed PaymentIntent (installment ACH failure).
 * Fetches current state before updating for accurate audit logs.
 * Increments retry count and logs the failure reason.
 */
async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  const failureReason = paymentIntent.last_payment_error?.message ?? 'Unknown failure';

  // Fetch current payment state before updating
  const [existingPayment] = await db
    .select({ id: payments.id, status: payments.status })
    .from(payments)
    .where(eq(payments.stripePaymentIntentId, paymentIntent.id))
    .limit(1);

  if (!existingPayment) return;

  const oldPaymentStatus = existingPayment.status;

  await db
    .update(payments)
    .set({
      status: 'failed',
      failureReason,
      retryCount: sql`coalesce(${payments.retryCount}, 0) + 1`,
    })
    .where(eq(payments.stripePaymentIntentId, paymentIntent.id));

  await db.insert(auditLog).values({
    entityType: 'payment',
    entityId: existingPayment.id,
    action: 'status_changed',
    oldValue: JSON.stringify({ status: oldPaymentStatus }),
    newValue: JSON.stringify({ status: 'failed', failureReason }),
    actorType: 'system',
  });
}
