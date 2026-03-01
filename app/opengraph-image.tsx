import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'FuzzyCat — Split Your Vet Bills Into Easy Payments';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
  return new ImageResponse(
    <div
      style={{
        fontSize: 60,
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        padding: '40px 80px',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 80, fontWeight: 700, marginBottom: 20, display: 'flex' }}>
        FuzzyCat
      </div>
      <div style={{ fontSize: 36, opacity: 0.9, display: 'flex' }}>
        Split Your Vet Bills Into Easy Payments
      </div>
      <div style={{ fontSize: 24, opacity: 0.7, marginTop: 20, display: 'flex' }}>
        No credit check · No interest · 12-week plans
      </div>
    </div>,
    { ...size },
  );
}
