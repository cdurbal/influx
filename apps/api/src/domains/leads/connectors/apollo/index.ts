// The Apollo connector of the worker (J6, commit 5): `apollo_contact`, a contact created or updated,
// never a duplicate, never enrolled in a sequence. Its preparation, at consumption (05 RG81: the
// settings of THIS attempt, never those of the start), in this order:
//   1. the account state of the attempt: an account gone or not active is skipped;
//   2. the three Apollo keys (EC-8); one that does not read allows no mapping: the line FAILS
//      apollo_settings_invalid, an incident (05 RG160, RG164 (b)), never a skip;
//   3. the scope (RG81): out_of_apollo_scope, out_of_apollo_scope_individual;
//   4. the excluded countries (RG84, block-list since 0141, D33 overridden by the founder): the
//      account's country in the list is country_excluded; an empty list excludes none;
//   5. the verified address (RG82): email_not_verified;
//   6. the legal basis of the country (RG83): consentement_requis without the commercial_prospection
//      consent in force is no_consent;
//   7. the subject's own read (leads.read_apollo_subject, 0113), in its own short transaction: under
//      interet_legitime_avec_opposition an opposition recorded after the sign-up excludes for good
//      (prospection_opposed); an advertiser without a company name is company_not_identified;
//   8. the mapping and the output check: a refusal goes back to the drain, which fails the line, in
//      dry_run as in live.
// The answer's contact id is the only value read back (RG85), kept by the database as the contact
// state (0111) for the next update. What leaves for the drain is names and verdicts; the values stay
// in the closure of `send`.
import {
  accountSkip,
  type Connector,
  type Preparation,
} from "../../connector.ts";
import type { ClaimedLine } from "../../repository.ts";
import {
  createApolloClient,
  type ApolloClient,
  type ApolloClientLogger,
} from "./client.ts";
import {
  checkContactOutput,
  mapContact,
  type ApolloSubject,
} from "./mapping.ts";
import {
  apolloSettingsOf,
  legalBasisOf,
  scopeSkipReason,
} from "./qualification.ts";

export {
  APOLLO_CONTACT_FIELDS,
  checkContactOutput,
  mapContact,
  type ApolloSubject,
} from "./mapping.ts";

export type ApolloConnectorSettings = {
  /** APOLLO_API_KEY, the worker's only: null when absent (no key in staging). */
  apiKey: string | null;
  baseUrl: string;
};

export type ApolloSubjectReader = (
  line: ClaimedLine,
) => Promise<ApolloSubject | null>;

export type ApolloConnectorDependencies = {
  /** Reads the subject of a line in processing for this worker (0113), its own transaction. */
  readSubject: ApolloSubjectReader;
  logger: ApolloClientLogger;
  fetch?: typeof fetch;
  timeoutMs?: number;
  /** The mapping; replaced by the tests of the output check only. */
  mapContact?: typeof mapContact;
};

function domainOf(email: string): string {
  return email.slice(email.lastIndexOf("@") + 1).toLowerCase();
}

export function createApolloConnector(
  settings: ApolloConnectorSettings,
  dependencies: ApolloConnectorDependencies,
): Connector {
  const map = dependencies.mapContact ?? mapContact;
  const client: ApolloClient | null =
    settings.apiKey === null
      ? null
      : createApolloClient(
          { apiKey: settings.apiKey, baseUrl: settings.baseUrl },
          {
            logger: dependencies.logger,
            ...(dependencies.fetch === undefined
              ? {}
              : { fetch: dependencies.fetch }),
            ...(dependencies.timeoutMs === undefined
              ? {}
              : { timeoutMs: dependencies.timeoutMs }),
          },
        );

  return {
    destination: "apollo_contact",
    hasCredentials: client !== null,
    async prepare(line, state): Promise<Preparation> {
      if (line.eventType === "account.deleted") {
        // 15 RG79, J8 commit 8: no deletion at Apollo before the Lot 5 ("Apollo skipped noté"). The
        // closing of the request checks that Apollo never received the contact (0136); otherwise
        // the request stays open for a follow-up by hand.
        return { kind: "skip", reason: "erasure_not_propagated" };
      }
      const skipped = accountSkip(state.account);
      if (skipped !== null || state.account === null) {
        return skipped ?? { kind: "skip", reason: "account_absent" };
      }
      const account = state.account;
      const apollo = apolloSettingsOf(state.settings);
      if (apollo === null) {
        dependencies.logger.error(
          { key: "apollo", destination: "apollo_contact" },
          "leads.settings.invalid",
        );
        return { kind: "fail", errorCode: "apollo_settings_invalid" };
      }
      const outOfScope = scopeSkipReason(account, apollo.scope);
      if (outOfScope !== null) {
        return { kind: "skip", reason: outOfScope };
      }
      if (apollo.excludedCountries.has(account.countryCode)) {
        return { kind: "skip", reason: "country_excluded" };
      }
      if (!account.emailVerified) {
        return { kind: "skip", reason: "email_not_verified" };
      }
      const legalBasis = legalBasisOf(apollo, account.countryCode);
      if (
        legalBasis === "consentement_requis" &&
        !account.commercialProspectionConsent
      ) {
        return { kind: "skip", reason: "no_consent" };
      }

      const subject = await dependencies.readSubject(line);
      if (subject === null) {
        return { kind: "skip", reason: "account_absent" };
      }
      if (
        legalBasis === "interet_legitime_avec_opposition" &&
        subject.prospectionOpposed
      ) {
        return { kind: "skip", reason: "prospection_opposed" };
      }
      if (
        account.role === "advertiser" &&
        (subject.company === null || subject.company.trim() === "")
      ) {
        return { kind: "skip", reason: "company_not_identified" };
      }

      const body = map(account, subject.email, subject.company, {
        scope: apollo.scope,
        legalBasis,
      });
      const rejected = checkContactOutput(body);
      return {
        kind: "mapped",
        description: {
          operation:
            subject.externalContactId === null
              ? "create_contact"
              : "update_contact",
          templateCode: null,
          attributeNames: Object.keys(body).sort(),
          rejectedAttributeNames: rejected,
          missingSettings: [],
        },
        recipientDomain: domainOf(subject.email),
        send: () => {
          if (rejected.length > 0) {
            // Defence in depth: the drain fails the line before any call.
            return Promise.resolve({
              kind: "failed" as const,
              errorCode: "output_check_rejected",
            });
          }
          if (client === null) {
            // Unreachable: the drain skips a connector without credentials before any call.
            throw new Error("no Apollo key for the worker");
          }
          return client.upsertContact(body, subject.externalContactId);
        },
      };
    },
  };
}
