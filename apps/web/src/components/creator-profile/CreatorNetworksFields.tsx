"use client";

// Block 3 of "mon profil" (creator; docs/mvp/17 §5.2; 07 RG41 to RG50, RG112 to RG116, CA10 to CA12,
// CA18; jalons/l2d, commit 13): one card per network line, the three priority metrics at the head of
// each (followers, posts of the last 30 days, average comments, in this order), the two secondary
// indicators after them, the source AND the date of the figures on every line (RG49), the choice of
// the main account that says out loud which line it unchecked (CA11), "Confirmer mes chiffres"
// (RG116). The fields only display the draft and report a change: the patch, the checks and the
// bands are creator-networks-view.ts and apps/api. No badge, no screenshot (L2E, C3); no amount,
// rate, net or price (D78).
import type { CreatorNetworkLine } from "@influx/contracts/creator-profile";
import {
  CREATOR_HANDLE_MAX_LENGTH,
  CREATOR_PROFILE_URL_MAX_LENGTH,
  CREATOR_PSEUDONYM_MAX_LENGTH,
} from "@influx/contracts/creator-profile";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { LayerBadge } from "@/components/member/ui/LayerBadge";
import { MemberButton } from "@/components/member/ui/MemberButton";
import { Notice } from "@/components/member/ui/Notice";
import { SingleChoiceField } from "@/components/member/ui/SingleChoiceField";
import { TextField } from "@/components/member/ui/TextField";
import {
  MEMBER_FIELD_HELP_CLASSES,
  memberChoiceInputClasses,
  memberChoiceRowClasses,
} from "@/components/member/ui/field-classes";
import type { ProfileLayer } from "@/components/member/ui/layer-badge-classes";
import { cn } from "@/components/ui/class-names";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { ClockIcon } from "@/components/ui/icons";
import type { ChoiceOption } from "@/components/member/ui/choice-option";
import {
  SECONDARY_FIELD_KEYS,
  areFiguresStale,
  formatFiguresDate,
  holdsPriorityFigure,
  lineControlIdOf,
  type LineFieldKey,
} from "./creator-networks-view";
import type { CreatorNetworksState } from "./use-creator-networks";

const LINE_CLASSES =
  "flex flex-col gap-5 rounded-card border-(length:--border-width-thin) border-border-default bg-surface-raised p-inset-card";
const LINE_HEADER_CLASSES = "flex flex-wrap items-center justify-between gap-3";
const LINE_TITLE_CLASSES = "font-display text-lg text-text-primary";
const METRICS_CLASSES =
  "flex flex-col gap-4 rounded-md border-(length:--border-width-thin) border-border-strong p-4";
const METRIC_GRID_CLASSES = "grid gap-4 md:grid-cols-3";
const FIGURES_CAPTION_CLASSES =
  "flex items-center gap-2 text-sm text-text-secondary";
const BANDS_CLASSES = "flex flex-col gap-2 text-sm text-text-primary";

/** The keyboard of each field: digits for a count, a decimal pad for the engagement, the default for a text. */
const INPUT_MODES: Readonly<
  Record<LineFieldKey, "numeric" | "decimal" | undefined>
> = {
  handle: undefined,
  profileUrl: undefined,
  pseudonym: undefined,
  followers: "numeric",
  posts: "numeric",
  comments: "numeric",
  reach: "numeric",
  engagement: "decimal",
};

/** Who sees each field (07 RG30, RG43, RG45, RG112): every exact figure and every identifier waits for an introduction. */
const FIELD_LAYER: Readonly<Record<LineFieldKey, ProfileLayer>> = {
  handle: "revealed",
  profileUrl: "revealed",
  pseudonym: "revealed",
  followers: "revealed",
  posts: "revealed",
  comments: "revealed",
  reach: "revealed",
  engagement: "revealed",
};

type BlockProps = {
  state: CreatorNetworksState;
  networks: readonly ChoiceOption[];
  labelOf: (networkCode: string) => string;
  bandLabelOf: (group: string, code: string) => string;
};

