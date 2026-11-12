"use client";

// Block 7 of "mon profil" of a creator, "Confiance" (docs/mvp/17 §5.2; 07 RG8; 08 RG16; jalons/l2g,
// commit 13): whether the account holds an active « Compte vérifié » (required to publish, granted by
// an agent and asked from the line of the main network, never decided here) and the one global
// switch « visible dans la recherche » with its consequence written (RG8). The switch answers at any
// time but for a suspended profile and has no effect readable before the search of Lot 3. It
// displays and reports; the flow is use-creator-publication.ts. No amount, rate, net or price (D48, D78).
import { useTranslations } from "next-intl";
import {
  memberChoiceInputClasses,
  memberChoiceRowClasses,
  MEMBER_FIELD_HELP_CLASSES,
} from "@/components/member/ui/field-classes";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { CircleAlertIcon, CircleCheckIcon } from "@/components/ui/icons";
import { sectionAnchorOf } from "./creator-profile-view";
import type { CreatorPublicationState } from "./use-creator-publication";

export function TrustFields({
  accountVerified,
  isSearchable,
  publication,
  disabled,
}: {
  accountVerified: boolean;
  isSearchable: boolean;
  publication: CreatorPublicationState;
  /** A suspended profile, or one with no storefront yet: the switch does not answer. */
  disabled: boolean;
}) {
  const t = useTranslations("creatorProfile");
  const { visibility } = publication;
  const saving = visibility.kind === "saving";
  // The value being saved shows at once; the answer of the API confirms it (or the screen goes back).
  const shown = visibility.kind === "saving" ? visibility.value : isSearchable;
  return (
    <>
      <div
        className="flex flex-col gap-2"
        data-trust-verified={accountVerified}
      >
        <p className="flex items-start gap-2 text-md text-text-primary">
          {accountVerified ? (
            <CircleCheckIcon
              aria-hidden="true"
              className="mt-1 size-(--size-icon-md) shrink-0 text-feedback-success-icon"
            />
          ) : (
            <CircleAlertIcon
              aria-hidden="true"
              className="mt-1 size-(--size-icon-md) shrink-0 text-feedback-warning-icon"
            />
          )}
          {accountVerified ? t("trust.verified") : t("trust.missing")}
        </p>
        {accountVerified ? null : (
          <a
            href={`#${sectionAnchorOf("networks")}`}
            className="inline-flex min-h-(--size-touch-target) items-center self-start text-md text-text-primary underline"
          >
            {t("trust.go")}
          </a>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <label className={memberChoiceRowClasses(disabled)}>
          <input
            type="checkbox"
            role="switch"
            name="is-searchable"
            className={memberChoiceInputClasses(disabled)}
            checked={shown}
            disabled={disabled || saving}
            onChange={(event) =>
              publication.setSearchable(event.target.checked)
            }
          />
          <span className="font-semibold">{t("visibility.label")}</span>
        </label>
        <p className={MEMBER_FIELD_HELP_CLASSES}>
          {shown ? t("visibility.on") : t("visibility.off")}
        </p>
        {visibility.kind === "failed" ? (
          <ErrorNotice>{t("visibility.failed")}</ErrorNotice>
        ) : null}
      </div>
    </>
  );
}
