import { describe, expect, test } from 'bun:test';
import { BASE_URL } from '../helpers/fetch';

describe('Health API', () => {
  test('returns 200 or 503', async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    expect([200, 503]).toContain(res.status);
  });

  test('returns JSON with status field', async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    const body = await res.json();

    expect(body).toHaveProperty('status');
    expect(['ok', 'degraded']).toContain(body.status);
  });

  test('returns checks object', async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    const body = await res.json();

    expect(body).toHaveProperty('checks');
    expect(body.checks).toHaveProperty('publicEnv');
    expect(body.checks).toHaveProperty('serverEnv');
    expect(body.checks).toHaveProperty('database');
  });
});
