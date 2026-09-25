import type { Metadata } from "next";
import type { ReactNode } from "react";
import { messages } from "@/messages/fr";
import "./globals.css";

// The backoffice is never indexed: robots meta here, X-Robots-Tag header on every response
// (next.config.ts), and no robots.txt Disallow that would hide them (03 §7.1).
export const metadata: Metadata = {
  title: messages.metadata.title,
  robots: { index: false, follow: false, noarchive: true },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
