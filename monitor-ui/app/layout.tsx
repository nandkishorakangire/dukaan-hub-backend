import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DukaanHub · Server Monitor',
  description:
    'Live server health, traffic analytics, resource usage, system failures and Prometheus metrics for the DukaanHub API.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
