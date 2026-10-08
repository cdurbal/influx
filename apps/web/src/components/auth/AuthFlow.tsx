"use client";

// The one journey to sign up and to sign in (docs/mvp/05 RG2; 17 §3): door, address, code, then
// the information screen only when the verified address has no account. The same component
// serves the sign-in page (no door) and the two doors (05 RG1, RG3; 21 EC-15).
// - The answers live here, in memory, for the whole journey: going back from the code to the
//   address, or changing door on screen 3, loses nothing (05 RG111). Nothing is ever stored in the
//   browser (02 §13.2); the source of acquisition is read on arrival and kept in memory (RG121).
// - After the code, the space follows the REAL role, never the door (17 §2.5, RG66 to RG69).
// Accessibility: one h1 per step, focused at each step (StepTitle); errors in role="alert" AND
// linked to their field.
import type { SignupDoor } from "@influx/contracts/auth";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import {
  homePageOf,
  memberPageHref,
  signupPageOf,
  type MemberPage,
} from "@/lib/member-paths";
import {
  INFO_CLASSES,
  LEAD_CLASSES,
  PRIMARY_SUBMIT_CLASSES,
  TEXT_BUTTON_CLASSES,
} from "./auth-classes";
import type { EmailMessage, VerifyStep } from "./auth-steps";
import { AuthScreen, StepTitle } from "./AuthScreen";
import { CodeStep } from "./CodeStep";
import { DoorStep } from "./DoorStep";
import { EmailStep } from "./EmailStep";
import {
  acquisitionFromVisit,
  draftAfterDoorChange,
  emptySignupDraft,
  type AcquisitionInput,
  type SignupDraft,
} from "./signup-form";
import { SignupDetailsStep, type SignupExit } from "./SignupDetailsStep";
import { useOnline } from "./use-online";

/** A screen that ends the journey here, with a message (17 §2.5, §3.5). */
type Notice =
  | { kind: "roleMismatch"; role: SignupDoor }
  | { kind: "internal" }
  | { kind: "suspended" }
  | { kind: "signedUp"; role: SignupDoor };

type Step =
  // `detailsEmail`: the verified address when the door is chosen after the code; null before it.
  | { kind: "door"; detailsEmail: string | null }
  | { kind: "email"; message: EmailMessage }
  | { kind: "code"; email: string; matchingPhrase: string }
  | { kind: "details"; email: string }
  | { kind: "notice"; notice: Notice };

