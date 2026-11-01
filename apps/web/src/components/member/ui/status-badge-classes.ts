// Classes of the status badge of the connected spaces (docs/mvp/20 §11.8, D75 RK-11): a pill filled
// with an opaque dark ground of its own family, its state written in it, in Manrope bold. Never
// green: the vivid fill is the action's.
import { cn } from "@/components/ui/class-names";

export type StatusTone = "neutral" | "success" | "warning" | "error" | "info";

const STATUS_BASE_CLASSES = cn(
  "inline-flex items-center gap-1 self-start rounded-pill px-3 py-1",
  "border-(length:--border-width-thin) font-display text-xs font-bold",
);

const STATUS_TONE_CLASSES: Record<StatusTone, string> = {
  neutral: "border-border-default bg-surface-raised text-text-secondary",
  success:
    "border-feedback-success-border bg-feedback-success-bg text-feedback-success-text",
  warning:
    "border-feedback-warning-border bg-feedback-warning-bg text-feedback-warning-text",
  error:
    "border-feedback-error-border bg-badge-error-bg text-feedback-error-text",
  info: "border-feedback-info-border bg-feedback-info-bg text-feedback-info-text",
};

export function statusBadgeClasses(tone: StatusTone): string {
  return cn(STATUS_BASE_CLASSES, STATUS_TONE_CLASSES[tone]);
}
