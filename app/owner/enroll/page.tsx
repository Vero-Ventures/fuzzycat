'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { StepBankVerification } from './_components/step-bank-verification';
import { StepBillDetails } from './_components/step-bill-details';
import { StepClinicSelection } from './_components/step-clinic-selection';
import { StepDepositPayment } from './_components/step-deposit-payment';
import { StepReviewConfirm } from './_components/step-review-confirm';
import { type EnrollmentData, INITIAL_ENROLLMENT_DATA } from './_components/types';

const STEPS = [
  { label: 'Select Clinic', number: 1 },
  { label: 'Bill Details', number: 2 },
  { label: 'Bank Verification', number: 3 },
  { label: 'Review & Confirm', number: 4 },
  { label: 'Pay Deposit', number: 5 },
] as const;

export default function OwnerEnrollPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [data, setData] = useState<EnrollmentData>(INITIAL_ENROLLMENT_DATA);

  const progressPercent = (currentStep / STEPS.length) * 100;

  function updateData(updates: Partial<EnrollmentData>) {
    setData((prev) => ({ ...prev, ...updates }));
  }

  function goNext() {
    setCurrentStep((prev) => Math.min(prev + 1, STEPS.length));
  }

  function goBack() {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  }

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-8 md:px-8">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Enroll in a Payment Plan
          </h1>
          <p className="mt-2 text-muted-foreground">
            Split your vet bill into easy biweekly payments. No credit check required.
          </p>
        </div>

        {/* Progress indicator */}
        <div className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            {STEPS.map((step) => (
              <div key={step.number} className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors',
                    currentStep === step.number
                      ? 'bg-primary text-primary-foreground'
                      : currentStep > step.number
                        ? 'bg-primary/20 text-primary'
                        : 'bg-muted text-muted-foreground',
                  )}
                >
                  {currentStep > step.number ? '\u2713' : step.number}
                </div>
                <span
                  className={cn(
                    'hidden text-xs md:block',
                    currentStep === step.number
                      ? 'font-medium text-foreground'
                      : 'text-muted-foreground',
                  )}
                >
                  {step.label}
                </span>
              </div>
            ))}
          </div>
          <Progress value={progressPercent} className="h-2" />
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Step {currentStep} of {STEPS.length}
          </p>
        </div>

        {/* Step content */}
        <Card>
          <CardContent className="p-6">
            {currentStep === 1 && (
              <StepClinicSelection data={data} updateData={updateData} onNext={goNext} />
            )}
            {currentStep === 2 && (
              <StepBillDetails
                data={data}
                updateData={updateData}
                onNext={goNext}
                onBack={goBack}
              />
            )}
            {currentStep === 3 && (
              <StepBankVerification
                data={data}
                updateData={updateData}
                onNext={goNext}
                onBack={goBack}
              />
            )}
            {currentStep === 4 && (
              <StepReviewConfirm
                data={data}
                updateData={updateData}
                onNext={goNext}
                onBack={goBack}
              />
            )}
            {currentStep === 5 && <StepDepositPayment data={data} onBack={goBack} />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
