"use client";

// The choice of door (docs/mvp/05 RG1, RG3; 17 §3): brand or creator, chosen BEFORE screen 1, or
// when "Change" is pressed on screens 1 and 3, or after the code on the sign-in page when the
// address has no account yet. A choice only: nothing is sent, nothing is created (RG5).
import type { SignupDoor } from "@influx/contracts/auth";
import { useTranslations } from "next-intl";
import { DOOR_BUTTON_CLASSES, LEAD_CLASSES } from "./auth-classes";
import { StepTitle } from "./AuthScreen";

const DOORS: readonly SignupDoor[] = ["advertiser", "creator"];

export function DoorStep({
  onChoose,
}: {
  onChoose: (door: SignupDoor) => void;
}) {
  const t = useTranslations("auth");
  return (
    <>
      <StepTitle step={null}>{t("door.title")}</StepTitle>
      <p className={LEAD_CLASSES}>{t("door.lead")}</p>
      <ul className="flex flex-col gap-4">
        {DOORS.map((door) => (
          <li key={door}>
            <button
              type="button"
              onClick={() => onChoose(door)}
              className={DOOR_BUTTON_CLASSES}
            >
              <span className="text-lead font-bold text-text-primary">
                {t(`door.${door}.action`)}
              </span>
              <span className="text-sm text-text-secondary">
                {t(`door.${door}.audience`)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
