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

export interface SoftCollectionDay7Props {
  ownerName: string;
  petName: string;
  clinicName: string;
  remainingCents: number;
  updatePaymentUrl: string;
}

export function SoftCollectionDay7({
  ownerName,
  petName,
  clinicName,
  remainingCents,
  updatePaymentUrl,
}: SoftCollectionDay7Props) {
  return (
    <EmailLayout preview={`Action required: Update your payment method for ${petName}'s plan`}>
      <Text style={heading}>Action Required: Update Your Payment Method</Text>

      <Text style={paragraph}>Hi {ownerName},</Text>

      <Text style={paragraph}>
        It has been 7 days since your payment plan for {petName}&apos;s care at {clinicName} was
        paused. We have not yet received an updated payment method, and your plan remains on hold.
      </Text>

      <Section style={warningBox}>
        <Text style={{ ...paragraph, color: '#92400e', margin: '0' }}>
          To avoid further complications with your payment plan, please update your payment method
          as soon as possible. Continued non-payment may result in your balance being referred to
          the clinic for collection.
        </Text>
      </Section>

      <Section style={tableContainer}>
        <Text style={tableRowBold}>Outstanding Balance</Text>
        <Text style={tableRow}>Pet: {petName}</Text>
        <Text style={tableRow}>Clinic: {clinicName}</Text>
        <Text style={tableRow}>Remaining balance: {formatCents(remainingCents)}</Text>
      </Section>

      <Section style={{ textAlign: 'center' as const, margin: '24px 0' }}>
        <Button style={primaryButton} href={updatePaymentUrl}>
          Update Payment Method Now
        </Button>
      </Section>

      <Text style={muted}>
        If you are experiencing financial difficulty, please contact our support team. We may be
        able to work out an alternative arrangement.
      </Text>
    </EmailLayout>
  );
}
