"use client";

// One visual of block 6, the portfolio (docs/mvp/17 §5.2; 07 RG78 to RG83; jalons/l2g, commit 13): the
// image the API stored (a `data:` source, never an address), its state written (text AND icon, never
// the color alone), the reason of a refusal, the caption with the box of RG83, the order, the
// replacement and the removal. It displays and reports; the flow is use-creator-portfolio.ts, the
// rules are apps/api's and the base's. The caption is saved by its own button: a moderated field is
// not saved at every key (RG9). The box of authorisation is never pre-ticked.
import type { PortfolioImageResponse } from "@influx/contracts/creator-portfolio";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { cn } from "@/components/ui/class-names";
import { CARD_TITLE } from "@/components/member/ui/heading-classes";
import { MemberButton } from "@/components/member/ui/MemberButton";
import { Notice } from "@/components/member/ui/Notice";
import {
  memberChoiceInputClasses,
  memberChoiceRowClasses,
} from "@/components/member/ui/field-classes";
import { TextField } from "@/components/member/ui/TextField";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  ClockIcon,
  ImagePlusIcon,
  Trash2Icon,
} from "@/components/ui/icons";
import {
  CAPTION_MAX_LENGTH,
  captionDraftOf,
  captionPlanOf,
  sameCaption,
  type PortfolioFailure,
  type PortfolioShownItem,
} from "./creator-portfolio-view";

const CARD_CLASSES =
  "flex flex-col gap-3 rounded-md border-(length:--border-width-thin) border-border-default bg-surface-raised p-4";
const IMAGE_CLASSES =
  "max-h-(--size-portfolio-visual) w-auto max-w-full self-start rounded-md border-(length:--border-width-thin) border-border-default bg-surface-page object-contain";
const STATE_CLASSES = "flex items-start gap-2 text-sm text-text-primary";
const ICON_CLASSES = "mt-1 size-(--size-icon-md) shrink-0";

export type PortfolioItemActions = {
  /** 1 to 8, the creator's order. */
  position: number;
  isFirst: boolean;
  isLast: boolean;
  /** The creator may change the portfolio (a draft, a refused or a published profile) and no gesture runs. */
  editable: boolean;
  busy: boolean;
  /** The failure of the last gesture on this visual, told under it. */
  failure: PortfolioFailure | null;
  image: PortfolioImageResponse | undefined;
  replacementImage: PortfolioImageResponse | undefined;
  move: (delta: -1 | 1) => void;
  replace: () => void;
  remove: () => void;
  saveCaption: (body: {
    caption: string | null;
    brandDeclared: boolean;
  }) => void;
};

function Picture({
  image,
  alt,
}: {
  image: PortfolioImageResponse | undefined;
  alt: string;
}) {
  const t = useTranslations("creatorProfile.portfolio");
  if (image === undefined) {
    return <p className="text-sm text-text-secondary">{t("imageLoading")}</p>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a data: source built by the API
    <img
      src={`data:${image.contentType};base64,${image.data}`}
      alt={alt}
      width={image.width}
      height={image.height}
      className={IMAGE_CLASSES}
    />
  );
}

