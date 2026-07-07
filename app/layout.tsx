import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-inter-var',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-playfair-var',
});

export const metadata: Metadata = {
  title: 'Speak for the Dead | SunShade Truth Engine',
  description:
    'Crowdsourcing the human cost of regulatory failure. Share your story.',
  openGraph: {
    title: 'Speak for the Dead | SunShade Truth Engine',
    description:
      'Crowdsourcing the human cost of regulatory failure. Share your story.',
    type: 'website',
    locale: 'en_US',
    siteName: 'SunShade Truth Engine',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Speak for the Dead | SunShade Truth Engine',
    description:
      'Crowdsourcing the human cost of regulatory failure. Share your story.',
  },
  themeColor: '#0A0A0F',
  colorScheme: 'dark',
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${playfair.variable}`}
    >
      <body
        style={{
          backgroundColor: '#0A0A0F',
          fontFamily: 'var(--font-inter-var, Inter, system-ui, sans-serif)',
        }}
      >
        {children}
      </body>
    </html>
  );
}
