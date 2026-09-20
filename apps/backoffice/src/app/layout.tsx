import type { Metadata } from "next";
import React from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "INFLUX Backoffice",
  description: "Espace sécurisé de supervision et intermédiation commerciale",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className="dark">
      <body className="min-h-screen bg-surface-page text-text-primary antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
