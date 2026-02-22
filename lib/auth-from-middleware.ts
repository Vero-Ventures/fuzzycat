import { headers } from 'next/headers';
import type { UserRole } from '@/lib/auth';

const VALID_ROLES = new Set<string>(['owner', 'clinic', 'admin']);

/**
 * Reads auth information injected by middleware via request headers.
 *
 * Middleware calls `getUser()` for auth validation, then sets `x-user-id`
 * and `x-user-role` as internal request headers. This avoids a redundant
 * Supabase `getUser()` call (~100-200ms) in each portal layout.
 *
 * These headers are set via `NextResponse.next({ request: { headers } })`
 * and cannot be spoofed from the client — Next.js overwrites incoming
 * request headers with the ones set in middleware.
 */
export async function getAuthFromMiddleware(): Promise<{
  userId: string;
  role: UserRole;
} | null> {
  const headerStore = await headers();
  const userId = headerStore.get('x-user-id');
  const role = headerStore.get('x-user-role');

  if (!userId || !role || !VALID_ROLES.has(role)) {
    return null;
  }

  return { userId, role: role as UserRole };
}
