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
import { formatCents } from '@/server/emails/helpers';

export interface SoftCollectionDay14Props {
  ownerName: string;
  petName: string;
  clinicName: string;
  remainingCents: number;
  updatePaymentUrl: string;
}

export function SoftCollectionDay14({
  ownerName,
  petName,
  clinicName,
  remainingCents,
  updatePaymentUrl,
}: SoftCollectionDay14Props) {
  return (
    <EmailLayout preview={`Final notice: Your payment plan for ${petName}`}>
      <Text style={heading}>Final Notice: Your Payment Plan</Text>

      <Text style={paragraph}>Hi {ownerName},</Text>

      <Text style={paragraph}>
        This is a final notice regarding your payment plan for {petName}&apos;s care at {clinicName}
        . It has been 14 days since your plan was paused, and we have not received an updated
        payment method.
      </Text>

      <Section style={warningBox}>
        <Text style={{ ...paragraph, color: '#92400e', margin: '0', fontWeight: 'bold' }}>
          If your payment method is not updated within the next few days, the guarantee claim for
          your remaining balance will be finalized. This is your last opportunity to resolve this
          matter directly.
        </Text>
      </Section>

      <Section style={tableContainer}>
        <Text style={tableRowBold}>Final Balance Summary</Text>
        <Text style={tableRow}>Pet: {petName}</Text>
        <Text style={tableRow}>Clinic: {clinicName}</Text>
        <Text style={tableRow}>Remaining balance: {formatCents(remainingCents)}</Text>
      </Section>

      <Section style={{ textAlign: 'center' as const, margin: '24px 0' }}>
        <Button style={primaryButton} href={updatePaymentUrl}>
          Resolve Now -- Update Payment Method
        </Button>
      </Section>

      <Text style={muted}>
        If you believe this notice was sent in error, or if you need to discuss your options, please
        contact our support team immediately.
      </Text>
    </EmailLayout>
  );
}
