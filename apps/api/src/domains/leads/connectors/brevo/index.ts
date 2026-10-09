// The two Brevo connectors of the worker (J6, commit 4): `brevo_contact` (16 §M1 operations 1, 2
// and 7) and `brevo_transactional` (operation 6, the welcome e-mails of 05 RG86, P1 of 16 §H).
// Their preparation, at consumption (05 RG37), in this order:
//   1. the account state of the attempt: an account gone or not active is skipped;
//   2. the qualification: contact without marketing consent (RG80) is skipped no_consent at sign-up,
//      and unsubscribed afterwards (RG78: a withdrawal is never doubled by a later send); the
//      welcome leaves whatever the consent (RG86), once per account (RG76, 16 RG90);
//   3. the settings read at consumption (EC-8): list and template ids, NULL = skipped with a clear
//      cause, never guessed (0103);
//   4. the subject's own read (leads.read_brevo_subject, 0112), in its own short transaction;
//   5. the mapping of 16 §M4 and the output check (RG137): a refusal goes back to the drain, which
//      fails the line, in dry_run as in live;
//   6. BREVO_MODE=redirect: an address outside BREVO_TEST_RECIPIENTS is skipped_non_production
//      (16 RG117, a positive condition, after the whole mapping).
// What leaves for the drain is names and verdicts; the values stay in the closure of `send`.
import type { BrevoMode } from "../../../../config/schema.ts";
import type { Connector, Preparation } from "../../connector.ts";
import type {
  AttemptState,
  ClaimedLine,
  SubjectAccount,
} from "../../repository.ts";
import {
  createBrevoClient,
  type BrevoClient,
  type BrevoClientLogger,
} from "./client.ts";
import {
  checkContactOutput,
  checkTransactionalOutput,
  languageOf,
  mapContact,
  UNSUBSCRIBE_BODY_FIELDS,
  type BrevoSubject,
} from "./mapping.ts";

export {
  BREVO_CONTACT_ATTRIBUTES,
  checkContactOutput,
  checkTransactionalOutput,
  mapContact,
  type BrevoSubject,
} from "./mapping.ts";

/** The welcome e-mails, the only queue e-mails of J6 (16 §H, P1). */
export const WORKER_TRANSACTIONAL_TEMPLATES = [
  "account.welcome_advertiser",
  "account.welcome_creator",
] as const;

/** Sender name of the transactional flow (16 RG156). */
const SENDER_NAME = "INFLUX";

export type BrevoConnectorSettings = {
  mode: BrevoMode;
  /** BREVO_TEST_RECIPIENTS: the only addresses reached in redirect (16 RG117). */
  testRecipients: readonly string[];
  /** The worker's OWN key (EC-19), null when absent. */
  apiKey: string | null;
  baseUrl: string;
  senderTransactional: string | null;
  /** BREVO_SUPPRESSION_LIST_ID: the marketing exclusion list (16 RG45), or none. */
  suppressionListId: number | null;
};

export type BrevoSubjectReader = (
  line: ClaimedLine,
) => Promise<BrevoSubject | null>;

export type BrevoConnectorDependencies = {
  /** Reads the subject of a line in processing for this worker (0112), its own transaction. */
  readSubject: BrevoSubjectReader;
  logger: BrevoClientLogger;
  fetch?: typeof fetch;
  timeoutMs?: number;
  /** The mapping of 16 §M4; replaced by the tests of the output check only. */
  mapContact?: typeof mapContact;
};

/** An id of leads.sync_settings (brevo_list_ids, brevo_template_ids): a positive integer, or null. */
function idIn(
  settings: AttemptState["settings"],
  key: string,
  name: string,
): number | null {
  const ids = settings[key];
  if (typeof ids !== "object" || ids === null) {
    return null;
  }
  const value = (ids as Record<string, unknown>)[name];
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null;
}

function domainOf(email: string): string {
  return email.slice(email.lastIndexOf("@") + 1).toLowerCase();
}

/** Step 1, common to both destinations. */
function accountSkip(account: SubjectAccount | null): Preparation | null {
  if (account === null) {
    return { kind: "skip", reason: "account_absent" };
  }
  if (account.status !== "active") {
    return { kind: "skip", reason: "account_not_active" };
  }
  if (account.role !== "advertiser" && account.role !== "creator") {
    return { kind: "skip", reason: "role_out_of_scope" };
  }
  return null;
}

