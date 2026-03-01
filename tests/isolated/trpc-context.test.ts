import { beforeEach, describe, expect, it, mock } from 'bun:test';

// ── Mocks ────────────────────────────────────────────────────────────
// Only mock modules that won't affect other test files.
// Do NOT mock @/lib/supabase/mfa or @/lib/env — use process.env instead
// to avoid cross-contamination (see CLAUDE.md Testing Requirements).

const mockGetUser = mock();

mock.module('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: mockGetUser },
  }),
}));

mock.module('@/server/db', () => ({
  db: {},
}));

mock.module('@/server/db/schema', () => ({
  clinics: { id: 'clinics.id', authId: 'clinics.auth_id' },
  owners: { id: 'owners.id', authId: 'owners.auth_id' },
  pets: { id: 'pets.id', ownerId: 'pets.owner_id' },
  petsRelations: {},
}));

import { createTRPCContext } from '@/server/trpc';

function makeRequest(headers: Record<string, string> = {}): Request {
  const h = new Headers(headers);
  return new Request('http://localhost:3000/api/trpc', { headers: h });
}

describe('createTRPCContext', () => {
  beforeEach(() => {
    mockGetUser.mockReset();
  });

  it('uses middleware headers when x-user-id and x-user-role are present', async () => {
    const ctx = await createTRPCContext({
      req: makeRequest({
        'x-user-id': 'user-123',
        'x-user-role': 'clinic',
        'x-request-id': 'req-abc',
      }),
      resHeaders: new Headers(),
    });

    expect(ctx.session).toEqual({ userId: 'user-123', role: 'clinic' });
    expect(ctx.requestId).toBe('req-abc');
    // getUser should NOT have been called
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it('falls back to getUser when middleware headers are missing', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: {
        user: {
          id: 'supabase-user-456',
          app_metadata: { role: 'owner' },
        },
      },
    });

    const ctx = await createTRPCContext({
      req: makeRequest({}),
      resHeaders: new Headers(),
    });

    expect(ctx.session).toEqual({ userId: 'supabase-user-456', role: 'owner' });
    expect(mockGetUser).toHaveBeenCalledTimes(1);
  });

  it('falls back to getUser when x-user-role is invalid', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: {
        user: {
          id: 'supabase-user-789',
          app_metadata: { role: 'admin' },
        },
      },
    });

    const ctx = await createTRPCContext({
      req: makeRequest({
        'x-user-id': 'user-789',
        'x-user-role': 'superadmin', // invalid role
      }),
      resHeaders: new Headers(),
    });

    expect(ctx.session).toEqual({ userId: 'supabase-user-789', role: 'admin' });
    expect(mockGetUser).toHaveBeenCalledTimes(1);
  });

  it('returns null session when no auth is available', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
    });

    const ctx = await createTRPCContext({
      req: makeRequest({}),
      resHeaders: new Headers(),
    });

    expect(ctx.session).toBeNull();
  });

  it('accepts all valid roles from middleware headers', async () => {
    for (const role of ['owner', 'clinic', 'admin'] as const) {
      const ctx = await createTRPCContext({
        req: makeRequest({
          'x-user-id': `user-${role}`,
          'x-user-role': role,
        }),
        resHeaders: new Headers(),
      });

      expect(ctx.session).toEqual({ userId: `user-${role}`, role });
    }

    expect(mockGetUser).not.toHaveBeenCalled();
  });
});
