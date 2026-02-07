import type { Metadata } from "next";
import { Rethink_Sans } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";

const rethinkSans = Rethink_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-rethink",
});

export const metadata: Metadata = {
  title: "Smart Door Lock - IoT Control Panel",
  description: "Modern IoT dashboard for smart door lock control system",
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
