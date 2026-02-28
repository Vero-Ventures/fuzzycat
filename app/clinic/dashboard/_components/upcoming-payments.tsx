import { CalendarDays } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/utils/date';
import { formatCents } from '@/lib/utils/money';

interface Enrollment {
  id: string;
  ownerName: string | null;
  petName: string | null;
  totalBillCents: number;
  status: string;
  createdAt: Date;
}

export function UpcomingPayments({ enrollments }: { enrollments: Enrollment[] }) {
  const activeEnrollments = enrollments.filter((e) => e.status === 'active');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">Upcoming Payments</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {activeEnrollments.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No upcoming payments at this time.
          </p>
        ) : (
          <div className="space-y-3">
            {activeEnrollments.slice(0, 5).map((enrollment) => (
              <div
                key={enrollment.id}
                className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2.5"
              >
                <div className="text-sm">
                  <p className="font-medium">{enrollment.ownerName ?? 'Unknown'}</p>
                  <p className="text-xs text-muted-foreground">
                    {enrollment.petName ?? 'Pet'} &middot; {formatDate(enrollment.createdAt)}
                  </p>
                </div>
                <p className="text-sm font-semibold">{formatCents(enrollment.totalBillCents)}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function UpcomingPaymentsSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-40" />
      </CardHeader>
      <CardContent className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}
