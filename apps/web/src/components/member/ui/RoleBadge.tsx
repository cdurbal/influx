import { cn } from "@/components/ui/class-names";

export type MemberRole = "advertiser" | "creator";

const ROLE_DOT_CLASSES: Record<MemberRole, string> = {
  advertiser: "bg-role-advertiser",
  creator: "bg-role-creator",
};

type RoleBadgeProps = {
  role: MemberRole;
  /** The role, written ("Brand", "Creator"): the color alone says nothing (P7, 12 RG7). */
  label: string;
  className?: string;
};

/**
 * The role of a member: a dot of its color, then the role in words. The only consumer of
 * `role-advertiser` and `role-creator` (G3g, 20 §11.3): a visual mark, never a text, a fill or a
 * contour. The label is required by the type; the dot is decorative.
 */
export function RoleBadge({ role, label, className }: RoleBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-sm text-text-secondary",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn("size-2 shrink-0 rounded-round", ROLE_DOT_CLASSES[role])}
      />
      {label}
    </span>
  );
}
