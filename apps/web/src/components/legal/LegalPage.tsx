// Server side of the public document pages (docs/mvp/21 EC-62; 05 RG27): readable without an
// account, one localized path per language (src/lib/legal-documents.ts). The page renders its
// frame and its h1 on the server; the text is read by LegalDocumentView through the relay, the
// one path of this front to apps/api (03 PP-12). Only the `legal` namespace reaches the browser.
import type { PublicDocument } from "@influx/contracts/terms";
import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import {
  BRAND_CLASSES,
  SCREEN_CLASSES,
  TITLE_CLASSES,
} from "@/components/auth/auth-classes";
import { Link } from "@/i18n/navigation";
import { MESSAGES } from "@/i18n/messages";
import { routing } from "@/i18n/routing";
import { LEGAL_DOCUMENT_SLUGS, legalDocumentPath } from "@/lib/legal-documents";
import { LegalDocumentView } from "./LegalDocumentView";

export async function legalMetadata(
  locale: string,
  document: PublicDocument,
): Promise<Metadata> {
  if (!hasLocale(routing.locales, locale)) {
    return {};
  }
  const t = await getTranslations({ locale, namespace: "legal" });
  return { title: t("metaTitle", { title: t(`documents.${document}`) }) };
}

/**
 * `slug` is the folder of the page: a language whose path is another one is sent there
 * (/en/cgu → /en/terms), so that each document has one address per language.
 */
export async function LegalPage({
  locale,
  document,
  slug,
}: {
  locale: string;
  document: PublicDocument;
  slug: string;
}) {
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  if (LEGAL_DOCUMENT_SLUGS[document][locale] !== slug) {
    redirect(legalDocumentPath(document, locale));
  }
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "legal" });
  return (
    <NextIntlClientProvider messages={{ legal: MESSAGES[locale].legal }}>
      <main id="main" className={SCREEN_CLASSES}>
        <Link href="/" className={BRAND_CLASSES}>
          {t("brand")}
        </Link>
        <h1 className={TITLE_CLASSES}>{t(`documents.${document}`)}</h1>
        <LegalDocumentView document={document} />
      </main>
    </NextIntlClientProvider>
  );
}
