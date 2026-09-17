import { getTranslations } from "next-intl/server";
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
 * a line naming its audience, linked to the button with aria-describedby. Each opens the matching
 * step of the account creation mockup (docs/landing-page/00-cadrage.md §6).
 */
export async function AudienceDoors({
  idPrefix,
  tone = "default",
  className,
}: AudienceDoorsProps) {
  const t = await getTranslations("landing.common");
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
          href="/signup/advertiser"
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
          href="/signup/creator"
          variant={tone === "inverse" ? "secondaryInverse" : "secondary"}
          aria-describedby={creatorLineId}
        >
          {t("cta.creator")}
        </LinkButton>
      </div>
    </div>
  );
}
