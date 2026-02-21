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
import { formatCents } from '@/server/emails/helpers';

export interface SoftCollectionDay1Props {
  ownerName: string;
  petName: string;
  clinicName: string;
  remainingCents: number;
  dashboardUrl: string;
  updatePaymentUrl: string;
}

export function SoftCollectionDay1({
  ownerName,
  petName,
  clinicName,
  remainingCents,
  dashboardUrl,
  updatePaymentUrl,
}: SoftCollectionDay1Props) {
  return (
    <EmailLayout preview={`Your payment plan for ${petName} needs attention`}>
      <Text style={heading}>Your Payment Plan Needs Attention</Text>

      <Text style={paragraph}>Hi {ownerName},</Text>

      <Text style={paragraph}>
        We noticed that your payment plan for {petName}&apos;s care at {clinicName} has been paused
        due to a payment issue. We want to help you get back on track as quickly as possible.
      </Text>

      <Section style={tableContainer}>
        <Text style={tableRowBold}>Plan Summary</Text>
        <Text style={tableRow}>Pet: {petName}</Text>
        <Text style={tableRow}>Clinic: {clinicName}</Text>
        <Text style={tableRow}>Remaining balance: {formatCents(remainingCents)}</Text>
      </Section>

      <Section style={infoBox}>
        <Text style={{ ...paragraph, color: '#1e40af', margin: '0' }}>
          If your payment method needs to be updated, you can do so quickly through your dashboard.
          This will resume your payment plan automatically.
        </Text>
      </Section>

      <Section style={{ textAlign: 'center' as const, margin: '24px 0' }}>
        <Button style={primaryButton} href={updatePaymentUrl}>
          Update Payment Method
        </Button>
      </Section>

      <Text style={paragraph}>
        You can also view your full payment plan details on your{' '}
        <a href={dashboardUrl} style={{ color: '#7c3aed' }}>
          dashboard
        </a>
        .
      </Text>

      <Text style={muted}>
        If you have any questions or need assistance, please do not hesitate to reach out. We are
        here to help.
      </Text>
    </EmailLayout>
  );
}
