"use client";

// The logo field of block 1 of "mon profil de marque" (docs/mvp/06 RG15, cas limites 2 et 6, CA45,
// RG62; 17 §4.2; D80): the formats and the size said before the choice, the preview only once the
// API has validated and re-encoded the image (a `data:` source, never a URL), the replacement and
// the removal, one message per refusal, and "à redéposer" with a new attempt when the service did
// not answer. It displays and reports; the flow is use-brand-logo.ts, the rules are apps/api's.
// The name of the chosen file is never shown. Optional field (RG15, Q8): never listed as missing.
import { useId, useRef, type ChangeEvent } from "react";
import { useTranslations } from "next-intl";
import { LayerBadge } from "@/components/member/ui/LayerBadge";
import { MemberButton } from "@/components/member/ui/MemberButton";
import { Notice } from "@/components/member/ui/Notice";
import {
  MEMBER_FIELD_CLASSES,
  MEMBER_FIELD_HEADER_CLASSES,
  MEMBER_FIELD_HELP_CLASSES,
  MEMBER_FIELD_LABEL_CLASSES,
} from "@/components/member/ui/field-classes";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import type { FieldReview } from "./brand-profile-view";
import type { BrandLogoState } from "./use-brand-logo";

/** The formats the picker offers; the API reads the real type from the bytes and decides. */
const ACCEPTED_FORMATS = "image/png,image/jpeg,image/webp";

const PREVIEW_CLASSES =
  "size-11 shrink-0 rounded-md border-(length:--border-width-thin) border-border-default bg-surface-raised object-contain";

/** `review`: how the logo stands under RG9 on a published profile (told before, and while it waits). */
export function LogoField({
  logo,
  review,
}: {
  logo: BrandLogoState;
  review: FieldReview;
}) {
  const t = useTranslations("brandProfile");
  const ids = useId();
  const labelId = `${ids}-label`;
  const helpId = `${ids}-help`;
  const picker = useRef<HTMLInputElement>(null);
  const { activity } = logo;

  function onPick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // The same file can be chosen again after a refusal.
    event.target.value = "";
    if (file !== undefined) {
      logo.choose(file);
    }
  }

  const statusKey =
    activity.kind === "failed"
      ? null
      : activity.kind === "idle"
        ? logo.phase === "loading"
          ? "loading"
          : null
        : activity.kind;
  const state = statusKey === null ? null : t(`logo.status.${statusKey}`);
  const hasLogo = logo.logo !== null || logo.pendingLogo !== null;

  return (
    <div
      role="group"
      aria-labelledby={labelId}
      aria-describedby={helpId}
      className={MEMBER_FIELD_CLASSES}
    >
      <div className={MEMBER_FIELD_HEADER_CLASSES}>
        <span id={labelId} className={MEMBER_FIELD_LABEL_CLASSES}>
          {t("logo.label")}
        </span>
        <LayerBadge layer="public" label={t("layer.public")} />
      </div>
      <p id={helpId} className={MEMBER_FIELD_HELP_CLASSES}>
        {t("logo.help")}
        {review === "regime" ? ` ${t("logo.review.regime")}` : ""}
      </p>
      {review === "set" || review === "clear" ? (
        <Notice tone="info" announce={false} className="self-start">
          {t(review === "set" ? "logo.review.set" : "logo.review.clear")}
        </Notice>
      ) : null}
      <div className="flex flex-wrap items-center gap-4">
        {logo.logo === null ? null : (
          // eslint-disable-next-line @next/next/no-img-element -- a data: source built by the API
          <img
            src={`data:${logo.logo.contentType};base64,${logo.logo.data}`}
            alt={t("logo.alt")}
            width={logo.logo.width}
            height={logo.logo.height}
            className={PREVIEW_CLASSES}
          />
        )}
        {logo.pendingLogo === null ? null : (
          <figure className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- a data: source built by the API */}
            <img
              src={`data:${logo.pendingLogo.contentType};base64,${logo.pendingLogo.data}`}
              alt={t("logo.pendingAlt")}
              width={logo.pendingLogo.width}
              height={logo.pendingLogo.height}
              className={PREVIEW_CLASSES}
            />
            <figcaption className={MEMBER_FIELD_HELP_CLASSES}>
              {t("logo.pendingCaption")}
            </figcaption>
          </figure>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={picker}
            type="file"
            accept={ACCEPTED_FORMATS}
            hidden
            onChange={onPick}
          />
          <MemberButton
            variant="secondary"
            aria-disabled={logo.busy || undefined}
            onClick={() => picker.current?.click()}
          >
            {hasLogo ? t("logo.replace") : t("logo.choose")}
          </MemberButton>
          {hasLogo ? (
            <MemberButton
              variant="secondary"
              aria-disabled={logo.busy || undefined}
              onClick={logo.remove}
            >
              {t("logo.remove")}
            </MemberButton>
          ) : null}
        </div>
      </div>
      {!hasLogo && logo.phase === "ready" ? (
        <p className={MEMBER_FIELD_HELP_CLASSES}>{t("logo.none")}</p>
      ) : null}
      {state === null ? null : (
        <Notice tone="info" className="self-start">
          {state}
        </Notice>
      )}
      {logo.phase === "unavailable" ? (
        <div className="flex flex-col items-start gap-3">
          <ErrorNotice>{t("logo.errors.loadFailed")}</ErrorNotice>
          <MemberButton variant="secondary" onClick={logo.reload}>
            {t("logo.reload")}
          </MemberButton>
        </div>
      ) : null}
      {activity.kind === "failed" ? (
        <div className="flex flex-col items-start gap-3">
          <ErrorNotice>
            {t(
              activity.during === "removal" &&
                activity.failure === "unavailable"
                ? "logo.errors.removalFailed"
                : `logo.errors.${activity.failure}`,
            )}
          </ErrorNotice>
          {logo.canRetry ? (
            <MemberButton
              variant="secondary"
              aria-disabled={logo.busy || undefined}
              onClick={logo.retry}
            >
              {t("logo.retry")}
            </MemberButton>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
