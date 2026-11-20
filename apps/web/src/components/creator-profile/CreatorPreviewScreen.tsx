"use client";

// "Ce que voit une marque" (docs/mvp/07 RG16, RG84, RG102, RG104; 17 §5.2, §7.1; jalons/l2g, commit 14):
// the creator reads his own card as the platform serves it, in two tabs, before and after an
// introduction. The screen draws the answer of `GET /v1/me/creator-profile/preview` and nothing else: no
// recomputation, no addition (RG104); the rows are creator-preview-view.ts, the words
// creator-preview-labels.ts, the state use-creator-preview.ts. The card has no image when no visual is
// approved (RG84); the visuals are decorative (`alt=""`), their caption sits beside them. The page of a
// creator: any other role finds no such page. No amount, rate, net or price (D48, D78, RG103).
import type { PortfolioImageResponse } from "@influx/contracts/creator-portfolio";
import { notFound } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  BACK_ICON_CLASSES,
  BACK_LINK_CLASSES,
} from "@/components/account/account-classes";
import { PROFILE_PAGE_CLASSES } from "@/components/brand-profile/brand-profile-classes";
import { useOnline } from "@/components/auth/use-online";
import { useMember } from "@/components/member/member-context";
import { MemberButton } from "@/components/member/ui/MemberButton";
import { Notice } from "@/components/member/ui/Notice";
import { PageBackContext, PageHeader } from "@/components/member/ui/PageHeader";
import { memberButtonClasses } from "@/components/member/ui/button-classes";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { CheckIcon, ChevronLeftIcon } from "@/components/ui/icons";
import { Link } from "@/i18n/navigation";
import { memberPageHref } from "@/lib/member-paths";
import { previewLabelsOf } from "./creator-preview-labels";
import { CreatorCardView } from "./CreatorCardView";
import {
  afterEmptyOf,
  previewCardOf,
  type PreviewLabels,
  type PreviewTab,
} from "./creator-preview-view";
import { useCreatorPreview } from "./use-creator-preview";

const TABS: readonly PreviewTab[] = ["before", "after"];
const TABLIST_CLASSES = "flex flex-wrap items-center gap-2";

/** The page of a creator; any other role finds a page that does not exist (18 T14.3, T14.4). */
export function CreatorPreviewScreen() {
  const { me } = useMember();
  if (me.role !== "creator") {
    notFound();
  }
  return <CreatorPreviewView />;
}

function CreatorPreviewView() {
  const t = useTranslations("creatorProfile");
  const tBrand = useTranslations("brandProfile");
  const tAccount = useTranslations("account");
  const locale = useLocale();
  const online = useOnline();
  const { signedOut } = useMember();
  const state = useCreatorPreview({ onSignedOut: () => signedOut(null) });
  const labels = useMemo(
    () => previewLabelsOf(t, tBrand, locale),
    [t, tBrand, locale],
  );
  if (state.phase === "gone") {
    notFound();
  }

  const back = (
    <Link
      href={memberPageHref("accountProfile", locale)}
      className={BACK_LINK_CLASSES}
    >
      <span className="sr-only">{tAccount("hub.backPrefix")} </span>
      <ChevronLeftIcon aria-hidden="true" className={BACK_ICON_CLASSES} />
      {t("preview.back")}
    </Link>
  );

  let body: ReactNode;
  if (state.preview === null) {
    body =
      state.phase === "unavailable" ? (
        <div className="flex flex-col gap-4">
          <ErrorNotice>{t("preview.unavailable")}</ErrorNotice>
          <MemberButton variant="secondary" onClick={state.reload}>
            {t("page.retry")}
          </MemberButton>
        </div>
      ) : (
        <p role="status" className="text-sm text-text-secondary">
          {t("preview.loading")}
        </p>
      );
  } else {
    body = (
      <Tabs
        preview={state.preview}
        images={state.images}
        labels={labels}
        published={state.preview.published}
      />
    );
  }

  return (
    <PageBackContext value={back}>
      <div className={PROFILE_PAGE_CLASSES}>
        {online ? null : <Notice tone="warning">{tAccount("offline")}</Notice>}
        <PageHeader title={t("preview.title")} />
        <p className="text-md text-text-secondary">{t("preview.explain")}</p>
        {body}
      </div>
    </PageBackContext>
  );
}

/** The two tabs, one panel at a time; arrows, Home and End move between them (WAI-ARIA tabs). */
function Tabs({
  preview,
  images,
  labels,
  published,
}: {
  preview: NonNullable<ReturnType<typeof useCreatorPreview>["preview"]>;
  images: Readonly<Record<string, PortfolioImageResponse>>;
  labels: PreviewLabels;
  published: boolean;
}) {
  const t = useTranslations("creatorProfile");
  const [tab, setTab] = useState<PreviewTab>("before");
  const base = useId();
  const refs = useRef<Partial<Record<PreviewTab, HTMLButtonElement | null>>>(
    {},
  );
  const card = useMemo(
    () => previewCardOf(preview, tab, labels),
    [preview, tab, labels],
  );
  const empty = tab === "after" ? afterEmptyOf(card) : null;
  const select = (next: PreviewTab) => {
    setTab(next);
    refs.current[next]?.focus();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = TABS.indexOf(tab);
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      select(TABS[(index + 1) % TABS.length] ?? tab);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      select(TABS[(index + TABS.length - 1) % TABS.length] ?? tab);
    } else if (event.key === "Home") {
      select(TABS[0] ?? tab);
    } else if (event.key === "End") {
      select(TABS[TABS.length - 1] ?? tab);
    } else {
      return;
    }
    event.preventDefault();
  };
  return (
    <div className="flex flex-col gap-4">
      {published ? null : (
        <Notice tone="info">{t("preview.notPublished")}</Notice>
      )}
      <div
        role="tablist"
        aria-label={t("preview.tabs")}
        className={TABLIST_CLASSES}
      >
        {TABS.map((name) => {
          const selected = name === tab;
          return (
            <button
              key={name}
              ref={(node) => {
                refs.current[name] = node;
              }}
              type="button"
              role="tab"
              id={`${base}-tab-${name}`}
              aria-selected={selected}
              aria-controls={`${base}-panel`}
              tabIndex={selected ? 0 : -1}
              data-preview-tab={name}
              onClick={() => setTab(name)}
              onKeyDown={onKeyDown}
              className={memberButtonClasses(
                selected ? "primary" : "secondary",
              )}
            >
              {selected ? (
                <CheckIcon
                  aria-hidden="true"
                  className="size-(--size-icon-sm) shrink-0"
                />
              ) : null}
              {t(`preview.${name}`)}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={`${base}-panel`}
        aria-labelledby={`${base}-tab-${tab}`}
        data-preview-panel={tab}
        className="flex flex-col gap-4"
      >
        {empty === null ? (
          <>
            <p className="text-sm text-text-secondary">
              {t(
                tab === "before" ? "preview.beforeIntro" : "preview.afterIntro",
              )}
            </p>
            <CreatorCardView
              card={card}
              images={images}
              noVisualText={t("preview.noVisual")}
            />
          </>
        ) : (
          // The same card twice would read as a tab that does not work: the screen says why instead.
          <Notice tone="info">
            <span data-preview-after-empty={empty}>
              {t(`preview.afterEmpty.${empty}`)}
            </span>
          </Notice>
        )}
      </div>
    </div>
  );
}
