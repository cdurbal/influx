import type { ReactNode } from "react";
import { cn } from "@/components/ui/class-names";
import {
  BRAND_HERO_CLASSES,
  BRAND_HERO_IDENTITY_CLASSES,
  BRAND_HERO_LOGO_CLASSES,
  BRAND_HERO_META_CLASSES,
  BRAND_HERO_TITLE_CLASSES,
} from "./brand-hero-classes";
import { LogoPlate } from "./LogoPlate";
import { passThroughOf, type PassThroughProps } from "./pass-through";

export type BrandHeroProps = {
  /** The public name of the brand: the `h1` of its page. */
  name: string;
  /** The logo served for the brand; absent, the plate shows the initials of the name. */
  logo?: string;
  /** The complete badge of the brand, already built, with its words. */
  badge?: ReactNode;
  /** The sector and the country, already written. */
  meta: ReactNode;
  className?: string;
};

/**
 * The head of the page of a brand (C68): its logo on a plate and its identity, in place of a gallery. The title takes
 * the focus the screen gives it at navigation (`tabIndex={-1}`).
 */
export function BrandHero({
  name,
  logo,
  badge,
  meta,
  className,
  ...rest
}: BrandHeroProps & PassThroughProps) {
  return (
    <header
      {...passThroughOf(rest)}
      data-brand-hero=""
      className={cn(BRAND_HERO_CLASSES, className)}
    >
      <LogoPlate
        src={logo}
        name={name}
        size={120}
        shape="plate"
        className={BRAND_HERO_LOGO_CLASSES}
      />
      <div className={BRAND_HERO_IDENTITY_CLASSES}>
        <h1 tabIndex={-1} className={BRAND_HERO_TITLE_CLASSES}>
          {name}
        </h1>
        <div className={BRAND_HERO_META_CLASSES}>
          {badge}
          <span>{meta}</span>
        </div>
      </div>
    </header>
  );
}
