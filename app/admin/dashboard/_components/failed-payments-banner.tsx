'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useTRPC } from '@/lib/trpc/client';

export function FailedPaymentsBanner() {
  const trpc = useTRPC();
  const { data } = useQuery(
    trpc.admin.getPayments.queryOptions({ status: 'failed', limit: 1, offset: 0 }),
  );

  if (!data || data.pagination.totalCount === 0) return null;

  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Failed Payments</AlertTitle>
      <AlertDescription>
        {data.pagination.totalCount} payment{data.pagination.totalCount !== 1 ? 's' : ''} failed and
        need attention.{' '}
        <Link href="/admin/payments" className="font-medium underline underline-offset-4">
          View payments
        </Link>
      </AlertDescription>
    </Alert>
  );
}
