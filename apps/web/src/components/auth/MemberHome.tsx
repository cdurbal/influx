"use client";

// Minimal home of a member space (docs/mvp/05 RG71; 17 §2.4, §2.5, §3.7). The page is behind the
// session: GET /v1/me decides. No session ⇒ back to sign-in; a session of the other role ⇒ its own
// space (the space follows the real role, never the address typed). The home announces what comes
// next (the profile, Lot 2) and how INFLUX works, without any figure (05 RG9). Sign-out revokes the
// session, then shows `auth.logout.done`. A version of the terms waiting for acceptance shows the
// blocking screen first (17 §6.7); "mon compte" is one link away.
import type { TermsToAccept } from "@influx/contracts/account";
import type { SignupDoor } from "@influx/contracts/auth";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { TermsGate } from "@/components/account/TermsGate";
import { Link, useRouter } from "@/i18n/navigation";
import {
  BRAND_CLASSES,
  CARD_CLASSES,
  ERROR_CLASSES,
  HELP_CLASSES,
  INFO_CLASSES,
  LABEL_CLASSES,
  LEAD_CLASSES,
  SCREEN_CLASSES,
  SECONDARY_BUTTON_CLASSES,
  TEXT_BUTTON_CLASSES,
  TITLE_CLASSES,
} from "./auth-classes";
import { homePageOf, memberPageHref } from "@/lib/member-paths";
import { installErrorCollector } from "@/observability/error-collector";
import { readMe, signOut } from "./member-auth";

type State =
  | { kind: "loading" }
  | { kind: "ready"; email: string; termsToAccept: TermsToAccept | null }
  | { kind: "termsRefused"; message: string }
  | { kind: "unavailable" }
  | { kind: "signedOut" };

/** 17 §2.4: three short steps, profile → campaign → a salesperson makes the introduction. */
const HOME_STEPS = ["one", "two", "three"] as const;

/** `space`: the role whose space this page is. */
export function MemberHome({ space }: { space: SignupDoor }) {
  const t = useTranslations("auth");
  const tAccount = useTranslations("account");
  const locale = useLocale();
  const router = useRouter();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const stepsTitleId = useId();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [busy, setBusy] = useState(false);

  // Browser errors of the connected space (D60, 02 §20.5); never on the landing.
  useEffect(() => installErrorCollector(), []);
  useEffect(() => {
    let active = true;
    void readMe().then((result) => {
      if (!active) {
        return;
      }
      if (result.kind === "unauthenticated") {
        router.replace(memberPageHref("signIn", locale));
        return;
      }
      if (result.kind === "failed") {
        setState({ kind: "unavailable" });
        return;
      }
      if (result.data.role !== space) {
        router.replace(memberPageHref(homePageOf(result.data.role), locale));
        return;
      }
      setState({
        kind: "ready",
        email: result.data.email,
        termsToAccept: result.data.termsToAccept,
      });
    });
    return () => {
      active = false;
    };
  }, [space, router, locale]);

  // After the blocking terms screen: the account is read again (05 RG28).
  const reload = useCallback(async () => {
    const result = await readMe();
    if (result.kind === "unauthenticated") {
      router.replace(memberPageHref("signIn", locale));
      return;
    }
    setState(
      result.kind === "ok"
        ? {
            kind: "ready",
            email: result.data.email,
            termsToAccept: result.data.termsToAccept,
          }
        : { kind: "unavailable" },
    );
  }, [router, locale]);

  useEffect(() => {
    if (
      state.kind === "ready" ||
      state.kind === "signedOut" ||
      state.kind === "termsRefused"
    ) {
      titleRef.current?.focus();
    }
  }, [state.kind]);

  async function leave() {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      // The cookie is cleared by apps/api even when the session is already unknown.
      const result = await signOut();
      setState(
        result.kind === "failed"
          ? { kind: "unavailable" }
          : { kind: "signedOut" },
      );
    } finally {
      setBusy(false);
    }
  }

  const brand = <p className={BRAND_CLASSES}>{t("brand")}</p>;

  if (state.kind === "loading") {
    return (
      <main id="main" className={SCREEN_CLASSES} aria-busy="true">
        {brand}
        <p role="status" className={HELP_CLASSES}>
          {t("home.loading")}
        </p>
      </main>
    );
  }

  if (state.kind === "unavailable") {
    return (
      <main id="main" className={SCREEN_CLASSES}>
        {brand}
        <p role="alert" className={ERROR_CLASSES}>
          {t("home.unavailable")}
        </p>
      </main>
    );
  }

  if (state.kind === "termsRefused") {
    return (
      <main id="main" className={SCREEN_CLASSES}>
        {brand}
        <h1 ref={titleRef} tabIndex={-1} className={TITLE_CLASSES}>
          {t("logout.done")}
        </h1>
        <p role="status" className={INFO_CLASSES}>
          {state.message}
        </p>
        <Link
          href={memberPageHref("signIn", locale)}
          className={TEXT_BUTTON_CLASSES}
        >
          {t("logout.signInAgain")}
        </Link>
      </main>
    );
  }

  // 17 §6.7: a version of the terms waits for acceptance — the blocking screen, before the page.
  if (state.kind === "ready" && state.termsToAccept !== null) {
    return (
      <TermsGate
        termsToAccept={state.termsToAccept}
        onAccepted={reload}
        onRefused={(message) => setState({ kind: "termsRefused", message })}
      />
    );
  }

  if (state.kind === "signedOut") {
    return (
      <main id="main" className={SCREEN_CLASSES}>
        {brand}
        <h1 ref={titleRef} tabIndex={-1} className={TITLE_CLASSES}>
          {t("logout.done")}
        </h1>
        <Link
          href={memberPageHref("signIn", locale)}
          className={TEXT_BUTTON_CLASSES}
        >
          {t("logout.signInAgain")}
        </Link>
      </main>
    );
  }

  return (
    <main id="main" className={SCREEN_CLASSES}>
      {brand}
      <h1 ref={titleRef} tabIndex={-1} className={TITLE_CLASSES}>
        {t(`home.${space}.title`)}
      </h1>
      <p className={LEAD_CLASSES}>{t(`home.${space}.lead`)}</p>
      <section aria-labelledby={stepsTitleId} className={CARD_CLASSES}>
        <h2 id={stepsTitleId} className={LABEL_CLASSES}>
          {t("home.howItWorks")}
        </h2>
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-md text-text-secondary">
          {HOME_STEPS.map((step) => (
            <li key={step}>{t(`home.${space}.steps.${step}`)}</li>
          ))}
        </ol>
      </section>
      <div className={CARD_CLASSES}>
        <p className={INFO_CLASSES}>
          {t("home.signedInAs", { email: state.email })}
        </p>
        <Link
          href={memberPageHref("accountDetails", locale)}
          className={TEXT_BUTTON_CLASSES}
        >
          {tAccount("homeLink")}
        </Link>
        <button
          type="button"
          onClick={leave}
          aria-disabled={busy || undefined}
          className={SECONDARY_BUTTON_CLASSES}
        >
          {busy ? t("logout.busy") : t("logout.action")}
        </button>
      </div>
    </main>
  );
}
