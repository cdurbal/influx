// The secrets and the links of the two invitations (docs/mvp/15 RG99; 05 RG116 to RG119; 17b
// §3.14.b; G-1 point 2; EC-J8-2, EC-J8-3, EC-J8-13; 21 §J8 commit 7). A secret is 32 random bytes,
// base64url in the link, and only its SHA-256 is stored (0131): the link is shown once, at
// creation. The secret travels in the FRAGMENT of the link, which no server, log nor Referer ever
// receives.
import type { UiLocale } from "@influx/contracts/auth";
import { createHash, randomBytes } from "node:crypto";

export type InvitationSecret = { token: string; hash: Buffer };

/** 32 random bytes: the token of the link and its SHA-256 (as enrollmentTokenHashOf computes it). */
export function newInvitationSecret(): InvitationSecret {
  const bytes = randomBytes(32);
  return {
    token: bytes.toString("base64url"),
    hash: createHash("sha256").update(bytes).digest(),
  };
}

/** 17b §3.14.b: the activation page of the backoffice, as the bootstrap scripts print it. */
export function internalActivationLink(
  backofficeOrigin: string,
  token: string,
): string {
  return `${backofficeOrigin}/activation#${token}`;
}

/** The sign-up door of each role, by language (05 RG1; 21 EC-15). */
const SIGNUP_PATHS: Readonly<
  Record<UiLocale, Record<"advertiser" | "creator", string>>
> = {
  fr: { advertiser: "inscription/marque", creator: "inscription/createur" },
  en: { advertiser: "signup/brand", creator: "signup/creator" },
};

/** 05 RG116: the door of the proposed role, in the invitation's language; the code in the fragment. */
export function memberSignupLink(
  webOrigin: string,
  language: UiLocale,
  proposedRole: "advertiser" | "creator",
  code: string,
): string {
  return `${webOrigin}/${language}/${SIGNUP_PATHS[language][proposedRole]}#invitation=${code}`;
}
