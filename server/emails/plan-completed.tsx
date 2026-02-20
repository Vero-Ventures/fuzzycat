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

export interface PlanCompletedProps {
  ownerName: string;
  petName: string;
  clinicName: string;
  totalPaidCents: number;
  completedDate: Date;
  enrollmentDate: Date;
  dashboardUrl: string;
}

export function PlanCompleted({
  ownerName,
  petName,
  clinicName,
  totalPaidCents,
  completedDate,
  enrollmentDate,
  dashboardUrl,
}: PlanCompletedProps) {
  return (
    <EmailLayout
      preview={`Congratulations! Your payment plan for ${petName} at ${clinicName} is complete`}
    >
      <Text style={heading}>All Paid Up -- You Did It!</Text>

      <Text style={paragraph}>Hi {ownerName},</Text>

      <Section style={successBox}>
        <Text style={{ ...paragraph, color: '#065f46', margin: '0' }}>
          Congratulations! All payments for {petName}'s care at {clinicName} have been successfully
          completed. You are the cat's meow!
        </Text>
      </Section>

      <Section style={tableContainer}>
        <Text style={tableRowBold}>Plan Summary</Text>
        <Text style={tableRow}>Pet: {petName}</Text>
        <Text style={tableRow}>Clinic: {clinicName}</Text>
        <Text style={tableRow}>Total paid: {formatCents(totalPaidCents)}</Text>
        <Text style={tableRow}>Enrolled: {formatDate(enrollmentDate)}</Text>
        <Text style={tableRow}>Completed: {formatDate(completedDate)}</Text>
      </Section>

      <Text style={paragraph}>
        Thank you for choosing FuzzyCat to help manage {petName}'s veterinary care. We hope the
        experience was smooth and stress-free.
      </Text>

      <Text style={paragraph}>
        If {petName} needs veterinary care in the future, FuzzyCat will be here to help. You can
        start a new payment plan at any time.
      </Text>

      <Section style={{ textAlign: 'center' as const, margin: '24px 0' }}>
        <Button style={primaryButton} href={dashboardUrl}>
          View Payment History
        </Button>
      </Section>

      <Text style={muted}>
        A complete record of all payments is available in your FuzzyCat dashboard.
      </Text>
    </EmailLayout>
  );
}
