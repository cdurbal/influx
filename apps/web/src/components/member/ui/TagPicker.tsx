"use client";

import { useEffect, useRef, useState } from "react";
import { CloseIcon } from "@/components/ui/icons";
import { toggleChoice } from "./choice-limits";
import { MEMBER_FIELD_COUNTER_CLASSES } from "./field-classes";
import { describedByOf, useFieldIds } from "./field-ids";
import { Field } from "./Field";
import {
  TAG_CLASSES,
  TAG_LIST_CLASSES,
  TAG_REMOVE_CLASSES,
  TAG_REMOVE_ICON_CLASSES,
  tagPickerSelectClasses,
} from "./tag-picker-classes";
import {
  ariaAttributesOf,
  withoutAria,
  type PassThroughProps,
} from "./pass-through";

export type TagPickerProps = {
  /** Id of the select: the screen focuses the first invalid field by it. */
  id?: string;
  name: string;
  /** The visible label, above the select. */
  label: string;
  /** "required" / "obligatoire", written beside the label; absent for an optional field. */
  requiredLabel?: string;
  /** Who sees this field, and the layer's text. */
  layer?: { layer: "public" | "revealed" | "internal"; label: string };
  /** The message of the field in error; the select carries `aria-invalid`. */
  error?: string | null;
  warnings?: readonly string[];
  /** The long list (countries, 249): every option, in the language of the page. */
  options: readonly { code: string; label: string }[];
  value: readonly string[];
  onChange: (codes: string[]) => void;
  /** The cap of the list (06 RG15, RG27: 5 markets, 5 countries), also held by the database. */
  max: number;
  /** The cap, said before any choice. */
  limitText: string;
  countText: string;
  limitReachedText: string;
  /** The first option of the select: "Add a country…". */
  addLabel: string;
  /** The name of the chosen list for a screen reader: "Chosen countries". */
  listLabel: string;
  /** The accessible name of the button that removes one choice: "Remove France". */
  removeLabel: (label: string) => string;
  /** What is said when a tag is removed: "France removed"; nothing is said when absent. */
  removedText?: (label: string) => string;
  disabled?: boolean;
  className?: string;
};

/**
 * A capped choice among a list too long for boxes (C23): a select adds, a tag with a cross removes. The select
 * keeps the focus after a choice (the keyboard adds again); after a removal the focus goes to the cross of the tag
 * that follows, else to the select, and the removal is said in the status line of the count. A choice over the cap
 * is refused, never replaced, and the cap is told before and after (RG85).
 */
export function TagPicker({
  id,
  name,
  options,
  value,
  onChange,
  max,
  limitText,
  countText,
  limitReachedText,
  addLabel,
  listLabel,
  removeLabel,
  removedText,
  disabled,
  className,
  ...texts
}: TagPickerProps & PassThroughProps) {
  const ids = useFieldIds(id);
  const received = ariaAttributesOf(texts);
  const countId = `${ids.control}-count`;
  const statusId = `${ids.control}-status`;
  const hasError = texts.error !== undefined && texts.error !== null;
  const atCap = value.length >= max;
  const labelOf = new Map(options.map((option) => [option.code, option.label]));
  const select = useRef<HTMLSelectElement>(null);
  const crosses = useRef(new Map<string, HTMLButtonElement>());
  // Where the focus goes once the removal is drawn: the cross of this code, or the select (`null`).
  const focusAfter = useRef<{ code: string | null } | null>(null);
  const [removed, setRemoved] = useState<string | null>(null);
  useEffect(() => {
    const target = focusAfter.current;
    if (target === null) {
      return;
    }
    focusAfter.current = null;
    const cross =
      target.code === null ? undefined : crosses.current.get(target.code);
    (cross ?? select.current)?.focus();
  }, [value]);
  const status = atCap ? limitReachedText : (removed ?? null);
  const describedBy = describedByOf(
    texts.layer && ids.layer,
    ids.help,
    countId,
    status !== null && statusId,
    hasError && ids.error,
    received["aria-describedby"],
  );
  // At the cap nothing more is offered: the status below says why.
  const available = atCap
    ? []
    : options.filter((option) => !value.includes(option.code));
  return (
    <Field
      {...withoutAria(texts)}
      help={limitText}
      ids={ids}
      kind="single"
      className={className}
    >
      <select
        {...received}
        ref={select}
        id={ids.control}
        name={name}
        value=""
        disabled={disabled}
        aria-invalid={hasError ? true : undefined}
        aria-describedby={describedBy}
        onChange={(event) => {
          if (event.target.value !== "") {
            setRemoved(null);
            onChange(toggleChoice(value, event.target.value, max));
          }
        }}
        className={tagPickerSelectClasses(hasError)}
      >
        <option value="">{addLabel}</option>
        {available.map((option) => (
          <option key={option.code} value={option.code}>
            {option.label}
          </option>
        ))}
      </select>
      {value.length === 0 ? null : (
        <ul aria-label={listLabel} className={TAG_LIST_CLASSES}>
          {value.map((code, index) => {
            const label = labelOf.get(code) ?? code;
            return (
              <li key={code} className={TAG_CLASSES}>
                {label}
                <button
                  type="button"
                  disabled={disabled}
                  aria-label={removeLabel(label)}
                  ref={(element) => {
                    if (element === null) {
                      crosses.current.delete(code);
                    } else {
                      crosses.current.set(code, element);
                    }
                  }}
                  onClick={() => {
                    setRemoved(
                      removedText === undefined ? null : removedText(label),
                    );
                    focusAfter.current = { code: value[index + 1] ?? null };
                    onChange(value.filter((chosen) => chosen !== code));
                  }}
                  className={TAG_REMOVE_CLASSES}
                >
                  <CloseIcon
                    aria-hidden="true"
                    className={TAG_REMOVE_ICON_CLASSES}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p id={countId} className={MEMBER_FIELD_COUNTER_CLASSES}>
        {countText}
      </p>
      <p id={statusId} role="status" className={MEMBER_FIELD_COUNTER_CLASSES}>
        {status}
      </p>
    </Field>
  );
}
