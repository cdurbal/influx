"use client";

// TOTP activation in three steps (docs/mvp/17b §3.14.b and c; 21 J3-C rules 4 and 5, EC-56,
// G-1 point 2). The enrollment token comes from the fragment of the activation link: the person
// never types it, and a fragment never reaches a server log. It is read once, then removed from
// the address bar. The password is asked again at step 2 (17b §3.14 rule 3). The QR code is the
// SVG text of apps/api shown through a blob: URL, without any change to the CSP (rule 5). The ten
// recovery codes are shown once, never stored in the browser.
import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import { messages } from "@/messages/fr";
import {
  BRAND_CLASSES,
  CARD_CLASSES,
  cn,
  CODE_TEXT_CLASSES,
  HELP_CLASSES,
  INFO_CLASSES,
  inputClasses,
  LABEL_CLASSES,
  LEAD_CLASSES,
  PRIMARY_BUTTON_CLASSES,
  SCREEN_CLASSES,
  SECONDARY_BUTTON_CLASSES,
  TEXT_BUTTON_CLASSES,
  TITLE_CLASSES,
} from "./auth-classes";
import { confirmEnrollment, startEnrollment } from "./backoffice-auth";
import { ErrorNotice } from "./ErrorNotice";

const t = messages.enroll;

/** 32 random bytes in base64url (G-1 point 2), as the contract accepts it. */
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

const TOTP_SHAPE = /^\d{6}$/;

type Factor = { qrUrl: string; secret: string };

type Step =
  | { kind: "identity" }
  | { kind: "factor"; factor: Factor }
  | { kind: "codes"; codes: readonly string[] };

/** The token of the activation link, read once per page load (undefined: not read yet). */
let linkTokenRead: string | null | undefined;

function linkToken(): string | null {
  if (linkTokenRead === undefined) {
    const fromLink = window.location.hash.slice(1);
    linkTokenRead = TOKEN_SHAPE.test(fromLink) ? fromLink : null;
  }
  return linkTokenRead;
}

/** The fragment is read once: nothing to subscribe to. */
function neverChanges(): () => void {
  return () => undefined;
}

/** The secret by groups of four, easier to type (17b §3.14.b). */
function grouped(secret: string): string {
  return secret.match(/.{1,4}/g)?.join(" ") ?? secret;
}

