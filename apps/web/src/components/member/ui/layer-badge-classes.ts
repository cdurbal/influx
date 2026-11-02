// Classes of the layer badge of a field (docs/mvp/06 RG62, RG84; 17 §4.2 "Les trois étiquettes de
// couche"): a pill with an icon AND a text in each of the three layers, so that the green of the
// revealed layer never carries the information alone (RG85).
import { cn } from "@/components/ui/class-names";

export type ProfileLayer = "public" | "revealed" | "internal";

const LAYER_BASE_CLASSES = cn(
  "inline-flex items-center gap-1 self-start rounded-pill px-3 py-1",
  "border-(length:--border-width-thin) text-xs font-semibold",
);

const LAYER_TONE_CLASSES: Record<ProfileLayer, string> = {
  public: "border-border-default bg-surface-raised text-text-secondary",
  revealed:
    "border-brand-subtle-border bg-brand-subtle-bg text-text-brand-strong",
  internal: "border-border-default bg-surface-raised text-text-tertiary",
};

export function layerBadgeClasses(layer: ProfileLayer): string {
  return cn(LAYER_BASE_CLASSES, LAYER_TONE_CLASSES[layer]);
}
