"use client";

import { useId, useState, type ReactNode } from "react";
import { cn } from "@/components/ui/class-names";
import {
  BadgeCheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  HeartIcon,
} from "@/components/ui/icons";
import {
  PHOTO_ARROW_CLASSES,
  PHOTO_ARROW_ICON_CLASSES,
  PHOTO_ARROW_NEXT_CLASSES,
  PHOTO_ARROW_PREVIOUS_CLASSES,
  PHOTO_CARD_BODY_CLASSES,
  PHOTO_CARD_CLASSES,
  PHOTO_CARD_HEAD_CLASSES,
  PHOTO_CARD_IMAGE_CLASSES,
  PHOTO_CARD_LINK_CLASSES,
  PHOTO_CARD_NOTE_CLASSES,
  PHOTO_CARD_PHOTO_CLASSES,
  PHOTO_CARD_REFUSAL_CLASSES,
  PHOTO_CARD_SLIDE_CLASSES,
  PHOTO_CARD_STILL_CLASSES,
  PHOTO_CARD_TRACK_CLASSES,
  PHOTO_CARD_VERIFIED_CLASSES,
  PHOTO_CARD_VERIFIED_ICON_CLASSES,
  PHOTO_CARD_WHY_CLASSES,
  PHOTO_DOTS_CLASSES,
  photoBadgeClasses,
  photoCardLineClasses,
  photoDotClasses,
  photoHeartClasses,
  photoHeartIconClasses,
  type PhotoBadgeTone,
} from "./photo-card-classes";
import { useSlideInView } from "./use-slide-in-view";
import { passThroughOf, type PassThroughProps } from "./pass-through";

/** One visual: its source (absent while it is missing or not yet signed) and what it shows, never who (02b C31). */
type PhotoCardMedia = { src?: string; alt: string };

type PhotoCardBaseProps = {
  /** The page of the profile: the one link of the card, its alias. */
  href: string;
  /** The visuals, in order: the first one alone in a selection. None: the ground of the photo. */
  media: readonly PhotoCardMedia[];
  /** The badge top left, its words already written: « Audience vérifiée », « Nouveau profil ». */
  badge?: { label: string; tone: PhotoBadgeTone };
  /** The alias (« Profil 93JMS4 »), never a real name before the reveal: the name of the card. */
  name: string;
  /**
   * The verified mark of the card alone (RU-02, D88): the blue icon, its words read by a screen reader only
   * (« Vérifié · Instagram »), and the complete date. Every other place writes the dated badge whole.
   */
  verified?: { label: string; date?: string };
  /** The lines under the alias: the title, the topics and the country, the main network and its range. */
  lines: readonly ReactNode[];
  /** « Proposé car … », on one line; its bold words are its label. Never a score (D11). */
  why?: ReactNode;
  /** The creator is in the active list: the heart is filled. */
  saved?: boolean;
  /** The heart is pressed: the screen adds or removes; nothing is decided here. */
  onToggleSave?: () => void;
  /** The name of the heart, composed by the screen for the state it is in: « Ajouter Profil 93JMS4 à Ma sélection ». */
  saveLabel: string;
  /** A request of the heart runs: it cannot be pressed again (02c, « ajout en cours »). */
  saving?: boolean;
  /** Why the heart was refused (a full list, a creator no longer shown), in words, under the lines (02c, « refusé »). */
  refusal?: string;
  /** The card leaves a selection: it fades out, and the screen removes it once done (02c, « en sortie »; R04 line 22). */
  leaving?: boolean;
  className?: string;
};

type PhotoCardSearchProps = PhotoCardBaseProps & {
  /** A result of the search (2): the visuals in a track with its dots and, on hover, its arrows. */
  variant: "search";
  /** The names of the track and of its arrows: « Visuels du portfolio de Profil 93JMS4 », « Visuel précédent ». */
  carousel: { label: string; previous: string; next: string };
  note?: undefined;
};

type PhotoCardShortlistProps = PhotoCardBaseProps & {
  /** A card of a selection (9): the first visual alone, the heart that removes it, the note under it. */
  variant: "shortlist";
  carousel?: undefined;
  /** The private note of the brand and its action, given whole by the screen. */
  note?: ReactNode;
};

export type PhotoCardProps = PhotoCardSearchProps | PhotoCardShortlistProps;

