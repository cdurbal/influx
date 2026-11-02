import { cn } from "@/components/ui/class-names";
import { EyeOffIcon, GlobeIcon, LockIcon } from "@/components/ui/icons";
import { layerBadgeClasses, type ProfileLayer } from "./layer-badge-classes";

const LAYER_ICONS = {
  public: GlobeIcon,
  revealed: LockIcon,
  internal: EyeOffIcon,
} as const;

type LayerBadgeProps = {
  layer: ProfileLayer;
  /** The layer, written: `brandProfile.layer.<layer>` (06 RG84). */
  label: string;
  /** For the `aria-describedby` of the field it labels. */
  id?: string;
  className?: string;
};

/**
 * Who sees a field of the profile (06 RG62, CA39): everyone, creators after an introduction, or the
 * INFLUX team only. An icon AND the text in each case: the green of the middle layer never carries
 * the information alone (RG85, CA47).
 */
export function LayerBadge({ layer, label, id, className }: LayerBadgeProps) {
  const Icon = LAYER_ICONS[layer];
  return (
    <span id={id} className={cn(layerBadgeClasses(layer), className)}>
      <Icon aria-hidden="true" className="size-(--size-icon-sm) shrink-0" />
      {label}
    </span>
  );
}
