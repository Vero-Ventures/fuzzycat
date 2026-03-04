import { Info } from 'lucide-react';
import { CLINIC_SHARE_PERCENT, FEE_PERCENT, PLATFORM_RESERVE_RATE } from '@/lib/constants';

const reservePercent = Math.round(PLATFORM_RESERVE_RATE * 100);

export function PayoutExplainer() {
  return (
    <div className="rounded-lg border border-muted bg-muted/30 p-4">
      <div className="flex items-start gap-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="space-y-2 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">How payouts are calculated</p>
          <p>
            When a pet owner makes a payment, FuzzyCat transfers funds to your clinic. Each payout
            includes a <strong>{CLINIC_SHARE_PERCENT}% revenue share</strong> calculated on the
            total payment amount (vet bill portion + the {FEE_PERCENT}% platform fee the owner
            pays).
          </p>
          <div className="rounded-md border bg-background p-3 text-xs">
            <p className="font-medium text-foreground">Example: $1,000 vet bill</p>
            <ul className="mt-1 space-y-0.5">
              <li>Owner pays: $1,000 + {FEE_PERCENT}% fee = $1,080 total</li>
              <li>Each installment: $1,080 &divide; 7 payments &asymp; $154.29</li>
              <li>
                Your {CLINIC_SHARE_PERCENT}% share per payment: $154.29 &times;{' '}
                {CLINIC_SHARE_PERCENT}% = $4.63
              </li>
              <li>
                Payout per payment: bill portion &minus; {reservePercent}% reserve +{' '}
                {CLINIC_SHARE_PERCENT}% share
              </li>
            </ul>
          </div>
          <p className="text-xs">
            <strong>Total Received</strong> = all funds transferred to your account (bill + revenue
            share). <strong>{CLINIC_SHARE_PERCENT}% Revenue Share</strong> = your platform
            administration compensation, included in each payout.
          </p>
        </div>
      </div>
    </div>
  );
}
