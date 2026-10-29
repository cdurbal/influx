"use client";

// Minimal home of a member space (docs/mvp/05 RG71; 17 §2.4, §2.5, §3.7), inside the member shell
// (src/components/member/MemberShell.tsx), which reads the session, sends a member without one to
// sign-in and a member of the other role to their own space, and shows the blocking terms screen
// first (17 §6.7). The home announces what comes next (the profile, Lot 2) and how INFLUX works,
// without any figure (05 RG9); "mon compte" is one link away, and signing out ends on the shell's
// "signed out" page.
import { Notice } from "@/components/member/ui/Notice";
import type { SignupDoor } from "@influx/contracts/auth";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { useMember } from "@/components/member/member-context";
import { Link } from "@/i18n/navigation";
import {
  CARD_CLASSES,
  LABEL_CLASSES,
  LEAD_CLASSES,
  SECONDARY_BUTTON_CLASSES,
  SPACE_SCREEN_CLASSES,
  TEXT_BUTTON_CLASSES,
  TITLE_CLASSES,
} from "./auth-classes";
import { memberPageHref } from "@/lib/member-paths";

/** 17 §2.4: three short steps, profile → campaign → a salesperson makes the introduction. */
const HOME_STEPS = ["one", "two", "three"] as const;

/** `space`: the role whose space this page is (the shell has checked it is the member's). */
export function MemberHome({ space }: { space: SignupDoor }) {
  const t = useTranslations("auth");
  const tAccount = useTranslations("account");
  const locale = useLocale();
  const { me, signOut } = useMember();
  const stepsTitleId = useId();
  const [busy, setBusy] = useState(false);

  async function leave() {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      await signOut();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={SPACE_SCREEN_CLASSES}>
      <h1 tabIndex={-1} className={TITLE_CLASSES}>
        {t(`home.${space}.title`)}
      </h1>
      <p className={LEAD_CLASSES}>{t(`home.${space}.lead`)}</p>
      <section aria-labelledby={stepsTitleId} className={CARD_CLASSES}>
        <h2 id={stepsTitleId} className={LABEL_CLASSES}>
          {t("home.howItWorks")}
        </h2>
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-md text-text-secondary">
          {HOME_STEPS.map((step) => (
            <li key={step}>{t(`home.${space}.steps.${step}`)}</li>
          ))}
        </ol>
      </section>
      <div className={CARD_CLASSES}>
        <Notice tone="info" announce={false}>
          {t("home.signedInAs", { email: me.email })}
        </Notice>
        <Link
          href={memberPageHref("accountDetails", locale)}
          className={TEXT_BUTTON_CLASSES}
        >
          {tAccount("homeLink")}
        </Link>
        <button
          type="button"
          onClick={leave}
          aria-disabled={busy || undefined}
          className={SECONDARY_BUTTON_CLASSES}
        >
          {busy ? t("logout.busy") : t("logout.action")}
        </button>
      </div>
    </div>
  );
}
