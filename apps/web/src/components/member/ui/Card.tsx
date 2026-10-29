import type { ReactNode } from "react";
import { cn } from "@/components/ui/class-names";
import { MEMBER_CARD_CLASSES } from "./card-classes";

type CardProps = {
  className?: string;
  children?: ReactNode;
};

/** A flat card: surface, hairline, 16 px corners (20 §11.8). No shadow at rest. */
export function Card({ className, children }: CardProps) {
  return <div className={cn(MEMBER_CARD_CLASSES, className)}>{children}</div>;
}
