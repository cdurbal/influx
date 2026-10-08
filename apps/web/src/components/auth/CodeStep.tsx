"use client";

// Screen 2, the code (docs/mvp/17 §3.2, §3.5, §3.6; 05 RG42, RG47 to RG51, RG115, RG136, RG137).
// Six boxes drawn, ONE field: the real input lies over the boxes, so that the code offered by the
// system or pasted fills them at once, and a screen reader hears one field. The sixth digit sends
// the code; the button stays, for the keyboard and for screen readers. The matching phrase sits
// ABOVE the field (RG48), so that a forged page is seen before typing.
import { RESEND_DELAY_SECONDS, type SignupDoor } from "@influx/contracts/auth";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import {
  CARD_CLASSES,
  CODE_BOXES_CLASSES,
  CODE_OVERLAY_INPUT_CLASSES,
  codeBoxClasses,
  ERROR_CLASSES,
  HELP_CLASSES,
  INFO_CLASSES,
  LABEL_CLASSES,
  LEAD_CLASSES,
  PRIMARY_SUBMIT_CLASSES,
  TEXT_BUTTON_CLASSES,
} from "./auth-classes";
import {
  announcedSeconds,
  codeDigitsOf,
  codeFormMessage,
  resendSecondsLeft,
  verifyStepOf,
  type CodeMessage,
  type VerifyStep,
} from "./auth-steps";
import { RequiredMark, StepTitle } from "./AuthScreen";
import { requestCode, verifyCode } from "./member-auth";

const CODE_LENGTH = 6;

