import type { Metadata } from 'next';
import { Separator } from '@/components/ui/separator';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'FuzzyCat Terms of Service. Read the terms and conditions governing your use of the FuzzyCat payment plan platform.',
};

export default function TermsOfServicePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-4xl font-bold tracking-tight">Terms of Service</h1>
      <p className="mt-3 text-sm text-muted-foreground">Last updated: February 1, 2026</p>

      <Separator className="my-8" />

      <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="text-xl font-semibold text-foreground">1. Acceptance of Terms</h2>
          <p className="mt-3">
            By accessing or using the FuzzyCat platform at fuzzycatapp.com (&quot;Service&quot;),
            you agree to be bound by these Terms of Service (&quot;Terms&quot;). If you do not agree
            to these Terms, do not use the Service. These Terms constitute a legally binding
            agreement between you and FuzzyCat (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;).
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">2. Service Description</h2>
          <p className="mt-3">
            FuzzyCat is a payment facilitation platform that enables pet owners to pay veterinary
            bills in biweekly installments over 12 weeks. FuzzyCat is not a lender. We do not extend
            credit, charge interest, or perform credit checks. We facilitate the scheduling and
            processing of payments between pet owners and veterinary clinics using third-party
            payment processors.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">3. Eligibility</h2>
          <p className="mt-3">To use FuzzyCat, you must:</p>
          <ul className="mt-3 list-disc space-y-2 pl-6">
            <li>Be at least 18 years of age.</li>
            <li>
              Be a resident of the United States (excluding New York, pending regulatory review).
            </li>
            <li>Have a valid debit card and a U.S. bank account capable of ACH transactions.</li>
            <li>Provide accurate and complete information during registration and enrollment.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">4. Payment Plans</h2>
          <p className="mt-3">
            When you enroll in a FuzzyCat payment plan, the following terms apply:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-6">
            <li>
              <strong className="text-foreground">Bill range:</strong> Payment plans are available
              for veterinary bills between $500 and $25,000.
            </li>
            <li>
              <strong className="text-foreground">Platform fee:</strong> A flat 6% platform fee is
              added to your bill amount. This fee is disclosed before you confirm enrollment.
            </li>
            <li>
              <strong className="text-foreground">Deposit:</strong> 25% of the total amount
              (including the platform fee) is charged immediately to your debit card upon
              enrollment.
            </li>
            <li>
              <strong className="text-foreground">Installments:</strong> The remaining 75% is
              divided into 6 equal biweekly payments deducted automatically via ACH from your
              connected bank account.
            </li>
            <li>
              <strong className="text-foreground">Payment schedule:</strong> Installment dates are
              set at enrollment and occur every two weeks. You will receive reminders before each
              scheduled payment.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">5. Failed Payments and Default</h2>
          <p className="mt-3">
            If a scheduled payment fails (for example, due to insufficient funds):
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-6">
            <li>
              We will automatically retry the payment up to 3 times, with retries aligned to common
              paydays (the next Friday, 1st, or 15th of the month, at least 2 days out).
            </li>
            <li>
              You will receive email and SMS reminders at day 1, 7, and 14 after the missed payment.
            </li>
            <li>There are no late fees or penalty charges.</li>
            <li>
              If all retry attempts fail, your plan will be marked as &quot;defaulted.&quot; In this
              case, the veterinary clinic will be notified and may contact you directly to collect
              the outstanding balance. FuzzyCat does not guarantee payment to clinics and is not
              responsible for collection of defaulted plans.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">6. Veterinary Clinic Terms</h2>
          <p className="mt-3">If you are a veterinary clinic using FuzzyCat:</p>
          <ul className="mt-3 list-disc space-y-2 pl-6">
            <li>
              You will receive payouts for each successful payment via Stripe Connect to your
              connected bank account.
            </li>
            <li>
              You will receive a 3% platform administration compensation on each enrollment, paid as
              part of your payout schedule.
            </li>
            <li>
              You are responsible for collecting any outstanding balance from pet owners whose plans
              default. FuzzyCat does not guarantee payment from pet owners to clinics.
            </li>
            <li>
              You must maintain an active Stripe Connect account in good standing to receive
              payouts.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">7. Account Responsibilities</h2>
          <p className="mt-3">
            You are responsible for maintaining the confidentiality of your account credentials and
            for all activities that occur under your account. You agree to notify us immediately of
            any unauthorized use of your account. You must provide accurate information and keep it
            up to date.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">8. Prohibited Uses</h2>
          <p className="mt-3">You agree not to:</p>
          <ul className="mt-3 list-disc space-y-2 pl-6">
            <li>Use the Service for any unlawful purpose or in violation of these Terms.</li>
            <li>Provide false or misleading information during registration or enrollment.</li>
            <li>
              Attempt to interfere with, compromise, or disrupt the Service or its infrastructure.
            </li>
            <li>Use the Service on behalf of a third party without proper authorization.</li>
            <li>Reverse-engineer, decompile, or disassemble any part of the Service.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">9. Intellectual Property</h2>
          <p className="mt-3">
            The FuzzyCat name, logo, and all content, features, and functionality of the Service are
            owned by FuzzyCat and are protected by copyright, trademark, and other intellectual
            property laws. You may not reproduce, distribute, or create derivative works from any
            part of the Service without our prior written consent.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">10. Limitation of Liability</h2>
          <p className="mt-3">
            To the maximum extent permitted by applicable law, FuzzyCat shall not be liable for any
            indirect, incidental, special, consequential, or punitive damages, including but not
            limited to loss of profits, data, or business opportunities, arising from your use of
            the Service. Our total liability for any claim arising from or related to the Service
            shall not exceed the total platform fees you have paid to FuzzyCat in the 12 months
            preceding the claim.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">11. Disclaimer of Warranties</h2>
          <p className="mt-3">
            The Service is provided &quot;as is&quot; and &quot;as available&quot; without
            warranties of any kind, either express or implied. We do not warrant that the Service
            will be uninterrupted, error-free, or secure. We do not guarantee payment between pet
            owners and clinics.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">12. Governing Law</h2>
          <p className="mt-3">
            These Terms shall be governed by and construed in accordance with the laws of the State
            of California, without regard to its conflict of law provisions. Any disputes arising
            from these Terms or your use of the Service shall be resolved in the state or federal
            courts located in San Francisco County, California.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">13. Changes to These Terms</h2>
          <p className="mt-3">
            We reserve the right to modify these Terms at any time. We will notify you of material
            changes by posting the updated Terms on this page and updating the &quot;Last
            updated&quot; date. Your continued use of the Service after changes are posted
            constitutes acceptance of the revised Terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">14. Termination</h2>
          <p className="mt-3">
            We may suspend or terminate your access to the Service at any time for violation of
            these Terms or for any other reason at our discretion. Upon termination, any outstanding
            payment obligations remain in effect. You may close your account at any time by
            contacting us, though this does not relieve you of any existing payment plan
            obligations.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">15. Contact Us</h2>
          <p className="mt-3">If you have questions about these Terms, contact us at:</p>
          <p className="mt-3">
            <strong className="text-foreground">FuzzyCat</strong>
            <br />
            Email:{' '}
            <a href="mailto:legal@fuzzycatapp.com" className="text-primary hover:underline">
              legal@fuzzycatapp.com
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
