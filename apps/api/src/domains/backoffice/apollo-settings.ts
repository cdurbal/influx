// The three Apollo keys of leads.sync_settings (docs/mvp/05 RG81, RG83, RG84; 0103, 0134) between
// their stored shape and the contract's. The database holds the legal basis by country as a JSON
// object ({"default", "by_country": {code: basis}}); a response carries no record whose keys the
// data chooses (21 J1-J N2), so the contract lists it. The order is canonical on both sides
// (countries sorted), as 0134 compares a confirmed payload whole.
import {
  apolloSettingSchema,
  type ApolloSetting,
} from "@influx/contracts/backoffice-actions";

/** A key and its value as leads.sync_settings and the dual control payload hold them. */
export type StoredApolloSetting = { key: ApolloSetting["key"]; value: unknown };

export function storedApolloSetting(
  setting: ApolloSetting,
): StoredApolloSetting {
  switch (setting.key) {
    case "apollo_scope":
      return { key: setting.key, value: setting.value };
    case "apollo_excluded_countries":
      return { key: setting.key, value: [...new Set(setting.value)].sort() };
    case "apollo_legal_basis":
      return {
        key: setting.key,
        value: {
          default: setting.value.default,
          by_country: Object.fromEntries(
            [...setting.value.byCountry]
              .sort((a, b) => a.countryCode.localeCompare(b.countryCode))
              .map((entry) => [entry.countryCode, entry.basis]),
          ),
        },
      };
  }
}

/** The contract's form of a stored key; null for a value it does not read (never shown half-read). */
export function apolloSettingOf(
  key: unknown,
  value: unknown,
): ApolloSetting | null {
  let candidate: unknown = { key, value };
  if (
    key === "apollo_legal_basis" &&
    typeof value === "object" &&
    value !== null &&
    "by_country" in value
  ) {
    const { default: basis, by_country: byCountry } = value as {
      default: unknown;
      by_country: unknown;
    };
    candidate = {
      key,
      value: {
        default: basis,
        byCountry:
          typeof byCountry === "object" && byCountry !== null
            ? Object.entries(byCountry)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([countryCode, entry]) => ({ countryCode, basis: entry }))
            : byCountry,
      },
    };
  }
  const parsed = apolloSettingSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}
