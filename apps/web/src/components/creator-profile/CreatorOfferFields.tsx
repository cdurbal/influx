"use client";

// Block 5 of "mon profil" (creator; docs/mvp/17 §5.4, C4 "Mon offre"; 07 §G, RG73 to RG76, RG112;
// jalons/l2d, commit 14): the formats (by network), the usage rights in TWO lists (included, optional),
// the delivery time, the exclusivity, the non-monetary counterpart, the availability with its date and
// the refused sectors. There is NO tariff: no field, no label, no attribute and no currency (D78,
// D48); the one sentence about costs says they are negotiated with the sales contact of INFLUX. The
// refused sectors are layer N: the screen says nothing of what they cause beyond "no brand is told"
// (RG75). The fields only display the draft and report a change: the patch is creator-profile-view.ts
// and apps/api.
import { useLocale, useTranslations } from "next-intl";
import { Notice } from "@/components/member/ui/Notice";
import { SingleChoiceField } from "@/components/member/ui/SingleChoiceField";
import { YesNoField } from "@/components/member/ui/YesNoField";
import type { ChoiceOption } from "@/components/member/ui/choice-option";
import {
  MEMBER_FIELD_HELP_CLASSES,
  memberChoiceInputClasses,
  memberChoiceRowClasses,
} from "@/components/member/ui/field-classes";
import { describedByOf, useFieldIds } from "@/components/member/ui/field-ids";
import { FieldFrame, type FieldTexts } from "@/components/member/ui/FieldFrame";
import { ChevronDownIcon } from "@/components/ui/icons";
import type { CreatorFieldsProps } from "./CreatorProfileFields";
import { FOLD_SUMMARY_CLASSES } from "./creator-profile-classes";
import { formatFiguresDate } from "./creator-networks-view";
import { splitFormatGroups, type FormatGroup } from "./creator-profile-options";
import { controlIdOf, type DraftKey } from "./creator-profile-view";

type BoxGroup = { label: string | null; options: readonly ChoiceOption[] };

type CheckGroupProps = Omit<FieldTexts, "help"> & {
  id: string;
  /** Boxes, in groups with a heading each, or in one group without heading. */
  groups: readonly BoxGroup[];
  /**
   * Boxes folded away in a native details element, closed, whose text says how many are checked
   * (L2DU-4): the long lists a creator rarely needs (the networks it has no account on, the refused
   * sectors).
   */
  folded?: {
    groups: readonly BoxGroup[];
    summary: (checked: number) => string;
  };
  value: readonly string[];
  onToggle: (code: string) => void;
  help?: string;
  /** Said under the boxes when the list is empty. */
  emptyText: string;
};

/** Native boxes in a group: no cap to count (the lists are shorter than the database's caps), a heading per network. */
function CheckGroup({
  id,
  groups,
  folded,
  value,
  onToggle,
  help,
  emptyText,
  ...texts
}: CheckGroupProps) {
  const ids = useFieldIds(id);
  const hasError = texts.error !== undefined && texts.error !== null;
  const describedBy = describedByOf(
    texts.layer && ids.layer,
    help !== undefined && ids.help,
    hasError && ids.error,
  );
  const everyGroup = [...groups, ...(folded?.groups ?? [])];
  const firstCode = everyGroup.flatMap((group) => group.options)[0]?.code;
  const foldedCodes = new Set(
    (folded?.groups ?? []).flatMap((group) =>
      group.options.map((option) => option.code),
    ),
  );
  const boxes = (list: readonly BoxGroup[]) =>
    list.map((group) => (
      <div key={group.label ?? "-"} className="flex flex-col gap-1">
        {group.label === null ? null : (
          <p className="mt-2 text-sm font-semibold text-text-secondary">
            {group.label}
          </p>
        )}
        {group.options.map((option) => {
          const controlId = option.code === firstCode ? ids.control : undefined;
          return (
            <label key={option.code} className={memberChoiceRowClasses()}>
              <input
                id={controlId}
                type="checkbox"
                value={option.code}
                checked={value.includes(option.code)}
                aria-invalid={hasError ? true : undefined}
                onChange={() => onToggle(option.code)}
                className={memberChoiceInputClasses()}
              />
              <span>{option.label}</span>
            </label>
          );
        })}
      </div>
    ));
  return (
    <FieldFrame
      {...texts}
      help={help}
      ids={ids}
      kind="group"
      describedBy={describedBy}
    >
      {everyGroup.every((group) => group.options.length === 0) ? (
        <p className={MEMBER_FIELD_HELP_CLASSES}>{emptyText}</p>
      ) : null}
      {boxes(groups)}
      {folded === undefined ||
      folded.groups.every((group) => group.options.length === 0) ? null : (
        <details data-fold="">
          <summary className={FOLD_SUMMARY_CLASSES}>
            <ChevronDownIcon
              aria-hidden="true"
              className="size-(--size-icon-md) shrink-0 text-text-secondary"
            />
            {folded.summary(
              value.filter((code) => foldedCodes.has(code)).length,
            )}
          </summary>
          {boxes(folded.groups)}
        </details>
      )}
    </FieldFrame>
  );
}

function toggled(list: readonly string[], code: string): string[] {
  return list.includes(code)
    ? list.filter((item) => item !== code)
    : [...list, code];
}

