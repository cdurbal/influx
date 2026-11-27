import { cn } from "@/components/ui/class-names";
import { CHIP_CLASSES, CHIP_LIST_CLASSES } from "./chip-list-classes";
import { passThroughOf, type PassThroughProps } from "./pass-through";

export type ChipListProps = {
  /** What each chip says, already translated: a topic, a tone, a format, a country, a language. */
  items: string[];
  /** The name of the list, already translated ("Topics"): a list of chips is read as a list of something. */
  label: string;
  className?: string;
};

/**
 * A list of words as chips (C38): the topics, the tones and the formats of an offer. Not interactive: no
 * focus, no hover, no role of a control. Nothing is drawn for an empty list, the screen says why.
 */
export function ChipList({
  items,
  label,
  className,
  ...rest
}: ChipListProps & PassThroughProps) {
  if (items.length === 0) return null;
  return (
    <ul
      {...passThroughOf(rest)}
      aria-labelledby={undefined}
      aria-label={label}
      className={cn(CHIP_LIST_CLASSES, className)}
    >
      {items.map((item, index) => (
        <li key={`${index}:${item}`} className={CHIP_CLASSES}>
          {item}
        </li>
      ))}
    </ul>
  );
}
