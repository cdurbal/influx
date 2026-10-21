"use client";

// The error screen of the backoffice (18 T13; J9 commit 7): a fixed text, never the error's
// message nor its digest.
import {
  BRAND_CLASSES,
  LEAD_CLASSES,
  SCREEN_CLASSES,
  SECONDARY_BUTTON_CLASSES,
  TEXT_BUTTON_CLASSES,
  TITLE_CLASSES,
} from "@/components/auth-classes";
import { messages } from "@/messages/fr";

export default function BackofficeError({ reset }: { reset: () => void }) {
  const t = messages.errorPages;
  return (
    <main id="main" className={SCREEN_CLASSES}>
      <p className={BRAND_CLASSES}>{messages.brand}</p>
      <h1 className={TITLE_CLASSES}>{t.errorTitle}</h1>
      <p className={LEAD_CLASSES}>{t.errorBody}</p>
      <button
        type="button"
        className={SECONDARY_BUTTON_CLASSES}
        onClick={reset}
      >
        {t.retry}
      </button>
      <a href="/accueil" className={TEXT_BUTTON_CLASSES}>
        {t.home}
      </a>
    </main>
  );
}
