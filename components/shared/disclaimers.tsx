import Link from 'next/link';

/**
 * Standard owner-facing disclaimer for enrollment pages.
 * Informs pet owners about automatic debits and their responsibilities.
 */
export function OwnerDisclaimer({ className }: { className?: string }) {
  return (
    <p className={className ?? 'mx-auto mt-6 max-w-lg text-xs text-muted-foreground'}>
      By enrolling, you authorize FuzzyCat to debit your account on the scheduled dates. Overdraft
      fees or bank charges from failed debits are your responsibility.{' '}
      <Link href="/terms" className="underline hover:text-foreground">
        Terms of Service
      </Link>
    </p>
  );
}

/**
 * Standard clinic-facing disclaimer for marketing and signup pages.
 * Clarifies that FuzzyCat is not a collection agency and clinics bear default risk.
 */
export function ClinicDisclaimer({ className }: { className?: string }) {
  return (
    <p className={className ?? 'mx-auto mt-4 max-w-lg text-xs text-muted-foreground'}>
      FuzzyCat is a payment service, not a collection agency. If a client&apos;s payment plan
      defaults after automated retries, the clinic is responsible for any remaining balance.{' '}
      <Link href="/terms" className="underline hover:text-foreground">
        Terms of Service
      </Link>
    </p>
  );
}
