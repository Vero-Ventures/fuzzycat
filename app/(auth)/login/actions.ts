'use server';

import { checkRateLimit } from '@/lib/rate-limit';

/** Check rate limit before login attempt. Returns error string if blocked. */
export async function checkLoginRateLimit(): Promise<{ error: string | null }> {
  const { success } = await checkRateLimit();
  if (!success) {
    return { error: 'Too many login attempts. Please try again in a minute.' };
  }
  return { error: null };
}
