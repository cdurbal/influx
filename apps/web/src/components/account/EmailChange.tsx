"use client";

// The change of address (docs/mvp/17 §6.1; 05 RG57, RG58; J7 decision 5): a fresh code first,
// then the new address, then one code from EACH address, within 24 hours. Until both are typed the
// screen says so ("En attente de confirmation : 1 sur 2 · expire le {date}") and that the sign-in
// address stays the old one. A refused request (400, 503) sends the member back to the fresh code
// (C4.c): its proof was spent by the attempt.
import type {
  EmailChangeRequest,
  EmailChangeSide,
  MeResponse,
} from "@influx/contracts/account";
import { LOGIN_CODE_PATTERN, MAX_EMAIL_LENGTH } from "@influx/contracts/auth";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useState, type FormEvent } from "react";
import {
  CARD_CLASSES,
  codeInputClasses,
  FIELD_CLASSES,
  HELP_CLASSES,
  INFO_CLASSES,
  inputClasses,
  LABEL_CLASSES,
  PRIMARY_SUBMIT_CLASSES,
  SECONDARY_BUTTON_CLASSES,
  TEXT_BUTTON_CLASSES,
} from "@/components/auth/auth-classes";
import { codeDigitsOf } from "@/components/auth/auth-steps";
import {
  ACTIONS_CLASSES,
  SECTION_TITLE_CLASSES,
  SUCCESS_CLASSES,
} from "./account-classes";
import {
  cancelEmailChange,
  confirmEmailChange,
  readEmailChange,
  startEmailChange,
} from "./account-api";
import {
  confirmedSidesOf,
  confirmStepOf,
  emailChangeRefusalOf,
  formatDate,
  type EmailChangeMessage,
} from "./account-view";
import { FreshCode } from "./FreshCode";
import { ErrorNotice } from "@/components/ui/ErrorNotice";

type EndMessage =
  "addressUnavailable" | "tooManyAttempts" | "expired" | "gone" | "cancelled";

type Phase =
  | { kind: "loading" }
  | { kind: "idle"; notice: EndMessage | null }
  | { kind: "freshCode"; refusal: EmailChangeMessage | null }
  | { kind: "newAddress" }
  | { kind: "pending"; request: EmailChangeRequest }
  | { kind: "completed"; email: string };

export function EmailChange({
  me,
  online,
  onCompleted,
}: {
  me: MeResponse;
  online: boolean;
  /** The address changed: the frame reads the account again. */
  onCompleted: () => Promise<void>;
}) {
  const t = useTranslations("account.email");
  const locale = useLocale();
  const ids = { title: useId(), newEmail: useId() };
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [newEmail, setNewEmail] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void readEmailChange().then((result) => {
      if (!active) {
        return;
      }
      // Unreadable: the screen offers the change; the API refuses a second open request itself.
      const request = result.kind === "ok" ? result.data.request : null;
      setPhase(
        request === null
          ? { kind: "idle", notice: null }
          : { kind: "pending", request },
      );
    });
    return () => {
      active = false;
    };
  }, []);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !online) {
      return;
    }
    setBusy(true);
    try {
      const result = await startEmailChange(newEmail.trim());
      if (result.kind === "ok") {
        setPhase({ kind: "pending", request: result.data.request });
        return;
      }
      // C4.c: the fresh code was spent; it is asked again, with the reason.
      setPhase({ kind: "freshCode", refusal: emailChangeRefusalOf(result) });
    } finally {
      setBusy(false);
    }
  }

  async function cancel(request: EmailChangeRequest) {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      await cancelEmailChange(request.id);
      // Cancelled, or already closed (404): in both cases nothing is open any more.
      setPhase({ kind: "idle", notice: "cancelled" });
    } finally {
      setBusy(false);
    }
  }

  const sectionTitle = (
    <h2 id={ids.title} className={SECTION_TITLE_CLASSES}>
      {t("title")}
    </h2>
  );

  if (phase.kind === "loading") {
    return (
      <section aria-labelledby={ids.title} className={CARD_CLASSES}>
        {sectionTitle}
        <p className={HELP_CLASSES}>{t("current", { email: me.email })}</p>
      </section>
    );
  }

  if (phase.kind === "freshCode") {
    return (
      <>
        {phase.refusal !== null ? (
          <ErrorNotice>{t(`messages.${phase.refusal}`)}</ErrorNotice>
        ) : null}
        <FreshCode
          purpose="email_change"
          email={me.email}
          online={online}
          onVerified={() => setPhase({ kind: "newAddress" })}
          onCancel={() => setPhase({ kind: "idle", notice: null })}
        />
      </>
    );
  }

  if (phase.kind === "newAddress") {
    return (
      <section aria-labelledby={ids.title} className={CARD_CLASSES}>
        {sectionTitle}
        <p className={HELP_CLASSES}>{t("current", { email: me.email })}</p>
        <form noValidate onSubmit={send} className="flex flex-col gap-4">
          <div className={FIELD_CLASSES}>
            <label htmlFor={ids.newEmail} className={LABEL_CLASSES}>
              {t("newLabel")}
            </label>
            <input
              id={ids.newEmail}
              type="email"
              autoComplete="email"
              maxLength={MAX_EMAIL_LENGTH}
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
              className={inputClasses(false)}
            />
          </div>
          <button
            type="submit"
            aria-disabled={busy || !online || undefined}
            className={PRIMARY_SUBMIT_CLASSES}
          >
            {busy ? t("sending") : t("send")}
          </button>
        </form>
      </section>
    );
  }

  if (phase.kind === "pending") {
    const { request } = phase;
    return (
      <section aria-labelledby={ids.title} className={CARD_CLASSES}>
        {sectionTitle}
        <p role="status" className={INFO_CLASSES}>
          {t("pending.status", {
            confirmed: confirmedSidesOf(request),
            date: formatDate(request.expiresAt, locale),
          })}
        </p>
        <p className={HELP_CLASSES}>
          {t("pending.stays", { email: me.email })}
        </p>
        <ConfirmSide
          request={request}
          side="old"
          address={me.email}
          confirmed={request.oldConfirmed}
          online={online}
          onPending={(next) => setPhase({ kind: "pending", request: next })}
          onCompleted={() => {
            setPhase({ kind: "completed", email: request.newEmail });
            void onCompleted();
          }}
          onEnded={(notice) => setPhase({ kind: "idle", notice })}
        />
        <ConfirmSide
          request={request}
          side="new"
          address={request.newEmail}
          confirmed={request.newConfirmed}
          online={online}
          onPending={(next) => setPhase({ kind: "pending", request: next })}
          onCompleted={() => {
            setPhase({ kind: "completed", email: request.newEmail });
            void onCompleted();
          }}
          onEnded={(notice) => setPhase({ kind: "idle", notice })}
        />
        <button
          type="button"
          onClick={() => void cancel(request)}
          aria-disabled={busy || undefined}
          className={TEXT_BUTTON_CLASSES}
        >
          {t("pending.cancel")}
        </button>
      </section>
    );
  }

  if (phase.kind === "completed") {
    return (
      <section aria-labelledby={ids.title} className={CARD_CLASSES}>
        {sectionTitle}
        <p role="status" className={SUCCESS_CLASSES}>
          {t("completed", { email: phase.email })}
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby={ids.title} className={CARD_CLASSES}>
      {sectionTitle}
      <p className={LABEL_CLASSES}>{t("current", { email: me.email })}</p>
      {phase.notice === "cancelled" ? (
        <p role="status" className={INFO_CLASSES}>
          {t("pending.cancelled")}
        </p>
      ) : phase.notice !== null ? (
        <ErrorNotice>{t(`messages.${phase.notice}`)}</ErrorNotice>
      ) : null}
      <p className={HELP_CLASSES}>{t("how")}</p>
      <div className={ACTIONS_CLASSES}>
        <button
          type="button"
          onClick={() => {
            setNewEmail("");
            setPhase({ kind: "freshCode", refusal: null });
          }}
          aria-disabled={!online || undefined}
          className={SECONDARY_BUTTON_CLASSES}
        >
          {t("start")}
        </button>
      </div>
    </section>
  );
}

