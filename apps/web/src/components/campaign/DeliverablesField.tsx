"use client";

// The deliverables of a campaign (docs/mvp/17 §4.3; 09 RG34 to RG37): lines of (network, format,
// quantity), one to ten, "2 stories + 1 reel" being no "3 contents". A format belongs to a network,
// except the UGC ones, delivered to the brand, which go with any (RG36); the choices of a line are
// those of the lists the API serves. A line is kept on the screen while half entered and sent once
// it holds its network and its format (RG108: a brand interrupted in the middle of its deliverables
// never starts over). The cap is told before it is reached; no file is asked (RG45).
import {
  CAMPAIGN_DELIVERABLE_QUANTITY_MAX,
  CAMPAIGN_DELIVERABLES_MAX,
} from "./campaign-domain";
import { useTranslations } from "next-intl";
import { FieldFrame } from "@/components/member/ui/FieldFrame";
import { MemberButton } from "@/components/member/ui/MemberButton";
import { describedByOf, useFieldIds } from "@/components/member/ui/field-ids";
import { memberControlClasses } from "@/components/member/ui/field-classes";
import { PlusIcon, Trash2Icon } from "@/components/ui/icons";
import {
  DELIVERABLE_CELL_CLASSES,
  DELIVERABLE_LABEL_CLASSES,
  DELIVERABLE_ROW_CLASSES,
  LIST_ACTIONS_CLASSES,
} from "./campaign-classes";
import {
  useCampaignFieldTexts,
  type CampaignFieldsProps,
} from "./campaign-field-texts";
import {
  controlIdOf,
  formatsOfNetwork,
  newDeliverable,
  type DeliverableDraft,
} from "./campaign-view";

const QUANTITIES = Array.from(
  { length: CAMPAIGN_DELIVERABLE_QUANTITY_MAX },
  (_, index) => index + 1,
);

export function DeliverablesField({
  references,
  draft,
  errors,
  options,
  change,
}: Pick<
  CampaignFieldsProps,
  "references" | "draft" | "errors" | "options" | "change"
>) {
  const t = useTranslations("campaign");
  const tBrand = useTranslations("brandProfile");
  const texts = useCampaignFieldTexts(errors, draft);
  const ids = useFieldIds(controlIdOf("deliverables"));
  // The first line is always there to be filled in; it is kept once something is chosen in it.
  const lines =
    draft.deliverables.length === 0 ? [newDeliverable()] : draft.deliverables;
  const frame = texts("deliverables", "public", t("fields.deliverables.label"));
  const atCap = lines.length >= CAMPAIGN_DELIVERABLES_MAX;
  const hasError = frame.error !== undefined && frame.error !== null;
  const formatLabels = new Map(
    tBrandFormats(
      tBrand,
      references.formats.map((format) => format.code),
    ),
  );

  function replace(index: number, next: DeliverableDraft) {
    change(
      "deliverables",
      lines.map((line, position) => (position === index ? next : line)),
    );
  }

  return (
    <FieldFrame
      {...frame}
      help={`${t("fields.deliverables.help")} ${t("field.lineLimit", { max: CAMPAIGN_DELIVERABLES_MAX })}`}
      ids={ids}
      kind="group"
      describedBy={describedByOf(
        frame.layer && ids.layer,
        ids.help,
        hasError && ids.error,
      )}
    >
      {lines.map((line, index) => {
        const base = index === 0 ? ids.control : `${ids.control}-${index + 1}`;
        const formats =
          line.networkCode === ""
            ? []
            : formatsOfNetwork(references.formats, line.networkCode);
        return (
          <div
            key={index}
            role="group"
            aria-label={t("field.line", { number: index + 1 })}
            className={DELIVERABLE_ROW_CLASSES}
          >
            <div className={DELIVERABLE_CELL_CLASSES}>
              <label htmlFor={base} className={DELIVERABLE_LABEL_CLASSES}>
                {t("field.network")}
              </label>
              <select
                id={base}
                name={`deliverableNetwork${index + 1}`}
                value={line.networkCode}
                aria-invalid={hasError ? true : undefined}
                onChange={(event) => {
                  const networkCode = event.target.value;
                  // a format of another network does not follow its line to the new one
                  const keeps =
                    line.formatCode !== "" &&
                    formatsOfNetwork(references.formats, networkCode).includes(
                      line.formatCode,
                    );
                  replace(index, {
                    ...line,
                    networkCode,
                    formatCode: keeps ? line.formatCode : "",
                  });
                }}
                className={memberControlClasses(hasError)}
              >
                <option value="" disabled>
                  {tBrand("field.choose")}
                </option>
                {options.networks.map((network) => (
                  <option key={network.code} value={network.code}>
                    {network.label}
                  </option>
                ))}
              </select>
            </div>
            <div className={DELIVERABLE_CELL_CLASSES}>
              <label
                htmlFor={`${base}-format`}
                className={DELIVERABLE_LABEL_CLASSES}
              >
                {t("field.format")}
              </label>
              <select
                id={`${base}-format`}
                name={`deliverableFormat${index + 1}`}
                value={line.formatCode}
                disabled={line.networkCode === ""}
                aria-invalid={hasError ? true : undefined}
                onChange={(event) =>
                  replace(index, { ...line, formatCode: event.target.value })
                }
                className={memberControlClasses(hasError)}
              >
                <option value="" disabled>
                  {tBrand("field.choose")}
                </option>
                {formats.map((code) => (
                  <option key={code} value={code}>
                    {formatLabels.get(code) ?? code}
                  </option>
                ))}
              </select>
            </div>
            <div className={DELIVERABLE_CELL_CLASSES}>
              <label
                htmlFor={`${base}-quantity`}
                className={DELIVERABLE_LABEL_CLASSES}
              >
                {t("field.quantity")}
              </label>
              <select
                id={`${base}-quantity`}
                name={`deliverableQuantity${index + 1}`}
                value={line.quantity}
                onChange={(event) =>
                  replace(index, {
                    ...line,
                    quantity: Number(event.target.value),
                  })
                }
                className={memberControlClasses(false)}
              >
                {QUANTITIES.map((quantity) => (
                  <option key={quantity} value={quantity}>
                    {quantity}
                  </option>
                ))}
              </select>
            </div>
            {lines.length > 1 ? (
              <MemberButton
                variant="text"
                aria-label={t("field.removeLine", { number: index + 1 })}
                onClick={() =>
                  change(
                    "deliverables",
                    lines.filter((_, position) => position !== index),
                  )
                }
              >
                <Trash2Icon
                  aria-hidden="true"
                  className="size-(--size-icon-md)"
                />
              </MemberButton>
            ) : null}
          </div>
        );
      })}
      <div className={LIST_ACTIONS_CLASSES}>
        <MemberButton
          variant="secondary"
          aria-disabled={atCap || undefined}
          onClick={() => {
            if (!atCap) {
              change("deliverables", [...lines, newDeliverable()]);
            }
          }}
        >
          <PlusIcon aria-hidden="true" className="size-(--size-icon-md)" />
          {t("field.addLine")}
        </MemberButton>
      </div>
    </FieldFrame>
  );
}

/** The labels of the formats, the brand profile's (`reference.format.*`), a code standing for itself. */
function tBrandFormats(
  tBrand: ReturnType<typeof useTranslations<"brandProfile">>,
  codes: readonly string[],
): [string, string][] {
  return codes.map((code) => {
    const key = `reference.format.${code}` as Parameters<typeof tBrand>[0];
    return [code, tBrand.has(key) ? tBrand(key) : code];
  });
}
