// The KEO boundary of apps/web (D73; 02 §21.2 to §21.5): the member pages (sign-in, sign-up, the
// homes, "mon compte", the screens of Lots 2 to 5) render inside this container, which carries
// data-theme="keo" and the classes of the self-hosted fonts. It is the one place of apps/web that
// sets the attribute and imports fonts.ts (G8): the landing and the public legal pages, outside
// this group, keep the vitrine and never preload a font. <html> and <body> stay the vitrine's.
// The groups change no URL: the localized paths of member-paths.ts are untouched.
import type { ReactNode } from "react";
import { FONT_VARIABLE_CLASSES } from "@/styles/fonts";

export default function MemberLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <div
      data-theme="keo"
      className={`${FONT_VARIABLE_CLASSES} min-h-dvh bg-surface-page font-base text-text-primary`}
    >
      {children}
    </div>
  );
}
