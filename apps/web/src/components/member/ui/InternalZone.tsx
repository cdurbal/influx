import { useId, type ReactNode } from "react";
import { cn } from "@/components/ui/class-names";
import { EyeOffIcon } from "@/components/ui/icons";
import {
  INTERNAL_ZONE_CLASSES,
  INTERNAL_ZONE_ICON_CLASSES,
  INTERNAL_ZONE_TITLE_CLASSES,
} from "./internal-zone-classes";
import { passThroughOf, type PassThroughProps } from "./pass-through";

export type InternalZoneProps = {
  /** What the zone is, already translated: "Visible by INFLUX only". */
  title: string;
  id?: string;
  className?: string;
  children?: ReactNode;
};

/**
 * The zone of what only INFLUX sees (C24, U30): a dashed frame, a title with a crossed eye, and the fields it
 * holds. A group named by its title: the headings of the page stay with C01 to C03.
 */
export function InternalZone({
  title,
  id,
  className,
  children,
  ...rest
}: InternalZoneProps & PassThroughProps) {
  const titleId = useId();
  return (
    <div
      {...passThroughOf(rest)}
      id={id}
      role="group"
      aria-labelledby={titleId}
      className={cn(INTERNAL_ZONE_CLASSES, className)}
    >
      <p id={titleId} className={INTERNAL_ZONE_TITLE_CLASSES}>
        <EyeOffIcon aria-hidden="true" className={INTERNAL_ZONE_ICON_CLASSES} />
        {title}
      </p>
      {children}
    </div>
  );
}
