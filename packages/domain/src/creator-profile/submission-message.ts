// The message that goes with the list of the required fields (docs/mvp/07 RG90, RG91; 17 §5.2). It
// names what is missing and what that changes, and says nothing else: every statement it carries
// points to the written rule it comes from (RG91), so that no encouragement without a rule can slip
// in. Pure data: the sentences are in the translations of the screen, which read `fields` and `rules`.
import type { CreatorProfileInput } from "./input.ts";
import {
  missingCreatorRequiredFields,
  type CreatorProfileRequiredField,
} from "./required.ts";

/**
 * The rules a statement of the message may rest on: RG4 (the required fields open the submission),
 * RG77 (three visuals), RG16 (the badge « Compte vérifié », D79 (6)). Anything else is a promise.
 */
export type SubmissionMessageRule = "RG4" | "RG16" | "RG77";

export type SubmissionMessage =
  | { readonly kind: "ready"; readonly rule: "RG4" }
  | {
      readonly kind: "missing";
      /** What the submission needs, in the order of the form, each one named (RG90: nominative). */
      readonly fields: readonly CreatorProfileRequiredField[];
      readonly count: number;
      /** What each field rests on: the rule of the written specification it comes from (RG91). */
      readonly rules: Readonly<
        Partial<Record<CreatorProfileRequiredField, SubmissionMessageRule>>
      >;
    };

const RULE_OF_FIELD: Readonly<
  Partial<Record<CreatorProfileRequiredField, SubmissionMessageRule>>
> = {
  portfolio: "RG77",
  accountVerified: "RG16",
};

/**
 * "Il manque N informations pour publier votre profil : …" (RG90, first row of its table): the
 * fields, in order, and the one consequence the rules give: the profile cannot be submitted (RG4).
 * Nothing about results to expect (RG90, second column: forbidden).
 */
export function submissionMessageOf(
  missing: readonly CreatorProfileRequiredField[],
): SubmissionMessage {
  if (missing.length === 0) return { kind: "ready", rule: "RG4" };
  const rules: Partial<
    Record<CreatorProfileRequiredField, SubmissionMessageRule>
  > = {};
  for (const field of missing) rules[field] = RULE_OF_FIELD[field] ?? "RG4";
  return {
    kind: "missing",
    fields: [...missing],
    count: missing.length,
    rules,
  };
}

/** The message of a profile as it stands (the same list as the submission checks). */
export function submissionMessageForInput(
  input: CreatorProfileInput,
): SubmissionMessage {
  return submissionMessageOf(missingCreatorRequiredFields(input));
}
