// Classes of the layer badge of a field (docs/mvp/06 RG62, RG84; 17 §4.2 "Les trois étiquettes de
// couche"): a pill with an icon AND a text in each of the three layers, so that the green of the
// revealed layer never carries the information alone (RG85). When the text does not fit on one line,
// the box shrinks to the icon: the text follows it in the same flow, clipped, and stays its name. The
// measures are those of the status badge (C14, 02a): an 8 px gap between the icon and the word, 600. `wrap`
// lets the text take two lines in a box of 12 px radius, the icon nudged to the first line.
import { cn } from "@/components/ui/class-names";

export type ProfileLayer = "public" | "revealed" | "internal";

const LAYER_BASE_CLASSES = cn(
  "inline-flex gap-2 self-start",
  "border-(length:--border-width-thin) text-xs font-semibold",
);

const LAYER_ONE_LINE_CLASSES = "items-center rounded-pill whitespace-nowrap";
const LAYER_WRAPPED_CLASSES = "items-start rounded-md";

/** The icon of a badge whose text wraps: on the first line, not centred on the whole box. */
export const LAYER_WRAPPED_ICON_CLASSES = "mt-(--size-nudge)";

const LAYER_WHOLE_CLASSES = "px-3 py-1";
const LAYER_ICON_ONLY_CLASSES =
  "size-(--size-layer-badge-icon-only) overflow-hidden p-1";

const LAYER_TONE_CLASSES: Record<ProfileLayer, string> = {
  public: "border-border-default bg-surface-raised text-text-secondary",
  revealed:
    "border-brand-subtle-border bg-brand-subtle-bg text-text-brand-strong",
  internal: "border-border-default bg-surface-raised text-text-tertiary",
};

export function layerBadgeClasses(
  layer: ProfileLayer,
  iconOnly = false,
  wrap = false,
): string {
  return cn(
    LAYER_BASE_CLASSES,
    wrap && !iconOnly ? LAYER_WRAPPED_CLASSES : LAYER_ONE_LINE_CLASSES,
    iconOnly ? LAYER_ICON_ONLY_CLASSES : LAYER_WHOLE_CLASSES,
    LAYER_TONE_CLASSES[layer],
  );
}
