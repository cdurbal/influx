"use client";

// The frame of every screen behind the session (docs/mvp/17b §1.4, §1.7, §3.14.a; 02 §21.5 points 1
// and 8; 15 RG107; 21 J3S-6), mounted once by (app)/layout.tsx: it stays in place across the pages,
// the rail is no longer rebuilt at each navigation. GET /v1/bo/me is read when it mounts AND at each
// change of path, without emptying the screen: no session ⇒ back to sign-in; the permanent banners
// are read from apps/api at every page, never from the address bar: the environment, always written,
// and its sending mode outside production (16 RG118, D70), the recovery-code session (J3S-6) and the
// degraded dual control while there are not two distinct active admins (15 RG107, CA71). The pages
// receive the session through useMe() and never read it themselves (G9).
// One <nav> "Navigation principale", restyled by CSS: the rail from lg, a compact horizontal list
// from md to lg; a window too small (bo-small:, tokens-backoffice.css) shows the "poste de travail"
// screen instead, without business content (F7). The entries a role sees and the entry of a path
// are pure functions of bo-nav.ts, drawn by BoNav.tsx with the screens of the active entry as its
// sub-entries (D74); the admin entry is absent for an agent, the server refuses those screens
// anyway (CA63).
import type { BackofficeMeResponse } from "@influx/contracts/backoffice-auth";
import Link from "next/link";
import { AuthHeader } from "./AuthHeader";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { messages } from "@/messages/fr";
import { installErrorCollector } from "@influx/web-platform/error-collector";
import {
  BRAND_CLASSES,
  cn,
  HELP_CLASSES,
  INFO_CLASSES,
  LEAD_CLASSES,
  SCREEN_CLASSES,
  TEXT_BUTTON_CLASSES,
  TITLE_CLASSES,
  WARNING_CLASSES,
} from "./auth-classes";
import { readMe, signOut } from "./backoffice-auth";
import { SMALL_SECONDARY_CLASSES } from "./bo-classes";
import { activePlaceOf, navItemsOf, type ActivePlace } from "./bo-nav";
import { BoNav } from "./BoNav";
import { ErrorNotice } from "./ErrorNotice";
import { LogOutIcon } from "./icons";
import {
  BAND_CLASSES,
  BANNERS_CLASSES,
  BRAND_LINK_CLASSES,
  ENV_NAME_CLASSES,
  envBarClasses,
  FRAME_CLASSES,
  MAIN_CLASSES,
  NAV_ICON_CLASSES,
  PRODUCT_CLASSES,
  RAIL_CLASSES,
  RAIL_FOOT_CLASSES,
  RAIL_HEAD_CLASSES,
  SKIP_LINK_CLASSES,
  SMALL_BODY_CLASSES,
  SMALL_SCREEN_CLASSES,
} from "./shell-classes";

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

export function Shell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [state, setState] = useState<State>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  // Signed out: the page ends there, no later read brings the frame back.
  const ended = useRef(false);

  // Browser errors of the connected space (D60, 02 §20.5).
  useEffect(() => installErrorCollector(), []);

  // At the mount and at each change of path (02 §21.5 point 1): the session and the banners read
  // again, the screen kept meanwhile. A read overtaken by the next navigation is dropped.
  useEffect(() => {
    let current = true;
    void readMe().then((result) => {
      if (!current || ended.current) {
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
      current = false;
    };
  }, [router, pathname]);

  useEffect(() => {
    if (state.kind === "signedOut") {
      titleRef.current?.focus();
    }
  }, [state.kind]);

  const leave = useCallback(async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      const result = await signOut();
      if (result.kind === "failed") {
        setState({ kind: "unavailable" });
        return;
      }
      ended.current = true;
      setState({ kind: "signedOut" });
    } finally {
      setBusy(false);
    }
  }, [busy]);

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
        <ErrorNotice>{messages.session.ended}</ErrorNotice>
        <Link href="/" className={TEXT_BUTTON_CLASSES}>
          {messages.logout.signInAgain}
        </Link>
      </main>
    );
  }
  if (state.kind === "signedOut") {
    return (
      <main id="main" className={SCREEN_CLASSES}>
        <AuthHeader title={messages.logout.done} titleRef={titleRef} />
        <Link href="/" className={TEXT_BUTTON_CLASSES}>
          {messages.logout.signInAgain}
        </Link>
      </main>
    );
  }

  const { me } = state;
  const signOutButton = (
    <button
      type="button"
      onClick={() => void leave()}
      aria-disabled={busy || undefined}
      className={cn(SMALL_SECONDARY_CLASSES, "gap-2")}
    >
      <LogOutIcon aria-hidden="true" className={NAV_ICON_CLASSES} />
      {busy ? messages.logout.busy : messages.shell.signOut}
    </button>
  );
  return (
    <MeContext.Provider value={me}>
      <Frame
        me={me}
        place={activePlaceOf(pathname)}
        pathname={pathname}
        signOutButton={signOutButton}
      >
        {children}
      </Frame>
      <SmallWindow me={me} signOutButton={signOutButton} />
    </MeContext.Provider>
  );
}

