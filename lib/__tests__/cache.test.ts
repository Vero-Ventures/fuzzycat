import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

// ── Mocks ────────────────────────────────────────────────────────────

const mockUnstableCache = mock();
const mockNextRevalidateTag = mock();

mock.module('next/cache', () => ({
  unstable_cache: mockUnstableCache,
  revalidateTag: mockNextRevalidateTag,
}));

// Import after mocking
const { cachedQuery, revalidateTag } = await import('@/lib/cache');

// ── Tests ────────────────────────────────────────────────────────────

describe('cachedQuery', () => {
  beforeEach(() => {
    mockUnstableCache.mockClear();
    mockNextRevalidateTag.mockClear();
  });

  afterEach(() => {
    mockUnstableCache.mockClear();
    mockNextRevalidateTag.mockClear();
  });

  it('wraps a function with unstable_cache and calls it immediately', async () => {
    const mockData = { id: 'clinic-1', name: 'Happy Paws' };
    const mockFn = mock(() => Promise.resolve(mockData));
    const cachedFn = mock(() => Promise.resolve(mockData));

    mockUnstableCache.mockReturnValue(cachedFn);

    const result = await cachedQuery(mockFn, ['clinic-profile', 'clinic-1'], {
      revalidate: 300,
      tags: ['clinic:clinic-1:profile'],
    });

    expect(result).toEqual(mockData);
    expect(mockUnstableCache).toHaveBeenCalledTimes(1);
    expect(mockUnstableCache).toHaveBeenCalledWith(mockFn, ['clinic-profile', 'clinic-1'], {
      revalidate: 300,
      tags: ['clinic:clinic-1:profile'],
    });
    expect(cachedFn).toHaveBeenCalledTimes(1);
  });

  it('passes key parts including entity IDs for scoped caching', async () => {
    const mockFn = mock(() => Promise.resolve({ id: 'owner-42' }));
    const cachedFn = mock(() => Promise.resolve({ id: 'owner-42' }));
    mockUnstableCache.mockReturnValue(cachedFn);

    await cachedQuery(mockFn, ['owner-profile', 'owner-42'], {
      revalidate: 300,
      tags: ['owner:owner-42:profile'],
    });

    const keyParts = mockUnstableCache.mock.calls[0][1] as string[];
    expect(keyParts).toContain('owner-42');
    expect(keyParts).toContain('owner-profile');
  });

  it('passes cache options including TTL and tags', async () => {
    const mockFn = mock(() => Promise.resolve([]));
    const cachedFn = mock(() => Promise.resolve([]));
    mockUnstableCache.mockReturnValue(cachedFn);

    await cachedQuery(mockFn, ['admin-clinics'], {
      revalidate: 120,
      tags: ['admin:clinics'],
    });

    const options = mockUnstableCache.mock.calls[0][2] as {
      revalidate?: number;
      tags?: string[];
    };
    expect(options.revalidate).toBe(120);
    expect(options.tags).toEqual(['admin:clinics']);
  });

  it('falls back to direct call when unstable_cache throws', async () => {
    const mockData = { id: 'fallback-1', name: 'Fallback Clinic' };
    const mockFn = mock(() => Promise.resolve(mockData));

    // Simulate Next.js runtime missing (throws invariant error)
    mockUnstableCache.mockImplementation(() => {
      throw new Error('Invariant: incrementalCache missing');
    });

    const result = await cachedQuery(mockFn, ['clinic-profile', 'clinic-1'], {
      revalidate: 300,
      tags: ['clinic:clinic-1:profile'],
    });

    expect(result).toEqual(mockData);
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('propagates errors from the underlying function', async () => {
    const error = new Error('Database connection failed');
    const cachedFn = mock(() => Promise.reject(error));
    mockUnstableCache.mockReturnValue(cachedFn);

    await expect(
      cachedQuery(() => Promise.reject(error), ['test'], { revalidate: 60 }),
    ).rejects.toThrow('Database connection failed');
  });

  it('supports composite key parts for parameterized queries', async () => {
    const mockFn = mock(() => Promise.resolve({ clinics: [] }));
    const cachedFn = mock(() => Promise.resolve({ clinics: [] }));
    mockUnstableCache.mockReturnValue(cachedFn);

    await cachedQuery(mockFn, ['admin-clinics', 'active', '', '20', '0'], {
      revalidate: 120,
      tags: ['admin:clinics'],
    });

    const keyParts = mockUnstableCache.mock.calls[0][1] as string[];
    expect(keyParts).toEqual(['admin-clinics', 'active', '', '20', '0']);
  });
});

describe('revalidateTag', () => {
  beforeEach(() => {
    mockNextRevalidateTag.mockClear();
  });

  it('calls next/cache revalidateTag with default profile', () => {
    revalidateTag('clinic:123:profile');
    expect(mockNextRevalidateTag).toHaveBeenCalledWith('clinic:123:profile', 'default');
  });

  it('can invalidate multiple tags', () => {
    revalidateTag('clinic:abc:profile');
    revalidateTag('admin:clinics');

    expect(mockNextRevalidateTag).toHaveBeenCalledTimes(2);
    expect(mockNextRevalidateTag).toHaveBeenCalledWith('clinic:abc:profile', 'default');
    expect(mockNextRevalidateTag).toHaveBeenCalledWith('admin:clinics', 'default');
  });

  it('silently skips when revalidateTag throws (non-Next.js runtime)', () => {
    mockNextRevalidateTag.mockImplementation(() => {
      throw new Error('Invariant: static generation store missing');
    });

    // Should not throw
    expect(() => revalidateTag('test:tag')).not.toThrow();
  });
});
