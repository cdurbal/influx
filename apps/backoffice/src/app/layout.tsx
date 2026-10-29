import type { Metadata } from "next";
import type { ReactNode } from "react";
import { messages } from "@/messages/fr";
import { FONT_VARIABLE_CLASSES } from "@/styles/fonts";
import "./globals.css";

// The backoffice is never indexed: robots meta here, X-Robots-Tag header on every response
// (next.config.ts), and no robots.txt Disallow that would hide them (03 §7.1).
// Every page is rendered per request, so Next.js sends `Cache-Control: no-store`: a page that
// showed the secret or the recovery codes is never kept by a cache (17b §3.14.c, EC-17 point 5).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: messages.metadata.title,
  robots: { index: false, follow: false, noarchive: true },
};

// The whole backoffice is in the KEO charter (D73, 02 §21.3 point 4): the attribute on <html> and the
// font variables are set here and nowhere else.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" data-theme="keo" className={FONT_VARIABLE_CLASSES}>
      <body>{children}</body>
    </html>
  );
}
