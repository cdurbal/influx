"use client";

// Block 4 of "mon profil" (creator; docs/mvp/17 §5.2; 07 RG55 to RG61, RG63, CA26 to CA28; jalons/l2d,
// commit 14): one card per network line, with the countries of the audience (the main one and its share,
// four others at 10 % or more), its age bands and its genders, as whole percentages. EVERY label is
// about the audience, never about the creator (RG55, CA28): "part de votre audience âgée de 25 à 34
// ans". A dimension adds up to 100 at most; what is missing reads "autres", as the API says it, and is
// never completed by the screen (RG57). The exact percentages wait for an introduction; a brand sees
// bands before it (RG58). The fields only display the draft and report a change: the body, the checks
// and the sums are creator-audience-view.ts and apps/api. No amount, rate, net or price (D78).
import type { CreatorNetworkLine } from "@influx/contracts/creator-profile";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { MemberButton } from "@/components/member/ui/MemberButton";
import { Notice } from "@/components/member/ui/Notice";
import { SingleChoiceField } from "@/components/member/ui/SingleChoiceField";
import { TextField } from "@/components/member/ui/TextField";
import { MEMBER_FIELD_HELP_CLASSES } from "@/components/member/ui/field-classes";
import type { ChoiceOption } from "@/components/member/ui/choice-option";
import { cn } from "@/components/ui/class-names";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { getLocalizedCountryOptions } from "@/content/country-codes";
import {
  GROUP_TITLE_CLASSES,
  LINE_TITLE_CLASSES,
} from "./creator-profile-classes";
import {
  AUDIENCE_AGE_CODES,
  AUDIENCE_GENDER_CODES,
  OTHER_COUNTRIES_MAX,
  audienceControlIdOf,
  audienceSumOf,
  remainderOf,
  type AudienceDimension,
  type AudienceDraft,
  type AudienceErrors,
  type AudienceRow,
} from "./creator-audience-view";
import type { CreatorAudienceState } from "./use-creator-audience";
import type { CreatorNetworksState } from "./use-creator-networks";

const LINE_CLASSES =
  "flex flex-col gap-5 rounded-card border-(length:--border-width-thin) border-border-default bg-surface-raised p-inset-card";
const GROUP_CLASSES =
  "flex flex-col gap-4 rounded-md border-(length:--border-width-thin) border-border-strong p-4";
const SHARE_GRID_CLASSES = "grid gap-4 md:grid-cols-2";
const ROW_CLASSES = "flex flex-col gap-3 md:flex-row md:items-end";
// A row of an "other country" (L2DU-5): a rule above it, so that the rows read one by one on a phone.
const OTHER_ROW_CLASSES = cn(
  ROW_CLASSES,
  "border-t-(length:--border-width-thin) border-border-default pt-4",
);

type BlockProps = {
  networks: CreatorNetworksState;
  audience: CreatorAudienceState;
  labelOf: (networkCode: string) => string;
};

/** Block 4: the audience of each line, then nothing to add (the lines are block 3's). */
export function AudienceFields({ networks, audience, labelOf }: BlockProps) {
  const t = useTranslations("creatorProfile");
  const locale = useLocale();
  const countries = useMemo<ChoiceOption[]>(
    () =>
      getLocalizedCountryOptions(locale).map(({ code, name }) => ({
        code,
        label: name,
      })),
    [locale],
  );
  if (networks.phase === "loading") {
    return (
      <p role="status" className="text-sm text-text-secondary">
        {t("networks.loading")}
      </p>
    );
  }
  if (networks.phase !== "ready") {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text-primary">{t("networks.unavailable")}</p>
        <MemberButton variant="secondary" onClick={networks.reload}>
          {t("page.retry")}
        </MemberButton>
      </div>
    );
  }
  if (networks.lines.length === 0) {
    return (
      <Notice tone="info" announce={false}>
        {t("audience.noLines")}
      </Notice>
    );
  }
  return (
    <>
      <p className={MEMBER_FIELD_HELP_CLASSES}>{t("audience.intro")}</p>
      {networks.lines.map((line) => (
        <AudienceLine
          key={line.id}
          line={line}
          audience={audience}
          countries={countries}
          network={labelOf(line.networkCode)}
        />
      ))}
    </>
  );
}

