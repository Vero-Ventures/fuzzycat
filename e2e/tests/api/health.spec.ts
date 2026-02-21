import { expect, test } from '@playwright/test';

test.describe('Health API', () => {
  test('returns 200 or 503', async ({ request }) => {
    const response = await request.get('/api/health');
    expect([200, 503]).toContain(response.status());
  });

  test('returns JSON with status field', async ({ request }) => {
    const response = await request.get('/api/health');
    const body = await response.json();

    expect(body).toHaveProperty('status');
    expect(['ok', 'degraded']).toContain(body.status);
  });

  test('returns checks object', async ({ request }) => {
    const response = await request.get('/api/health');
    const body = await response.json();

    expect(body).toHaveProperty('checks');
    expect(body.checks).toHaveProperty('publicEnv');
    expect(body.checks).toHaveProperty('serverEnv');
    expect(body.checks).toHaveProperty('database');
  });
});
