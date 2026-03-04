import type { Metadata } from 'next';
import { Separator } from '@/components/ui/separator';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'FuzzyCat Privacy Policy. Learn how we collect, use, and protect your personal information.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-4xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="mt-3 text-sm text-muted-foreground">Last updated: March 3, 2026</p>

      <Separator className="my-8" />

      <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8 text-sm leading-relaxed text-muted-foreground">
        {/* 1 */}
        <section>
          <h2 className="text-xl font-semibold text-foreground">1. Introduction</h2>
          <p className="mt-3">
            FuzzyCat Inc. (&quot;FuzzyCat,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;)
            operates the FuzzyCat payment facilitation platform at fuzzycatapp.com. This Privacy
            Policy explains how we collect, use, disclose, and safeguard your personal information
            when you use our website and services (&quot;Service&quot;). By using FuzzyCat, you
            consent to the practices described in this policy.
          </p>
          <p className="mt-3">
            This policy applies to all users of the Service, including clients, veterinary clinics,
            and administrators.
          </p>
        </section>

        {/* 2 */}
        <section>
          <h2 className="text-xl font-semibold text-foreground">2. Information We Collect</h2>
          <p className="mt-3">We collect the following categories of information:</p>

          <h3 className="mt-4 text-base font-semibold text-foreground">
            2.1 Information You Provide
          </h3>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>
              <strong className="text-foreground">Account information:</strong> Name, email address,
              phone number, and role (client or veterinary clinic) provided during registration.
            </li>
            <li>
              <strong className="text-foreground">Clinic information:</strong> Clinic name, state,
              ZIP code, and Stripe Connect account details for clinics.
            </li>
            <li>
              <strong className="text-foreground">Pet information:</strong> Pet name provided during
              registration.
            </li>
            <li>
              <strong className="text-foreground">Payment plan data:</strong> Veterinary bill
              amounts, payment schedules, payment statuses, and transaction history.
            </li>
            <li>
              <strong className="text-foreground">Communications:</strong> Records of support
              inquiries, feedback submissions, and any correspondence with us.
            </li>
          </ul>

          <h3 className="mt-4 text-base font-semibold text-foreground">
            2.2 Information Collected Through Payment Processors
          </h3>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>
              <strong className="text-foreground">Financial information:</strong> We use Stripe to
              process debit card payments and ACH transfers. FuzzyCat does not store your card
              numbers, bank account numbers, or routing numbers on our servers. All payment
              credentials are handled directly by Stripe in compliance with PCI DSS Level 1
              standards. We receive only tokenized references, transaction statuses, and the last
              four digits of your payment method for display purposes.
            </li>
          </ul>

          <h3 className="mt-4 text-base font-semibold text-foreground">
            2.3 Information Collected Automatically
          </h3>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>
              <strong className="text-foreground">Usage data:</strong> Pages visited, features used,
              clickstream data, browser type, device type, operating system, IP address, and
              referring URLs.
            </li>
            <li>
              <strong className="text-foreground">Performance data:</strong> Page load times,
              errors, and application performance metrics.
            </li>
            <li>
              <strong className="text-foreground">Bot detection data:</strong> Browser signals and
              interaction patterns collected by Cloudflare Turnstile during account registration to
              prevent automated abuse. This data is processed by Cloudflare and is not stored by
              FuzzyCat.
            </li>
          </ul>
        </section>

        {/* 3 */}
        <section>
          <h2 className="text-xl font-semibold text-foreground">3. How We Use Your Information</h2>
          <p className="mt-3">We use the information we collect to:</p>
          <ul className="mt-3 list-disc space-y-2 pl-6">
            <li>Create and manage your account and payment plans.</li>
            <li>Process payments, including deposits and biweekly installments via Stripe.</li>
            <li>
              Send payment confirmations, reminders, and notifications about your plan status via
              email (Resend) and SMS (Twilio).
            </li>
            <li>Facilitate clinic payouts via Stripe Connect.</li>
            <li>Respond to support requests and communicate with you about our services.</li>
            <li>Improve our platform and analyze usage patterns.</li>
            <li>Monitor application health, detect errors, and debug issues.</li>
            <li>Prevent fraud, unauthorized access, and automated abuse.</li>
            <li>Comply with legal obligations and enforce our Terms of Service.</li>
          </ul>
        </section>

        {/* 4 */}
        <section>
          <h2 className="text-xl font-semibold text-foreground">
            4. How We Share Your Information
          </h2>
          <p className="mt-3">
            <strong className="text-foreground">We do not sell your personal information.</strong>{' '}
            We have not sold personal information in the preceding 12 months and have no plans to do
            so. We share information only in the following circumstances:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-6">
            <li>
              <strong className="text-foreground">Stripe (payment processing):</strong> Stripe
              processes your debit card deposits, ACH installments, and clinic payouts. Stripe
              receives the data necessary to complete these transactions. See{' '}
              <a
                href="https://stripe.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Stripe&apos;s Privacy Policy
              </a>
              .
            </li>
            <li>
              <strong className="text-foreground">Veterinary clinics:</strong> If you are a pet
              owner, we share your name, plan status, and payment progress with the veterinary
              clinic associated with your plan so they can track receivables.
            </li>
            <li>
              <strong className="text-foreground">Service providers:</strong> We use the following
              providers who process data on our behalf under contractual obligations:
              <ul className="mt-2 list-disc space-y-1 pl-6">
                <li>
                  <strong className="text-foreground">Supabase</strong> — Authentication and
                  database hosting (United States)
                </li>
                <li>
                  <strong className="text-foreground">Vercel</strong> — Application hosting, edge
                  functions, and web analytics (United States)
                </li>
                <li>
                  <strong className="text-foreground">Resend</strong> — Transactional email delivery
                </li>
                <li>
                  <strong className="text-foreground">Twilio</strong> — SMS notifications
                </li>
                <li>
                  <strong className="text-foreground">PostHog</strong> — Product analytics (United
                  States)
                </li>
                <li>
                  <strong className="text-foreground">Sentry</strong> — Error monitoring and
                  performance tracking
                </li>
                <li>
                  <strong className="text-foreground">Cloudflare</strong> — Bot detection via
                  Turnstile during registration
                </li>
              </ul>
            </li>
            <li>
              <strong className="text-foreground">Legal requirements:</strong> We may disclose
              information if required by law, regulation, legal process, or governmental request, or
              to protect the rights, property, or safety of FuzzyCat, our users, or others.
            </li>
            <li>
              <strong className="text-foreground">Business transfers:</strong> In the event of a
              merger, acquisition, or sale of all or a portion of our assets, your personal
              information may be transferred as part of that transaction. We will notify you via
              email and/or a prominent notice on our website before your information becomes subject
              to a different privacy policy.
            </li>
          </ul>
        </section>

        {/* 5 */}
        <section>
          <h2 className="text-xl font-semibold text-foreground">5. Data Security</h2>
          <p className="mt-3">
            We implement industry-standard security measures to protect your information:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-6">
            <li>
              All data transmitted between your browser and our servers is encrypted using TLS
              (HTTPS enforced).
            </li>
            <li>
              Sensitive financial data is handled exclusively by PCI DSS Level 1 compliant
              processors (Stripe) and is never stored on our servers.
            </li>
            <li>
              Authentication is managed by Supabase Auth with role-based access controls and
              optional multi-factor authentication (MFA).
            </li>
            <li>
              We enforce Content Security Policy (CSP) headers, HTTP Strict Transport Security
              (HSTS), and other browser security headers to prevent common web attacks.
            </li>
            <li>API access uses SHA-256 hashed keys with granular permission scopes.</li>
            <li>All payment state changes are recorded in an immutable audit log.</li>
          </ul>
          <p className="mt-3">
            While we strive to protect your personal information, no method of transmission over the
            Internet or electronic storage is 100% secure. We cannot guarantee absolute security.
          </p>
        </section>

        {/* 6 */}
        <section>
          <h2 className="text-xl font-semibold text-foreground">
            6. Cookies, Analytics, and Tracking
          </h2>
          <p className="mt-3">
            We use cookies and similar technologies to maintain your session, remember your
            preferences, and understand how our platform is used. Below is a summary of the tracking
            technologies we employ:
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="pb-2 pr-4 font-semibold text-foreground">Technology</th>
                  <th className="pb-2 pr-4 font-semibold text-foreground">Purpose</th>
                  <th className="pb-2 font-semibold text-foreground">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr>
                  <td className="py-2 pr-4">Supabase Auth cookies</td>
                  <td className="py-2 pr-4">Session management and authentication</td>
                  <td className="py-2">Essential (session)</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Theme preference</td>
                  <td className="py-2 pr-4">Remembering light/dark mode selection</td>
                  <td className="py-2">Functional (persistent)</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">PostHog</td>
                  <td className="py-2 pr-4">
                    Product analytics, feature usage, and funnel analysis
                  </td>
                  <td className="py-2">Analytics</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Sentry</td>
                  <td className="py-2 pr-4">Error monitoring and performance tracking</td>
                  <td className="py-2">Analytics</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Vercel Analytics</td>
                  <td className="py-2 pr-4">Page view tracking and audience insights</td>
                  <td className="py-2">Analytics</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Vercel Speed Insights</td>
                  <td className="py-2 pr-4">Core Web Vitals and page performance</td>
                  <td className="py-2">Analytics</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="mt-4">
            You can control cookie settings through your browser preferences, though disabling
            essential cookies may prevent you from logging in. PostHog respects the{' '}
            <code className="rounded bg-muted px-1.5 py-0.5">Do Not Track</code> browser signal. To
            opt out of PostHog analytics specifically, you can enable Do Not Track in your browser
            settings.
          </p>
        </section>

        {/* 7 */}
        <section>
          <h2 className="text-xl font-semibold text-foreground">7. Data Retention</h2>
          <p className="mt-3">
            We retain your personal information for as long as your account is active or as needed
            to provide services, comply with legal obligations, resolve disputes, and enforce our
            agreements. Specific retention periods:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-6">
            <li>
              <strong className="text-foreground">Payment records and audit logs:</strong> Minimum
              seven (7) years, in compliance with IRS record-keeping requirements and applicable
              financial regulations.
            </li>
            <li>
              <strong className="text-foreground">Account information:</strong> Retained while your
              account is active and for up to two (2) years after account closure.
            </li>
            <li>
              <strong className="text-foreground">Analytics data:</strong> Aggregated and
              de-identified analytics data may be retained indefinitely.
            </li>
          </ul>
          <p className="mt-3">
            When data is no longer needed, it is securely deleted or anonymized.
          </p>
        </section>

        {/* 8 */}
        <section>
          <h2 className="text-xl font-semibold text-foreground">8. Your Privacy Rights</h2>
          <p className="mt-3">
            Depending on your jurisdiction, you may have the following rights regarding your
            personal information:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-6">
            <li>
              <strong className="text-foreground">Right to know:</strong> Request information about
              the categories and specific pieces of personal information we have collected about
              you.
            </li>
            <li>
              <strong className="text-foreground">Right to access:</strong> Obtain a copy of the
              personal information we hold about you in a portable format.
            </li>
            <li>
              <strong className="text-foreground">Right to correction:</strong> Request correction
              of inaccurate personal information.
            </li>
            <li>
              <strong className="text-foreground">Right to deletion:</strong> Request deletion of
              your personal information, subject to legal retention requirements (such as the 7-year
              financial record retention described in Section 7).
            </li>
            <li>
              <strong className="text-foreground">Right to opt out:</strong> Opt out of marketing
              communications at any time. Note that transactional communications related to active
              payment plans cannot be opted out of.
            </li>
          </ul>
          <p className="mt-3">
            To exercise any of these rights, contact us at{' '}
            <a href="mailto:privacy@fuzzycatapp.com" className="text-primary hover:underline">
              privacy@fuzzycatapp.com
            </a>
            . We will respond to verifiable requests within 45 days. We will not discriminate
            against you for exercising your privacy rights.
          </p>
        </section>

        {/* 9 */}
        <section>
          <h2 className="text-xl font-semibold text-foreground">
            9. California Privacy Rights (CCPA/CPRA)
          </h2>
          <p className="mt-3">
            If you are a California resident, the California Consumer Privacy Act (CCPA), as amended
            by the California Privacy Rights Act (CPRA), provides you with additional rights:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-6">
            <li>
              <strong className="text-foreground">
                Categories of personal information collected:
              </strong>{' '}
              Identifiers (name, email, phone), financial information (transaction history, payment
              statuses — not raw account numbers), internet/electronic activity (usage data, IP
              addresses), and professional information (clinic name, business details for clinic
              accounts).
            </li>
            <li>
              <strong className="text-foreground">Sale of personal information:</strong> We do not
              sell your personal information and have not done so in the preceding 12 months.
            </li>
            <li>
              <strong className="text-foreground">
                Sharing for cross-context behavioral advertising:
              </strong>{' '}
              We do not share your personal information for cross-context behavioral advertising
              purposes.
            </li>
            <li>
              <strong className="text-foreground">
                Right to limit use of sensitive personal information:
              </strong>{' '}
              We only use sensitive personal information (financial data) as necessary to provide
              the Service, and not for profiling or advertising purposes.
            </li>
            <li>
              <strong className="text-foreground">Non-discrimination:</strong> We will not
              discriminate against you for exercising any of your CCPA/CPRA rights, including by
              denying you services, charging different prices, or providing a different quality of
              service.
            </li>
          </ul>
          <p className="mt-3">
            To exercise your California privacy rights, contact us at{' '}
            <a href="mailto:privacy@fuzzycatapp.com" className="text-primary hover:underline">
              privacy@fuzzycatapp.com
            </a>{' '}
            or use the subject line &quot;CCPA Request.&quot;
          </p>
        </section>

        {/* 10 */}
        <section>
          <h2 className="text-xl font-semibold text-foreground">
            10. Do Not Sell My Personal Information
          </h2>
          <p className="mt-3">
            FuzzyCat does not sell your personal information to third parties. We do not exchange
            personal information for monetary or other valuable consideration. If our practices
            change in the future, we will update this policy, provide notice, and offer you the
            right to opt out before any sale occurs.
          </p>
        </section>

        {/* 11 */}
        <section>
          <h2 className="text-xl font-semibold text-foreground">11. Data Breach Notification</h2>
          <p className="mt-3">
            In the event of a data breach that compromises your personal information, we will:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-6">
            <li>
              Notify affected users via email as soon as reasonably practicable and no later than as
              required by applicable law (within 72 hours of discovery where required by state law).
            </li>
            <li>
              Provide details about the nature of the breach, the types of information affected, and
              the steps we are taking to address it.
            </li>
            <li>Notify applicable regulatory authorities as required by law.</li>
            <li>
              Offer guidance on steps you can take to protect yourself, such as changing passwords
              or monitoring account activity.
            </li>
          </ul>
        </section>

        {/* 12 */}
        <section>
          <h2 className="text-xl font-semibold text-foreground">12. Data Processing Location</h2>
          <p className="mt-3">
            All data is processed and stored in the United States. Our primary infrastructure is
            hosted on Vercel (US regions) with database services provided by Supabase (US data
            centers). If you access the Service from outside the United States, your information
            will be transferred to and processed in the United States, which may have different data
            protection laws than your jurisdiction.
          </p>
        </section>

        {/* 13 */}
        <section>
          <h2 className="text-xl font-semibold text-foreground">13. Children&apos;s Privacy</h2>
          <p className="mt-3">
            FuzzyCat is not intended for use by individuals under the age of 18. We do not knowingly
            collect personal information from children. If we become aware that we have collected
            information from a minor, we will take steps to delete it promptly. If you believe a
            child has provided us with personal information, contact us at{' '}
            <a href="mailto:privacy@fuzzycatapp.com" className="text-primary hover:underline">
              privacy@fuzzycatapp.com
            </a>
            .
          </p>
        </section>

        {/* 14 */}
        <section>
          <h2 className="text-xl font-semibold text-foreground">14. Changes to This Policy</h2>
          <p className="mt-3">
            We may update this Privacy Policy from time to time. We will notify you of material
            changes by posting the updated policy on this page, updating the &quot;Last
            updated&quot; date, and sending a notification to the email address associated with your
            account. Your continued use of FuzzyCat after changes are posted constitutes acceptance
            of the revised policy. We encourage you to review this page periodically.
          </p>
        </section>

        {/* 15 */}
        <section>
          <h2 className="text-xl font-semibold text-foreground">15. Contact Us</h2>
          <p className="mt-3">
            If you have questions about this Privacy Policy, wish to exercise your privacy rights,
            or have concerns about our data practices, contact us at:
          </p>
          <p className="mt-3">
            <strong className="text-foreground">FuzzyCat Inc.</strong>
            <br />
            Email:{' '}
            <a href="mailto:privacy@fuzzycatapp.com" className="text-primary hover:underline">
              privacy@fuzzycatapp.com
            </a>
          </p>
          <p className="mt-3">
            For California privacy requests, you may also email us with the subject line &quot;CCPA
            Request&quot; at the address above.
          </p>
        </section>
      </div>
    </div>
  );
}