/** A visual in place (pending or approved): picture, state, caption, order, replacement, removal. */
export function PortfolioItemCard({
  shown,
  actions,
}: {
  shown: PortfolioShownItem;
  actions: PortfolioItemActions;
}) {
  const t = useTranslations("creatorProfile");
  const tLayer = useTranslations("creatorProfile.layer");
  const { item, state, replacement } = shown;
  const { position, editable, busy } = actions;
  const incoming = captionDraftOf(item);
  const [base, setBase] = useState(incoming);
  const [draft, setDraft] = useState(incoming);
  const [invalid, setInvalid] = useState(false);
  // What the API says of the caption comes back after each save (or each reading): it becomes the
  // reference of the field, and the field with it unless the creator typed on meanwhile.
  if (!sameCaption(incoming, base)) {
    setBase(incoming);
    setDraft(incoming);
  }
  const changed = !sameCaption(draft, base);
  const hasCaption = draft.caption.trim() !== "";
  const blocked = !editable || busy;

  function save() {
    if (blocked || !changed) {
      return;
    }
    const plan = captionPlanOf(draft);
    if (!plan.ok) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    actions.saveCaption(plan.body);
  }

  return (
    <li
      className={CARD_CLASSES}
      data-portfolio-item={item.id}
      data-state={state}
    >
      <h3 className={cn(CARD_TITLE, "text-text-primary")}>
        {t("portfolio.item", { position })}
      </h3>
      <Picture image={actions.image} alt={t("portfolio.item", { position })} />
      <p className={STATE_CLASSES} data-item-state="">
        {state === "approved" ? (
          <CircleCheckIcon
            aria-hidden="true"
            className={`${ICON_CLASSES} text-feedback-success-icon`}
          />
        ) : (
          <ClockIcon
            aria-hidden="true"
            className={`${ICON_CLASSES} text-text-secondary`}
          />
        )}
        {state === "approved"
          ? t("portfolio.approved")
          : t("portfolio.pending")}
      </p>
      {item.replacementPending ? (
        <Notice tone="info" announce={false}>
          {t("portfolio.replacementPending")}
        </Notice>
      ) : null}
      {replacement === null ? null : (
        <Picture
          image={actions.replacementImage}
          alt={t("portfolio.replacementAlt")}
        />
      )}
      {item.captionPending ? (
        <Notice tone="info" announce={false}>
          {t("portfolio.captionPending")}
        </Notice>
      ) : null}
      <TextField
        name={`caption-${item.id}`}
        label={t("portfolio.caption")}
        layer={{ layer: "public", label: tLayer("public") }}
        value={draft.caption}
        maxLength={CAPTION_MAX_LENGTH}
        disabled={blocked}
        error={invalid ? t("portfolio.errors.captionInvalid") : null}
        onChange={(caption) => {
          setInvalid(false);
          setDraft({
            caption,
            // The declaration means nothing without a caption (RG83).
            brandDeclared: caption.trim() === "" ? false : draft.brandDeclared,
          });
        }}
      />
      {hasCaption ? (
        <>
          <label className={memberChoiceRowClasses(blocked)}>
            <input
              type="checkbox"
              name={`brand-declared-${item.id}`}
              className={memberChoiceInputClasses(blocked)}
              checked={draft.brandDeclared}
              disabled={blocked}
              aria-describedby={`brand-declared-help-${item.id}`}
              onChange={(event) =>
                setDraft({ ...draft, brandDeclared: event.target.checked })
              }
            />
            <span>{t("portfolio.brandConsent")}</span>
          </label>
          {/* L2GU-16: what happens when the box stays unchecked (07 RG83). */}
          <p
            id={`brand-declared-help-${item.id}`}
            className="text-sm text-text-secondary"
          >
            {t("portfolio.brandConsentHelp")}
          </p>
        </>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <MemberButton
          variant="secondary"
          aria-disabled={blocked || !changed || undefined}
          onClick={save}
        >
          {t("portfolio.saveCaption")}
        </MemberButton>
        <MemberButton
          variant="secondary"
          aria-label={t("portfolio.moveUp", { position })}
          aria-disabled={blocked || actions.isFirst || undefined}
          onClick={() => {
            if (!blocked && !actions.isFirst) {
              actions.move(-1);
            }
          }}
        >
          <ArrowUpIcon
            aria-hidden="true"
            className="size-(--size-icon-md) shrink-0"
          />
        </MemberButton>
        <MemberButton
          variant="secondary"
          aria-label={t("portfolio.moveDown", { position })}
          aria-disabled={blocked || actions.isLast || undefined}
          onClick={() => {
            if (!blocked && !actions.isLast) {
              actions.move(1);
            }
          }}
        >
          <ArrowDownIcon
            aria-hidden="true"
            className="size-(--size-icon-md) shrink-0"
          />
        </MemberButton>
        {state === "approved" ? (
          <MemberButton
            variant="secondary"
            aria-disabled={blocked || undefined}
            onClick={() => {
              if (!blocked) {
                actions.replace();
              }
            }}
          >
            <ImagePlusIcon
              aria-hidden="true"
              className="size-(--size-icon-md) shrink-0"
            />
            {t("portfolio.replace")}
          </MemberButton>
        ) : null}
        <MemberButton
          variant="secondary"
          aria-disabled={blocked || undefined}
          onClick={() => {
            if (!blocked) {
              actions.remove();
            }
          }}
        >
          <Trash2Icon
            aria-hidden="true"
            className="size-(--size-icon-md) shrink-0"
          />
          {t("portfolio.remove")}
        </MemberButton>
      </div>
      {actions.failure === null ? null : (
        <ErrorNotice>{t(`portfolio.errors.${actions.failure}`)}</ErrorNotice>
      )}
    </li>
  );
}

/** A refused visual: its picture, the reason of the grid told in full, the day its file is deleted (D79 (8)). */
export function RefusedItemCard({
  shown,
  position,
  image,
}: {
  shown: PortfolioShownItem;
  position: number;
  image: PortfolioImageResponse | undefined;
}) {
  const t = useTranslations("creatorProfile");
  const locale = useLocale();
  const { item } = shown;
  const reason =
    item.reasonCode === null ? null : t(`portfolio.reason.${item.reasonCode}`);
  return (
    <li
      className={CARD_CLASSES}
      data-portfolio-item={item.id}
      data-state="rejected"
    >
      <h3 className={cn(CARD_TITLE, "text-text-primary")}>
        {t("portfolio.refusedItem", { position })}
      </h3>
      <Picture image={image} alt={t("portfolio.refusedItem", { position })} />
      <p className={STATE_CLASSES} data-item-state="">
        <CircleAlertIcon
          aria-hidden="true"
          className={`${ICON_CLASSES} text-feedback-warning-icon`}
        />
        {t("portfolio.rejected", { reason: reason ?? "" })}
      </p>
      {item.deleteAfter === null ? null : (
        <p className="text-sm text-text-secondary">
          {t("portfolio.deleteAfter", {
            date: new Intl.DateTimeFormat(locale, {
              dateStyle: "long",
            }).format(new Date(item.deleteAfter)),
          })}
        </p>
      )}
    </li>
  );
}
