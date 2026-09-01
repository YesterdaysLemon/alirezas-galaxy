import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
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
  title: "Alireza's Galaxy",
  description:
    'A tactile orbital index of Alireza Afshan’s websites and experiments.',
  openGraph: {
    title: "Alireza's Galaxy",
    description:
      'A tactile orbital index of Alireza Afshan’s websites and experiments.',
    type: 'website',
    images: [
      {
        url: 'https://raw.githubusercontent.com/YesterdaysLemon/alirezas-galaxy/main/public/og.png',
        width: 1731,
        height: 909,
        alt: "Alireza's Galaxy — four small worlds in one quiet corner of the web.",
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Alireza's Galaxy",
    description:
      'A tactile orbital index of Alireza Afshan’s websites and experiments.',
    images: [
      'https://raw.githubusercontent.com/YesterdaysLemon/alirezas-galaxy/main/public/og.png',
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
