'use client';

import { PortalError } from '@/components/shared/portal-error';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <PortalError error={error} reset={reset} portalName="admin" />;
}
