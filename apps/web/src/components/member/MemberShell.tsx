"use client";

// The shell of the member spaces (docs/mvp/17 §2.2, §2.3, §2.5; 02 §21.5; 20 §11.8), mounted once by
// (member)/(space)/layout.tsx: it stays in place across the pages of a space, the column is no
// longer rebuilt at each navigation. It reads the session (GET /v1/me) when it mounts AND at each
// change of path, without emptying the screen, so that the blocking terms screen (05 RG28) and a
// session closed elsewhere are seen at the next click; the pages receive the account through
// useMember() and never read it themselves (G9). The rules (page of a path, space required, entries,
// active entry, pages exempted from the terms) are pure functions of member-paths.ts and
// member-nav.ts; this file draws them.
// One <nav> "Navigation principale", rendered once and restyled by CSS: a bar fixed at the bottom
// below lg, the list of the side column from lg (02 §21.5 point 3). The standalone pages (terms to
// accept, signed out, account deleted) show no navigation at all (20 §11.8).
import type { MeResponse } from "@influx/contracts/account";
import { useLocale, useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { TermsGate } from "@/components/account/TermsGate";
import { AccountStateBlock } from "@/components/brand-profile/AccountStateBlock";
import {
  useBrandSummary,
  type BrandSummary,
} from "@/components/brand-profile/use-brand-summary";
import {
  HEADER_CLASSES as SCREEN_HEADER_CLASSES,
  HELP_CLASSES,
  INFO_CLASSES,
  LANGUAGE_LINK_CLASSES,
  SCREEN_CLASSES,
  SECONDARY_BUTTON_CLASSES,
  SPACE_SCREEN_CLASSES,
  TEXT_LINK_CLASSES,
  TITLE_CLASSES,
} from "@/components/auth/auth-classes";
import { readMe, signOut as closeSession } from "@/components/auth/member-auth";
import type { RelayResult } from "@influx/web-platform/relay-client";
import { cn } from "@/components/ui/class-names";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { LogOutIcon } from "@/components/ui/icons";
import type { Messages } from "@/i18n/messages";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { activePlaceOf, navItemsOf, subEntriesOf } from "@/lib/member-nav";
import {
  homePageOf,
  isTermsExempt,
  memberPageHref,
  memberPageOfPath,
  spaceRedirectOf,
  type AccountSubPage,
  type MemberPage,
} from "@/lib/member-paths";
import { installErrorCollector } from "@influx/web-platform/error-collector";
import { MemberContext, type MemberContextValue } from "./member-context";
import { MemberNav, type MemberNavEntry } from "./MemberNav";
import {
  BRAND_LINK_CLASSES,
  COLUMN_CLASSES,
  FOOTER_CLASSES,
  HEADER_CLASSES,
  HEADER_ONLY_CLASSES,
  IDENTITY_CLASSES,
  MAIN_CLASSES,
  NAV_ICON_CLASSES,
  NAV_PLACEHOLDER_CLASSES,
  NAV_PLACEHOLDER_LIST_CLASSES,
  SHELL_CLASSES,
  SKIP_LINK_CLASSES,
  SPACE_NAME_CLASSES,
} from "./shell-classes";
import { memberButtonClasses } from "./ui/button-classes";
import { RoleBadge } from "./ui/RoleBadge";

type State =
  | { kind: "loading" }
  | { kind: "ready"; me: MeResponse }
  | { kind: "unavailable" }
  | { kind: "signedOut"; message: string | null }
  | { kind: "deleted" };

/** The labels of member.json: only the entries whose screen exists have one (TD2.2, TD2.3). */
type EntryWithLabel = keyof Messages["member"]["shell"]["nav"]["entries"];

export function MemberShell({ children }: { children: ReactNode }) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const page = memberPageOfPath(pathname, locale);
  const [state, setState] = useState<State>({ kind: "loading" });
  // Signed out or deleted: the page ends there, no later read brings the space back.
  const ended = useRef(false);

  // The state of a brand's profile, for the column and the home (17 §2.3, §2.4): read with the
  // session, at each page; the profile screen tells it every save.
  const brandProfile = useBrandSummary(
    state.kind === "ready" && state.me.role === "advertiser",
    pathname,
  );

  // Browser errors of the connected space (D60, 02 §20.5); never on the landing.
  useEffect(() => installErrorCollector(), []);

  /** What a read of the session leads to: sign-in, the member's own space, unreadable, or ready. */
  const settle = useCallback(
    (result: RelayResult<MeResponse>) => {
      if (ended.current) {
        return;
      }
      if (result.kind === "unauthenticated") {
        // 17 §2.3, "Session expirée": back to the sign-in page.
        router.replace(memberPageHref("signIn", locale));
        return;
      }
      if (result.kind !== "ok") {
        setState({ kind: "unavailable" });
        return;
      }
      // 17 §2.5, 05 RG66: the space follows the real role, never the address.
      const redirect =
        page === null ? null : spaceRedirectOf(page, result.data.role);
      if (redirect !== null) {
        router.replace(memberPageHref(redirect, locale));
        return;
      }
      setState({ kind: "ready", me: result.data });
    },
    [page, router, locale],
  );

  // At the mount and at each change of page or language: the session and the terms read again.
  // A read overtaken by the next navigation is dropped.
  useEffect(() => {
    let current = true;
    void readMe().then((result) => {
      if (current) {
        settle(result);
      }
    });
    return () => {
      current = false;
    };
  }, [settle]);

  /** Reads the account again (a page changed it, the terms were accepted, "Réessayer"). */
  const load = useCallback(async () => {
    settle(await readMe());
  }, [settle]);

  const signedOut = useCallback((message: string | null) => {
    ended.current = true;
    setState({ kind: "signedOut", message });
  }, []);

  const accountDeleted = useCallback(() => {
    ended.current = true;
    setState({ kind: "deleted" });
  }, []);

  const signOut = useCallback(async () => {
    // The cookie is cleared by apps/api even when the session is already unknown.
    const result = await closeSession();
    if (result.kind === "failed") {
      setState({ kind: "unavailable" });
      return;
    }
    signedOut(null);
  }, [signedOut]);

  // 17 §2.2: after a navigation, the focus goes to the h1 of the new page. Not at the first load,
  // where the first Tab must reach the skip link (18 TD5.3).
  const mainRef = useRef<HTMLElement>(null);
  const shownPath = useRef(pathname);
  useEffect(() => {
    if (shownPath.current === pathname) {
      return;
    }
    shownPath.current = pathname;
    const title = mainRef.current?.querySelector("h1");
    if (title instanceof HTMLElement) {
      if (!title.hasAttribute("tabindex")) {
        title.tabIndex = -1;
      }
      title.focus();
    }
  }, [pathname]);

  if (state.kind === "signedOut") {
    return <SignedOutPage message={state.message} />;
  }
  if (state.kind === "deleted") {
    return <DeletedPage />;
  }
  if (
    state.kind === "ready" &&
    state.me.termsToAccept !== null &&
    (page === null || !isTermsExempt(page))
  ) {
    // 05 RG28, 17 §6.7: the blocking screen, before any page, without navigation.
    return (
      <TermsGate
        termsToAccept={state.me.termsToAccept}
        onAccepted={load}
        onRefused={signedOut}
      />
    );
  }

  return (
    <Frame
      me={state.kind === "ready" ? state.me : null}
      page={page}
      onSignOut={signOut}
      mainRef={mainRef}
      busy={state.kind === "loading"}
      brandProfile={brandProfile}
    >
      {state.kind === "ready" ? (
        <SpaceContext
          me={state.me}
          refresh={load}
          signOut={signOut}
          signedOut={signedOut}
          accountDeleted={accountDeleted}
          brandProfile={brandProfile}
        >
          {children}
        </SpaceContext>
      ) : state.kind === "unavailable" ? (
        <Unavailable
          onRetry={() => {
            setState({ kind: "loading" });
            void load();
          }}
        />
      ) : (
        <Loading />
      )}
    </Frame>
  );
}

