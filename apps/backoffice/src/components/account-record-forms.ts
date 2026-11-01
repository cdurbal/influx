// The rules of the three forms of a member's account record (docs/mvp/05 RG93, RG108; 17b §3.11):
// the correction, the role change and the lift of a Brevo suppression. Pure functions, outside the
// component: which field is required, which reason is mandatory, the payload sent, and the words
// of the refusal apps/api may answer. No rule is decided here — apps/api and the database decide
// (the shapes below only avoid a call that would be refused); the component keeps state and render.
import type {
  CorrectionRequest,
  DualControlRequestBody,
  SuppressionLiftRequest,
} from "@influx/contracts/backoffice-actions";
import { messages } from "@/messages/fr";

const t = messages.account;

/** The legal name of the new brand, 2 to 120 characters once trimmed (EC-J8-23). */
export const LEGAL_NAME_MIN = 2;
export const LEGAL_NAME_MAX = 120;
/** The free note of a correction, as long as the contract's comment. */
export const NOTE_MAX = 500;

/** What a form answers on submit: the sentence to show, or the payload to send. */
export type FormOutcome<Body> =
  { ok: true; body: Body } | { ok: false; error: string | null };

// --- Correction (05 RG108) -------------------------------------------------------------------

export type CorrectionFields = {
  /** "" = unchanged */
  declaredStatus: string;
  /** "" = unchanged */
  country: string;
  /** "" = unchanged */
  language: string;
  /** "" = no reason chosen yet */
  reason: string;
  note: string;
};

export function correctionOutcome(
  fields: CorrectionFields,
): FormOutcome<CorrectionRequest> {
  if (
    fields.declaredStatus === "" &&
    fields.country === "" &&
    fields.language === ""
  ) {
    return { ok: false, error: t.nothingToCorrect };
  }
  if (fields.reason === "") {
    return { ok: false, error: messages.common.reasonPlaceholder };
  }
  const note = fields.note.trim();
  return {
    ok: true,
    body: {
      reasonCode: fields.reason as CorrectionRequest["reasonCode"],
      ...(fields.declaredStatus === ""
        ? {}
        : {
            declaredStatus:
              fields.declaredStatus as CorrectionRequest["declaredStatus"],
          }),
      ...(fields.country === ""
        ? {}
        : { countryCode: fields.country as CorrectionRequest["countryCode"] }),
      ...(fields.language === ""
        ? {}
        : {
            preferredLanguage:
              fields.language as CorrectionRequest["preferredLanguage"],
          }),
      ...(note === "" ? {} : { comment: note }),
    },
  };
}

/** The line shown once a correction was answered (nothing is journaled when nothing changed). */
export function correctionNotice(changed: boolean): string {
  return changed ? t.corrected : t.nothingChanged;
}

// --- Role change (05 RG108, EC-J8-17; asks the dual control) ---------------------------------

export type RoleChangeFields = {
  legalName: string;
  /** "" = no reason chosen yet */
  reason: string;
};

export function roleChangeOutcome(
  accountId: string,
  fields: RoleChangeFields,
): FormOutcome<
  Extract<DualControlRequestBody, { code: "identity.change_member_role" }>
> {
  const name = fields.legalName.trim();
  if (name.length < LEGAL_NAME_MIN || name.length > LEGAL_NAME_MAX) {
    return { ok: false, error: t.legalNameInvalid };
  }
  if (fields.reason === "") {
    return { ok: false, error: messages.common.reasonPlaceholder };
  }
  return {
    ok: true,
    body: {
      code: "identity.change_member_role",
      accountId,
      legalName: name,
      reasonCode: fields.reason as Extract<
        DualControlRequestBody,
        { code: "identity.change_member_role" }
      >["reasonCode"],
    },
  };
}

// --- Lift of a Brevo suppression (05 RG93, CA55) ---------------------------------------------

/** The button waits for a reason; nothing else is required. */
export function suppressionCanSubmit(reason: string): boolean {
  return reason !== "";
}

/** No reason, no call and no sentence: the button is already announced as disabled. */
export function suppressionOutcome(
  reason: string,
): FormOutcome<SuppressionLiftRequest> {
  if (!suppressionCanSubmit(reason)) {
    return { ok: false, error: null };
  }
  return {
    ok: true,
    body: { reasonCode: reason as SuppressionLiftRequest["reasonCode"] },
  };
}

/** 409: no suppression is recorded for this contact. Any other refusal keeps the common words. */
export function suppressionRefusal(code: string | undefined): string | null {
  return code === "conflict" ? t.suppressionNone : null;
}
