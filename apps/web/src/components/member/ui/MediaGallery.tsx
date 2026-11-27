"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/components/ui/class-names";
import { ChevronLeftIcon, GridIcon } from "@/components/ui/icons";
import { Button } from "./Button";
import { galleryDialogClasses } from "./dialog-classes";
import {
  GALLERY_ALL_CLASSES,
  GALLERY_ALL_ICON_CLASSES,
  GALLERY_BODY_CLASSES,
  GALLERY_CAPTION_CLASSES,
  GALLERY_CAROUSEL_CLASSES,
  GALLERY_COUNT_CLASSES,
  GALLERY_EMPTY_CLASSES,
  GALLERY_FIGURE_CLASSES,
  GALLERY_FIGURE_IMAGE_CLASSES,
  GALLERY_GRID_CLASSES,
  GALLERY_HEAD_CLASSES,
  GALLERY_IMAGE_CLASSES,
  GALLERY_LIST_CLASSES,
  GALLERY_MOSAIC_CLASSES,
  GALLERY_MOSAIC_IMAGE_CLASSES,
  GALLERY_MOSAIC_MAX,
  GALLERY_SINGLE_CLASSES,
  GALLERY_SLIDE_CLASSES,
  GALLERY_TITLE_CLASSES,
  GALLERY_TRACK_CLASSES,
  GALLERY_VISUAL_CLASSES,
  galleryCellClasses,
} from "./media-gallery-classes";
import { useModalDialog } from "./use-modal-dialog";
import { useSlideInView } from "./use-slide-in-view";
import { passThroughOf, type PassThroughProps } from "./pass-through";

/** One visual: its source, what it shows (never who), and the words under it in the dialog. */
type MediaGalleryItem = { src: string; alt: string; caption?: string };

export type MediaGalleryProps = {
  /** The visuals, in order. */
  items: MediaGalleryItem[];
  /** « Voir les 6 visuels », composed by the screen with the count. */
  allLabel: string;
  /** The name of the dialog and of the track: « Portfolio · Profil 93JMS4 ». */
  title: string;
  /** The name of the chevron that closes the dialog: « Fermer la galerie ». */
  closeLabel: string;
  /** What stands for a portfolio without a visual: a sentence, without a frame. */
  emptyLabel: string;
  className?: string;
};

type OpenAt = (index: number) => void;

