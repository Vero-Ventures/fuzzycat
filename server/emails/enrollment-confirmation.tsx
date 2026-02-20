import { Button, Hr, Section, Text } from '@react-email/components';
import { EmailLayout } from '@/server/emails/components/layout';
import {
  heading,
  muted,
  paragraph,
  primaryButton,
  tableContainer,
  tableRow,
  tableRowBold,
} from '@/server/emails/components/styles';
import { formatCents, formatDate, formatShortDate } from '@/server/emails/helpers';

interface ScheduleEntry {
  type: 'deposit' | 'installment';
  sequenceNum: number;
  amountCents: number;
  scheduledAt: Date;
}

export interface EnrollmentConfirmationProps {
  ownerName: string;
  petName: string;
  clinicName: string;
  totalBillCents: number;
  feeCents: number;
  totalWithFeeCents: number;
  depositCents: number;
  installmentCents: number;
  numInstallments: number;
  schedule: ScheduleEntry[];
  enrollmentDate: Date;
  dashboardUrl: string;
}

export function EnrollmentConfirmation({
  ownerName,
  petName,
  clinicName,
  totalBillCents,
  feeCents,
  totalWithFeeCents,
  depositCents,
  installmentCents,
  numInstallments,
  schedule,
  enrollmentDate,
  dashboardUrl,
}: EnrollmentConfirmationProps) {
  return (
    <EmailLayout preview={`Your payment plan for ${petName} at ${clinicName} is confirmed`}>
      <Text style={heading}>Purrfect -- Your Payment Plan Is Set!</Text>

      <Text style={paragraph}>Hi {ownerName},</Text>

      <Text style={paragraph}>
        Great news! Your FuzzyCat payment plan for {petName}'s care at {clinicName} has been
        confirmed. Here is a summary of your plan:
      </Text>

      <Section style={tableContainer}>
        <Text style={tableRow}>Clinic: {clinicName}</Text>
        <Text style={tableRow}>Pet: {petName}</Text>
        <Text style={tableRow}>Enrollment date: {formatDate(enrollmentDate)}</Text>
        <Hr style={{ borderColor: '#e5e7eb', margin: '8px 0' }} />
        <Text style={tableRow}>Veterinary bill: {formatCents(totalBillCents)}</Text>
        <Text style={tableRow}>Platform fee (6%): {formatCents(feeCents)}</Text>
        <Text style={tableRowBold}>Total: {formatCents(totalWithFeeCents)}</Text>
        <Hr style={{ borderColor: '#e5e7eb', margin: '8px 0' }} />
        <Text style={tableRow}>Deposit (25%): {formatCents(depositCents)}</Text>
        <Text style={tableRow}>
          {numInstallments} biweekly installments of {formatCents(installmentCents)}
        </Text>
      </Section>

      <Text style={{ ...paragraph, fontWeight: 'bold' }}>Payment Schedule</Text>

      <Section style={tableContainer}>
        {schedule.map((entry) => (
          <Text key={entry.sequenceNum} style={tableRow}>
            {entry.type === 'deposit' ? 'Deposit' : `Installment #${entry.sequenceNum}`}:{' '}
            {formatCents(entry.amountCents)} -- {formatShortDate(entry.scheduledAt)}
          </Text>
        ))}
      </Section>

      <Section style={{ textAlign: 'center' as const, margin: '24px 0' }}>
        <Button style={primaryButton} href={dashboardUrl}>
          View Your Payment Plan
        </Button>
      </Section>

      <Text style={muted}>
        Payments will be automatically collected on the scheduled dates. You will receive a reminder
        3 days before each payment. If you have questions, visit your FuzzyCat dashboard or contact
        our support team.
      </Text>

      <Text style={muted}>
        Disclosure: FuzzyCat charges a flat 6% platform fee on the original veterinary bill amount.
        This fee is included in your total above. No additional interest or hidden charges will be
        applied. FuzzyCat is a payment facilitation platform, not a lender.
      </Text>
    </EmailLayout>
  );
}
