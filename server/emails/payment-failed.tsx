import { Button, Section, Text } from '@react-email/components';
import { EmailLayout } from '@/server/emails/components/layout';
import {
  heading,
  muted,
  paragraph,
  primaryButton,
  tableContainer,
  tableRow,
  tableRowBold,
  warningBox,
} from '@/server/emails/components/styles';
import { formatCents, formatDate } from '@/server/emails/helpers';

export interface PaymentFailedProps {
  ownerName: string;
  petName: string;
  clinicName: string;
  amountCents: number;
  failedDate: Date;
  installmentNumber: number;
  totalInstallments: number;
  failureReason: string | null;
  retryDate: Date | null;
  retriesRemaining: number;
  dashboardUrl: string;
}

export function PaymentFailed({
  ownerName,
  petName,
  clinicName,
  amountCents,
  failedDate,
  installmentNumber,
  totalInstallments,
  failureReason,
  retryDate,
  retriesRemaining,
  dashboardUrl,
}: PaymentFailedProps) {
  return (
    <EmailLayout
      preview={`Action needed -- your ${formatCents(amountCents)} payment for ${petName} was not successful`}
    >
      <Text style={heading}>Payment Was Not Successful</Text>

      <Text style={paragraph}>Hi {ownerName},</Text>

      <Section style={warningBox}>
        <Text style={{ ...paragraph, color: '#92400e', margin: '0' }}>
          We were unable to process your payment of {formatCents(amountCents)} for {petName}'s care
          at {clinicName}. Please ensure your payment method has sufficient funds.
        </Text>
      </Section>

      <Section style={tableContainer}>
        <Text style={tableRowBold}>Payment Details</Text>
        <Text style={tableRow}>Amount: {formatCents(amountCents)}</Text>
        <Text style={tableRow}>
          Installment: {installmentNumber} of {totalInstallments}
        </Text>
        <Text style={tableRow}>Failed on: {formatDate(failedDate)}</Text>
        {failureReason ? <Text style={tableRow}>Reason: {failureReason}</Text> : null}
      </Section>

      <Section style={tableContainer}>
        <Text style={tableRowBold}>What Happens Next</Text>
        {retryDate && retriesRemaining > 0 ? (
          <>
            <Text style={tableRow}>
              We will automatically retry this payment on {formatDate(retryDate)}.
            </Text>
            <Text style={tableRow}>Retries remaining: {retriesRemaining} of 3</Text>
          </>
        ) : (
          <Text style={tableRow}>
            All automatic retries have been exhausted. Please update your payment method or contact
            support to avoid disruption to your payment plan.
          </Text>
        )}
      </Section>

      <Section style={{ textAlign: 'center' as const, margin: '24px 0' }}>
        <Button style={primaryButton} href={dashboardUrl}>
          Update Payment Method
        </Button>
      </Section>

      <Text style={muted}>
        If you are experiencing financial difficulty, please reach out to our support team. We are
        here to help find a solution.
      </Text>
    </EmailLayout>
  );
}
