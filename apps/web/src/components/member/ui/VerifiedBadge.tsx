import { cn } from "@/components/ui/class-names";
import { BadgeCheckIcon } from "@/components/ui/icons";

type VerifiedBadgeProps = (
  | {
      /** "Verified" / "Vérifié". */
      label: string;
      /** The network the figures were checked on: the badge is per network (08 RG4). */
      network: string;
      /** The complete date of the check, already formatted for the language (08 RG4, RG10, EC-L2E-9). */
      date: string;
    }
  | {
      /** The sentence of 08 RG10 or RG93, written whole by the caller (« Compte vérifié — Instagram, le … »). */
      text: string;
    }
) & {
  className?: string;
};

/**
 * The verified badge (F3, 2026-10-29): blue, and never a tick alone nor glued to a name. It writes
 * "Verified · network · date" on the line of the network it covers, or the whole sentence of RG93
 * (« Compte vérifié — {network}, le {date} »), because the blue tick of the social networks claims
 * something else (D34, 20 §11.3). The date is the complete one, day included (EC-L2E-9, 08 RG4).
 */
export function VerifiedBadge(props: VerifiedBadgeProps) {
  const written =
    "text" in props
      ? props.text
      : [props.label, props.network, props.date].join(" · ");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 self-start rounded-pill px-3 py-1",
        "border-(length:--border-width-thin) border-verified-border bg-verified-bg font-display text-xs font-bold text-verified-text",
        props.className,
      )}
    >
      <BadgeCheckIcon
        aria-hidden="true"
        className="size-(--size-icon-sm) shrink-0"
      />
      {written}
    </span>
  );
}
