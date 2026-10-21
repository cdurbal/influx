import { getLocale, getTranslations } from "next-intl/server";
import { LinkButton } from "@/components/ui/LinkButton";
import { mutedTitleTags } from "@/components/ui/rich-text";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { memberPageHref } from "@/lib/member-paths";

/**
 * Section 9 (02 §3.11): invitation to creators, then the creator door. The network count and the
 * creator cards were fictitious: they left with the module (J9 commit 5) and come back only from
 * real, anonymized profiles (02 §2.8).
 */
export async function CreatorNetworkSection() {
  const t = await getTranslations("landing");
  const locale = await getLocale();

  return (
    <section
      aria-labelledby="creator-network-title"
      className="bg-surface-page"
    >
      <div className="mx-auto flex max-w-(--container-max) flex-col gap-section-header px-page-gutter py-section-block">
        <SectionHeader
          titleId="creator-network-title"
          overline={t("creatorNetwork.overline")}
          title={t.rich("creatorNetwork.title", mutedTitleTags)}
          lead={t("creatorNetwork.lead")}
        />
        <div>
          <LinkButton
            href={memberPageHref("signupCreator", locale)}
            variant="secondary"
            className="w-full sm:w-auto"
          >
            {t("common.cta.creator")}
          </LinkButton>
        </div>
      </div>
    </section>
  );
}
