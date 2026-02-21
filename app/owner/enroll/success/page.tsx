'use client';

import { useQuery } from '@tanstack/react-query';
import { Calendar, CheckCircle2, Home } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useTRPC } from '@/lib/trpc/client';
import { formatCents } from '@/lib/utils/money';

function formatDate(dateStr: string | Date): string {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function EnrollSuccessPage() {
  const searchParams = useSearchParams();
  const planId = searchParams.get('planId');
  const trpc = useTRPC();

  const summaryQuery = useQuery(
    trpc.enrollment.getSummary.queryOptions({ planId: planId ?? '' }, { enabled: !!planId }),
  );

  const summary = summaryQuery.data;

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-8 md:px-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <CheckCircle2 className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">You are all set!</h1>
          <p className="mt-2 text-muted-foreground">
            Your deposit has been paid and your payment plan is now active.
          </p>
        </div>

        {summaryQuery.isLoading && (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">Loading your plan details...</p>
            </CardContent>
          </Card>
        )}

        {summaryQuery.isError && (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">
                Your enrollment was successful. You can view your plan details on your payments
                page.
              </p>
            </CardContent>
          </Card>
        )}

        {summary && (
          <Card>
            <CardContent className="space-y-4 p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Clinic</p>
                  <p className="font-medium">{summary.clinic?.name ?? 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Pet</p>
                  <p className="font-medium">{summary.owner?.petName ?? 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total bill</p>
                  <p className="font-medium">{formatCents(summary.plan?.totalBillCents ?? 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total with fee</p>
                  <p className="font-medium">{formatCents(summary.plan?.totalWithFeeCents ?? 0)}</p>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="mb-2 flex items-center gap-2 font-semibold">
                  <Calendar className="h-4 w-4" />
                  Upcoming Payments
                </h3>
                <div className="space-y-1">
                  {summary.payments?.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between rounded px-3 py-2 text-sm odd:bg-muted/50"
                    >
                      <div>
                        <span className="font-medium">
                          {payment.type === 'deposit'
                            ? 'Deposit'
                            : `Installment ${payment.sequenceNum ?? ''}`}
                        </span>
                        <span className="ml-2 text-muted-foreground">
                          {formatDate(payment.scheduledAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{formatCents(payment.amountCents)}</span>
                        {payment.status === 'succeeded' && (
                          <CheckCircle2 className="h-3 w-3 text-primary" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="mt-6 text-center">
          <Button asChild>
            <a href="/owner/payments">
              <Home className="h-4 w-4" />
              View My Payments
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
