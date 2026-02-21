import type { Metadata } from 'next';
import { OnboardingChecklist } from './onboarding-checklist';

export const metadata: Metadata = {
  title: 'Clinic Onboarding | FuzzyCat',
  description: 'Complete your clinic setup to start offering FuzzyCat payment plans.',
};

export default function ClinicOnboardingPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome to FuzzyCat</h1>
        <p className="mt-2 text-muted-foreground">
          Complete the steps below to start offering Guaranteed Payment Plans to your clients.
        </p>
      </div>
      <OnboardingChecklist />
    </div>
  );
}
