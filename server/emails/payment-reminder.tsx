import { Button, Section, Text } from '@react-email/components';
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
import { formatCents, formatDate } from '@/server/emails/helpers';

export interface PaymentReminderProps {
  ownerName: string;
  petName: string;
  clinicName: string;
  amountCents: number;
  scheduledDate: Date;
  installmentNumber: number;
  totalInstallments: number;
  remainingBalanceCents: number;
  dashboardUrl: string;
}

export function PaymentReminder({
  ownerName,
  petName,
  clinicName,
  amountCents,
  scheduledDate,
  installmentNumber,
  totalInstallments,
  remainingBalanceCents,
  dashboardUrl,
}: PaymentReminderProps) {
  return (
    <EmailLayout
      preview={`Heads up -- your ${formatCents(amountCents)} payment for ${petName} is coming up on ${formatDate(scheduledDate)}`}
    >
      <Text style={heading}>Payment Reminder</Text>

      <Text style={paragraph}>Hi {ownerName},</Text>

      <Text style={paragraph}>
        Just a friendly reminder that your upcoming payment for {petName}'s care at {clinicName} is
        scheduled in 3 days. Please make sure your account has sufficient funds.
      </Text>

      <Section style={tableContainer}>
        <Text style={tableRowBold}>Upcoming Payment</Text>
        <Text style={tableRow}>Amount: {formatCents(amountCents)}</Text>
        <Text style={tableRow}>Date: {formatDate(scheduledDate)}</Text>
        <Text style={tableRow}>
          Installment: {installmentNumber} of {totalInstallments}
        </Text>
        <Text style={tableRow}>Remaining balance: {formatCents(remainingBalanceCents)}</Text>
      </Section>

      <Section style={infoBox}>
        <Text style={{ ...muted, color: '#1e40af', margin: '0' }}>
          This payment will be automatically collected from your connected payment method on{' '}
          {formatDate(scheduledDate)}.
        </Text>
      </Section>

      <Section style={{ textAlign: 'center' as const, margin: '24px 0' }}>
        <Button style={primaryButton} href={dashboardUrl}>
          View Payment Details
        </Button>
      </Section>

      <Text style={muted}>
        If you need to update your payment method or have questions about your plan, please visit
        your FuzzyCat dashboard.
      </Text>
    </EmailLayout>
  );
}
