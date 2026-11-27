import { useId, type ReactNode } from "react";
import { cn } from "@/components/ui/class-names";
import { EyeIcon } from "@/components/ui/icons";
import {
  previewFrameClasses,
  type PreviewFrameVariant,
} from "./preview-frame-classes";
import { passThroughOf, type PassThroughProps } from "./pass-through";

export type PreviewFrameProps = {
  /** What says that this is a preview, already translated: a word (`zone`), a sentence (`strip`). */
  label: ReactNode;
  variant: PreviewFrameVariant;
  /** The real content. An action that does nothing here is built unavailable, with the sentence that says why. */
  children: ReactNode;
  className?: string;
};

/**
 * What another side will see (C66): the real content in a group named by its label. The frame blocks and dims
 * nothing: an inert action stays in the page for a screen reader, `aria-disabled` and explained by its caller
 * (RU-09: no opacity, no `aria-hidden` on a button).
 */
export function PreviewFrame({
  label,
  variant,
  children,
  className,
  ...rest
}: PreviewFrameProps & PassThroughProps) {
  const labelId = useId();
  const classes = previewFrameClasses(variant);
  return (
    <div
      {...passThroughOf(rest)}
      role="group"
      aria-labelledby={labelId}
      data-preview-frame={variant}
      className={cn(classes.frame, className)}
    >
      <p id={labelId} className={classes.label}>
        <EyeIcon aria-hidden="true" className={classes.icon} />
        <span>{label}</span>
      </p>
      {children}
    </div>
  );
}
