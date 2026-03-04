import { HelpCircle, MessageCircle, PawPrint, Stethoscope } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { FEE_PERCENT } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Support',
  description:
    'Get help with your FuzzyCat payment plan. Find answers to common questions about payments, enrollment, clinic setup, and more.',
};

export default function SupportPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">Help &amp; Support</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Find answers to common questions below. If you need further help, use the feedback button
          in the bottom-right corner of the page.
        </p>
      </div>

      <Separator className="my-10" />

      {/* Client FAQ */}
      <section>
        <div className="flex items-center gap-2">
          <PawPrint className="h-5 w-5 text-primary" />
          <h2 className="text-2xl font-bold tracking-tight">For Clients</h2>
        </div>
        <div className="mt-6">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="how-payments-work">
              <AccordionTrigger>How do payment plans work?</AccordionTrigger>
              <AccordionContent>
                <p>
                  Your veterinary clinic enrolls you in a FuzzyCat payment plan. You pay a 25%
                  deposit upfront, and the remaining 75% is divided into 6 equal biweekly payments
                  over 12 weeks. A flat {FEE_PERCENT}% platform fee is included in your total
                  &mdash; there is no interest and no credit check required.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="deposit">
              <AccordionTrigger>How does the deposit work?</AccordionTrigger>
              <AccordionContent>
                <p>
                  The deposit is 25% of your total amount (bill + {FEE_PERCENT}% fee). It is charged
                  to your debit card at the time of enrollment. Once the deposit is processed, your
                  payment plan becomes active and your clinic is notified.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="payment-methods">
              <AccordionTrigger>What payment methods are accepted?</AccordionTrigger>
              <AccordionContent>
                <p>
                  Deposits are charged to your debit card. Installment payments are collected via
                  ACH direct debit from your bank account or charged to your debit card, depending
                  on your preference. Credit cards are not accepted. You can manage your payment
                  method from the Settings page in your owner portal.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="payment-schedule">
              <AccordionTrigger>When are my payments due?</AccordionTrigger>
              <AccordionContent>
                <p>
                  Payments are collected every two weeks starting after your deposit. Your full
                  payment schedule with exact dates is visible in your owner portal under each plan.
                  You will also receive email reminders before each payment.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="missed-payment">
              <AccordionTrigger>What happens if a payment fails?</AccordionTrigger>
              <AccordionContent>
                <p>
                  If a payment fails, we automatically retry up to 3 times, with retries aligned to
                  common paydays (the next Friday, 1st, or 15th that is at least 2 days out). You
                  will receive reminders via email at day 1, 7, and 14 after a missed payment. There
                  are no late fees. If all 3 retries fail, the plan is marked as defaulted and the
                  clinic is notified.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="cancel-plan">
              <AccordionTrigger>Can I cancel my payment plan?</AccordionTrigger>
              <AccordionContent>
                <p>
                  Payment plans cannot be cancelled once the deposit has been processed, as the
                  funds are forwarded to the veterinary clinic. If you are experiencing financial
                  difficulty, please contact your veterinary clinic directly to discuss possible
                  options.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="change-payment-method">
              <AccordionTrigger>Can I change my payment method?</AccordionTrigger>
              <AccordionContent>
                <p>
                  Yes. You can update your debit card or bank account at any time from the Settings
                  page in your owner portal. Your new payment method will be used for all future
                  installments.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="bill-range">
              <AccordionTrigger>Is there a minimum or maximum bill amount?</AccordionTrigger>
              <AccordionContent>
                <p>
                  FuzzyCat payment plans are available for veterinary bills between $500 and
                  $25,000. Bills outside this range are not eligible for enrollment.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="receipt">
              <AccordionTrigger>How do I get receipts for my payments?</AccordionTrigger>
              <AccordionContent>
                <p>
                  You receive an email confirmation after each successful payment. You can also view
                  your complete payment history from your owner portal at any time.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="multiple-plans">
              <AccordionTrigger>Can I have more than one payment plan?</AccordionTrigger>
              <AccordionContent>
                <p>
                  Yes. You can have multiple active payment plans at the same time if your clinic
                  enrolls you for additional treatments. Each plan has its own payment schedule and
                  is tracked independently.
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      <Separator className="my-10" />

      {/* Clinic FAQ */}
      <section>
        <div className="flex items-center gap-2">
          <Stethoscope className="h-5 w-5 text-primary" />
          <h2 className="text-2xl font-bold tracking-tight">For Veterinary Clinics</h2>
        </div>
        <div className="mt-6">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="clinic-signup">
              <AccordionTrigger>How does my clinic get started?</AccordionTrigger>
              <AccordionContent>
                <p>
                  Register at{' '}
                  <Link href="/signup/clinic" className="text-primary hover:underline">
                    fuzzycatapp.com/signup
                  </Link>{' '}
                  and complete Stripe Connect onboarding to receive payouts. There are no setup
                  fees, monthly fees, or contracts. You can start enrolling clients immediately.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="clinic-cost">
              <AccordionTrigger>What does FuzzyCat cost for clinics?</AccordionTrigger>
              <AccordionContent>
                <p>
                  Nothing. FuzzyCat is free for veterinary clinics. The {FEE_PERCENT}% platform fee
                  is paid entirely by the client. Clinics earn a 3% revenue share on every
                  enrollment as platform administration compensation.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="clinic-revenue-share">
              <AccordionTrigger>How does the 3% revenue share work?</AccordionTrigger>
              <AccordionContent>
                <p>
                  For each enrollment, the clinic receives a 3% share of the total bill as platform
                  administration compensation. This is paid out via Stripe Connect along with
                  regular payment transfers. You can track your revenue share in the Payouts section
                  of your clinic portal.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="clinic-payouts">
              <AccordionTrigger>When and how are clinics paid?</AccordionTrigger>
              <AccordionContent>
                <p>
                  After each successful installment payment from a client, the corresponding amount
                  (minus the FuzzyCat share) is transferred to your Stripe Connect account. Payouts
                  are automatic and you can track every transfer in the Payouts section of your
                  clinic portal.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="clinic-enrollment">
              <AccordionTrigger>How do I enroll a client?</AccordionTrigger>
              <AccordionContent>
                <p>
                  From your clinic portal, click &ldquo;Initiate Enrollment&rdquo; and fill in the
                  client and treatment details. You can search for existing clients to auto-fill
                  their information. The client will then receive instructions to complete their
                  deposit and activate the plan.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="clinic-default">
              <AccordionTrigger>What happens if a client defaults?</AccordionTrigger>
              <AccordionContent>
                <p>
                  FuzzyCat uses an automated soft collection process with escalating reminders. If
                  all payment retries fail, the plan is marked as defaulted and the clinic is
                  notified with the owner&apos;s contact information for direct follow-up. FuzzyCat
                  does not guarantee payment &mdash; clinics retain responsibility for collecting
                  from defaulting owners.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="clinic-api">
              <AccordionTrigger>
                Can I integrate FuzzyCat with my practice management software?
              </AccordionTrigger>
              <AccordionContent>
                <p>
                  Yes. FuzzyCat provides a REST API that your practice management software can
                  integrate with. You can generate API keys from the Settings page in your clinic
                  portal. Full API documentation is available at{' '}
                  <Link href="/api-docs" className="text-primary hover:underline">
                    fuzzycatapp.com/api-docs
                  </Link>
                  .
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="clinic-reports">
              <AccordionTrigger>What reporting is available?</AccordionTrigger>
              <AccordionContent>
                <p>
                  Your clinic portal includes a Reports section with monthly revenue breakdowns,
                  enrollment trends, and the ability to export data as CSV for your accounting
                  software. The Payouts section shows a complete record of every transfer to your
                  bank account.
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      <Separator className="my-10" />

      {/* General FAQ */}
      <section>
        <div className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-primary" />
          <h2 className="text-2xl font-bold tracking-tight">General</h2>
        </div>
        <div className="mt-6">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="what-is-fuzzycat">
              <AccordionTrigger>What is FuzzyCat?</AccordionTrigger>
              <AccordionContent>
                <p>
                  FuzzyCat is a payment plan platform for veterinary clinics. Pet owners split their
                  vet bill into a 25% deposit and 6 biweekly installments over 12 weeks. There is no
                  interest, no credit check, and no loan. Clinics earn a 3% revenue share on every
                  enrollment at zero cost.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="is-it-a-loan">
              <AccordionTrigger>Is FuzzyCat a loan?</AccordionTrigger>
              <AccordionContent>
                <p>
                  No. FuzzyCat is a payment facilitation platform, not a lender. There are no credit
                  checks, no interest charges, and no loan origination. The {FEE_PERCENT}% fee is a
                  flat platform fee, not interest.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="data-security">
              <AccordionTrigger>Is my financial information secure?</AccordionTrigger>
              <AccordionContent>
                <p>
                  Yes. FuzzyCat never stores card numbers, bank account numbers, or routing numbers.
                  All payment processing is handled by Stripe, which is PCI DSS Level 1 certified.
                  Bank account connections are secured through Stripe Financial Connections. Your
                  data is encrypted in transit and at rest.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="availability">
              <AccordionTrigger>Where is FuzzyCat available?</AccordionTrigger>
              <AccordionContent>
                <p>
                  FuzzyCat is currently available to veterinary clinics and clients in the United
                  States, with the exception of New York where we are awaiting regulatory
                  finalization. We plan to expand availability as regulations are confirmed.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="accessibility">
              <AccordionTrigger>Is FuzzyCat accessible?</AccordionTrigger>
              <AccordionContent>
                <p>
                  Yes. FuzzyCat is built with accessibility in mind, including proper semantic HTML,
                  ARIA labels, keyboard navigation, and screen reader support. The platform also
                  supports light and dark mode based on your system preferences or manual toggle.
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      <Separator className="my-10" />

      {/* Need More Help */}
      <section>
        <h2 className="text-2xl font-bold tracking-tight">Need More Help?</h2>
        <p className="mt-3 text-muted-foreground">
          Can&apos;t find what you&apos;re looking for? We&apos;re here to help.
        </p>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <MessageCircle className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg">Send Feedback</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Use the feedback button in the bottom-right corner of any page to report a problem,
                ask a question, or suggest an improvement.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <PawPrint className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg">Learn More</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                See detailed breakdowns of how payments work, fee calculations, and what clinics
                earn.
              </p>
              <Link href="/how-it-works">
                <Button variant="outline" className="mt-4 w-full">
                  How It Works
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
