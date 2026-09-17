"use client";

import { useState, type KeyboardEvent } from "react";
import {
  validateStep,
  type StartFormErrors,
  type StartFormField,
  type StartFormProfile,
  type StartFormValues,
} from "@/components/landing/start-form-validation";
import { Button } from "@/components/ui/Button";
import {
  FieldError,
  inputClassName,
  RequiredMark,
} from "@/components/ui/form-controls";
import { InfoIcon } from "@/components/ui/icons";
import { LinkButton } from "@/components/ui/LinkButton";

export type AccountFormLabels = {
  requiredLegend: string;
  requiredMark: string;
  email: { label: string; errorRequired: string; errorFormat: string };
  company: { label: string; errorRequired: string };
  country: {
    label: string;
    emptyOption: string;
    openCountriesInfo: string;
    errorRequired: string;
  };
  language: {
    legend: string;
    options: readonly { locale: string; name: string }[];
  };
  adult: { label: string; hint: string; errorRequired: string };
  terms: { label: string; errorRequired: string };
  marketingConsent: { label: string; hint: string };
  privacyNotice: string;
  submit: string;
  success: { title: string; body: string; cta: string };
};

type AccountFormProps = {
  titleId: string;
  profile: StartFormProfile;
  labels: AccountFormLabels;
  countries: readonly { code: string; name: string }[];
  pageLocale: string;
};

const ID = "account-form";
// Focus order: the only fields this single-step form can show (start-form-validation.ts
// already scopes "company" to advertiser and "adult" to creator).
const FIELD_ORDER: readonly StartFormField[] = [
  "email",
  "company",
  "country",
  "adult",
  "terms",
];

function firstInvalidField(errors: StartFormErrors): StartFormField | null {
  return FIELD_ORDER.find((field) => errors[field] !== undefined) ?? null;
}

/**
 * One-page mocked sign-up (docs/landing-page/00-cadrage.md §6), profile fixed by the route
 * (/signup/advertiser or /signup/creator): unlike the embedded 02 §3.18 form, the profile step
 * is skipped since the door already chose it. Validation rules are shared with that form via
 * start-form-validation.ts so the sign-up rules exist in a single place. Nothing is sent or
 * stored: submitting only flips to a local "done" state.
 */