export function AuthFlow({
  entry,
  initialDoor,
}: {
  /** The sign-in page has no door; a sign-up page has one, or offers the choice first. */
  entry: "signIn" | "signup";
  initialDoor: SignupDoor | null;
}) {
  const locale = useLocale();
  const router = useRouter();
  const online = useOnline();
  const [door, setDoor] = useState<SignupDoor | null>(initialDoor);
  const [step, setStep] = useState<Step>(
    entry === "signup" && initialDoor === null
      ? { kind: "door", detailsEmail: null }
      : { kind: "email", message: null },
  );
  const [email, setEmail] = useState("");
  const [draft, setDraft] = useState<SignupDraft>(() =>
    emptySignupDraft(locale),
  );
  // Read once, on arrival (05 RG120, RG121): a ref, since no screen displays it.
  const acquisitionRef = useRef<AcquisitionInput | undefined>(undefined);

  useEffect(() => {
    acquisitionRef.current = acquisitionFromVisit(
      window.location.search,
      document.referrer,
      window.location.hostname,
    );
  }, []);

  function chooseDoor(chosen: SignupDoor, detailsEmail: string | null) {
    // 05 RG4: another door unticks the consent and clears the fields of the door left.
    setDraft(draftAfterDoorChange(draft, door, chosen));
    setDoor(chosen);
    setStep(
      detailsEmail === null
        ? { kind: "email", message: null }
        : { kind: "details", email: detailsEmail },
    );
  }

  function showVerified(
    verifiedEmail: string,
    verified: Exclude<VerifyStep, { kind: "codeError" }>,
  ) {
    switch (verified.kind) {
      case "signedIn":
        if (verified.roleMismatch) {
          // 05 RG67: the session is open; the notice stays until the person moves on.
          setStep({
            kind: "notice",
            notice: { kind: "roleMismatch", role: verified.role },
          });
          return;
        }
        router.replace(memberPageHref(homePageOf(verified.role), locale));
        return;
      case "signupRequired":
        setStep(
          door === null
            ? { kind: "door", detailsEmail: verifiedEmail }
            : { kind: "details", email: verifiedEmail },
        );
        return;
      case "internal":
        setStep({ kind: "notice", notice: { kind: "internal" } });
        return;
      case "suspended":
        setStep({ kind: "notice", notice: { kind: "suspended" } });
        return;
    }
  }

  function showSignupExit(exit: SignupExit) {
    switch (exit.kind) {
      case "signedUp":
        setStep({
          kind: "notice",
          notice: { kind: "signedUp", role: exit.role },
        });
        return;
      case "accountUnavailable":
        setStep({ kind: "notice", notice: { kind: "suspended" } });
        return;
      case "sessionLost":
        // The sign-up token expired: back to the address, the answers of screen 3 kept.
        setStep({ kind: "email", message: "sessionLost" });
        return;
    }
  }

  function restart() {
    setStep({ kind: "email", message: null });
  }

  /** The page offered in the other language: only before anything is typed beyond the address. */
  function languagePage(): MemberPage | null {
    if (step.kind === "door") {
      return step.detailsEmail === null ? "signupDoors" : null;
    }
    if (step.kind !== "email") {
      return null;
    }
    return entry === "signIn" ? "signIn" : signupPageOf(door);
  }

  return (
    <AuthScreen languagePage={languagePage()} online={online}>
      {step.kind === "door" ? (
        <DoorStep
          onChoose={(chosen) => chooseDoor(chosen, step.detailsEmail)}
        />
      ) : step.kind === "email" ? (
        <EmailStep
          door={door}
          email={email}
          onEmailChange={setEmail}
          initialMessage={step.message}
          online={online}
          onSent={(address, matchingPhrase) =>
            setStep({ kind: "code", email: address, matchingPhrase })
          }
          onChangeDoor={() => setStep({ kind: "door", detailsEmail: null })}
        />
      ) : step.kind === "code" ? (
        <CodeStep
          email={step.email}
          matchingPhrase={step.matchingPhrase}
          door={door}
          online={online}
          onVerified={(verified) => showVerified(step.email, verified)}
          onResent={(matchingPhrase) => setStep({ ...step, matchingPhrase })}
          onChangeEmail={restart}
        />
      ) : step.kind === "details" && door !== null ? (
        <SignupDetailsStep
          door={door}
          email={step.email}
          draft={draft}
          onDraftChange={setDraft}
          acquisition={() => acquisitionRef.current}
          online={online}
          onChangeDoor={() =>
            setStep({ kind: "door", detailsEmail: step.email })
          }
          onExit={showSignupExit}
        />
      ) : step.kind === "notice" ? (
        <NoticeStep notice={step.notice} onRestart={restart} />
      ) : null}
    </AuthScreen>
  );
}

function NoticeStep({
  notice,
  onRestart,
}: {
  notice: Notice;
  onRestart: () => void;
}) {
  const t = useTranslations("auth");
  const locale = useLocale();

  if (notice.kind === "signedUp" || notice.kind === "roleMismatch") {
    const home = memberPageHref(homePageOf(notice.role), locale);
    return (
      <>
        <StepTitle step={null}>
          {notice.kind === "signedUp"
            ? t("signup.success.title")
            : t("roleMismatch.title")}
        </StepTitle>
        <p className={notice.kind === "signedUp" ? LEAD_CLASSES : INFO_CLASSES}>
          {notice.kind === "signedUp"
            ? t("signup.success.lead")
            : t("roleMismatch.notice", { role: notice.role })}
        </p>
        <Link href={home} className={PRIMARY_SUBMIT_CLASSES}>
          {t("goToSpace")}
        </Link>
      </>
    );
  }

  const lines =
    notice.kind === "internal"
      ? [t("internalAccount.notice"), t("internalAccount.help")]
      : [t("suspended.notice")];
  return (
    <>
      <StepTitle step={null}>
        {notice.kind === "internal"
          ? t("internalAccount.title")
          : t("suspended.title")}
      </StepTitle>
      <div className={INFO_CLASSES} role="status">
        {lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
      <button type="button" onClick={onRestart} className={TEXT_BUTTON_CLASSES}>
        {t("restart")}
      </button>
    </>
  );
}
