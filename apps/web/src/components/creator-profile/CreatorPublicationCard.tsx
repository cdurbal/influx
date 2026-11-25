"use client";

// The publication of the profile in three parts (docs/mvp/17 §5.2; 07 RG4, RG5, RG9, RG10, RG90;
// jalons/l2g, commits 13 and fix-1, L2GU-1, 2, 16): the refusal and the notices that wait for an answer
// (the answer within one business day, the changes of a published profile, the previous version
// staying shown, CA48), which cross the page; and the card of the action, short enough for the sticky
// column: the state in words, the button « Publier mon profil » (never disabled: a click names what is
// missing, field by field, with a link to its block) and what is missing. The refusal gives its
// reason and the step that follows (RG10, RG96: the reason comes from a closed list, the free message
// only for `other`). It displays and reports; the flow is use-creator-publication.ts, the state is the
// API's. No amount, rate, net or price (D48, D78).
import type { CreatorProfileResponse } from "@influx/contracts/creator-profile";
import { useLocale, useTranslations } from "next-intl";
import { MemberButton } from "@/components/member/ui/MemberButton";
import { Notice } from "@/components/member/ui/Notice";
import { PROFILE_CARD_CLASSES } from "@/components/brand-profile/brand-profile-classes";
import { cn } from "@/components/ui/class-names";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import {
  hasPublicationNotices,
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

/** The refusal, under the title and across the page (L2GU-2): its reason is the urgent thing, on a phone as on a desk. */
export function PublicationRefusal({
  profile,
  className,
}: {
  profile: Pick<CreatorProfileResponse, "status" | "refusal">;
  className?: string;
}) {
  const t = useTranslations("creatorProfile");
  const refusal = refusalViewOf(profile);
  if (refusal === null) {
    return null;
  }
  return (
    <Notice
      tone="warning"
      announce={false}
      className={cn("self-stretch", className)}
    >
      <div className="flex flex-col gap-2 text-sm">
        <p>
          {t(
            refusal.kind === "revision"
              ? "status.revisionRejected"
              : "status.rejected",
            { reason: t(refusal.reasonKey) },
          )}
        </p>
        {refusal.memberMessage === null ? null : <p>{refusal.memberMessage}</p>}
        {refusal.kind === "revision" ? <p>{t("status.revisionKept")}</p> : null}
        <p>{t(`refusal.${refusal.nextStep}`)}</p>
      </div>
    </Notice>
  );
}

/**
 * What waits for an answer (L2GU-2): the profile submitted, the changes of a published profile. Out of
 * the sticky column, so that a long text never hides the button; nothing at all when nothing waits.
 */
export function PublicationNotices({
  profile,
  className,
}: {
  profile: Pick<CreatorProfileResponse, "status" | "pendingRevisions">;
  className?: string;
}) {
  const t = useTranslations("creatorProfile");
  const locale = useLocale();
  if (!hasPublicationNotices(profile)) {
    return null;
  }
  const pending = pendingFieldsOf(profile.pendingRevisions);
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {publicationModeOf(profile.status) === "waiting" ? (
        <p role="status" className="text-sm text-text-primary">
          {t("publish.submitted")}
        </p>
      ) : (
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
      )}
    </div>
  );
}

/** The action: the state, the button and what is missing; short enough for a sticky column (L2GU-2). */
export function PublicationCard({
  profile,
  publication,
  className,
}: {
  profile: Pick<CreatorProfileResponse, "status" | "missingRequired">;
  publication: CreatorPublicationState;
  className?: string;
}) {
  const t = useTranslations("creatorProfile");
  const locale = useLocale();
  const mode = publicationModeOf(profile.status);
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
    <div
      className={cn(PROFILE_CARD_CLASSES, className)}
      data-publication={profile.status}
    >
      <p className="text-sm font-semibold text-text-primary">
        {t("home.state", { state: t(`state.${profile.status}`) })}
      </p>
      {mode === "published" ? (
        <p className="text-sm text-text-primary">{t("status.published")}</p>
      ) : null}
      {mode === "submit" ? (
        <>
          <MemberButton
            fullWidth
            aria-disabled={sending || undefined}
            aria-describedby="publish-review-help"
            onClick={() => {
              if (!sending) {
                publication.publish();
              }
            }}
          >
            {t("publish.action")}
          </MemberButton>
          {/* L2GU-16: « Publier » promises nothing immediate, a salesperson reads first. */}
          <p id="publish-review-help" className="text-sm text-text-secondary">
            {t("publish.review")}
          </p>
        </>
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
