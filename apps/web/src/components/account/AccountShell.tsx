"use client";

// The frame of every "mon compte" page (docs/mvp/17 §6, §6.7; 05 RG28, RG54, RG71): behind the
// session (GET /v1/me decides; no session ⇒ the sign-in page), the navigation between the four
// pages, the offline banner, and the blocking terms screen BEFORE any page — except "mes
// préférences" and "mes données", whose rights survive a refused version (J7 A3): they show a
// notice instead. The page itself receives the account, a way to read it again, and a way to
// end on "signed out" (closing the current session, changing the address).
import type { MeResponse } from "@influx/contracts/account";
import { useLocale, useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  BRAND_CLASSES,
  HEADER_CLASSES,
  HELP_CLASSES,
  INFO_CLASSES,
  SCREEN_CLASSES,
  SECONDARY_BUTTON_CLASSES,
  TEXT_BUTTON_CLASSES,
  TITLE_CLASSES,
  WARNING_CLASSES,
} from "@/components/auth/auth-classes";
import { readMe } from "@/components/auth/member-auth";
import { useOnline } from "@/components/auth/use-online";
import { Link, useRouter } from "@/i18n/navigation";
import {
  ACCOUNT_PAGES,
  homePageOf,
  memberPageHref,
  TERMS_EXEMPT_PAGES,
  type AccountPage,
} from "@/lib/member-paths";
import { installErrorCollector } from "@/observability/error-collector";
import {
  INLINE_LINK_CLASSES,
  NAV_LIST_CLASSES,
  navLinkClasses,
} from "./account-classes";
import { TermsGate } from "./TermsGate";
import { ErrorNotice } from "@/components/ui/ErrorNotice";

export type AccountContext = {
  me: MeResponse;
  online: boolean;
  /** Reads the account again (after a change of address, a new language…). */
  refresh: () => Promise<void>;
  /** Ends the page on "signed out", with the sentence that says why. */
  signedOut: (message: string) => void;
  /** Ends the page on "your account is deleted" (D72): no account navigation, the session is closed. */
  accountDeleted: () => void;
};

type State =
  | { kind: "loading" }
  | { kind: "ready"; me: MeResponse }
  | { kind: "unavailable" }
  | { kind: "signedOut"; message: string }
  | { kind: "deleted" };

export function AccountShell({
  page,
  children,
}: {
  page: AccountPage;
  children: (context: AccountContext) => ReactNode;
}) {
  const t = useTranslations("account");
  const tData = useTranslations("account.data");
  const locale = useLocale();
  const router = useRouter();
  const online = useOnline();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [state, setState] = useState<State>({ kind: "loading" });

  // Browser errors of the connected space (D60, 02 §20.5).
  useEffect(() => installErrorCollector(), []);

  const load = useCallback(async () => {
    const result = await readMe();
    if (result.kind === "unauthenticated") {
      // 17 §6.7, "Session expirée": back to the sign-in page.
      router.replace(memberPageHref("signIn", locale));
      return;
    }
    setState(
      result.kind === "ok"
        ? { kind: "ready", me: result.data }
        : { kind: "unavailable" },
    );
  }, [router, locale]);

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
      setState(
        result.kind === "ok"
          ? { kind: "ready", me: result.data }
          : { kind: "unavailable" },
      );
    });
    return () => {
      active = false;
    };
  }, [router, locale]);

  const signedOut = useCallback((message: string) => {
    setState({ kind: "signedOut", message });
  }, []);

  const accountDeleted = useCallback(() => {
    setState({ kind: "deleted" });
  }, []);

  useEffect(() => {
    if (state.kind === "signedOut" || state.kind === "deleted") {
      titleRef.current?.focus();
    }
  }, [state.kind]);

  const header = (
    <header className={HEADER_CLASSES}>
      <p className={BRAND_CLASSES}>{t("brand")}</p>
    </header>
  );

  if (state.kind === "loading") {
    return (
      <main id="main" className={SCREEN_CLASSES} aria-busy="true">
        {header}
        <p role="status" className={HELP_CLASSES}>
          {t("loading")}
        </p>
      </main>
    );
  }

  if (state.kind === "unavailable") {
    return (
      <main id="main" className={SCREEN_CLASSES}>
        {header}
        <ErrorNotice>{t("unavailable")}</ErrorNotice>
        <button
          type="button"
          onClick={() => {
            setState({ kind: "loading" });
            void load();
          }}
          className={SECONDARY_BUTTON_CLASSES}
        >
          {t("retry")}
        </button>
      </main>
    );
  }

  if (state.kind === "deleted") {
    return (
      <main id="main" className={SCREEN_CLASSES}>
        {header}
        <h1 ref={titleRef} tabIndex={-1} className={TITLE_CLASSES}>
          {tData("deleted.title")}
        </h1>
        <p role="status" className={INFO_CLASSES}>
          {tData("deleted.text")}
        </p>
        <Link href="/" className={TEXT_BUTTON_CLASSES}>
          {tData("deleted.home")}
        </Link>
      </main>
    );
  }

  if (state.kind === "signedOut") {
    return (
      <main id="main" className={SCREEN_CLASSES}>
        {header}
        <h1 ref={titleRef} tabIndex={-1} className={TITLE_CLASSES}>
          {t("signedOut.title")}
        </h1>
        <p role="status" className={INFO_CLASSES}>
          {state.message}
        </p>
        <Link
          href={memberPageHref("signIn", locale)}
          className={TEXT_BUTTON_CLASSES}
        >
          {t("signedOut.signInAgain")}
        </Link>
      </main>
    );
  }

  const { me } = state;
  const termsPending = me.termsToAccept !== null;
  if (me.termsToAccept !== null && !TERMS_EXEMPT_PAGES.includes(page)) {
    return (
      <TermsGate
        termsToAccept={me.termsToAccept}
        onAccepted={load}
        onRefused={signedOut}
      />
    );
  }

  return (
    <main id="main" className={SCREEN_CLASSES}>
      {header}
      <nav aria-label={t("nav.label")} className="flex flex-col gap-3">
        <Link
          href={memberPageHref(homePageOf(me.role), locale)}
          className={INLINE_LINK_CLASSES}
        >
          {t("nav.home")}
        </Link>
        <ul className={NAV_LIST_CLASSES}>
          {ACCOUNT_PAGES.map((item) => (
            <li key={item}>
              <Link
                href={memberPageHref(item, locale)}
                aria-current={item === page ? "page" : undefined}
                className={navLinkClasses(item === page)}
              >
                {t(`nav.${item}`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {online ? null : (
        <p role="status" className={WARNING_CLASSES}>
          {t("offline")}
        </p>
      )}
      {termsPending ? (
        <p role="note" className={INFO_CLASSES}>
          {t("terms.pendingNotice")}{" "}
          <Link
            href={memberPageHref("accountDetails", locale)}
            className={INLINE_LINK_CLASSES}
          >
            {t("terms.pendingLink")}
          </Link>
        </p>
      ) : null}
      {children({ me, online, refresh: load, signedOut, accountDeleted })}
    </main>
  );
}
