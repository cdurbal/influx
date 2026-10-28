"use client";

// Screen 3, the information (docs/mvp/17 §3.4 to §3.6; 05 RG4, RG11 to RG25, RG31, RG32, RG110,
// RG111, RG115, RG120, RG124, D63). Two variants, never merged: the fields of one door only.
// - Terms and consent: two boxes, never pre-checked, separated by a rule; ticking one never ticks
//   the other (RG23). The consent label is the text of CONSENT_WORDING_KEYS[door], and that exact
//   text is sent as proof (RG32).
// - The terms shown in the panel are the version whose `id` is accepted (RG24).
// - On an error: the list of the fields at the top AND a message per field, focus on the first
//   invalid field, nothing lost (17 §3.5). The checks are those of the contract (signup-form.ts);
//   apps/api decides. No amount, no rate, no percentage anywhere (RG9).
import type { SignupDoor } from "@influx/contracts/auth";
import {
  CONSENT_WORDING_KEYS,
  COMPANY_NAME_MAX_LENGTH,
  DECLARED_STATUSES,
  HEARD_FROM_ANSWERS,
} from "@influx/contracts/signup";
import type { CurrentTermsResponse } from "@influx/contracts/terms";
import { useLocale, useTranslations } from "next-intl";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { readCurrentTerms } from "@/components/legal/legal-documents-api";
import { getLocalizedCountryOptions } from "@/content/country-codes";
import { routing } from "@/i18n/routing";
import {
  CHOICE_INPUT_CLASSES,
  CHOICE_ROW_CLASSES,
  DIVIDER_CLASSES,
  FIELD_CLASSES,
  FIELDSET_CLASSES,
  HELP_CLASSES,
  INFO_CLASSES,
  inputClasses,
  LABEL_CLASSES,
  LEAD_CLASSES,
  PRIMARY_SUBMIT_CLASSES,
  SECONDARY_BUTTON_CLASSES,
  TEXT_BUTTON_CLASSES,
} from "./auth-classes";
import { RequiredMark, StepTitle } from "./AuthScreen";
import { signUp } from "./member-auth";
import {
  buildSignupBody,
  signupResultOf,
  validateSignupDraft,
  type AcquisitionInput,
  type SignupDraft,
  type SignupField,
  type SignupFieldError,
  type SignupFieldIssue,
  type SignupResult,
} from "./signup-form";
import { TermsDialog } from "./TermsDialog";
import { ErrorNotice } from "@/components/ui/ErrorNotice";

type TermsState =
  | { kind: "loading" }
  | { kind: "ready"; terms: CurrentTermsResponse }
  | { kind: "unavailable" };

/** A refusal shown at the top of the form, the answers kept. */
type FormMessage = "countryBlocked" | "unavailable" | null;

/** The outcomes the parent handles: a session opened, or no way forward from this screen. */
export type SignupExit = Extract<
  SignupResult,
  { kind: "signedUp" | "accountUnavailable" | "sessionLost" }
>;

type FocusableField = HTMLInputElement | HTMLSelectElement;

