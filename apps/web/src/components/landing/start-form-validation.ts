// Client-side checks of the mockup sign-up form (02 §3.18). Pure functions, no I/O: nothing is
// sent nor stored (CA8). The real sign-up of Lot 1 will validate again on the server.

export type StartFormProfile = "advertiser" | "creator";

export type StartFormStep = 1 | 2 | 3;

export type StartFormValues = {
  profile: StartFormProfile | null;
  email: string;
  company: string;
  country: string;
  language: string;
  adult: boolean;
  terms: boolean;
  marketingConsent: boolean;
};

export type StartFormField =
  "profile" | "email" | "company" | "country" | "adult" | "terms";

export type StartFormErrorCode = "required" | "format";

export type StartFormErrors = Partial<
  Record<StartFormField, StartFormErrorCode>
>;

/** Fields of each step, in display order: the first invalid one receives focus. */
export const STEP_FIELDS: Readonly<
  Record<StartFormStep, readonly StartFormField[]>
> = {
  1: ["profile"],
  2: ["email", "company", "country"],
  3: ["adult", "terms"],
};

/**
 * "x@y.z" shape only (02 §3.18); the real check happens at Lot 1. Exported so the login form
 * (components/auth) applies the same rule instead of a second copy.
 */
export const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function createInitialValues(language: string): StartFormValues {
  return {
    profile: null,
    email: "",
    company: "",
    country: "",
    language,
    adult: false,
    terms: false,
    // CA9: marketing consent is never pre-checked.
    marketingConsent: false,
  };
}

export function validateStep(
  step: StartFormStep,
  values: StartFormValues,
): StartFormErrors {
  const errors: StartFormErrors = {};

  if (step === 1 && values.profile === null) {
    errors.profile = "required";
  }

  if (step === 2) {
    const email = values.email.trim();
    if (email === "") {
      errors.email = "required";
    } else if (!EMAIL_SHAPE.test(email)) {
      errors.email = "format";
    }
    if (values.profile === "advertiser" && values.company.trim() === "") {
      errors.company = "required";
    }
    if (values.country === "") {
      errors.country = "required";
    }
  }

  if (step === 3) {
    if (values.profile === "creator" && !values.adult) {
      errors.adult = "required";
    }
    if (!values.terms) {
      errors.terms = "required";
    }
  }

  return errors;
}

export function firstInvalidField(
  step: StartFormStep,
  errors: StartFormErrors,
): StartFormField | null {
  return STEP_FIELDS[step].find((field) => errors[field] !== undefined) ?? null;
}

/**
 * Changing the profile keeps the other answers in memory, except the marketing consent: its label
 * depends on the profile, so a consent given to the other label is not valid (02 §3.18, 07 line 18).
 */
export function changeProfile(
  values: StartFormValues,
  profile: StartFormProfile,
): StartFormValues {
  if (values.profile === profile) {
    return values;
  }
  return { ...values, profile, marketingConsent: false };
}