/** Bar 1 of the band: the environment, always written, then who is signed in and as what. */
function EnvironmentBar({
  me,
  withProduct,
}: {
  me: BackofficeMeResponse;
  withProduct: boolean;
}) {
  const { environment } = me;
  const production = environment.name === "production";
  return (
    <div className={envBarClasses(production)}>
      <p>
        <span className={ENV_NAME_CLASSES}>
          {messages.shell.environment[environment.name]}
        </span>
        {withProduct ? ` · ${messages.brand}` : null}
        {environment.name === "production"
          ? null
          : ` — ${messages.environmentBanner(environment.name, environment.brevoMode)}`}
      </p>
      <p className="break-all">{messages.shell.identity(me.email, me.role)}</p>
    </div>
  );
}

/**
 * The workstation frame: skip link, head band, the rail (a strip from md to lg) holding the
 * sub-entries of the active entry, then <main>. The focus goes to the h1 of the new page after a
 * navigation (17b §1.7), not at the first load, where the first Tab must reach the skip link.
 */
function Frame({
  me,
  place,
  pathname,
  signOutButton,
  children,
}: {
  me: BackofficeMeResponse;
  place: ActivePlace | null;
  pathname: string;
  signOutButton: ReactNode;
  children: ReactNode;
}) {
  const mainRef = useRef<HTMLElement>(null);
  const shownPath = useRef(pathname);
  useEffect(() => {
    if (shownPath.current === pathname) {
      return;
    }
    shownPath.current = pathname;
    const main = mainRef.current;
    if (main === null) {
      return;
    }
    // The screen may draw its h1 after the path changed (a suspended page, a first read): the
    // focus waits for it, and gives up at the next navigation.
    const focusTitle = (): boolean => {
      const title = main.querySelector("h1");
      if (!(title instanceof HTMLElement)) {
        return false;
      }
      if (!title.hasAttribute("tabindex")) {
        title.tabIndex = -1;
      }
      title.focus();
      return true;
    };
    if (focusTitle()) {
      return;
    }
    const observer = new MutationObserver(() => {
      if (focusTitle()) {
        observer.disconnect();
      }
    });
    observer.observe(main, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname]);

  const factor = me.secondFactor;
  return (
    <div className={FRAME_CLASSES}>
      <a href="#main" className={SKIP_LINK_CLASSES}>
        {messages.nav.skip}
      </a>
      <header className={BAND_CLASSES}>
        <EnvironmentBar me={me} withProduct={false} />
        {factor.method === "recovery_code" || !me.peerControlAvailable ? (
          <div className={BANNERS_CLASSES}>
            {factor.method === "recovery_code" ? (
              <p role="status" className={WARNING_CLASSES}>
                {messages.recoveryBanner(factor.recoveryCodesLeft)}
              </p>
            ) : null}
            {me.peerControlAvailable ? null : (
              <p role="status" className={INFO_CLASSES}>
                {messages.peerControlBanner}
              </p>
            )}
          </div>
        ) : null}
      </header>
      <div className={RAIL_CLASSES}>
        <div className={RAIL_HEAD_CLASSES}>
          <Link href="/accueil" className={BRAND_LINK_CLASSES}>
            {messages.shell.name}
            <span className={PRODUCT_CLASSES}>{messages.shell.product}</span>
          </Link>
        </div>
        <BoNav items={navItemsOf(me.role)} place={place} LinkComponent={Link} />
        <div className={RAIL_FOOT_CLASSES}>{signOutButton}</div>
      </div>
      <main id="main" ref={mainRef} tabIndex={-1} className={MAIN_CLASSES}>
        {children}
      </main>
    </div>
  );
}

/**
 * 17b §1.7, F7: narrower than 768 px or lower than 500 px, a reduced band, the explanation and
 * sign-out, no business content, until the views of D58 (Lot 4). Shown by CSS alone (bo-small:);
 * not a <main>: the page keeps a single one, that of the frame.
 */
function SmallWindow({
  me,
  signOutButton,
}: {
  me: BackofficeMeResponse;
  signOutButton: ReactNode;
}) {
  return (
    <div className={SMALL_SCREEN_CLASSES}>
      <header className={BAND_CLASSES}>
        <EnvironmentBar me={me} withProduct />
      </header>
      <div className={SMALL_BODY_CLASSES}>
        <h1 className={TITLE_CLASSES}>
          {messages.shell.workstationOnly.title}
        </h1>
        <p className={LEAD_CLASSES}>{messages.shell.workstationOnly.body}</p>
        {signOutButton}
      </div>
    </div>
  );
}
