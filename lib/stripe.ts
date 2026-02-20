import Stripe from 'stripe';
import { serverEnv } from '@/lib/env';

let _stripe: Stripe | undefined;

/**
 * Lazily initialized Stripe client. Uses the validated STRIPE_SECRET_KEY
 * from server environment variables. Must only be called server-side.
 */
export function stripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(serverEnv().STRIPE_SECRET_KEY, {
      typescript: true,
    });
  }
  return _stripe;
}
