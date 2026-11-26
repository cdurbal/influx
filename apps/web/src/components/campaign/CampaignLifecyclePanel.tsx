"use client";

// "Vie de la campagne" (docs/mvp/09 RG8, RG9; 17 §4.9; jalons/l3c, commit 10): what a brand does with a campaign
// INFLUX published — pause it (applications on hold, conversations already open untouched), resume it (a pause it
// made itself; no new review), close it for good. Closing asks for a confirmation that says it is irreversible
// BEFORE it is done (17 §4.9). The campaign is read as it is, its fields set (Q1: no editing of a published
// campaign here); the answer of a passage is the new state of the screen, and a refusal (the state changed
// elsewhere, a pause of INFLUX that is not the brand's to lift) is told in words with the real state shown. The
// base decides and journals; nothing is decided here. No amount, no commission (CLAUDE.md §2, D78).
import type { CampaignResponse } from "@influx/contracts/campaign";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { useMember } from "@/components/member/member-context";
import { Card } from "@/components/member/ui/Card";
import { Button } from "@/components/member/ui/Button";
import { Notice } from "@/components/member/ui/Notice";
import { CARD_TITLE } from "@/components/member/ui/heading-classes";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { passCampaign } from "./campaign-api";
import {
  lifecycleActionsOf,
  passageFailureKeyOf,
  type LifecycleAction,
} from "./campaign-view";

type Outcome =
  | { kind: "none" }
  | { kind: "done"; action: LifecycleAction }
  | { kind: "failed"; key: ReturnType<typeof passageFailureKeyOf> };

const BUSY_KEYS = {
  pause: "pausing",
  resume: "resuming",
  close: "closing",
} as const satisfies Record<LifecycleAction, string>;

export function CampaignLifecyclePanel({
  campaign,
  onChanged,
  onStale,
}: {
  campaign: CampaignResponse;
  /** The campaign a passage answered: the new state of the screen. */
  onChanged: (campaign: CampaignResponse) => void;
  /** A passage the state no longer allows: the screen reads the campaign again. */
  onStale: () => Promise<void>;
}) {
  const t = useTranslations("campaign");
  const { signedOut } = useMember();
  const [busy, setBusy] = useState<LifecycleAction | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>({ kind: "none" });
  const outcomeRef = useRef<HTMLDivElement>(null);
  const warningId = useId();
  const warningRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const actions = lifecycleActionsOf(campaign.status);

  // The button that was pressed is gone once the state changed: the focus goes to what was said (17 §2.2).
  useEffect(() => {
    if (outcome.kind !== "none") {
      outcomeRef.current?.focus();
    }
  }, [outcome]);
  useEffect(() => {
    if (confirmClose) {
      warningRef.current?.focus();
    }
  }, [confirmClose]);

  async function pass(action: LifecycleAction) {
    if (busy !== null) {
      return;
    }
    setBusy(action);
    setConfirmClose(false);
    setOutcome({ kind: "none" });
    const result = await passCampaign(campaign.id, action);
    if (result.kind === "ok") {
      onChanged(result.data);
      setOutcome({ kind: "done", action });
    } else if (result.kind === "unauthenticated") {
      signedOut(null);
    } else {
      const key = passageFailureKeyOf(result);
      setOutcome({ kind: "failed", key });
      if (key !== "unavailable") {
        await onStale();
      }
    }
    setBusy(null);
  }

  const description =
    campaign.status === "published" ||
    campaign.status === "paused" ||
    campaign.status === "closed"
      ? t(`lifecycle.${campaign.status}`)
      : null;
  if (description === null) {
    return null;
  }

  return (
    <Card>
      <h2 className={CARD_TITLE}>{t("lifecycle.title")}</h2>
      <p className="text-md text-text-secondary">{description}</p>
      {outcome.kind === "none" ? null : (
        <div ref={outcomeRef} tabIndex={-1}>
          {outcome.kind === "done" ? (
            <Notice tone="success">
              <p>{t(`lifecycle.done.${outcome.action}`)}</p>
            </Notice>
          ) : (
            <ErrorNotice>
              <p>{t(`lifecycle.failed.${outcome.key}`)}</p>
            </ErrorNotice>
          )}
        </div>
      )}
      {confirmClose ? (
        <div className="flex flex-col gap-3">
          <div ref={warningRef} tabIndex={-1} role="alert" id={warningId}>
            <Notice tone="warning" announce={false}>
              <p>{t("lifecycle.closeWarning")}</p>
            </Notice>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="danger"
              aria-describedby={warningId}
              aria-disabled={busy !== null || undefined}
              onClick={() => void pass("close")}
            >
              {busy === "close"
                ? t("lifecycle.closing")
                : t("lifecycle.closeConfirm")}
            </Button>
            <Button
              variant="text"
              onClick={() => {
                setConfirmClose(false);
                // the button that opened the question is back: the focus goes with it
                requestAnimationFrame(() => closeButtonRef.current?.focus());
              }}
            >
              {t("lifecycle.cancel")}
            </Button>
          </div>
        </div>
      ) : actions.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3">
          {actions.map((action) =>
            action === "close" ? (
              <Button
                key={action}
                ref={closeButtonRef}
                variant="secondary"
                aria-disabled={busy !== null || undefined}
                onClick={() => {
                  if (busy === null) {
                    setConfirmClose(true);
                  }
                }}
              >
                {t("lifecycle.close")}
              </Button>
            ) : (
              <Button
                key={action}
                variant={action === "resume" ? "primary" : "secondary"}
                aria-disabled={busy !== null || undefined}
                onClick={() => void pass(action)}
              >
                {busy === action
                  ? t(`lifecycle.${BUSY_KEYS[action]}`)
                  : t(`lifecycle.${action}`)}
              </Button>
            ),
          )}
        </div>
      ) : null}
    </Card>
  );
}
