"use client";

// Empty home of a member space at J3 (docs/mvp/17 §3.7, §2.5). The page is behind the session:
// GET /v1/me decides. No session ⇒ back to sign-in; a session of the other role ⇒ its own space
// (the space follows the real role, never the address typed). Sign-out revokes the session, then
// shows `auth.logout.done`.
import type { SignupDoor } from "@influx/contracts/auth";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
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
} from "./auth-classes";
import { readMe, signOut } from "./member-auth";

type State =
  | { kind: "loading" }
  | { kind: "ready"; email: string }
  | { kind: "unavailable" }
  | { kind: "signedOut" };

const SPACE_OF: Record<SignupDoor, "/marque" | "/createur"> = {
  advertiser: "/marque",
  creator: "/createur",
};

/** `space`: the role whose space this page is. */
export function MemberHome({ space }: { space: SignupDoor }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [state, setState] = useState<State>({ kind: "loading" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void readMe().then((result) => {
      if (!active) {
        return;
      }
      if (result.kind === "unauthenticated") {
        router.replace("/connexion");
        return;
      }
      if (result.kind === "failed") {
        setState({ kind: "unavailable" });
        return;
      }
      if (result.data.role !== space) {
        router.replace(SPACE_OF[result.data.role]);
        return;
      }
      setState({ kind: "ready", email: result.data.email });
    });
    return () => {
      active = false;
    };
  }, [space, router]);

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

  if (state.kind === "signedOut") {
    return (
      <main id="main" className={SCREEN_CLASSES}>
        {brand}
        <h1 ref={titleRef} tabIndex={-1} className={TITLE_CLASSES}>
          {t("logout.done")}
        </h1>
        <Link href="/connexion" className={TEXT_BUTTON_CLASSES}>
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
      <div className={CARD_CLASSES}>
        <p className={INFO_CLASSES}>
          {t("home.signedInAs", { email: state.email })}
        </p>
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
