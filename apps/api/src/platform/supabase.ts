// Adapter of Supabase Auth (GoTrue): the ONLY importer of @supabase/* in apps/api (ESLint, 02
// §13.2; 21 §4, J3-B and J3-C rules 1 to 3).
// - Every call carries the secret key (`apikey` and `Authorization: Bearer`, as SupabaseClient.ts
//   2.117.2 sets them), a fixed User-Agent of our own (never the browser's, 05 Q14 point 5), and
//   `Sb-Forwarded-For` when the caller gives a pseudonymous address (EC-38).
// - The administration client holds no session: one instance per process. A user client stores
//   the GoTrue session in memory (J3-A b8): a new one is created for each request and never
//   shared, so that two users' sessions can never mix (rule 1).
// - No GoTrue token survives the request that obtained it (rule 2): once the identity is read,
//   the session is signed out through the administration API. A token is never returned, stored,
//   logged or put in a cookie.
// - INFLUX verifies no JWT (rule 3): the identity is the user id and address that GoTrue returns
//   in its answer to apps/api. What the caller compares with the account is its own business.
// - Nothing GoTrue answers is logged or returned as is: an error is reduced to GoTrue's error
//   code and the HTTP status (rule 7).
import {
  GoTrueAdminApi,
  GoTrueClient,
  isAuthApiError,
  isAuthError,
  type AuthError,
  type User,
} from "@supabase/auth-js";

/** Where GoTrue is and the key that opens it (SUPABASE_URL, SUPABASE_SECRET_KEY; EC-46). */
export type SupabaseAuthSettings = {
  /** Origin of the project, `https://<ref>.supabase.co` (http only on a loopback host). */
  url: string;
  /** `sb_secret_…` key of this service. */
  secretKey: string;
};

/** What the adapter writes to the logs: a message and codes, never a value. */
export type SupabaseAuthLogger = {
  warn(object: object, message: string): void;
};

/** Per-request context of the calls made with a user client (J3-C rule 1). */
export type GoTrueRequestContext = {
  /**
   * `Sb-Forwarded-For` value: the pseudonymous address of gotrueForwardedAddressOf(), or null
   * when the client address is unknown (then nothing is sent, EC-38 (2)).
   */
  forwardedFor: string | null;
  /** Bound of each GoTrue call of this request, in milliseconds (J3-C rule 6). */
  timeoutMs: number;
};

/** The identity GoTrue returns: its user id and the address it holds (J3-C rule 3). */
export type GoTrueIdentity = {
  userId: string;
  email: string;
};

export type GoTrueFailure = {
  ok: false;
  /**
   * `rejected`: GoTrue answered with a refusal (4xx). `unavailable`: no usable answer (time-out,
   * network, 5xx, malformed answer), a cause (b) of 02 §18.10.
   */
  reason: "rejected" | "unavailable";
  /** GoTrue's error code (`email_exists`, `otp_expired`…), never its message. */
  errorCode: string | null;
  /** HTTP status, or null when no answer was received. */
  status: number | null;
};

export type GoTrueOutcome<Value> = { ok: true; value: Value } | GoTrueFailure;

/** A login code obtained without any e-mail being sent (J3-A b1). */
export type GoTrueEmailCode = GoTrueIdentity & {
  /** The code itself: handed to the sender, never logged, stored or returned by a route. */
  code: string;
};

