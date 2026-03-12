'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CLINIC_SHARE_PERCENT, CLINIC_SHARE_RATE } from '@/lib/constants';
import { formatCents, percentOfCents } from '@/lib/utils/money';

const TYPICAL_BNPL_MERCHANT_FEE_RATE = 0.1;

interface SliderConfig {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  format: (value: number) => string;
}

const sliders: SliderConfig[] = [
  {
    id: 'avgBill',
    label: 'Average treatment cost',
    min: 500,
    max: 5000,
    step: 50,
    defaultValue: 1200,
    format: (v) => `$${v.toLocaleString()}`,
  },
  {
    id: 'patients',
    label: 'Patients per month',
    min: 10,
    max: 200,
    step: 5,
    defaultValue: 80,
    format: (v) => `${v}`,
  },
  {
    id: 'declineRate',
    label: '% who decline treatment due to cost',
    min: 5,
    max: 40,
    step: 1,
    defaultValue: 20,
    format: (v) => `${v}%`,
  },
  {
    id: 'conversionRate',
    label: '% of decliners who would proceed with a payment plan',
    min: 20,
    max: 80,
    step: 5,
    defaultValue: 40,
    format: (v) => `${v}%`,
  },
];

/**
 * Calculate clinic revenue estimates. All monetary values in integer cents.
 */
export function calculateClinicRevenue(
  avgBillDollars: number,
  patientsPerMonth: number,
  declinePercent: number,
  conversionPercent: number,
) {
  const avgBillCents = Math.round(avgBillDollars * 100);
  const declineRate = declinePercent / 100;
  const conversionRate = conversionPercent / 100;

  const lostRevenueMonthlyCents = Math.round(avgBillCents * patientsPerMonth * declineRate);
  const recapturedMonthlyCents = Math.round(lostRevenueMonthlyCents * conversionRate);
  const revenueShareMonthlyCents = percentOfCents(recapturedMonthlyCents, CLINIC_SHARE_RATE);
  const bnplFeeMonthlyCents = percentOfCents(
    recapturedMonthlyCents,
    TYPICAL_BNPL_MERCHANT_FEE_RATE,
  );

  return {
    lostRevenueMonthlyCents,
    lostRevenueAnnualCents: lostRevenueMonthlyCents * 12,
    recapturedMonthlyCents,
    recapturedAnnualCents: recapturedMonthlyCents * 12,
    revenueShareMonthlyCents,
    revenueShareAnnualCents: revenueShareMonthlyCents * 12,
    bnplFeeMonthlyCents,
    bnplFeeAnnualCents: bnplFeeMonthlyCents * 12,
  };
}

export function ClinicRevenueCalculator() {
  const [avgBill, setAvgBill] = useState(1200);
  const [patients, setPatients] = useState(80);
  const [declineRate, setDeclineRate] = useState(20);
  const [conversionRate, setConversionRate] = useState(40);

  const setters: Record<string, (v: number) => void> = {
    avgBill: setAvgBill,
    patients: setPatients,
    declineRate: setDeclineRate,
    conversionRate: setConversionRate,
  };
  const values: Record<string, number> = {
    avgBill,
    patients,
    declineRate,
    conversionRate,
  };

  const result = calculateClinicRevenue(avgBill, patients, declineRate, conversionRate);

  // Calculate proportional bar widths (lost revenue is 100%)
  const maxCents = result.lostRevenueMonthlyCents || 1;
  const recapturedPercent = Math.round((result.recapturedMonthlyCents / maxCents) * 100);
  const sharePercent = Math.max(1, Math.round((result.revenueShareMonthlyCents / maxCents) * 100));

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl">Estimate Your Revenue</CardTitle>
        <p className="text-sm text-muted-foreground">
          See how much additional revenue your clinic could recapture by offering FuzzyCat payment
          plans.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Sliders */}
        <div className="space-y-5">
          {sliders.map((slider) => (
            <div key={slider.id}>
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor={slider.id} className="text-sm font-medium">
                  {slider.label}
                </label>
                <span className="text-sm font-semibold tabular-nums">
                  {slider.format(values[slider.id])}
                </span>
              </div>
              <input
                id={slider.id}
                type="range"
                min={slider.min}
                max={slider.max}
                step={slider.step}
                value={values[slider.id]}
                onChange={(e) => setters[slider.id](Number(e.target.value))}
                className="w-full cursor-pointer accent-primary"
              />
              <div className="mt-0.5 flex justify-between text-xs text-muted-foreground">
                <span>{slider.format(slider.min)}</span>
                <span>{slider.format(slider.max)}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Visual Bars */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold">Monthly Impact</h4>

          <BarRow
            label="Revenue currently lost"
            monthlyCents={result.lostRevenueMonthlyCents}
            annualCents={result.lostRevenueAnnualCents}
            widthPercent={100}
            color="bg-red-400 dark:bg-red-500"
          />
          <BarRow
            label="Revenue recaptured with FuzzyCat"
            monthlyCents={result.recapturedMonthlyCents}
            annualCents={result.recapturedAnnualCents}
            widthPercent={recapturedPercent}
            color="bg-teal-500 dark:bg-teal-400"
          />
          <BarRow
            label={`${CLINIC_SHARE_PERCENT}% revenue share earned`}
            monthlyCents={result.revenueShareMonthlyCents}
            annualCents={result.revenueShareAnnualCents}
            widthPercent={sharePercent}
            color="bg-primary"
          />
        </div>

        {/* BNPL Comparison */}
        <div className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 dark:border-teal-800 dark:bg-teal-950/50">
          <p className="text-sm text-teal-800 dark:text-teal-300">
            With most BNPL providers you would pay ~10% in merchant fees (
            <strong>{formatCents(result.bnplFeeMonthlyCents)}/mo</strong>). With FuzzyCat you{' '}
            <em>earn</em> {CLINIC_SHARE_PERCENT}% (
            <strong>+{formatCents(result.revenueShareMonthlyCents)}/mo</strong>).
          </p>
        </div>

        {/* Disclaimers */}
        <div className="space-y-1.5 text-xs text-muted-foreground">
          <p>
            This calculator provides estimates based on your inputs. Results are not guaranteed.
          </p>
          <p>
            Revenue share is earned on successfully collected payments only. FuzzyCat does not
            guarantee client payments.
          </p>
          <p>
            Actual results depend on client enrollment, payment completion, and your clinic&apos;s
            patient mix.
          </p>
          <p>
            <Link href="/terms" className="underline hover:text-foreground">
              Terms of Service
            </Link>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function BarRow({
  label,
  monthlyCents,
  annualCents,
  widthPercent,
  color,
}: {
  label: string;
  monthlyCents: number;
  annualCents: number;
  widthPercent: number;
  color: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="whitespace-nowrap text-sm font-semibold tabular-nums">
          {formatCents(monthlyCents)}{' '}
          <span className="font-normal text-muted-foreground">({formatCents(annualCents)}/yr)</span>
        </span>
      </div>
      <div className="h-3 w-full rounded-full bg-muted">
        <div
          className={`h-3 rounded-full transition-all duration-300 ${color}`}
          style={{ width: `${widthPercent}%` }}
        />
      </div>
    </div>
  );
}
