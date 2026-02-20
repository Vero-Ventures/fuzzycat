import { Button, Hr, Section, Text } from '@react-email/components';
import { EmailLayout } from '@/server/emails/components/layout';
import {
  heading,
  infoBox,
  muted,
  paragraph,
  primaryButton,
  tableContainer,
  tableRow,
} from '@/server/emails/components/styles';

export interface ClinicWelcomeProps {
  clinicName: string;
  contactName: string;
  dashboardUrl: string;
  connectUrl: string;
}

export function ClinicWelcome({
  clinicName,
  contactName,
  dashboardUrl,
  connectUrl,
}: ClinicWelcomeProps) {
  return (
    <EmailLayout preview={`Welcome to FuzzyCat, ${clinicName}! Let's get you set up.`}>
      <Text style={heading}>Welcome to FuzzyCat!</Text>

      <Text style={paragraph}>Hi {contactName},</Text>

      <Text style={paragraph}>
        We are thrilled to have {clinicName} join the FuzzyCat family! Your clinic is now registered
        on our platform and ready to offer Guaranteed Payment Plans to your clients.
      </Text>

      <Section style={tableContainer}>
        <Text style={{ ...paragraph, fontWeight: 'bold', margin: '0 0 8px' }}>
          How FuzzyCat Works for Your Clinic
        </Text>
        <Text style={tableRow}>
          1. Offer FuzzyCat payment plans to clients with bills of $500 or more
        </Text>
        <Text style={tableRow}>
          2. Clients pay 25% upfront and the rest in 6 biweekly installments
        </Text>
        <Text style={tableRow}>3. Your clinic receives payments as they come in -- guaranteed</Text>
        <Text style={tableRow}>4. Earn a 3% revenue share on every enrollment</Text>
      </Section>

      <Section style={infoBox}>
        <Text style={{ ...paragraph, color: '#1e40af', margin: '0' }}>
          Your clinic earns 3% on every FuzzyCat enrollment. This is paid as platform administration
          compensation alongside each payment transfer.
        </Text>
      </Section>

      <Text style={{ ...paragraph, fontWeight: 'bold' }}>Getting Started</Text>

      <Text style={paragraph}>
        To start receiving payments, you will need to connect your bank account through Stripe
        Connect. This is a one-time setup that takes about 5 minutes.
      </Text>

      <Section style={{ textAlign: 'center' as const, margin: '24px 0' }}>
        <Button style={primaryButton} href={connectUrl}>
          Connect Your Bank Account
        </Button>
      </Section>

      <Hr style={{ borderColor: '#e5e7eb', margin: '16px 0' }} />

      <Text style={paragraph}>
        Once connected, you can manage everything from your clinic dashboard -- view active plans,
        track payouts, and monitor your revenue share earnings.
      </Text>

      <Section style={{ textAlign: 'center' as const, margin: '24px 0' }}>
        <Button style={{ ...primaryButton, backgroundColor: '#4b5563' }} href={dashboardUrl}>
          Go to Your Dashboard
        </Button>
      </Section>

      <Text style={muted}>
        If you have any questions about getting started, our team is here to help. We look forward
        to a great partnership!
      </Text>
    </EmailLayout>
  );
}
