import { Body, Container, Head, Hr, Html, Preview, Section, Text } from '@react-email/components';
import type { ReactNode } from 'react';

const main: React.CSSProperties = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
};

const container: React.CSSProperties = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  maxWidth: '580px',
};

const header: React.CSSProperties = {
  padding: '20px 48px',
};

const logoText: React.CSSProperties = {
  fontSize: '24px',
  fontWeight: 'bold',
  color: '#7c3aed',
  margin: '0',
};

const content: React.CSSProperties = {
  padding: '0 48px',
};

const footer: React.CSSProperties = {
  padding: '0 48px',
};

const footerText: React.CSSProperties = {
  color: '#8898aa',
  fontSize: '12px',
  lineHeight: '16px',
  margin: '0',
};

interface EmailLayoutProps {
  preview: string;
  children: ReactNode;
}

/**
 * Shared email layout for all FuzzyCat transactional emails.
 * Provides consistent branding, header, and footer.
 */
export function EmailLayout({ preview, children }: EmailLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Text style={logoText}>FuzzyCat</Text>
          </Section>
          <Section style={content}>{children}</Section>
          <Hr style={{ borderColor: '#e6ebf1', margin: '20px 48px' }} />
          <Section style={footer}>
            <Text style={footerText}>FuzzyCat - Flexible Payment Plans for Veterinary Care</Text>
            <Text style={footerText}>
              This is an automated message from FuzzyCat. Please do not reply directly to this
              email.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
