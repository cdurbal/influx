// The ids a field ties together: its control, its layer badge, its help, its counter and its error,
// for `aria-describedby` (06 RG85: a field in error points to its message).
import { useId } from "react";
import type { FieldIds } from "./FieldFrame";

/**
 * The ids of one field. `id` (stable, given by the screen) is the id of the control, so that the
 * screen can focus the first invalid field by it (RG85); without it, a generated one.
 */
export function useFieldIds(id?: string): FieldIds {
  const generated = useId();
  const control = id ?? generated;
  return {
    control,
    layer: `${control}-layer`,
    help: `${control}-help`,
    error: `${control}-error`,
    warning: `${control}-warning`,
  };
}

/** The ids of the texts a control is described by, in reading order; undefined when none. */
export function describedByOf(
  ...ids: ReadonlyArray<string | false | null | undefined>
): string | undefined {
  const present = ids.filter(
    (id): id is string => typeof id === "string" && id !== "",
  );
  return present.length === 0 ? undefined : present.join(" ");
}
