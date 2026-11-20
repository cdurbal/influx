// The permanent way to « Mes sélections » on a phone (docs/mvp/17 §4.4; D74; jalons/l3f, fix-1, L3FU-3): below lg the
// sub-menu of « Créateurs » is hidden and the page-menu opens the search, so the second page of the rubric has no
// entry but the bar « Ma sélection » once opened (and none when the search is closed). The link sits under the title of
// the search and of the profile, in every state; from lg the sub-menu shows it and this link is not drawn.
import { useLocale, useTranslations } from "next-intl";
import { TEXT_LINK_CLASSES } from "@/components/auth/auth-classes";
import { cn } from "@/components/ui/class-names";
import { Link } from "@/i18n/navigation";
import { memberPageHref } from "@/lib/member-paths";

export function ShortlistsLink() {
  const t = useTranslations("creatorSearch");
  const locale = useLocale();
  return (
    <Link
      href={memberPageHref("advertiserShortlists", locale)}
      data-shortlists-link=""
      className={cn(TEXT_LINK_CLASSES, "lg:hidden")}
    >
      {t("panel.all")}
    </Link>
  );
}