export type SupabaseAuth = {
  /** Creates a GoTrue user without password, address confirmed (02 §18.10, step 5; J3-A b7). */
  createUser(email: string): Promise<GoTrueOutcome<GoTrueIdentity>>;
  /** The user of an id, as GoTrue holds it (EC-4 point 4). */
  getUser(userId: string): Promise<GoTrueOutcome<GoTrueIdentity>>;
  /**
   * A new login code for an existing user, through generateLink: nothing is sent, and the
   * previous code of the user is replaced (J3-A b1, b4).
   */
  generateEmailCode(email: string): Promise<GoTrueOutcome<GoTrueEmailCode>>;
  /** Verifies a login code; the GoTrue session it opens is signed out at once (rule 2). */
  verifyEmailCode(
    context: GoTrueRequestContext,
    email: string,
    code: string,
  ): Promise<GoTrueOutcome<GoTrueIdentity>>;
  /** Verifies a password; the GoTrue session it opens is signed out at once (rule 2). */
  verifyPassword(
    context: GoTrueRequestContext,
    email: string,
    password: string,
  ): Promise<GoTrueOutcome<GoTrueIdentity>>;
};

/** Fixed User-Agent of apps/api towards GoTrue: the browser's never goes there (05 Q14 (5)). */
export const GOTRUE_USER_AGENT = "influx-api";

/** Header read by GoTrue for its per-client limits when the secret key is used (EC-38). */
export const FORWARDED_FOR_HEADER = "Sb-Forwarded-For";

/**
 * Bound of the administration calls, in milliseconds: generateLink, createUser, getUserById
 * (J3-C rule 6: 2 000 ms for the verification and the regeneration of EC-3).
 */
export const ADMIN_CALL_TIMEOUT_MS = 2_000;

/** Bound of the sign-out that closes a GoTrue session (J3-C rule 6). */
export const SIGN_OUT_TIMEOUT_MS = 1_000;

/** `fetch` whose every call gets its own time-out, on top of any signal the library passes. */
export function boundedFetch(
  timeoutMs: number,
  baseFetch: typeof fetch = fetch,
): typeof fetch {
  return (input, init) => {
    const timeout = AbortSignal.timeout(timeoutMs);
    const signal =
      init?.signal === undefined || init.signal === null
        ? timeout
        : AbortSignal.any([init.signal, timeout]);
    return baseFetch(input, { ...init, signal });
  };
}

/** Headers of every call: the secret key twice, our User-Agent, and the pseudonymous address. */
export function gotrueHeaders(
  secretKey: string,
  forwardedFor: string | null,
): Record<string, string> {
  const headers: Record<string, string> = {
    apikey: secretKey,
    Authorization: `Bearer ${secretKey}`,
    "User-Agent": GOTRUE_USER_AGENT,
  };
  if (forwardedFor !== null) {
    headers[FORWARDED_FOR_HEADER] = forwardedFor;
  }
  return headers;
}

/** An AuthError reduced to what may be logged and compared: code and status (rule 7). */
export function failureOf(error: AuthError): GoTrueFailure {
  const status =
    typeof error.status === "number" && error.status > 0 ? error.status : null;
  const errorCode = typeof error.code === "string" ? error.code : null;
  const isRefusal =
    isAuthApiError(error) && status !== null && status >= 400 && status < 500;
  return {
    ok: false,
    reason: isRefusal ? "rejected" : "unavailable",
    errorCode,
    status,
  };
}

const MALFORMED_ANSWER: GoTrueFailure = {
  ok: false,
  reason: "unavailable",
  errorCode: null,
  status: null,
};

function identityOf(user: User | null | undefined): GoTrueIdentity | null {
  if (
    user === null ||
    user === undefined ||
    typeof user.id !== "string" ||
    typeof user.email !== "string"
  ) {
    return null;
  }
  return { userId: user.id, email: user.email };
}

/**
 * Runs a call of the library. Its errors come back as values (throwOnError is false); anything
 * thrown that is not an AuthError is a programming error and propagates.
 */
async function settled<Value>(
  call: () => Promise<{ error: AuthError | null } & Value>,
): Promise<({ error: null } & Value) | GoTrueFailure> {
  try {
    const result = await call();
    if (result.error !== null) {
      return failureOf(result.error);
    }
    return result as { error: null } & Value;
  } catch (error) {
    if (isAuthError(error)) {
      return failureOf(error);
    }
    throw error;
  }
}

