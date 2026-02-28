import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Enroll | FuzzyCat',
};

export default function EnrollLayout({ children }: { children: React.ReactNode }) {
  return children;
}
