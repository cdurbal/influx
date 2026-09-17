import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/class-names";
import {
  ClockIcon,
  FileCheckIcon,
  FileQuestionIcon,
  LockIcon,
  RepeatIcon,
} from "@/components/ui/icons";
import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import { mutedTitleTags } from "@/components/ui/rich-text";
import { SectionHeader } from "@/components/ui/SectionHeader";
import type { ProblemContent } from "@/content/landing-content";

type ProblemSectionProps = {
  content: ProblemContent;
};

const PAIN_POINTS = [
  { id: "search", Icon: ClockIcon },
  { id: "followUp", Icon: RepeatIcon },
  { id: "contract", Icon: FileQuestionIcon },
] as const;

/**
 * Section 7 (02 §3.9): the prospecting pain, then an HTML/CSS mock of INFLUX messaging. Roles
 * instead of names, no contact details (CA18). The author is carried by the written role and the
 * alignment; bubble colors only double it.
 */
export async function ProblemSection({ content }: ProblemSectionProps) {
  const t = await getTranslations("landing");

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
        </div>

        <div className="flex flex-col gap-3 lg:col-span-7 lg:col-start-6 lg:row-span-2 lg:row-start-1">
          <figure className="relative flex flex-col gap-3">
            <ResponsiveImage
              image={content.image}
              sizes="sideDecoration"
              className="hidden aspect-4/5 w-9/12 self-end rounded-lg lg:block"
            />
            <div className="z-(--z-raised) flex flex-col rounded-xl border-(length:--border-width-thin) border-border-default bg-metal-card shadow-metal-card lg:absolute lg:top-1/2 lg:left-0 lg:w-8/12 lg:-translate-y-1/2">
              <p className="flex items-center gap-2 border-b-(length:--border-width-thin) border-border-subtle px-inset-card py-4 font-semibold text-text-primary">
                <LockIcon
                  aria-hidden="true"
                  className="size-(--size-icon-md) shrink-0"
                />
                {t("problem.conversation.frameTitle")}
              </p>
              <ol className="flex flex-col gap-4 px-inset-card py-5">
                {content.messages.map((message) => {
                  const isCreator = message.author === "creator";
                  return (
                    <li
                      key={message.id}
                      className={cn(
                        "flex flex-col gap-1",
                        isCreator
                          ? "items-end text-right"
                          : "items-start text-left",
                      )}
                    >
                      <span className="text-sm text-text-tertiary">
                        {isCreator
                          ? t("problem.conversation.creatorRole")
                          : t("problem.conversation.advertiserRole")}
                      </span>
                      <span
                        className={cn(
                          "w-10/12 rounded-md px-4 py-3 text-left text-md text-text-primary",
                          isCreator ? "bg-brand-subtle-bg" : "bg-surface-muted",
                        )}
                      >
                        {message.text}
                      </span>
                    </li>
                  );
                })}
              </ol>
              <p className="flex items-center justify-center gap-2 border-t-(length:--border-width-thin) border-border-subtle px-inset-card py-4 text-sm text-text-tertiary">
                <FileCheckIcon
                  aria-hidden="true"
                  className="size-(--size-icon-sm) shrink-0"
                />
                {t("problem.conversation.systemEvent")}
              </p>
            </div>
            <figcaption className="text-sm text-text-secondary lg:w-9/12 lg:self-end">
              {t("problem.conversation.caption")}
            </figcaption>
          </figure>
          <p className="text-sm text-text-tertiary lg:w-9/12 lg:self-end">
            {content.sourceNote}
          </p>
        </div>

        <div className="lg:col-span-5 lg:row-start-2 lg:self-start">
          <Button variant="primary" className="w-full sm:w-auto">
            {t("common.cta.advertiser")}
          </Button>
        </div>
      </div>
    </section>
  );
}
