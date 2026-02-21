import type { Metadata } from 'next';
import { StripeReturnContent } from './stripe-return-content';

export const metadata: Metadata = {
  title: 'Stripe Setup | FuzzyCat',
  description: 'Checking your Stripe Connect account status.',
};

export default function StripeReturnPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 sm:px-6 lg:px-8">
      <StripeReturnContent />
    </div>
  );
}
