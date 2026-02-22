import type { User } from '@supabase/supabase-js';

export type UserRole = 'owner' | 'clinic' | 'admin';

export const VALID_ROLES: ReadonlySet<string> = new Set<UserRole>(['owner', 'clinic', 'admin']);

/**
 * Extracts and validates the user role from Supabase app_metadata.
 * Returns 'owner' as the default if no role is set or the role is invalid.
 */
export function getUserRole(user: User): UserRole {
  const raw = user.app_metadata?.role;
  if (typeof raw === 'string' && VALID_ROLES.has(raw)) {
    return raw as UserRole;
  }
  return 'owner';
}

/** Maps each role to its default authenticated landing page. */
export const ROLE_HOME: Readonly<Record<UserRole, string>> = {
  clinic: '/clinic/dashboard',
  admin: '/admin/dashboard',
  owner: '/owner/payments',
};

/** Maps each role to its allowed route prefixes. */
export const ROLE_PREFIXES: Readonly<Record<UserRole, readonly string[]>> = {
  clinic: ['/clinic'],
  admin: ['/admin'],
  owner: ['/owner'],
};

/** Allowed path prefixes for post-auth redirects. */
export const SAFE_REDIRECT_PREFIXES = ['/clinic', '/owner', '/admin', '/mfa'] as const;
