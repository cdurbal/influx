import { defineRouting } from "next-intl/routing";

// Locale routing (01 §5). The proxy only handles the language, never access control.
export const routing = defineRouting({
  locales: ["fr", "en"],
  // Default language: French (00-cadrage.md hypothesis, confirmed by expert-ux).
  defaultLocale: "fr",
  localePrefix: "always",
  // No cookie is ever written (CA8, CA11).
  localeCookie: false,
  // No redirect based on the browser language while the page is a mockup (01 §5).
  localeDetection: false,
});

export type AppLocale = (typeof routing.locales)[number];
