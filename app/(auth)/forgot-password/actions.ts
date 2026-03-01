'use server';

import { checkRateLimit } from '@/lib/rate-limit';

/** Check rate limit before password reset attempt. Returns error string if blocked. */
export async function checkResetRateLimit(): Promise<{ error: string | null }> {
  const { success } = await checkRateLimit();
  if (!success) {
    return { error: 'Too many requests. Please try again in a minute.' };
  }
  return { error: null };
}
