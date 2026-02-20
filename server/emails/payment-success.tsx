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

export interface PaymentSuccessProps {
  ownerName: string;
  petName: string;
  clinicName: string;
  amountCents: number;
  paymentDate: Date;
  paymentType: 'deposit' | 'installment';
  installmentNumber: number;
  totalInstallments: number;
  remainingBalanceCents: number;
  nextPaymentDate: Date | null;
  nextPaymentAmountCents: number | null;
  dashboardUrl: string;
}

export function PaymentSuccess({
  ownerName,
  petName,
  clinicName,
  amountCents,
  paymentDate,
  paymentType,
  installmentNumber,
  totalInstallments,
  remainingBalanceCents,
  nextPaymentDate,
  nextPaymentAmountCents,
  dashboardUrl,
}: PaymentSuccessProps) {
  const paymentLabel = paymentType === 'deposit' ? 'Deposit' : `Installment #${installmentNumber}`;

  return (
    <EmailLayout
      preview={`Payment of ${formatCents(amountCents)} received for ${petName}'s plan at ${clinicName}`}
    >
      <Text style={heading}>Payment Received!</Text>

      <Text style={paragraph}>Hi {ownerName},</Text>

      <Section style={successBox}>
        <Text style={{ ...paragraph, color: '#065f46', margin: '0' }}>
          Your payment of {formatCents(amountCents)} has been successfully processed. Thank you for
          taking care of {petName}!
        </Text>
      </Section>

      <Section style={tableContainer}>
        <Text style={tableRowBold}>Payment Details</Text>
        <Text style={tableRow}>Payment: {paymentLabel}</Text>
        <Text style={tableRow}>Amount: {formatCents(amountCents)}</Text>
        <Text style={tableRow}>Date: {formatDate(paymentDate)}</Text>
        <Text style={tableRow}>Clinic: {clinicName}</Text>
        <Text style={tableRow}>Pet: {petName}</Text>
      </Section>

      <Section style={tableContainer}>
        <Text style={tableRowBold}>Plan Progress</Text>
        <Text style={tableRow}>
          Payments completed: {paymentType === 'deposit' ? 1 : installmentNumber + 1} of{' '}
          {totalInstallments + 1}
        </Text>
        <Text style={tableRow}>Remaining balance: {formatCents(remainingBalanceCents)}</Text>
        {nextPaymentDate && nextPaymentAmountCents !== null ? (
          <Text style={tableRow}>
            Next payment: {formatCents(nextPaymentAmountCents)} on {formatDate(nextPaymentDate)}
          </Text>
        ) : null}
      </Section>

      <Section style={{ textAlign: 'center' as const, margin: '24px 0' }}>
        <Button style={primaryButton} href={dashboardUrl}>
          View Your Plan
        </Button>
      </Section>

      <Text style={muted}>
        A record of this payment has been saved to your FuzzyCat dashboard. If you believe this
        payment was made in error, please contact our support team.
      </Text>
    </EmailLayout>
  );
}
