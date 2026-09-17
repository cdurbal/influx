import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { AuthHeader } from "@/components/auth/AuthHeader";
import { BriefcaseIcon, CameraIcon } from "@/components/ui/icons";
import { LinkButton } from "@/components/ui/LinkButton";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { routing } from "@/i18n/routing";

type DoorId = "advertiser" | "creator";

const DOORS: readonly { id: DoorId; href: "/signup/advertiser" | "/signup/creator" }[] = [
  { id: "advertiser", href: "/signup/advertiser" },
  { id: "creator", href: "/signup/creator" },
];

const DOOR_ICONS: Record<DoorId, typeof BriefcaseIcon> = {
  advertiser: BriefcaseIcon,
  creator: CameraIcon,
};

/**
 * Account type chooser (docs/landing-page/00-cadrage.md §6): the Malt-style fork between the
 * advertiser and creator sign-up, reached from "Créer mon compte" in the header and from the
 * two doors on the landing page.
 */
export default async function SignUpChooserPage({
  params,
}: PageProps<"/[locale]/signup">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);
  const t = await getTranslations("landing.auth");

  return (
    <>
      <AuthHeader />
      <main id="main" className="bg-surface-page">
        <div className="mx-auto flex max-w-(--container-narrow) flex-col gap-8 px-page-gutter py-section-block">
          <SectionHeader
            titleId="signup-chooser-title"
            overline={t("chooser.overline")}
            title={t("chooser.title")}
            lead={t("chooser.lead")}
          />
          <div className="grid grid-cols-1 gap-grid-gap sm:grid-cols-2">
            {DOORS.map((door) => {
              const Icon = DOOR_ICONS[door.id];
              return (
                <div
                  key={door.id}
                  className="flex flex-col gap-4 rounded-lg border-(length:--border-width-thin) border-border-strong bg-surface-raised p-inset-card shadow-md"
                >
                  <Icon
                    aria-hidden="true"
                    className="size-(--size-icon-lg) shrink-0 text-text-brand"
                  />
                  <h2 className="text-heading-3 font-semibold text-text-primary">
                    {t(`chooser.${door.id}.title`)}
                  </h2>
                  <p className="flex-1 text-md text-text-secondary">
                    {t(`chooser.${door.id}.description`)}
                  </p>
                  <LinkButton href={door.href} variant="primary" fullWidth>
                    {t(`chooser.${door.id}.cta`)}
                  </LinkButton>
                </div>
              );
            })}
          </div>
          <p className="flex flex-wrap items-center gap-2 text-md text-text-secondary">
            {t("chooser.loginPrompt")}
            <LinkButton href="/login" variant="text">
              {t("chooser.loginCta")}
            </LinkButton>
          </p>
        </div>
      </main>
    </>
  );
}
