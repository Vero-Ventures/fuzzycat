/**
 * k6 load test for the FuzzyCat External REST API.
 *
 * Validates rate limiting, auth enforcement, and endpoint performance
 * under concurrent load.
 *
 * Usage:
 *   k6 run scripts/k6/api-load-test.js
 *   k6 run scripts/k6/api-load-test.js --env BASE_URL=https://www.fuzzycatapp.com/api/v1
 *   k6 run scripts/k6/api-load-test.js --env API_KEY=fc_live_...
 *
 * Scenarios:
 *   1. smoke       — 1 VU for 10s, basic sanity
 *   2. load        — Ramp to 20 VUs over 1 min, sustained 1 min, ramp down
 *   3. rate_limit  — 5 VUs hammering a single endpoint to trigger 429s
 */

import { check, group, sleep } from 'k6';
import http from 'k6/http';
import { Rate, Trend } from 'k6/metrics';

// ── Custom metrics ──────────────────────────────────────────────────
const errorRate = new Rate('error_rate');
const rateLimitedRate = new Rate('rate_limited');
const authBlockedRate = new Rate('auth_blocked');
const healthLatency = new Trend('health_latency', true);
const authedLatency = new Trend('authed_endpoint_latency', true);

// ── Configuration ───────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000/api/v1';
const API_KEY = __ENV.API_KEY || '';

const authHeaders = API_KEY
  ? { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' }
  : { 'Content-Type': 'application/json' };

export const options = {
  scenarios: {
    smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '10s',
      exec: 'smokeTest',
      tags: { scenario: 'smoke' },
    },
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 20 },
        { duration: '1m', target: 20 },
        { duration: '30s', target: 0 },
      ],
      exec: 'loadTest',
      startTime: '15s',
      tags: { scenario: 'load' },
    },
    rate_limit: {
      executor: 'constant-vus',
      vus: 5,
      duration: '30s',
      exec: 'rateLimitTest',
      startTime: '2m30s',
      tags: { scenario: 'rate_limit' },
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95th percentile under 2s
    error_rate: ['rate<0.1'], // Less than 10% errors (excluding expected 401/429)
    health_latency: ['p(99)<500'], // Health check always fast
  },
};

// ── Scenario: Smoke ─────────────────────────────────────────────────
export function smokeTest() {
  group('Health check', () => {
    const res = http.get(`${BASE_URL}/health`);
    healthLatency.add(res.timings.duration);

    check(res, {
      'health status 200': (r) => r.status === 200,
      'health body ok': (r) => {
        try {
          return JSON.parse(r.body).status === 'ok';
        } catch {
          return false;
        }
      },
      'has request-id header': (r) => !!r.headers['X-Request-Id'],
    });

    errorRate.add(res.status >= 500);
  });

  group('OpenAPI spec', () => {
    const res = http.get(`${BASE_URL}/openapi.json`);

    check(res, {
      'openapi status 200': (r) => r.status === 200,
      'openapi has paths': (r) => {
        try {
          return Object.keys(JSON.parse(r.body).paths).length > 0;
        } catch {
          return false;
        }
      },
    });

    errorRate.add(res.status >= 500);
  });

  group('Auth enforcement', () => {
    // Request without API key should get 401
    const res = http.get(`${BASE_URL}/clinic/profile`, {
      headers: { 'Content-Type': 'application/json' },
    });

    check(res, {
      'unauthed returns 401': (r) => r.status === 401,
      'error body has code': (r) => {
        try {
          return JSON.parse(r.body).error.code === 'UNAUTHORIZED';
        } catch {
          return false;
        }
      },
    });

    authBlockedRate.add(res.status === 401);
  });

  sleep(1);
}

// ── Scenario: Load ──────────────────────────────────────────────────
export function loadTest() {
  // Mix of endpoints to simulate realistic traffic
  const endpoints = [
    { path: '/health', auth: false },
    { path: '/openapi.json', auth: false },
    { path: '/clinic/profile', auth: true },
    { path: '/clinic/stats', auth: true },
    { path: '/clinic/clients', auth: true },
    { path: '/payouts', auth: true },
    { path: '/payouts/earnings', auth: true },
    { path: '/clinic/revenue', auth: true },
    { path: '/clinic/stats/trends', auth: true },
    { path: '/clinic/stats/defaults', auth: true },
  ];

  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
  const headers = endpoint.auth ? authHeaders : { 'Content-Type': 'application/json' };

  const res = http.get(`${BASE_URL}${endpoint.path}`, {
    headers,
    tags: { endpoint: endpoint.path },
  });

  if (endpoint.auth) {
    authedLatency.add(res.timings.duration);
  } else {
    healthLatency.add(res.timings.duration);
  }

  // For authed endpoints without a key, 401 is expected — not an error
  errorRate.add(res.status >= 500);
  rateLimitedRate.add(res.status === 429);

  check(res, {
    'response is valid': (r) => r.status < 500,
    'has request-id': (r) => !!r.headers['X-Request-Id'],
  });

  // Check rate limit headers when present
  if (res.headers['X-Ratelimit-Limit']) {
    check(res, {
      'has rate limit headers': (r) =>
        !!r.headers['X-Ratelimit-Limit'] &&
        !!r.headers['X-Ratelimit-Remaining'] &&
        !!r.headers['X-Ratelimit-Reset'],
    });
  }

  sleep(Math.random() * 0.5 + 0.1);
}

// ── Scenario: Rate Limit ────────────────────────────────────────────
export function rateLimitTest() {
  // Rapid-fire requests to trigger rate limiting (100 req/60s per clinic)
  const res = http.get(`${BASE_URL}/health`);

  rateLimitedRate.add(res.status === 429);

  check(res, {
    'rate limit response valid': (r) => r.status === 200 || r.status === 429,
  });

  if (res.status === 429) {
    check(res, {
      '429 has rate limit headers': (r) => !!r.headers['X-Ratelimit-Reset'],
      '429 has error body': (r) => {
        try {
          return JSON.parse(r.body).error.code === 'RATE_LIMITED';
        } catch {
          return false;
        }
      },
    });
  }

  // No sleep — intentionally fast to trigger rate limits
}
