import { afterEach, describe, expect, it, mock } from 'bun:test';

// Mock next/headers — must be set up before importing the module under test
let mockHeaders = new Map<string, string>();

mock.module('next/headers', () => ({
  headers: async () => ({
    get: (name: string) => mockHeaders.get(name) ?? null,
  }),
}));

const { getAuthFromMiddleware } = await import('@/lib/auth-from-middleware');

afterEach(() => {
  mockHeaders = new Map();
});

describe('getAuthFromMiddleware', () => {
  it('returns userId and role when valid headers are present', async () => {
    mockHeaders.set('x-user-id', 'user-123');
    mockHeaders.set('x-user-role', 'owner');

    const result = await getAuthFromMiddleware();
    expect(result).toEqual({ userId: 'user-123', role: 'owner' });
  });

  it('returns correct role for clinic', async () => {
    mockHeaders.set('x-user-id', 'user-456');
    mockHeaders.set('x-user-role', 'clinic');

    const result = await getAuthFromMiddleware();
    expect(result).toEqual({ userId: 'user-456', role: 'clinic' });
  });

  it('returns correct role for admin', async () => {
    mockHeaders.set('x-user-id', 'user-789');
    mockHeaders.set('x-user-role', 'admin');

    const result = await getAuthFromMiddleware();
    expect(result).toEqual({ userId: 'user-789', role: 'admin' });
  });

  it('returns null when x-user-id is missing', async () => {
    mockHeaders.set('x-user-role', 'owner');

    const result = await getAuthFromMiddleware();
    expect(result).toBeNull();
  });

  it('returns null when x-user-role is missing', async () => {
    mockHeaders.set('x-user-id', 'user-123');

    const result = await getAuthFromMiddleware();
    expect(result).toBeNull();
  });

  it('returns null when both headers are missing', async () => {
    const result = await getAuthFromMiddleware();
    expect(result).toBeNull();
  });

  it('returns null for an invalid role', async () => {
    mockHeaders.set('x-user-id', 'user-123');
    mockHeaders.set('x-user-role', 'superadmin');

    const result = await getAuthFromMiddleware();
    expect(result).toBeNull();
  });
});
