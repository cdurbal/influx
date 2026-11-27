import { useId, type ReactNode } from "react";
import { cn } from "@/components/ui/class-names";
import { ClockIcon, TriangleAlertIcon } from "@/components/ui/icons";
import {
  FEED_CARD_BRAND_CLASSES,
  FEED_CARD_CLASSES,
  FEED_CARD_CLOSED_CLASSES,
  FEED_CARD_DUE_ICON_CLASSES,
  FEED_CARD_LINK_CLASSES,
  FEED_CARD_META_CLASSES,
  FEED_CARD_TITLE_CLASSES,
  feedCardDueClasses,
} from "./feed-card-classes";
import { LogoPlate } from "./LogoPlate";
import { StatusBadge } from "./StatusBadge";
import { VerifiedBadge } from "./VerifiedBadge";

export type FeedCardProps = {
  /** The page of the campaign: the one link of the card, its title. */
  href: string;
  /** The name of the brand. */
  brand: string;
  /** The logo of the brand, a URL or a `data:` source; absent, its initials on the plate. */
  logo?: string;
  /** The dated badge of the brand, whole (« Vérifié · Instagram · 12 novembre 2026 »): never a tick alone (D88). */
  verified?: { label: string; network: string; date: string };
  title: string;
  /** The deadline of the applications as a delay, already written (« Candidatures : plus que 2 jours »). */
  due: { label: string; soon?: boolean };
  /** The lines of meta: the deliverables, the countries and the topics. Never an amount (D78). */
  meta: readonly ReactNode[];
  /** The applications are closed: the card says so in these words and opens nothing (02c, « close »). */
  closed?: string;
  className?: string;
};

/**
 * The card of the feed of campaigns (C48): the brand, the title as the one link of the card, the deadline, the meta.
 * No button and no amount (D78): the card opens the campaign, the rest is negotiated with the agent. A closed card
 * writes its state and links nowhere. It reads no address and no session.
 */
export function FeedCard({
  href,
  brand,
  logo,
  verified,
  title,
  due,
  meta,
  closed,
  className,
}: FeedCardProps) {
  const titleId = useId();
  const DueIcon = due.soon === true ? TriangleAlertIcon : ClockIcon;
  return (
    <article
      aria-labelledby={titleId}
      data-feed-card=""
      data-closed={closed === undefined ? undefined : ""}
      className={cn(
        closed === undefined ? FEED_CARD_CLASSES : FEED_CARD_CLOSED_CLASSES,
        className,
      )}
    >
      <div className={FEED_CARD_BRAND_CLASSES}>
        {/* The plate stands for the name written beside it: hidden, so that the brand is read once. */}
        <span aria-hidden="true">
          <LogoPlate src={logo} name={brand} size={32} shape="plate" />
        </span>
        <span className="min-w-0">{brand}</span>
      </div>
      {verified === undefined ? null : (
        <VerifiedBadge
          label={verified.label}
          network={verified.network}
          date={verified.date}
          className="self-start"
        />
      )}
      <p id={titleId} className={FEED_CARD_TITLE_CLASSES}>
        {closed === undefined ? (
          <a href={href} className={FEED_CARD_LINK_CLASSES}>
            {title}
          </a>
        ) : (
          title
        )}
      </p>
      {closed === undefined ? (
        <p
          data-feed-due={due.soon === true ? "soon" : ""}
          className={feedCardDueClasses(due.soon === true)}
        >
          <DueIcon aria-hidden="true" className={FEED_CARD_DUE_ICON_CLASSES} />
          {due.label}
        </p>
      ) : (
        <StatusBadge tone="neutral" className="self-start">
          {closed}
        </StatusBadge>
      )}
      {meta.map((line, index) => (
        <p key={index} className={FEED_CARD_META_CLASSES}>
          {line}
        </p>
      ))}
    </article>
  );
}
