import type { ReactNode } from "react";
import { cn } from "@/components/ui/class-names";
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
} from "@/components/ui/icons";
import {
  noticeBodyClasses,
  noticeRowClasses,
  noticeIconClasses,
  type NoticeSize,
  type NoticeTone,
} from "./notice-classes";

const TONE_ICONS = {
  success: { Icon: CircleCheckIcon, color: "text-feedback-success-icon" },
  warning: { Icon: TriangleAlertIcon, color: "text-feedback-warning-icon" },
  info: { Icon: InfoIcon, color: "text-feedback-info-icon" },
} as const;

export type NoticeProps = {
  tone: NoticeTone;
  /** `md` by default; `strip`: icon, text and action on one centred line, wrapping together. */
  size?: NoticeSize;
  /** The first words in bold, running on into the text, already translated. */
  title?: string;
  /** What the notice offers (a button or a link), at its end; it is part of what is announced. */
  action?: ReactNode;
  id?: string;
  /** `status` by default; false for a text already tied to its subject (no live region). */
  announce?: boolean;
  className?: string;
  children?: ReactNode;
};

/**
 * A notice (C17): family icon and text, never the colour alone (P7), for an event or a warning and never
 * for a lasting state (U46: that is a badge). Three tones only (R06b §7, EC-RUA-06-1). An error is ErrorNotice.
 */
export function Notice({
  tone,
  size,
  title,
  action,
  id,
  announce = true,
  className,
  children,
}: NoticeProps) {
  const { Icon, color } = TONE_ICONS[tone];
  return (
    <div
      id={id}
      role={announce ? "status" : undefined}
      className={cn(noticeRowClasses(tone, size), className)}
    >
      <Icon aria-hidden="true" className={cn(noticeIconClasses(size), color)} />
      <div className={noticeBodyClasses(size)}>
        {title === undefined ? null : (
          <strong className="font-semibold">{title} </strong>
        )}
        {children}
      </div>
      {action === undefined ? null : <div className="shrink-0">{action}</div>}
    </div>
  );
}