export function CodeStep({
  email,
  matchingPhrase,
  resendAvailableAt,
  door,
  online,
  onVerified,
  onResent,
  onChangeEmail,
}: {
  email: string;
  matchingPhrase: string;
  /** When a new code may be asked for (epoch milliseconds, RG50): the countdown starts from it. */
  resendAvailableAt: number;
  /** Null on the sign-in page: the contract asks for a door, the real role decides (RG66). */
  door: SignupDoor | null;
  online: boolean;
  /** Any outcome but an error of the code: the parent routes (17 §2.5). */
  onVerified: (step: Exclude<VerifyStep, { kind: "codeError" }>) => void;
  onResent: (matchingPhrase: string) => void;
  onChangeEmail: () => void;
}) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const ids = {
    code: useId(),
    codeError: useId(),
    phrase: useId(),
  };
  const inputRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<CodeMessage>(null);
  const [closed, setClosed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState(false);
  // Read once, at mount: a resumed journey (D66) goes on with the delay left, not a full one.
  const [secondsLeft, setSecondsLeft] = useState(() =>
    resendSecondsLeft(resendAvailableAt, Date.now()),
  );
  const [showChecklist, setShowChecklist] = useState(false);

  // 05 RG50: the resend countdown.
  useEffect(() => {
    if (secondsLeft <= 0) {
      return undefined;
    }
    const timer = setTimeout(() => setSecondsLeft(secondsLeft - 1), 1_000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  async function verify(value: string) {
    if (busy || !online) {
      return;
    }
    const formMessage = codeFormMessage(value);
    if (formMessage !== null) {
      setMessage(formMessage);
      return;
    }
    setBusy(true);
    try {
      const result = await verifyCode(value, door ?? "advertiser");
      const step =
        result.kind === "ok"
          ? verifyStepOf(result.data, door !== null)
          : ({
              kind: "codeError",
              message: { key: "verifyUnavailable" },
              closed: false,
            } as const);
      if (step.kind !== "codeError") {
        onVerified(step);
        return;
      }
      setMessage(step.message);
      setClosed(step.closed);
      // 17 §3.5: the boxes are kept and selected, ready for the corrected code.
      inputRef.current?.focus();
      inputRef.current?.select();
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void verify(code);
  }

  function change(value: string) {
    const digits = codeDigitsOf(value);
    setCode(digits);
    if (digits.length === CODE_LENGTH && code.length < CODE_LENGTH) {
      void verify(digits); // 17 §3.2: sent at the sixth digit.
    }
  }

  async function resend() {
    if (busy || !online) {
      return;
    }
    setBusy(true);
    try {
      const result = await requestCode(email, locale);
      const phrase =
        result.kind === "ok" && result.data.outcome === "sent"
          ? result.data.matchingPhrase
          : undefined;
      if (phrase === undefined) {
        setMessage({ key: "resendLimit" });
        return;
      }
      onResent(phrase);
      setCode("");
      setMessage(null);
      setClosed(false);
      setSecondsLeft(RESEND_DELAY_SECONDS);
    } finally {
      setBusy(false);
    }
  }

  function messageText(value: Exclude<CodeMessage, null>): string {
    switch (value.key) {
      case "invalid":
        return t("code.errors.invalid", { remaining: value.remaining });
      case "resendLimit":
        return t("code.resend.limit");
      default:
        return t(`code.errors.${value.key}`);
    }
  }

  const hasError = message !== null && message.key !== "resendLimit";
  return (
    <>
      <StepTitle step={2}>{t("step2.title")}</StepTitle>
      <p className={INFO_CLASSES} role="status">
        {t("code.sent")}
      </p>
      <p className={LEAD_CLASSES}>
        {t("step2.sentTo", { email })}{" "}
        <button
          type="button"
          onClick={onChangeEmail}
          className={TEXT_BUTTON_CLASSES}
        >
          {t("step2.changeEmail")}
        </button>
      </p>
      <section aria-labelledby={ids.phrase} className={CARD_CLASSES}>
        <h2 id={ids.phrase} className={LABEL_CLASSES}>
          {t("step2.phrase.label")}
        </h2>
        <p
          lang={locale}
          className="text-heading-3 font-bold uppercase text-text-primary"
        >
          {matchingPhrase}
        </p>
        <p className={HELP_CLASSES}>{t("step2.phrase.help")}</p>
      </section>
      <form noValidate onSubmit={submit} className={CARD_CLASSES}>
        {closed ? null : (
          <>
            <label htmlFor={ids.code} className={LABEL_CLASSES}>
              {t("step2.codeLabel")} <RequiredMark />
            </label>
            <div className="relative">
              <div aria-hidden="true" className={CODE_BOXES_CLASSES}>
                {Array.from({ length: CODE_LENGTH }, (_, index) => (
                  <span
                    key={index}
                    className={codeBoxClasses(
                      focused &&
                        index === Math.min(code.length, CODE_LENGTH - 1),
                      hasError,
                    )}
                  >
                    {code[index] ?? ""}
                  </span>
                ))}
              </div>
              <input
                ref={inputRef}
                id={ids.code}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={CODE_LENGTH}
                required
                value={code}
                aria-invalid={hasError ? true : undefined}
                aria-describedby={message !== null ? ids.codeError : undefined}
                onChange={(event) => change(event.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                className={CODE_OVERLAY_INPUT_CLASSES}
              />
            </div>
          </>
        )}
        {message !== null ? (
          <p id={ids.codeError} role="alert" className={ERROR_CLASSES}>
            {messageText(message)}
          </p>
        ) : null}
        {closed ? null : (
          <button
            type="submit"
            aria-disabled={busy || !online || undefined}
            className={PRIMARY_SUBMIT_CLASSES}
          >
            {busy ? t("step2.submitBusy") : t("step2.submit")}
          </button>
        )}
        <p className={HELP_CLASSES}>{t("step2.stayInTab")}</p>
      </form>
      <p aria-live="polite" className={HELP_CLASSES}>
        {secondsLeft > 0
          ? t("code.resend.countdown", {
              seconds: announcedSeconds(secondsLeft),
            })
          : null}
      </p>
      {secondsLeft > 0 ? null : (
        <button
          type="button"
          onClick={resend}
          aria-disabled={busy || !online || undefined}
          className={TEXT_BUTTON_CLASSES}
        >
          {closed ? t("step2.newCode") : t("step2.resend")}
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
    </>
  );
}
