import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Grainology — Live Agricultural Price Intelligence India',
  description:
    'Compare live mandi prices across Agmarknet, eNAM, and data.gov.in. Filter by state, district, market, and commodity. Updated every 2 hours from multiple government sources.',
  keywords: [
    'mandi prices', 'agmarknet', 'eNAM', 'agricultural prices India',
    'commodity prices', 'mandi bhav', 'krishi mandi', 'farm prices live',
  ],
  openGraph: {
    title: 'Grainology — Live Agricultural Price Intelligence',
    description: 'Compare live mandi prices from 4 government sources. Filter by state, district, commodity.',
    type: 'website',
    locale: 'en_IN',
  },
  robots: 'index, follow',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>{children}</body>
    </html>
  );
}
