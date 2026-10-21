import { getLocale, getTranslations } from "next-intl/server";
import {
  ClockIcon,
  FileQuestionIcon,
  LockIcon,
  RepeatIcon,
} from "@/components/ui/icons";
import { LinkButton } from "@/components/ui/LinkButton";
import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import { mutedTitleTags } from "@/components/ui/rich-text";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { landingPhoto } from "@/content/landing-images";
import { memberPageHref } from "@/lib/member-paths";

const PAIN_POINTS = [
  { id: "search", Icon: ClockIcon },
  { id: "followUp", Icon: RepeatIcon },
  { id: "contract", Icon: FileQuestionIcon },
] as const;

/**
 * Section 7 (02 §3.9): the prospecting pain, the three-way INFLUX conversation in one sentence,
 * then the brand door, beside the section photo. The mock conversation was fictitious content:
 * it left with the module (J9 commit 5, 01 §6.1).
 */
export async function ProblemSection() {
  const t = await getTranslations("landing");
  const locale = await getLocale();

  return (
    <section aria-labelledby="problem-title" className="bg-surface-page">
      <div className="mx-auto grid max-w-(--container-max) grid-cols-1 gap-8 px-page-gutter py-section-block lg:grid-cols-12 lg:gap-grid-gap">
        <div className="flex flex-col gap-section-header lg:col-span-5 lg:row-start-1">
          <SectionHeader
            titleId="problem-title"
            overline={t("problem.overline")}
            title={t.rich("problem.title", mutedTitleTags)}
            lead={t("problem.lead")}
          />
          <ul className="flex flex-col gap-4">
            {PAIN_POINTS.map(({ id, Icon }) => (
              <li
                key={id}
                className="flex items-start gap-3 text-md text-text-primary"
              >
                <Icon
                  aria-hidden="true"
                  className="mt-1 size-(--size-icon-md) shrink-0 text-text-brand"
                />
                {t(`problem.painPoints.${id}`)}
              </li>
            ))}
          </ul>
          <p className="flex items-start gap-3 text-md text-text-secondary">
            <LockIcon
              aria-hidden="true"
              className="mt-1 size-(--size-icon-md) shrink-0"
            />
            {t("problem.privacyNote")}
          </p>
        </div>

        <div className="lg:col-span-7 lg:col-start-6 lg:row-span-2 lg:row-start-1">
          <ResponsiveImage
            image={landingPhoto("problem01")}
            sizes="sideDecoration"
            className="hidden aspect-4/5 w-9/12 rounded-lg lg:ml-auto lg:block"
          />
        </div>

        <div className="lg:col-span-5 lg:row-start-2 lg:self-start">
          <LinkButton
            href={memberPageHref("signupAdvertiser", locale)}
            variant="primary"
            className="w-full sm:w-auto"
          >
            {t("common.cta.advertiser")}
          </LinkButton>
        </div>
      </div>
    </section>
  );
}
