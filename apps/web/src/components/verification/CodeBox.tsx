"use client";

// The code a member publishes (docs/mvp/08 RG21 to RG24; 06 RG51; jalons/l2f fix-1, L2FU-1): the code,
// « Copier », what the copy did, and until when the code is valid. One box for the screens that show it:
// the second screen of a draft, and the third once the request is sent while the code still lives (a
// request an agent opened is sent at once, D83). It draws only; which code is shown is the screen's,
// read from verification-view.ts. A new code is a new box (the screen keys it by the code), so the
// state of the last copy never outlives its code.
import type { OwnCode } from "@influx/contracts/verification";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { MemberButton } from "@/components/member/ui/MemberButton";
import { MEMBER_FIELD_HELP_CLASSES } from "@/components/member/ui/field-classes";
import { CopyIcon } from "@/components/ui/icons";
import { copyText } from "@/browser/copy-text";
import { formatVerificationDate } from "./verification-view";

const ACTIONS_CLASSES = "flex flex-wrap items-center gap-3";
const CODE_BOX_CLASSES =
  "flex flex-col gap-3 rounded-md border-(length:--border-width-thin) border-border-strong bg-surface-raised p-4";
const CODE_CLASSES =
  "select-all break-all font-mono text-title-section font-bold tracking-overline text-text-primary";

export function CodeBox({ code }: { code: OwnCode }) {
  const t = useTranslations("verification");
  const locale = useLocale();
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");
  return (
    <>
      <div className={CODE_BOX_CLASSES}>
        <span className="text-sm font-semibold text-text-secondary">
          {t("ownership.code.label")}
        </span>
        <code className={CODE_CLASSES} data-ownership-code="">
          {code.code}
        </code>
        <div className={ACTIONS_CLASSES}>
          <MemberButton
            variant="secondary"
            onClick={() => {
              void copyText(code.code).then((done) =>
                setCopy(done ? "copied" : "failed"),
              );
            }}
          >
            <CopyIcon
              aria-hidden="true"
              className="size-(--size-icon-sm) shrink-0"
            />
            {t("ownership.code.copy")}
          </MemberButton>
          <span role="status" className="text-sm text-text-secondary">
            {copy === "copied"
              ? t("ownership.code.copied")
              : copy === "failed"
                ? t("ownership.code.copyFailed")
                : null}
          </span>
        </div>
      </div>
      <p className={MEMBER_FIELD_HELP_CLASSES} data-code-validity="">
        {t("verif.ownership.codeExpiry", {
          date: formatVerificationDate(code.expiresAt, locale),
        })}
      </p>
    </>
  );
}
