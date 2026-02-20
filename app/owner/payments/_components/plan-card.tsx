'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { formatCents } from '@/lib/utils/money';
import { PaymentHistoryTable } from './payment-history-table';

interface PlanCardProps {
  plan: {
    id: string;
    clinicName: string | null;
    totalBillCents: number;
    feeCents: number;
    totalWithFeeCents: number;
    depositCents: number;
    remainingCents: number;
    installmentCents: number;
    numInstallments: number;
    status: string;
    nextPaymentAt: Date | string | null;
    depositPaidAt: Date | string | null;
    completedAt: Date | string | null;
    createdAt: Date | string | null;
    succeededCount: number;
    totalPaidCents: number;
    totalPayments: number;
  };
}

function formatDate(date: Date | string | null): string {
  if (!date) return '--';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date));
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default',
  deposit_paid: 'secondary',
  completed: 'outline',
  pending: 'secondary',
  defaulted: 'destructive',
  cancelled: 'destructive',
};

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  deposit_paid: 'Deposit Paid',
  completed: 'Completed',
  pending: 'Pending',
  defaulted: 'Defaulted',
  cancelled: 'Cancelled',
};

export function PlanCard({ plan }: PlanCardProps) {
  const [expanded, setExpanded] = useState(false);

  // Total payments = deposit (1) + installments (numInstallments)
  const totalExpectedPayments = 1 + plan.numInstallments;
  const progressPercent =
    totalExpectedPayments > 0 ? Math.round((plan.succeededCount / totalExpectedPayments) * 100) : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{plan.clinicName ?? 'Unknown Clinic'}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Started {formatDate(plan.createdAt)}
            </p>
          </div>
          <Badge variant={STATUS_VARIANT[plan.status] ?? 'secondary'}>
            {STATUS_LABEL[plan.status] ?? plan.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Next Payment — prominent when plan is active */}
        {(plan.status === 'active' || plan.status === 'deposit_paid') && plan.nextPaymentAt && (
          <div className="rounded-md bg-muted/50 p-3">
            <p className="text-sm font-medium">Next payment</p>
            <p className="text-lg font-bold">{formatCents(plan.installmentCents)}</p>
            <p className="text-sm text-muted-foreground">{formatDate(plan.nextPaymentAt)}</p>
          </div>
        )}

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {plan.succeededCount} of {totalExpectedPayments} payments complete
            </span>
            <span className="font-medium">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>

        {/* Financial Summary */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Total Paid</p>
            <p className="font-medium">{formatCents(plan.totalPaidCents)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Total Remaining</p>
            <p className="font-medium">
              {formatCents(plan.totalWithFeeCents - plan.totalPaidCents)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Vet Bill</p>
            <p className="font-medium">{formatCents(plan.totalBillCents)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Platform Fee</p>
            <p className="font-medium">{formatCents(plan.feeCents)}</p>
          </div>
        </div>

        <Separator />

        {/* Expand/Collapse Payment History */}
        <Button
          variant="ghost"
          className="w-full justify-between"
          onClick={() => setExpanded(!expanded)}
        >
          <span>{expanded ? 'Hide' : 'View'} Payment History</span>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>

        {expanded && <PaymentHistoryTable planId={plan.id} />}
      </CardContent>
    </Card>
  );
}
