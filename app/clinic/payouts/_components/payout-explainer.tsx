import { Info } from 'lucide-react';
import {
  CLINIC_SHARE_PERCENT,
  FEE_PERCENT,
  NUM_INSTALLMENTS,
  PLATFORM_FEE_RATE,
  PLATFORM_RESERVE_RATE,
} from '@/lib/constants';

const NUM_TOTAL_PAYMENTS = NUM_INSTALLMENTS + 1; // deposit + installments
const reservePercent = Math.round(PLATFORM_RESERVE_RATE * 100);
const exampleBill = 1_000;
const exampleTotal = exampleBill + Math.round(exampleBill * PLATFORM_FEE_RATE * 100) / 100;
const exampleInstallment = (exampleTotal / NUM_TOTAL_PAYMENTS).toFixed(2);
const exampleShare = ((exampleTotal / NUM_TOTAL_PAYMENTS) * (CLINIC_SHARE_PERCENT / 100)).toFixed(2);

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
            <p className="font-medium text-foreground">
              Example: ${exampleBill.toLocaleString()} vet bill
            </p>
            <ul className="mt-1 space-y-0.5">
              <li>
                Owner pays: ${exampleBill.toLocaleString()} + {FEE_PERCENT}% fee = $
                {exampleTotal.toLocaleString()} total
              </li>
              <li>
                Each installment: ${exampleTotal.toLocaleString()} &divide; {NUM_TOTAL_PAYMENTS} payments &asymp; $
                {exampleInstallment}
              </li>
              <li>
                Your {CLINIC_SHARE_PERCENT}% share per payment: ${exampleInstallment} &times;{' '}
                {CLINIC_SHARE_PERCENT}% = ${exampleShare}
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
