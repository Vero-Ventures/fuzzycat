import type { User } from '@supabase/supabase-js';

export type UserRole = 'client' | 'clinic' | 'admin';

export const VALID_ROLES: ReadonlySet<string> = new Set<UserRole>(['client', 'clinic', 'admin']);

/**
 * Extracts and validates the user role from Supabase app_metadata.
 * Returns 'client' as the default if no role is set or the role is invalid.
 * Also accepts legacy 'owner' value and maps it to 'client'.
 */
export function getUserRole(user: User): UserRole {
  const raw = user.app_metadata?.role;
  if (raw === 'owner') return 'client';
  if (typeof raw === 'string' && VALID_ROLES.has(raw)) {
    return raw as UserRole;
  }
  return 'client';
}

/** Maps each role to its default authenticated landing page. */
export const ROLE_HOME: Readonly<Record<UserRole, string>> = {
  clinic: '/clinic/dashboard',
  admin: '/admin/dashboard',
  client: '/client/payments',
};

/** Maps each role to its allowed route prefixes. */
export const ROLE_PREFIXES: Readonly<Record<UserRole, readonly string[]>> = {
  clinic: ['/clinic'],
  admin: ['/admin'],
  client: ['/client'],
};

/** Allowed path prefixes for post-auth redirects. */
export const SAFE_REDIRECT_PREFIXES = ['/clinic', '/client', '/admin', '/mfa'] as const;

/**
 * Maps an auth role to the corresponding audit log actor type.
 */
export function roleToActorType(role: UserRole): 'client' | 'clinic' | 'admin' {
  return role;
}
