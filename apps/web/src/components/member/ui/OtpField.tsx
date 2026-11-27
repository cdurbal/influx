"use client";

import { useState } from "react";
import { Field } from "./Field";
import { describedByOf, fieldRefsOf, useFieldIds } from "./field-ids";
import {
  OTP_BOXES_CLASSES,
  OTP_OVERLAY_INPUT_CLASSES,
  otpBoxClasses,
  otpLineClasses,
  type OtpBoxState,
} from "./otp-field-classes";
import {
  ariaAttributesOf,
  dataAttributesOf,
  type PassThroughProps,
} from "./pass-through";

/** The number of digits of a code: six (C49). */
const CODE_LENGTH = 6;

export type OtpFieldProps = {
  /** The id of the `input`: the screen focuses it by this id. */
  id?: string;
  name?: string;
  /** The visible label, above the code. */
  label: string;
  /** "required" / "obligatoire", written beside the label; absent for an optional code. */
  requiredLabel?: string;
  /** What to do with the code ("Stay in this tab: the code works only here"), under the label. */
  help?: string;
  /** The refusal, in words, under the code (« This code is wrong. 4 tries left »); the six boxes draw the error. */
  error?: string | null;
  /** The digits typed, and nothing else: at most six. */
  value: string;
  /** Called at each change with the digits the text makes: a paste with spaces or dashes gives its digits only. */
  onChange: (value: string) => void;
  /** Six, the only length of a code. */
  length?: 6;
  /** The six boxes, or a single line for a code that has no boxes. */
  variant?: "boxes" | "line";
  /** The error is drawn without a text (a text of the screen elsewhere). It is also drawn when `error` is given. */
  invalid?: boolean;
  /** A check runs: the code stays in the field and cannot be changed. */
  busy?: boolean;
  /** The tries are used up: nothing can be typed. */
  disabled?: boolean;
  /** The id of a text elsewhere that describes the code, read before the help. */
  describedBy?: string;
  className?: string;
};

/** The digits of a text, in order, whatever its separators; no more than the length of the code. */
function digitsOf(text: string): string {
  return text.replace(/\D/gu, "").slice(0, CODE_LENGTH);
}

/**
 * The code field (C49): ONE `input` (`one-time-code`, a numeric keyboard), so that a screen reader hears one field
 * and the code offered by the system or pasted fills it at once. In the `boxes` variant the six boxes are drawn under
 * the invisible field, the next digit's box shows the ring colour, and an error draws the six in red; in the `line`
 * variant the field itself is shown. It sends nothing: the screen decides what the sixth digit does.
 */
export function OtpField({
  id,
  name,
  label,
  requiredLabel,
  help,
  error,
  value,
  onChange,
  variant = "boxes",
  invalid = false,
  busy = false,
  disabled = false,
  describedBy: extraDescribedBy,
  className,
  ...rest
}: OtpFieldProps & PassThroughProps) {
  const ids = useFieldIds(id);
  const received = ariaAttributesOf(rest);
  const [focused, setFocused] = useState(false);
  const texts = { label, requiredLabel, help, error };
  const refs = fieldRefsOf(texts, ids);
  const describedBy = describedByOf(
    extraDescribedBy,
    refs.help,
    refs.error,
    received["aria-describedby"],
  );
  const hasError = invalid || (error !== undefined && error !== null);
  const digits = digitsOf(value);
  const next = Math.min(digits.length, CODE_LENGTH - 1);
  const stateOf = (index: number): OtpBoxState =>
    hasError
      ? "invalid"
      : disabled
        ? "disabled"
        : focused && index === next
          ? "current"
          : "rest";
  return (
    <Field
      {...dataAttributesOf(rest)}
      {...texts}
      ids={ids}
      kind="single"
      className={className}
    >
      {variant === "line" ? (
        <input
          {...received}
          id={ids.control}
          name={name}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={digits}
          disabled={disabled}
          readOnly={busy}
          aria-busy={busy ? true : undefined}
          aria-invalid={hasError ? true : undefined}
          aria-describedby={describedBy}
          onChange={(event) => onChange(digitsOf(event.target.value))}
          className={otpLineClasses(hasError)}
        />
      ) : (
        <div className={OTP_BOXES_CLASSES}>
          {Array.from({ length: CODE_LENGTH }, (_, index) => (
            <span
              key={index}
              aria-hidden="true"
              data-otp-box={stateOf(index)}
              className={otpBoxClasses(stateOf(index))}
            >
              {digits[index] ?? ""}
            </span>
          ))}
          <input
            {...received}
            id={ids.control}
            name={name}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={digits}
            disabled={disabled}
            readOnly={busy}
            aria-busy={busy ? true : undefined}
            aria-invalid={hasError ? true : undefined}
            aria-describedby={describedBy}
            onChange={(event) => onChange(digitsOf(event.target.value))}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            className={OTP_OVERLAY_INPUT_CLASSES}
          />
        </div>
      )}
    </Field>
  );
}