export function SignupDetailsStep({
  door,
  email,
  draft,
  onDraftChange,
  acquisition,
  online,
  onChangeDoor,
  onExit,
}: {
  door: SignupDoor;
  email: string;
  draft: SignupDraft;
  onDraftChange: (draft: SignupDraft) => void;
  acquisition: () => AcquisitionInput | undefined;
  online: boolean;
  onChangeDoor: () => void;
  onExit: (exit: SignupExit) => void;
}) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const fieldRefs = useRef<Partial<Record<SignupField, FocusableField | null>>>(
    {},
  );
  const ids = {
    summary: useId(),
    company: useId(),
    companyError: useId(),
    country: useId(),
    countryHelp: useId(),
    countryError: useId(),
    languageHelp: useId(),
    statusError: useId(),
    adultHelp: useId(),
    adultError: useId(),
    heardFrom: useId(),
    termsError: useId(),
    consentError: useId(),
  };
  const [issues, setIssues] = useState<SignupFieldIssue[]>([]);
  const [formMessage, setFormMessage] = useState<FormMessage>(null);
  const [termsOutdated, setTermsOutdated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [terms, setTerms] = useState<TermsState>({ kind: "loading" });
  // Bumped to read the version in force again (retry, or terms_outdated).
  const [termsAttempt, setTermsAttempt] = useState(0);
  const [termsOpen, setTermsOpen] = useState(false);
  const countries = useMemo(() => getLocalizedCountryOptions(locale), [locale]);

  useEffect(() => {
    let active = true;
    void readCurrentTerms("terms_of_service", locale).then((result) => {
      if (active) {
        setTerms(
          result.kind === "ok"
            ? { kind: "ready", terms: result.data }
            : { kind: "unavailable" },
        );
      }
    });
    return () => {
      active = false;
    };
  }, [locale, termsAttempt]);

  function reloadTerms() {
    setTerms({ kind: "loading" });
    setTermsAttempt((count) => count + 1);
  }

  function update(changes: Partial<SignupDraft>) {
    onDraftChange({ ...draft, ...changes });
  }

  function errorOf(field: SignupField): SignupFieldError | null {
    return issues.find((issue) => issue.field === field)?.error ?? null;
  }

  function fieldMessage(issue: SignupFieldIssue): string {
    switch (issue.field) {
      case "companyName":
        return t(`signup.company.errors.${issue.error}`);
      case "countryCode":
        return t("signup.country.errors.required");
      case "declaredStatus":
        return t("signup.status.errors.required");
      case "adultAttested":
        return t("signup.adult.errors.required");
      case "termsAccepted":
        return t("signup.terms.errors.required");
      case "marketingConsent":
        return t("signup.consent.errors.required");
    }
  }

  /** The ids of a control's help and error texts, for aria-describedby. */
  function describedBy(
    ...parts: ReadonlyArray<string | false | null>
  ): string | undefined {
    const value = parts.filter(Boolean).join(" ");
    return value === "" ? undefined : value;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !online) {
      return; // 05 RG110: a double submission has no effect; offline, the banner explains.
    }
    setFormMessage(null);
    const found = validateSignupDraft(door, draft);
    setIssues(found);
    const first = found[0];
    if (first !== undefined) {
      fieldRefs.current[first.field]?.focus();
      return;
    }
    if (terms.kind !== "ready") {
      setFormMessage("unavailable");
      return;
    }
    const body = buildSignupBody(door, draft, {
      termsVersionId: terms.terms.id,
      consentWording: t(CONSENT_WORDING_KEYS[door]),
      displayLocale: locale,
      acquisition: acquisition(),
    });
    if (body === null) {
      setFormMessage("unavailable");
      return;
    }
    setBusy(true);
    try {
      const result = signupResultOf(await signUp(body));
      switch (result.kind) {
        case "countryBlocked":
          // 05 RG8: a neutral message, nothing created; the country stays editable.
          setFormMessage("countryBlocked");
          fieldRefs.current.countryCode?.focus();
          return;
        case "termsOutdated":
          // 05 RG25: a newer version is in force; it must be read and accepted again.
          update({ termsAccepted: false });
          setTermsOutdated(true);
          reloadTerms();
          fieldRefs.current.termsAccepted?.focus();
          return;
        case "unavailable":
          setFormMessage("unavailable");
          return;
        default:
          onExit(result);
      }
    } finally {
      setBusy(false);
    }
  }

  const companyError = errorOf("companyName");
  const countryError = errorOf("countryCode");
  const statusError = errorOf("declaredStatus");
  const adultError = errorOf("adultAttested");
  const termsError = errorOf("termsAccepted");
  const consentError = errorOf("marketingConsent");
  const termsMessage =
    termsError !== null
      ? t("signup.terms.errors.required")
      : termsOutdated
        ? t("signup.terms.errors.outdated")
        : null;

  return (
    <>
      <StepTitle step={3}>{t(`signup.title.${door}`)}</StepTitle>
      <p className={LEAD_CLASSES}>{t("signup.verifiedEmail", { email })}</p>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-md text-text-primary">
          {t.rich(`step1.roleRecap.${door}`, {
            strong: (chunks) => (
              <strong className="font-bold uppercase">{chunks}</strong>
            ),
          })}
        </p>
        <button
          type="button"
          onClick={onChangeDoor}
          className={TEXT_BUTTON_CLASSES}
        >
          {t("step1.roleChange")}
        </button>
      </div>
      <p className={HELP_CLASSES}>{t("signup.requiredLegend")}</p>
      {issues.length > 0 ? (
        <ErrorNotice id={ids.summary}>
          <p className="font-semibold">{t("signup.errors.summary")}</p>
          <ul className="list-disc pl-5">
            {issues.map((issue) => (
              <li key={issue.field}>{fieldMessage(issue)}</li>
            ))}
          </ul>
        </ErrorNotice>
      ) : null}
      {formMessage !== null ? (
        <ErrorNotice>{t(`signup.errors.${formMessage}`)}</ErrorNotice>
      ) : null}
      <form noValidate onSubmit={submit} className="flex flex-col gap-6">
        {door === "advertiser" ? (
          <div className={FIELD_CLASSES}>
            <label htmlFor={ids.company} className={LABEL_CLASSES}>
              {t("signup.company.label")} <RequiredMark />
            </label>
            <input
              ref={(element) => {
                fieldRefs.current.companyName = element;
              }}
              id={ids.company}
              type="text"
              autoComplete="organization"
              maxLength={COMPANY_NAME_MAX_LENGTH}
              required
              value={draft.companyName}
              aria-invalid={companyError !== null ? true : undefined}
              aria-describedby={describedBy(
                companyError !== null && ids.companyError,
              )}
              onChange={(event) => update({ companyName: event.target.value })}
              className={inputClasses(companyError !== null)}
            />
            {companyError !== null ? (
              <ErrorNotice id={ids.companyError} announce={false}>
                {t(`signup.company.errors.${companyError}`)}
              </ErrorNotice>
            ) : null}
          </div>
        ) : null}

        <div className={FIELD_CLASSES}>
          <label htmlFor={ids.country} className={LABEL_CLASSES}>
            {t(`signup.country.label.${door}`)} <RequiredMark />
          </label>
          <select
            ref={(element) => {
              fieldRefs.current.countryCode = element;
            }}
            id={ids.country}
            required
            autoComplete="country"
            value={draft.countryCode}
            aria-invalid={countryError !== null ? true : undefined}
            aria-describedby={describedBy(
              ids.countryHelp,
              countryError !== null && ids.countryError,
            )}
            onChange={(event) => update({ countryCode: event.target.value })}
            className={inputClasses(countryError !== null)}
          >
            <option value="">{t("signup.country.emptyOption")}</option>
            {countries.map((country) => (
              <option key={country.code} value={country.code}>
                {country.name}
              </option>
            ))}
          </select>
          <p id={ids.countryHelp} className={INFO_CLASSES}>
            {t("signup.country.help")}
          </p>
          {countryError !== null ? (
            <ErrorNotice id={ids.countryError} announce={false}>
              {t("signup.country.errors.required")}
            </ErrorNotice>
          ) : null}
        </div>

        <fieldset
          className={FIELDSET_CLASSES}
          aria-describedby={ids.languageHelp}
        >
          <legend className={LABEL_CLASSES}>
            {t("signup.language.legend")} <RequiredMark />
          </legend>
          <p id={ids.languageHelp} className={HELP_CLASSES}>
            {t("signup.language.help")}
          </p>
          {routing.locales.map((option) => (
            <label key={option} className={CHOICE_ROW_CLASSES}>
              <input
                type="radio"
                name="preferredLanguage"
                value={option}
                checked={draft.preferredLanguage === option}
                onChange={() => update({ preferredLanguage: option })}
                className={CHOICE_INPUT_CLASSES}
              />
              <span lang={option}>{t(`language.${option}`)}</span>
            </label>
          ))}
        </fieldset>

        {door === "creator" ? (
          <>
            <fieldset
              className={FIELDSET_CLASSES}
              aria-describedby={describedBy(
                statusError !== null && ids.statusError,
              )}
            >
              <legend className={LABEL_CLASSES}>
                {t("signup.status.legend")} <RequiredMark />
              </legend>
              {DECLARED_STATUSES.map((status, index) => (
                <label key={status} className={CHOICE_ROW_CLASSES}>
                  <input
                    ref={
                      index === 0
                        ? (element) => {
                            fieldRefs.current.declaredStatus = element;
                          }
                        : undefined
                    }
                    type="radio"
                    name="declaredStatus"
                    value={status}
                    required
                    checked={draft.declaredStatus === status}
                    onChange={() => update({ declaredStatus: status })}
                    className={CHOICE_INPUT_CLASSES}
                  />
                  <span>{t(`signup.status.${status}`)}</span>
                </label>
              ))}
              {statusError !== null ? (
                <ErrorNotice id={ids.statusError} announce={false}>
                  {t("signup.status.errors.required")}
                </ErrorNotice>
              ) : null}
            </fieldset>

            <div className={FIELD_CLASSES}>
              <label className={CHOICE_ROW_CLASSES}>
                <input
                  ref={(element) => {
                    fieldRefs.current.adultAttested = element;
                  }}
                  type="checkbox"
                  required
                  checked={draft.adultAttested}
                  aria-invalid={adultError !== null ? true : undefined}
                  aria-describedby={describedBy(
                    ids.adultHelp,
                    adultError !== null && ids.adultError,
                  )}
                  onChange={(event) =>
                    update({ adultAttested: event.target.checked })
                  }
                  className={CHOICE_INPUT_CLASSES}
                />
                <span>
                  {t("signup.adult.label")} <RequiredMark />
                </span>
              </label>
              <p id={ids.adultHelp} className={HELP_CLASSES}>
                {t("signup.adult.help")}
              </p>
              {adultError !== null ? (
                <ErrorNotice id={ids.adultError} announce={false}>
                  {t("signup.adult.errors.required")}
                </ErrorNotice>
              ) : null}
            </div>
          </>
        ) : null}

        <div className={FIELD_CLASSES}>
          <label htmlFor={ids.heardFrom} className={LABEL_CLASSES}>
            {t("signup.heardFrom.label")}
          </label>
          <select
            id={ids.heardFrom}
            value={draft.heardFrom}
            onChange={(event) => {
              const answer = HEARD_FROM_ANSWERS.find(
                (option) => option === event.target.value,
              );
              update({ heardFrom: answer ?? "" });
            }}
            className={inputClasses(false)}
          >
            <option value="">{t("signup.heardFrom.emptyOption")}</option>
            {HEARD_FROM_ANSWERS.map((answer) => (
              <option key={answer} value={answer}>
                {t(`signup.heardFrom.options.${answer}`)}
              </option>
            ))}
          </select>
        </div>

        <hr className={DIVIDER_CLASSES} />

        <div className={FIELD_CLASSES}>
          <label className={CHOICE_ROW_CLASSES}>
            <input
              ref={(element) => {
                fieldRefs.current.termsAccepted = element;
              }}
              type="checkbox"
              required
              checked={draft.termsAccepted}
              aria-invalid={termsMessage !== null ? true : undefined}
              aria-describedby={describedBy(
                termsMessage !== null && ids.termsError,
              )}
              onChange={(event) =>
                update({ termsAccepted: event.target.checked })
              }
              className={CHOICE_INPUT_CLASSES}
            />
            <span>
              {t("signup.terms.label")} <RequiredMark />
            </span>
          </label>
          {terms.kind === "ready" ? (
            <button
              type="button"
              aria-haspopup="dialog"
              onClick={() => setTermsOpen(true)}
              className={TEXT_BUTTON_CLASSES}
            >
              {t("signup.terms.read")}
            </button>
          ) : terms.kind === "loading" ? (
            <p role="status" className={HELP_CLASSES}>
              {t("signup.terms.loading")}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <ErrorNotice>{t("signup.terms.unavailable")}</ErrorNotice>
              <button
                type="button"
                onClick={reloadTerms}
                className={SECONDARY_BUTTON_CLASSES}
              >
                {t("signup.terms.retry")}
              </button>
            </div>
          )}
          {termsMessage !== null ? (
            <ErrorNotice id={ids.termsError} announce={false}>
              {termsMessage}
            </ErrorNotice>
          ) : null}
        </div>

        <hr className={DIVIDER_CLASSES} />

        <div className={FIELD_CLASSES}>
          <label className={CHOICE_ROW_CLASSES}>
            <input
              ref={(element) => {
                fieldRefs.current.marketingConsent = element;
              }}
              type="checkbox"
              required
              checked={draft.marketingConsent}
              aria-invalid={consentError !== null ? true : undefined}
              aria-describedby={describedBy(
                consentError !== null && ids.consentError,
              )}
              onChange={(event) =>
                update({ marketingConsent: event.target.checked })
              }
              className={CHOICE_INPUT_CLASSES}
            />
            {/* RG32: this exact text is the one sent as proof; nothing is added inside it. */}
            <span>
              <span>{t(CONSENT_WORDING_KEYS[door])}</span> <RequiredMark />
            </span>
          </label>
          {consentError !== null ? (
            <ErrorNotice id={ids.consentError} announce={false}>
              {t("signup.consent.errors.required")}
            </ErrorNotice>
          ) : null}
        </div>

        <button
          type="submit"
          aria-disabled={busy || !online || undefined}
          className={PRIMARY_SUBMIT_CLASSES}
        >
          {busy ? t("signup.submitBusy") : t("signup.submit")}
        </button>
      </form>
      {terms.kind === "ready" ? (
        <TermsDialog
          terms={terms.terms}
          open={termsOpen}
          onClose={() => setTermsOpen(false)}
        />
      ) : null}
    </>
  );
}