/** Block 3: the lines, then the choice of a network to add. */
export function NetworksFields({
  state,
  networks,
  labelOf,
  bandLabelOf,
}: BlockProps) {
  const t = useTranslations("creatorProfile");
  const [now] = useState(() => new Date());
  if (state.phase === "loading") {
    return (
      <p role="status" className="text-sm text-text-secondary">
        {t("networks.loading")}
      </p>
    );
  }
  if (state.phase !== "ready") {
    return (
      <div className="flex flex-col gap-4">
        <ErrorNotice>{t("networks.unavailable")}</ErrorNotice>
        <MemberButton variant="secondary" onClick={state.reload}>
          {t("page.retry")}
        </MemberButton>
      </div>
    );
  }
  return (
    <>
      <p className={MEMBER_FIELD_HELP_CLASSES}>{t("networks.intro")}</p>
      {state.lines.length === 0 ? (
        <Notice tone="info" announce={false}>
          {t("networks.empty")}
        </Notice>
      ) : null}
      {state.primaryMove === null ? null : (
        <Notice tone="info">
          {t("networks.primary.moved", {
            to: labelOf(state.primaryMove.to),
            from: labelOf(state.primaryMove.from),
          })}
        </Notice>
      )}
      {state.lines.map((line) => (
        <NetworkLine
          key={line.id}
          line={line}
          state={state}
          now={now}
          labelOf={labelOf}
          bandLabelOf={bandLabelOf}
        />
      ))}
      {state.actionFailed ? (
        <ErrorNotice>{t("networks.failed")}</ErrorNotice>
      ) : null}
      <SingleChoiceField
        name="creator-network-add"
        options={networks}
        value={null}
        onChange={state.add}
        placeholder={t("networks.add.placeholder")}
        label={t("networks.add.label")}
        layer={{ layer: "public", label: t("layer.public") }}
        help={t("networks.add.help")}
      />
    </>
  );
}

