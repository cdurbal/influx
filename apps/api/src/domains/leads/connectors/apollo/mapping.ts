// The mapping of an INFLUX account to an Apollo contact (skill apollo-lead-sync "Mapping des
// champs") and the output check of every body sent to Apollo (16 RG137 applied to Apollo): a field
// or a label outside the closed lists below REFUSES the call; nothing is ever cleaned silently.
// - A field absent from INFLUX is not sent: no invented value, no empty value that would overwrite
//   Apollo's (skill: "champ absent = champ vide"). INFLUX holds no first name, last name, title,
//   phone or website of a member yet: none is sent.
// - The company is the legal name of an ADVERTISER only, never a creator's pseudonym (05 RG88).
// - The INFLUX context travels as labels of a closed vocabulary (profile type, declared status,
//   country, language, scope and legal basis applied at the send): Apollo creates a label by its
//   name, where a custom field would need its Apollo id in the settings (none in EC-8).
// - No sequence: no field of the body can enrol the contact in one (sequence disabled, J6).
import type { SubjectAccount } from "../../repository.ts";
import type { ApolloLegalBasis, ApolloScope } from "./qualification.ts";

export type { ApolloSubject } from "../../repository.ts";

/** The fields of the body of a create (`POST /contacts`) and of an update (`PUT /contacts/{id}`). */
export const APOLLO_CONTACT_FIELDS = [
  "email",
  "organization_name",
  "label_names",
  "run_dedupe",
] as const;

/** The closed vocabulary of the labels (the INFLUX context of the skill's mapping). */
const LABEL =
  /^influx(?:_profile_(?:advertiser|creator)|_status_(?:individual|business)|_country_[a-z]{2}|_language_(?:fr|en)|_scope_(?:annonceurs_seuls|annonceurs_et_createurs_pro|tous_les_inscrits)|_basis_(?:consentement_requis|interet_legitime_avec_opposition))?$/;

export type ApolloContactBody = {
  email: string;
  organization_name?: string;
  label_names: string[];
  /** Create only: an address Apollo already knows gives back the same contact. */
  run_dedupe?: true;
};

export type ApolloContext = {
  scope: ApolloScope;
  legalBasis: ApolloLegalBasis;
};

/** The body of a contact, by the closed mapping; `run_dedupe` is set by the client on a create. */
export function mapContact(
  account: SubjectAccount,
  email: string,
  company: string | null,
  context: ApolloContext,
): ApolloContactBody {
  const body: ApolloContactBody = {
    email,
    label_names: [
      "influx",
      `influx_profile_${account.role ?? ""}`,
      `influx_status_${account.declaredStatus}`,
      `influx_country_${account.countryCode.toLowerCase()}`,
      `influx_language_${account.preferredLanguage === "fr" ? "fr" : "en"}`,
      `influx_scope_${context.scope}`,
      `influx_basis_${context.legalBasis}`,
    ],
  };
  if (account.role === "advertiser" && company !== null && company !== "") {
    body.organization_name = company;
  }
  return body;
}

const FIELD_SET: ReadonlySet<string> = new Set(APOLLO_CONTACT_FIELDS);

/**
 * The output check: the names refused, sorted; empty when the body may leave. A label outside the
 * vocabulary refuses `label_names` as a whole (its value is never named).
 */
export function checkContactOutput(body: Record<string, unknown>): string[] {
  const refused = Object.keys(body).filter((name) => !FIELD_SET.has(name));
  const labels = body.label_names;
  if (
    labels !== undefined &&
    (!Array.isArray(labels) ||
      labels.some((label) => typeof label !== "string" || !LABEL.test(label)))
  ) {
    refused.push("label_names");
  }
  return refused.sort();
}
