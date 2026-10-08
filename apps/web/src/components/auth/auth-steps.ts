// What screens 1 and 2 of the journey show, and where a journey resumes, as plain functions
// (docs/mvp/17 §3.1, §3.2, §2.5; 05 RG42, RG66 to RG69, RG111, RG112, RG136 to RG140; D66). No rule lives here: apps/api decides, and these
// functions only turn its answers, and the form check of the address, into what the screen says.
import {
  LOGIN_CODE_PATTERN,
  MAX_EMAIL_LENGTH,
  RESEND_DELAY_SECONDS,
  type JourneyResponse,
  type RequestCodeResponse,
  type SignupDoor,
  type VerifyCodeResponse,
} from "@influx/contracts/auth";
import { signupPageOf, type MemberPage } from "@/lib/member-paths";

/** What the address step shows under the field. */
export type EmailMessage =
  | "required"
  | "format"
  | "tooLong"
  | "undeliverable"
  | "rateLimited"
  | "serviceUnavailable"
  | "sessionLost"
  | null;

/** The messages of the address field itself (aria-invalid on the field). */
export function isEmailFieldError(message: EmailMessage): boolean {
  return (
    message === "required" || message === "format" || message === "tooLong"
  );
}

/** Form check only; the API decides (02 §18.10). Same shape as the contract's. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emailFormMessage(value: string): EmailMessage {
  const email = value.trim();
  if (email === "") {
    return "required";
  }
  if (email.length > MAX_EMAIL_LENGTH) {
    return "tooLong";
  }
  return EMAIL_SHAPE.test(email) ? null : "format";
}

/** 17 §3.7: the outcome of a code request, as the address step shows it. */
export function requestMessage(
  outcome: RequestCodeResponse["outcome"],
): EmailMessage {
  switch (outcome) {
    case "sent":
      return null;
    case "undeliverable":
      return "undeliverable";
    case "rate_limited":
      return "rateLimited";
    default:
      return "serviceUnavailable";
  }
}

/** What the code step shows under the field. */
export type CodeMessage =
  | { key: "required" | "format" }
  | { key: "invalid"; remaining: number }
  | {
      key:
        | "expired"
        | "tooManyAttempts"
        | "sessionLost"
        | "tooManyRequests"
        | "verifyUnavailable";
    }
  | { key: "resendLimit" }
  | null;

/** Form check of the code; null when it may be sent. */
export function codeFormMessage(value: string): CodeMessage {
  const code = value.trim();
  if (code === "") {
    return { key: "required" };
  }
  return LOGIN_CODE_PATTERN.test(code) ? null : { key: "format" };
}

/** Keeps the digits a person typed or pasted, six at most (17 §3.2: a pasted code is spread). */
export function codeDigitsOf(value: string): string {
  return value.replace(/\D/g, "").slice(0, 6);
}

/** Where a verified code leads (17 §2.5), or the message of a failed one. */
export type VerifyStep =
  | { kind: "signedIn"; role: SignupDoor; roleMismatch: boolean }
  | { kind: "signupRequired" }
  | { kind: "internal" }
  | { kind: "suspended" }
  | { kind: "codeError"; message: Exclude<CodeMessage, null>; closed: boolean };

/**
 * `doorChosen`: the person came through a door (05 RG3). On the sign-in page no door is chosen,
 * so a role "different from the door" means nothing there and no notice is shown (RG67).
 */
export function verifyStepOf(
  response: VerifyCodeResponse,
  doorChosen: boolean,
): VerifyStep {
  switch (response.outcome) {
    case "signed_in":
      return {
        kind: "signedIn",
        role: response.role,
        roleMismatch: doorChosen && response.roleMismatch,
      };
    case "signup_required":
      return { kind: "signupRequired" };
    case "internal_account":
      return { kind: "internal" };
    case "account_unavailable":
      return { kind: "suspended" };
    case "invalid":
      return {
        kind: "codeError",
        message: { key: "invalid", remaining: response.attemptsLeft },
        closed: false,
      };
    case "too_many_attempts":
      // 05 RG137: the field goes; only a new code helps.
      return {
        kind: "codeError",
        message: { key: "tooManyAttempts" },
        closed: true,
      };
    case "expired":
      return { kind: "codeError", message: { key: "expired" }, closed: false };
    case "session_lost":
      return {
        kind: "codeError",
        message: { key: "sessionLost" },
        closed: true,
      };
    case "too_many_requests":
      return {
        kind: "codeError",
        message: { key: "tooManyRequests" },
        closed: false,
      };
    default:
      return {
        kind: "codeError",
        message: { key: "verifyUnavailable" },
        closed: false,
      };
  }
}

