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
      <p className="mt-3 text-sm text-muted-foreground">Last updated: February 1, 2026</p>

      <Separator className="my-8" />

      <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="text-xl font-semibold text-foreground">1. Introduction</h2>
          <p className="mt-3">
            FuzzyCat (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) operates the FuzzyCat
            payment facilitation platform at fuzzycatapp.com. This Privacy Policy explains how we
            collect, use, disclose, and safeguard your personal information when you use our website
            and services. By using FuzzyCat, you consent to the practices described in this policy.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">2. Information We Collect</h2>
          <p className="mt-3">We collect the following categories of information:</p>
          <ul className="mt-3 list-disc space-y-2 pl-6">
            <li>
              <strong className="text-foreground">Account information:</strong> Name, email address,
              phone number, and role (pet owner or veterinary clinic) provided during registration.
            </li>
            <li>
              <strong className="text-foreground">Financial information:</strong> We use Stripe to
              process debit card payments and ACH transfers, and Plaid to verify bank account
              ownership. FuzzyCat does not store your card numbers, bank account numbers, or routing
              numbers on our servers. All payment credentials are handled directly by Stripe and
              Plaid in compliance with PCI DSS standards.
            </li>
            <li>
              <strong className="text-foreground">Payment plan data:</strong> Bill amounts, payment
              schedules, payment statuses, and transaction history associated with your plans.
            </li>
            <li>
              <strong className="text-foreground">Usage data:</strong> Pages visited, features used,
              browser type, device type, IP address, and referring URLs collected automatically
              through cookies and analytics tools.
            </li>
            <li>
              <strong className="text-foreground">Communications:</strong> Records of support
              inquiries, emails, and any other correspondence with us.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">3. How We Use Your Information</h2>
          <p className="mt-3">We use the information we collect to:</p>
          <ul className="mt-3 list-disc space-y-2 pl-6">
            <li>Create and manage your account and payment plans.</li>
            <li>Process payments, including deposits and biweekly installments.</li>
            <li>
              Verify your bank account through Plaid to ensure you can make scheduled payments.
            </li>
            <li>
              Send payment confirmations, reminders, and notifications about your plan status.
            </li>
            <li>Facilitate clinic payouts via Stripe Connect.</li>
            <li>Respond to support requests and communicate with you about our services.</li>
            <li>
              Improve our platform, analyze usage patterns, and monitor performance using tools such
              as PostHog and Sentry.
            </li>
            <li>Comply with legal obligations and prevent fraud.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">
            4. How We Share Your Information
          </h2>
          <p className="mt-3">
            We do not sell your personal information. We share information only in the following
            circumstances:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-6">
            <li>
              <strong className="text-foreground">Payment processors:</strong> Stripe processes your
              payments and receives the data necessary to complete transactions. Plaid verifies your
              bank account ownership.
            </li>
            <li>
              <strong className="text-foreground">Veterinary clinics:</strong> If you are a pet
              owner, we share your name, plan status, and payment progress with the veterinary
              clinic associated with your plan so they can track receivables.
            </li>
            <li>
              <strong className="text-foreground">Service providers:</strong> We use Supabase for
              authentication and data storage, Resend for transactional email, Twilio for SMS
              notifications, and Vercel for hosting. These providers process data on our behalf
              under contractual obligations.
            </li>
            <li>
              <strong className="text-foreground">Legal requirements:</strong> We may disclose
              information if required by law, regulation, legal process, or governmental request.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">5. Data Security</h2>
          <p className="mt-3">
            We implement industry-standard security measures to protect your information. All data
            transmitted between your browser and our servers is encrypted using TLS. Sensitive
            financial data is handled exclusively by PCI-compliant third parties (Stripe and Plaid)
            and is never stored on our servers. We use Supabase Auth with role-based access controls
            and enforce Content Security Policy headers to prevent cross-site scripting attacks.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">6. Cookies and Analytics</h2>
          <p className="mt-3">
            We use cookies and similar technologies to maintain your session, remember your
            preferences, and analyze how our platform is used. We use PostHog for product analytics
            and Sentry for error monitoring. You can control cookie settings through your browser
            preferences, though disabling cookies may affect the functionality of our platform.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">7. Data Retention</h2>
          <p className="mt-3">
            We retain your personal information for as long as your account is active or as needed
            to provide services, comply with legal obligations, resolve disputes, and enforce our
            agreements. Payment plan records and audit logs are retained for a minimum of seven
            years to comply with financial record-keeping requirements.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">8. Your Rights</h2>
          <p className="mt-3">Depending on your jurisdiction, you may have the right to:</p>
          <ul className="mt-3 list-disc space-y-2 pl-6">
            <li>Access the personal information we hold about you.</li>
            <li>Request correction of inaccurate information.</li>
            <li>
              Request deletion of your personal information, subject to legal retention
              requirements.
            </li>
            <li>Opt out of marketing communications at any time.</li>
            <li>Request a copy of your data in a portable format.</li>
          </ul>
          <p className="mt-3">
            To exercise any of these rights, contact us at{' '}
            <a href="mailto:privacy@fuzzycatapp.com" className="text-primary hover:underline">
              privacy@fuzzycatapp.com
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">9. Children&apos;s Privacy</h2>
          <p className="mt-3">
            FuzzyCat is not intended for use by individuals under the age of 18. We do not knowingly
            collect personal information from children. If we become aware that we have collected
            information from a minor, we will take steps to delete it promptly.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">10. Changes to This Policy</h2>
          <p className="mt-3">
            We may update this Privacy Policy from time to time. We will notify you of material
            changes by posting the updated policy on this page and updating the &quot;Last
            updated&quot; date. Your continued use of FuzzyCat after changes are posted constitutes
            acceptance of the revised policy.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">11. Contact Us</h2>
          <p className="mt-3">
            If you have questions about this Privacy Policy or our data practices, contact us at:
          </p>
          <p className="mt-3">
            <strong className="text-foreground">FuzzyCat</strong>
            <br />
            Email:{' '}
            <a href="mailto:privacy@fuzzycatapp.com" className="text-primary hover:underline">
              privacy@fuzzycatapp.com
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
