"use client";

// Block 3 of "mon profil" (creator; docs/mvp/17 §5.2; 07 RG41 to RG50, RG112 to RG116, CA10 to CA12,
// CA18; jalons/l2d, commit 13): one card per network line, the three priority metrics at the head of
// each (followers, posts of the last 30 days, average comments, in this order), the two secondary
// indicators after them, the source AND the date of the figures on every line (RG49), the choice of
// the main account that says out loud which line it unchecked (CA11), "Confirmer mes chiffres"
// (RG116). The fields only display the draft and report a change: the patch, the checks and the
// bands are creator-networks-view.ts and apps/api. The badge and the state of the verification of
// each line are components/verification's (L2E, commit 18), drawn at the foot of the card; no
// screenshot here (C3); no amount, rate, net or price (D78).
import type { CreatorNetworkLine } from "@influx/contracts/creator-profile";
import {
  CREATOR_HANDLE_MAX_LENGTH,
  CREATOR_PROFILE_URL_MAX_LENGTH,
  CREATOR_PSEUDONYM_MAX_LENGTH,
} from "@influx/contracts/creator-profile";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useMember } from "@/components/member/member-context";
import { LayerBadge } from "@/components/member/ui/LayerBadge";
import { MemberButton } from "@/components/member/ui/MemberButton";
import { Notice } from "@/components/member/ui/Notice";
import { SingleChoiceField } from "@/components/member/ui/SingleChoiceField";
import { TextField } from "@/components/member/ui/TextField";
import {
  MEMBER_FIELD_HEADER_CLASSES,
  MEMBER_FIELD_HELP_CLASSES,
  memberChoiceInputClasses,
  memberChoiceRowClasses,
} from "@/components/member/ui/field-classes";
import type { ProfileLayer } from "@/components/member/ui/layer-badge-classes";
import { cn } from "@/components/ui/class-names";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { BadgeCheckIcon, ClockIcon } from "@/components/ui/icons";
import type { ChoiceOption } from "@/components/member/ui/choice-option";
import {
  GROUP_TITLE_CLASSES,
  LINE_TITLE_CLASSES,
} from "./creator-profile-classes";
import {
  SECONDARY_FIELD_KEYS,
  areFiguresStale,
  formatFiguresDate,
  holdsEveryPriorityFigure,
  holdsPriorityFigure,
  lineControlIdOf,
  type LineFieldKey,
} from "./creator-networks-view";
import type { CreatorNetworksState } from "./use-creator-networks";
import {
  useCreatorVerification,
  type CreatorVerificationState,
} from "@/components/verification/use-creator-verification";
import { VerificationLineState } from "@/components/verification/VerificationLineState";
import { hostLineIdsOf } from "@/components/verification/verification-view";

const LINE_CLASSES =
  "flex flex-col gap-5 rounded-card border-(length:--border-width-thin) border-border-default bg-surface-raised p-inset-card";
const LINE_HEADER_CLASSES = "flex flex-wrap items-center justify-between gap-3";
const METRICS_CLASSES =
  "flex flex-col gap-4 rounded-md border-(length:--border-width-thin) border-border-strong p-4";
// One column at every width (L2DU-6): the three metrics read one, two, three, whatever the help of each.
const METRIC_LIST_CLASSES = "flex flex-col gap-5";
const FIGURES_CAPTION_CLASSES =
  "flex items-center gap-2 text-sm text-text-secondary";
// « Constaté par INFLUX » and « déclaré par vous » never look alike (08 RG19, L2E commit 19): the observed
// caption carries the badge's own icon, a bold weight and the verified tint of the badge, the declared one
// the clock and the plain text. The words say the source on their own, the colour never does it alone.
const OBSERVED_CAPTION_CLASSES =
  "flex items-center gap-2 text-sm font-semibold text-verified-text";
const BAND_SEEN_CLASSES = "text-sm font-semibold text-text-primary";

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

/** The band a brand sees for each of the three metrics, as a group of the reference lists (07 RG22, RG114, RG115). */
const METRIC_BAND: Readonly<
  Record<
    "followers" | "posts" | "comments",
    {
      group: "audience_band" | "publication_frequency" | "comment_band";
      of: (bands: NonNullable<CreatorNetworkLine["bands"]>) => string | null;
    }
  >
