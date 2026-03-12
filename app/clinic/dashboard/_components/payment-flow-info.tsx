'use client';

import { ChevronDown, ChevronUp, Info } from 'lucide-react';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CLINIC_SHARE_PERCENT, DEPOSIT_RATE, FEE_PERCENT, NUM_INSTALLMENTS } from '@/lib/constants';

const depositPercent = Math.round(DEPOSIT_RATE * 100);

export function PaymentFlowInfo() {
  const [open, setOpen] = useState(false);

  return (
    <Card className="border-muted">
      <CardHeader
        className="cursor-pointer pb-3"
        onClick={() => setOpen(!open)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') setOpen(!open);
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">How FuzzyCat Payment Plans Work</CardTitle>
          </div>
          {open ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </CardHeader>
      {open && (
        <CardContent className="space-y-4 pt-0 text-sm text-muted-foreground">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="font-medium text-foreground">Payment Structure</p>
              <ul className="mt-1 space-y-1 text-xs">
                <li>Pet owner pays {FEE_PERCENT}% platform fee on their bill</li>
                <li>{depositPercent}% deposit collected up front via debit card</li>
                <li>Remaining {100 - Math.round(DEPOSIT_RATE * 100)}% split into {NUM_INSTALLMENTS} biweekly ACH payments</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-foreground">Your Revenue</p>
              <ul className="mt-1 space-y-1 text-xs">
                <li>You earn a {CLINIC_SHARE_PERCENT}% revenue share on each payment</li>
                <li>Share is calculated on the full payment (bill + fee)</li>
                <li>Payouts transfer to your connected Stripe account</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-foreground">Missed Payments</p>
              <ul className="mt-1 space-y-1 text-xs">
                <li>FuzzyCat sends automated reminders for missed payments</li>
                <li>After 3 unsuccessful attempts, the plan is paused and the clinic is notified</li>
                <li>Clinics are responsible for collecting on paused plans</li>
                <li>The {depositPercent}% deposit helps reduce your risk exposure</li>
              </ul>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
