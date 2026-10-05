"use client";

// Minimal member sign-in of the J3 (docs/mvp/17 §3.7, §3.6; 05 RG112, RG136 to RG140). Two steps,
// address then code, and the outcome screens after a verified code. The screen only displays
// what apps/api answers: routing by the real role, attempts left, expiry, all come from the API.
// Accessibility: one h1 per step, focus moved to it at each step, errors in role="alert" AND
// linked to their field, countdown announced every ten seconds (aria-live polite).
import {
  LOGIN_CODE_PATTERN,
  MAX_EMAIL_LENGTH,
  type RequestCodeResponse,
  type VerifyCodeResponse,
} from "@influx/contracts/auth";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "@/i18n/navigation";
import {
  CARD_CLASSES,
  codeInputClasses,
  ERROR_CLASSES,
  HELP_CLASSES,
  INFO_CLASSES,
  inputClasses,
  LABEL_CLASSES,
  LEAD_CLASSES,
  PRIMARY_SUBMIT_CLASSES,
  SCREEN_CLASSES,
  TEXT_BUTTON_CLASSES,
  TITLE_CLASSES,
  BRAND_CLASSES,
} from "./auth-classes";
import { requestCode, verifyCode } from "./member-auth";

type Step =
  | { kind: "email" }
  | { kind: "code"; email: string; phrase: string }
  | { kind: "outcome"; outcome: "internal" | "suspended" | "notYetAvailable" };

/** What the address step shows under the field. */
type EmailMessage =
  | "required"
  | "format"
  | "tooLong"
  | "undeliverable"
  | "rateLimited"
  | "serviceUnavailable"
  | null;

/** What the code step shows under the field. */
type CodeMessage =
  | { key: "required" | "format" }
  | { key: "invalid"; remaining: number }
  | {
      key:
        | "expired"
        | "tooManyAttempts"
        | "sessionLost"
        | "tooManyRequests"
        | "verifyUnavailable";
    }
  | { key: "resendLimit" }
  | null;

/** 05 RG50: a new code may be asked for after this many seconds. */
const RESEND_SECONDS = 60;

