import { Button, Section, Text } from '@react-email/components';
import { EmailLayout } from '@/server/emails/components/layout';
import {
  heading,
  muted,
  paragraph,
  primaryButton,
  successBox,
  tableContainer,
  tableRow,
  tableRowBold,
} from '@/server/emails/components/styles';
import { formatCents, formatDate } from '@/server/emails/helpers';

export interface ClinicPayoutProps {
  clinicName: string;
  contactName: string;
  transferAmountCents: number;
  clinicShareCents: number;
  paymentAmountCents: number;
  planId: string;
  ownerName: string;
  petName: string;
  payoutDate: Date;
  stripeTransferId: string;
  dashboardUrl: string;
}

export function ClinicPayout({
  clinicName,
  contactName,
  transferAmountCents,
  clinicShareCents,
  paymentAmountCents,
  planId,
  ownerName,
  petName,
  payoutDate,
  stripeTransferId,
  dashboardUrl,
}: ClinicPayoutProps) {
  return (
    <EmailLayout
      preview={`Payout of ${formatCents(transferAmountCents)} has been sent to ${clinicName}`}
    >
      <Text style={heading}>Payout Sent!</Text>

      <Text style={paragraph}>Hi {contactName},</Text>

      <Section style={successBox}>
        <Text style={{ ...paragraph, color: '#065f46', margin: '0' }}>
          A payout of {formatCents(transferAmountCents)} has been transferred to {clinicName}'s bank
          account.
        </Text>
      </Section>

      <Section style={tableContainer}>
        <Text style={tableRowBold}>Payout Details</Text>
        <Text style={tableRow}>Transfer amount: {formatCents(transferAmountCents)}</Text>
        <Text style={tableRow}>Includes clinic revenue share: {formatCents(clinicShareCents)}</Text>
        <Text style={tableRow}>From pet owner payment: {formatCents(paymentAmountCents)}</Text>
        <Text style={tableRow}>Date: {formatDate(payoutDate)}</Text>
        <Text style={tableRow}>Stripe transfer ID: {stripeTransferId}</Text>
      </Section>

      <Section style={tableContainer}>
        <Text style={tableRowBold}>Plan Reference</Text>
        <Text style={tableRow}>Plan ID: {planId}</Text>
        <Text style={tableRow}>Pet owner: {ownerName}</Text>
        <Text style={tableRow}>Pet: {petName}</Text>
      </Section>

      <Section style={{ textAlign: 'center' as const, margin: '24px 0' }}>
        <Button style={primaryButton} href={dashboardUrl}>
          View Payout History
        </Button>
      </Section>

      <Text style={muted}>
        Funds typically arrive in your bank account within 2 business days. You can also view this
        payout in your Stripe Connect dashboard.
      </Text>
    </EmailLayout>
  );
}