/** The session handed to the pages (useMember()), once read and the terms settled. */
function SpaceContext({
  children,
  ...member
}: MemberContextValue & { children: ReactNode }) {
  const { me, refresh, signOut, signedOut, accountDeleted, brandProfile } =
    member;
  const value = useMemo(
    () => ({ me, refresh, signOut, signedOut, accountDeleted, brandProfile }),
    [me, refresh, signOut, signedOut, accountDeleted, brandProfile],
  );
  return <MemberContext value={value}>{children}</MemberContext>;
}

/**
 * The frame of the space: skip link, header (head of the column from lg), the main navigation once
 * the account is known, the foot of the column, then <main>. `me` null: loading or unreadable, the
 * frame stands without navigation (17 §2.3, states of the template).
 */
function Frame({
  me,
  page,
  onSignOut,
  mainRef,
  busy,
  brandProfile,
  children,
}: {
  me: MeResponse | null;
  page: MemberPage | null;
  onSignOut: () => Promise<void>;
  mainRef: RefObject<HTMLElement | null>;
  busy: boolean;
  brandProfile: BrandSummary;
  children: ReactNode;
}) {
  const t = useTranslations("member.shell");
  const tAuth = useTranslations("auth");
  const tAccount = useTranslations("account");
  const locale = useLocale();
  const [signingOut, setSigningOut] = useState(false);

  // "Compte" is the one rubric with sub-entries today: their labels are those of its pages.
  const entries: MemberNavEntry[] =
    me === null
      ? []
      : navItemsOf(me.role).map((item) => ({
          entry: item.entry,
          href: memberPageHref(item.page, locale),
          label: t(`nav.entries.${item.entry as EntryWithLabel}`),
          subEntries: subEntriesOf(item.entry, me.role).map((sub) => ({
            page: sub,
            href: memberPageHref(sub, locale),
            label: tAccount(`nav.${sub as AccountSubPage}`),
          })),
        }));

  async function leave() {
    if (signingOut) {
      return;
    }
    setSigningOut(true);
    try {
      await onSignOut();
    } finally {
      setSigningOut(false);
    }
  }

  const language = (className: string) => (
    <LanguageLinks page={page} className={className} />
  );

  return (
    <div className={SHELL_CLASSES}>
      <a href="#main" className={SKIP_LINK_CLASSES}>
        {t("skipToContent")}
      </a>
      <div className={COLUMN_CLASSES}>
        <header className={HEADER_CLASSES}>
          {me === null ? (
            <Link href="/" className={BRAND_LINK_CLASSES}>
              {tAuth("brand")}
            </Link>
          ) : (
            <Link
              href={memberPageHref(homePageOf(me.role), locale)}
              className={BRAND_LINK_CLASSES}
            >
              {tAuth("brand")}
            </Link>
          )}
          {me === null ? null : (
            <RoleBadge
              role={me.role}
              label={t(`space.${me.role}`)}
              className={SPACE_NAME_CLASSES}
            />
          )}
          {language(HEADER_ONLY_CLASSES)}
        </header>
        {me === null ? (
          <div aria-hidden="true" className={NAV_PLACEHOLDER_CLASSES}>
            <div className={NAV_PLACEHOLDER_LIST_CLASSES} />
          </div>
        ) : (
          <MemberNav
            label={t("nav.label")}
            entries={entries}
            place={activePlaceOf(page)}
            LinkComponent={Link}
          />
        )}
        {me === null ? null : <AccountStateBlock state={brandProfile.state} />}
        {me === null ? null : (
          <div className={FOOTER_CLASSES}>
            {language("")}
            <p className={IDENTITY_CLASSES}>
              {tAuth("home.signedInAs", { email: me.email })}
            </p>
            <button
              type="button"
              onClick={() => void leave()}
              aria-disabled={signingOut || undefined}
              className={cn(memberButtonClasses("secondary", "md"), "w-full")}
            >
              <LogOutIcon aria-hidden="true" className={NAV_ICON_CLASSES} />
              {signingOut ? tAuth("logout.busy") : t("footer.signOut")}
            </button>
          </div>
        )}
      </div>
      <main
        id="main"
        ref={mainRef}
        tabIndex={-1}
        data-member-main=""
        aria-busy={busy || undefined}
        className={MAIN_CLASSES}
      >
        {children}
      </main>
    </div>
  );
}

