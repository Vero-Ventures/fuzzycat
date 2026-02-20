// ── Shared email styles ──────────────────────────────────────────────
// Reusable inline style objects for React Email templates.

export const heading: React.CSSProperties = {
  fontSize: '24px',
  fontWeight: 'bold',
  color: '#1f2937',
  margin: '0 0 16px',
};

export const paragraph: React.CSSProperties = {
  fontSize: '16px',
  lineHeight: '26px',
  color: '#374151',
  margin: '0 0 16px',
};

export const tableContainer: React.CSSProperties = {
  backgroundColor: '#f9fafb',
  borderRadius: '8px',
  padding: '16px 20px',
  margin: '16px 0',
};

export const tableRow: React.CSSProperties = {
  fontSize: '14px',
  lineHeight: '24px',
  color: '#374151',
  margin: '0',
};

export const tableRowBold: React.CSSProperties = {
  ...tableRow,
  fontWeight: 'bold',
  fontSize: '16px',
};

export const primaryButton: React.CSSProperties = {
  backgroundColor: '#7c3aed',
  borderRadius: '6px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'block',
  padding: '12px 24px',
};

export const warningBox: React.CSSProperties = {
  backgroundColor: '#fef3c7',
  borderRadius: '8px',
  padding: '16px 20px',
  margin: '16px 0',
  borderLeft: '4px solid #f59e0b',
};

export const successBox: React.CSSProperties = {
  backgroundColor: '#ecfdf5',
  borderRadius: '8px',
  padding: '16px 20px',
  margin: '16px 0',
  borderLeft: '4px solid #10b981',
};

export const infoBox: React.CSSProperties = {
  backgroundColor: '#eff6ff',
  borderRadius: '8px',
  padding: '16px 20px',
  margin: '16px 0',
  borderLeft: '4px solid #3b82f6',
};

export const muted: React.CSSProperties = {
  fontSize: '14px',
  lineHeight: '22px',
  color: '#6b7280',
  margin: '0 0 8px',
};