/** A visual as a button named by what it shows: it opens the dialog on itself. */
function VisualButton({
  item,
  index,
  onOpen,
  className,
  imageClassName,
}: {
  item: MediaGalleryItem;
  index: number;
  onOpen: OpenAt;
  className: string;
  imageClassName: string;
}) {
  return (
    <button
      type="button"
      data-gallery-visual={index}
      className={cn(GALLERY_VISUAL_CLASSES, className)}
      onClick={() => onOpen(index)}
    >
      {/* A signed URL of the portfolio or a local picture: next/image has nothing to optimise. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.src} alt={item.alt} className={imageClassName} />
    </button>
  );
}

/** From 768 px: five visuals at most in a frame without an empty cell, and « see them all » from two. */
function Mosaic({
  items,
  allLabel,
  onOpen,
}: {
  items: MediaGalleryItem[];
  allLabel: string;
  onOpen: OpenAt;
}) {
  return (
    <div data-gallery-mosaic="" className={GALLERY_MOSAIC_CLASSES}>
      <div className={GALLERY_GRID_CLASSES}>
        {items.slice(0, GALLERY_MOSAIC_MAX).map((item, index) => (
          <VisualButton
            key={`${index}-${item.src}`}
            item={item}
            index={index}
            onOpen={onOpen}
            className={galleryCellClasses(items.length, index)}
            imageClassName={GALLERY_MOSAIC_IMAGE_CLASSES}
          />
        ))}
      </div>
      {items.length > 1 ? (
        <button
          type="button"
          data-gallery-all=""
          className={GALLERY_ALL_CLASSES}
          onClick={() => onOpen(0)}
        >
          <GridIcon aria-hidden="true" className={GALLERY_ALL_ICON_CLASSES} />
          {allLabel}
        </button>
      ) : null}
    </div>
  );
}

/** Below 768 px: a track and its counter; one visual alone has neither. */
function Carousel({
  items,
  title,
  onOpen,
}: {
  items: MediaGalleryItem[];
  title: string;
  onOpen: OpenAt;
}) {
  const { track, current } = useSlideInView(items.length);
  const alone = items.length === 1;
  // two numbers and a bar: no words to translate
  const place = [current + 1, items.length].join(" / ");
  const slides = items.map((item, index) => (
    <VisualButton
      key={`${index}-${item.src}`}
      item={item}
      index={index}
      onOpen={onOpen}
      className={alone ? GALLERY_SINGLE_CLASSES : GALLERY_SLIDE_CLASSES}
      imageClassName={GALLERY_IMAGE_CLASSES}
    />
  ));
  return (
    <div data-gallery-carousel="" className={GALLERY_CAROUSEL_CLASSES}>
      {alone ? (
        slides
      ) : (
        <>
          <div
            ref={track}
            role="region"
            aria-label={title}
            // a region that scrolls is reached by the keyboard (X8; axe scrollable-region-focusable)
            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
            tabIndex={0}
            data-gallery-track=""
            className={GALLERY_TRACK_CLASSES}
          >
            {slides}
          </div>
          {/* The eye's landmark alone: each visual says its own place in its name. */}
          <span
            aria-hidden="true"
            data-gallery-count=""
            className={GALLERY_COUNT_CLASSES}
          >
            {place}
          </span>
        </>
      )}
    </div>
  );
}

/**
 * The whole-screen dialog of all the visuals, on the base of C27: the focus goes to the chevron, `Échap` and the
 * chevron close, the focus goes back to what opened it, and the visual asked for is brought to the top of the body.
 */
function GalleryDialog({
  items,
  title,
  closeLabel,
  openedAt,
  onClose,
}: {
  items: MediaGalleryItem[];
  title: string;
  closeLabel: string;
  /** The visual the dialog opens on; null while it is closed. */
  openedAt: number | null;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const { titleId, titleRef, dialogProps } = useModalDialog({
    open: openedAt !== null,
    onClose,
    dismissible: true,
    initialFocus: closeRef,
  });

  // After the effect of the base, which shows the dialog: only the body scrolls, never the page behind it.
  useEffect(() => {
    const body = bodyRef.current;
    if (openedAt === null || body === null) {
      return;
    }
    const figure = body.querySelectorAll("figure")[openedAt];
    body.scrollTop = openedAt === 0 ? 0 : (figure?.offsetTop ?? 0);
  }, [openedAt]);

  return (
    <dialog
      data-dialog="gallery"
      {...dialogProps}
      className={galleryDialogClasses()}
    >
      <div className={GALLERY_HEAD_CLASSES}>
        <Button
          ref={closeRef}
          variant="text"
          aria-label={closeLabel}
          onClick={onClose}
          icon={<ChevronLeftIcon className="size-(--size-icon-md)" />}
        />
        <h2
          id={titleId}
          ref={titleRef}
          tabIndex={-1}
          className={GALLERY_TITLE_CLASSES}
        >
          {title}
        </h2>
      </div>
      <div
        ref={bodyRef}
        role="region"
        aria-labelledby={titleId}
        // the body scrolls and holds nothing to focus: the keyboard reaches it (X8)
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        data-gallery-body=""
        className={GALLERY_BODY_CLASSES}
      >
        <div className={GALLERY_LIST_CLASSES}>
          {items.map((item, index) => (
            <figure
              key={`${index}-${item.src}`}
              className={GALLERY_FIGURE_CLASSES}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.src}
                alt={item.alt}
                loading="lazy"
                className={GALLERY_FIGURE_IMAGE_CLASSES}
              />
              {item.caption === undefined ? null : (
                <figcaption className={GALLERY_CAPTION_CLASSES}>
                  {item.caption}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      </div>
    </dialog>
  );
}

/**
 * The gallery of a reading page (C34): the visuals of a portfolio, never who made them before the reveal. A mosaic
 * from 768 px and a carousel below it, one of the two alone at a width by CSS; each visual and « see them all » open
 * a whole-screen dialog. Without a visual, a sentence; whether to show the gallery at all is the screen's. It reads
 * no address, no session and no width.
 */
export function MediaGallery({
  items,
  allLabel,
  title,
  closeLabel,
  emptyLabel,
  className,
  ...rest
}: MediaGalleryProps & PassThroughProps) {
  const [openedAt, setOpenedAt] = useState<number | null>(null);
  if (items.length === 0) {
    return (
      <p
        {...passThroughOf(rest)}
        data-media-gallery="empty"
        className={cn(GALLERY_EMPTY_CLASSES, className)}
      >
        {emptyLabel}
      </p>
    );
  }
  return (
    <div {...passThroughOf(rest)} data-media-gallery="" className={className}>
      <Mosaic items={items} allLabel={allLabel} onOpen={setOpenedAt} />
      <Carousel items={items} title={title} onOpen={setOpenedAt} />
      <GalleryDialog
        items={items}
        title={title}
        closeLabel={closeLabel}
        openedAt={openedAt}
        onClose={() => setOpenedAt(null)}
      />
    </div>
  );
}
