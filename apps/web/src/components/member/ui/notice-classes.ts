// Classes of the notices of the connected spaces (docs/mvp/20 §11.8): success, warning and
// information keep an opaque tinted fill (DZ-6). The error notice is ErrorNotice, the one place of
// the error fill (D72, T15), so it is not a tone of this file.
import { cn } from "@/components/ui/class-names";

export type NoticeTone = "success" | "warning" | "info";

const NOTICE_BASE_CLASSES = cn(
  "rounded-md border-(length:--border-width-thin) px-4 py-3 text-sm",
);

const NOTICE_TONE_CLASSES: Record<NoticeTone, string> = {
  success:
    "border-feedback-success-border bg-feedback-success-bg text-feedback-success-text",
  warning:
    "border-feedback-warning-border bg-feedback-warning-bg text-feedback-warning-text",
  // The information notice reads in the primary text; its icon carries the blue (20 §11.8).
  info: "border-feedback-info-border bg-feedback-info-bg text-text-primary",
};

export function noticeClasses(tone: NoticeTone): string {
  return cn(NOTICE_BASE_CLASSES, NOTICE_TONE_CLASSES[tone]);
}
