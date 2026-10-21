"use client";

// The last error screen (18 T13; J9 commit 7): an error of the locale's layout itself. It replaces
// that layout, so it brings its own document and styles; a fixed text, never the error's message
// nor its digest.
import { useParams } from "next/navigation";
import en from "@/locales/en/errors.json";
import fr from "@/locales/fr/errors.json";
import {
  BRAND_CLASSES,
  LEAD_CLASSES,
  SCREEN_CLASSES,
  TEXT_BUTTON_CLASSES,
  TITLE_CLASSES,
} from "@/components/auth/auth-classes";
import "./globals.css";

export default function GlobalError() {
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale === "en" ? "en" : "fr";
  const t = locale === "en" ? en : fr;
  return (
    <html lang={locale}>
      <body className="bg-surface-page font-base text-md text-text-primary">
        <main id="main" className={SCREEN_CLASSES}>
          <p className={BRAND_CLASSES}>{t.brand}</p>
          <h1 className={TITLE_CLASSES}>{t.error.title}</h1>
          <p className={LEAD_CLASSES}>{t.error.body}</p>
          <a href={`/${locale}`} className={TEXT_BUTTON_CLASSES}>
            {t.error.home}
          </a>
        </main>
      </body>
    </html>
  );
}
