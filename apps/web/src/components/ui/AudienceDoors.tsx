import { getLocale, getTranslations } from "next-intl/server";
import { memberPageHref } from "@/lib/member-paths";
import { cn } from "./class-names";
import { LinkButton } from "./LinkButton";

type AudienceDoorsProps = {
  /** Unique prefix for the audience line ids referenced by aria-describedby. */
  idPrefix: string;
  /** Dark section (15): inverse secondary button and inverse text. */
  tone?: "default" | "inverse";
  className?: string;
};

/**
 * The "two doors" pair (02 §2.2): advertiser (primary) then creator (secondary), each preceded by
 * a line naming its audience, linked to the button with aria-describedby. Each opens the real
 * sign-up page of its door, by the localized link of next-intl: /fr/inscription/marque ·
 * /en/signup/brand, creator alike (EC-15, EC-J9-2).
 */
export async function AudienceDoors({
  idPrefix,
  tone = "default",
  className,
}: AudienceDoorsProps) {
  const t = await getTranslations("landing.common");
  const locale = await getLocale();
  const advertiserLineId = `${idPrefix}-advertiser-audience`;
  const creatorLineId = `${idPrefix}-creator-audience`;
  const audienceClassName = cn(
    "text-sm font-semibold",
    tone === "inverse" ? "text-text-inverse-secondary" : "text-text-secondary",
  );

  return (
    <div
      className={cn(
        "flex flex-col gap-stack-sm sm:flex-row sm:flex-wrap sm:gap-3",
        className,
      )}
    >
      <div className="flex flex-col gap-1">
        <p id={advertiserLineId} className={audienceClassName}>
          {t("doors.advertiserAudience")}
        </p>
        <LinkButton
          href={memberPageHref("signupAdvertiser", locale)}
          variant="primary"
          aria-describedby={advertiserLineId}
        >
          {t("cta.advertiser")}
        </LinkButton>
      </div>
      <div className="flex flex-col gap-1">
        <p id={creatorLineId} className={audienceClassName}>
          {t("doors.creatorAudience")}
        </p>
        <LinkButton
          href={memberPageHref("signupCreator", locale)}
          variant={tone === "inverse" ? "secondaryInverse" : "secondary"}
          aria-describedby={creatorLineId}
        >
          {t("cta.creator")}
        </LinkButton>
      </div>
    </div>
  );
}
