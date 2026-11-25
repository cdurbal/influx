// Classes of the layer badge of a field (docs/mvp/06 RG62, RG84; 17 §4.2 "Les trois étiquettes de
// couche"): a pill with an icon AND a text in each of the three layers, so that the green of the
// revealed layer never carries the information alone (RG85). When the text does not fit on one line,
// the box shrinks to the icon: the text follows it in the same flow, clipped, and stays its name.
import { cn } from "@/components/ui/class-names";

export type ProfileLayer = "public" | "revealed" | "internal";

const LAYER_BASE_CLASSES = cn(
  "inline-flex items-center gap-1 self-start rounded-pill whitespace-nowrap",
  "border-(length:--border-width-thin) text-xs font-semibold",
);

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
): string {
  return cn(
    LAYER_BASE_CLASSES,
    iconOnly ? LAYER_ICON_ONLY_CLASSES : LAYER_WHOLE_CLASSES,
    LAYER_TONE_CLASSES[layer],
  );
}
