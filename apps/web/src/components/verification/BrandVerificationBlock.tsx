"use client";

// Block 4 « Vérification » of "mon profil de marque" (docs/mvp/17 §4.2, M2; 06 RG49 to RG54, RG83, CA26;
// jalons/l2e, commit 20): the badge « Marque vérifiée » dated when it stands, what it states and does
// not state, the state of the request, and ONE link to the journey (the code, the internal block and
// the follow-up are the journey's). Without a domain on the profile the badge cannot be asked for, and
// the block says so BEFORE any button (CA26); the publication of the profile stays possible. The block
// never promises a publication, a validation or a result: asking for the badge only counts in the
// completeness (06 RG59). This file draws; the state is brand-verification-view.ts, the read
// use-brand-verification.ts. No amount, rate, net or price (D48, D78).
import { useLocale, useTranslations } from "next-intl";
import { useMember } from "@/components/member/member-context";
import { MemberButton } from "@/components/member/ui/MemberButton";
import { Notice } from "@/components/member/ui/Notice";
import { memberButtonClasses } from "@/components/member/ui/button-classes";
import { MEMBER_FIELD_HELP_CLASSES } from "@/components/member/ui/field-classes";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { Link } from "@/i18n/navigation";
import { memberPageHref } from "@/lib/member-paths";
import { BrandBadgeLine } from "./BrandBadgeLine";
import { BrandRequestState } from "./BrandRequestState";
import { BRAND_CTA_KEYS, brandBlockOf } from "./brand-verification-view";
import { useBrandVerification } from "./use-brand-verification";

export function BrandVerificationBlock({
  hasDomain,
}: {
  /** The profile holds the domain of the brand's site (06 CA26); read from the draft, the API refuses a request without it anyway. */
  hasDomain: boolean;
}) {
  const t = useTranslations("verification");
  const locale = useLocale();
  const { signedOut } = useMember();
  const verification = useBrandVerification({
    onSignedOut: () => signedOut(null),
  });

  if (verification.phase === "unavailable") {
    return (
      <div className="flex flex-col gap-3">
        <ErrorNotice>{t("line.unavailable")}</ErrorNotice>
        <div>
          <MemberButton
            variant="secondary"
            onClick={() => void verification.retry()}
          >
            {t("line.retry")}
          </MemberButton>
        </div>
      </div>
    );
  }
  if (verification.data === null) {
    return (
      <p role="status" className="text-sm text-text-secondary">
        {t("line.loading")}
      </p>
    );
  }

  const block = brandBlockOf(verification.data, hasDomain);
  return (
    <div className="flex flex-col gap-3" data-brand-verification="">
      {block.badge === null ? (
        <>
          <p className="text-md text-text-primary">
            {t("brandBlock.status.none")}
          </p>
          <p className="text-md text-text-primary">{t("brandBlock.affirms")}</p>
        </>
      ) : (
        <BrandBadgeLine badge={block.badge} />
      )}
      {block.request === null ? null : (
        <BrandRequestState state={block.request} />
      )}
      {block.needsDomain ? (
        <Notice tone="info" announce={false}>
          {t("brandBlock.noDomain")}
        </Notice>
      ) : null}
      {block.action === null ? null : (
        <div>
          <Link
            href={memberPageHref("accountBrandVerification", locale)}
            className={memberButtonClasses("secondary", "md")}
          >
            {t(BRAND_CTA_KEYS[block.action])}
          </Link>
        </div>
      )}
      {block.badge === null ? (
        <p className={MEMBER_FIELD_HELP_CLASSES}>{t("brandBlock.optional")}</p>
      ) : null}
    </div>
  );
}