/** The formats as groups of boxes, one heading per network. */
function formatGroupsOf(groups: readonly FormatGroup[]) {
  return groups.map((group) => ({
    label: group.label,
    options: group.options,
  }));
}

/**
 * Block 5, "Mon offre": what the creator offers, never what it costs (D78). `networkCodes`: the
 * networks of the lines of block 3, whose formats come first (L2DU-4); `null` while block 3 is read.
 */
export function OfferFields({
  profile,
  draft,
  errors,
  options,
  change,
  networkCodes,
}: CreatorFieldsProps & { networkCodes: ReadonlySet<string> | null }) {
  const t = useTranslations("creatorProfile");
  const locale = useLocale();
  const field = (
    key: DraftKey,
    layer: "public" | "internal",
    label: string,
    required = false,
  ) => ({
    label,
    requiredLabel: required ? t("field.required") : undefined,
    layer: { layer, label: t(`layer.${layer}`) },
    error: errors[key] === undefined ? undefined : t(`issues.${errors[key]}`),
  });
  const declaredAt = profile.availabilityDeclaredAt;
  const formats = splitFormatGroups(options.formatGroups, networkCodes);
  return (
    <>
      <Notice tone="info" announce={false}>
        {t("offer.negotiation")}
      </Notice>
      <CheckGroup
        id={controlIdOf("formats")}
        {...field("formats", "public", t("fields.formats.label"), true)}
        help={t("fields.formats.help")}
        groups={formatGroupsOf(formats.shown)}
        folded={{
          groups: formatGroupsOf(formats.folded),
          summary: (checked) => t("offer.otherNetworks", { count: checked }),
        }}
        value={draft.formats}
        onToggle={(code) => change("formats", toggled(draft.formats, code))}
        emptyText={t("offer.noList")}
      />
      <CheckGroup
        id={controlIdOf("usageIncluded")}
        {...field("usageIncluded", "public", t("fields.usageIncluded.label"))}
        help={t("fields.usageIncluded.help")}
        groups={[{ label: null, options: options.usageRights }]}
        value={draft.usageIncluded}
        onToggle={(code) => {
          // A right is offered one way only (07 RG73): choosing it here takes it off the other list.
          change("usageIncluded", toggled(draft.usageIncluded, code));
          if (draft.usageOptional.includes(code)) {
            change(
              "usageOptional",
              draft.usageOptional.filter((item) => item !== code),
            );
          }
        }}
        emptyText={t("offer.noList")}
      />
      <CheckGroup
        id={controlIdOf("usageOptional")}
        {...field("usageOptional", "public", t("fields.usageOptional.label"))}
        help={t("fields.usageOptional.help")}
        groups={[{ label: null, options: options.usageRights }]}
        value={draft.usageOptional}
        onToggle={(code) => {
          change("usageOptional", toggled(draft.usageOptional, code));
          if (draft.usageIncluded.includes(code)) {
            change(
              "usageIncluded",
              draft.usageIncluded.filter((item) => item !== code),
            );
          }
        }}
        emptyText={t("offer.noList")}
      />
      <SingleChoiceField
        id={controlIdOf("deliveryLead")}
        name="deliveryLead"
        display="radios"
        options={options.deliveryLeads}
        value={draft.deliveryLead}
        onChange={(code) => change("deliveryLead", code)}
        {...field("deliveryLead", "public", t("fields.deliveryLead.label"))}
      />
      <SingleChoiceField
        id={controlIdOf("maxExclusivity")}
        name="maxExclusivity"
        display="radios"
        options={options.exclusivities}
        value={draft.maxExclusivity}
        onChange={(code) => change("maxExclusivity", code)}
        {...field("maxExclusivity", "public", t("fields.maxExclusivity.label"))}
        help={t("fields.maxExclusivity.help")}
      />
      <YesNoField
        id={controlIdOf("acceptsNonMonetary")}
        name="acceptsNonMonetary"
        value={draft.acceptsNonMonetary}
        onChange={(answer) => change("acceptsNonMonetary", answer)}
        yesLabel={t("field.yes")}
        noLabel={t("field.no")}
        {...field(
          "acceptsNonMonetary",
          "public",
          t("fields.acceptsNonMonetary.label"),
        )}
        help={t("fields.acceptsNonMonetary.help")}
      />
      <SingleChoiceField
        id={controlIdOf("availability")}
        name="availability"
        display="radios"
        options={options.availabilities}
        value={draft.availability}
        onChange={(code) => change("availability", code)}
        {...field(
          "availability",
          "public",
          t("fields.availability.label"),
          true,
        )}
        help={
          declaredAt === null || draft.availability === null
            ? t("fields.availability.help")
            : t("offer.availabilityDeclared", {
                date: formatFiguresDate(declaredAt, locale),
              })
        }
      />
      <CheckGroup
        id={controlIdOf("refusedSectors")}
        {...field(
          "refusedSectors",
          "internal",
          t("fields.refusedSectors.label"),
        )}
        help={t("fields.refusedSectors.help")}
        groups={[]}
        folded={{
          groups: [{ label: null, options: options.sectors }],
          summary: (checked) => t("offer.sectorsFold", { count: checked }),
        }}
        value={draft.refusedSectors}
        onToggle={(code) =>
          change("refusedSectors", toggled(draft.refusedSectors, code))
        }
        emptyText={t("offer.noList")}
      />
    </>
  );
}
