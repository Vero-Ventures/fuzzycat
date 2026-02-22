import bundleAnalyzer from '@next/bundle-analyzer';
import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = {
  experimental: {
    clientTraceMetadata: ['sentry-trace', 'baggage'],
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-accordion',
      '@radix-ui/react-avatar',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-label',
      '@radix-ui/react-progress',
      '@radix-ui/react-separator',
      '@radix-ui/react-tabs',
    ],
  },
};

export default withSentryConfig(withBundleAnalyzer(nextConfig), {
  // Proxy Sentry requests through the Next.js server to avoid ad-blockers
  tunnelRoute: '/monitoring',

  // Suppress build noise locally; only log in CI
  silent: !process.env.CI,

  // Source maps uploaded then deleted to keep bundle clean
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
});