export function createSupabaseAuth(
  settings: SupabaseAuthSettings,
  logger: SupabaseAuthLogger,
): SupabaseAuth {
  const authUrl = `${settings.url}/auth/v1`;
  const adminHeaders = gotrueHeaders(settings.secretKey, null);
  // Stateless: one instance per process for the administration calls, one for the sign-out,
  // which has a shorter bound (rule 6). Neither ever holds a user session.
  const admin = new GoTrueAdminApi({
    url: authUrl,
    headers: adminHeaders,
    fetch: boundedFetch(ADMIN_CALL_TIMEOUT_MS),
  });
  const signOutApi = new GoTrueAdminApi({
    url: authUrl,
    headers: adminHeaders,
    fetch: boundedFetch(SIGN_OUT_TIMEOUT_MS),
  });

  /** A client for one request: session in memory only, no timer, no URL detection (rule 1). */
  function createUserAuthClient(context: GoTrueRequestContext): GoTrueClient {
    return new GoTrueClient({
      url: authUrl,
      headers: gotrueHeaders(settings.secretKey, context.forwardedFor),
      fetch: boundedFetch(context.timeoutMs),
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      // No background initialisation: nothing runs outside the calls of the request.
      skipAutoInitialize: true,
    });
  }

  /**
   * Rule 2: the GoTrue session is closed as soon as the identity is read. A failure leaves a
   * `warn` line with GoTrue's code only, never an error shown to the user.
   */
  async function closeSession(accessToken: string): Promise<void> {
    const outcome = await settled(() =>
      signOutApi.signOut(accessToken, "local"),
    );
    if ("ok" in outcome) {
      logger.warn(
        {
          reason: outcome.reason,
          errorCode: outcome.errorCode,
          status: outcome.status,
        },
        "GoTrue session could not be signed out",
      );
    }
  }

  async function signInOnce(
    context: GoTrueRequestContext,
    signIn: (client: GoTrueClient) => ReturnType<GoTrueClient["verifyOtp"]>,
  ): Promise<GoTrueOutcome<GoTrueIdentity>> {
    const client = createUserAuthClient(context);
    const outcome = await settled(() => signIn(client));
    if ("ok" in outcome) {
      return outcome;
    }
    const { session, user } = outcome.data;
    if (session !== null) {
      await closeSession(session.access_token);
    }
    const identity = identityOf(user);
    return identity === null || session === null
      ? MALFORMED_ANSWER
      : { ok: true, value: identity };
  }

  return {
    async createUser(email) {
      const outcome = await settled(() =>
        admin.createUser({ email, email_confirm: true }),
      );
      if ("ok" in outcome) {
        return outcome;
      }
      const identity = identityOf(outcome.data.user);
      return identity === null
        ? MALFORMED_ANSWER
        : { ok: true, value: identity };
    },

    async getUser(userId) {
      const outcome = await settled(() => admin.getUserById(userId));
      if ("ok" in outcome) {
        return outcome;
      }
      const identity = identityOf(outcome.data.user);
      return identity === null
        ? MALFORMED_ANSWER
        : { ok: true, value: identity };
    },

    async generateEmailCode(email) {
      const outcome = await settled(() =>
        admin.generateLink({ type: "magiclink", email }),
      );
      if ("ok" in outcome) {
        return outcome;
      }
      const identity = identityOf(outcome.data.user);
      const code = outcome.data.properties?.email_otp;
      return identity === null || typeof code !== "string"
        ? MALFORMED_ANSWER
        : { ok: true, value: { ...identity, code } };
    },

    verifyEmailCode(context, email, code) {
      return signInOnce(context, (client) =>
        client.verifyOtp({ email, token: code, type: "email" }),
      );
    },

    verifyPassword(context, email, password) {
      return signInOnce(context, (client) =>
        client.signInWithPassword({ email, password }),
      );
    },
  };
}
