"use client";

// The frame of every screen behind the session (docs/mvp/17b §1, §3.14.a; 15 RG107; 21 J3S-6).
// GET /v1/bo/me decides: no session ⇒ back to sign-in. Permanent banners, all read from apps/api at
// every page, never from the address bar: the environment and its sending mode outside production
// (16 RG118, D70), the recovery-code session (J3S-6) and the degraded dual control while there are
// not two distinct active admins (15 RG107, CA71). The
// admin entries of the navigation are absent for an agent; the server refuses them anyway (CA63).
import type { BackofficeMeResponse } from "@influx/contracts/backoffice-auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { messages } from "@/messages/fr";
import { installErrorCollector } from "@/observability/error-collector";
import {
  BRAND_CLASSES,
  ERROR_CLASSES,
  HELP_CLASSES,
  SCREEN_CLASSES,
  SECONDARY_BUTTON_CLASSES,
  TEXT_BUTTON_CLASSES,
  TITLE_CLASSES,
  WARNING_CLASSES,
} from "./auth-classes";
import { readMe, signOut } from "./backoffice-auth";
import {
  HEADER_CLASSES,
  NAV_LIST_CLASSES,
  navLinkClasses,
  PAGE_CLASSES,
} from "./bo-classes";

export type NavKey =
  | "home"
  | "accounts"
  | "memberInvitations"
  | "dualControl"
  | "apollo"
  | "internalAccounts"
  | "health";

const NAV: readonly { key: NavKey; href: string; adminOnly: boolean }[] = [
  { key: "home", href: "/accueil", adminOnly: false },
  { key: "accounts", href: "/inscrits", adminOnly: false },
  { key: "memberInvitations", href: "/invitations", adminOnly: false },
  { key: "dualControl", href: "/double-validation", adminOnly: true },
  { key: "apollo", href: "/reglages/apollo", adminOnly: true },
  { key: "internalAccounts", href: "/comptes-internes", adminOnly: true },
  { key: "health", href: "/sante-technique", adminOnly: true },
];

const MeContext = createContext<BackofficeMeResponse | null>(null);

/** The session of the screen; only inside <Shell>. */
export function useMe(): BackofficeMeResponse {
  const me = useContext(MeContext);
  if (me === null) {
    throw new Error("useMe outside <Shell>");
  }
  return me;
}

type State =
  | { kind: "loading" }
  | { kind: "ready"; me: BackofficeMeResponse }
  | { kind: "unavailable" }
  | { kind: "signedOut" };

export function Shell({
  current,
  children,
}: {
  current: NavKey;
  children: ReactNode;
}) {
  const router = useRouter();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [state, setState] = useState<State>({ kind: "loading" });
  const [busy, setBusy] = useState(false);

  // Browser errors of the connected space (D60, 02 §20.5).
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
      setState(
        result.kind === "ok"
          ? { kind: "ready", me: result.data }
          : { kind: "unavailable" },
      );
    });
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (state.kind === "signedOut") {
      titleRef.current?.focus();
    }
  }, [state.kind]);

  async function leave() {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
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
          {messages.common.loading}
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

  const { me } = state;
  const factor = me.secondFactor;
  const { environment } = me;
  return (
    <MeContext.Provider value={me}>
      <div className={PAGE_CLASSES}>
        <a href="#main" className="sr-only focus:not-sr-only">
          {messages.nav.skip}
        </a>
        <header className={HEADER_CLASSES}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            {brand}
            <div className="flex flex-wrap items-center gap-3">
              <p className={HELP_CLASSES}>
                {messages.home.signedInAs(me.email, me.role)}
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
          </div>
          <nav aria-label={messages.nav.label}>
            <ul className={NAV_LIST_CLASSES}>
              {NAV.filter((item) => !item.adminOnly || me.role === "admin").map(
                (item) => (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      aria-current={item.key === current ? "page" : undefined}
                      className={navLinkClasses(item.key === current)}
                    >
                      {messages.nav[item.key]}
                    </Link>
                  </li>
                ),
              )}
            </ul>
          </nav>
          {environment.name === "production" ? null : (
            <p role="status" className={WARNING_CLASSES}>
              {messages.environmentBanner(
                environment.name,
                environment.brevoMode,
              )}
            </p>
          )}
          {factor.method === "recovery_code" ? (
            <p role="status" className={WARNING_CLASSES}>
              {messages.recoveryBanner(factor.recoveryCodesLeft)}
            </p>
          ) : null}
          {me.peerControlAvailable ? null : (
            <p role="status" className={WARNING_CLASSES}>
              {messages.peerControlBanner}
            </p>
          )}
        </header>
        <main id="main" className="flex flex-col gap-6">
          {children}
        </main>
      </div>
    </MeContext.Provider>
  );
}
