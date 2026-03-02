import bundleAnalyzer from '@next/bundle-analyzer';
import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    clientTraceMetadata: ['sentry-trace', 'baggage'],
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-accordion',
      '@radix-ui/react-avatar',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-label',
      '@radix-ui/react-progress',
      '@radix-ui/react-separator',
      '@radix-ui/react-slot',
      '@radix-ui/react-tabs',
    ],
  },
};

export default withSentryConfig(withBundleAnalyzer(nextConfig), {
  // Proxy Sentry requests through the Next.js server to avoid ad-blockers
  tunnelRoute: '/monitoring',

  // Always silence sentry-cli to avoid EAGAIN crashes from non-blocking stdout
  // in Vercel's build environment (Rust CLI panics on pipe buffer overflow)
  silent: true,

  // Source maps uploaded then deleted to keep bundle clean
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },

  // Allow builds to succeed even if source map upload fails (transient Sentry CLI crashes)
  errorHandler: (err) => {
    console.warn('[sentry] Source map upload failed (non-fatal):', err.message);
  },
});