function NetworkLine({
  line,
  state,
  now,
  labelOf,
  bandLabelOf,
}: {
  line: CreatorNetworkLine;
  state: CreatorNetworksState;
  now: Date;
  labelOf: (networkCode: string) => string;
  bandLabelOf: (group: string, code: string) => string;
}) {
  const t = useTranslations("creatorProfile");
  const locale = useLocale();
  const draft = state.drafts[line.id];
  const errors = state.errors[line.id] ?? {};
  const network = labelOf(line.networkCode);
  const firstField = useRef<HTMLDivElement>(null);
  const added = state.addedLineId === line.id;
  useEffect(() => {
    // A line just added takes the focus on its first field, so the next gesture is typing.
    if (added) {
      firstField.current?.querySelector("input")?.focus();
    }
  }, [added]);
  if (draft === undefined) {
    return null;
  }

  /** The help of a field: the hint of the writing for the two counts that have one, its own text otherwise. */
  const helpOf = (key: LineFieldKey): string => {
    if (key === "posts") {
      return t("posts30d.hint");
    }
    if (key === "comments") {
      return t("comments.hint");
    }
    return t(`networks.fields.${key}.help`);
  };

  const field = (key: LineFieldKey, limit: number) => {
    const error = errors[key];
    return (
      <TextField
        id={lineControlIdOf(line.id, key)}
        name={`${line.id}-${key}`}
        value={draft[key]}
        maxLength={limit}
        onChange={(value) => state.change(line.id, key, value)}
        type={key === "profileUrl" ? "url" : "text"}
        inputMode={INPUT_MODES[key]}
        label={t(`networks.fields.${key}.label`)}
        requiredLabel={
          line.isPrimary &&
          (key === "handle" || key === "profileUrl" || key === "followers")
            ? t("field.required")
            : undefined
        }
        layer={{
          layer: FIELD_LAYER[key],
          label: t(`layer.${FIELD_LAYER[key]}`),
        }}
        help={helpOf(key)}
        error={error === undefined ? undefined : t(`issues.${error}`)}
      />
    );
  };

  const stale = areFiguresStale(line.figuresMeasuredAt, now);
  const source =
    line.figuresSource === "agent_observed"
      ? t("figures.source.agent_observed")
      : t("figures.source.declared");
  const caption =
    line.figuresMeasuredAt === null
      ? t("figures.undated", { source })
      : t("figures.dated", {
          source,
          date: formatFiguresDate(line.figuresMeasuredAt, locale),
        });
  const bands = line.bands;

  return (
    <article
      className={LINE_CLASSES}
      aria-labelledby={`${lineControlIdOf(line.id, "handle")}-title`}
      data-network-line={line.networkCode}
    >
      <div className={LINE_HEADER_CLASSES}>
        <h3
          id={`${lineControlIdOf(line.id, "handle")}-title`}
          className={LINE_TITLE_CLASSES}
        >
          {network}
        </h3>
        <MemberButton
          variant="text"
          onClick={() => state.remove(line.id)}
          aria-label={t("networks.removeNamed", { network })}
        >
          {t("networks.remove")}
        </MemberButton>
      </div>

      <div className="flex flex-col gap-1">
        <label className={memberChoiceRowClasses()}>
          <input
            type="radio"
            name="creator-primary-network"
            checked={line.isPrimary}
            onChange={() => state.makePrimary(line.id)}
            className={memberChoiceInputClasses()}
          />
          <span>{t("networks.primary.label")}</span>
        </label>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <LayerBadge layer="public" label={t("layer.public")} />
          <span className={MEMBER_FIELD_HELP_CLASSES}>
            {t("networks.primary.help")}
          </span>
        </div>
      </div>

      <div ref={firstField} className="flex flex-col gap-5">
        {field("handle", CREATOR_HANDLE_MAX_LENGTH)}
        {field("profileUrl", CREATOR_PROFILE_URL_MAX_LENGTH)}
        {field("pseudonym", CREATOR_PSEUDONYM_MAX_LENGTH)}
      </div>

      <div
        role="group"
        aria-labelledby={`${lineControlIdOf(line.id, "followers")}-group`}
        className={METRICS_CLASSES}
      >
        <h4
          id={`${lineControlIdOf(line.id, "followers")}-group`}
          className="font-display text-text-primary"
        >
          {t("networks.metrics.title")}
        </h4>
        <p className={MEMBER_FIELD_HELP_CLASSES}>
          {t("priorityMetrics.explain")}
        </p>
        <div className={METRIC_GRID_CLASSES}>
          {field("followers", 15)}
          {field("posts", 10)}
          {field("comments", 15)}
        </div>
        <p className={FIGURES_CAPTION_CLASSES}>
          <ClockIcon
            aria-hidden="true"
            className="size-(--size-icon-sm) shrink-0"
          />
          <span data-figures-caption="">{caption}</span>
        </p>
        {stale && line.figuresMeasuredAt !== null ? (
          <Notice tone="warning">
            {t("figures.stale", {
              date: formatFiguresDate(line.figuresMeasuredAt, locale),
            })}
          </Notice>
        ) : null}
        {state.toConfirm.has(line.id) ? (
          <Notice tone="info">{t("figures.confirmAll")}</Notice>
        ) : null}
        {holdsPriorityFigure(line) || state.toConfirm.has(line.id) ? (
          <div>
            <MemberButton
              variant="secondary"
              onClick={() => state.confirm(line.id)}
            >
              {t("figures.confirm")}
            </MemberButton>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {SECONDARY_FIELD_KEYS.map((key) => (
          <div key={key} className="flex flex-col gap-2">
            {field(key, key === "engagement" ? 6 : 15)}
            {key === "engagement" && line.figuresSource !== "agent_observed" ? (
              <p className={cn(MEMBER_FIELD_HELP_CLASSES)}>
                {t("engagement.unverified")}
              </p>
            ) : null}
          </div>
        ))}
      </div>

      {line.isPrimary ? (
        <div className={BANDS_CLASSES} data-bands="">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="font-semibold">{t("networks.bands.title")}</p>
            <LayerBadge layer="public" label={t("layer.public")} />
          </div>
          {bands === null ||
          (bands.audienceBand === null &&
            bands.publicationFrequency === null &&
            bands.commentBand === null) ? (
            <p className={MEMBER_FIELD_HELP_CLASSES}>
              {t("networks.bands.none")}
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {bands.audienceBand === null ? null : (
                <li>
                  {t("networks.bands.audience", {
                    band: bandLabelOf("audience_band", bands.audienceBand),
                  })}
                </li>
              )}
              {bands.publicationFrequency === null ? null : (
                <li>
                  {t("networks.bands.frequency", {
                    band: bandLabelOf(
                      "publication_frequency",
                      bands.publicationFrequency,
                    ),
                  })}
                </li>
              )}
              {bands.commentBand === null ? null : (
                <li>
                  {t("networks.bands.comments", {
                    band: bandLabelOf("comment_band", bands.commentBand),
                  })}
                </li>
              )}
            </ul>
          )}
        </div>
      ) : null}
    </article>
  );
}