function Remainder({
  line,
  dimension,
}: {
  line: CreatorNetworkLine;
  dimension: AudienceDimension;
}) {
  const t = useTranslations("creatorProfile");
  const share = remainderOf(line, dimension);
  return share === null ? null : (
    <p className={MEMBER_FIELD_HELP_CLASSES} data-remainder={dimension}>
      {t("audience.remainder", { share })}
    </p>
  );
}

function AudienceLine({
  line,
  audience,
  countries,
  network,
}: {
  line: CreatorNetworkLine;
  audience: CreatorAudienceState;
  countries: readonly ChoiceOption[];
  network: string;
}) {
  const t = useTranslations("creatorProfile");
  const draft = audience.draftOf(line);
  const errors: AudienceErrors = audience.errorsOf(line.id);
  const update = (change: (current: AudienceDraft) => AudienceDraft) =>
    audience.change(line, change);
  // The total of each dimension is told when it is over 100 (L2DU-11): the same sum the plan refuses on.
  const sums = {
    countries: audienceSumOf([
      draft.main.share,
      ...draft.others.map((row) => row.share),
    ]),
    ages: audienceSumOf(Object.values(draft.ages)),
    genders: audienceSumOf(Object.values(draft.genders)),
  };
  const issue = (key: keyof AudienceErrors) => {
    const found = errors[key];
    if (found === undefined) {
      return undefined;
    }
    const sum =
      key === "form"
        ? Math.max(sums.countries, sums.ages, sums.genders)
        : key === "ages" || key === "genders" || key === "countries"
          ? sums[key]
          : 0;
    return t(`issues.${found}`, { sum });
  };
  const id = (field: string) => audienceControlIdOf(line.id, field);
  const exact = { layer: "revealed", label: t("layer.revealed") } as const;
  const named = { layer: "public", label: t("layer.public") } as const;
  const required = (needed: boolean) =>
    needed ? t("field.required") : undefined;

  // L2DU-5: the focus follows the row added (its country) or the row removed (the button to add one).
  const pendingFocus = useRef<{
    kind: "added" | "removed";
    index: number;
  } | null>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const othersCount = draft.others.length;
  const lineId = line.id;
  useEffect(() => {
    const wanted = pendingFocus.current;
    pendingFocus.current = null;
    if (wanted === null) {
      return;
    }
    if (wanted.kind === "added") {
      document
        .getElementById(audienceControlIdOf(lineId, `otherCode${wanted.index}`))
        ?.focus();
    } else {
      addButton.current?.focus();
    }
  }, [othersCount, lineId]);

  const setOther = (index: number, row: Partial<AudienceRow>) =>
    update((current) => ({
      ...current,
      others: current.others.map((other, position) =>
        position === index ? { ...other, ...row } : other,
      ),
    }));

  return (
    <article
      className={LINE_CLASSES}
      aria-labelledby={id("title")}
      data-audience-line={line.networkCode}
    >
      <h3 id={id("title")} className={LINE_TITLE_CLASSES}>
        {network}
      </h3>

      <div
        role="group"
        aria-labelledby={id("countries")}
        className={GROUP_CLASSES}
      >
        <h4 id={id("countries")} className={GROUP_TITLE_CLASSES}>
          {t("audience.countries.legend")}
        </h4>
        <div className={ROW_CLASSES}>
          <SingleChoiceField
            id={id("mainCode")}
            name={id("mainCode")}
            options={countries}
            value={draft.main.code === "" ? null : draft.main.code}
            placeholder={t("field.choose")}
            onChange={(code) =>
              update((current) => ({
                ...current,
                main: { ...current.main, code },
              }))
            }
            label={t("audience.countries.main")}
            requiredLabel={required(line.isPrimary)}
            layer={named}
            error={issue("mainCountry")}
            className="md:flex-1"
          />
          <TextField
            id={id("mainShare")}
            name={id("mainShare")}
            value={draft.main.share}
            maxLength={3}
            inputMode="numeric"
            onChange={(share) =>
              update((current) => ({
                ...current,
                main: { ...current.main, share },
              }))
            }
            label={t("audience.countries.mainShare")}
            requiredLabel={required(line.isPrimary)}
            layer={exact}
            error={issue("mainShare")}
            className="md:flex-1"
          />
        </div>
        {draft.others.map((row, index) => (
          <div key={index} className={OTHER_ROW_CLASSES}>
            <SingleChoiceField
              id={id(`otherCode${index}`)}
              name={id(`otherCode${index}`)}
              options={countries}
              value={row.code === "" ? null : row.code}
              placeholder={t("field.choose")}
              onChange={(code) => setOther(index, { code })}
              label={t("audience.countries.other", { index: index + 1 })}
              layer={named}
              className="md:flex-1"
            />
            <TextField
              id={id(`otherShare${index}`)}
              name={id(`otherShare${index}`)}
              value={row.share}
              maxLength={3}
              inputMode="numeric"
              onChange={(share) => setOther(index, { share })}
              label={t("audience.countries.otherShare", { index: index + 1 })}
              layer={exact}
              className="md:flex-1"
            />
            <MemberButton
              variant="text"
              onClick={() => {
                pendingFocus.current = { kind: "removed", index };
                update((current) => ({
                  ...current,
                  others: current.others.filter(
                    (_, position) => position !== index,
                  ),
                }));
              }}
              aria-label={t("audience.countries.removeOther", {
                index: index + 1,
              })}
            >
              {t("networks.remove")}
            </MemberButton>
          </div>
        ))}
        {issue("others") === undefined ? null : (
          <ErrorNotice>{issue("others")}</ErrorNotice>
        )}
        {issue("countries") === undefined ? null : (
          <ErrorNotice>{issue("countries")}</ErrorNotice>
        )}
        {draft.others.length < OTHER_COUNTRIES_MAX ? (
          <div>
            <MemberButton
              ref={addButton}
              variant="secondary"
              onClick={() => {
                pendingFocus.current = { kind: "added", index: othersCount };
                update((current) => ({
                  ...current,
                  others: [...current.others, { code: "", share: "" }],
                }));
              }}
            >
              {t("audience.countries.add")}
            </MemberButton>
          </div>
        ) : (
          <p className={MEMBER_FIELD_HELP_CLASSES}>
            {t("audience.countries.full")}
          </p>
        )}
        <Remainder line={line} dimension="countries" />
      </div>

      <ShareGroup
        legend={t("audience.ages.legend")}
        legendId={id("ages")}
        error={issue("ages")}
        remainder={<Remainder line={line} dimension="ages" />}
      >
        {AUDIENCE_AGE_CODES.map((code) => (
          <TextField
            key={code}
            id={id(`age${code}`)}
            name={id(`age${code}`)}
            value={draft.ages[code] ?? ""}
            maxLength={3}
            inputMode="numeric"
            onChange={(share) =>
              update((current) => ({
                ...current,
                ages: { ...current.ages, [code]: share },
              }))
            }
            label={t(`audience.ages.band.${code}`)}
            layer={exact}
          />
        ))}
      </ShareGroup>

      <ShareGroup
        legend={t("audience.genders.legend")}
        legendId={id("genders")}
        error={issue("genders")}
        remainder={<Remainder line={line} dimension="genders" />}
      >
        {AUDIENCE_GENDER_CODES.map((code) => (
          <TextField
            key={code}
            id={id(`gender${code}`)}
            name={id(`gender${code}`)}
            value={draft.genders[code] ?? ""}
            maxLength={3}
            inputMode="numeric"
            onChange={(share) =>
              update((current) => ({
                ...current,
                genders: { ...current.genders, [code]: share },
              }))
            }
            label={t(`audience.genders.share.${code}`)}
            layer={exact}
          />
        ))}
      </ShareGroup>

      {errors.form === undefined ? null : (
        <ErrorNotice>{issue("form")}</ErrorNotice>
      )}
    </article>
  );
}

function ShareGroup({
  legend,
  legendId,
  error,
  remainder,
  children,
}: {
  legend: string;
  legendId: string;
  error: string | undefined;
  remainder: ReactNode;
  children: ReactNode;
}) {
  return (
    <div role="group" aria-labelledby={legendId} className={GROUP_CLASSES}>
      <h4 id={legendId} className={GROUP_TITLE_CLASSES}>
        {legend}
      </h4>
      <div className={SHARE_GRID_CLASSES}>{children}</div>
      {error === undefined ? null : <ErrorNotice>{error}</ErrorNotice>}
      {remainder}
    </div>
  );
}
