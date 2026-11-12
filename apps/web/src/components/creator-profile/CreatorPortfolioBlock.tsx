"use client";

// Block 6 of "mon profil" of a creator, the portfolio (docs/mvp/17 §5.2; 07 RG77 to RG84, RG111;
// jalons/l2g, commit 13): the notice that approved visuals are visible to every registered brand
// BEFORE any introduction, above the zone of deposit (that is where anonymity is lost); the deposit
// with its formats and its face notice (RG79 control 6); the count of RG77; each visual with its
// written state; the refused ones with their reason; the file kept in memory to be sent again when
// the service did not answer. It displays and reports; the flow is use-creator-portfolio.ts and the
// rules are apps/api's. The name of a file is never read, shown or sent. No amount, rate, net or
// price (D48, D78).
import { useTranslations } from "next-intl";
import { useRef, type ChangeEvent } from "react";
import { cn } from "@/components/ui/class-names";
import { CARD_TITLE } from "@/components/member/ui/heading-classes";
import { MemberButton } from "@/components/member/ui/MemberButton";
import { Notice } from "@/components/member/ui/Notice";
import { MEMBER_FIELD_HELP_CLASSES } from "@/components/member/ui/field-classes";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { ImagePlusIcon } from "@/components/ui/icons";
import {
  MAX_ITEMS,
  placedIdsOf,
  portfolioViewOf,
} from "./creator-portfolio-view";
import { PortfolioItemCard, RefusedItemCard } from "./PortfolioItemCard";
import type { CreatorPortfolioState } from "./use-creator-portfolio";

/** The formats the picker offers; the API reads the real type from the bytes and decides. */
const ACCEPTED_FORMATS = "image/png,image/jpeg,image/webp";

const DROP_ZONE_CLASSES =
  "flex flex-col items-start gap-3 rounded-md border-(length:--border-width-thin) border-dashed border-border-strong p-4";

export function PortfolioFields({
  state,
  editable,
}: {
  state: CreatorPortfolioState;
  /** A draft, a refused or a published profile: the portfolio may change (a suspended or waiting one is frozen). */
  editable: boolean;
}) {
  const t = useTranslations("creatorProfile");
  const picker = useRef<HTMLInputElement>(null);
  // The visual the next file stands for: none for a new deposit, an approved one for a replacement.
  const replaces = useRef<string | null>(null);
  const { activity } = state;
  const view = portfolioViewOf(state.items);
  const placedIds = placedIdsOf(state.items);
  const full = state.deposited >= MAX_ITEMS;
  const blocked = !editable || state.busy;

  function openPicker(target: string | null) {
    replaces.current = target;
    picker.current?.click();
  }

  function onPick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // The same file can be chosen again after a refusal.
    event.target.value = "";
    if (file !== undefined) {
      state.choose(file, replaces.current);
    }
  }

  const statusKey =
    activity.kind === "busy"
      ? "busy"
      : activity.kind === "failed" || activity.kind === "idle"
        ? null
        : activity.kind;
  const generalFailure =
    activity.kind === "failed" &&
    (activity.itemId === null ||
      !state.items.some((item) => item.id === activity.itemId))
      ? activity.failure
      : null;

  return (
    <>
      <Notice tone="info" announce={false}>
        {t("portfolio.notice")}
      </Notice>
      <div className={DROP_ZONE_CLASSES} data-portfolio-drop="">
        <input
          ref={picker}
          type="file"
          accept={ACCEPTED_FORMATS}
          hidden
          onChange={onPick}
        />
        <div className="flex flex-wrap items-center gap-3">
          <MemberButton
            variant="secondary"
            aria-disabled={blocked || full || undefined}
            onClick={() => {
              if (!blocked && !full) {
                openPicker(null);
              }
            }}
          >
            <ImagePlusIcon
              aria-hidden="true"
              className="size-(--size-icon-md) shrink-0"
            />
            {t("portfolio.add")}
          </MemberButton>
          {state.canRetry ? (
            <MemberButton
              variant="secondary"
              aria-disabled={blocked || undefined}
              onClick={state.retry}
            >
              {t("portfolio.retry")}
            </MemberButton>
          ) : null}
        </div>
        <p className={MEMBER_FIELD_HELP_CLASSES}>{t("portfolio.help")}</p>
        <p className={MEMBER_FIELD_HELP_CLASSES}>{t("portfolio.faceNotice")}</p>
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-text-primary">
          {t("portfolio.count", { count: state.deposited })}
        </p>
        {full ? (
          <p className={MEMBER_FIELD_HELP_CLASSES}>{t("portfolio.full")}</p>
        ) : null}
        <p role="status" className={MEMBER_FIELD_HELP_CLASSES}>
          {statusKey === null ? null : t(`portfolio.status.${statusKey}`)}
        </p>
      </div>
      {generalFailure === null ? null : (
        <ErrorNotice>{t(`portfolio.errors.${generalFailure}`)}</ErrorNotice>
      )}
      {state.phase === "loading" ? (
        <p role="status" className="text-sm text-text-secondary">
          {t("portfolio.loading")}
        </p>
      ) : null}
      {state.phase === "unavailable" ? (
        <div className="flex flex-col items-start gap-3">
          <ErrorNotice>{t("portfolio.unavailable")}</ErrorNotice>
          <MemberButton variant="secondary" onClick={state.reload}>
            {t("portfolio.reload")}
          </MemberButton>
        </div>
      ) : null}
      {state.phase === "ready" &&
      view.placed.length === 0 &&
      view.refused.length === 0 ? (
        <p className={MEMBER_FIELD_HELP_CLASSES}>{t("portfolio.empty")}</p>
      ) : null}
      {view.placed.length === 0 ? null : (
        <ol className="m-0 grid list-none gap-4 p-0 xl:grid-cols-2">
          {view.placed.map((shown, index) => (
            <PortfolioItemCard
              key={shown.item.id}
              shown={shown}
              actions={{
                position: index + 1,
                isFirst: placedIds[0] === shown.item.id,
                isLast: placedIds[placedIds.length - 1] === shown.item.id,
                editable,
                busy: state.busy,
                failure:
                  activity.kind === "failed" &&
                  activity.itemId === shown.item.id
                    ? activity.failure
                    : null,
                image: state.images[shown.item.id],
                replacementImage:
                  shown.replacement === null
                    ? undefined
                    : state.images[shown.replacement.id],
                move: (delta) => state.move(shown.item.id, delta),
                replace: () => openPicker(shown.item.id),
                remove: () => state.remove(shown.item.id),
                saveCaption: (body) => state.saveCaption(shown.item.id, body),
              }}
            />
          ))}
        </ol>
      )}
      {view.refused.length === 0 ? null : (
        <div className="flex flex-col gap-3">
          <h3 className={cn(CARD_TITLE, "text-text-primary")}>
            {t("portfolio.refusedTitle")}
          </h3>
          <ul className="m-0 grid list-none gap-4 p-0 xl:grid-cols-2">
            {view.refused.map((shown, index) => (
              <RefusedItemCard
                key={shown.item.id}
                shown={shown}
                position={index + 1}
                image={state.images[shown.item.id]}
              />
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
