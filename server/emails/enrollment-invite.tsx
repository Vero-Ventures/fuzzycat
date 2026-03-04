import { Button, Hr, Section, Text } from '@react-email/components';
import { EmailLayout } from '@/server/emails/components/layout';
import {
  heading,
  infoBox,
  muted,
  paragraph,
  primaryButton,
  tableContainer,
  tableRow,
  tableRowBold,
} from '@/server/emails/components/styles';
import { formatCents } from '@/server/emails/helpers';

export interface EnrollmentInviteProps {
  ownerName: string;
  petName: string;
  clinicName: string;
  totalBillCents: number;
  feeCents: number;
  depositCents: number;
  installmentCents: number;
  numInstallments: number;
  setupUrl: string;
}

export function EnrollmentInvite({
  ownerName,
  petName,
  clinicName,
  totalBillCents,
  feeCents,
  depositCents,
  installmentCents,
  numInstallments,
  setupUrl,
}: EnrollmentInviteProps) {
  const totalWithFeeCents = totalBillCents + feeCents;

  return (
    <EmailLayout
      preview={`${clinicName} has created a payment plan for ${petName}'s care. Set up your account to get started.`}
    >
      <Text style={heading}>Your Payment Plan is Ready</Text>

      <Text style={paragraph}>Hi {ownerName},</Text>

      <Text style={paragraph}>
        <strong>{clinicName}</strong> has set up a FuzzyCat payment plan for {petName}'s veterinary
        care. Here's a summary of your plan:
      </Text>

      <Section style={tableContainer}>
        <Text style={tableRow}>Vet Bill: {formatCents(totalBillCents)}</Text>
        <Text style={tableRow}>Platform Fee: {formatCents(feeCents)}</Text>
        <Text style={tableRow}>Total: {formatCents(totalWithFeeCents)}</Text>
        <Hr style={{ borderColor: '#e5e7eb', margin: '8px 0' }} />
        <Text style={tableRowBold}>Deposit Due Now: {formatCents(depositCents)}</Text>
        <Text style={tableRow}>
          Then {numInstallments} biweekly installments of {formatCents(installmentCents)}
        </Text>
      </Section>

      <Section style={infoBox}>
        <Text style={{ ...paragraph, color: '#1e40af', margin: '0' }}>
          To get started, click the button below to set up your account password and pay your
          deposit securely via Stripe.
        </Text>
      </Section>

      <Section style={{ textAlign: 'center' as const, margin: '24px 0' }}>
        <Button style={primaryButton} href={setupUrl}>
          Set Up Your Account & Pay Deposit
        </Button>
      </Section>

      <Hr style={{ borderColor: '#e5e7eb', margin: '16px 0' }} />

      <Text style={paragraph}>
        After paying your deposit, your plan will be activated and installments will be collected
        biweekly from your payment method on file.
      </Text>

      <Text style={muted}>
        If you did not expect this email or have questions about your payment plan, please contact{' '}
        {clinicName} directly.
      </Text>
    </EmailLayout>
  );
}
