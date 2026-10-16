"use client";

// The one journey to sign up and to sign in (docs/mvp/05 RG2; 17 §3): door, address, code, then
// the information screen only when the verified address has no account. The same component
// serves the sign-in page (no door) and the two doors (05 RG1, RG3; 21 EC-15).
// - The answers live here, in memory, for the whole journey: going back from the code to the
//   address, or changing door on screen 3, loses nothing (05 RG111). Nothing is ever stored in the
//   browser (02 §13.2); the source of acquisition is read on arrival and kept in memory (RG121).
// - D66 (RG111, RG130): a change of language is a client navigation; the journey is handed over
//   through journey-memory.ts (a module variable). A reload asks apps/api where the journey stands
//   (GET /v1/auth/journey, from the httpOnly journey cookies); the answers of screen 3 are not
//   kept across a reload. The URL follows the door chosen (history.replaceState).
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
  memberPagePath,
  signupPageOf,
} from "@/lib/member-paths";
import {
  HELP_CLASSES,
  INFO_CLASSES,
  LEAD_CLASSES,
  PRIMARY_SUBMIT_CLASSES,
  TEXT_BUTTON_CLASSES,
} from "./auth-classes";
import {
  codeStepOf,
  firstStepOf,
  languagePageOf,
  resumedStepOf,
  type JourneyEntry,
  type JourneyNotice,
  type JourneyStep,
  type VerifyStep,
} from "./auth-steps";
import { AuthScreen, StepTitle } from "./AuthScreen";
import { CodeStep } from "./CodeStep";
import { DoorStep } from "./DoorStep";
import { EmailStep } from "./EmailStep";
import {
  forget,
  remember,
  snapshotFits,
  takeForLocale,
} from "./journey-memory";
import { readJourney, resetJourney } from "./member-auth";
import {
  acquisitionFromVisit,
  draftAfterDoorChange,
  draftAfterLanguageChange,
  emptySignupDraft,
  type AcquisitionInput,
  type SignupDraft,
} from "./signup-form";
import { SignupDetailsStep, type SignupExit } from "./SignupDetailsStep";
import { useOnline } from "./use-online";

/** D66: past this delay, the journey starts from screen 1 rather than keep the person waiting. */
const RESUME_TIMEOUT_MS = 3_000;

/** Until the journey is resumed (or known to be new), the screen says it is loading (RG109). */
type FlowStep = JourneyStep | { kind: "loading" };

export function AuthFlow({
  entry: initialEntry,
  initialDoor,
}: {
  /** The sign-in page has no door; a sign-up page has one, or offers the choice first. */
  entry: JourneyEntry;
  initialDoor: SignupDoor | null;
}) {
  const locale = useLocale();
  const router = useRouter();
  const online = useOnline();
  // D66: the journey handed over by the other language, taken once at mount. Always null while
  // rendering on the server and at a full page load: only a client navigation finds one.
  const [handedOver] = useState(() => {
    const taken = takeForLocale(locale);
    const page =
      initialEntry === "signIn" ? "signIn" : signupPageOf(initialDoor);
    return taken !== null && snapshotFits(taken, page) ? taken : null;
  });
  // A door chosen on the sign-in page (no account for the address) makes the journey a sign-up.
  const [entry, setEntry] = useState<JourneyEntry>(
    handedOver?.entry ?? initialEntry,
  );
  const [door, setDoor] = useState<SignupDoor | null>(
    handedOver === null ? initialDoor : handedOver.door,
  );
  const [step, setStep] = useState<FlowStep>(
    handedOver?.step ?? { kind: "loading" },
  );
  const [email, setEmail] = useState(handedOver?.email ?? "");
  const [draft, setDraft] = useState<SignupDraft>(() =>
    handedOver === null
      ? emptySignupDraft(locale)
      : draftAfterLanguageChange(handedOver.draft),
  );
  // Read once, on arrival (05 RG120, RG121): a ref, since no screen displays it.
  const acquisitionRef = useRef<AcquisitionInput | undefined>(undefined);
  // The resume runs once per mount, React's development double effect included.
  const resumeStartedRef = useRef(false);

  useEffect(() => {
    acquisitionRef.current = acquisitionFromVisit(
      window.location.search,
      document.referrer,
      window.location.hostname,
      window.location.hash,
    );
    // The invitation code leaves the address bar once read: never bookmarked nor shared again.
    if (window.location.hash !== "") {
      window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname + window.location.search,
      );
    }
  }, []);

  // D66: without a journey handed over, apps/api's journey cookies say where it stands; screen 1
  // on failure (offline included: the relay client answers `failed`) or after RESUME_TIMEOUT_MS.
  useEffect(() => {
    if (handedOver !== null || resumeStartedRef.current) {
      return;
    }
    resumeStartedRef.current = true;
    const first = firstStepOf(initialEntry, initialDoor);
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      setStep(first);
    }, RESUME_TIMEOUT_MS);
    void readJourney().then((result) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      if (result.kind !== "ok") {
        setStep(first);
        return;
      }
      if (result.data.step !== "none") {
        setEmail(result.data.email);
      }
      setStep(
        resumedStepOf(result.data, initialEntry, initialDoor, Date.now()),
      );
    });
  }, [handedOver, initialEntry, initialDoor]);

  // D66: the journey on screen is what a change of language hands over; an ended one, nothing.
  useEffect(() => {
    if (step.kind === "loading") {
      return;
    }
    if (step.kind === "notice") {
      forget();
      return;
    }
    remember({ locale, entry, door, step, email, draft });
  }, [locale, entry, door, step, email, draft]);

  function chooseDoor(chosen: SignupDoor, detailsEmail: string | null) {
    // 05 RG4: another door unticks the consent and clears the fields of the door left.
    setDraft(draftAfterDoorChange(draft, door, chosen));
    setDoor(chosen);
    setEntry("signup");
    // D66: a reload (or a copied link) lands on the door chosen; no navigation, no history entry.
    window.history.replaceState(
      null,
      "",
      `${memberPagePath(signupPageOf(chosen), locale)}${window.location.search}`,
    );
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
        forget();
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

  /** "Change address" or "start again": this browser's journey ends, here and at apps/api. */
  function restart() {
    forget();
    // Not awaited: a new code request replaces the login cookie anyway, and a failed reset
    // leaves nothing to show (the relay client never throws; it answers `failed`).
    void resetJourney();
    setStep({ kind: "email", message: null });
  }

  return (
    <AuthScreen
      languagePage={languagePageOf(
        entry,
        door,
        step.kind === "loading" ? null : step,
      )}
      online={online}
    >
      {step.kind === "loading" ? (
        <LoadingStep />
      ) : step.kind === "door" ? (
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
            setStep(codeStepOf(address, matchingPhrase, Date.now()))
          }
          onChangeDoor={() => setStep({ kind: "door", detailsEmail: null })}
        />
      ) : step.kind === "code" ? (
        <CodeStep
          email={step.email}
          matchingPhrase={step.matchingPhrase}
          resendAvailableAt={step.resendAvailableAt}
          door={door}
          online={online}
          onVerified={(verified) => showVerified(step.email, verified)}
          onResent={(matchingPhrase) =>
            setStep(codeStepOf(step.email, matchingPhrase, Date.now()))
          }
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

/** RG109: the loading state of the resume, announced, never a silent blank screen. */
function LoadingStep() {
  const t = useTranslations("auth");
  return (
    <p role="status" aria-busy="true" className={HELP_CLASSES}>
      {t("journey.loading")}
    </p>
  );
}

function NoticeStep({
  notice,
  onRestart,
}: {
  notice: JourneyNotice;
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
