// Server side of the member sign-in screens and empty homes (docs/mvp/17 §3.7; 21 §4, J3 commit
// 12). Only the `auth` namespace reaches the browser: the client screens format their counts and
// countdowns themselves (ICU); the landing keeps sending none of its texts.
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { MESSAGES } from "@/i18n/messages";
import type { AppLocale } from "@/i18n/routing";

/** Member pages are never indexed (17 §2.6). */
export async function authMetadata(
  locale: AppLocale,
  title: "signInTitle" | "homeTitle",
): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "auth.meta" });
  return {
    title: t(title),
    robots: { index: false, follow: false },
  };
}

export function AuthMessages({
  locale,
  children,
}: {
  locale: AppLocale;
  children: ReactNode;
}) {
  return (
    <NextIntlClientProvider messages={{ auth: MESSAGES[locale].auth }}>
      {children}
    </NextIntlClientProvider>
  );
}
