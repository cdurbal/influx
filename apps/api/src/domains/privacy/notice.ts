// The notice that comes with every export (art. 15(1) a-h and 15(2); runbook demandes-rgpd §4,
// completed by expert-conformite-rgpd on 2026-10-14; J8 commit 8). Written in the account's language
// from INFLUX's translation files (src/locales/<language>/data-export.json), handed by the worker to
// privacy.execute_request() and stored inside the file, under `notice`: the digest of the register
// covers it with the data. Its wording waits for the review of a lawyer before the first real
// request (runbook §8) and for expert-conformite-rgpd at the Lot 6 (fiche J8, open decisions).
import { uiLocaleSchema, type UiLocale } from "@influx/contracts/auth";
import english from "../../locales/en/data-export.json" with { type: "json" };
import french from "../../locales/fr/data-export.json" with { type: "json" };

type NoticeMessages = typeof french;

const MESSAGES: Readonly<Record<UiLocale, NoticeMessages>> = {
  fr: french,
  en: english,
};

/**
 * The categories of an export, in the order of the runbook (§4), the same keys in the notice and in
 * the file produced by the database (0136): a category with nothing held is still listed.
 */
export const DATA_EXPORT_CATEGORIES = [
  "account",
  "advertiser_profile",
  "consents",
  "terms_acceptances",
  "sessions",
  "transactional_emails",
  "email_changes",
  "email_delivery_incidents",
  "delivery_reports",
  "brevo_events",
  "activity_log",
  "error_reports",
  "data_requests",
  "recipients",
] as const;

/** The language of the notice: the account's UI language; English for any other value. */
export function noticeLocaleOf(preferredLanguage: string | null): UiLocale {
  const parsed = uiLocaleSchema.safeParse(preferredLanguage);
  return parsed.success ? parsed.data : "en";
}

/** The notice of an export, as stored under `notice` (a JSON object of texts). */
export function exportNotice(
  locale: UiLocale,
): Readonly<Record<string, unknown>> {
  return { language: locale, ...MESSAGES[locale].notice };
}
