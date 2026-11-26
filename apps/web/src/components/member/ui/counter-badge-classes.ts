// Classes of the counter of the connected spaces (docs/mvp/22-refonte-ux-ui/02a C16, 17 §2.2): a pill of
// 18,6 px, 24 at least, 12 px bold, 0 × 8; the `dot` is a 20 px disc inside another pill. The thin contour is
// transparent: the fill falls away under forced colours, the system then draws the shape (AP1, 20 §11.8).
// The contour is an outline, so that the pill keeps the height of its text. A late counter takes the
// warning ground and a flag: the lateness is a shape and a word, never the colour alone. The forms are the
// keys of their object, not quoted strings (TK7.2).
import { cn } from "@/components/ui/class-names";

const COUNTER_BASE_CLASSES = cn(
  "inline-flex items-center justify-center gap-1 font-display text-xs font-bold tabular-nums",
  "outline-solid outline-(length:--border-width-thin) outline-transparent",
);

const COUNTER_VARIANT_CLASSES = {
  pill: {
    box: "min-w-5 rounded-pill px-2",
    flag: "size-(--size-icon-sm) shrink-0",
  },
  dot: {
    box: "size-(--size-icon-md) rounded-round",
    flag: "size-(--size-icon-xs) shrink-0",
  },
};

export type CounterVariant = keyof typeof COUNTER_VARIANT_CLASSES;

const COUNTER_ON_TIME_CLASSES = "bg-counter-bg text-counter-text";
const COUNTER_LATE_CLASSES =
  "bg-feedback-warning-bg text-feedback-warning-text";

/**
 * The container of the pill, which flashes when the value changes (R04 line 17): a halo of 4 px around
 * the pill that fades out, the layout untouched. Under reduced motion the duration is zero: no flash, the
 * change is announced by the screen that owns the counter.
 */
export const COUNTER_CONTAINER_CLASSES =
  "inline-flex rounded-pill p-1 -m-1 align-middle";
export const COUNTER_FLASH_CLASSES = "animate-flash-strong";

/** The pill when no form is given: the counter as it has always been drawn. */
function variantOf(variant: CounterVariant | undefined) {
  return variant === undefined
    ? COUNTER_VARIANT_CLASSES.pill
    : COUNTER_VARIANT_CLASSES[variant];
}

export function counterBadgeClasses(
  variant: CounterVariant | undefined,
  late: boolean,
): string {
  return cn(
    COUNTER_BASE_CLASSES,
    variantOf(variant).box,
    late ? COUNTER_LATE_CLASSES : COUNTER_ON_TIME_CLASSES,
  );
}

/** The flag of a late counter. */
export function counterFlagClasses(
  variant: CounterVariant | undefined,
): string {
  return variantOf(variant).flag;
}
