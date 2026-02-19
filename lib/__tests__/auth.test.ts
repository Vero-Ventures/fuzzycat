import { describe, expect, it } from 'bun:test';
import type { User } from '@supabase/supabase-js';
import { getUserRole, ROLE_HOME, SAFE_REDIRECT_PREFIXES } from '@/lib/auth';

function makeUser(role?: string): User {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    aud: 'authenticated',
    created_at: '2024-01-01T00:00:00Z',
    app_metadata: role !== undefined ? { role } : {},
    user_metadata: {},
  } as User;
}

describe('getUserRole', () => {
  it('returns "owner" for a user with role "owner"', () => {
    expect(getUserRole(makeUser('owner'))).toBe('owner');
  });

  it('returns "clinic" for a user with role "clinic"', () => {
    expect(getUserRole(makeUser('clinic'))).toBe('clinic');
  });

  it('returns "admin" for a user with role "admin"', () => {
    expect(getUserRole(makeUser('admin'))).toBe('admin');
  });

  it('defaults to "owner" when no role is set', () => {
    expect(getUserRole(makeUser())).toBe('owner');
  });

  it('defaults to "owner" for an unknown role string', () => {
    expect(getUserRole(makeUser('superadmin'))).toBe('owner');
  });

  it('defaults to "owner" when role is not a string', () => {
    const user = makeUser();
    user.app_metadata = { role: 123 };
    expect(getUserRole(user)).toBe('owner');
  });

  it('defaults to "owner" when app_metadata is empty', () => {
    const user = makeUser();
    user.app_metadata = {};
    expect(getUserRole(user)).toBe('owner');
  });
});

describe('ROLE_HOME', () => {
  it('maps all three roles to dashboard paths', () => {
    expect(ROLE_HOME.owner).toBe('/owner/payments');
    expect(ROLE_HOME.clinic).toBe('/clinic/dashboard');
    expect(ROLE_HOME.admin).toBe('/admin/dashboard');
  });
});

describe('SAFE_REDIRECT_PREFIXES', () => {
  it('includes the four expected prefixes', () => {
    expect(SAFE_REDIRECT_PREFIXES).toContain('/clinic');
    expect(SAFE_REDIRECT_PREFIXES).toContain('/owner');
    expect(SAFE_REDIRECT_PREFIXES).toContain('/admin');
    expect(SAFE_REDIRECT_PREFIXES).toContain('/mfa');
  });
});
