// Classes of the frame of a preview (C66; docs/mvp/22-refonte-ux-ui/02b C66, RU-09): `zone`, a hat of 12 px in
// capitals over a filet; `strip`, a dashed band of information above what is previewed. Neither dims what it holds:
// an action that does nothing in a preview is unavailable in its own right and says why. The variants are the bare
// keys of their object (TK7.2).
import { cn } from "@/components/ui/class-names";

const PREVIEW_FRAME_VARIANTS = {
  zone: {
    frame: cn(
      "flex flex-col gap-5 pt-5",
      "border-t-(length:--border-width-thin) border-border-default",
    ),
    label:
      "flex items-center gap-2 text-xs font-semibold uppercase tracking-overline text-text-secondary",
    icon: "size-(--size-icon-sm) shrink-0",
  },
  strip: {
    frame: "flex flex-col gap-5",
    label: cn(
      "flex items-start gap-3 rounded-md border-(length:--border-width-thin) border-dashed px-4 py-3 text-sm",
      "border-feedback-info-border bg-feedback-info-bg text-text-primary",
    ),
    icon: "mt-(--size-nudge) size-(--size-icon-md) shrink-0 text-feedback-info-icon",
  },
};

export type PreviewFrameVariant = keyof typeof PREVIEW_FRAME_VARIANTS;

/** The classes of the parts of one variant. */
export function previewFrameClasses(variant: PreviewFrameVariant) {
  return PREVIEW_FRAME_VARIANTS[variant];
}
