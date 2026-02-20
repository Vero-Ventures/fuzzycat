import { eq } from 'drizzle-orm';
import { stripe } from '@/lib/stripe';
import { db } from '@/server/db';
import { owners } from '@/server/db/schema';

/**
 * Get or create a Stripe Customer for a pet owner.
 * Checks the owners table first; creates via Stripe API if none exists.
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

  await db
    .update(owners)
    .set({ stripeCustomerId: customer.id })
    .where(eq(owners.id, params.ownerId));

  return customer.id;
}