/** 17 §3.2: the countdown text changes every ten seconds and at the last one, never each second. */
export function announcedSeconds(secondsLeft: number): number {
  return secondsLeft <= 1 ? secondsLeft : Math.ceil(secondsLeft / 10) * 10;
}

/** A screen that ends the journey here, with a message (17 §2.5, §3.5). */
export type JourneyNotice =
  | { kind: "roleMismatch"; role: SignupDoor }
  | { kind: "internal" }
  | { kind: "suspended" }
  | { kind: "signedUp"; role: SignupDoor };

/** The page the journey was opened on: the sign-in page has no door (05 RG1, RG3). */
export type JourneyEntry = "signIn" | "signup";

export type JourneyStep =
  // `detailsEmail`: the verified address when the door is chosen after the code; null before it.
  | { kind: "door"; detailsEmail: string | null }
  | { kind: "email"; message: EmailMessage }
  // `resendAvailableAt`: the instant (epoch milliseconds) a new code may be asked for (RG50), so
  // that the countdown goes on where it was after a change of language.
  | {
      kind: "code";
      email: string;
      matchingPhrase: string;
      resendAvailableAt: number;
    }
  | { kind: "details"; email: string }
  | { kind: "notice"; notice: JourneyNotice };

/** The first screen of a journey: the choice of door on the sign-up page without one. */
export function firstStepOf(
  entry: JourneyEntry,
  door: SignupDoor | null,
): JourneyStep {
  return entry === "signup" && door === null
    ? { kind: "door", detailsEmail: null }
    : { kind: "email", message: null };
}

/** The code step just after a code was sent: the full resend delay (RG50). */
export function codeStepOf(
  email: string,
  matchingPhrase: string,
  nowMs: number,
  retryAfterSeconds: number = RESEND_DELAY_SECONDS,
): Extract<JourneyStep, { kind: "code" }> {
  return {
    kind: "code",
    email,
    matchingPhrase,
    resendAvailableAt: nowMs + retryAfterSeconds * 1_000,
  };
}

/** Whole seconds left before a new code may be asked for, between 0 and the delay (RG50). */
export function resendSecondsLeft(
  resendAvailableAt: number,
  nowMs: number,
): number {
  const seconds = Math.ceil((resendAvailableAt - nowMs) / 1_000);
  return Math.min(RESEND_DELAY_SECONDS, Math.max(0, seconds));
}

/**
 * D66 (05 RG111): the step a reloaded page resumes at, from GET /v1/auth/journey. The door comes
 * from the URL, never from the server: a verified address without a door goes to the choice of
 * door first, then to screen 3.
 */
export function resumedStepOf(
  journey: JourneyResponse,
  entry: JourneyEntry,
  door: SignupDoor | null,
  nowMs: number,
): JourneyStep {
  switch (journey.step) {
    case "code":
      return codeStepOf(
        journey.email,
        journey.matchingPhrase,
        nowMs,
        journey.retryAfterSeconds,
      );
    case "details":
      return door === null
        ? { kind: "door", detailsEmail: journey.email }
        : { kind: "details", email: journey.email };
    default:
      return firstStepOf(entry, door);
  }
}

/**
 * The page offered in the other language (17 §3 "Changement de langue", RG130): at every step but
 * the notices, the page of the same journey. Once a door is chosen, the journey is a sign-up.
 */
export function languagePageOf(
  entry: JourneyEntry,
  door: SignupDoor | null,
  step: JourneyStep | null,
): MemberPage | null {
  if (step?.kind === "notice") {
    return null;
  }
  if (step?.kind === "door") {
    return "signupDoors";
  }
  return entry === "signIn" ? "signIn" : signupPageOf(door);
}
