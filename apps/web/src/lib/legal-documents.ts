// The public documents of apps/web and their localized paths (docs/mvp/21 EC-62): /fr/cgu ·
// /en/terms, /fr/confidentialite · /en/privacy, /fr/cookies · /en/cookies. Readable without an
// account (05 RG27). The legal notice and the sales terms are not J5 documents (D25).
import type { PublicDocument } from "@influx/contracts/terms";
import type { AppLocale } from "@/i18n/routing";

export const LEGAL_DOCUMENT_SLUGS: Readonly<
  Record<PublicDocument, Readonly<Record<AppLocale, string>>>
> = {
  terms_of_service: { fr: "cgu", en: "terms" },
  privacy_policy: { fr: "confidentialite", en: "privacy" },
  cookie_policy: { fr: "cookies", en: "cookies" },
};

/** The path of a document in a language, with its locale prefix. */
export function legalDocumentPath(
  document: PublicDocument,
  locale: AppLocale,
): string {
  return `/${locale}/${LEGAL_DOCUMENT_SLUGS[document][locale]}`;
}
