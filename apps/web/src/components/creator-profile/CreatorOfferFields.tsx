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
import type { CreatorFieldsProps } from "./CreatorProfileFields";
import { formatFiguresDate } from "./creator-networks-view";
import type { FormatGroup } from "./creator-profile-options";
import { controlIdOf, type DraftKey } from "./creator-profile-view";

type CheckGroupProps = Omit<FieldTexts, "help"> & {
  id: string;
  /** Boxes, in groups with a heading each, or in one group without heading. */
  groups: readonly { label: string | null; options: readonly ChoiceOption[] }[];
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
  const firstCode = groups.flatMap((group) => group.options)[0]?.code;
  return (
    <FieldFrame
      {...texts}
      help={help}
      ids={ids}
      kind="group"
      describedBy={describedBy}
    >
      {groups.every((group) => group.options.length === 0) ? (
        <p className={MEMBER_FIELD_HELP_CLASSES}>{emptyText}</p>
      ) : null}
      {groups.map((group) => (
        <div key={group.label ?? "-"} className="flex flex-col gap-1">
          {group.label === null ? null : (
            <p className="mt-2 text-sm font-semibold text-text-secondary">
              {group.label}
            </p>
          )}
          {group.options.map((option) => {
            const controlId =
              option.code === firstCode ? ids.control : undefined;
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
      ))}
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

/** Block 5, "Mon offre": what the creator offers, never what it costs (D78). */
export function OfferFields({
  profile,
  draft,
  errors,
  options,
  change,
}: CreatorFieldsProps) {
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
  return (
    <>
      <Notice tone="info" announce={false}>
        {t("offer.negotiation")}
      </Notice>
      <CheckGroup
        id={controlIdOf("formats")}
        {...field("formats", "public", t("fields.formats.label"), true)}
        help={t("fields.formats.help")}
        groups={formatGroupsOf(options.formatGroups)}
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
        groups={[{ label: null, options: options.sectors }]}
        value={draft.refusedSectors}
        onToggle={(code) =>
          change("refusedSectors", toggled(draft.refusedSectors, code))
        }
        emptyText={t("offer.noList")}
      />
    </>
  );
}
