// Classes of the date field (C47; docs/mvp/22-refonte-ux-ui/02b C47): the control of a text field, 12 rem wide at
// most (a date has ten characters, never the full line), the outline and the error of C18 unchanged.
import { cn } from "@/components/ui/class-names";
import { memberControlClasses } from "./field-classes";

/** The control: the outline of a field (2 px and the same height in error) in a width of `size-date`. */
export function dateFieldControlClasses(hasError: boolean): string {
  return cn(memberControlClasses(hasError), "max-w-(--size-date)");
}
