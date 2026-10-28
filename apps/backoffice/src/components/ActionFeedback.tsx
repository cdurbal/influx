"use client";

// The answer of a gesture (docs/mvp/17b §2.8, §3.14.d): the refusal in words, or the confirmation
// of identity R (password + TOTP, never a recovery code, B-5) before the same call is sent again.
// The password lives in this form's state only and is cleared after every attempt.
import Link from "next/link";
import { useId, useState, type FormEvent } from "react";
import { messages } from "@/messages/fr";
import {
  HELP_CLASSES,
  inputClasses,
  LABEL_CLASSES,
  WARNING_CLASSES,
} from "./auth-classes";
import { reauthenticate } from "./backoffice-api";
import {
  FIELD_CLASSES,
  SECTION_CLASSES,
  SECTION_TITLE_CLASSES,
  SMALL_PRIMARY_CLASSES,
  SMALL_SECONDARY_CLASSES,
} from "./bo-classes";
import type { Action } from "./use-action";
import { ErrorNotice } from "./ErrorNotice";

const TOTP_SHAPE = /^\d{6}$/;

function ReauthForm({
  onConfirmed,
  onCancelled,
}: {
  onConfirmed: () => void;
  onCancelled: () => void;
}) {
  const ids = { password: useId(), code: useId(), title: useId() };
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<
    "generic" | "recoverySession" | "revoked" | null
  >(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || password === "" || !TOTP_SHAPE.test(code.trim())) {
      setFailure("generic");
      return;
    }
    setBusy(true);
    setFailure(null);
    try {
      const result = await reauthenticate(password, code.trim());
      const outcome = result.kind === "ok" ? result.data.outcome : "refused";
      if (outcome === "confirmed") {
        onConfirmed();
        return;
      }
      setFailure(
        outcome === "recovery_session"
          ? "recoverySession"
          : outcome === "session_revoked"
            ? "revoked"
            : "generic",
      );
    } finally {
      setPassword("");
      setCode("");
      setBusy(false);
    }
  }

  return (
    <form
      noValidate
      onSubmit={submit}
      aria-labelledby={ids.title}
      className={SECTION_CLASSES}
    >
      <h2 id={ids.title} className={SECTION_TITLE_CLASSES}>
        {messages.reauth.title}
      </h2>
      <p className={HELP_CLASSES}>{messages.reauth.lead}</p>
      <div className={FIELD_CLASSES}>
        <label htmlFor={ids.password} className={LABEL_CLASSES}>
          {messages.reauth.passwordLabel}
        </label>
        <input
          id={ids.password}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={inputClasses(false)}
        />
      </div>
      <div className={FIELD_CLASSES}>
        <label htmlFor={ids.code} className={LABEL_CLASSES}>
          {messages.reauth.codeLabel}
        </label>
        <input
          id={ids.code}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(event) => setCode(event.target.value)}
          className={inputClasses(false)}
        />
      </div>
      {failure === null ? null : (
        <ErrorNotice>{messages.reauth[failure]}</ErrorNotice>
      )}
      {failure === "revoked" ? (
        <Link href="/" className={SMALL_SECONDARY_CLASSES}>
          {messages.logout.signInAgain}
        </Link>
      ) : (
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            aria-disabled={busy || undefined}
            className={SMALL_PRIMARY_CLASSES}
          >
            {busy ? messages.reauth.busy : messages.reauth.submit}
          </button>
          <button
            type="button"
            onClick={onCancelled}
            className={SMALL_SECONDARY_CLASSES}
          >
            {messages.common.cancel}
          </button>
        </div>
      )}
    </form>
  );
}

export function ActionFeedback({ action }: { action: Action }) {
  if (action.reauth) {
    return (
      <ReauthForm
        onConfirmed={action.reauthConfirmed}
        onCancelled={action.reauthCancelled}
      />
    );
  }
  return action.error === null ? null : (
    <ErrorNotice>{action.error}</ErrorNotice>
  );
}

/** A permanent notice that an action is the admins' (CA63: the server refuses it anyway). */
export function AdminOnlyNotice() {
  return <p className={WARNING_CLASSES}>{messages.common.adminOnly}</p>;
}
