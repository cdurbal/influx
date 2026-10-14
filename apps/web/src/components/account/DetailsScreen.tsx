"use client";

// "Mes informations" (docs/mvp/17 §6.1; 05 RG15, RG22, RG58): the fields of the Lot 1, the
// changed ones only sent (PATCH /v1/me), those of the member's role only. Each change feeds the
// CRM (lead.updated): the screen does not say it in jargon, it links to the privacy policy. The
// address is a journey of its own (EmailChange).
import { useLocale, useTranslations } from "next-intl";
import { useId, useMemo, useState, type FormEvent } from "react";
import {
  CARD_CLASSES,
  CHOICE_INPUT_CLASSES,
  CHOICE_ROW_CLASSES,
  ERROR_CLASSES,
  FIELD_CLASSES,
  FIELDSET_CLASSES,
  HELP_CLASSES,
  inputClasses,
  LABEL_CLASSES,
  LEAD_CLASSES,
  PRIMARY_SUBMIT_CLASSES,
  TITLE_CLASSES,
} from "@/components/auth/auth-classes";
import { getLocalizedCountryOptions } from "@/content/country-codes";
import { Link } from "@/i18n/navigation";
import { LEGAL_DOCUMENT_SLUGS } from "@/lib/legal-documents";
import { INLINE_LINK_CLASSES, SUCCESS_CLASSES } from "./account-classes";
import { updateMe } from "./account-api";
import {
  changedFieldsOf,
  detailsFormMessage,
  detailsRefusalOf,
  draftOf,
  type DetailsDraft,
  type DetailsMessage,
} from "./account-view";
import type { AccountContext } from "./AccountShell";
import { EmailChange } from "./EmailChange";

const LANGUAGES = ["fr", "en"] as const;
const STATUSES = ["individual", "business"] as const;

export function DetailsScreen({ me, online, refresh }: AccountContext) {
  const t = useTranslations("account.details");
  const locale = useLocale();
  const ids = {
    country: useId(),
    countryHelp: useId(),
    language: useId(),
    company: useId(),
    message: useId(),
  };
  const countries = useMemo(() => getLocalizedCountryOptions(locale), [locale]);
  const [draft, setDraft] = useState<DetailsDraft>(() => draftOf(me));
  const [message, setMessage] = useState<DetailsMessage | "unchanged" | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  function update(change: Partial<DetailsDraft>) {
    setDraft({ ...draft, ...change });
    setMessage(null);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !online) {
      return;
    }
    const formMessage = detailsFormMessage(me, draft);
    if (formMessage !== null) {
      setMessage(formMessage);
      return;
    }
    const body = changedFieldsOf(me, draft);
    if (body === null) {
      setMessage("unchanged");
      return;
    }
    setBusy(true);
    try {
      const result = await updateMe(body);
      if (result.kind === "ok") {
        setDraft(draftOf(result.data));
        setMessage("saved");
        await refresh();
        return;
      }
      setMessage(detailsRefusalOf(result));
    } finally {
      setBusy(false);
    }
  }

  const privacyHref = `/${LEGAL_DOCUMENT_SLUGS.privacy_policy[locale]}`;
  const isError =
    message !== null && message !== "saved" && message !== "unchanged";

  return (
    <>
      <h1 className={TITLE_CLASSES}>{t("title")}</h1>
      <p className={LEAD_CLASSES}>
        {t("lead")}{" "}
        <Link href={privacyHref} className={INLINE_LINK_CLASSES}>
          {t("privacy")}
        </Link>
      </p>
      <EmailChange me={me} online={online} onCompleted={refresh} />
      <form noValidate onSubmit={save} className={CARD_CLASSES}>
        <div className={FIELD_CLASSES}>
          <label htmlFor={ids.country} className={LABEL_CLASSES}>
            {t("country.label")}
          </label>
          <select
            id={ids.country}
            autoComplete="country"
            value={draft.countryCode}
            aria-describedby={ids.countryHelp}
            onChange={(event) => update({ countryCode: event.target.value })}
            className={inputClasses(message === "countryUnavailable")}
          >
            {countries.map((country) => (
              <option key={country.code} value={country.code}>
                {country.name}
              </option>
            ))}
          </select>
          <p id={ids.countryHelp} className={HELP_CLASSES}>
            {t("country.help")}
          </p>
        </div>
        <div className={FIELD_CLASSES}>
          <label htmlFor={ids.language} className={LABEL_CLASSES}>
            {t("language.label")}
          </label>
          <select
            id={ids.language}
            value={draft.preferredLanguage}
            onChange={(event) =>
              update({
                preferredLanguage: event.target.value === "en" ? "en" : "fr",
              })
            }
            className={inputClasses(false)}
          >
            {LANGUAGES.map((language) => (
              <option key={language} value={language} lang={language}>
                {t(`language.${language}`)}
              </option>
            ))}
          </select>
        </div>
        {me.role === "creator" ? (
          <fieldset className={FIELDSET_CLASSES}>
            <legend className={LABEL_CLASSES}>{t("status.legend")}</legend>
            {STATUSES.map((status) => (
              <label key={status} className={CHOICE_ROW_CLASSES}>
                <input
                  type="radio"
                  name="declaredStatus"
                  value={status}
                  checked={draft.declaredStatus === status}
                  onChange={() => update({ declaredStatus: status })}
                  className={CHOICE_INPUT_CLASSES}
                />
                <span>{t(`status.${status}`)}</span>
              </label>
            ))}
          </fieldset>
        ) : (
          <div className={FIELD_CLASSES}>
            <label htmlFor={ids.company} className={LABEL_CLASSES}>
              {t("company.label")}
            </label>
            <input
              id={ids.company}
              type="text"
              autoComplete="organization"
              value={draft.companyName}
              aria-invalid={
                message === "companyRequired" || message === "companyInvalid"
                  ? true
                  : undefined
              }
              aria-describedby={isError ? ids.message : undefined}
              onChange={(event) => update({ companyName: event.target.value })}
              className={inputClasses(
                message === "companyRequired" || message === "companyInvalid",
              )}
            />
          </div>
        )}
        {message !== null ? (
          <p
            id={ids.message}
            role={isError ? "alert" : "status"}
            className={
              isError
                ? ERROR_CLASSES
                : message === "saved"
                  ? SUCCESS_CLASSES
                  : HELP_CLASSES
            }
          >
            {t(`messages.${message}`)}
          </p>
        ) : null}
        <button
          type="submit"
          aria-disabled={busy || !online || undefined}
          className={PRIMARY_SUBMIT_CLASSES}
        >
          {busy ? t("saving") : t("save")}
        </button>
      </form>
    </>
  );
}
