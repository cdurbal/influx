"use client";

// Screen 1, the address (docs/mvp/17 §3.1, §3.5; 05 RG3, RG6, RG110, RG112, RG113, RG115). The
// door chosen is recalled and can be changed; the information notice is visible on this screen,
// with Brevo and Apollo.io named (RG6). The answer of apps/api is the same whatever the address
// (RG113): the screen only shows it.
import type { SignupDoor } from "@influx/contracts/auth";
import { CARD_TITLE } from "@/components/member/ui/heading-classes";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { legalDocumentPath } from "@/lib/legal-documents";
import {
  CARD_CLASSES,
  HELP_CLASSES,
  inputClasses,
  LABEL_CLASSES,
  LEAD_CLASSES,
  PRIMARY_SUBMIT_CLASSES,
  TEXT_BUTTON_CLASSES,
} from "./auth-classes";
import {
  emailFormMessage,
  isEmailFieldError,
  requestMessage,
  type EmailMessage,
} from "./auth-steps";
import { RequiredMark, StepTitle } from "./AuthScreen";
import { requestCode } from "./member-auth";
import { ErrorNotice } from "@/components/ui/ErrorNotice";

export function EmailStep({
  door,
  email,
  onEmailChange,
  initialMessage,
  online,
  onSent,
  onChangeDoor,
}: {
  /** Null on the sign-in page: no door is recalled there. */
  door: SignupDoor | null;
  email: string;
  onEmailChange: (email: string) => void;
  /** A message carried from another step (the journey expired on screen 3). */
  initialMessage: EmailMessage;
  online: boolean;
  onSent: (email: string, matchingPhrase: string) => void;
  onChangeDoor: () => void;
}) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const ids = {
    email: useId(),
    emailError: useId(),
    privacy: useId(),
  };
  const [message, setMessage] = useState<EmailMessage>(initialMessage);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !online) {
      return; // 05 RG110: a double submission has no effect; offline, the banner explains.
    }
    const formMessage = emailFormMessage(email);
    setMessage(formMessage);
    if (formMessage !== null) {
      return;
    }
    setBusy(true);
    try {
      const address = email.trim();
      const result = await requestCode(address, locale);
      if (result.kind !== "ok") {
        setMessage("serviceUnavailable");
        return;
      }
      const outcome = requestMessage(result.data.outcome);
      if (outcome !== null || result.data.matchingPhrase === undefined) {
        setMessage(outcome ?? "serviceUnavailable");
        return;
      }
      onSent(address, result.data.matchingPhrase);
    } finally {
      setBusy(false);
    }
  }

  function messageText(value: Exclude<EmailMessage, null>): string {
    switch (value) {
      case "required":
      case "format":
      case "tooLong":
        return t(`emailErrors.${value}`);
      case "serviceUnavailable":
        return t("errors.serviceUnavailable");
      case "sessionLost":
        return t("code.errors.sessionLost");
      default:
        return t(`email.errors.${value}`);
    }
  }

  const isFieldError = isEmailFieldError(message);
  return (
    <>
      <StepTitle step={1}>{t("step1.title")}</StepTitle>
      {door === null ? null : (
        <div className={CARD_CLASSES}>
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
      )}
      <p className={LEAD_CLASSES}>{t("step1.lead")}</p>
      <form noValidate onSubmit={submit} className={CARD_CLASSES}>
        <label htmlFor={ids.email} className={LABEL_CLASSES}>
          {t("step1.emailLabel")} <RequiredMark />
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
          aria-describedby={message !== null ? ids.emailError : undefined}
          onChange={(event) => onEmailChange(event.target.value)}
          className={inputClasses(isFieldError)}
        />
        {message !== null ? (
          <ErrorNotice id={ids.emailError}>{messageText(message)}</ErrorNotice>
        ) : null}
        <button
          type="submit"
          aria-disabled={busy || !online || undefined}
          className={PRIMARY_SUBMIT_CLASSES}
        >
          {busy ? t("step1.submitBusy") : t("step1.submit")}
        </button>
      </form>
      {/* 05 RG6: visible from screen 1, never folded away. */}
      <section aria-labelledby={ids.privacy} className="flex flex-col gap-2">
        <h2 id={ids.privacy} className={CARD_TITLE}>
          {t("privacy.title")}
        </h2>
        <p className={HELP_CLASSES}>{t("privacy.notice")}</p>
        <a
          href={legalDocumentPath("privacy_policy", locale)}
          target="_blank"
          rel="noopener noreferrer"
          className={TEXT_BUTTON_CLASSES}
        >
          {t("privacy.link")}
        </a>
      </section>
    </>
  );
}
