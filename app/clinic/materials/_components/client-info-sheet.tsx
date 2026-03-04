'use client';

import { FEE_PERCENT } from '@/lib/constants';

interface ClientInfoSheetProps {
  clinicName: string;
}

export function ClientInfoSheet({ clinicName }: ClientInfoSheetProps) {
  return (
    <div className="print-material mx-auto max-w-md rounded-lg border bg-white p-6 text-black">
      <h3 className="text-lg font-bold text-teal-700">How Payment Plans Work</h3>
      <p className="text-xs text-gray-500">Provided by {clinicName} via FuzzyCat</p>

      <div className="mt-4 space-y-4">
        <div className="rounded-md bg-teal-50 p-4">
          <p className="text-sm font-semibold text-teal-800">
            Split your vet bill into easy payments — no credit check, no interest.
          </p>
        </div>

        <div>
          <h4 className="text-sm font-semibold">How It Works</h4>
          <div className="mt-2 space-y-2">
            <Step num={1} text="Your vet enters the bill amount into FuzzyCat" />
            <Step num={2} text="You pay 25% as a deposit today" />
            <Step num={3} text="The remaining 75% is split into 6 biweekly payments" />
            <Step num={4} text="Payments are automatically deducted from your bank account" />
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold">Example</h4>
          <div className="mt-2 rounded-md border p-3 text-sm">
            <div className="flex justify-between">
              <span>Vet bill</span>
              <span className="font-medium">$2,000</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Platform fee ({FEE_PERCENT}%)</span>
              <span>$160</span>
            </div>
            <div className="mt-1 border-t pt-1 flex justify-between font-medium">
              <span>Total</span>
              <span>$2,160</span>
            </div>
            <div className="mt-2 flex justify-between text-teal-700">
              <span>Deposit (25%)</span>
              <span className="font-medium">$540 today</span>
            </div>
            <div className="flex justify-between text-teal-700">
              <span>6 biweekly payments</span>
              <span className="font-medium">$270 each</span>
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold">What You Need</h4>
          <ul className="mt-1 ml-4 list-disc text-sm text-gray-600 space-y-1">
            <li>A debit card for the deposit</li>
            <li>A bank account for biweekly payments</li>
            <li>A valid email address</li>
          </ul>
        </div>

        <div className="rounded-md border-l-4 border-teal-500 bg-gray-50 p-3">
          <p className="text-xs text-gray-500">
            FuzzyCat is not a loan. There are no credit checks, no interest charges, and no late
            fees. Payments are made via ACH direct debit from your bank account on a fixed biweekly
            schedule.
          </p>
        </div>
      </div>
    </div>
  );
}

function Step({ num, text }: { num: number; text: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-bold text-teal-700">
        {num}
      </span>
      <p className="text-sm text-gray-600">{text}</p>
    </div>
  );
}
