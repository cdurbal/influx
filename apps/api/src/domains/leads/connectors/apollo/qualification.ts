// The qualification of a lead for Apollo (05 RG81 to RG84, skill apollo-lead-sync), evaluated
// BEFORE any call, on the settings read at this consumption (EC-8, RG81: never at start, never in
// the code). Each refusal is a skip with its reason, never a failure: the lead stays in INFLUX and
// is re-evaluated by a replay (RG82). A setting that does not read is an abstention, never a send by
// default (RG84).
import { z } from "zod";
import type { AttemptState, SubjectAccount } from "../../repository.ts";

export const APOLLO_SCOPES = [
  "annonceurs_seuls",
  "annonceurs_et_createurs_pro",
  "tous_les_inscrits",
] as const;
export type ApolloScope = (typeof APOLLO_SCOPES)[number];

export const APOLLO_LEGAL_BASES = [
  "consentement_requis",
  "interet_legitime_avec_opposition",
] as const;
export type ApolloLegalBasis = (typeof APOLLO_LEGAL_BASES)[number];

const scopeSchema = z.enum(APOLLO_SCOPES);
const legalBasisSchema = z.object({
  default: z.enum(APOLLO_LEGAL_BASES),
  by_country: z.record(z.string(), z.enum(APOLLO_LEGAL_BASES)),
});
const countriesSchema = z.array(z.string().regex(/^[A-Z]{2}$/));

/** The three Apollo keys of this consumption, parsed; null when one does not read. */
export type ApolloSettings = {
  scope: ApolloScope;
  legalBasis: z.infer<typeof legalBasisSchema>;
  countries: ReadonlySet<string>;
};

export function apolloSettingsOf(
  settings: AttemptState["settings"],
): ApolloSettings | null {
  const scope = scopeSchema.safeParse(settings.apollo_scope);
  const legalBasis = legalBasisSchema.safeParse(settings.apollo_legal_basis);
  const countries = countriesSchema.safeParse(
    settings.apollo_prospecting_countries,
  );
  if (!scope.success || !legalBasis.success || !countries.success) {
    return null;
  }
  return {
    scope: scope.data,
    legalBasis: legalBasis.data,
    countries: new Set(countries.data),
  };
}

/** RG81: the scope in force lets this account through, or the reason it does not. */
export function scopeSkipReason(
  account: SubjectAccount,
  scope: ApolloScope,
): string | null {
  if (account.role === "advertiser" || scope === "tous_les_inscrits") {
    return null;
  }
  if (scope === "annonceurs_seuls") {
    return "out_of_apollo_scope";
  }
  // annonceurs_et_createurs_pro: the creators who declared a business status only
  return account.declaredStatus === "business"
    ? null
    : "out_of_apollo_scope_individual";
}

/** RG83: the legal basis of the account's country, else the default. */
export function legalBasisOf(
  settings: ApolloSettings,
  countryCode: string,
): ApolloLegalBasis {
  return (
    settings.legalBasis.by_country[countryCode] ?? settings.legalBasis.default
  );
}
