import type { ReactNode } from "react";
import { memberControlClasses } from "./field-classes";
import { describedByOf, fieldRefsOf, useFieldIds } from "./field-ids";
import { Field, type FieldLayout, type FieldTexts } from "./Field";

type DomainFieldProps = FieldTexts &
  FieldLayout & {
    id?: string;
    name: string;
    /** As typed: the API keeps the domain only and says so (06 RG17, CA4). */
    value: string;
    onChange: (value: string) => void;
    /** The longest input accepted before the reduction to a domain. */
    maxLength: number;
    placeholder?: string;
    /** What follows the field, e.g. the notice "we kept the domain …" (`brandProfile.website.normalized`). */
    notice?: ReactNode;
    disabled?: boolean;
    className?: string;
  };

/**
 * A website domain field (06 RG17): one line, no auto-capitalisation, correction or suggestion, the
 * keyboard of a web address on a phone. It only types; the reduction to a domain is the API's.
 */
export function DomainField({
  id,
  name,
  value,
  onChange,
  maxLength,
  placeholder,
  notice,
  disabled,
  className,
  ...texts
}: DomainFieldProps) {
  const ids = useFieldIds(id);
  const noticeId = `${ids.control}-notice`;
  const hasError = texts.error !== undefined && texts.error !== null;
  const hasNotice = notice !== undefined && notice !== null;
  const refs = fieldRefsOf(texts, ids);
  const describedBy = describedByOf(
    refs.layer,
    refs.help,
    refs.suffix,
    refs.counter,
    hasNotice && noticeId,
    refs.warning,
    refs.error,
  );
  return (
    <Field {...texts} ids={ids} kind="single" className={className}>
      <input
        id={ids.control}
        name={name}
        type="text"
        inputMode="url"
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        maxLength={maxLength}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        aria-invalid={hasError ? true : undefined}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.value)}
        className={memberControlClasses(hasError)}
      />
      {hasNotice ? <div id={noticeId}>{notice}</div> : null}
    </Field>
  );
}
