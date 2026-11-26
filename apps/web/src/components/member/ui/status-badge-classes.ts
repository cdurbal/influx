// Classes of the status badge of the connected spaces (docs/mvp/20 §11.8, D75 RK-11; 22-refonte-ux-ui/02a
// C13): a pill filled with an opaque dark ground of its own family, its state written in it, in Manrope
// bold, an 8 px gap between the icon and the word (U65). Never green: the vivid fill is the action's. The
// `text` form has no pill: an icon of 16 px and the word, a 4 px gap, the colour of the tone. The tones and
// the forms are the keys of their object, not quoted strings (TK7.2).
import { cn } from "@/components/ui/class-names";

const STATUS_BASE_CLASSES = "inline-flex items-center self-start text-xs";

const STATUS_PILL_CLASSES = cn(
  "gap-2 rounded-pill px-3 py-1",
  "border-(length:--border-width-thin) font-display font-bold",
);

const STATUS_TEXT_CLASSES = "gap-1 font-display font-semibold";

const STATUS_TONE_CLASSES = {
  neutral: "border-border-default bg-surface-raised text-text-secondary",
  success:
    "border-feedback-success-border bg-feedback-success-bg text-feedback-success-text",
  warning:
    "border-feedback-warning-border bg-feedback-warning-bg text-feedback-warning-text",
  error:
    "border-feedback-error-border bg-badge-error-bg text-feedback-error-text",
  info: "border-feedback-info-border bg-feedback-info-bg text-feedback-info-text",
  verified: "border-verified-border bg-verified-bg text-verified-text",
};

const STATUS_TEXT_TONE_CLASSES = {
  neutral: "text-text-secondary",
  success: "text-feedback-success-text",
  warning: "text-feedback-warning-text",
  error: "text-feedback-error-text",
  info: "text-feedback-info-text",
  verified: "text-verified-text",
};

const STATUS_VARIANT_CLASSES = {
  pill: { form: STATUS_PILL_CLASSES, tones: STATUS_TONE_CLASSES },
  text: { form: STATUS_TEXT_CLASSES, tones: STATUS_TEXT_TONE_CLASSES },
};

export type StatusTone = keyof typeof STATUS_TONE_CLASSES;
export type StatusVariant = keyof typeof STATUS_VARIANT_CLASSES;

/** The icon of a badge: 16 px, never shrunk by the line it sits in. */
export const STATUS_ICON_CLASSES = "size-(--size-icon-sm) shrink-0";

/** The pill when no form is given: the badge as it has always been drawn. */
export function statusBadgeClasses(
  tone: StatusTone,
  variant?: StatusVariant,
): string {
  const { form, tones } =
    variant === undefined
      ? STATUS_VARIANT_CLASSES.pill
      : STATUS_VARIANT_CLASSES[variant];
  return cn(STATUS_BASE_CLASSES, form, tones[tone]);
}