export function Activation() {
  const router = useRouter();
  const titleRef = useRef<HTMLHeadingElement>(null);
  // A factor was already created in this page: a new one replaces it (17b §3.14.b).
  const factorCreated = useRef(false);
  const ids = {
    email: useId(),
    password: useId(),
    code: useId(),
    error: useId(),
  };
  // undefined while the page is not hydrated yet; null when the link carries no valid token.
  const token = useSyncExternalStore(neverChanges, linkToken, () => undefined);
  const [step, setStep] = useState<Step>({ kind: "identity" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [failure, setFailure] = useState<string | null>(null);
  const [restarted, setRestarted] = useState(false);
  const [kept, setKept] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  // Once read, the token leaves the address bar (history, screen sharing).
  useEffect(() => {
    if (token !== undefined && window.location.hash !== "") {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [token]);

  useEffect(() => {
    titleRef.current?.focus();
  }, [step.kind]);

  // The blob: URL of the QR code lives as long as its step.
  useEffect(() => {
    if (step.kind !== "factor") {
      return undefined;
    }
    const url = step.factor.qrUrl;
    return () => URL.revokeObjectURL(url);
  }, [step]);

  // 17b §3.14.c: leaving before the codes are kept asks for a confirmation.
  useEffect(() => {
    if (step.kind !== "codes" || kept) {
      return undefined;
    }
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [step.kind, kept]);

  async function confirmIdentity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || typeof token !== "string") {
      return;
    }
    // Form checks only, in the browser, without any call (17b §3.14.a).
    if (email.trim() === "" || password === "") {
      setFailure(messages.form.required);
      return;
    }
    setBusy(true);
    setFailure(null);
    try {
      const result = await startEnrollment(email.trim(), password, token);
      if (result.kind === "ok" && result.data.outcome === "factor_created") {
        const blob = new Blob([result.data.qrCodeSvg], {
          type: "image/svg+xml",
        });
        setRestarted(factorCreated.current);
        factorCreated.current = true;
        setStep({
          kind: "factor",
          factor: {
            qrUrl: URL.createObjectURL(blob),
            secret: result.data.secret,
          },
        });
        return;
      }
      if (
        result.kind === "ok" &&
        result.data.outcome === "invitation_invalid"
      ) {
        setFailure(t.invitationInvalid);
      } else if (
        result.kind === "ok" &&
        result.data.outcome === "unavailable"
      ) {
        // Rule 5: only when apps/api says nothing was checked; any other failure is generic.
        setFailure(messages.errors.unavailable);
      } else {
        setFailure(t.errorGeneric);
      }
    } finally {
      setPassword("");
      setBusy(false);
    }
  }

  async function activate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || typeof token !== "string") {
      return;
    }
    if (!TOTP_SHAPE.test(code.trim())) {
      setFailure(messages.errors.totpFormat);
      return;
    }
    if (password === "") {
      setFailure(messages.form.required);
      return;
    }
    setBusy(true);
    setFailure(null);
    try {
      const result = await confirmEnrollment(
        email.trim(),
        password,
        token,
        code.trim(),
      );
      if (result.kind === "ok" && result.data.outcome === "signed_in") {
        setStep({ kind: "codes", codes: result.data.recoveryCodes });
        return;
      }
      if (
        result.kind === "ok" &&
        result.data.outcome === "invitation_invalid"
      ) {
        setFailure(t.invitationInvalid);
      } else {
        // 17b §3.14.b: the QR code stays; only the two fields are cleared.
        setFailure(t.step2ErrorGeneric);
      }
    } finally {
      setPassword("");
      setCode("");
      setBusy(false);
    }
  }

  async function copyCodes(codes: readonly string[]) {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopied(true);
    } catch {
      // The clipboard may be refused by the browser: printing and writing them down remain.
      setCopied(false);
    }
  }

  const header = (
    <>
      <p className={BRAND_CLASSES}>{messages.brand}</p>
      <p className={HELP_CLASSES}>
        {t.step(step.kind === "identity" ? 1 : step.kind === "factor" ? 2 : 3)}
      </p>
    </>
  );

  const failureBlock =
    failure === null ? null : (
      <ErrorNotice id={ids.error}>{failure}</ErrorNotice>
    );

  if (step.kind === "codes") {
    const codes = step.codes;
    return (
      <main id="main" className={SCREEN_CLASSES}>
        {header}
        <h1 ref={titleRef} tabIndex={-1} className={TITLE_CLASSES}>
          {messages.recoveryCodes.title}
        </h1>
        <p className={LEAD_CLASSES}>{messages.recoveryCodes.lead}</p>
        <section aria-labelledby={`${ids.code}-codes`} className={CARD_CLASSES}>
          <h2 id={`${ids.code}-codes`} className={LABEL_CLASSES}>
            {messages.recoveryCodes.listLabel}
          </h2>
          <ol className="flex list-inside list-decimal flex-col gap-2">
            {codes.map((recoveryCode) => (
              <li key={recoveryCode} className={CODE_TEXT_CLASSES}>
                {recoveryCode}
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void copyCodes(codes)}
              className={SECONDARY_BUTTON_CLASSES}
            >
              {messages.recoveryCodes.copy}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className={SECONDARY_BUTTON_CLASSES}
            >
              {messages.recoveryCodes.print}
            </button>
          </div>
          <p role="status" className={HELP_CLASSES}>
            {copied ? messages.recoveryCodes.copied : null}
          </p>
        </section>
        <p className={INFO_CLASSES}>{messages.recoveryCodes.storage}</p>
        <p className={INFO_CLASSES}>{messages.recoveryCodes.alert}</p>
        <div className="flex items-center gap-3">
          <input
            id={`${ids.code}-kept`}
            type="checkbox"
            checked={kept}
            onChange={(event) => setKept(event.target.checked)}
            className="size-(--size-checkbox) accent-action-primary-bg"
          />
          <label htmlFor={`${ids.code}-kept`} className={LABEL_CLASSES}>
            {messages.recoveryCodes.confirm}
          </label>
        </div>
        <button
          type="button"
          disabled={!kept}
          onClick={() => router.replace("/accueil")}
          className={PRIMARY_BUTTON_CLASSES}
        >
          {messages.recoveryCodes.continue}
        </button>
      </main>
    );
  }

  if (step.kind === "factor") {
    return (
      <main id="main" className={SCREEN_CLASSES}>
        {header}
        <h1 ref={titleRef} tabIndex={-1} className={TITLE_CLASSES}>
          {t.step2Title}
        </h1>
        {restarted ? (
          <p role="status" className={INFO_CLASSES}>
            {t.step2Restarted}
          </p>
        ) : null}
        <section className={CARD_CLASSES}>
          <p className={LEAD_CLASSES}>{t.step2Scan}</p>
          {/* The QR code is dark on a light chip: an authenticator camera reads it on any screen. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- a blob: URL, never optimized */}
          <img
            src={step.factor.qrUrl}
            alt={t.step2QrAlt}
            className="aspect-square w-full max-w-(--size-phone-mockup) rounded-md bg-surface-inverse p-4"
          />
          <p className={HELP_CLASSES}>{t.step2Manual}</p>
          <p className={cn(CODE_TEXT_CLASSES, "select-all")}>
            {grouped(step.factor.secret)}
          </p>
        </section>
        <form noValidate onSubmit={activate} className={CARD_CLASSES}>
          <label htmlFor={ids.code} className={LABEL_CLASSES}>
            {t.step2CodeLabel}
          </label>
          <input
            id={ids.code}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            value={code}
            aria-describedby={failure === null ? undefined : ids.error}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
            className={inputClasses(false)}
          />
          <label htmlFor={ids.password} className={LABEL_CLASSES}>
            {t.step2PasswordLabel}
          </label>
          <p id={`${ids.password}-why`} className={HELP_CLASSES}>
            {t.step2PasswordWhy}
          </p>
          <input
            id={ids.password}
            type="password"
            autoComplete="current-password"
            required
            value={password}
            aria-describedby={`${ids.password}-why`}
            onChange={(event) => setPassword(event.target.value)}
            className={inputClasses(false)}
          />
          {failureBlock}
          <button
            type="submit"
            aria-disabled={busy || undefined}
            className={PRIMARY_BUTTON_CLASSES}
          >
            {busy ? t.busy : t.step2Submit}
          </button>
        </form>
        <button
          type="button"
          onClick={() => {
            setFailure(null);
            setStep({ kind: "identity" });
          }}
          className={TEXT_BUTTON_CLASSES}
        >
          {t.restartStep1}
        </button>
      </main>
    );
  }

  return (
    <main id="main" className={SCREEN_CLASSES}>
      {header}
      <h1 ref={titleRef} tabIndex={-1} className={TITLE_CLASSES}>
        {t.title}
      </h1>
      <p className={LEAD_CLASSES}>{t.lead}</p>
      {token === undefined ? null : token === null ? (
        <ErrorNotice>{t.invitationInvalid}</ErrorNotice>
      ) : (
        <form noValidate onSubmit={confirmIdentity} className={CARD_CLASSES}>
          <h2 className={LABEL_CLASSES}>{t.step1Title}</h2>
          <label htmlFor={ids.email} className={LABEL_CLASSES}>
            {messages.login.emailLabel}
          </label>
          <input
            id={ids.email}
            type="email"
            inputMode="email"
            autoComplete="username"
            spellCheck={false}
            required
            value={email}
            aria-describedby={failure === null ? undefined : ids.error}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClasses(false)}
          />
          <label htmlFor={ids.password} className={LABEL_CLASSES}>
            {messages.login.passwordLabel}
          </label>
          <input
            id={ids.password}
            type="password"
            autoComplete="current-password"
            required
            value={password}
            aria-describedby={failure === null ? undefined : ids.error}
            onChange={(event) => setPassword(event.target.value)}
            className={inputClasses(false)}
          />
          {failureBlock}
          <button
            type="submit"
            aria-disabled={busy || undefined}
            className={PRIMARY_BUTTON_CLASSES}
          >
            {busy ? t.busy : t.step1Submit}
          </button>
        </form>
      )}
    </main>
  );
}
