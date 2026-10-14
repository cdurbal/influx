// POST /v1/auth/request-code, steps 3 to 8 of docs/mvp/02 §18.10, applied literally (the route,
// routes.ts, owns steps 1, 2, 9 and 10: the floor, the validation, the cookie, the answer).
//
//   3  Transaction 1, E-1 identity.request_code: counters (05 RG44); at the ceiling, commit and
//      leave in outcome (c) — no code, no journal line, the code in progress stays valid; else the
//      matching phrase, the account, the journal line `queued`; commit.
//   4  No transaction open from here (G4).
//   5  GoTrue: create the user, UNCONDITIONALLY; `email_exists` is swallowed (R1).
//   6  GoTrue: generate the code, nothing sent. Steps 5 and 6 together within 2 000 ms (G1).
//   7  Brevo: one unitary send, Idempotency-Key `auth.login_code:<line id>`, one attempt (G2).
//   8  Transaction 2, E-1: the outcome of the line (sent or failed), nothing else.
//
// The sequence of calls is the same for every address (R1, 18 T8.5): the only branch on the
// account is the value of one column of the journal line. The code lives in this module's
// memory and in the body sent to Brevo, nowhere else (02 §18.7, 05 RG52).
import type { RequestCodeOutcome, UiLocale } from "@influx/contracts/auth";
import type { UserAgentSummary } from "@influx/contracts/user-agent";
import {
  withElevatedTransaction,
  type ApiDatabase,
  type Transaction,
} from "../../db/index.ts";
import type { TransactionalSender } from "../../platform/brevo-transactional.ts";
import type { ClientAddress } from "../../platform/client-address.ts";
import type { SupabaseAuth } from "../../platform/supabase.ts";
import {
  DEFAULT_EMAIL_TIME_ZONE,
  renderLoginCodeEmail,
} from "./login-code-email.ts";
import { drawMatchingPhrase } from "./matching-phrase.ts";
import {
  accountIdOfEmail,
  closeP0Send,
  insertLoginCodeSend,
  reserveAuthAttempt,
  type P0SendFailure,
} from "./repository.ts";
import {
  CODE_REQUESTS_PER_EMAIL_15_MIN,
  CODE_REQUESTS_PER_EMAIL_HOUR,
  CODE_REQUESTS_PER_IP_HOUR,
  CODE_REQUESTS_UNKNOWN_IP_HOUR,
  GOTRUE_CODE_BUDGET_MS,
} from "./settings.ts";
import {
  addressThrottleKey,
  emailThrottleKey,
  globalThrottleKey,
} from "./throttle-keys.ts";

/** Version of the `auth.login_code` template, copied on the journal line (04 R7). */
export const LOGIN_CODE_TEMPLATE_VERSION = 1;

export type LoginCodeLogger = {
  warn(object: object, message: string): void;
};

export type LoginCodeDependencies = {
  database: ApiDatabase;
  supabaseAuth: Pick<SupabaseAuth, "createUser" | "generateEmailCode">;
  sender: TransactionalSender;
  /** AUTH_THROTTLE_PEPPER. */
  pepper: string;
  now: () => Date;
  /** G1 of steps 5 and 6; injectable for the tests only. */
  gotrueBudgetMs?: number;
};

export type LoginCodeRequest = {
  requestId: string;
  /** Normalised (02 §18.10 step 2). */
  email: string;
  /** Language of the page: of the phrase (RG129) and, at J3, of the e-mail (21 §3, EC-58). */
  locale: UiLocale;
  clientAddress: ClientAddress;
  browser: UserAgentSummary;
  logger: LoginCodeLogger;
};

export type LoginCodeResult = {
  outcome: RequestCodeOutcome;
  /** What the login cookie carries, only when the outcome is `sent` (step 9). */
  journey: { reference: string; email: string; phrase: string } | null;
};

/**
 * 05 RG44, step 3 a: the IP (or the global ceiling of an unknown IP, EC-21), then the address. Also
 * the ceilings of a re-authentication code (J7 decision 4): the same code, the same counters.
 */
export async function reserveCodeRequest(
  tx: Transaction,
  pepper: string,
  request: Pick<LoginCodeRequest, "clientAddress" | "email">,
): Promise<boolean> {
  const address = request.clientAddress;
  const ipAllowed =
    address.status === "known"
      ? await reserveAuthAttempt(
          tx,
          "code_request_ip",
          addressThrottleKey(address),
          "1h",
          CODE_REQUESTS_PER_IP_HOUR,
        )
      : await reserveAuthAttempt(
          tx,
          "code_request_unknown_ip",
          globalThrottleKey(pepper, "code_request_unknown_ip"),
          "1h",
          CODE_REQUESTS_UNKNOWN_IP_HOUR,
        );
  if (!ipAllowed) {
    return false;
  }
  const emailKey = emailThrottleKey(pepper, request.email);
  if (
    !(await reserveAuthAttempt(
      tx,
      "code_request_email",
      emailKey,
      "15m",
      CODE_REQUESTS_PER_EMAIL_15_MIN,
    ))
  ) {
    return false;
  }
  return reserveAuthAttempt(
    tx,
    "code_request_email",
    emailKey,
    "1h",
    CODE_REQUESTS_PER_EMAIL_HOUR,
  );
}

