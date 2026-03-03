'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Award, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTRPC } from '@/lib/trpc/client';
import { formatDate } from '@/lib/utils/date';

export function FoundingClinicBanner() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: status, isLoading } = useQuery(trpc.growth.getFoundingClinicStatus.queryOptions());

  const enroll = useMutation(
    trpc.growth.enrollFoundingClinic.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.growth.getFoundingClinicStatus.queryKey(),
        });
      },
    }),
  );

  if (isLoading || !status) return null;

  // Already enrolled — show badge
  if (status.isFoundingClinic) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
        <div className="flex items-center gap-3">
          <Award className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="font-semibold text-amber-900 dark:text-amber-100">Founding Clinic</p>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              You earn 5% revenue share on every payment plan.
              {status.expiresAt && ` Enhanced rate valid until ${formatDate(status.expiresAt)}.`}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // No spots left
  if (status.spotsRemaining <= 0) return null;

  // Promotional banner
  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 text-primary" />
          <div>
            <p className="font-semibold">Become a Founding Clinic</p>
            <p className="text-sm text-muted-foreground">
              Earn 5% revenue share (vs. standard 3%) for 12 months. Only {status.spotsRemaining}{' '}
              spots remaining.
            </p>
          </div>
        </div>
        <Button size="sm" onClick={() => enroll.mutate()} disabled={enroll.isPending}>
          {enroll.isPending ? 'Enrolling...' : 'Join Now'}
        </Button>
      </div>
      {enroll.error && <p className="mt-2 text-sm text-destructive">{enroll.error.message}</p>}
    </div>
  );
}
