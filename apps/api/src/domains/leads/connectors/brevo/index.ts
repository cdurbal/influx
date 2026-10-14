// The two Brevo connectors of the worker (J6, commit 4): `brevo_contact` (16 §M1 operations 1, 2
// and 7, and the address change of J7 decision 5) and `brevo_transactional` (operation 6, the
// welcome e-mails of 05 RG86 and the notice of a changed address of RG58, P1 of 16 §H).
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
// A contact under suppression (05 RG93, a complaint) is only ever unsubscribed again, whatever the
// consent: an ordinary replay never resynchronises it (CA55); only an admin lifts it (J8).
// email.changed (05 RG58, decision 5 of J7): the contact is updated by its Brevo id, else by its old
// address, never recreated; Brevo lifts the blacklist on an address change, so operations 2 and 7
// follow when the consent is withdrawn or the contact suppressed. The notice auth.email_changed_notice
// goes to the address its payload names (`previous`: the old address of the completed request,
// read by the subject read, never carried by the line; `current`: the account's), whatever the
// consent (a transactional e-mail, RG35).
// What leaves for the drain is names and verdicts; the values stay in the closure of `send`.
import type { BrevoMode } from "../../../../config/schema.ts";
import {
  accountSkip,
  type Connector,
  type Preparation,
} from "../../connector.ts";
import type { AttemptState, ClaimedLine } from "../../repository.ts";
import {
  createBrevoClient,
  type BrevoClient,
  type BrevoClientLogger,
  type BrevoContactIdentifier,
} from "./client.ts";
import {
  checkContactOutput,
  checkEmailChangeOutput,
  checkTransactionalOutput,
  languageOf,
  mapContact,
  UNSUBSCRIBE_BODY_FIELDS,
  type BrevoSubject,
} from "./mapping.ts";

export {
  BREVO_CONTACT_ATTRIBUTES,
  checkContactOutput,
  checkEmailChangeOutput,
  checkTransactionalOutput,
  mapContact,
  type BrevoSubject,
} from "./mapping.ts";

/** The queue e-mails (16 §H, P1): the welcome e-mails (J6), the notice of a changed address (J7). */
export const WORKER_TRANSACTIONAL_TEMPLATES = [
  "account.welcome_advertiser",
  "account.welcome_creator",
  "auth.email_changed_notice",
] as const;

/** Sent once per account (05 RG76, 16 RG90): the journal says whether it already left. */
const ONCE_PER_ACCOUNT_TEMPLATES: ReadonlySet<string> = new Set([
  "account.welcome_advertiser",
  "account.welcome_creator",
]);

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

  /** Operations 2 then 7 on the address, the call of a withdrawn or suppressed contact. */
  function unsubscribing(email: string): Preparation {
    const body = { emailBlacklisted: true };
    const rejected = Object.keys(body)
      .filter((name) => !UNSUBSCRIBE_BODY_FIELDS.has(name))
      .sort();
    if (rejected.length === 0 && redirected(email)) {
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
      recipientDomain: domainOf(email),
      send: guarded(
        rejected,
        (brevo) =>
          brevo.unsubscribeContact(email, body, settings.suppressionListId),
        contactClient,
      ),
    };
  }

  /** email.changed (05 RG58, decision 5 of J7): the known contact moved to the new address. */
  async function changingEmail(
    line: ClaimedLine,
    account: NonNullable<AttemptState["account"]>,
  ): Promise<Preparation> {
    const subject = await dependencies.readSubject(line);
    if (subject === null) {
      return { kind: "skip", reason: "account_absent" };
    }
    const previousEmail = subject.previousEmail;
    if (previousEmail === null) {
      // No completed request behind the line: nothing to move from, visible, never guessed.
      return { kind: "fail", errorCode: "email_change_not_found" };
    }
    const body = { attributes: { EMAIL: subject.email } };
    const rejected = checkEmailChangeOutput(body);
    if (
      rejected.length === 0 &&
      (redirected(subject.email) || redirected(previousEmail))
    ) {
      return { kind: "skip", reason: "skipped_non_production" };
    }
    const identifier: BrevoContactIdentifier =
      subject.externalContactId === null
        ? { type: "email_id", value: previousEmail }
        : { type: "contact_id", value: subject.externalContactId };
    const withdrawn = !account.marketingEmailConsent || subject.suppressed;
    return {
      kind: "mapped",
      description: {
        operation: "change_contact_email",
        templateCode: null,
        attributeNames: Object.keys(body.attributes),
        rejectedAttributeNames: rejected,
      },
      recipientDomain: domainOf(subject.email),
      send: guarded(
        rejected,
        async (brevo) => {
          const changed = await brevo.updateContactEmail(identifier, body);
          if (changed.kind !== "succeeded" || !withdrawn) {
            return changed;
          }
          // Brevo lifts the blacklist with the address: operations 2 and 7 again (decision 5).
          return brevo.unsubscribeContact(
            subject.email,
            { emailBlacklisted: true },
            settings.suppressionListId,
          );
        },
        contactClient,
      ),
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
      if (line.eventType === "email.changed") {
        return changingEmail(line, account);
      }
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

      if (unsubscribe || listId === null || subject.suppressed) {
        // Operation 2 (then 7): the consent withdrawn since the emission (05 RG37, RG78), or a
        // contact under suppression, whatever the consent (RG93, CA55).
        return unsubscribing(subject.email);
      }

      // Operation 1: the contact, by the closed mapping (16 §M4) and the output check (RG137).
      // A consent given again from the space (consent.granted, still in force at consumption)
      // lifts the blacklist that operation 2 set: Brevo keeps it otherwise (J6T-3). Never on any
      // other event: a blacklist set by Brevo itself waits for its webhook (RG90).
      const body =
        line.eventType === "consent.granted"
          ? { ...map(account, subject, listId), emailBlacklisted: false }
          : map(account, subject, listId);
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
      if (ONCE_PER_ACCOUNT_TEMPLATES.has(code) && subject.welcomeSent) {
        // 05 RG76, CA41; 16 RG90: the local belt, the one we count on.
        return { kind: "skip", reason: "already_sent" };
      }
      let recipient = subject.email;
      if (code === "auth.email_changed_notice") {
        // RG58: both addresses are told; the line names the side, never the address (RG74).
        const side = line.payload.recipient;
        if (side === "previous") {
          if (subject.previousEmail === null) {
            // No completed request behind the line: nothing to tell, visible, never guessed.
            return { kind: "fail", errorCode: "email_change_not_found" };
          }
          recipient = subject.previousEmail;
        } else if (side !== "current") {
          return { kind: "fail", errorCode: "notice_recipient_unknown" };
        }
      }

      // Operation 6: one recipient (16 RG91), no promotional content (RG86): the template of the
      // code, in the account's language.
      const locale = languageOf(account);
      const body = {
        sender: { name: SENDER_NAME, email: settings.senderTransactional },
        to: [{ email: recipient }],
        templateId,
        params: { LANGUAGE: locale },
        tags: [code],
      };
      const rejected = checkTransactionalOutput(body);
      if (rejected.length === 0 && redirected(recipient)) {
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
        recipientDomain: domainOf(recipient),
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
