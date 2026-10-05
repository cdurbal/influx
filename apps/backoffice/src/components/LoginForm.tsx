"use client";

// Backoffice sign-in in one request (docs/mvp/17b §3.14.a; 21 J3-C rule 4, EC-40): address,
// password and a TOTP code, or a recovery code, on the same screen. One failure message whatever
// the step at fault; the outage message only when nothing was checked (rule 5). The password
// lives in this form's state only and is cleared after every attempt (rule 3).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { messages } from "@/messages/fr";
import {
  BRAND_CLASSES,
  CARD_CLASSES,
  ERROR_CLASSES,
  HELP_CLASSES,
  inputClasses,
  LABEL_CLASSES,
  LEAD_CLASSES,
  PRIMARY_BUTTON_CLASSES,
  SCREEN_CLASSES,
  TEXT_BUTTON_CLASSES,
  TITLE_CLASSES,
} from "./auth-classes";
import { signIn } from "./backoffice-auth";

const TOTP_SHAPE = /^\d{6}$/;
/** 16 characters once spaces and dashes are removed (17b §3.14.a). */
const RECOVERY_SHAPE = /^[0-9A-Za-z]{16}$/;

type Field = "email" | "password" | "code";
type FieldErrors = Partial<Record<Field, string>>;

const t = messages;

export function LoginForm() {
  const router = useRouter();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const ids = {
    email: useId(),
    password: useId(),
    code: useId(),
    error: useId(),
  };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  /** Form checks only, in the browser, without any call (17b §3.14.a). */
  function formErrors(): FieldErrors {
    const found: FieldErrors = {};
    if (email.trim() === "") {
      found.email = t.form.required;
    }
    if (password === "") {
      found.password = t.form.required;
    }
    const typed = code.replace(/[\s-]/g, "");
    if (typed === "") {
      found.code = t.form.required;
    } else if (!useRecovery && !TOTP_SHAPE.test(typed)) {
      found.code = t.errors.totpFormat;
    } else if (useRecovery && !RECOVERY_SHAPE.test(typed)) {
      found.code = t.errors.recoveryFormat;
    }
    return found;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) {
      return;
    }
    const found = formErrors();
    setErrors(found);
    setFailure(null);
    if (Object.keys(found).length > 0) {
      return;
    }
    setBusy(true);
    try {
      const result = await signIn(
        email.trim(),
        password,
        useRecovery
          ? { kind: "recovery", code }
          : { kind: "totp", code: code.trim() },
      );
      if (result.kind === "ok" && result.data.outcome === "signed_in") {
        router.replace(
          result.data.mfaMethod === "recovery_code"
            ? `/accueil?secours=${result.data.recoveryCodesLeft}`
            : "/accueil",
        );
        return;
      }
      // Rule 5: the outage message only when apps/api says nothing was checked. A relay or
      // network failure may come after the password was verified: it gets the single failure.
      const unavailable =
        result.kind === "ok" && result.data.outcome === "unavailable";
      setFailure(unavailable ? t.errors.unavailable : t.login.errorGeneric);
    } finally {
      // 17b §3.14 rule 3: nothing of the secrets stays between two attempts.
      setPassword("");
      setCode("");
      setBusy(false);
    }
  }

  function described(field: Field): string | undefined {
    const parts = [
      errors[field] ? `${ids[field]}-error` : "",
      failure ? ids.error : "",
    ];
    const value = parts.filter(Boolean).join(" ");
    return value === "" ? undefined : value;
  }

  function fieldError(field: Field) {
    const message = errors[field];
    return message === undefined ? null : (
      <p id={`${ids[field]}-error`} className={ERROR_CLASSES}>
        {message}
      </p>
    );
  }

  return (
    <main id="main" className={SCREEN_CLASSES}>
      <p className={BRAND_CLASSES}>{t.brand}</p>
      <h1 ref={titleRef} tabIndex={-1} className={TITLE_CLASSES}>
        {t.login.title}
      </h1>
      <p className={LEAD_CLASSES}>{t.login.lead}</p>
      <form noValidate onSubmit={submit} className={CARD_CLASSES}>
        <label htmlFor={ids.email} className={LABEL_CLASSES}>
          {t.login.emailLabel}
        </label>
        <input
          id={ids.email}
          type="email"
          inputMode="email"
          autoComplete="username"
          spellCheck={false}
          required
          value={email}
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={described("email")}
          onChange={(event) => setEmail(event.target.value)}
          className={inputClasses(Boolean(errors.email))}
        />
        {fieldError("email")}
        <label htmlFor={ids.password} className={LABEL_CLASSES}>
          {t.login.passwordLabel}
        </label>
        <input
          id={ids.password}
          type="password"
          autoComplete="current-password"
          required
          value={password}
          aria-invalid={errors.password ? true : undefined}
          aria-describedby={described("password")}
          onChange={(event) => setPassword(event.target.value)}
          className={inputClasses(Boolean(errors.password))}
        />
        {fieldError("password")}
        <label htmlFor={ids.code} className={LABEL_CLASSES}>
          {useRecovery ? t.login.recoveryLabel : t.login.totpLabel}
        </label>
        <input
          id={ids.code}
          type="text"
          inputMode={useRecovery ? "text" : "numeric"}
          autoComplete={useRecovery ? "off" : "one-time-code"}
          spellCheck={false}
          required
          value={code}
          aria-invalid={errors.code ? true : undefined}
          aria-describedby={described("code")}
          onChange={(event) => setCode(event.target.value)}
          className={inputClasses(Boolean(errors.code))}
        />
        {useRecovery ? (
          <p className={HELP_CLASSES}>{t.login.recoveryHelp}</p>
        ) : null}
        {fieldError("code")}
        <button
          type="button"
          onClick={() => {
            setUseRecovery(!useRecovery);
            setCode("");
            setErrors({});
          }}
          className={TEXT_BUTTON_CLASSES}
        >
          {useRecovery ? t.login.useTotp : t.login.useRecoveryCode}
        </button>
        {failure !== null ? (
          <p id={ids.error} role="alert" className={ERROR_CLASSES}>
            {failure}
          </p>
        ) : null}
        <button
          type="submit"
          aria-disabled={busy || undefined}
          className={PRIMARY_BUTTON_CLASSES}
        >
          {busy ? t.login.submitBusy : t.login.submit}
        </button>
      </form>
      <Link href="/activation" className={TEXT_BUTTON_CLASSES}>
        {t.login.firstTime}
      </Link>
    </main>
  );
}
