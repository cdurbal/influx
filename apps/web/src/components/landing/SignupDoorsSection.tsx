import { getTranslations } from "next-intl/server";
import { AudienceDoors } from "@/components/ui/AudienceDoors";
import { CheckIcon } from "@/components/ui/icons";
import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import { mutedTitleTags } from "@/components/ui/rich-text";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { landingPhoto } from "@/content/landing-images";

const REASSURANCE_IDS = ["free", "progressive", "noPayment"] as const;

/**
 * Last section (02 §3.17, §3.18): the mockup sign-up form became a pointer to the two doors, which
 * lead to the real sign-up pages (EC-15, J9 commit 5). It absorbs the final call to action of
 * section 15, which only repeated the same doors.
 */
export async function SignupDoorsSection() {
  const t = await getTranslations("landing.signupDoors");

  return (
    <section aria-labelledby="signup-doors-title" className="bg-surface-page">
      <div className="mx-auto grid max-w-(--container-max) grid-cols-1 gap-8 px-page-gutter py-section-block lg:grid-cols-12 lg:items-center lg:gap-grid-gap">
        <div className="flex flex-col gap-6 lg:col-span-6">
          <SectionHeader
            titleId="signup-doors-title"
            overline={t("overline")}
            title={t.rich("title", mutedTitleTags)}
            lead={t("lead")}
          />
          <AudienceDoors idPrefix="signup-doors" />
          <ul className="flex flex-col gap-3">
            {REASSURANCE_IDS.map((id) => (
              <li
                key={id}
                className="flex items-start gap-2 text-md text-text-primary"
              >
                <CheckIcon
                  aria-hidden="true"
                  className="mt-1 size-(--size-icon-md) shrink-0 text-text-brand"
                />
                {t(`reassurance.${id}`)}
              </li>
            ))}
          </ul>
        </div>
        <ResponsiveImage
          image={landingPhoto("form01")}
          sizes="sideDecoration"
          className="hidden aspect-3/2 w-full rounded-lg lg:col-span-5 lg:col-start-8 lg:block"
        />
      </div>
    </section>
  );
}
