import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { buildStructuredData, siteIdentity } from '@/data/site';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

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
        width: 1731,
        height: 909,
        alt: "Alireza's Galaxy — linked worlds in one luminous corner of the web.",
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
