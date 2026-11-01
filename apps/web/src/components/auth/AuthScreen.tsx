"use client";

// The frame of every screen of the journey (docs/mvp/17 §3.1 to §3.6): one centred column, the
// brand and the language of the page, the offline banner, and the h1 that takes the focus when
// the step changes, with the step announced in it ("Step 2 of 3").
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { Notice } from "@/components/member/ui/Notice";
import { PageHeader } from "@/components/member/ui/PageHeader";
import { cn } from "@/components/ui/class-names";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { memberPageHref, type MemberPage } from "@/lib/member-paths";
import {
  BRAND_CLASSES,
  HEADER_CLASSES,
  LANGUAGE_LINK_CLASSES,
  PROGRESS_CLASSES,
  SCREEN_CLASSES,
} from "./auth-classes";

/** The journey has three screens (05 RG2): address, code, information. */
const STEP_COUNT = 3;

function subscribeToNothing(): () => void {
  return () => undefined;
}

/** The query of the page (UTM parameters, 05 RG120), carried over to the other language. */
function useSearch(): string {
  return useSyncExternalStore(
    subscribeToNothing,
    () => window.location.search,
    () => "",
  );
}

/**
 * `languagePage`: the page to offer in the other language, or none (the notices). The link is a
 * client navigation (next-intl Link): the page of the other language takes the journey over from
 * journey-memory.ts, so that nothing typed is lost (D66; 17 §3.5, RG111, RG130).
 */
export function AuthScreen({
  languagePage,
  online,
  children,
}: {
  languagePage: MemberPage | null;
  online: boolean;
  children: ReactNode;
}) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const search = useSearch();
  const otherLocales = routing.locales.filter((other) => other !== locale);

  return (
    <main id="main" className={SCREEN_CLASSES}>
      <div className={HEADER_CLASSES}>
        <Link href="/" className={BRAND_CLASSES}>
          {t("brand")}
        </Link>
        {languagePage === null ? null : (
          <nav aria-label={t("language.label")}>
            {otherLocales.map((other) => (
              <Link
                key={other}
                href={`${memberPageHref(languagePage, other)}${search}`}
                locale={other}
                lang={other}
                hrefLang={other}
                className={LANGUAGE_LINK_CLASSES}
              >
                {t(`language.${other}`)}
              </Link>
            ))}
          </nav>
        )}
      </div>
      {online ? null : <Notice tone="warning">{t("offline")}</Notice>}
      {children}
    </main>
  );
}

/** The h1 of a step: focused when it appears (17 §3.6), the step number read with it. */
export function StepTitle({
  step,
  children,
}: {
  step: number | null;
  children: ReactNode;
}) {
  const t = useTranslations("auth");
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  return (
    <PageHeader
      titleRef={titleRef}
      title={
        <>
          {step === null ? null : (
            <span className={cn("block", PROGRESS_CLASSES)}>
              {t("progress", { current: step, total: STEP_COUNT })}
            </span>
          )}
          {children}
        </>
      }
    />
  );
}

/** The mark of a required field, explained by `signup.requiredLegend`; hidden from screen readers,
 * which hear `required` on the control itself. */
export function RequiredMark() {
  const t = useTranslations("auth");
  return <span aria-hidden="true">{t("requiredMark")}</span>;
}
