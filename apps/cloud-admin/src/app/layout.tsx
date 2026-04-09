import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Pulse — Learning, Delivery Infrastructure',
  description: 'Inteliflow Pulse — Learning, Delivery Infrastructure',
  icons: { icon: '/pulse-logo.png' },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-brand-bg text-gray-100`}>{children}</body>
    </html>
  );
}
