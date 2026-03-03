'use client';

interface QuickReferenceCardProps {
  clinicName: string;
}

export function QuickReferenceCard({ clinicName }: QuickReferenceCardProps) {
  return (
    <div className="print-material mx-auto max-w-md rounded-lg border bg-white p-6 text-black">
      <h3 className="text-lg font-bold text-teal-700">FuzzyCat Quick Reference</h3>
      <p className="text-xs text-gray-500">{clinicName} — Front Desk Staff</p>

      <div className="mt-4 space-y-3">
        <Section title="What is FuzzyCat?">
          A payment plan that splits vet bills into 6 biweekly payments. No credit check, no
          interest. Owners pay a small 6% platform fee.
        </Section>

        <Section title="Who qualifies?">
          Any pet owner with a vet bill between $500 and $25,000. All they need is a debit card and
          a bank account.
        </Section>

        <Section title="How does it work?">
          <ol className="ml-4 list-decimal space-y-1 text-sm">
            <li>Owner pays 25% deposit at checkout</li>
            <li>Remaining 75% is split into 6 biweekly payments</li>
            <li>Payments are automatically deducted from their bank account</li>
            <li>Clinic receives payouts after each successful payment</li>
          </ol>
        </Section>

        <Section title="What to say">
          <p className="text-sm italic text-gray-600">
            &ldquo;We offer payment plans through FuzzyCat. You can split your bill into 6 easy
            biweekly payments with no credit check. Would you like to learn more?&rdquo;
          </p>
        </Section>

        <Section title="Key benefits to mention">
          <ul className="ml-4 list-disc space-y-1 text-sm">
            <li>No credit check or application process</li>
            <li>No interest — just a small platform fee</li>
            <li>Automatic payments, so nothing to remember</li>
            <li>Available for bills from $500 to $25,000</li>
          </ul>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-800">{title}</h4>
      <div className="mt-1 text-sm text-gray-600">{children}</div>
    </div>
  );
}
