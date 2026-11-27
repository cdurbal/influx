"use client";

import { useEffect, useState } from "react";
import {
  SKELETON_FIELD_BOX_CLASSES,
  SKELETON_FIELD_LABEL_CLASSES,
  SKELETON_LABEL_CLASSES,
  SKELETON_LINE_CLASSES,
  SKELETON_PHOTO_CLASSES,
  SKELETON_SHORT_LINE_CLASSES,
  skeletonItemClasses,
  skeletonStackClasses,
  type SkeletonShape,
} from "./skeleton-classes";
import { passThroughOf, type PassThroughProps } from "./pass-through";

/** Nothing is drawn before this delay: a load that is quick shows no flash of grey (interactions.html). */
export const SKELETON_DELAY_MS = 1000;

export type SkeletonProps = {
  shape: SkeletonShape;
  /** How many of the shape, one under the other (1 by default). */
  count?: number;
  /** What a screen reader hears while it loads, already translated ("Loading…"). */
  label: string;
  id?: string;
  className?: string;
};

/** The parts of one shape: a card is a photo and three lines, a field its label and its box. */
function SkeletonParts({ shape }: { shape: SkeletonShape }) {
  if (shape === "card") {
    return (
      <>
        <div className={SKELETON_PHOTO_CLASSES} />
        <div className={SKELETON_LINE_CLASSES} />
        <div className={SKELETON_LINE_CLASSES} />
        <div className={SKELETON_SHORT_LINE_CLASSES} />
      </>
    );
  }
  if (shape === "field") {
    return (
      <>
        <div className={SKELETON_FIELD_LABEL_CLASSES} />
        <div className={SKELETON_FIELD_BOX_CLASSES} />
      </>
    );
  }
  return null;
}

/**
 * The placeholder of what is loading (C09), at the height of the final content so that nothing moves when
 * it arrives. The container is `aria-busy` and carries the label off screen; the shapes are decoration
 * (`aria-hidden`) and stay invisible for the first second. Under reduced motion they stay still.
 */
export function Skeleton({
  shape,
  count = 1,
  label,
  id,
  className,
  ...rest
}: SkeletonProps & PassThroughProps) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), SKELETON_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div
      {...passThroughOf(rest)}
      id={id}
      aria-busy="true"
      className={className}
    >
      <span className={SKELETON_LABEL_CLASSES}>{label}</span>
      <div aria-hidden="true" className={skeletonStackClasses(shape, visible)}>
        {Array.from({ length: Math.max(1, count) }, (_, index) => (
          <div key={index} className={skeletonItemClasses(shape)}>
            <SkeletonParts shape={shape} />
          </div>
        ))}
      </div>
    </div>
  );
}
