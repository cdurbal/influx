// Classes of the logo plate and of the round avatar (docs/mvp/22-refonte-ux-ui/02a C33, RU-07): a square of
// 32, 40, 48, 56, 64 or 120 px whose light plate holds a logo with 4 px around it, 12 px of radius (16 for
// the hero); the round one holds a face or its initials on a plain ground, never a gradient. A logo that
// is absent from a queue is a dashed square. The sizes and the shapes are the keys of their object, not
// quoted strings (TK7.2).
import { cn } from "@/components/ui/class-names";

const LOGO_PLATE_BASE_CLASSES = cn(
  "inline-flex shrink-0 items-center justify-center overflow-hidden",
  "font-display font-extrabold tracking-heading",
);

// A square of the spacing scale (32, 40, 48, 64 px), of `size-thumb` (56) or of `size-logo-hero` (120).
const LOGO_PLATE_SIZES = {
  32: { box: "size-6 text-xs", corner: "rounded-md" },
  40: { box: "size-7 text-xs", corner: "rounded-md" },
  48: { box: "size-8 text-xs", corner: "rounded-md" },
  56: { box: "size-(--size-thumb) text-md", corner: "rounded-md" },
  64: { box: "size-9 text-md", corner: "rounded-md" },
  120: {
    box: "size-(--size-logo-hero) text-title-hero",
    corner: "rounded-card",
  },
};

const LOGO_PLATE_SHAPES = {
  plate: {
    ground: "bg-logo-plate p-1 text-text-inverse",
    image: "object-contain",
  },
  round: {
    ground: "rounded-round bg-surface-active text-text-primary",
    image: "object-cover",
  },
};

const LOGO_PLATE_DASHED_CLASSES =
  "border-(length:--border-width-thin) border-dashed border-border-strong";

export type LogoPlateSize = keyof typeof LOGO_PLATE_SIZES;
export type LogoPlateShape = keyof typeof LOGO_PLATE_SHAPES;

/** The square of the logo, its initials or its dashes; `dashed` draws the empty square of a missing logo. */
export function logoPlateClasses(
  size: LogoPlateSize,
  shape: LogoPlateShape,
  dashed: boolean,
): string {
  const { box, corner } = LOGO_PLATE_SIZES[size];
  const { ground } = LOGO_PLATE_SHAPES[shape];
  return cn(
    LOGO_PLATE_BASE_CLASSES,
    box,
    dashed ? cn(corner, LOGO_PLATE_DASHED_CLASSES) : cn(corner, ground),
  );
}

/** The picture: the whole logo on its plate, the face covering its disc. */
export function logoPlateImageClasses(shape: LogoPlateShape): string {
  return cn("size-full", LOGO_PLATE_SHAPES[shape].image);
}
