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
import { MEMBER_CARD_CLASSES } from "@/components/member/ui/card-classes";
import {
  CARD_TITLE,
  SECTION_TITLE,
} from "@/components/member/ui/heading-classes";
import { cn } from "@/components/ui/class-names";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { CheckIcon, ChevronLeftIcon } from "@/components/ui/icons";
import { Link } from "@/i18n/navigation";
import { memberPageHref } from "@/lib/member-paths";
import { previewLabelsOf } from "./creator-preview-labels";
import {
  previewCardOf,
  type PreviewCard,
  type PreviewLabels,
  type PreviewNetwork,
  type PreviewRow,
  type PreviewTab,
} from "./creator-preview-view";
import { useCreatorPreview } from "./use-creator-preview";

const TABS: readonly PreviewTab[] = ["before", "after"];
const TABLIST_CLASSES = "flex flex-wrap items-center gap-2";
const VISUAL_CLASSES =
  "max-h-(--size-portfolio-visual) w-auto max-w-full self-start rounded-md border-(length:--border-width-thin) border-border-default bg-surface-page object-contain";
const ROW_LIST_CLASSES = "flex flex-col gap-2 text-md";
const LABEL_CLASSES = "text-sm text-text-secondary";
const VALUE_CLASSES = "text-md text-text-primary";
/** Between a name and what qualifies it, on one line. */
const SEPARATOR = " · ";
const BLOCK_TITLE_CLASSES = cn(CARD_TITLE, "text-text-primary");

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
        <p className="text-sm text-text-secondary">
          {t(tab === "before" ? "preview.beforeIntro" : "preview.afterIntro")}
        </p>
        <PreviewCardView card={card} images={images} />
      </div>
    </div>
  );
}

function Rows({ rows }: { rows: readonly PreviewRow[] }) {
  return (
    <dl className={ROW_LIST_CLASSES}>
      {rows.map((row, index) => (
        <div key={`${row.field}-${index}`} data-field={row.field}>
          <dt className={LABEL_CLASSES}>{row.label}</dt>
          <dd className={VALUE_CLASSES}>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className={BLOCK_TITLE_CLASSES}>{title}</h3>
      {children}
    </section>
  );
}

function Visual({
  image,
  caption,
}: {
  image: PortfolioImageResponse | undefined;
  caption: string | null;
}) {
  const t = useTranslations("creatorProfile.portfolio");
  return (
    <figure className="m-0 flex min-w-0 flex-col gap-2">
      {image === undefined ? (
        <p className="text-sm text-text-secondary">{t("imageLoading")}</p>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- a data: source built by the API
        <img
          src={`data:${image.contentType};base64,${image.data}`}
          alt=""
          width={image.width}
          height={image.height}
          className={VISUAL_CLASSES}
        />
      )}
      {caption === null ? null : (
        <figcaption className="text-sm text-text-secondary">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

function NetworkLine({ network }: { network: PreviewNetwork }) {
  const t = useTranslations("creatorProfile");
  return (
    <li
      data-network={network.code}
      className="flex flex-col gap-2 rounded-md border-(length:--border-width-thin) border-border-default bg-surface-raised p-4"
    >
      <p className="text-md text-text-primary">
        <span className="font-display font-bold">{network.name}</span>
        {network.primary ? (
          <span className="text-sm text-text-secondary">
            {SEPARATOR}
            {t("networks.primary.label")}
          </span>
        ) : null}
      </p>
      {network.badges.map((badge) => (
        <p
          key={badge.level}
          data-badge={badge.level}
          className="flex items-center gap-2 text-sm text-text-primary"
        >
          <CheckIcon
            aria-hidden="true"
            className="size-(--size-icon-sm) shrink-0"
          />
          {badge.text}
        </p>
      ))}
      <dl className={ROW_LIST_CLASSES}>
        {network.metrics.map((metric) => (
          <div key={metric.field} data-field={metric.field}>
            <dt className={LABEL_CLASSES}>{metric.label}</dt>
            <dd className={VALUE_CLASSES}>
              {metric.value}
              {metric.exact === null ? null : (
                <span className="text-sm text-text-secondary">
                  {SEPARATOR}
                  {metric.exact}
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
      <Rows rows={network.identity} />
      <p className="text-xs text-text-secondary">{network.figures}</p>
      {network.observedNote === null ? null : (
        <p data-observed="" className="text-sm text-text-secondary">
          {network.observedNote}
        </p>
      )}
    </li>
  );
}

/** One card: the visuals first, then the title, the badges and the figures, as the platform serves them (17 §7.1). */
function PreviewCardView({
  card,
  images,
}: {
  card: PreviewCard;
  images: Readonly<Record<string, PortfolioImageResponse>>;
}) {
  const t = useTranslations("creatorProfile");
  const titleId = useId();
  return (
    <article
      aria-labelledby={titleId}
      data-preview-card=""
      className={MEMBER_CARD_CLASSES}
    >
      {card.visuals.length === 0 ? (
        <p data-preview-no-visual="" className="text-sm text-text-secondary">
          {t("preview.noVisual")}
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-wrap gap-3 p-0">
          {card.visuals.map((visual) => (
            <li key={visual.id} data-visual={visual.position}>
              <Visual image={images[visual.id]} caption={visual.caption} />
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-col gap-1">
        <h2 id={titleId} className={cn(SECTION_TITLE, "text-text-primary")}>
          {t("alias.name", { alias: card.alias })}
        </h2>
        {card.headline === null ? null : (
          <p data-field="headline" className={VALUE_CLASSES}>
            {card.headline}
          </p>
        )}
      </div>
      {card.bio === null ? null : (
        <p data-field="bio" className={VALUE_CLASSES}>
          {card.bio}
        </p>
      )}
      <Rows rows={card.profile} />
      {card.networks.length === 0 ? null : (
        <Block title={t("preview.sections.networks")}>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {card.networks.map((network) => (
              <NetworkLine key={network.code} network={network} />
            ))}
          </ul>
        </Block>
      )}
      {card.audience.length === 0 && card.shares.length === 0 ? null : (
        <Block title={t("preview.sections.audience")}>
          <Rows rows={card.audience} />
          {card.shares.length === 0 ? null : (
            <>
              <p className={LABEL_CLASSES}>{t("preview.shares")}</p>
              <Rows rows={card.shares} />
            </>
          )}
        </Block>
      )}
      <Block title={t("preview.sections.offer")}>
        <Rows rows={card.offer} />
      </Block>
    </article>
  );
}
