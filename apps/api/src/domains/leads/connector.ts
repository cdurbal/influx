// What the worker loop asks of the connector of one destination (05 RG75: one connector per
// destination, independent of the others). The Brevo and Apollo connectors arrive with J6 commits 4
// and 5; until then, and in tests, the connectors are injected (16 RG148: no test reaches either).
//
// Two steps, so that the loop can apply the locks of 02 §12.4 between them:
//   prepare  qualification (RG80 to RG84), mapping and output check (16 RG137), at consumption;
//            it may read the database in its OWN short transaction, closed when it returns
//   send     the external call, made by the loop with no transaction open (02 §18.4 G4), and only
//            in live mode, with a key, to an allowed recipient
// The preparation, with no call and no effect, gives one of three outcomes (05 RG164, D67): a skip
// for a normal cause, ALWAYS first (a line without consent is never a configuration failure); a
// failure without a mapping (an Apollo setting that does not read, an unsupported e-mail); or the
// description of the mapping with the settings it lacks, possibly none. The loop then applies, in
// this order: the would_send trace in dry_run, the output check, the configuration failure, the
// dry-run success, the key, the allow-list, the call.
// What leaves the connector for the loop and its log lines is names and verdicts, never a value:
// no address, no attribute value, no template parameter (decision 3 of the architect, D60).
import type {
  AttemptState,
  ClaimedLine,
  OutboxDestination,
  SubjectAccount,
} from "./repository.ts";
import type { MissingSetting } from "./settings.ts";

/** What the call would carry, by names only (the dry-run line of decision 3). */
export type CallDescription = {
  /** The INFLUX operation (16 §M1), e.g. upsert_contact, send_transactional. */
  operation: string;
  /** The e-mail code of a transactional send, null for a contact. */
  templateCode: string | null;
  attributeNames: readonly string[];
  /** Attributes refused by the output check (16 RG137): any refusal fails the line. */
  rejectedAttributeNames: readonly string[];
  /**
   * The settings of INFLUX the call needs and that are missing (05 RG164): any fails the line, a
   * configuration incident (RG160), after the output check; never sent.
   */
  missingSettings: readonly MissingSetting[];
};

/** The answer of the provider, already classified by the connector (16 §M5). */
export type CallResult =
  | {
      kind: "succeeded";
      /** Contact line: the contact id at the provider. */
      providerContactId?: string;
      /** Transactional line: the messageId (16 RG94), the language, the template version. */
      providerMessageId?: string;
      locale?: string;
      templateVersion?: number;
    }
  | {
      /** Transient: the line waits by the schedule of RG79, or by the provider's Retry-After. */
      kind: "retry";
      errorCode: string;
      /** A cause in clear for the backoffice; the database redacts any address (0111). */
      errorMessage?: string;
      retryAfterSeconds?: number;
      /** A 429 or a quota: the whole category pauses (lead-pipeline T5). */
      rateLimited?: boolean;
    }
  | { kind: "failed"; errorCode: string; errorMessage?: string };

export type Preparation =
  /** Not to be sent, a normal case with its reason (05 RG80, RG82): never a failure. */
  | { kind: "skip"; reason: string }
  /** A line this connector can never send as it stands (no retry, visible, replayable at J8). */
  | { kind: "fail"; errorCode: string }
  | {
      kind: "mapped";
      description: CallDescription;
      /** The domain of the recipient's address, for the allow-list (02 §12.4 lock 3). */
      recipientDomain: string;
      /** The external call; its values stay in the connector. */
      send: () => Promise<CallResult>;
    };

export interface Connector {
  readonly destination: OutboxDestination;
  /**
   * false: no key in this process; a qualified line fails credentials_missing in a deployed
   * environment (05 RG160), and is skipped_no_credentials in development (02 §12.4 lock 1).
   */
  readonly hasCredentials: boolean;
  prepare(line: ClaimedLine, state: AttemptState): Promise<Preparation>;
}

/** The first step of every connector: an account gone, not active or not a member is skipped. */
export function accountSkip(
  account: SubjectAccount | null,
): Preparation | null {
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
