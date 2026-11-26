"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/components/ui/class-names";
import { ChevronLeftIcon } from "@/components/ui/icons";
import { ActionLink } from "./ActionLink";
import { Button } from "./Button";
import { SaveStatus, type SaveStatusProps } from "./SaveStatus";
import {
  WIZARD_BACK_CLASSES,
  WIZARD_BACK_LABEL_CLASSES,
  WIZARD_CLASSES,
  WIZARD_COUNT_CLASSES,
  WIZARD_FOOT_CLASSES,
  WIZARD_HEAD_CLASSES,
  WIZARD_INTRO_CLASSES,
  WIZARD_META_ACTIONS_CLASSES,
  WIZARD_META_CLASSES,
  WIZARD_NEXT_CLASSES,
  WIZARD_SAVE_FOOT_CLASSES,
  WIZARD_SAVE_META_CLASSES,
  WIZARD_SEGMENTS_CLASSES,
  WIZARD_STEP_CLASSES,
  WIZARD_STEP_HEAD_CLASSES,
  WIZARD_STEP_TITLE_CLASSES,
  WIZARD_TITLE_CLASSES,
  WIZARD_TOP_CLASSES,
  wizardSegmentClasses,
  type WizardStepState,
} from "./wizard-classes";

/** One step of the wizard: where it goes, its name for a screen reader and the state its segment shows. */
type WizardStep = {
  id: string;
  /** The whole name, composed by the screen: « Step 2 of 5: Your editorial line, current » (RUB-B §2). */
  label: string;
  state: WizardStepState;
  /** The address of the step: every segment is a link, whatever its state (free navigation, RU-32). */
  href: string;
};

export type WizardProps = {
  /** The `h1` of the wizard, 20 px; it takes the focus from the screen when a page opens. */
  title: string;
  /** The count, already written: « Step 2 of 5 ». */
  progress: string;
  /** The name of the list of the segments: « Steps ». */
  stepsLabel: string;
  steps: readonly WizardStep[];
  /** The time left, already written: « About 12 min in all ». */
  remaining?: string;
  /** « Save and resume later »: a link, in the line of meta. */
  leave: { href: string; label: string };
  /** The state of the automatic save (C25): at the centre of the foot from 768 px, in the line of meta under. */
  save: SaveStatusProps;
  /** The `h2` of the current step; the focus goes to it when it changes. */
  name: string;
  /** The sentence under the `h2`. */
  intro?: ReactNode;
  /** The layer badge of the step, under its introduction. */
  badge?: ReactNode;
  /** « Previous »: absent on the first step. Under 480 px it is the chevron alone, its name kept for the screen reader. */
  back?: { label: string; onClick?: () => void; href?: string };
  /** « Continue: <step> »: never unavailable but while its request runs. */
  next: { label: string; onClick: () => void; busy?: boolean };
  /** The place of a notice of the screen (C17): a version conflict, a read-only account. It holds no logic. */
  notice?: ReactNode;
  /** The fields of the step. */
  children?: ReactNode;
  className?: string;
};

/**
 * The wizard (C41): a box of 768 px, its head (title, count, segments, meta), one step, and its foot. It never
 * blocks: « Continue » only asks, the screen decides what is missing. The segments are the links of the steps,
 * followed by `Tab` and `Enter`, the current one `aria-current="step"`. When the name of the step changes the focus
 * goes to its `h2`, which draws no ring. The step comes in by `fade-in`. It reads no address, no width and no session.
 */
export function Wizard({
  title,
  progress,
  stepsLabel,
  steps,
  remaining,
  leave,
  save,
  name,
  intro,
  badge,
  back,
  next,
  notice,
  children,
  className,
}: WizardProps) {
  const headingId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const shown = useRef(name);
  // The focus follows a change of step, never the first rendering (the screen places the focus of a page).
  useEffect(() => {
    if (shown.current !== name) {
      shown.current = name;
      heading.current?.focus({ preventScroll: true });
    }
  }, [name]);
  return (
    <div data-wizard="" className={cn(WIZARD_CLASSES, className)}>
      <div className={WIZARD_HEAD_CLASSES}>
        <div className={WIZARD_TOP_CLASSES}>
          <h1 className={WIZARD_TITLE_CLASSES}>{title}</h1>
          <span className={WIZARD_COUNT_CLASSES}>{progress}</span>
        </div>
        <ol aria-label={stepsLabel} className={WIZARD_SEGMENTS_CLASSES}>
          {steps.map((step) => (
            <li key={step.id}>
              <a
                href={step.href}
                aria-current={step.state === "current" ? "step" : undefined}
                data-step-state={step.state}
                className={wizardSegmentClasses(step.state)}
              >
                <span className="sr-only">{step.label}</span>
              </a>
            </li>
          ))}
        </ol>
        <div className={WIZARD_META_CLASSES}>
          {remaining === undefined ? <span /> : <span>{remaining}</span>}
          <span className={WIZARD_META_ACTIONS_CLASSES}>
            <SaveStatus
              {...save}
              placement="meta"
              className={WIZARD_SAVE_META_CLASSES}
            />
            <ActionLink href={leave.href} dense>
              {leave.label}
            </ActionLink>
          </span>
        </div>
        {notice}
      </div>
      <section
        key={name}
        aria-labelledby={headingId}
        className={WIZARD_STEP_CLASSES}
      >
        <header className={WIZARD_STEP_HEAD_CLASSES}>
          <h2
            ref={heading}
            id={headingId}
            tabIndex={-1}
            className={WIZARD_STEP_TITLE_CLASSES}
          >
            {name}
          </h2>
          {intro === undefined ? null : (
            <p className={WIZARD_INTRO_CLASSES}>{intro}</p>
          )}
        </header>
        {badge}
        {children}
      </section>
      <div className={WIZARD_FOOT_CLASSES}>
        {back === undefined ? null : back.href === undefined ? (
          <Button
            variant="text"
            icon={<ChevronLeftIcon className="size-(--size-icon-sm)" />}
            onClick={back.onClick}
            className={WIZARD_BACK_CLASSES}
          >
            <span className={WIZARD_BACK_LABEL_CLASSES}>{back.label}</span>
          </Button>
        ) : (
          <Button
            variant="text"
            href={back.href}
            icon={<ChevronLeftIcon className="size-(--size-icon-sm)" />}
            onClick={back.onClick}
            className={WIZARD_BACK_CLASSES}
          >
            <span className={WIZARD_BACK_LABEL_CLASSES}>{back.label}</span>
          </Button>
        )}
        <SaveStatus
          {...save}
          placement="foot"
          className={WIZARD_SAVE_FOOT_CLASSES}
        />
        <Button
          onClick={next.onClick}
          busy={next.busy}
          className={WIZARD_NEXT_CLASSES}
        >
          {next.label}
        </Button>
      </div>
    </div>
  );
}
