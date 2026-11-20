"use client";

// The card of a creator as the platform serves it to a brand (docs/mvp/07 RG16, RG84, RG102, RG104; 10 RG48,
// RG50; 17 §5.2, §7.1; jalons/l2g commit 14, jalons/l3f commit 10): ONE drawing for the preview of the creator
// ("ce que voit une marque"), the grid of the brand's search, its profile and its shortlists. It draws a
// `PreviewCard` (creator-preview-view.ts, built from the layer A of the projection and from nothing else): the
// visuals first, then the alias, the title, the networks with their dated figures, the audience in bands, the
// offer. The visuals are decorative (`alt=""`), their caption sits beside them; a card without a visual shows no
// image. `footer`: what a screen adds under the card's own blocks (the reasons, the note of vigilance, the actions
// of the search); the card itself holds no action and no amount, rate, net or price (D48, D78, RG103).
import type { PortfolioImageResponse } from "@influx/contracts/creator-portfolio";
import { useTranslations } from "next-intl";
import { useId, type ReactNode } from "react";
import { LayerBadge } from "@/components/member/ui/LayerBadge";
import { MEMBER_CARD_CLASSES } from "@/components/member/ui/card-classes";
import {
  CARD_TITLE,
  SECTION_TITLE,
} from "@/components/member/ui/heading-classes";
import { cn } from "@/components/ui/class-names";
import { CheckIcon } from "@/components/ui/icons";
import type {
  PreviewCard,
  PreviewNetwork,
  PreviewRow,
} from "./creator-preview-view";

const VISUAL_CLASSES =
  "max-h-(--size-portfolio-visual) w-auto max-w-full self-start rounded-md border-(length:--border-width-thin) border-border-default bg-surface-page object-contain";
const ROW_LIST_CLASSES = "flex flex-col gap-2 text-md";
const LABEL_CLASSES = "text-sm text-text-secondary";
const VALUE_CLASSES = "text-md text-text-primary";
/** Between a name and what qualifies it, on one line. */
const SEPARATOR = " · ";
const BLOCK_TITLE_CLASSES = cn(CARD_TITLE, "text-text-primary");
/** A value and the badge that says an introduction reveals it, wrapping under it when space is short. */
const REVEALED_VALUE_CLASSES = "flex flex-wrap items-center gap-x-2 gap-y-1";

/**
 * What an introduction reveals, marked as such in the "after" tab (L2G recette): the same badge as the
 * fields of the profile form (`layer.revealed`, an icon and a text, never the green alone, RG85).
 */
function RevealedBadge() {
  const t = useTranslations("creatorProfile");
  return <LayerBadge layer="revealed" label={t("layer.revealed")} />;
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
            <dd
              className={cn(
                VALUE_CLASSES,
                metric.revealed && REVEALED_VALUE_CLASSES,
              )}
            >
              <span>
                {metric.value}
                {metric.exact === null ? null : (
                  <span className="text-sm text-text-secondary">
                    {SEPARATOR}
                    {metric.exact}
                  </span>
                )}
              </span>
              {metric.revealed ? <RevealedBadge /> : null}
            </dd>
          </div>
        ))}
      </dl>
      {network.identity.length === 0 ? null : (
        <div data-revealed="identity" className="flex flex-col gap-2">
          <RevealedBadge />
          <Rows rows={network.identity} />
        </div>
      )}
      <p className="text-xs text-text-secondary">{network.figures}</p>
      {network.observedNote === null ? null : (
        <p data-observed="" className="text-sm text-text-secondary">
          {network.observedNote}
        </p>
      )}
    </li>
  );
}

/**
 * One card: the visuals first, then the title, the badges and the figures, as the platform serves them (17 §7.1).
 * `noVisualText`: what a card without an approved visual says (RG84), null for nothing: the card then simply
 * shows no image.
 */
export function CreatorCardView({
  card,
  images,
  noVisualText,
  footer,
}: {
  card: PreviewCard;
  images: Readonly<Record<string, PortfolioImageResponse>>;
  noVisualText: string | null;
  footer?: ReactNode;
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
        noVisualText === null ? null : (
          <p data-preview-no-visual="" className="text-sm text-text-secondary">
            {noVisualText}
          </p>
        )
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
              <div data-revealed="shares" className={REVEALED_VALUE_CLASSES}>
                <p className={LABEL_CLASSES}>{t("preview.shares")}</p>
                <RevealedBadge />
              </div>
              <Rows rows={card.shares} />
            </>
          )}
        </Block>
      )}
      <Block title={t("preview.sections.offer")}>
        <Rows rows={card.offer} />
      </Block>
      {footer}
    </article>
  );
}
