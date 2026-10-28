"use client";

// The "code frais" step before a sensitive action (docs/mvp/05 RG57; 17 §6.1, §6.3; J7 decision
// 4): a sign-in code sent to the address of the session, valid for this one action. The journey
// token of the code lives in this component's state only — never stored, forgotten once used,
// closed or abandoned (C4.c of the J7 commit 7) — so that the code dies with the tab. The
// matching phrase sits ABOVE the field (RG48), as on the sign-in screen.
import {
  LOGIN_CODE_PATTERN,
  RESEND_DELAY_SECONDS,
} from "@influx/contracts/auth";
import type { ReauthPurpose } from "@influx/contracts/account";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import {
  CARD_CLASSES,
  codeInputClasses,
  FIELD_CLASSES,
  HELP_CLASSES,
  INFO_CLASSES,
  LABEL_CLASSES,
  PRIMARY_SUBMIT_CLASSES,
  SECONDARY_BUTTON_CLASSES,
  TEXT_BUTTON_CLASSES,
} from "@/components/auth/auth-classes";
import { announcedSeconds, codeDigitsOf } from "@/components/auth/auth-steps";
import { ACTIONS_CLASSES, SECTION_TITLE_CLASSES } from "./account-classes";
import { requestFreshCode, verifyFreshCode } from "./account-api";
import {
  freshCodeRequestMessage,
  freshCodeStepOf,
  type FreshCodeMessage,
} from "./account-view";
import { ErrorNotice } from "@/components/ui/ErrorNotice";

type Sent = { token: string; phrase: string };

export function FreshCode({
  purpose,
  email,
  online,
  onVerified,
  onCancel,
}: {
  purpose: ReauthPurpose;
  /** The address of the session, where the code goes (never one typed). */
  email: string;
  online: boolean;
  onVerified: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("account.freshCode");
  const tAccount = useTranslations("account");
  const locale = useLocale();
  const ids = { title: useId(), code: useId(), message: useId() };
  const titleRef = useRef<HTMLHeadingElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [sent, setSent] = useState<Sent | null>(null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<{
    key: FreshCodeMessage;
    remaining?: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  // The field takes the focus once the code has left (and after a resend).
  useEffect(() => {
    if (sent !== null) {
      inputRef.current?.focus();
    }
  }, [sent]);

  // 05 RG50: the resend countdown.
  useEffect(() => {
    if (secondsLeft <= 0) {
      return undefined;
    }
    const timer = setTimeout(() => setSecondsLeft(secondsLeft - 1), 1_000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  async function send() {
    if (busy || !online) {
      return;
    }
    setBusy(true);
    try {
      const result = await requestFreshCode(purpose);
      const refusal = freshCodeRequestMessage(result);
      if (refusal !== null || result.kind !== "ok") {
        setMessage({ key: refusal ?? "sendUnavailable" });
        return;
      }
      setSent({
        token: result.data.reauthToken ?? "",
        phrase: result.data.matchingPhrase ?? "",
      });
      setCode("");
      setMessage(null);
      setSecondsLeft(RESEND_DELAY_SECONDS);
    } finally {
      setBusy(false);
    }
  }

  async function verify(value: string) {
    if (busy || !online || sent === null) {
      return;
    }
    if (value === "") {
      setMessage({ key: "required" });
      return;
    }
    if (!LOGIN_CODE_PATTERN.test(value)) {
      setMessage({ key: "format" });
      return;
    }
    setBusy(true);
    try {
      const step = freshCodeStepOf(
        await verifyFreshCode(purpose, value, sent.token),
      );
      if (step.kind === "verified") {
        setSent(null); // the token is spent: forgotten at once
        onVerified();
        return;
      }
      setMessage({ key: step.message, remaining: step.remaining });
      if (step.closed) {
        setSent(null); // RG137: only a new code helps
        setCode("");
        return;
      }
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
    if (digits.length === 6 && code.length < 6) {
      void verify(digits); // 17 §3.2: sent at the sixth digit
    }
  }

  const messageText =
    message === null
      ? null
      : message.key === "invalid"
        ? t("messages.invalid", { remaining: message.remaining ?? 1 })
        : t(`messages.${message.key}`);

  return (
    <section aria-labelledby={ids.title} className={CARD_CLASSES}>
      <h2
        id={ids.title}
        ref={titleRef}
        tabIndex={-1}
        className={SECTION_TITLE_CLASSES}
      >
        {t("title")}
      </h2>
      {sent === null ? (
        <>
          <p className={HELP_CLASSES}>{t("lead", { email })}</p>
          {messageText !== null ? (
            <ErrorNotice>{messageText}</ErrorNotice>
          ) : null}
          <div className={ACTIONS_CLASSES}>
            <button
              type="button"
              onClick={() => void send()}
              aria-disabled={busy || !online || undefined}
              className={SECONDARY_BUTTON_CLASSES}
            >
              {busy ? t("sending") : t("send")}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className={TEXT_BUTTON_CLASSES}
            >
              {tAccount("cancel")}
            </button>
          </div>
        </>
      ) : (
        <form noValidate onSubmit={submit} className="flex flex-col gap-4">
          <p role="status" className={INFO_CLASSES}>
            {t("sent", { email })}
          </p>
          <div className="flex flex-col gap-1">
            <p className={LABEL_CLASSES}>{t("phraseLabel")}</p>
            <p
              lang={locale}
              className="text-heading-3 font-bold uppercase text-text-primary"
            >
              {sent.phrase}
            </p>
            <p className={HELP_CLASSES}>{t("phraseHelp")}</p>
          </div>
          <div className={FIELD_CLASSES}>
            <label htmlFor={ids.code} className={LABEL_CLASSES}>
              {t("codeLabel")}
            </label>
            <input
              ref={inputRef}
              id={ids.code}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              aria-invalid={messageText !== null ? true : undefined}
              aria-describedby={messageText !== null ? ids.message : undefined}
              onChange={(event) => change(event.target.value)}
              className={codeInputClasses(messageText !== null)}
            />
          </div>
          {messageText !== null ? (
            <ErrorNotice id={ids.message}>{messageText}</ErrorNotice>
          ) : null}
          <button
            type="submit"
            aria-disabled={busy || !online || undefined}
            className={PRIMARY_SUBMIT_CLASSES}
          >
            {busy ? t("submitBusy") : t("submit")}
          </button>
          <p className={HELP_CLASSES}>{t("stayInTab")}</p>
          <p aria-live="polite" className={HELP_CLASSES}>
            {secondsLeft > 0
              ? t("countdown", { seconds: announcedSeconds(secondsLeft) })
              : null}
          </p>
          <div className={ACTIONS_CLASSES}>
            {secondsLeft > 0 ? null : (
              <button
                type="button"
                onClick={() => void send()}
                aria-disabled={busy || !online || undefined}
                className={TEXT_BUTTON_CLASSES}
              >
                {t("resend")}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setSent(null);
                onCancel();
              }}
              className={TEXT_BUTTON_CLASSES}
            >
              {tAccount("cancel")}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
