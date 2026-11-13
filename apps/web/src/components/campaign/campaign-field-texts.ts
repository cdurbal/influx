"use client";

// What every field of the campaign form says about itself (docs/mvp/09 RG110): its label, that it is
// required (written), who sees it (the layer: icon and text), its help, the warning its text calls
// for (RG21 to RG23, a signal and never a refusal) and the message of its error, which the control
// points to by `aria-describedby`. Shared by the three steps; the fields only display the draft and
// report a change.
import type { CampaignReferences } from "@influx/contracts/campaign";
import type { CampaignResponse } from "@influx/contracts/campaign";
import { useTranslations } from "next-intl";
import type { FieldTexts } from "@/components/member/ui/FieldFrame";
import type { CampaignOptions } from "./campaign-options";
import {
  isRequired,
  warningKeysOf,
  type CampaignDraft,
  type DraftKey,
  type FieldErrors,
} from "./campaign-view";

/** What each step receives: the campaign as the API said it, the draft, the errors, the choices. */
export type CampaignFieldsProps = {
  campaign: CampaignResponse;
  references: CampaignReferences;
  draft: CampaignDraft;
  errors: FieldErrors;
  options: CampaignOptions;
  change: <Key extends DraftKey>(key: Key, value: CampaignDraft[Key]) => void;
};

/** Who sees a field: the campaign's readers, or the brand and its INFLUX account manager alone. */
export type CampaignLayer = "public" | "internal";

/** The texts of a field from its key. `texts` is used as `{...texts("title", "public", label, help)}`. */
export function useCampaignFieldTexts(
  errors: FieldErrors,
  draft: CampaignDraft,
) {
  const t = useTranslations("campaign");
  const tBrand = useTranslations("brandProfile");
  return (
    key: DraftKey,
    layer: CampaignLayer,
    label: string,
    help?: string,
    texts?: readonly string[],
  ): FieldTexts => {
    const error = errors[key];
    return {
      label,
      requiredLabel: isRequired(key, draft)
        ? tBrand("field.required")
        : undefined,
      layer: { layer, label: t(`layer.${layer}`) },
      help,
      error: error === undefined ? undefined : t(`fieldErrors.${error}`),
      warnings:
        texts === undefined
          ? undefined
          : warningKeysOf(texts).map((warning) => t(`errors.${warning}`)),
    };
  };
}
