import type { ComponentType } from "react";
import { cn } from "@/components/ui/class-names";
import {
  REASON_BODY_CLASSES,
  REASON_CLASSES,
  REASON_ICON_CLASSES,
  REASON_TITLE_CLASSES,
  reasonListClasses,
  type ReasonListGap,
} from "./reason-list-classes";

/** What a lucide icon of `icons.ts` is, as far as a reason is concerned: it takes a class, it is decorative. */
type ReasonIcon = ComponentType<{
  className?: string;
  "aria-hidden"?: "true";
}>;

export type ReasonListProps = {
  /** The facts, in the order the screen chose: each one checkable, already translated. */
  items: { icon: ReasonIcon; title: string; body: string }[];
  /** 24 px between two reasons (`lg`, by default) or 16 px (`md`). */
  gap?: ReasonListGap;
  className?: string;
};

/**
 * Why something is shown or suggested (C36): checkable facts, one icon, a title and a sentence each. Never a score,
 * a rank or a share of a match (D11, RG41): the component takes no number of its own. An empty list draws nothing,
 * and the screen leaves its section out.
 */
export function ReasonList({ items, gap = "lg", className }: ReasonListProps) {
  if (items.length === 0) return null;
  return (
    <ul data-reason-list="" className={cn(reasonListClasses(gap), className)}>
      {items.map(({ icon: Icon, title, body }, index) => (
        <li key={`${index}:${title}`} className={REASON_CLASSES}>
          <Icon aria-hidden="true" className={REASON_ICON_CLASSES} />
          <div>
            <p className={REASON_TITLE_CLASSES}>{title}</p>
            <p className={REASON_BODY_CLASSES}>{body}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
