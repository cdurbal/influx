"use client";

// The pieces the sections of the "Santé technique" screen share (docs/mvp/02 §20.5; 17b §2; skills
// backoffice-ops and design-system-influx): the frame of a section, its states (loading, error,
// refused), the text of a state with its symbol — the colour only reinforces a word, it never
// carries the information alone — and the small curve. Every value is a token.
import { useId, type ReactNode } from "react";
import { messages } from "@/messages/fr";
import { HELP_CLASSES } from "./auth-classes";
import {
  SECTION_CLASSES,
  SECTION_TITLE_CLASSES,
  SMALL_SECONDARY_CLASSES,
} from "./bo-classes";
import { curveSegments } from "./ops-view-model";
import type { OpsLoad } from "./use-ops-read";
import { ErrorNotice } from "./ErrorNotice";

const t = messages.health;

/** A section with its title and its lead; its content decides its own states. */
export function SectionFrame({
  title,
  lead,
  children,
}: {
  title: string;
  lead?: string;
  children: ReactNode;
}) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className={SECTION_CLASSES}>
      <h2 id={titleId} className={SECTION_TITLE_CLASSES}>
        {title}
      </h2>
      {lead === undefined ? null : <p className={HELP_CLASSES}>{lead}</p>}
      {children}
    </section>
  );
}

/** Loading, refused and failed in words; the content once the answer is there. */
export function LoadGate<T>({
  load,
  retry,
  children,
}: {
  load: OpsLoad<T>;
  retry: () => void;
  children: (data: T) => ReactNode;
}) {
  switch (load.kind) {
    case "loading":
      return (
        <p role="status" className={HELP_CLASSES}>
          {t.loading}
        </p>
      );
    case "forbidden":
      return <ErrorNotice>{t.forbidden}</ErrorNotice>;
    case "error":
      return (
        <div className="flex flex-col items-start gap-3">
          <ErrorNotice>{t.unavailable}</ErrorNotice>
          <button
            type="button"
            onClick={retry}
            className={SMALL_SECONDARY_CLASSES}
          >
            {t.retry}
          </button>
        </div>
      );
    default:
      return <>{children(load.data)}</>;
  }
}

export type Tone = "ok" | "bad" | "warn" | "neutral";

const TONE_SYMBOL: Readonly<Record<Tone, string>> = {
  ok: "✓",
  bad: "✕",
  warn: "!",
  neutral: "–",
};

const TONE_CLASSES: Readonly<Record<Tone, string>> = {
  ok: "text-feedback-success-text",
  bad: "text-feedback-error-text",
  warn: "text-feedback-warning-text",
  neutral: "text-text-secondary",
};

/** A state in words, with a symbol (hidden from readers) and a colour that only reinforces them. */
export function StateText({
  tone,
  children,
}: {
  tone: Tone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-baseline gap-1 font-semibold ${TONE_CLASSES[tone]}`}
    >
      <span aria-hidden="true">{TONE_SYMBOL[tone]}</span>
      <span>{children}</span>
    </span>
  );
}

const CURVE_WIDTH = 100;
const CURVE_HEIGHT = 32;

/**
 * A curve of one value per bucket of time: a gap where nothing was measured (never a false zero).
 * The label says the last point and the maximum, so that the figure is not only a picture; the
 * table next to it gives the numbers.
 */
export function Curve({
  values,
  label,
  large = false,
  ceiling,
}: {
  values: readonly (number | null)[];
  label: string;
  large?: boolean;
  ceiling?: number;
}) {
  const segments = curveSegments(values, CURVE_WIDTH, CURVE_HEIGHT, ceiling);
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${CURVE_WIDTH} ${CURVE_HEIGHT}`}
      preserveAspectRatio="none"
      className={`${large ? "h-9 w-12" : "h-6 w-10"} shrink-0 rounded-sm bg-surface-page`}
    >
      {segments.map((points, index) => (
        <polyline
          key={`${index}-${points}`}
          points={points}
          fill="none"
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
          strokeLinecap="round"
          className="stroke-text-primary stroke-2"
        />
      ))}
    </svg>
  );
}