/** A promise bounded by a deadline: null when the deadline comes first. */
export async function beforeDeadline<T>(
  work: Promise<T | null>,
  deadline: number,
): Promise<T | null> {
  let timer: NodeJS.Timeout | undefined;
  const expiry = new Promise<null>((resolve) => {
    timer = setTimeout(
      () => resolve(null),
      Math.max(0, deadline - performance.now()),
    );
  });
  try {
    return await Promise.race([work, expiry]);
  } finally {
    clearTimeout(timer);
  }
}

/** Steps 5 and 6: the code, or null when GoTrue could not give one in time. */
async function obtainCode(
  dependencies: LoginCodeDependencies,
  request: LoginCodeRequest,
): Promise<string | null> {
  const deadline =
    performance.now() + (dependencies.gotrueBudgetMs ?? GOTRUE_CODE_BUDGET_MS);
  const work = async (): Promise<string | null> => {
    // Step 5, unconditionally: the same call for every address (R1).
    const created = await dependencies.supabaseAuth.createUser(request.email);
    const isKnown =
      !created.ok &&
      created.reason === "rejected" &&
      created.errorCode === "email_exists";
    if (!created.ok && !isKnown) {
      request.logger.warn(
        {
          reason: created.reason,
          errorCode: created.errorCode,
          status: created.status,
        },
        "login code: GoTrue user not created",
      );
      return null;
    }
    if (performance.now() >= deadline) {
      return null;
    }
    // Step 6: the code, nothing sent; the previous code of the user is replaced (J3-A b4).
    const generated = await dependencies.supabaseAuth.generateEmailCode(
      request.email,
    );
    if (!generated.ok) {
      request.logger.warn(
        {
          reason: generated.reason,
          errorCode: generated.errorCode,
          status: generated.status,
        },
        "login code: GoTrue code not generated",
      );
      return null;
    }
    return generated.value.code;
  };
  return beforeDeadline(work(), deadline);
}

export const FAILURE_OF: Readonly<
  Record<"undeliverable" | "unavailable", P0SendFailure>
> = {
  undeliverable: "undeliverable_address",
  unavailable: "provider_unavailable",
};

export const OUTCOME_OF: Readonly<
  Record<"sent" | "undeliverable" | "unavailable", RequestCodeOutcome>
> = {
  sent: "sent",
  undeliverable: "undeliverable",
  unavailable: "provider_unavailable",
};

export async function requestLoginCode(
  dependencies: LoginCodeDependencies,
  request: LoginCodeRequest,
): Promise<LoginCodeResult> {
  const requestedAt = dependencies.now();

  // Step 3: transaction n° 1 (E-1). Its audit line names the journal line (EC-52): none when
  // the ceiling is reached, since nothing but the counters was written.
  const opened = await withElevatedTransaction(
    dependencies.database,
    "identity.request_code",
    request.requestId,
    async (tx) => {
      if (!(await reserveCodeRequest(tx, dependencies.pepper, request))) {
        return { value: null, auditSubject: null };
      }
      const phrase = drawMatchingPhrase(request.locale);
      const accountId = await accountIdOfEmail(tx, request.email);
      const line = await insertLoginCodeSend(tx, {
        accountId,
        email: request.email,
        locale: request.locale,
        templateVersion: LOGIN_CODE_TEMPLATE_VERSION,
      });
      return { value: { line, phrase }, auditSubject: line.reference };
    },
  );
  if (opened === null) {
    return { outcome: "rate_limited", journey: null };
  }

  // Step 4: no transaction is open from here on. Steps 5 and 6.
  const code = await obtainCode(dependencies, request);

  // Step 7: one send, one attempt. Without a code, nothing is sent.
  const sent =
    code === null
      ? ({ status: "unavailable" } as const)
      : await dependencies.sender.send({
          template: "auth.login_code",
          to: request.email,
          idempotencyKey: `auth.login_code:${opened.line.id}`,
          ...renderLoginCodeEmail({
            locale: request.locale,
            code,
            phrase: opened.phrase,
            requestedAt,
            timeZone: DEFAULT_EMAIL_TIME_ZONE,
            browser: request.browser,
          }),
        });

  // Step 8: transaction n° 2 (E-1), the outcome only; no audit line (EC-52 (3)).
  await withElevatedTransaction(
    dependencies.database,
    "identity.request_code",
    request.requestId,
    async (tx) => {
      const closed = await closeP0Send(
        tx,
        opened.line.reference,
        sent.status === "sent"
          ? { status: "sent", messageId: sent.messageId }
          : { status: "failed", failureCode: FAILURE_OF[sent.status] },
      );
      if (!closed) {
        throw new Error("journal line of the login code was not queued");
      }
      return { value: undefined, auditSubject: null };
    },
  );

  return {
    outcome: OUTCOME_OF[sent.status],
    journey:
      sent.status === "sent"
        ? {
            reference: opened.line.reference,
            email: request.email,
            phrase: opened.phrase,
          }
        : null,
  };
}
