import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { buildStructuredData, siteIdentity } from '@/data/site';
import './globals.css';
import './webring.css';
import './world-comms.css';
import './galaxy-motion.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#06101f',
  colorScheme: 'dark',
};

export const metadata: Metadata = {
  metadataBase: new URL(siteIdentity.origin),
  title: siteIdentity.name,
  description: siteIdentity.description,
  alternates: { canonical: '/' },
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/favicon.svg',
  },
  openGraph: {
    title: siteIdentity.name,
    description: siteIdentity.description,
    url: '/',
    siteName: siteIdentity.name,
    type: 'website',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: "A glowing five-armed spiral galaxy with Alireza Afshan's wordmark in the corner: the home view of alirezaafshan.com.",
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: siteIdentity.name,
    description: siteIdentity.description,
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="describedby" href="/llms.txt" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(buildStructuredData()).replace(
              /</g,
              '\\u003c',
            ),
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
