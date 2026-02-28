'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { MIN_BILL_CENTS } from '@/lib/constants';
import { formatCents, toCents } from '@/lib/utils/money';
import { calculatePaymentSchedule } from '@/lib/utils/schedule';

export function PaymentCalculator() {
  const [billAmount, setBillAmount] = useState('1200');

  const dollars = Number.parseFloat(billAmount);
  const isValid = Number.isFinite(dollars) && dollars >= MIN_BILL_CENTS / 100;
  const schedule = isValid ? calculatePaymentSchedule(toCents(dollars)) : null;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl">Payment Schedule Calculator</CardTitle>
        <p className="text-sm text-muted-foreground">
          Enter your vet bill to see your exact payment schedule.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label htmlFor="bill-amount">Vet bill amount</Label>
          <div className="relative mt-1.5">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              $
            </span>
            <Input
              id="bill-amount"
              type="number"
              min={MIN_BILL_CENTS / 100}
              step="50"
              value={billAmount}
              onChange={(e) => setBillAmount(e.target.value)}
              className="pl-7"
              placeholder="1200"
            />
          </div>
          {billAmount && !isValid && (
            <p className="mt-1.5 text-xs text-destructive">
              Minimum bill amount is {formatCents(MIN_BILL_CENTS)}.
            </p>
          )}
        </div>

        {schedule && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <SummaryItem label="Vet bill" value={formatCents(schedule.totalBillCents)} />
              <SummaryItem label="Platform fee (6%)" value={formatCents(schedule.feeCents)} />
              <SummaryItem
                label="Total cost"
                value={formatCents(schedule.totalWithFeeCents)}
                bold
              />
              <SummaryItem label="Deposit (25%)" value={formatCents(schedule.depositCents)} />
            </div>

            <Separator />

            <div>
              <h4 className="mb-3 text-sm font-semibold">Payment Schedule</h4>
              <div className="space-y-2">
                {schedule.payments.map((payment) => (
                  <div
                    key={payment.sequenceNum}
                    className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-2.5 text-sm"
                  >
                    <div>
                      <span className="font-medium">
                        {payment.type === 'deposit'
                          ? 'Deposit (today)'
                          : `Payment ${payment.sequenceNum}`}
                      </span>
                      <span className="ml-2 text-muted-foreground">
                        {payment.type === 'deposit'
                          ? 'Due at enrollment'
                          : `Week ${payment.sequenceNum * 2}`}
                      </span>
                    </div>
                    <span className="font-semibold">{formatCents(payment.amountCents)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 dark:border-teal-800 dark:bg-teal-950/50">
              <p className="text-sm font-medium text-teal-800 dark:text-teal-300">
                Total you pay: {formatCents(schedule.totalWithFeeCents)}
              </p>
              <p className="mt-0.5 text-xs text-teal-700 dark:text-teal-400">
                That is {formatCents(schedule.feeCents)} in fees on a{' '}
                {formatCents(schedule.totalBillCents)} bill. No interest. No additional charges.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SummaryItem({
  label,
  value,
  bold = false,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={bold ? 'text-lg font-bold' : 'text-lg font-semibold'}>{value}</p>
    </div>
  );
}
