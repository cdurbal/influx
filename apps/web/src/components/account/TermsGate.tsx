"use client";

// The blocking re-acceptance of the terms of service (docs/mvp/17 §6.7; 05 RG28, CA70): shown
// before any page of the space while a version in force waits for acceptance. It shows EXACTLY the
// version whose `id` the acceptance sends (RG24), in the language served (RG25). Refusing signs
// out WITHOUT deleting the account; the rights of the person stay reachable from here (J7 A3:
// "mes préférences", "mes données"), and the privacy policy says how to write to INFLUX.
import type { TermsToAccept } from "@influx/contracts/account";
import type { CurrentTermsResponse } from "@influx/contracts/terms";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  BRAND_CLASSES,
  CARD_CLASSES,
  HEADER_CLASSES,
  HELP_CLASSES,
  INFO_CLASSES,
  LEAD_CLASSES,
  PRIMARY_SUBMIT_CLASSES,
  SCREEN_CLASSES,
  SECONDARY_BUTTON_CLASSES,
  TITLE_CLASSES,
} from "@/components/auth/auth-classes";
import { signOut } from "@/components/auth/member-auth";
import { LegalMarkdown } from "@/components/legal/LegalMarkdown";
import { Link } from "@/i18n/navigation";
import { LEGAL_DOCUMENT_SLUGS } from "@/lib/legal-documents";
import { parseLegalMarkdown } from "@/lib/legal-markdown";
import { memberPageHref } from "@/lib/member-paths";
import {
  INLINE_LINK_CLASSES,
  LIST_CLASSES,
  SECTION_TITLE_CLASSES,
} from "./account-classes";
import { acceptTerms, readTermsToAccept } from "./account-api";
import { formatDate } from "./account-view";
import { ErrorNotice } from "@/components/ui/ErrorNotice";

type Text =
  | { kind: "loading" }
  | { kind: "ready"; terms: CurrentTermsResponse }
  | { kind: "unavailable" };

type Message = "newerVersion" | "acceptUnavailable" | null;

export function TermsGate({
  termsToAccept,
  onAccepted,
  onRefused,
}: {
  termsToAccept: TermsToAccept;
  /** Reads the account again: the gate goes once nothing is left to accept. */
  onAccepted: () => Promise<void>;
  onRefused: (message: string) => void;
}) {
  const t = useTranslations("account");
  const locale = useLocale();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const rightsTitleId = useId();
  const [text, setText] = useState<Text>({ kind: "loading" });
  const [message, setMessage] = useState<Message>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void readTermsToAccept(termsToAccept.locale).then((result) => {
      if (active) {
        setText(
          result.kind === "ok"
            ? { kind: "ready", terms: result.data }
            : { kind: "unavailable" },
        );
      }
    });
    return () => {
      active = false;
    };
  }, [termsToAccept.locale, termsToAccept.versionId]);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const blocks = useMemo(
    () => (text.kind === "ready" ? parseLegalMarkdown(text.terms.content) : []),
    [text],
  );

  async function accept(terms: CurrentTermsResponse) {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      const result = await acceptTerms(terms.id);
      if (result.kind === "ok") {
        await onAccepted();
        return;
      }
      if (result.kind === "unauthenticated") {
        await onAccepted(); // the frame sends the member to the sign-in page
        return;
      }
      if (result.code === "conflict") {
        // Another version came into force meanwhile: the account is read again, then its text.
        setMessage("newerVersion");
        await onAccepted();
        return;
      }
      setMessage("acceptUnavailable");
    } finally {
      setBusy(false);
    }
  }

  async function refuse() {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      // 05 RG28: refusing is signing out; the account and its data stay.
      await signOut();
      onRefused(t("terms.refused"));
    } finally {
      setBusy(false);
    }
  }

  const privacyHref = `/${LEGAL_DOCUMENT_SLUGS.privacy_policy[locale]}`;

  return (
    <main id="main" className={SCREEN_CLASSES}>
      <header className={HEADER_CLASSES}>
        <Link href="/" className={BRAND_CLASSES}>
          {t("brand")}
        </Link>
      </header>
      <h1 ref={titleRef} tabIndex={-1} className={TITLE_CLASSES}>
        {t("terms.title")}
      </h1>
      <p className={LEAD_CLASSES}>
        {t("terms.lead", {
          label: termsToAccept.versionLabel,
          date: formatDate(termsToAccept.effectiveFrom, locale),
        })}
      </p>
      {message === "newerVersion" ? (
        <p role="status" className={INFO_CLASSES}>
          {t("terms.newerVersion")}
        </p>
      ) : null}
      {text.kind === "loading" ? (
        <p role="status" className={HELP_CLASSES}>
          {t("terms.loading")}
        </p>
      ) : null}
      {text.kind === "unavailable" ? (
        <ErrorNotice>{t("terms.unavailable")}</ErrorNotice>
      ) : null}
      {text.kind === "ready" ? (
        <section
          aria-label={t("terms.documentLabel", {
            label: text.terms.versionLabel,
          })}
          className={CARD_CLASSES}
        >
          {text.terms.isFallback ? (
            <p role="note" className={INFO_CLASSES}>
              {t("terms.fallback")}
            </p>
          ) : null}
          <article lang={text.terms.locale}>
            <LegalMarkdown blocks={blocks} variant="keo" />
          </article>
        </section>
      ) : null}
      <div className={CARD_CLASSES}>
        {message === "acceptUnavailable" ? (
          <ErrorNotice>{t("terms.acceptUnavailable")}</ErrorNotice>
        ) : null}
        {text.kind === "ready" ? (
          <button
            type="button"
            onClick={() => void accept(text.terms)}
            aria-disabled={busy || undefined}
            className={PRIMARY_SUBMIT_CLASSES}
          >
            {busy ? t("terms.accepting") : t("terms.accept")}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => void refuse()}
          aria-disabled={busy || undefined}
          className={SECONDARY_BUTTON_CLASSES}
        >
          {t("terms.refuse")}
        </button>
        <p className={HELP_CLASSES}>{t("terms.refuseHelp")}</p>
      </div>
      <section className={CARD_CLASSES} aria-labelledby={rightsTitleId}>
        <h2 id={rightsTitleId} className={SECTION_TITLE_CLASSES}>
          {t("terms.rightsTitle")}
        </h2>
        <p className={HELP_CLASSES}>{t("terms.rightsText")}</p>
        <ul className={LIST_CLASSES}>
          <li>
            <Link
              href={memberPageHref("accountPreferences", locale)}
              className={INLINE_LINK_CLASSES}
            >
              {t("terms.rightsPreferences")}
            </Link>
          </li>
          <li>
            <Link
              href={memberPageHref("accountData", locale)}
              className={INLINE_LINK_CLASSES}
            >
              {t("terms.rightsData")}
            </Link>
          </li>
        </ul>
        <p className={HELP_CLASSES}>
          {t("terms.contact")}{" "}
          <Link href={privacyHref} className={INLINE_LINK_CLASSES}>
            {t("terms.contactLink")}
          </Link>
        </p>
      </section>
    </main>
  );
}
