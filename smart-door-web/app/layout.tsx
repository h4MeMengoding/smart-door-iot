import type { Metadata, Viewport } from "next";
import { Rethink_Sans } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";

const rethinkSans = Rethink_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-rethink",
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F0F1F3' },
    { media: '(prefers-color-scheme: dark)', color: '#09090B' },
  ],
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: "Smart Door Lock",
  description: "IoT Smart Door Lock Control Panel",
  applicationName: "Smart Door Lock",
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Door Lock',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/favicon/favicon.ico', sizes: 'any' },
      { url: '/favicon/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/favicon/apple-touch-icon.png',
  },
  manifest: '/favicon/site.webmanifest',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={rethinkSans.className}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
