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
      <p className="mt-3 text-sm text-muted-foreground">Last updated: March 3, 2026</p>

      <Separator className="my-8" />

      <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8 text-sm leading-relaxed text-muted-foreground">
        {/* 1 */}
        <section>
          <h2 className="text-xl font-semibold text-foreground">1. Acceptance of Terms</h2>
          <p className="mt-3">
            By accessing or using the FuzzyCat platform at fuzzycatapp.com (&quot;Service&quot;),
            you agree to be bound by these Terms of Service (&quot;Terms&quot;). If you do not agree
            to these Terms, do not use the Service. These Terms constitute a legally binding
            agreement between you and FuzzyCat Inc. (&quot;FuzzyCat,&quot; &quot;we,&quot;
            &quot;us,&quot; or &quot;our&quot;).
          </p>
        </section>

        {/* 2 */}
        <section>
          <h2 className="text-xl font-semibold text-foreground">2. Service Description</h2>
          <p className="mt-3">
            FuzzyCat is a payment facilitation platform that enables pet owners to pay veterinary
            bills in biweekly installments over 12 weeks. FuzzyCat is not a lender. We do not extend
            credit, charge interest, or perform credit checks. We facilitate the scheduling and
            processing of payments between pet owners and veterinary clinics using third-party
            payment processors.
          </p>
          <p className="mt-3">
            <strong className="text-foreground">Regulatory disclaimer:</strong> The Service is not a
            loan, credit product, or financing arrangement under the Truth in Lending Act (TILA),
            the Equal Credit Opportunity Act (ECOA), or equivalent state consumer lending laws. No
            credit check is performed, no credit is extended, and no interest is charged. The
            platform fee described in Section 4 is a service fee for payment facilitation, not a
            finance charge.
          </p>
        </section>

        {/* 3 */}
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

        {/* 4 */}
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
              <strong className="text-foreground">Platform fee:</strong> A flat 8% platform fee is
              added to your bill amount. This fee is disclosed before you confirm enrollment and is
              included in your total payment amount. This is the only cost — there is no interest,
              no annual percentage rate, and no additional charges.
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

        {/* 5 */}
        <section>
          <h2 className="text-xl font-semibold text-foreground">5. ACH Debit Authorization</h2>
          <p className="mt-3">
            By enrolling in a payment plan, you authorize FuzzyCat and its payment processor, Stripe
            Inc., to initiate recurring Automated Clearing House (ACH) debit entries from the bank
            account you designate during enrollment. This authorization covers:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-6">
            <li>
              Six (6) scheduled biweekly installment payments in the amounts disclosed at
              enrollment.
            </li>
            <li>
              Up to three (3) retry attempts for any failed installment, as described in Section 6.
            </li>
          </ul>
          <p className="mt-3">
            This authorization remains in effect until your payment plan is completed, cancelled, or
            defaulted. You may revoke this authorization at any time by contacting us at{' '}
            <a href="mailto:support@fuzzycatapp.com" className="text-primary hover:underline">
              support@fuzzycatapp.com
            </a>
            . Revocation must be received at least three (3) business days before the next scheduled
            debit. Revoking ACH authorization does not cancel your payment plan obligations — see
            Section 8 for cancellation terms.
          </p>
          <p className="mt-3">
            If you believe an ACH debit was initiated in error, you have the right to dispute the
            transaction with your bank under NACHA operating rules and Regulation E. You may also
            contact us directly to resolve the issue.
          </p>
        </section>

        {/* 6 */}
        <section>
          <h2 className="text-xl font-semibold text-foreground">6. Failed Payments and Default</h2>
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

        {/* 7 */}
        <section>
          <h2 className="text-xl font-semibold text-foreground">7. Veterinary Clinic Terms</h2>
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
            <li>
              By connecting your Stripe account, you also agree to the{' '}
              <a
                href="https://stripe.com/connect-account/legal"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Stripe Connected Account Agreement
              </a>
              , which governs your relationship with Stripe for payment processing and payouts.
            </li>
          </ul>
        </section>

        {/* 8 */}
        <section>
          <h2 className="text-xl font-semibold text-foreground">
            8. Cancellation and Refund Policy
          </h2>
          <p className="mt-3">
            <strong className="text-foreground">Before the first installment is processed:</strong>{' '}
            You may cancel your payment plan by contacting us. Your deposit will be refunded minus
            any applicable Stripe processing fees.
          </p>
          <p className="mt-3">
            <strong className="text-foreground">After installments have begun:</strong> You may
            request to cancel your plan. Any payments already made (including the deposit and
            completed installments) are non-refundable, as those funds have already been transferred
            to your veterinary clinic. The remaining unpaid balance becomes immediately due to the
            clinic. FuzzyCat will cease further ACH debits from your account, and the clinic will be
            notified of the cancellation with the outstanding balance.
          </p>
          <p className="mt-3">
            <strong className="text-foreground">Clinic-initiated cancellation:</strong> If a
            veterinary clinic cancels a plan (for example, due to a refund, treatment change, or
            billing error), FuzzyCat will stop future debits and work with the clinic to process any
            applicable refunds.
          </p>
          <p className="mt-3">
            To request cancellation, contact us at{' '}
            <a href="mailto:support@fuzzycatapp.com" className="text-primary hover:underline">
              support@fuzzycatapp.com
            </a>
            .
          </p>
        </section>

        {/* 9 */}
        <section>
          <h2 className="text-xl font-semibold text-foreground">
            9. Electronic Communications Consent
          </h2>
          <p className="mt-3">
            By creating an account or enrolling in a payment plan, you consent to receive electronic
            communications from FuzzyCat, including:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-6">
            <li>Payment confirmations, receipts, and schedule reminders.</li>
            <li>Failed payment notifications and collection reminders.</li>
            <li>Account security alerts and password reset emails.</li>
            <li>Service updates, policy changes, and legal notices.</li>
          </ul>
          <p className="mt-3">
            You agree that these electronic communications satisfy any legal requirement that such
            communications be in writing, in accordance with the Electronic Signatures in Global and
            National Commerce Act (E-SIGN Act, 15 U.S.C. 7001 et seq.) and applicable state
            electronic transaction laws. Communications will be sent via email and/or SMS to the
            contact information you provide. You may update your contact information in your account
            settings at any time. You may withdraw consent to non-essential communications by
            contacting us, but transactional communications related to active payment plans cannot
            be opted out of while the plan remains active.
          </p>
        </section>

        {/* 10 */}
        <section>
          <h2 className="text-xl font-semibold text-foreground">
            10. Third-Party Payment Processing
          </h2>
          <p className="mt-3">
            Payment processing on FuzzyCat is provided by Stripe Inc. By using our Service, you
            agree to be bound by Stripe&apos;s{' '}
            <a
              href="https://stripe.com/legal"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Terms of Service
            </a>{' '}
            and{' '}
            <a
              href="https://stripe.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Privacy Policy
            </a>{' '}
            as they apply to the processing of your payments. FuzzyCat is not responsible for
            Stripe&apos;s actions, errors, or omissions.
          </p>
        </section>

        {/* 11 */}
        <section>
          <h2 className="text-xl font-semibold text-foreground">11. Account Responsibilities</h2>
          <p className="mt-3">
            You are responsible for maintaining the confidentiality of your account credentials and
            for all activities that occur under your account. You agree to notify us immediately of
            any unauthorized use of your account. You must provide accurate information and keep it
            up to date.
          </p>
        </section>

        {/* 12 */}
        <section>
          <h2 className="text-xl font-semibold text-foreground">12. Prohibited Uses</h2>
          <p className="mt-3">You agree not to:</p>
          <ul className="mt-3 list-disc space-y-2 pl-6">
            <li>Use the Service for any unlawful purpose or in violation of these Terms.</li>
            <li>Provide false or misleading information during registration or enrollment.</li>
            <li>
              Attempt to interfere with, compromise, or disrupt the Service or its infrastructure.
            </li>
            <li>Use the Service on behalf of a third party without proper authorization.</li>
            <li>Reverse-engineer, decompile, or disassemble any part of the Service.</li>
            <li>
              Use any automated system, including bots, scrapers, or scripts, to access the Service
              in a manner that sends more requests than a human could reasonably produce.
            </li>
          </ul>
        </section>

        {/* 13 */}
        <section>
          <h2 className="text-xl font-semibold text-foreground">13. API Terms of Use</h2>
          <p className="mt-3">
            If you access the FuzzyCat REST API (available to registered veterinary clinics), the
            following additional terms apply:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-6">
            <li>
              API access is granted via API keys generated from your clinic dashboard. You are
              responsible for securing your API keys and must not share them with unauthorized
              parties.
            </li>
            <li>
              API usage is subject to rate limits as documented in the API reference. Excessive or
              abusive API usage may result in temporary or permanent suspension of access.
            </li>
            <li>
              Data retrieved via the API remains subject to these Terms and our Privacy Policy. You
              may not use API data for purposes outside your legitimate clinic operations.
            </li>
            <li>
              FuzzyCat reserves the right to modify, deprecate, or discontinue API endpoints with
              reasonable notice. We will provide at least 30 days&apos; notice before removing
              existing endpoints.
            </li>
          </ul>
        </section>

        {/* 14 */}
        <section>
          <h2 className="text-xl font-semibold text-foreground">14. Intellectual Property</h2>
          <p className="mt-3">
            The FuzzyCat name, logo, and all content, features, and functionality of the Service are
            owned by FuzzyCat and are protected by copyright, trademark, and other intellectual
            property laws. You may not reproduce, distribute, or create derivative works from any
            part of the Service without our prior written consent.
          </p>
        </section>

        {/* 15 */}
        <section>
          <h2 className="text-xl font-semibold text-foreground">15. Indemnification</h2>
          <p className="mt-3">
            You agree to indemnify, defend, and hold harmless FuzzyCat, its officers, directors,
            employees, and agents from and against any claims, liabilities, damages, losses, costs,
            or expenses (including reasonable attorneys&apos; fees) arising from: (a) your use of
            the Service; (b) your violation of these Terms; (c) your violation of any rights of a
            third party; or (d) any content or information you provide through the Service.
          </p>
        </section>

        {/* 16 */}
        <section>
          <h2 className="text-xl font-semibold text-foreground">16. Limitation of Liability</h2>
          <p className="mt-3">
            To the maximum extent permitted by applicable law, FuzzyCat shall not be liable for any
            indirect, incidental, special, consequential, or punitive damages, including but not
            limited to loss of profits, data, or business opportunities, arising from your use of
            the Service. Our total liability for any claim arising from or related to the Service
            shall not exceed the total platform fees you have paid to FuzzyCat in the 12 months
            preceding the claim.
          </p>
        </section>

        {/* 17 */}
        <section>
          <h2 className="text-xl font-semibold text-foreground">17. Disclaimer of Warranties</h2>
          <p className="mt-3">
            The Service is provided &quot;as is&quot; and &quot;as available&quot; without
            warranties of any kind, either express or implied, including but not limited to implied
            warranties of merchantability, fitness for a particular purpose, and non-infringement.
            We do not warrant that the Service will be uninterrupted, error-free, or secure. We do
            not guarantee payment between pet owners and clinics.
          </p>
        </section>

        {/* 18 */}
        <section>
          <h2 className="text-xl font-semibold text-foreground">
            18. Dispute Resolution and Arbitration
          </h2>
          <p className="mt-3">
            <strong className="text-foreground">Informal resolution:</strong> Before filing any
            formal dispute, you agree to contact us at{' '}
            <a href="mailto:legal@fuzzycatapp.com" className="text-primary hover:underline">
              legal@fuzzycatapp.com
            </a>{' '}
            and attempt to resolve the dispute informally for at least 30 days.
          </p>
          <p className="mt-3">
            <strong className="text-foreground">Binding arbitration:</strong> If informal resolution
            fails, any dispute arising from or relating to these Terms or the Service shall be
            resolved by binding arbitration administered by the American Arbitration Association
            (AAA) under its Consumer Arbitration Rules. Arbitration will take place in San Francisco
            County, California, or at another mutually agreed location. The arbitrator&apos;s
            decision shall be final and binding and may be entered as a judgment in any court of
            competent jurisdiction.
          </p>
          <p className="mt-3">
            <strong className="text-foreground">Class action waiver:</strong> You agree that any
            dispute resolution proceedings will be conducted only on an individual basis and not in
            a class, consolidated, or representative action. If for any reason a claim proceeds in
            court rather than arbitration, you waive any right to a jury trial.
          </p>
          <p className="mt-3">
            <strong className="text-foreground">Exceptions:</strong> Either party may bring claims
            in small claims court if eligible. Nothing in this section prevents either party from
            seeking injunctive or equitable relief in court to prevent the actual or threatened
            infringement of intellectual property rights.
          </p>
        </section>

        {/* 19 */}
        <section>
          <h2 className="text-xl font-semibold text-foreground">19. Governing Law</h2>
          <p className="mt-3">
            These Terms shall be governed by and construed in accordance with the laws of the State
            of California, without regard to its conflict of law provisions. To the extent any
            dispute is not subject to arbitration under Section 18, the exclusive venue shall be the
            state or federal courts located in San Francisco County, California.
          </p>
        </section>

        {/* 20 */}
        <section>
          <h2 className="text-xl font-semibold text-foreground">20. Changes to These Terms</h2>
          <p className="mt-3">
            We reserve the right to modify these Terms at any time. We will notify you of material
            changes by posting the updated Terms on this page, updating the &quot;Last updated&quot;
            date, and sending a notification to the email address associated with your account. Your
            continued use of the Service after changes are posted constitutes acceptance of the
            revised Terms. If you do not agree to the updated Terms, you must stop using the
            Service.
          </p>
        </section>

        {/* 21 */}
        <section>
          <h2 className="text-xl font-semibold text-foreground">21. Termination</h2>
          <p className="mt-3">
            We may suspend or terminate your access to the Service at any time for violation of
            these Terms or for any other reason at our discretion. Upon termination, any outstanding
            payment obligations remain in effect. You may close your account at any time by
            contacting us, though this does not relieve you of any existing payment plan
            obligations.
          </p>
        </section>

        {/* 22 */}
        <section>
          <h2 className="text-xl font-semibold text-foreground">22. General Provisions</h2>
          <ul className="mt-3 list-disc space-y-2 pl-6">
            <li>
              <strong className="text-foreground">Entire agreement:</strong> These Terms, together
              with our Privacy Policy, constitute the entire agreement between you and FuzzyCat
              regarding your use of the Service and supersede any prior agreements.
            </li>
            <li>
              <strong className="text-foreground">Severability:</strong> If any provision of these
              Terms is found to be unenforceable or invalid by a court of competent jurisdiction,
              the remaining provisions shall continue in full force and effect.
            </li>
            <li>
              <strong className="text-foreground">Waiver:</strong> Our failure to enforce any right
              or provision of these Terms shall not constitute a waiver of that right or provision.
            </li>
            <li>
              <strong className="text-foreground">Assignment:</strong> You may not assign or
              transfer these Terms or your rights under them without our prior written consent. We
              may assign our rights and obligations under these Terms without restriction, including
              in connection with a merger, acquisition, or sale of assets.
            </li>
            <li>
              <strong className="text-foreground">Force majeure:</strong> FuzzyCat shall not be
              liable for any failure or delay in performance resulting from causes beyond our
              reasonable control, including but not limited to natural disasters, acts of
              government, internet or power outages, or third-party service provider failures.
            </li>
          </ul>
        </section>

        {/* 23 */}
        <section>
          <h2 className="text-xl font-semibold text-foreground">23. Contact Us</h2>
          <p className="mt-3">If you have questions about these Terms, contact us at:</p>
          <p className="mt-3">
            <strong className="text-foreground">FuzzyCat Inc.</strong>
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