/** Form check only; the API decides (02 §18.10). Same shape as the contract's. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function emailFormMessage(value: string): EmailMessage {
  const email = value.trim();
  if (email === "") {
    return "required";
  }
  if (email.length > MAX_EMAIL_LENGTH) {
    return "tooLong";
  }
  return EMAIL_SHAPE.test(email) ? null : "format";
}

function requestMessage(outcome: RequestCodeResponse["outcome"]): EmailMessage {
  switch (outcome) {
    case "sent":
      return null;
    case "undeliverable":
      return "undeliverable";
    case "rate_limited":
      return "rateLimited";
    default:
      return "serviceUnavailable";
  }
}

export function SignInFlow() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const router = useRouter();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const ids = {
    email: useId(),
    emailError: useId(),
    code: useId(),
    codeError: useId(),
    phrase: useId(),
  };

  const [step, setStep] = useState<Step>({ kind: "email" });
  const [email, setEmail] = useState("");
  const [emailMessage, setEmailMessage] = useState<EmailMessage>(null);
  const [code, setCode] = useState("");
  const [codeMessage, setCodeMessage] = useState<CodeMessage>(null);
  const [codeClosed, setCodeClosed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [showChecklist, setShowChecklist] = useState(false);

  // 17 §3.6: the focus goes to the title of each new step.
  useEffect(() => {
    titleRef.current?.focus();
  }, [step.kind]);

  // RG50: the resend countdown; the text is updated every ten seconds and at the last one.
  useEffect(() => {
    if (secondsLeft <= 0) {
      return undefined;
    }
    const timer = setTimeout(() => setSecondsLeft(secondsLeft - 1), 1_000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);
  const announcedSeconds =
    secondsLeft <= 1 ? secondsLeft : Math.ceil(secondsLeft / 10) * 10;

  async function askForCode(address: string): Promise<boolean> {
    const result = await requestCode(
      address.trim(),
      locale === "en" ? "en" : "fr",
    );
    if (result.kind !== "ok") {
      setEmailMessage("serviceUnavailable");
      return false;
    }
    const message = requestMessage(result.data.outcome);
    if (message !== null || result.data.matchingPhrase === undefined) {
      setEmailMessage(message ?? "serviceUnavailable");
      return false;
    }
    setStep({
      kind: "code",
      email: address.trim(),
      phrase: result.data.matchingPhrase,
    });
    setSecondsLeft(RESEND_SECONDS);
    return true;
  }

  async function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) {
      return; // 05 RG110: a double submission has no effect.
    }
    const message = emailFormMessage(email);
    setEmailMessage(message);
    if (message !== null) {
      return;
    }
    setBusy(true);
    try {
      if (await askForCode(email)) {
        setCode("");
        setCodeMessage(null);
        setCodeClosed(false);
      }
    } finally {
      setBusy(false);
    }
  }

  function showVerification(response: VerifyCodeResponse) {
    switch (response.outcome) {
      case "signed_in":
        // 17 §2.5: the space of the REAL role, whatever the door.
        router.replace(
          response.role === "advertiser" ? "/marque" : "/createur",
        );
        return;
      case "internal_account":
        setStep({ kind: "outcome", outcome: "internal" });
        return;
      case "account_unavailable":
        setStep({ kind: "outcome", outcome: "suspended" });
        return;
      case "signup_required":
        // 05 RG139: at J3, account creation is not open yet.
        setStep({ kind: "outcome", outcome: "notYetAvailable" });
        return;
      case "invalid":
        setCodeMessage({ key: "invalid", remaining: response.attemptsLeft });
        return;
      case "too_many_attempts":
        // 05 RG137: the field goes; only a new code helps.
        setCodeMessage({ key: "tooManyAttempts" });
        setCodeClosed(true);
        return;
      case "expired":
        setCodeMessage({ key: "expired" });
        return;
      case "session_lost":
        setCodeMessage({ key: "sessionLost" });
        setCodeClosed(true);
        return;
      case "too_many_requests":
        setCodeMessage({ key: "tooManyRequests" });
        return;
      default:
        setCodeMessage({ key: "verifyUnavailable" });
    }
  }

  async function submitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) {
      return;
    }
    const value = code.trim();
    if (value === "") {
      setCodeMessage({ key: "required" });
      return;
    }
    if (!LOGIN_CODE_PATTERN.test(value)) {
      setCodeMessage({ key: "format" });
      return;
    }
    setBusy(true);
    try {
      // J3: no door is chosen on this screen; the contract asks for one, the role decides.
      const result = await verifyCode(value, "advertiser");
      if (result.kind === "ok") {
        showVerification(result.data);
      } else {
        setCodeMessage({ key: "verifyUnavailable" });
      }
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (busy || step.kind !== "code") {
      return;
    }
    setBusy(true);
    try {
      const sent = await askForCode(step.email);
      if (sent) {
        setCode("");
        setCodeMessage(null);
        setCodeClosed(false);
      } else {
        setCodeMessage({ key: "resendLimit" });
      }
    } finally {
      setBusy(false);
    }
  }

  function restart() {
    setStep({ kind: "email" });
    setEmailMessage(null);
    setCode("");
    setCodeMessage(null);
    setCodeClosed(false);
    setShowChecklist(false);
  }

  function codeMessageText(message: Exclude<CodeMessage, null>): string {
    switch (message.key) {
      case "invalid":
        return t("code.errors.invalid", { remaining: message.remaining });
      case "resendLimit":
        return t("code.resend.limit");
      default:
        return t(`code.errors.${message.key}`);
    }
  }

  const brand = <p className={BRAND_CLASSES}>{t("brand")}</p>;

  if (step.kind === "outcome") {
    const texts =
      step.outcome === "internal"
        ? {
            title: t("internalAccount.title"),
            body: [t("internalAccount.notice"), t("internalAccount.help")],
          }
        : step.outcome === "suspended"
          ? { title: t("suspended.title"), body: [t("suspended.notice")] }
          : {
              title: t("step1.title"),
              body: [t("signup.notYetAvailable")],
            };
    return (
      <main id="main" className={SCREEN_CLASSES}>
        {brand}
        <h1 ref={titleRef} tabIndex={-1} className={TITLE_CLASSES}>
          {texts.title}
        </h1>
        <div className={INFO_CLASSES} role="status">
          {texts.body.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
        <button type="button" onClick={restart} className={TEXT_BUTTON_CLASSES}>
          {t("restart")}
        </button>
      </main>
    );
  }

  if (step.kind === "email") {
    const hasError = emailMessage !== null;
    const isFieldError =
      emailMessage === "required" ||
      emailMessage === "format" ||
      emailMessage === "tooLong";
    return (
      <main id="main" className={SCREEN_CLASSES}>
        {brand}
        <h1 ref={titleRef} tabIndex={-1} className={TITLE_CLASSES}>
          {t("step1.title")}
        </h1>
        <p className={LEAD_CLASSES}>{t("step1.lead")}</p>
        <form noValidate onSubmit={submitEmail} className={CARD_CLASSES}>
          <label htmlFor={ids.email} className={LABEL_CLASSES}>
            {t("step1.emailLabel")}
          </label>
          <input
            id={ids.email}
            type="email"
            inputMode="email"
            autoComplete="email"
            spellCheck={false}
            required
            value={email}
            aria-invalid={isFieldError ? true : undefined}
            aria-describedby={hasError ? ids.emailError : undefined}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClasses(isFieldError)}
          />
          {emailMessage !== null ? (
            <p id={ids.emailError} role="alert" className={ERROR_CLASSES}>
              {isFieldError
                ? t(`emailErrors.${emailMessage}`)
                : emailMessage === "serviceUnavailable"
                  ? t("errors.serviceUnavailable")
                  : t(`email.errors.${emailMessage}`)}
            </p>
          ) : null}
          <button
            type="submit"
            aria-disabled={busy || undefined}
            className={PRIMARY_SUBMIT_CLASSES}
          >
            {busy ? t("step1.submitBusy") : t("step1.submit")}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main id="main" className={SCREEN_CLASSES}>
      {brand}
      <h1 ref={titleRef} tabIndex={-1} className={TITLE_CLASSES}>
        {t("step2.title")}
      </h1>
      <p className={INFO_CLASSES} role="status">
        {t("code.sent")}
      </p>
      <p className={LEAD_CLASSES}>
        {t("step2.sentTo", { email: step.email })}{" "}
        <button type="button" onClick={restart} className={TEXT_BUTTON_CLASSES}>
          {t("step2.changeEmail")}
        </button>
      </p>
      {/* 05 RG48: the phrase sits ABOVE the field, so that a forged page is seen before typing. */}
      <section aria-labelledby={ids.phrase} className={CARD_CLASSES}>
        <h2 id={ids.phrase} className={LABEL_CLASSES}>
          {t("step2.phrase.label")}
        </h2>
        <p
          lang={locale}
          className="text-heading-3 font-bold uppercase text-text-primary"
        >
          {step.phrase}
        </p>
        <p className={HELP_CLASSES}>{t("step2.phrase.help")}</p>
      </section>
      <form noValidate onSubmit={submitCode} className={CARD_CLASSES}>
        {codeClosed ? null : (
          <>
            <label htmlFor={ids.code} className={LABEL_CLASSES}>
              {t("step2.codeLabel")}
            </label>
            <input
              id={ids.code}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              value={code}
              aria-invalid={codeMessage !== null ? true : undefined}
              aria-describedby={
                codeMessage !== null ? ids.codeError : undefined
              }
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, ""))
              }
              className={codeInputClasses(codeMessage !== null)}
            />
          </>
        )}
        {codeMessage !== null ? (
          <p id={ids.codeError} role="alert" className={ERROR_CLASSES}>
            {codeMessageText(codeMessage)}
          </p>
        ) : null}
        {codeClosed ? null : (
          <button
            type="submit"
            aria-disabled={busy || undefined}
            className={PRIMARY_SUBMIT_CLASSES}
          >
            {busy ? t("step2.submitBusy") : t("step2.submit")}
          </button>
        )}
        <p className={HELP_CLASSES}>{t("step2.stayInTab")}</p>
      </form>
      <p aria-live="polite" className={HELP_CLASSES}>
        {secondsLeft > 0
          ? t("code.resend.countdown", { seconds: announcedSeconds })
          : null}
      </p>
      {secondsLeft > 0 ? null : (
        <button type="button" onClick={resend} className={TEXT_BUTTON_CLASSES}>
          {codeClosed ? t("step2.newCode") : t("step2.resend")}
        </button>
      )}
      <button
        type="button"
        aria-expanded={showChecklist}
        onClick={() => setShowChecklist(!showChecklist)}
        className={TEXT_BUTTON_CLASSES}
      >
        {t("step2.notReceived.label")}
      </button>
      {showChecklist ? (
        <p className={HELP_CLASSES}>{t("step2.notReceived.checklist")}</p>
      ) : null}
    </main>
  );
}
