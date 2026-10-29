// The spaces of the members (D73; 02 §21.5): the homes, "mon compte" and, lot by lot, the screens
// of Lots 2 to 5, inside one shell (src/components/member/MemberShell.tsx) mounted here once, so
// that the navigation stays in place across the pages and reads the session at each of them. The
// journey (sign-in, sign-up) lives beside this group, without navigation (20 §11.8).
import type { Viewport } from "next";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { SpaceMessages } from "@/components/auth/AuthPage";
import { MemberShell } from "@/components/member/MemberShell";
import { routing } from "@/i18n/routing";

/**
 * 17 §2.2: the page reaches the edges of the screen, so that env(safe-area-inset-bottom) gives the
 * bottom bar the height of the iOS gesture zone (globals.css); without it the zone hides the labels.
 */
export const viewport: Viewport = { viewportFit: "cover" };

export default async function SpaceLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);
  return (
    <SpaceMessages locale={locale}>
      <MemberShell>{children}</MemberShell>
    </SpaceMessages>
  );
}
