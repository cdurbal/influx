"use client";

// The error screen of the localized pages (18 T13; J9 commit 7): a fixed text in the page's
// language, never the error's message nor its digest. Its labels are bundled (this file only):
// an error screen cannot wait for a message from the server.
import { useParams } from "next/navigation";
import en from "@/locales/en/errors.json";
import fr from "@/locales/fr/errors.json";
import {
  BRAND_CLASSES,
  LEAD_CLASSES,
  SCREEN_CLASSES,
  SECONDARY_BUTTON_CLASSES,
  TEXT_BUTTON_CLASSES,
  TITLE_CLASSES,
} from "@/components/auth/auth-classes";

export default function LocaleError({ reset }: { reset: () => void }) {
  const { locale } = useParams<{ locale: string }>();
  const t = locale === "en" ? en : fr;
  return (
    <main id="main" className={SCREEN_CLASSES}>
      <a href={locale === "en" ? "/en" : "/fr"} className={BRAND_CLASSES}>
        {t.brand}
      </a>
      <h1 className={TITLE_CLASSES}>{t.error.title}</h1>
      <p className={LEAD_CLASSES}>{t.error.body}</p>
      <button
        type="button"
        className={SECONDARY_BUTTON_CLASSES}
        onClick={reset}
      >
        {t.error.retry}
      </button>
      <a href={locale === "en" ? "/en" : "/fr"} className={TEXT_BUTTON_CLASSES}>
        {t.error.home}
      </a>
    </main>
  );
}
