import type { ReactNode } from "react";
import { cn } from "@/components/ui/class-names";
import { CheckIcon } from "@/components/ui/icons";
import {
  NUMBERED_BODY_CLASSES,
  NUMBERED_CHECK_CLASSES,
  NUMBERED_STEPS_CLASSES,
  NUMBERED_TEXT_CLASSES,
  numberedMarkerClasses,
  numberedStepClasses,
  type NumberedStepState,
} from "./numbered-steps-classes";
import { passThroughOf, type PassThroughProps } from "./pass-through";

/** One step: its label, what it adds under it, and where the member stands. */
type NumberedStepItem = {
  label: string;
  body?: ReactNode;
  /** To do when absent. */
  state?: NumberedStepState;
};

export type NumberedStepsProps = {
  items: readonly NumberedStepItem[];
  /** The name of the list: « Steps to change the address ». */
  label?: string;
  /** What a screen reader hears before each step, by state ("Done: ", "Current: ", "To do: "), already translated. */
  stateLabels?: { todo: string; current: string; done: string };
  className?: string;
};

/**
 * The numbered steps (C51): the steps of a short process seen at once, never a form. A done step shows a check
 * (a shape, not only the teal), the current one is in 600 on a lit marker and says `aria-current="step"`, a step
 * to do shows its number. The state is written before the label for a screen reader, in the words of the screen.
 */
export function NumberedSteps({
  items,
  label,
  stateLabels,
  className,
  ...rest
}: NumberedStepsProps & PassThroughProps) {
  const received = passThroughOf(rest);
  return (
    <ol
      {...received}
      // the list has a name of its own only when it is given one
      aria-labelledby={
        label === undefined ? received["aria-labelledby"] : undefined
      }
      aria-label={label ?? received["aria-label"]}
      className={cn(NUMBERED_STEPS_CLASSES, className)}
    >
      {items.map((item, index) => {
        const state = item.state ?? "todo";
        return (
          <li
            key={`${index}:${item.label}`}
            aria-current={state === "current" ? "step" : undefined}
            data-step-state={state}
            className={numberedStepClasses(state)}
          >
            <span aria-hidden="true" className={numberedMarkerClasses(state)}>
              {state === "done" ? (
                <CheckIcon className={NUMBERED_CHECK_CLASSES} />
              ) : (
                index + 1
              )}
            </span>
            <span className={NUMBERED_TEXT_CLASSES}>
              <span>
                {stateLabels === undefined ? null : (
                  <span className="sr-only">{stateLabels[state]}</span>
                )}
                {item.label}
              </span>
              {item.body === undefined ? null : (
                <span className={NUMBERED_BODY_CLASSES}>{item.body}</span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