/**
 * The page in the other language (the selector of the journey, 17 §3.1): a link, not a landmark,
 * so that the space keeps a single <nav> (18 TD5.1). Drawn in the header below lg and in the foot
 * of the column from lg; the CSS shows one of the two.
 */
function LanguageLinks({
  page,
  className,
}: {
  page: MemberPage | null;
  className: string;
}) {
  const t = useTranslations("auth");
  const locale = useLocale();
  if (page === null) {
    return null;
  }
  return routing.locales
    .filter((other) => other !== locale)
    .map((other) => (
      <Link
        key={other}
        href={memberPageHref(page, other)}
        locale={other}
        lang={other}
        hrefLang={other}
        className={cn(LANGUAGE_LINK_CLASSES, className)}
      >
        {t(`language.${other}`)}
      </Link>
    ));
}

function Loading() {
  const t = useTranslations("auth");
  return (
    <div className={SPACE_SCREEN_CLASSES}>
      <p role="status" className={HELP_CLASSES}>
        {t("home.loading")}
      </p>
    </div>
  );
}

/** 17 §2.3, "Session illisible": the frame without navigation, the notice, "Réessayer". */
function Unavailable({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("account");
  return (
    <div className={SPACE_SCREEN_CLASSES}>
      <ErrorNotice>{t("unavailable")}</ErrorNotice>
      <button
        type="button"
        onClick={onRetry}
        className={SECONDARY_BUTTON_CLASSES}
      >
        {t("retry")}
      </button>
    </div>
  );
}

/** A standalone page (20 §11.8): INFLUX, one column, no navigation; its title takes the focus. */
function StandalonePage({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const t = useTranslations("auth");
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    titleRef.current?.focus();
  }, []);
  return (
    <main id="main" className={SCREEN_CLASSES}>
      <header className={SCREEN_HEADER_CLASSES}>
        <Link href="/" className={BRAND_LINK_CLASSES}>
          {t("brand")}
        </Link>
      </header>
      <h1 ref={titleRef} tabIndex={-1} className={TITLE_CLASSES}>
        {title}
      </h1>
      {children}
    </main>
  );
}

function SignedOutPage({ message }: { message: string | null }) {
  const t = useTranslations("account.signedOut");
  const locale = useLocale();
  return (
    <StandalonePage title={t("title")}>
      {message === null ? null : (
        <p role="status" className={INFO_CLASSES}>
          {message}
        </p>
      )}
      <Link
        href={memberPageHref("signIn", locale)}
        className={TEXT_LINK_CLASSES}
      >
        {t("signInAgain")}
      </Link>
    </StandalonePage>
  );
}

/** D72: the account is gone, the session with it; the page offers the landing, nothing else. */
function DeletedPage() {
  const t = useTranslations("account.data.deleted");
  return (
    <StandalonePage title={t("title")}>
      <p role="status" className={INFO_CLASSES}>
        {t("text")}
      </p>
      <Link href="/" className={TEXT_LINK_CLASSES}>
        {t("home")}
      </Link>
    </StandalonePage>
  );
}
