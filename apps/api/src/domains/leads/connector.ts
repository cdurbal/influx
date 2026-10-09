// What the worker loop asks of the connector of one destination (05 RG75: one connector per
// destination, independent of the others). The Brevo and Apollo connectors arrive with J6 commits 4
// and 5; until then, and in tests, the connectors are injected (16 RG148: no test reaches either).
//
// Two steps, so that the loop can apply the locks of 02 §12.4 between them:
//   prepare  qualification (RG80 to RG84), mapping and output check (16 RG137), at consumption;
//            it may read the database in its OWN short transaction, closed when it returns
//   send     the external call, made by the loop with no transaction open (02 §18.4 G4), and only
//            in live mode, with a key, to an allowed recipient
// What leaves the connector for the loop and its log lines is names and verdicts, never a value:
// no address, no attribute value, no template parameter (decision 3 of the architect, D60).
import type {
  AttemptState,
  ClaimedLine,
  OutboxDestination,
} from "./repository.ts";

/** What the call would carry, by names only (the dry-run line of decision 3). */
export type CallDescription = {
  /** The INFLUX operation (16 §M1), e.g. upsert_contact, send_transactional. */
  operation: string;
  /** The e-mail code of a transactional send, null for a contact. */
  templateCode: string | null;
  attributeNames: readonly string[];
  /** Attributes refused by the output check (16 RG137): any refusal fails the line. */
  rejectedAttributeNames: readonly string[];
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
  /** false: no key in this environment, the line is skipped_no_credentials (02 §12.4 lock 1). */
  readonly hasCredentials: boolean;
  prepare(line: ClaimedLine, state: AttemptState): Promise<Preparation>;
}
