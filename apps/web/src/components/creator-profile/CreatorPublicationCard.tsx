"use client";

// The card of the publication of the profile, in the column of the completeness (docs/mvp/17 §5.2; 07
// RG4, RG5, RG9, RG10, RG90; jalons/l2g, commit 13): the state in words, the button « Publier mon
// profil » (never disabled: a click names what is missing, field by field, with a link to its block),
// the answer within one business day once submitted, the published profile and the changes waiting
// for review (the previous version stays shown, CA48), the refusal with its reason and the step that
// follows (RG10, RG96: the reason comes from a closed list, the free message only for `other`). It
// displays and reports; the flow is use-creator-publication.ts, the state is the API's. No amount,
// rate, net or price (D48, D78).
import type { CreatorProfileResponse } from "@influx/contracts/creator-profile";
import { useLocale, useTranslations } from "next-intl";
import { MemberButton } from "@/components/member/ui/MemberButton";
import { Notice } from "@/components/member/ui/Notice";
import { PROFILE_CARD_CLASSES } from "@/components/brand-profile/brand-profile-classes";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import {
  pendingFieldsOf,
  publicationModeOf,
  refusalViewOf,
} from "./creator-publication-view";
import {
  sectionAnchorOf,
  sectionOfRequired,
  type RequiredCode,
} from "./creator-profile-view";
import type { CreatorPublicationState } from "./use-creator-publication";

/** Stands for the names in the sentence of the translation, which holds them as one plain `{fields}`. */
const NAMES_SLOT = String.fromCodePoint(0x2063);

const LINK_CLASSES = "text-text-primary underline";

/** The names of what is missing, each a link to the block that holds it (RG90: nominative, never a count alone). */
function MissingNames({
  missing,
  locale,
}: {
  missing: readonly RequiredCode[];
  locale: string;
}) {
  const t = useTranslations("creatorProfile");
  const names = missing.map((code) => t(`required.${code}`));
  const parts = new Intl.ListFormat(locale, {
    style: "long",
    type: "conjunction",
  }).formatToParts(names);
  return (
    <>
      {parts.map((part, key) => {
        if (part.type === "literal") {
          return <span key={key}>{part.value}</span>;
        }
        const code =
          missing[
            parts.slice(0, key).filter((before) => before.type === "element")
              .length
          ];
        return (
          <a
            key={key}
            href={
              code === undefined
                ? undefined
                : `#${sectionAnchorOf(sectionOfRequired(code))}`
            }
            className={LINK_CLASSES}
          >
            {part.value}
          </a>
        );
      })}
    </>
  );
}

export function PublicationCard({
  profile,
  publication,
}: {
  profile: Pick<
    CreatorProfileResponse,
    "status" | "missingRequired" | "refusal" | "pendingRevisions"
  >;
  publication: CreatorPublicationState;
}) {
  const t = useTranslations("creatorProfile");
  const locale = useLocale();
  const mode = publicationModeOf(profile.status);
  const refusal = refusalViewOf(profile);
  const pending = pendingFieldsOf(profile.pendingRevisions);
  const missing = profile.missingRequired;
  const sending = publication.submit.kind === "submitting";
  const sentenceAround = (sentence: string) => {
    const [before = "", after = ""] = sentence.split(NAMES_SLOT);
    return (
      <>
        {before}
        <MissingNames missing={missing} locale={locale} />
        {after}
      </>
    );
  };

  return (
    <div className={PROFILE_CARD_CLASSES} data-publication={profile.status}>
      <p className="text-sm font-semibold text-text-primary">
        {t("home.state", { state: t(`state.${profile.status}`) })}
      </p>
      {refusal === null ? null : (
        <Notice tone="warning" announce={false} className="self-stretch">
          <div className="flex flex-col gap-2 text-sm">
            <p>
              {t(
                refusal.kind === "revision"
                  ? "status.revisionRejected"
                  : "status.rejected",
                { reason: t(refusal.reasonKey) },
              )}
            </p>
            {refusal.memberMessage === null ? null : (
              <p>{refusal.memberMessage}</p>
            )}
            <p>{t(`refusal.${refusal.nextStep}`)}</p>
          </div>
        </Notice>
      )}
      {mode === "waiting" ? (
        <p role="status" className="text-sm text-text-primary">
          {t("publish.submitted")}
        </p>
      ) : null}
      {mode === "published" ? (
        <p className="text-sm text-text-primary">{t("status.published")}</p>
      ) : null}
      {mode === "published" && pending.length > 0 ? (
        <Notice tone="info" className="self-stretch">
          <div className="flex flex-col gap-1 text-sm">
            <p>{t("status.pendingWithPublished")}</p>
            <p>
              {t("status.pendingFields", {
                fields: new Intl.ListFormat(locale, {
                  style: "long",
                  type: "conjunction",
                }).format(pending.map((field) => t(`revisionField.${field}`))),
              })}
            </p>
          </div>
        </Notice>
      ) : null}
      {mode === "submit" ? (
        <MemberButton
          fullWidth
          aria-disabled={sending || undefined}
          onClick={() => {
            if (!sending) {
              publication.publish();
            }
          }}
        >
          {t("publish.action")}
        </MemberButton>
      ) : null}
      {mode === "submit" &&
      publication.submit.kind === "missing" &&
      missing.length > 0 ? (
        <Notice tone="warning" className="self-stretch">
          <p className="text-sm" data-publish-missing="">
            {sentenceAround(
              t("publish.missing", {
                count: missing.length,
                fields: NAMES_SLOT,
              }),
            )}
          </p>
        </Notice>
      ) : null}
      {publication.submit.kind === "failed" ? (
        <ErrorNotice>{t("publish.failed")}</ErrorNotice>
      ) : null}
    </div>
  );
}