export function createBrevoConnectors(
  settings: BrevoConnectorSettings,
  dependencies: BrevoConnectorDependencies,
): { contact: Connector; transactional: Connector } {
  const hasCredentials =
    settings.mode !== "disabled" && settings.apiKey !== null;
  const testRecipients = new Set(
    settings.testRecipients.map((address) => address.toLowerCase()),
  );
  const map = dependencies.mapContact ?? mapContact;

  function client(destination: string): BrevoClient | null {
    if (settings.apiKey === null) {
      return null;
    }
    return createBrevoClient(
      { apiKey: settings.apiKey, baseUrl: settings.baseUrl, destination },
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
  }
  const contactClient = client("brevo_contact");
  const transactionalClient = client("brevo_transactional");

  /** Step 6: in redirect, only a listed address is reached (16 RG117). */
  function redirected(email: string): boolean {
    return (
      settings.mode === "redirect" && !testRecipients.has(email.toLowerCase())
    );
  }

  /** The call, refused again if the output check refused (defence in depth). */
  function guarded(
    rejected: readonly string[],
    call: (brevo: BrevoClient) => ReturnType<BrevoClient["upsertContact"]>,
    brevo: BrevoClient | null,
  ) {
    return () => {
      if (rejected.length > 0) {
        return Promise.resolve({
          kind: "failed" as const,
          errorCode: "output_check_rejected",
        });
      }
      if (brevo === null) {
        // Unreachable: the drain skips a connector without credentials before any call.
        throw new Error("no Brevo key for the worker");
      }
      return call(brevo);
    };
  }

  const contact: Connector = {
    destination: "brevo_contact",
    hasCredentials,
    async prepare(line, state) {
      const skipped = accountSkip(state.account);
      if (skipped !== null || state.account === null) {
        return skipped ?? { kind: "skip", reason: "account_absent" };
      }
      const account = state.account;
      const unsubscribe = !account.marketingEmailConsent;
      if (unsubscribe && line.eventType === "lead.created") {
        // 05 RG80, CA39: no consent, no marketing contact; a skip, never a failure.
        return { kind: "skip", reason: "no_consent" };
      }
      const listId = unsubscribe
        ? null
        : idIn(
            state.settings,
            "brevo_list_ids",
            account.role === "advertiser" ? "advertisers" : "creators",
          );
      if (!unsubscribe && listId === null) {
        return { kind: "skip", reason: "list_not_configured" };
      }
      const subject = await dependencies.readSubject(line);
      if (subject === null) {
        return { kind: "skip", reason: "account_absent" };
      }

      if (unsubscribe || listId === null) {
        // Operation 2 (then 7): the consent withdrawn since the emission (05 RG37, RG78).
        const body = { emailBlacklisted: true };
        const rejected = Object.keys(body)
          .filter((name) => !UNSUBSCRIBE_BODY_FIELDS.has(name))
          .sort();
        if (rejected.length === 0 && redirected(subject.email)) {
          return { kind: "skip", reason: "skipped_non_production" };
        }
        return {
          kind: "mapped",
          description: {
            operation: "unsubscribe_contact",
            templateCode: null,
            attributeNames: [],
            rejectedAttributeNames: rejected,
          },
          recipientDomain: domainOf(subject.email),
          send: guarded(
            rejected,
            (brevo) =>
              brevo.unsubscribeContact(
                subject.email,
                body,
                settings.suppressionListId,
              ),
            contactClient,
          ),
        };
      }

      // Operation 1: the contact, by the closed mapping (16 §M4) and the output check (RG137).
      const body = map(account, subject, listId);
      const rejected = checkContactOutput(body);
      if (rejected.length === 0 && redirected(subject.email)) {
        return { kind: "skip", reason: "skipped_non_production" };
      }
      return {
        kind: "mapped",
        description: {
          operation: "upsert_contact",
          templateCode: null,
          attributeNames: Object.keys(body.attributes).sort(),
          rejectedAttributeNames: rejected,
        },
        recipientDomain: domainOf(subject.email),
        send: guarded(
          rejected,
          (brevo) => brevo.upsertContact(body),
          contactClient,
        ),
      };
    },
  };

  const transactional: Connector = {
    destination: "brevo_transactional",
    hasCredentials: hasCredentials && settings.senderTransactional !== null,
    async prepare(line, state) {
      const skipped = accountSkip(state.account);
      if (skipped !== null || state.account === null) {
        return skipped ?? { kind: "skip", reason: "account_absent" };
      }
      const account = state.account;
      const code = line.payload.email_code;
      if (
        typeof code !== "string" ||
        !(WORKER_TRANSACTIONAL_TEMPLATES as readonly string[]).includes(code)
      ) {
        // Not a queue e-mail of J6: failed, visible, replayable once supported.
        return { kind: "fail", errorCode: "template_not_supported" };
      }
      const templateId = idIn(state.settings, "brevo_template_ids", code);
      if (templateId === null) {
        return { kind: "skip", reason: "template_not_configured" };
      }
      const subject = await dependencies.readSubject(line);
      if (subject === null) {
        return { kind: "skip", reason: "account_absent" };
      }
      if (subject.welcomeSent) {
        // 05 RG76, CA41; 16 RG90: the local belt, the one we count on.
        return { kind: "skip", reason: "already_sent" };
      }

      // Operation 6: one recipient (16 RG91), no promotional content (RG86): the template of the
      // role, in the account's language.
      const locale = languageOf(account);
      const body = {
        sender: { name: SENDER_NAME, email: settings.senderTransactional },
        to: [{ email: subject.email }],
        templateId,
        params: { LANGUAGE: locale },
        tags: [code],
      };
      const rejected = checkTransactionalOutput(body);
      if (rejected.length === 0 && redirected(subject.email)) {
        return { kind: "skip", reason: "skipped_non_production" };
      }
      return {
        kind: "mapped",
        description: {
          operation: "send_transactional",
          templateCode: code,
          attributeNames: Object.keys(body.params).sort(),
          rejectedAttributeNames: rejected,
        },
        recipientDomain: domainOf(subject.email),
        send: guarded(
          rejected,
          (brevo) => brevo.sendTransactional(body, line.idempotencyKey, locale),
          transactionalClient,
        ),
      };
    },
  };

  return { contact, transactional };
}