/** One visual: its picture, or the ground of the photo named by its words while the source is missing. */
function Visual({
  media,
  className,
}: {
  media: PhotoCardMedia;
  className: string;
}) {
  if (media.src === undefined) {
    return <div role="img" aria-label={media.alt} className={className} />;
  }
  return (
    <div className={className}>
      {/* A signed URL of the portfolio or a local picture: next/image has nothing to optimise. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={media.src}
        alt={media.alt}
        className={PHOTO_CARD_IMAGE_CLASSES}
      />
    </div>
  );
}

/**
 * The track of the visuals of a result (R04 lines 11 to 13): a focusable region that scrolls sideways one visual at
 * a time, by a swipe, by the arrows of the keyboard or by the two arrows of the photo; the dots follow the visual in
 * view. The visual in view is told by an observer of the track, never by a width read here.
 */
function Track({
  media,
  carousel,
}: {
  media: readonly PhotoCardMedia[];
  carousel: PhotoCardSearchProps["carousel"];
}) {
  const { track, current, show } = useSlideInView(media.length);

  return (
    <>
      <div
        ref={track}
        role="region"
        aria-label={carousel.label}
        // a region that scrolls is reached by the keyboard (X8; axe scrollable-region-focusable, RU-12)
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        data-photo-track=""
        className={PHOTO_CARD_TRACK_CLASSES}
      >
        {media.map((item, index) => (
          <Visual
            key={`${index}-${item.src ?? ""}`}
            media={item}
            className={PHOTO_CARD_SLIDE_CLASSES}
          />
        ))}
      </div>
      <button
        type="button"
        aria-label={carousel.previous}
        disabled={current === 0}
        data-photo-arrow="previous"
        className={cn(PHOTO_ARROW_CLASSES, PHOTO_ARROW_PREVIOUS_CLASSES)}
        onClick={() => show(current - 1)}
      >
        <ChevronLeftIcon
          aria-hidden="true"
          className={PHOTO_ARROW_ICON_CLASSES}
        />
      </button>
      <button
        type="button"
        aria-label={carousel.next}
        disabled={current === media.length - 1}
        data-photo-arrow="next"
        className={cn(PHOTO_ARROW_CLASSES, PHOTO_ARROW_NEXT_CLASSES)}
        onClick={() => show(current + 1)}
      >
        <ChevronRightIcon
          aria-hidden="true"
          className={PHOTO_ARROW_ICON_CLASSES}
        />
      </button>
      <div aria-hidden="true" data-photo-dots="" className={PHOTO_DOTS_CLASSES}>
        {media.map((item, index) => (
          <span
            key={`${index}-${item.src ?? ""}`}
            data-current={index === current ? "" : undefined}
            className={photoDotClasses(index === current)}
          />
        ))}
      </div>
    </>
  );
}

/**
 * The photo card (C31): a creator seen through the visuals of the portfolio, never who it is before the reveal. The
 * alias is the one link, stretched over the card; the heart adds the creator to the active list or removes it,
 * `aria-pressed`, and pops when it has just been filled (never green); the screen tells the outcome. In a search the
 * visuals are a track (X8) with dots and arrows; in a selection the first visual stands alone and a note follows. No
 * amount, no rate, no score (D48, D78, D11). It reads no address, no session and no width.
 */
export function PhotoCard({
  href,
  media,
  badge,
  name,
  verified,
  lines,
  why,
  saved = false,
  onToggleSave,
  saveLabel,
  saving = false,
  refusal,
  leaving = false,
  className,
  ...variantProps
}: PhotoCardProps & PassThroughProps) {
  const nameId = useId();
  const refusalId = useId();
  // the pop of the heart follows a change to « saved », never its first drawing
  const [wasSaved, setWasSaved] = useState(saved);
  const [popping, setPopping] = useState(false);
  if (saved !== wasSaved) {
    setWasSaved(saved);
    setPopping(saved);
  }
  const inTrack =
    variantProps.variant === "search" && media.length > 1
      ? variantProps.carousel
      : undefined;
  const first = media[0];

  return (
    <article
      {...passThroughOf(variantProps)}
      aria-labelledby={nameId}
      data-photo-card={variantProps.variant}
      data-saved={saved ? "" : undefined}
      data-leaving={leaving ? "" : undefined}
      inert={leaving}
      className={cn(PHOTO_CARD_CLASSES, className)}
    >
      <div className={PHOTO_CARD_PHOTO_CLASSES}>
        {inTrack !== undefined ? (
          <Track media={media} carousel={inTrack} />
        ) : first !== undefined ? (
          <Visual media={first} className={PHOTO_CARD_STILL_CLASSES} />
        ) : (
          <div aria-hidden="true" className={PHOTO_CARD_STILL_CLASSES} />
        )}
        {badge === undefined ? null : (
          <span className={photoBadgeClasses(badge.tone)}>{badge.label}</span>
        )}
        <button
          type="button"
          aria-pressed={saved}
          aria-label={saveLabel}
          aria-disabled={saving ? true : undefined}
          aria-describedby={refusal === undefined ? undefined : refusalId}
          data-photo-heart=""
          className={photoHeartClasses(saved)}
          onClick={() => {
            if (!saving) {
              onToggleSave?.();
            }
          }}
        >
          <HeartIcon
            aria-hidden="true"
            data-pop={popping ? "" : undefined}
            className={photoHeartIconClasses(saved, popping)}
            onAnimationEnd={() => setPopping(false)}
          />
        </button>
      </div>
      <div className={PHOTO_CARD_BODY_CLASSES}>
        <div className={PHOTO_CARD_HEAD_CLASSES}>
          <a id={nameId} href={href} className={PHOTO_CARD_LINK_CLASSES}>
            {name}
          </a>
          {verified === undefined ? null : (
            <span
              data-photo-verified=""
              className={PHOTO_CARD_VERIFIED_CLASSES}
            >
              <BadgeCheckIcon
                aria-hidden="true"
                className={PHOTO_CARD_VERIFIED_ICON_CLASSES}
              />
              <span className="sr-only">
                {verified.date === undefined
                  ? verified.label
                  : `${verified.label} ${verified.date}`}
              </span>
            </span>
          )}
        </div>
        {lines.map((line, index) => (
          <p key={index} className={photoCardLineClasses(index === 0)}>
            {line}
          </p>
        ))}
        {why === undefined ? null : (
          <p className={PHOTO_CARD_WHY_CLASSES}>{why}</p>
        )}
      </div>
      {refusal === undefined ? null : (
        <p
          id={refusalId}
          data-photo-refusal=""
          className={PHOTO_CARD_REFUSAL_CLASSES}
        >
          {refusal}
        </p>
      )}
      {variantProps.variant === "shortlist" &&
      variantProps.note !== undefined ? (
        <div className={PHOTO_CARD_NOTE_CLASSES}>{variantProps.note}</div>
      ) : null}
    </article>
  );
}
