"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/class-names";
import {
  BriefcaseIcon,
  CameraIcon,
  CheckIcon,
  CircleAlertIcon,
  InfoIcon,
} from "@/components/ui/icons";
import {
  changeProfile,
  createInitialValues,
  firstInvalidField,
  validateStep,
  type StartFormErrors,
  type StartFormField,
  type StartFormProfile,
  type StartFormStep,
  type StartFormValues,
} from "./start-form-validation";

export type StartFormLabels = {
  /** "Step 1 of 3", "Step 2 of 3", "Step 3 of 3", formatted on the server. */
  progress: Readonly<Record<StartFormStep, string>>;
  stepTitles: Readonly<Record<StartFormStep, string>>;
  requiredLegend: string;
  requiredMark: string;
  actions: { back: string; continue: string; submit: string };
  profile: {
    legend: string;
    options: Readonly<
      Record<StartFormProfile, { title: string; description: string }>
    >;
    errorRequired: string;
  };
  email: { label: string; errorRequired: string; errorFormat: string };
  company: { label: string; errorRequired: string };
  country: {
    labelAdvertiser: string;
    labelCreator: string;
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
  marketingConsent: {
    labelAdvertiser: string;
    labelCreator: string;
    hint: string;
  };
  privacyNotice: string;
  mockupNotice: { title: string; body: string; restart: string };
};

type StartFormStepsProps = {
  /** id of the section h2 naming the form. */
  titleId: string;
  labels: StartFormLabels;
  countries: readonly { code: string; name: string }[];
  pageLocale: string;
};

const ID = "start-form";
const PROFILES: readonly StartFormProfile[] = ["advertiser", "creator"];
const STEPS: readonly StartFormStep[] = [1, 2, 3];

const FIELD_FOCUS_IDS: Readonly<Record<StartFormField, string>> = {
  profile: `${ID}-profile-advertiser`,
  email: `${ID}-email`,
  company: `${ID}-company`,
  country: `${ID}-country`,
  adult: `${ID}-adult`,
  terms: `${ID}-terms`,
};

function errorId(field: StartFormField): string {
  return `${ID}-${field}-error`;
}

function describedBy(
  ...ids: ReadonlyArray<string | false | undefined>
): string | undefined {
  const value = ids.filter(Boolean).join(" ");
  return value === "" ? undefined : value;
}

function inputClassName(hasError: boolean): string {
  return cn(
    "h-(--size-input) w-full rounded-md bg-surface-page px-4 text-md text-text-primary",
    hasError
      ? "border-(length:--border-width-thick) border-border-error"
      : "border-(length:--border-width-thin) border-border-strong",
  );
}

function RequiredMark({ mark }: { mark: string }) {
  return (
    <span aria-hidden="true" className="ml-1 text-feedback-error-text">
      {mark}
    </span>
  );
}

function FieldError({
  field,
  message,
}: {
  field: StartFormField;
  message: string | undefined;
}) {
  if (!message) {
    return null;
  }
  return (
    <p
      id={errorId(field)}
      className="flex items-start gap-1 text-sm text-feedback-error-text"
    >
      <CircleAlertIcon
        aria-hidden="true"
        className="mt-1 size-(--size-icon-sm) shrink-0 text-feedback-error-icon"
      />
      {message}
    </p>
  );
}

/**
 * Mockup sign-up form in three steps (section 16, 02 §3.18). State lives in memory only: no
 * request, no cookie, no web storage, no action attribute (CA8). Validation runs on "Continue" or
 * "Create my account"; afterwards errors update as fields change. Focus moves to the first invalid
 * field, or to the heading of the new step.
 */
export function StartFormSteps({
  titleId,
  labels,
  countries,
  pageLocale,
}: StartFormStepsProps) {
  const [step, setStep] = useState<StartFormStep | "done">(1);
  const [values, setValues] = useState<StartFormValues>(() =>
    createInitialValues(pageLocale),
  );
  const [errors, setErrors] = useState<StartFormErrors>({});
  const [hasAttempted, setHasAttempted] = useState(false);
  const pendingFocusId = useRef<string | null>(null);

  useEffect(() => {
    if (pendingFocusId.current) {
      document.getElementById(pendingFocusId.current)?.focus();
      pendingFocusId.current = null;
    }
  });

  function update(next: StartFormValues) {
    setValues(next);
    if (hasAttempted && step !== "done") {
      setErrors(validateStep(step, next));
    }
  }

  function goToStep(target: StartFormStep) {
    setStep(target);
    setErrors({});
    setHasAttempted(false);
    pendingFocusId.current = `${ID}-step-title`;
  }

  function handlePrimaryAction() {
    if (step === "done") {
      return;
    }
    const stepErrors = validateStep(step, values);
    setErrors(stepErrors);
    setHasAttempted(true);
    const invalidField = firstInvalidField(step, stepErrors);
    if (invalidField) {
      pendingFocusId.current = FIELD_FOCUS_IDS[invalidField];
      return;
    }
    if (step === 3) {
      // Mockup: nothing is sent. The card is replaced by the notice (no loading indicator).
      setStep("done");
      pendingFocusId.current = `${ID}-notice-title`;
      return;
    }
    goToStep(step === 1 ? 2 : 3);
  }

  function handleRestart() {
    setValues(createInitialValues(pageLocale));
    goToStep(1);
  }

  function handleEnter(
    event: KeyboardEvent<HTMLInputElement | HTMLSelectElement>,
  ) {
    if (event.key === "Enter") {
      event.preventDefault();
      handlePrimaryAction();
    }
  }

  if (step === "done") {
    return (
      <div className="rounded-xl border-(length:--border-width-thin) border-border-default bg-metal-card p-inset-card shadow-metal-card">
        <div className="flex flex-col items-start gap-4 rounded-md border-(length:--border-width-thin) border-feedback-info-border bg-feedback-info-bg p-inset-card">
          <h3
            id={`${ID}-notice-title`}
            tabIndex={-1}
            className="flex items-center gap-2 text-heading-3 font-semibold text-feedback-info-text"
          >
            <InfoIcon
              aria-hidden="true"
              className="size-(--size-icon-lg) shrink-0 text-feedback-info-icon"
            />
            {labels.mockupNotice.title}
          </h3>
          <p className="text-md text-text-primary">
            {labels.mockupNotice.body}
          </p>
          <Button variant="secondary" onClick={handleRestart}>
            {labels.mockupNotice.restart}
          </Button>
        </div>
      </div>
    );
  }

  const isAdvertiser = values.profile === "advertiser";
  const isCreator = values.profile === "creator";

  return (
    <div className="rounded-xl border-(length:--border-width-thin) border-border-default bg-metal-card p-inset-card shadow-metal-card">
      <form
        aria-labelledby={titleId}
        noValidate
        autoComplete="off"
        onSubmit={(event) => {
          event.preventDefault();
          handlePrimaryAction();
        }}
        className="flex flex-col gap-stack-lg"
      >
        <div className="flex flex-col gap-3">
          <h3
            id={`${ID}-step-title`}
            tabIndex={-1}
            className="flex flex-col gap-1"
          >
            <span className="text-sm text-text-tertiary">
              {labels.progress[step]}
            </span>
            <span className="text-heading-3 font-semibold text-text-primary">
              {labels.stepTitles[step]}
            </span>
          </h3>
          <div aria-hidden="true" className="grid grid-cols-3 gap-2">
            {STEPS.map((index) => (
              <span
                key={index}
                className={cn(
                  "h-2 rounded-pill",
                  index <= step ? "bg-action-primary-bg" : "bg-border-subtle",
                )}
              />
            ))}
          </div>
        </div>

        {step === 1 ? (
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-3 font-semibold text-text-primary">
              {labels.profile.legend}
              <RequiredMark mark={labels.requiredMark} />
            </legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {PROFILES.map((profile) => {
                const isSelected = values.profile === profile;
                const Icon =
                  profile === "advertiser" ? BriefcaseIcon : CameraIcon;
                const inputId = `${ID}-profile-${profile}`;
                return (
                  <label
                    key={profile}
                    htmlFor={inputId}
                    className={cn(
                      "flex cursor-pointer flex-col gap-2 rounded-md p-4",
                      isSelected
                        ? "border-(length:--border-width-thick) border-border-selected bg-brand-subtle-bg"
                        : errors.profile
                          ? "border-(length:--border-width-thick) border-border-error bg-surface-card"
                          : "border-(length:--border-width-thin) border-border-strong bg-surface-card",
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <input
                        id={inputId}
                        type="radio"
                        name={`${ID}-profile`}
                        value={profile}
                        checked={isSelected}
                        required
                        // aria-invalid is not supported on radios: the error is linked by aria-describedby.
                        aria-describedby={describedBy(
                          errors.profile && errorId("profile"),
                        )}
                        onChange={() => update(changeProfile(values, profile))}
                        className="size-(--size-checkbox) shrink-0 accent-action-primary-bg"
                      />
                      <Icon
                        aria-hidden="true"
                        className="size-(--size-icon-lg) shrink-0 text-text-primary"
                      />
                      <span className="font-semibold text-text-primary">
                        {labels.profile.options[profile].title}
                      </span>
                      {isSelected ? (
                        <CheckIcon
                          aria-hidden="true"
                          className="ml-auto size-(--size-icon-md) shrink-0 text-text-brand-strong"
                        />
                      ) : null}
                    </span>
                    <span className="text-sm text-text-secondary">
                      {labels.profile.options[profile].description}
                    </span>
                  </label>
                );
              })}
            </div>
            <FieldError
              field="profile"
              message={errors.profile && labels.profile.errorRequired}
            />
          </fieldset>
        ) : null}

        {step === 2 ? (
          <div className="flex flex-col gap-stack-md">
            <div className="flex flex-col gap-stack-sm">
              <label
                htmlFor={FIELD_FOCUS_IDS.email}
                className="font-semibold text-text-primary"
              >
                {labels.email.label}
                <RequiredMark mark={labels.requiredMark} />
              </label>
              <input
                id={FIELD_FOCUS_IDS.email}
                type="email"
                inputMode="email"
                required
                value={values.email}
                aria-invalid={errors.email ? true : undefined}
                aria-describedby={describedBy(errors.email && errorId("email"))}
                onChange={(event) =>
                  update({ ...values, email: event.target.value })
                }
                onKeyDown={handleEnter}
                className={inputClassName(Boolean(errors.email))}
              />
              <FieldError
                field="email"
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
                  htmlFor={FIELD_FOCUS_IDS.company}
                  className="font-semibold text-text-primary"
                >
                  {labels.company.label}
                  <RequiredMark mark={labels.requiredMark} />
                </label>
                <input
                  id={FIELD_FOCUS_IDS.company}
                  type="text"
                  maxLength={120}
                  required
                  value={values.company}
                  aria-invalid={errors.company ? true : undefined}
                  aria-describedby={describedBy(
                    errors.company && errorId("company"),
                  )}
                  onChange={(event) =>
                    update({ ...values, company: event.target.value })
                  }
                  onKeyDown={handleEnter}
                  className={inputClassName(Boolean(errors.company))}
                />
                <FieldError
                  field="company"
                  message={errors.company && labels.company.errorRequired}
                />
              </div>
            ) : null}

            <div className="flex flex-col gap-stack-sm">
              <label
                htmlFor={FIELD_FOCUS_IDS.country}
                className="font-semibold text-text-primary"
              >
                {isAdvertiser
                  ? labels.country.labelAdvertiser
                  : labels.country.labelCreator}
                <RequiredMark mark={labels.requiredMark} />
              </label>
              <select
                id={FIELD_FOCUS_IDS.country}
                required
                value={values.country}
                aria-invalid={errors.country ? true : undefined}
                aria-describedby={describedBy(
                  `${ID}-country-info`,
                  errors.country && errorId("country"),
                )}
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
                field="country"
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
          </div>
        ) : null}

        {step === 3 ? (
          <div className="flex flex-col gap-stack-md">
            {isCreator ? (
              <div className="flex items-start gap-3">
                <input
                  id={FIELD_FOCUS_IDS.adult}
                  type="checkbox"
                  required
                  checked={values.adult}
                  aria-invalid={errors.adult ? true : undefined}
                  aria-describedby={describedBy(
                    `${ID}-adult-hint`,
                    errors.adult && errorId("adult"),
                  )}
                  onChange={(event) =>
                    update({ ...values, adult: event.target.checked })
                  }
                  className="mt-1 size-(--size-checkbox) shrink-0 accent-action-primary-bg"
                />
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor={FIELD_FOCUS_IDS.adult}
                    className="cursor-pointer text-text-primary"
                  >
                    {labels.adult.label}
                    <RequiredMark mark={labels.requiredMark} />
                  </label>
                  <p
                    id={`${ID}-adult-hint`}
                    className="text-sm text-text-tertiary"
                  >
                    {labels.adult.hint}
                  </p>
                  <FieldError
                    field="adult"
                    message={errors.adult && labels.adult.errorRequired}
                  />
                </div>
              </div>
            ) : null}

            <div className="flex items-start gap-3">
              <input
                id={FIELD_FOCUS_IDS.terms}
                type="checkbox"
                required
                checked={values.terms}
                aria-invalid={errors.terms ? true : undefined}
                aria-describedby={describedBy(errors.terms && errorId("terms"))}
                onChange={(event) =>
                  update({ ...values, terms: event.target.checked })
                }
                className="mt-1 size-(--size-checkbox) shrink-0 accent-action-primary-bg"
              />
              <div className="flex flex-col gap-1">
                <label
                  htmlFor={FIELD_FOCUS_IDS.terms}
                  className="cursor-pointer text-text-primary"
                >
                  {labels.terms.label}
                  <RequiredMark mark={labels.requiredMark} />
                </label>
                <FieldError
                  field="terms"
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
                  {isAdvertiser
                    ? labels.marketingConsent.labelAdvertiser
                    : labels.marketingConsent.labelCreator}
                </label>
                <p
                  id={`${ID}-marketing-consent-hint`}
                  className="text-sm text-text-tertiary"
                >
                  {labels.marketingConsent.hint}
                </p>
              </div>
            </div>

            <p className="text-sm text-text-secondary">
              {labels.privacyNotice}
            </p>
          </div>
        ) : null}

        <p className="text-sm text-text-tertiary">{labels.requiredLegend}</p>

        <div className="flex gap-3">
          {step > 1 ? (
            <Button
              variant="secondary"
              className="w-1/3 sm:w-auto"
              onClick={() => goToStep(step === 3 ? 2 : 1)}
            >
              {labels.actions.back}
            </Button>
          ) : null}
          <Button
            variant="primary"
            className="flex-1 sm:flex-none"
            onClick={handlePrimaryAction}
          >
            {step === 3 ? labels.actions.submit : labels.actions.continue}
          </Button>
        </div>
      </form>
    </div>
  );
}
