import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Plan Details | FuzzyCat',
};

export default function PlanDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
