// Classes of the status badge of the connected spaces (docs/mvp/20 §11.8): an outlined pill with
// its state written in it, on the container's own background. Never filled: the fill is the action's.
import { cn } from "@/components/ui/class-names";

export type StatusTone = "neutral" | "success" | "warning" | "error" | "info";

const STATUS_BASE_CLASSES = cn(
  "inline-flex items-center gap-1 self-start rounded-pill px-3 py-1",
  "border-(length:--border-width-thin) text-xs font-semibold",
);

const STATUS_TONE_CLASSES: Record<StatusTone, string> = {
  neutral: "border-border-default text-text-secondary",
  success: "border-feedback-success-border text-feedback-success-text",
  warning: "border-feedback-warning-border text-feedback-warning-text",
  error: "border-feedback-error-border text-feedback-error-text",
  info: "border-feedback-info-border text-feedback-info-text",
};

export function statusBadgeClasses(tone: StatusTone): string {
  return cn(STATUS_BASE_CLASSES, STATUS_TONE_CLASSES[tone]);
}
