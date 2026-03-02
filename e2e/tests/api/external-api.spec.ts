import { expect, test } from '@playwright/test';

const API_BASE = '/api/v1';

test.describe('External REST API', () => {
  test.describe('Health & OpenAPI', () => {
    test('GET /health returns ok without auth', async ({ request }) => {
      const res = await request.get(`${API_BASE}/health`);
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.status).toBe('ok');
      expect(body.api).toBe('v1');
    });

    test('GET /openapi.json returns valid OpenAPI 3.1 spec', async ({ request }) => {
      const res = await request.get(`${API_BASE}/openapi.json`);
      expect(res.status()).toBe(200);

      const spec = await res.json();
      expect(spec.openapi).toBe('3.1.0');
      expect(spec.info.title).toBe('FuzzyCat API');
      expect(spec.info.version).toBe('1.0.0');
    });

    test('health response includes X-Request-Id header', async ({ request }) => {
      const res = await request.get(`${API_BASE}/health`);
      const requestId = res.headers()['x-request-id'];
      expect(requestId).toBeTruthy();
    });
  });

  test.describe('Authentication', () => {
    test('returns 401 without Authorization header', async ({ request }) => {
      const res = await request.get(`${API_BASE}/enrollments/00000000-0000-0000-0000-000000000000`);
      expect(res.status()).toBe(401);

      const body = await res.json();
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    test('returns 401 with invalid Bearer token', async ({ request }) => {
      const res = await request.get(
        `${API_BASE}/enrollments/00000000-0000-0000-0000-000000000000`,
        {
          headers: { Authorization: 'Bearer invalid_token_here' },
        },
      );
      expect(res.status()).toBe(401);

      const body = await res.json();
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    test('returns 401 with malformed Authorization header', async ({ request }) => {
      const res = await request.get(`${API_BASE}/clinic/profile`, {
        headers: { Authorization: 'Basic dXNlcjpwYXNz' },
      });
      expect(res.status()).toBe(401);
    });
  });

  test.describe('CORS', () => {
    test('includes CORS headers on health response', async ({ request }) => {
      const res = await request.get(`${API_BASE}/health`);
      const headers = res.headers();

      expect(headers['access-control-allow-origin']).toBe('*');
      expect(headers['access-control-expose-headers']).toContain('X-Request-Id');
    });

    test('OPTIONS preflight returns 204', async ({ request }) => {
      const res = await request.fetch(`${API_BASE}/enrollments`, {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://example.com',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Authorization, Content-Type',
        },
      });

      expect(res.status()).toBe(204);
      const headers = res.headers();
      expect(headers['access-control-allow-methods']).toContain('POST');
    });
  });

  test.describe('Error format', () => {
    test('404 returns standardized error format', async ({ request }) => {
      const res = await request.get(`${API_BASE}/nonexistent-endpoint`, {
        headers: { Authorization: 'Bearer fc_live_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1' },
      });

      // Will be 401 (invalid key) or 404
      const body = await res.json();
      expect(body.error).toBeDefined();
      expect(body.error.code).toBeDefined();
      expect(body.error.message).toBeDefined();
    });
  });
});