/** One side of the open request: its code, or "confirmed" once typed. */
function ConfirmSide({
  request,
  side,
  address,
  confirmed,
  online,
  onPending,
  onCompleted,
  onEnded,
}: {
  request: EmailChangeRequest;
  side: EmailChangeSide;
  address: string;
  confirmed: boolean;
  online: boolean;
  onPending: (request: EmailChangeRequest) => void;
  onCompleted: () => void;
  onEnded: (
    notice: "addressUnavailable" | "tooManyAttempts" | "expired" | "gone",
  ) => void;
}) {
  const t = useTranslations("account.email");
  const ids = { code: useId(), error: useId() };
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !online) {
      return;
    }
    if (!LOGIN_CODE_PATTERN.test(code)) {
      setError(t("messages.format"));
      return;
    }
    setBusy(true);
    try {
      const step = confirmStepOf(
        await confirmEmailChange(request.id, side, code),
      );
      switch (step.kind) {
        case "pending":
          setError(null);
          onPending(step.request);
          return;
        case "completed":
          onCompleted();
          return;
        case "ended":
          onEnded(step.message);
          return;
        case "codeError":
          setError(
            step.message === "invalid"
              ? t("messages.invalid", { remaining: step.remaining ?? 1 })
              : t("messages.codeUnavailable"),
          );
      }
    } finally {
      setBusy(false);
    }
  }

  if (confirmed) {
    return (
      <p className={SUCCESS_CLASSES}>
        {t("pending.confirmed", { email: address })}
      </p>
    );
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-2">
      <label htmlFor={ids.code} className={LABEL_CLASSES}>
        {t(side === "old" ? "pending.oldLabel" : "pending.newLabel", {
          email: address,
        })}
      </label>
      <input
        id={ids.code}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={code}
        aria-invalid={error !== null ? true : undefined}
        aria-describedby={error !== null ? ids.error : undefined}
        onChange={(event) => setCode(codeDigitsOf(event.target.value))}
        className={codeInputClasses(error !== null)}
      />
      {error !== null ? (
        <ErrorNotice id={ids.error}>{error}</ErrorNotice>
      ) : null}
      <button
        type="submit"
        aria-disabled={busy || !online || undefined}
        className={SECONDARY_BUTTON_CLASSES}
      >
        {busy ? t("pending.confirming") : t("pending.confirm")}
      </button>
    </form>
  );
}
