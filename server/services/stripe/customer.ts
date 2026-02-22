import { and, eq, isNull } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { stripe } from '@/lib/stripe';
import { db } from '@/server/db';
import { owners } from '@/server/db/schema';

/**
 * Get or create a Stripe Customer for a pet owner.
 * Checks the owners table first; creates via Stripe API if none exists.
 *
 * Uses a conditional update (SET WHERE stripeCustomerId IS NULL) to prevent
 * concurrent calls from creating orphaned Stripe customers.
 */
export async function getOrCreateCustomer(params: {
  ownerId: string;
  email: string;
  name: string;
}): Promise<string> {
  const [owner] = await db
    .select({ stripeCustomerId: owners.stripeCustomerId })
    .from(owners)
    .where(eq(owners.id, params.ownerId))
    .limit(1);

  if (owner?.stripeCustomerId) {
    return owner.stripeCustomerId;
  }

  const customer = await stripe().customers.create({
    email: params.email,
    name: params.name,
    metadata: { ownerId: params.ownerId },
  });

  // Conditional update: only set if still NULL (prevents race condition)
  const updated = await db
    .update(owners)
    .set({ stripeCustomerId: customer.id })
    .where(and(eq(owners.id, params.ownerId), isNull(owners.stripeCustomerId)))
    .returning({ stripeCustomerId: owners.stripeCustomerId });

  if (updated.length === 0) {
    // Another concurrent call won the race — re-read the winner's customer ID
    logger.warn('Concurrent Stripe customer creation detected, using existing', {
      ownerId: params.ownerId,
      orphanedCustomerId: customer.id,
    });
    const [current] = await db
      .select({ stripeCustomerId: owners.stripeCustomerId })
      .from(owners)
      .where(eq(owners.id, params.ownerId))
      .limit(1);
    return current?.stripeCustomerId ?? customer.id;
  }

  return customer.id;
}
