"use client";

// The last error screen (18 T13; J9 commit 7): an error of the root layout itself. It replaces
// that layout, so it brings its own document and styles; a fixed text, never the error's message
// nor its digest.
import {
  BRAND_CLASSES,
  LEAD_CLASSES,
  SCREEN_CLASSES,
  TEXT_BUTTON_CLASSES,
  TITLE_CLASSES,
} from "@/components/auth-classes";
import { messages } from "@/messages/fr";
import "./globals.css";

export default function GlobalError() {
  const t = messages.errorPages;
  return (
    <html lang="fr">
      <body>
        <main id="main" className={SCREEN_CLASSES}>
          <p className={BRAND_CLASSES}>{messages.brand}</p>
          <h1 className={TITLE_CLASSES}>{t.errorTitle}</h1>
          <p className={LEAD_CLASSES}>{t.errorBody}</p>
          <a href="/accueil" className={TEXT_BUTTON_CLASSES}>
            {t.home}
          </a>
        </main>
      </body>
    </html>
  );
}
