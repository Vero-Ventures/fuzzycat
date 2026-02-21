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
import type { UrgencyLevel } from '@/server/services/collection';

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
  /** Urgency level for escalating notification content (1=friendly, 2=urgent, 3=final). */
  urgencyLevel?: UrgencyLevel;
}

/** Red danger styling for final notice (level 3). */
const dangerBox: React.CSSProperties = {
  backgroundColor: '#fef2f2',
  borderRadius: '8px',
  padding: '16px 20px',
  margin: '16px 0',
  borderLeft: '4px solid #ef4444',
};

/** Urgency heading for final notice. */
const dangerHeading: React.CSSProperties = {
  fontSize: '24px',
  fontWeight: 'bold',
  color: '#dc2626',
  margin: '0 0 16px',
};

/** Urgent warning heading for level 2. */
const urgentHeading: React.CSSProperties = {
  fontSize: '24px',
  fontWeight: 'bold',
  color: '#d97706',
  margin: '0 0 16px',
};

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
  urgencyLevel = 1,
}: PaymentFailedProps) {
  return (
    <EmailLayout preview={getPreviewText(urgencyLevel, amountCents, petName)}>
      <Text style={getHeadingStyle(urgencyLevel)}>{getHeadingText(urgencyLevel)}</Text>

      <Text style={paragraph}>Hi {ownerName},</Text>

      <Section style={getAlertBoxStyle(urgencyLevel)}>
        <Text style={{ ...paragraph, color: getAlertTextColor(urgencyLevel), margin: '0' }}>
          {getAlertMessage(urgencyLevel, amountCents, petName, clinicName)}
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
        {getNextStepsContent(urgencyLevel, retryDate, retriesRemaining)}
      </Section>

      <Section style={{ textAlign: 'center' as const, margin: '24px 0' }}>
        <Button style={getButtonStyle(urgencyLevel)} href={dashboardUrl}>
          {getButtonText(urgencyLevel)}
        </Button>
      </Section>

      <Text style={muted}>{getFooterMessage(urgencyLevel)}</Text>
    </EmailLayout>
  );
}

// ── Helper functions for urgency-based content ───────────────────────

function getPreviewText(level: UrgencyLevel, amountCents: number, petName: string): string {
  switch (level) {
    case 1:
      return `Action needed -- your ${formatCents(amountCents)} payment for ${petName} was not successful`;
    case 2:
      return `Important -- your ${formatCents(amountCents)} payment for ${petName} requires immediate attention`;
    case 3:
      return `Final Notice -- last attempt for your ${formatCents(amountCents)} payment for ${petName}`;
  }
}

function getHeadingStyle(level: UrgencyLevel): React.CSSProperties {
  switch (level) {
    case 1:
      return heading;
    case 2:
      return urgentHeading;
    case 3:
      return dangerHeading;
  }
}

function getHeadingText(level: UrgencyLevel): string {
  switch (level) {
    case 1:
      return 'Payment Was Not Successful';
    case 2:
      return 'Important: Payment Requires Attention';
    case 3:
      return 'Final Notice: Last Payment Attempt';
  }
}

function getAlertBoxStyle(level: UrgencyLevel): React.CSSProperties {
  switch (level) {
    case 1:
      return warningBox;
    case 2:
      return warningBox;
    case 3:
      return dangerBox;
  }
}

function getAlertTextColor(level: UrgencyLevel): string {
  switch (level) {
    case 1:
      return '#92400e';
    case 2:
      return '#92400e';
    case 3:
      return '#991b1b';
  }
}

function getAlertMessage(
  level: UrgencyLevel,
  amountCents: number,
  petName: string,
  clinicName: string,
): string {
  switch (level) {
    case 1:
      return `We were unable to process your payment of ${formatCents(amountCents)} for ${petName}'s care at ${clinicName}. Please ensure your payment method has sufficient funds.`;
    case 2:
      return `Important: Your payment of ${formatCents(amountCents)} for ${petName}'s care at ${clinicName} has failed again. Please ensure funds are available in your account to avoid disruption to your payment plan.`;
    case 3:
      return `Final Notice: Your payment of ${formatCents(amountCents)} for ${petName}'s care at ${clinicName} has failed multiple times. This is the last automatic retry before your plan defaults. Please take immediate action.`;
  }
}

function getNextStepsContent(
  level: UrgencyLevel,
  retryDate: Date | null,
  retriesRemaining: number,
): React.ReactNode {
  if (level === 3) {
    return (
      <>
        {retryDate ? (
          <Text style={{ ...tableRow, fontWeight: 'bold', color: '#dc2626' }}>
            Final retry scheduled for {formatDate(retryDate)}. If this attempt fails, your payment
            plan will be marked as defaulted.
          </Text>
        ) : (
          <Text style={tableRow}>
            All automatic retries have been exhausted. Please update your payment method or contact
            support to avoid disruption to your payment plan.
          </Text>
        )}
      </>
    );
  }

  if (level === 2) {
    return (
      <>
        {retryDate && retriesRemaining > 0 ? (
          <>
            <Text style={{ ...tableRow, fontWeight: 'bold' }}>
              We will retry this payment on {formatDate(retryDate)}.
            </Text>
            <Text style={tableRow}>Retries remaining: {retriesRemaining} of 3</Text>
            <Text style={{ ...tableRow, color: '#d97706', marginTop: '8px' }}>
              If all retries fail, your payment plan will default and the remaining balance will be
              reported to our risk pool.
            </Text>
          </>
        ) : (
          <Text style={tableRow}>
            All automatic retries have been exhausted. Please update your payment method or contact
            support to avoid disruption to your payment plan.
          </Text>
        )}
      </>
    );
  }

  // Level 1: friendly
  return (
    <>
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
    </>
  );
}

function getButtonStyle(level: UrgencyLevel): React.CSSProperties {
  switch (level) {
    case 1:
      return primaryButton;
    case 2:
      return { ...primaryButton, backgroundColor: '#d97706' };
    case 3:
      return { ...primaryButton, backgroundColor: '#dc2626' };
  }
}

function getButtonText(level: UrgencyLevel): string {
  switch (level) {
    case 1:
      return 'Update Payment Method';
    case 2:
      return 'Update Payment Method Now';
    case 3:
      return 'Take Action Immediately';
  }
}

function getFooterMessage(level: UrgencyLevel): string {
  switch (level) {
    case 1:
      return 'If you are experiencing financial difficulty, please reach out to our support team. We are here to help find a solution.';
    case 2:
      return 'Please take action soon to keep your payment plan in good standing. Our support team is available if you need assistance.';
    case 3:
      return 'This is your final automated notice. If you need help or want to discuss payment options, please contact our support team immediately.';
  }
}
