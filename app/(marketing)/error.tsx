'use client';

import { PortalError } from '@/components/shared/portal-error';

export default function MarketingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <PortalError error={error} reset={reset} portalName="marketing" />;
}
