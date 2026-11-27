// What every component of the catalogue passes on besides its own properties and `className`
// (docs/mvp/22-refonte-ux-ui/02c, head; RUBT-4).
import type { AriaAttributes } from "react";

/**
 * The common contract: a component takes `id`, `data-*` and `aria-*`, and nothing else (no `style`, no handler, no
 * `dangerouslySetInnerHTML`), and sets them on its root. A field sets `id` and `aria-*` on its control (the
 * `fieldset` of a group of choices carries the `aria-*` of the group) and `data-*` on its root. What the module
 * writes wins: an `aria-*` it manages is its own, written or not, a root it names by `aria-label` takes no other
 * name, and its own `data-*` stay. `aria-describedby` alone adds up: the ids received follow those of the module.
 * `Button` and `PageFrame` also take the attributes of their element, which their own properties type.
 *
 * It stands beside each `<Name>Props` in the signature of the component, never inside it: those stay typed from
 * React and their own classes alone (RU-18).
 */
export type PassThroughProps = AriaAttributes & {
  id?: string;
  [attribute: `data-${string}`]: string | number | boolean | undefined;
};

/** The properties whose name the test keeps. */
function propertiesWhere(
  properties: object,
  keeps: (name: string) => boolean,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(properties).filter(([name]) => keeps(name)),
  );
}

const isData = (name: string) => name.startsWith("data-");
const isAria = (name: string) => name.startsWith("aria-");

/**
 * `id`, `data-*` and `aria-*` among the properties a component has left over, for its root. A filter, not a type
 * alone: what a screen spreads into a component stops here.
 */
export function passThroughOf(properties: object): PassThroughProps {
  return propertiesWhere(
    properties,
    (name) => name === "id" || isData(name) || isAria(name),
  ) as PassThroughProps;
}

/** The `data-*` alone: what the root of a field takes. */
export function dataAttributesOf(properties: object): PassThroughProps {
  return propertiesWhere(properties, isData) as PassThroughProps;
}

/** The `aria-*` alone: what the control of a field takes. */
export function ariaAttributesOf(properties: object): AriaAttributes {
  return propertiesWhere(properties, isAria);
}

/** The properties of a field without their `aria-*`, which go to its control: what the frame is given. */
export function withoutAria<Properties extends object>(
  properties: Properties,
): Properties {
  return propertiesWhere(properties, (name) => !isAria(name)) as Properties;
}
