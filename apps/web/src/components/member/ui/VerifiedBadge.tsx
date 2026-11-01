import { cn } from "@/components/ui/class-names";
import { BadgeCheckIcon } from "@/components/ui/icons";

type VerifiedBadgeProps = {
  /** "Verified" / "Vérifié". */
  label: string;
  /** The network the figures were checked on: the badge is per network (08 RG4). */
  network: string;
  /** Month and year of the check, already formatted for the language (08 RG10). */
  date: string;
  className?: string;
};

/**
 * The verified badge (F3, 2026-10-29): blue, and never a tick alone nor glued to a name. It writes
 * "Verified · network · month year" on the line of the network it covers, because the blue tick of
 * the social networks claims something else (D34, 20 §11.3).
 */
export function VerifiedBadge({
  label,
  network,
  date,
  className,
}: VerifiedBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 self-start rounded-pill px-3 py-1",
        "border-(length:--border-width-thin) border-verified-border bg-verified-bg font-display text-xs font-bold text-verified-text",
        className,
      )}
    >
      <BadgeCheckIcon
        aria-hidden="true"
        className="size-(--size-icon-sm) shrink-0"
      />
      {[label, network, date].join(" · ")}
    </span>
  );
}
