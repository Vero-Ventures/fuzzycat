import { Mail, MessageCircle } from 'lucide-react';
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

export const metadata: Metadata = {
  title: 'Support',
  description:
    'Get help with your FuzzyCat payment plan. Find answers to common questions or contact our support team.',
};

export default function SupportPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">Help &amp; Support</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Find answers to common questions or get in touch with our support team.
        </p>
      </div>

      <Separator className="my-10" />

      {/* FAQ Section */}
      <section>
        <h2 className="text-2xl font-bold tracking-tight">Frequently Asked Questions</h2>
        <div className="mt-6">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="how-payments-work">
              <AccordionTrigger>How do payment plans work?</AccordionTrigger>
              <AccordionContent>
                When you enroll in a FuzzyCat payment plan, you pay a 25% deposit upfront via debit
                card. The remaining 75% is divided into 6 equal biweekly payments that are
                automatically deducted from your bank account via ACH. Your plan is completed in 12
                weeks. A flat 6% platform fee is added to your bill &mdash; there is no interest and
                no credit check.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="missed-payment">
              <AccordionTrigger>What happens if I miss a payment?</AccordionTrigger>
              <AccordionContent>
                If a payment fails, we automatically retry up to 3 times with retries aligned to
                common paydays. You will receive reminders via email and SMS at day 1, 7, and 14.
                There are no late fees. If all retries fail, the plan is marked as defaulted and the
                clinic is notified.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="change-bank">
              <AccordionTrigger>Can I change my bank account after enrolling?</AccordionTrigger>
              <AccordionContent>
                If you need to update your bank account, please contact our support team at{' '}
                <a href="mailto:support@fuzzycatapp.com" className="text-primary hover:underline">
                  support@fuzzycatapp.com
                </a>{' '}
                and we will help you through the process. For security, bank account changes require
                verification.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="cancel-plan">
              <AccordionTrigger>Can I cancel my payment plan?</AccordionTrigger>
              <AccordionContent>
                Payment plans cannot be cancelled once the deposit has been processed, as the funds
                have already been forwarded to the veterinary clinic. If you are experiencing
                financial difficulty, please contact us and we will work with you to find a
                solution.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="payment-schedule">
              <AccordionTrigger>When are my payments due?</AccordionTrigger>
              <AccordionContent>
                Your payment dates are set when you enroll and occur every two weeks. You can view
                your full payment schedule in your owner portal under the plan details page. You
                will also receive email reminders before each payment.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="clinic-signup">
              <AccordionTrigger>How does my clinic sign up for FuzzyCat?</AccordionTrigger>
              <AccordionContent>
                Veterinary clinics can register at{' '}
                <Link href="/signup/clinic" className="text-primary hover:underline">
                  fuzzycatapp.com/signup/clinic
                </Link>
                . After registration, clinics complete Stripe Connect onboarding to receive payouts.
                There are no setup fees or contracts &mdash; clinics earn a 3% revenue share on
                every enrollment.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="data-security">
              <AccordionTrigger>Is my financial information secure?</AccordionTrigger>
              <AccordionContent>
                Yes. FuzzyCat never stores your card numbers, bank account numbers, or routing
                numbers. All payment processing is handled by Stripe (PCI DSS Level 1 certified) and
                bank verification is handled by Plaid. Your data is encrypted in transit and at
                rest.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="receipt">
              <AccordionTrigger>How do I get a receipt for my payments?</AccordionTrigger>
              <AccordionContent>
                You receive an email confirmation after each successful payment. You can also view
                your complete payment history and download receipts from your owner portal at any
                time.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      <Separator className="my-10" />

      {/* Contact Section */}
      <section>
        <h2 className="text-2xl font-bold tracking-tight">Contact Us</h2>
        <p className="mt-3 text-muted-foreground">
          Can&apos;t find what you&apos;re looking for? Our support team is here to help.
        </p>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Mail className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg">Email Support</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Send us an email and we will respond within one business day.
              </p>
              <a href="mailto:support@fuzzycatapp.com">
                <Button variant="outline" className="mt-4 w-full">
                  support@fuzzycatapp.com
                </Button>
              </a>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <MessageCircle className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg">Help Center</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Learn more about how FuzzyCat works, including payment details and clinic
                information.
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
