"use client";

// Empty home of the backoffice at J3 (docs/mvp/17b §3.14; 21 §4, J3 commit 12). The page is
// behind the aal2 session: GET /v1/bo/me decides. No session, or a session without aal2 ⇒ back to
// sign-in. The recovery banner (17b §3.14.a, EC-17 point 4) is shown when the sign-in came from a
// recovery code; sign-out revokes the session, then shows `logout.done`.
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { InternalRole } from "@influx/contracts/backoffice-auth";
import { messages } from "@/messages/fr";
import {
  BRAND_CLASSES,
  CARD_CLASSES,
  ERROR_CLASSES,
  HELP_CLASSES,
  INFO_CLASSES,
  LEAD_CLASSES,
  SCREEN_CLASSES,
  SECONDARY_BUTTON_CLASSES,
  TEXT_BUTTON_CLASSES,
  TITLE_CLASSES,
  WARNING_CLASSES,
} from "./auth-classes";
import { installErrorCollector } from "@/observability/error-collector";
import { readMe, signOut } from "./backoffice-auth";

type State =
  | { kind: "loading" }
  | { kind: "ready"; email: string; role: InternalRole }
  | { kind: "unavailable" }
  | { kind: "signedOut" };

/** The codes left after a recovery sign-in, as LoginForm passes them; null otherwise. */
function recoveryCodesLeft(value: string | null): number | null {
  if (value === null || !/^\d$/.test(value)) {
    return null;
  }
  return Number(value);
}

export function BackofficeHome() {
  const router = useRouter();
  const search = useSearchParams();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [state, setState] = useState<State>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const remaining = recoveryCodesLeft(search.get("secours"));

  // Browser errors of the connected space (D60, 02 §20.5); never on the landing.
  useEffect(() => installErrorCollector(), []);
  useEffect(() => {
    let active = true;
    void readMe().then((result) => {
      if (!active) {
        return;
      }
      if (result.kind === "unauthenticated") {
        router.replace("/");
        return;
      }
      if (result.kind === "failed") {
        // 403 without aal2 lands here too: the session cannot be used, sign in again.
        setState({ kind: "unavailable" });
        return;
      }
      setState({
        kind: "ready",
        email: result.data.email,
        role: result.data.role,
      });
    });
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (state.kind === "ready" || state.kind === "signedOut") {
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

  const brand = <p className={BRAND_CLASSES}>{messages.brand}</p>;

  if (state.kind === "loading") {
    return (
      <main id="main" className={SCREEN_CLASSES} aria-busy="true">
        {brand}
        <p role="status" className={HELP_CLASSES}>
          {messages.home.loading}
        </p>
      </main>
    );
  }

  if (state.kind === "unavailable") {
    return (
      <main id="main" className={SCREEN_CLASSES}>
        {brand}
        <p role="alert" className={ERROR_CLASSES}>
          {messages.session.ended}
        </p>
        <Link href="/" className={TEXT_BUTTON_CLASSES}>
          {messages.logout.signInAgain}
        </Link>
      </main>
    );
  }

  if (state.kind === "signedOut") {
    return (
      <main id="main" className={SCREEN_CLASSES}>
        {brand}
        <h1 ref={titleRef} tabIndex={-1} className={TITLE_CLASSES}>
          {messages.logout.done}
        </h1>
        <Link href="/" className={TEXT_BUTTON_CLASSES}>
          {messages.logout.signInAgain}
        </Link>
      </main>
    );
  }

  return (
    <main id="main" className={SCREEN_CLASSES}>
      {brand}
      {remaining === null ? null : (
        <p role="status" className={WARNING_CLASSES}>
          {messages.recoveryBanner(remaining)}
        </p>
      )}
      <h1 ref={titleRef} tabIndex={-1} className={TITLE_CLASSES}>
        {messages.home.title}
      </h1>
      <p className={LEAD_CLASSES}>{messages.home.lead}</p>
      <div className={CARD_CLASSES}>
        <p className={INFO_CLASSES}>
          {messages.home.signedInAs(state.email, state.role)}
        </p>
        <button
          type="button"
          onClick={leave}
          aria-disabled={busy || undefined}
          className={SECONDARY_BUTTON_CLASSES}
        >
          {busy ? messages.logout.busy : messages.logout.action}
        </button>
      </div>
    </main>
  );
}
