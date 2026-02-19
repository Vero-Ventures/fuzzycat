import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    clientTraceMetadata: ['sentry-trace', 'baggage'],
  },
};

export default withSentryConfig(nextConfig, {
  // Proxy Sentry requests through the Next.js server to avoid ad-blockers
  tunnelRoute: '/monitoring',

  // Suppress build noise locally; only log in CI
  silent: !process.env.CI,

  // Source maps uploaded then deleted to keep bundle clean
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
});
