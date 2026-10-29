import type { ReactNode } from "react";
import { cn } from "@/components/ui/class-names";
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
} from "@/components/ui/icons";
import { noticeClasses, type NoticeTone } from "./notice-classes";

const TONE_ICONS = {
  success: { Icon: CircleCheckIcon, color: "text-feedback-success-icon" },
  warning: { Icon: TriangleAlertIcon, color: "text-feedback-warning-icon" },
  info: { Icon: InfoIcon, color: "text-feedback-info-icon" },
} as const;

type NoticeProps = {
  tone: NoticeTone;
  id?: string;
  /** `status` by default; false for a text already tied to its subject (no live region). */
  announce?: boolean;
  className?: string;
  children?: ReactNode;
};

/** A notice: family icon and text, never the color alone (P7). An error is ErrorNotice. */
export function Notice({
  tone,
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
      className={cn(noticeClasses(tone), "flex items-start gap-2", className)}
    >
      <Icon
        aria-hidden="true"
        className={cn("size-(--size-icon-md) shrink-0", color)}
      />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
