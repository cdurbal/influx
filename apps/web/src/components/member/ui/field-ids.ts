// The ids a field ties together: its control, its layer badge, its help, its unit, its counter, its warnings
// and its error, for `aria-describedby` (06 RG85: a field in error points to its message).
import { useId } from "react";
import type { FieldIds, FieldLayout, FieldTexts } from "./Field";

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
    counter: `${control}-counter`,
    suffix: `${control}-suffix`,
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

/** The ids of the texts of a field that are written, each `false` when the field does not draw it. */
export type FieldRefs = {
  layer: string | false;
  help: string | false;
  suffix: string | false;
  counter: string | false;
  warning: string | false;
  error: string | false;
};

/**
 * What a field writes, as the ids a control is described by: the layer when its badge is drawn, the help,
 * the unit, the count, the warnings and the error. A control orders them as it reads them, and adds its own.
 */
export function fieldRefsOf(
  texts: FieldTexts & FieldLayout,
  ids: FieldIds,
): FieldRefs {
  const hasError = texts.error !== undefined && texts.error !== null;
  return {
    layer: texts.layer !== undefined && texts.layerShown !== false && ids.layer,
    help: texts.help !== undefined && ids.help,
    suffix: texts.suffix !== undefined && ids.suffix,
    counter: texts.counter !== undefined && ids.counter,
    warning: (texts.warnings?.length ?? 0) > 0 && ids.warning,
    error: hasError && ids.error,
  };
}
