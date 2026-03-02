/**
 * k6 security-focused tests for the FuzzyCat External REST API.
 *
 * Validates auth enforcement, input boundaries, and error handling
 * across all endpoints. Does NOT require a valid API key.
 *
 * Usage:
 *   k6 run scripts/k6/api-security-test.js
 *   k6 run scripts/k6/api-security-test.js --env BASE_URL=https://www.fuzzycatapp.com/api/v1
 */

import { check, group, sleep } from 'k6';
import http from 'k6/http';
import { Rate } from 'k6/metrics';

const securityIssues = new Rate('security_issues');

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000/api/v1';

export const options = {
  scenarios: {
    security: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '2m',
    },
  },
  thresholds: {
    security_issues: ['rate==0'], // Zero security issues allowed
  },
};

export default function () {
  group('Auth enforcement — all protected endpoints reject without key', () => {
    const protectedEndpoints = [
      { method: 'GET', path: '/clinic/profile' },
      { method: 'PATCH', path: '/clinic/profile' },
      { method: 'GET', path: '/clinic/stats' },
      { method: 'GET', path: '/clinic/stats/clients' },
      { method: 'GET', path: '/clinic/stats/defaults' },
      { method: 'GET', path: '/clinic/stats/trends' },
      { method: 'GET', path: '/clinic/clients' },
      { method: 'GET', path: '/clinic/revenue' },
      {
        method: 'GET',
        path: '/clinic/revenue/report?dateFrom=2026-01-01T00:00:00Z&dateTo=2026-12-31T23:59:59Z',
      },
      { method: 'GET', path: '/clinic/export/clients' },
      {
        method: 'GET',
        path: '/clinic/export/revenue?dateFrom=2026-01-01T00:00:00Z&dateTo=2026-12-31T23:59:59Z',
      },
      { method: 'GET', path: '/clinic/export/payouts' },
      { method: 'GET', path: '/payouts' },
      { method: 'GET', path: '/payouts/earnings' },
      { method: 'POST', path: '/enrollments' },
      { method: 'GET', path: '/enrollments/00000000-0000-0000-0000-000000000000' },
      { method: 'POST', path: '/enrollments/00000000-0000-0000-0000-000000000000/cancel' },
    ];

    for (const ep of protectedEndpoints) {
      const url = `${BASE_URL}${ep.path}`;
      let res;

      if (ep.method === 'GET') {
        res = http.get(url);
      } else if (ep.method === 'POST') {
        res = http.post(url, '{}', { headers: { 'Content-Type': 'application/json' } });
      } else if (ep.method === 'PATCH') {
        res = http.patch(url, '{}', { headers: { 'Content-Type': 'application/json' } });
      }

      const passed = check(res, {
        [`${ep.method} ${ep.path} returns 401`]: (r) => r.status === 401,
      });

      if (!passed) {
        securityIssues.add(1);
        console.error(
          `SECURITY: ${ep.method} ${ep.path} returned ${res.status} without auth (expected 401)`,
        );
      } else {
        securityIssues.add(0);
      }
    }
  });

  sleep(0.5);

  group('Auth enforcement — invalid tokens rejected', () => {
    const invalidTokens = [
      'not-a-real-key',
      'fc_live_',
      'fc_live_tooshort',
      `fc_live_${'a'.repeat(32)}`, // Valid format but non-existent
      `Bearer fc_live_${'b'.repeat(32)}`, // Double Bearer prefix
      '', // Empty
      'null',
      'undefined',
    ];

    for (const token of invalidTokens) {
      const res = http.get(`${BASE_URL}/clinic/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const passed = check(res, {
        [`invalid token "${token.substring(0, 20)}..." returns 401`]: (r) => r.status === 401,
      });

      if (!passed) {
        securityIssues.add(1);
        console.error(`SECURITY: Invalid token accepted: "${token.substring(0, 20)}..."`);
      } else {
        securityIssues.add(0);
      }
    }
  });

  sleep(0.5);

  group('Public endpoints accessible without auth', () => {
    const publicEndpoints = [
      { path: '/health', check: (body) => body.status === 'ok' },
      { path: '/openapi.json', check: (body) => body.openapi === '3.1.0' },
    ];

    for (const ep of publicEndpoints) {
      const res = http.get(`${BASE_URL}${ep.path}`);

      const passed = check(res, {
        [`${ep.path} accessible without auth`]: (r) => r.status === 200,
        [`${ep.path} returns valid data`]: (r) => {
          try {
            return ep.check(JSON.parse(r.body));
          } catch {
            return false;
          }
        },
      });

      if (!passed) {
        securityIssues.add(1);
      } else {
        securityIssues.add(0);
      }
    }
  });

  sleep(0.5);

  group('Error format consistency', () => {
    // All error responses should follow { error: { code, message } }
    const errorEndpoints = [
      { method: 'GET', path: '/clinic/profile', expectedStatus: 401 },
      { method: 'GET', path: '/nonexistent', expectedStatus: 404 },
    ];

    for (const ep of errorEndpoints) {
      const res = http.get(`${BASE_URL}${ep.path}`);

      check(res, {
        [`${ep.path} error has code field`]: (r) => {
          try {
            const body = JSON.parse(r.body);
            return typeof body.error?.code === 'string';
          } catch {
            return false;
          }
        },
        [`${ep.path} error has message field`]: (r) => {
          try {
            const body = JSON.parse(r.body);
            return typeof body.error?.message === 'string';
          } catch {
            return false;
          }
        },
      });
    }
  });

  sleep(0.5);

  group('Security headers present', () => {
    const res = http.get(`${BASE_URL}/health`);

    check(res, {
      'has X-Request-Id header': (r) => !!r.headers['X-Request-Id'],
      'X-Request-Id is UUID format': (r) => {
        const id = r.headers['X-Request-Id'];
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      },
      'has CORS header': (r) => !!r.headers['Access-Control-Allow-Origin'],
    });
  });

  sleep(0.5);

  group('Input validation — malicious payloads rejected', () => {
    const maliciousPayloads = [
      {
        name: 'SQL injection in query param',
        method: 'GET',
        path: "/clinic/clients?search=' OR 1=1 --",
        minStatus: 400,
        maxStatus: 401,
      },
      {
        name: 'XSS in query param',
        method: 'GET',
        path: '/clinic/clients?search=<script>alert(1)</script>',
        minStatus: 400,
        maxStatus: 401,
      },
      {
        name: 'Path traversal in UUID param',
        method: 'GET',
        path: '/enrollments/../../../etc/passwd',
        minStatus: 400,
        maxStatus: 422,
      },
      {
        name: 'Oversized body',
        method: 'POST',
        path: '/enrollments',
        body: JSON.stringify({ ownerData: { name: 'A'.repeat(100000) } }),
        minStatus: 400,
        maxStatus: 422,
      },
    ];

    for (const payload of maliciousPayloads) {
      let res;
      const url = `${BASE_URL}${payload.path}`;

      if (payload.method === 'GET') {
        res = http.get(url);
      } else {
        res = http.post(url, payload.body || '{}', {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Should get an error response, never 200
      const passed = check(res, {
        [`${payload.name} — not 200/500`]: (r) => r.status !== 200 && r.status < 500,
      });

      if (!passed && res.status === 200) {
        securityIssues.add(1);
        console.error(`SECURITY: ${payload.name} returned 200 — input not validated`);
      } else {
        securityIssues.add(0);
      }
    }
  });
}