export function AccountForm({
  titleId,
  profile,
  labels,
  countries,
  pageLocale,
}: AccountFormProps) {
  const [values, setValues] = useState<StartFormValues>({
    profile,
    email: "",
    company: "",
    country: "",
    language: pageLocale,
    adult: false,
    terms: false,
    marketingConsent: false,
  });
  const [errors, setErrors] = useState<StartFormErrors>({});
  const [hasAttempted, setHasAttempted] = useState(false);
  const [done, setDone] = useState(false);

  const isAdvertiser = profile === "advertiser";
  const isCreator = profile === "creator";

  function update(next: StartFormValues) {
    setValues(next);
    if (hasAttempted) {
      setErrors({ ...validateStep(2, next), ...validateStep(3, next) });
    }
  }

  function handleSubmit() {
    const nextErrors = { ...validateStep(2, values), ...validateStep(3, values) };
    setErrors(nextErrors);
    setHasAttempted(true);
    const invalidField = firstInvalidField(nextErrors);
    if (invalidField) {
      document.getElementById(`${ID}-${invalidField}`)?.focus();
      return;
    }
    setDone(true);
    document.getElementById(`${ID}-success-title`)?.focus();
  }

  function handleEnter(
    event: KeyboardEvent<HTMLInputElement | HTMLSelectElement>,
  ) {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSubmit();
    }
  }

  if (done) {
    return (
      <div className="rounded-lg bg-surface-raised p-inset-card shadow-md">
        <div className="flex flex-col items-start gap-4 rounded-md border-(length:--border-width-thin) border-feedback-info-border bg-feedback-info-bg p-inset-card">
          <h2
            id={`${ID}-success-title`}
            tabIndex={-1}
            className="flex items-center gap-2 text-heading-3 font-semibold text-feedback-info-text"
          >
            <InfoIcon
              aria-hidden="true"
              className="size-(--size-icon-lg) shrink-0 text-feedback-info-icon"
            />
            {labels.success.title}
          </h2>
          <p className="text-md text-text-primary">{labels.success.body}</p>
          <LinkButton
            href={{ pathname: "/space", query: { profile } }}
            variant="primary"
          >
            {labels.success.cta}
          </LinkButton>
        </div>
      </div>
    );
  }

  return (
    <form
      aria-labelledby={titleId}
      noValidate
      autoComplete="off"
      onSubmit={(event) => {
        event.preventDefault();
        handleSubmit();
      }}
      className="flex flex-col gap-stack-lg rounded-lg bg-surface-raised p-inset-card shadow-md"
    >
      <div className="flex flex-col gap-stack-sm">
        <label
          htmlFor={`${ID}-email`}
          className="font-semibold text-text-primary"
        >
          {labels.email.label}
          <RequiredMark mark={labels.requiredMark} />
        </label>
        <input
          id={`${ID}-email`}
          type="email"
          inputMode="email"
          required
          value={values.email}
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? `${ID}-email-error` : undefined}
          onChange={(event) => update({ ...values, email: event.target.value })}
          onKeyDown={handleEnter}
          className={inputClassName(Boolean(errors.email))}
        />
        <FieldError
          id={`${ID}-email-error`}
          message={
            errors.email === "format"
              ? labels.email.errorFormat
              : errors.email && labels.email.errorRequired
          }
        />
      </div>

      {isAdvertiser ? (
        <div className="flex flex-col gap-stack-sm">
          <label
            htmlFor={`${ID}-company`}
            className="font-semibold text-text-primary"
          >
            {labels.company.label}
            <RequiredMark mark={labels.requiredMark} />
          </label>
          <input
            id={`${ID}-company`}
            type="text"
            maxLength={120}
            required
            value={values.company}
            aria-invalid={errors.company ? true : undefined}
            aria-describedby={
              errors.company ? `${ID}-company-error` : undefined
            }
            onChange={(event) =>
              update({ ...values, company: event.target.value })
            }
            onKeyDown={handleEnter}
            className={inputClassName(Boolean(errors.company))}
          />
          <FieldError
            id={`${ID}-company-error`}
            message={errors.company && labels.company.errorRequired}
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-stack-sm">
        <label
          htmlFor={`${ID}-country`}
          className="font-semibold text-text-primary"
        >
          {labels.country.label}
          <RequiredMark mark={labels.requiredMark} />
        </label>
        <select
          id={`${ID}-country`}
          required
          value={values.country}
          aria-invalid={errors.country ? true : undefined}
          aria-describedby={`${ID}-country-info${errors.country ? ` ${ID}-country-error` : ""}`}
          onChange={(event) =>
            update({ ...values, country: event.target.value })
          }
          onKeyDown={handleEnter}
          className={inputClassName(Boolean(errors.country))}
        >
          <option value="">{labels.country.emptyOption}</option>
          {countries.map((country) => (
            <option key={country.code} value={country.code}>
              {country.name}
            </option>
          ))}
        </select>
        <FieldError
          id={`${ID}-country-error`}
          message={errors.country && labels.country.errorRequired}
        />
        <p
          id={`${ID}-country-info`}
          className="flex items-start gap-2 rounded-md border-(length:--border-width-thin) border-feedback-info-border bg-feedback-info-bg p-3 text-sm text-feedback-info-text"
        >
          <InfoIcon
            aria-hidden="true"
            className="mt-1 size-(--size-icon-sm) shrink-0 text-feedback-info-icon"
          />
          {labels.country.openCountriesInfo}
        </p>
      </div>

      <fieldset className="flex flex-col gap-stack-sm">
        <legend className="mb-2 font-semibold text-text-primary">
          {labels.language.legend}
          <RequiredMark mark={labels.requiredMark} />
        </legend>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {labels.language.options.map((option) => {
            const inputId = `${ID}-language-${option.locale}`;
            return (
              <label
                key={option.locale}
                htmlFor={inputId}
                className="flex min-h-(--size-touch-target) cursor-pointer items-center gap-3 text-text-primary"
              >
                <input
                  id={inputId}
                  type="radio"
                  name={`${ID}-language`}
                  value={option.locale}
                  checked={values.language === option.locale}
                  onChange={() =>
                    update({ ...values, language: option.locale })
                  }
                  className="size-(--size-checkbox) shrink-0 accent-action-primary-bg"
                />
                <span lang={option.locale}>{option.name}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {isCreator ? (
        <div className="flex items-start gap-3">
          <input
            id={`${ID}-adult`}
            type="checkbox"
            required
            checked={values.adult}
            aria-invalid={errors.adult ? true : undefined}
            aria-describedby={`${ID}-adult-hint${errors.adult ? ` ${ID}-adult-error` : ""}`}
            onChange={(event) =>
              update({ ...values, adult: event.target.checked })
            }
            className="mt-1 size-(--size-checkbox) shrink-0 accent-action-primary-bg"
          />
          <div className="flex flex-col gap-1">
            <label
              htmlFor={`${ID}-adult`}
              className="cursor-pointer text-text-primary"
            >
              {labels.adult.label}
              <RequiredMark mark={labels.requiredMark} />
            </label>
            <p id={`${ID}-adult-hint`} className="text-sm text-text-tertiary">
              {labels.adult.hint}
            </p>
            <FieldError
              id={`${ID}-adult-error`}
              message={errors.adult && labels.adult.errorRequired}
            />
          </div>
        </div>
      ) : null}

      <div className="flex items-start gap-3">
        <input
          id={`${ID}-terms`}
          type="checkbox"
          required
          checked={values.terms}
          aria-invalid={errors.terms ? true : undefined}
          aria-describedby={errors.terms ? `${ID}-terms-error` : undefined}
          onChange={(event) =>
            update({ ...values, terms: event.target.checked })
          }
          className="mt-1 size-(--size-checkbox) shrink-0 accent-action-primary-bg"
        />
        <div className="flex flex-col gap-1">
          <label
            htmlFor={`${ID}-terms`}
            className="cursor-pointer text-text-primary"
          >
            {labels.terms.label}
            <RequiredMark mark={labels.requiredMark} />
          </label>
          <FieldError
            id={`${ID}-terms-error`}
            message={errors.terms && labels.terms.errorRequired}
          />
        </div>
      </div>

      <div className="flex items-start gap-3">
        <input
          id={`${ID}-marketing-consent`}
          type="checkbox"
          checked={values.marketingConsent}
          aria-describedby={`${ID}-marketing-consent-hint`}
          onChange={(event) =>
            update({ ...values, marketingConsent: event.target.checked })
          }
          className="mt-1 size-(--size-checkbox) shrink-0 accent-action-primary-bg"
        />
        <div className="flex flex-col gap-1">
          <label
            htmlFor={`${ID}-marketing-consent`}
            className="cursor-pointer text-text-primary"
          >
            {labels.marketingConsent.label}
          </label>
          <p
            id={`${ID}-marketing-consent-hint`}
            className="text-sm text-text-tertiary"
          >
            {labels.marketingConsent.hint}
          </p>
        </div>
      </div>

      <p className="text-sm text-text-secondary">{labels.privacyNotice}</p>
      <p className="text-sm text-text-tertiary">{labels.requiredLegend}</p>

      <Button variant="primary" fullWidth onClick={handleSubmit}>
        {labels.submit}
      </Button>
    </form>
  );
}
