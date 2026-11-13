"use client";

// The key messages of a campaign (docs/mvp/17 §4.3; 09 RG24, RG27): one to five bullets of 10 to 200
// characters, recommended, never a paragraph. One line of text per bullet, each with its own label;
// a blank bullet is no bullet (the API drops it). The warnings of RG21 to RG23 are told for the
// whole list under it. The bounds are packages/domain's, the cap told before it is reached.
import {
  CAMPAIGN_KEY_MESSAGE_MAX_LENGTH,
  CAMPAIGN_KEY_MESSAGES_MAX,
} from "./campaign-domain";
import { useTranslations } from "next-intl";
import { MemberButton } from "@/components/member/ui/MemberButton";
import { FieldFrame } from "@/components/member/ui/FieldFrame";
import { describedByOf, useFieldIds } from "@/components/member/ui/field-ids";
import { memberControlClasses } from "@/components/member/ui/field-classes";
import { PlusIcon, Trash2Icon } from "@/components/ui/icons";
import {
  DELIVERABLE_CELL_CLASSES,
  DELIVERABLE_LABEL_CLASSES,
  LIST_ACTIONS_CLASSES,
} from "./campaign-classes";
import {
  useCampaignFieldTexts,
  type CampaignFieldsProps,
} from "./campaign-field-texts";
import { controlIdOf } from "./campaign-view";

export function KeyMessagesField({
  draft,
  errors,
  change,
}: Pick<CampaignFieldsProps, "draft" | "errors" | "change">) {
  const t = useTranslations("campaign");
  const texts = useCampaignFieldTexts(errors, draft);
  const ids = useFieldIds(controlIdOf("keyMessages"));
  // The first bullet is always there to be typed in; it is kept once something is typed in it.
  const lines = draft.keyMessages.length === 0 ? [""] : draft.keyMessages;
  const frame = texts(
    "keyMessages",
    "public",
    t("fields.keyMessages.label"),
    undefined,
    draft.keyMessages,
  );
  const atCap = lines.length >= CAMPAIGN_KEY_MESSAGES_MAX;

  function replace(index: number, value: string) {
    change(
      "keyMessages",
      lines.map((line, position) => (position === index ? value : line)),
    );
  }

  return (
    <FieldFrame
      {...frame}
      help={`${t("fields.keyMessages.help")} ${t("field.keyMessageLimit", { max: CAMPAIGN_KEY_MESSAGES_MAX })}`}
      ids={ids}
      kind="group"
      describedBy={describedByOf(
        frame.layer && ids.layer,
        ids.help,
        (frame.warnings?.length ?? 0) > 0 && ids.warning,
        frame.error !== undefined && frame.error !== null && ids.error,
      )}
    >
      {lines.map((line, index) => {
        const inputId =
          index === 0 ? ids.control : `${ids.control}-${index + 1}`;
        return (
          <div key={index} className="flex items-end gap-2">
            <div className={DELIVERABLE_CELL_CLASSES}>
              <label htmlFor={inputId} className={DELIVERABLE_LABEL_CLASSES}>
                {t("field.keyMessageLabel", { number: index + 1 })}
              </label>
              <input
                id={inputId}
                name={`keyMessage${index + 1}`}
                type="text"
                autoComplete="off"
                maxLength={CAMPAIGN_KEY_MESSAGE_MAX_LENGTH}
                value={line}
                onChange={(event) => replace(index, event.target.value)}
                className={memberControlClasses(false)}
              />
            </div>
            {lines.length > 1 ? (
              <MemberButton
                variant="text"
                aria-label={t("field.removeKeyMessage", { number: index + 1 })}
                onClick={() =>
                  change(
                    "keyMessages",
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
              change("keyMessages", [...lines, ""]);
            }
          }}
        >
          <PlusIcon aria-hidden="true" className="size-(--size-icon-md)" />
          {t("field.addKeyMessage")}
        </MemberButton>
      </div>
    </FieldFrame>
  );
}