> = {
  followers: { group: "audience_band", of: (bands) => bands.audienceBand },
  posts: {
    group: "publication_frequency",
    of: (bands) => bands.publicationFrequency,
  },
  comments: { group: "comment_band", of: (bands) => bands.commentBand },
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
  const { signedOut } = useMember();
  // The state of the verification of every line: one read for the block (08 RG13, L2E commit 18).
  const verification = useCreatorVerification({
    onSignedOut: () => signedOut(null),
  });
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
  const hosts = hostLineIdsOf(state.lines);
  return (
    <>
      <p className={MEMBER_FIELD_HELP_CLASSES}>{t("networks.intro")}</p>
      {state.lines.length === 0 ? (
        <Notice tone="info" announce={false}>
          {t("networks.empty")}
        </Notice>
      ) : null}
      {state.lines.map((line) => (
        <NetworkLine
          key={line.id}
          line={line}
          state={state}
          verification={hosts.has(line.id) ? verification : null}
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
  verification,
  now,
  labelOf,
  bandLabelOf,
}: {
  line: CreatorNetworkLine;
  state: CreatorNetworksState;
  /** The verification of the network, on the line that speaks for it (hostLineIdsOf); null on the others. */
  verification: CreatorVerificationState | null;
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
  // L2DU-10: a removal is asked in the line itself, before the call; the focus follows the choice.
  const [confirming, setConfirming] = useState(false);
  const removeButton = useRef<HTMLButtonElement>(null);
  const keepButton = useRef<HTMLButtonElement>(null);
  const answered = useRef(false);
  useEffect(() => {
    // A line just added takes the focus on its first field, so the next gesture is typing.
    if (added) {
      firstField.current?.querySelector("input")?.focus();
    }
  }, [added]);
  useEffect(() => {
    // The button that was pressed is gone: the focus goes to "Garder" (the safe answer), or back to
    // "Retirer" once the removal is given up.
    if (confirming) {
      keepButton.current?.focus();
    } else if (answered.current) {
      removeButton.current?.focus();
    }
  }, [confirming]);
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

  /**
   * A priority metric and, under it, what a brand sees of it (L2DU-7, 17 §5.2): the band the system
   * derived from the main line, read as the API says it; the other lines give none (RG22).
   */
  const metric = (key: "followers" | "posts" | "comments", limit: number) => {
    const bands = line.bands;
    const band = bands === null ? null : METRIC_BAND[key].of(bands);
    return (
      <div key={key} className="flex flex-col gap-2">
        {field(key, limit)}
        {!line.isPrimary ? null : band === null ? (
          <p className={MEMBER_FIELD_HELP_CLASSES} data-band-of={key}>
            {t("networks.bands.notYet")}
          </p>
        ) : (
          <p className={BAND_SEEN_CLASSES} data-band-of={key}>
            {t("networks.bands.seen", {
              band: bandLabelOf(METRIC_BAND[key].group, band),
            })}
          </p>
        )}
      </div>
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
  const titleId = `${lineControlIdOf(line.id, "handle")}-title`;

  return (
    <article
      className={LINE_CLASSES}
      aria-labelledby={titleId}
      data-network-line={line.networkCode}
    >
      <div className={LINE_HEADER_CLASSES}>
        <h3 id={titleId} className={LINE_TITLE_CLASSES}>
          {network}
        </h3>
        {confirming ? (
          <div
            role="group"
            aria-labelledby={`${titleId}-confirm`}
            className="flex flex-wrap items-center gap-x-3 gap-y-1"
          >
            <p
              id={`${titleId}-confirm`}
              className="text-md font-semibold text-text-primary"
            >
              {t("networks.removeConfirm", { network })}
            </p>
            <MemberButton
              variant="danger"
              onClick={() => state.remove(line.id)}
              aria-label={t("networks.removeNow", { network })}
            >
              {t("networks.remove")}
            </MemberButton>
            <MemberButton
              ref={keepButton}
              variant="secondary"
              onClick={() => {
                answered.current = true;
                setConfirming(false);
              }}
              aria-label={t("networks.removeKeepNamed", { network })}
            >
              {t("networks.removeKeep")}
            </MemberButton>
          </div>
        ) : (
          <MemberButton
            ref={removeButton}
            variant="text"
            onClick={() => setConfirming(true)}
            aria-label={t("networks.removeNamed", { network })}
          >
            {t("networks.remove")}
          </MemberButton>
        )}
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
        <div className={MEMBER_FIELD_HEADER_CLASSES}>
          <LayerBadge layer="public" label={t("layer.public")} />
          <span className={MEMBER_FIELD_HELP_CLASSES}>
            {t("networks.primary.help")}
          </span>
        </div>
        {/* L2DU-9: said where the finger is, in the line that became the main one (no jump above it). */}
        {line.isPrimary && state.primaryMove !== null ? (
          <Notice tone="info">
            {t("networks.primary.moved", {
              to: labelOf(state.primaryMove.to),
              from: labelOf(state.primaryMove.from),
            })}
          </Notice>
        ) : null}
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
          className={GROUP_TITLE_CLASSES}
        >
          {t("networks.metrics.title")}
        </h4>
        <p className={MEMBER_FIELD_HELP_CLASSES}>
          {t("priorityMetrics.explain")}
        </p>
        <div className={METRIC_LIST_CLASSES}>
          {metric("followers", 15)}
          {metric("posts", 10)}
          {metric("comments", 15)}
        </div>
        <p
          className={
            line.figuresSource === "agent_observed"
              ? OBSERVED_CAPTION_CLASSES
              : FIGURES_CAPTION_CLASSES
          }
          data-figures-source={line.figuresSource}
        >
          {line.figuresSource === "agent_observed" ? (
            <BadgeCheckIcon
              aria-hidden="true"
              className="size-(--size-icon-sm) shrink-0"
            />
          ) : (
            <ClockIcon
              aria-hidden="true"
              className="size-(--size-icon-sm) shrink-0"
            />
          )}
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
          <Notice tone="info">
            {holdsEveryPriorityFigure(line)
              ? t("figures.confirmAll")
              : t("figures.confirmSome")}
          </Notice>
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {SECONDARY_FIELD_KEYS.map((key) => (
          <div key={key} className="flex min-w-0 flex-col gap-2">
            {field(key, key === "engagement" ? 6 : 15)}
            {key === "engagement" && line.figuresSource !== "agent_observed" ? (
              <p className={cn(MEMBER_FIELD_HELP_CLASSES)}>
                {t("engagement.unverified")}
              </p>
            ) : null}
          </div>
        ))}
      </div>

      {verification === null ? null : (
        <VerificationLineState
          line={line}
          network={network}
          verification={verification}
        />
      )}
    </article>
  );
}
