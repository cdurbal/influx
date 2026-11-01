"use client";

// "Je ne reçois pas le code" (docs/mvp/17 §3.3; 05 RG60, RG65, CA26): a panel IN the page — a
// journey in progress is never left — with the three gestures: check the spam folders, correct the
// address, then report it through the rescue channel, from another address. The channel never
// gives a code, never opens a session and never puts two members in touch: the screen says so, and
// announces no delay that no written policy holds. The answer is one value whatever the addresses.
import { CARD_TITLE } from "@/components/member/ui/heading-classes";
import { Notice } from "@/components/member/ui/Notice";
import { MAX_DELIVERY_REPORT_MESSAGE_LENGTH } from "@influx/contracts/support";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import {
  CARD_CLASSES,
  FIELD_CLASSES,
  HELP_CLASSES,
  inputClasses,
  LABEL_CLASSES,
  SECONDARY_BUTTON_CLASSES,
  TEXT_BUTTON_CLASSES,
} from "./auth-classes";
import { contactFormMessage, type ContactMessage } from "./auth-steps";
import { RequiredMark } from "./AuthScreen";
import { reportCodeNotReceived } from "./member-auth";
import { ErrorNotice } from "@/components/ui/ErrorNotice";

type Outcome = "received" | "rateLimited" | "serviceUnavailable" | null;

export function CodeNotReceived({
  email,
  online,
  onChangeEmail,
}: {
  /** The sign-in address the code was sent to. */
  email: string;
  online: boolean;
  onChangeEmail: () => void;
}) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const ids = {
    title: useId(),
    contact: useId(),
    contactError: useId(),
    message: useId(),
    promise: useId(),
  };
  const [contact, setContact] = useState("");
  const [message, setMessage] = useState("");
  const [fieldMessage, setFieldMessage] = useState<ContactMessage>(null);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !online) {
      return;
    }
    const checked = contactFormMessage(email, contact);
    setFieldMessage(checked);
    if (checked !== null) {
      return;
    }
    setBusy(true);
    try {
      const result = await reportCodeNotReceived(
        email.trim(),
        contact.trim(),
        message.trim(),
        locale,
      );
      setOutcome(
        result.kind === "ok"
          ? "received"
          : result.kind === "failed" && result.code === "rate_limited"
            ? "rateLimited"
            : "serviceUnavailable",
      );
    } finally {
      setBusy(false);
    }
  }

  function fieldText(value: Exclude<ContactMessage, null>): string {
    return value === "same"
      ? t("step2.notReceived.contactSame")
      : t(`emailErrors.${value}`);
  }

  return (
    <section aria-labelledby={ids.title} className={CARD_CLASSES}>
      <h2 id={ids.title} className={CARD_TITLE}>
        {t("step2.notReceived.title")}
      </h2>
      <ol className="flex list-decimal flex-col gap-3 pl-6 text-md text-text-primary">
        <li>{t("step2.notReceived.checklist")}</li>
        <li>
          <p>{t("step2.notReceived.addressCheck", { email })}</p>
          <button
            type="button"
            onClick={onChangeEmail}
            className={TEXT_BUTTON_CLASSES}
          >
            {t("step2.notReceived.fixAddress")}
          </button>
        </li>
        <li>
          <p>{t("step2.notReceived.stillNothing")}</p>
          {outcome === "received" ? (
            <Notice tone="info">{t("step2.notReceived.received")}</Notice>
          ) : (
            <form
              noValidate
              onSubmit={submit}
              aria-describedby={ids.promise}
              className="mt-3 flex flex-col gap-3"
            >
              <div className={FIELD_CLASSES}>
                <label htmlFor={ids.contact} className={LABEL_CLASSES}>
                  {t("step2.notReceived.contactLabel")} <RequiredMark />
                </label>
                <input
                  id={ids.contact}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  spellCheck={false}
                  required
                  value={contact}
                  aria-invalid={fieldMessage !== null ? true : undefined}
                  aria-describedby={
                    fieldMessage !== null ? ids.contactError : undefined
                  }
                  onChange={(event) => setContact(event.target.value)}
                  className={inputClasses(fieldMessage !== null)}
                />
                {fieldMessage !== null ? (
                  <ErrorNotice id={ids.contactError}>
                    {fieldText(fieldMessage)}
                  </ErrorNotice>
                ) : null}
              </div>
              <div className={FIELD_CLASSES}>
                <label htmlFor={ids.message} className={LABEL_CLASSES}>
                  {t("step2.notReceived.messageLabel")}
                </label>
                <textarea
                  id={ids.message}
                  maxLength={MAX_DELIVERY_REPORT_MESSAGE_LENGTH}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  className="min-h-(--size-input) w-full rounded-md border-(length:--border-width-thin) border-border-strong bg-surface-page p-3 text-md text-text-primary"
                />
              </div>
              {outcome === "rateLimited" || outcome === "serviceUnavailable" ? (
                <ErrorNotice>
                  {outcome === "rateLimited"
                    ? t("step2.notReceived.rateLimited")
                    : t("errors.serviceUnavailable")}
                </ErrorNotice>
              ) : null}
              <button
                type="submit"
                aria-disabled={busy || !online || undefined}
                className={SECONDARY_BUTTON_CLASSES}
              >
                {busy
                  ? t("step2.notReceived.submitBusy")
                  : t("step2.notReceived.submit")}
              </button>
            </form>
          )}
          <p id={ids.promise} className={`${HELP_CLASSES} mt-2`}>
            {t("step2.notReceived.promise")}
          </p>
        </li>
      </ol>
    </section>
  );
}
