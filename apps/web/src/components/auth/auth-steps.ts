// What screens 1 and 2 of the journey show, as plain functions (docs/mvp/17 §3.1, §3.2, §2.5;
// 05 RG42, RG66 to RG69, RG112, RG136 to RG140). No rule lives here: apps/api decides, and these
// functions only turn its answers, and the form check of the address, into what the screen says.
import {
  LOGIN_CODE_PATTERN,
  MAX_EMAIL_LENGTH,
  type RequestCodeResponse,
  type SignupDoor,
  type VerifyCodeResponse,
} from "@influx/contracts/auth";

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
