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
  /**
   * Bound of ALL the user-client calls of a request (backoffice sign-in: 5 000 ms in total, J3-C
   * rule 6), on top of the bound of each call. The sign-out is never under it.
   */
  deadline?: AbortSignal;
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

/** A second factor of a user, as the administration API lists it (any type: G-1, EC-56). */
export type GoTrueFactor = {
  id: string;
  /** `totp`, `phone`, `webauthn`… as GoTrue names it. */
  factorType: string;
  status: "verified" | "unverified";
};

/** A new, unverified TOTP factor (J3-A c1). Secret, URI and QR code are never logged. */
export type GoTrueTotpEnrollment = {
  factorId: string;
  /** The raw SVG text of the QR code (J3-C rule 5), without the data: prefix of auth-js. */
  qrCodeSvg: string;
  secret: string;
  uri: string;
};

/**
 * The GoTrue session opened by a password, for the calls that need it in the same request (J3-C
 * rule 4): the TOTP challenge and its verification, the enrollment of a factor. It only exists
 * inside withPasswordSession(), which signs it out whatever happens (rule 2).
 */
export type GoTruePasswordSession = {
  identity: GoTrueIdentity;
  /** Challenges this factor and verifies the code, in one step (J3-A c5: same address). */
  verifyTotp(factorId: string, code: string): Promise<GoTrueOutcome<null>>;
  /** Enrolls a new TOTP factor under a constant name (EC-56). */
  enrollTotp(
    friendlyName: string,
    issuer: string,
  ): Promise<GoTrueOutcome<GoTrueTotpEnrollment>>;
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
  /**
   * Verifies a password; the GoTrue session it opens is signed out at once (rule 2). A password
   * outside the bounds of EC-57 is refused without any call.
   */
  verifyPassword(
    context: GoTrueRequestContext,
    email: string,
    password: string,
  ): Promise<GoTrueOutcome<GoTrueIdentity>>;
  /**
   * Signs in with a password, runs `use` with the GoTrue session, then signs it out, even when
   * `use` throws (rules 2 and 4). A password outside the bounds of EC-57 is refused without any
   * call. `use` may run database transactions, never with a GoTrue call pending inside them (G4).
   */
  withPasswordSession<Value>(
    context: GoTrueRequestContext,
    email: string,
    password: string,
    use: (session: GoTruePasswordSession) => Promise<Value>,
  ): Promise<GoTrueOutcome<Value>>;
  /** Every factor of a user, whatever its type (administration API, G-1, EC-56). */
  listFactors(userId: string): Promise<GoTrueOutcome<GoTrueFactor[]>>;
  /** Deletes one factor of a user (administration API, EC-56). */
  deleteFactor(userId: string, factorId: string): Promise<GoTrueOutcome<null>>;
  /**
   * Moves a user to another address, confirmed, nothing sent (administration API; 05 RG58, J7
   * decision 5): after both codes of a change were typed, and to set it back when the database
   * refuses the change. Another user holding the address is `rejected` `email_exists`.
   */
  updateUserEmail(
    userId: string,
    email: string,
  ): Promise<GoTrueOutcome<GoTrueIdentity>>;
};

/** EC-57, B-1: 12 characters at least (code points). */
export const PASSWORD_MIN_CHARACTERS = 12;
/** EC-57: bcrypt reads 72 bytes; beyond, an explicit refusal, never a truncation. */
export const PASSWORD_MAX_UTF8_BYTES = 72;

/** EC-57: whether a password may be sent to GoTrue at all (local guard, before any call). */
export function isPasswordWithinBounds(password: string): boolean {
  return (
    [...password].length >= PASSWORD_MIN_CHARACTERS &&
    Buffer.byteLength(password, "utf8") <= PASSWORD_MAX_UTF8_BYTES
  );
}

/** The local refusal of EC-57: `rejected`, a code of ours, no status (no call was made). */
const PASSWORD_OUT_OF_BOUNDS: GoTrueFailure = {
  ok: false,
  reason: "rejected",
  errorCode: "password_out_of_bounds",
  status: null,
};

/** auth-js prefixes the SVG of the QR code with this data: URL header (2.117.2). */
const QR_CODE_DATA_PREFIX = "data:image/svg+xml;utf-8,";

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

/**
 * `fetch` whose every call gets its own time-out, on top of any signal the library passes and of
 * the deadline of the whole request, when there is one.
 */
export function boundedFetch(
  timeoutMs: number,
  baseFetch: typeof fetch = fetch,
  deadline?: AbortSignal,
): typeof fetch {
  return (input, init) => {
    const signals = [AbortSignal.timeout(timeoutMs)];
    if (init?.signal !== undefined && init.signal !== null) {
      signals.push(init.signal);
    }
    if (deadline !== undefined) {
      signals.push(deadline);
    }
    const signal = signals.length === 1 ? signals[0] : AbortSignal.any(signals);
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

/**
 * An AuthError reduced to what may be logged and compared: code and status (rule 7). A refusal is
 * any AuthError of status 400 to 499, whatever its class: `AuthWeakPasswordError` (422
 * weak_password) is not an `AuthApiError`, and read as a failure of GoTrue it would pass a refused
 * password for an outage (21 §4, "Arbitrages après le commit 7", C7-1). Anything else, including
 * a network failure (status 0), is `unavailable`.
 */
export function failureOf(error: AuthError): GoTrueFailure {
  const status =
    typeof error.status === "number" && error.status > 0 ? error.status : null;
  const errorCode = typeof error.code === "string" ? error.code : null;
  const isRefusal = status !== null && status >= 400 && status < 500;
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
      fetch: boundedFetch(context.timeoutMs, fetch, context.deadline),
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

    async verifyPassword(context, email, password) {
      if (!isPasswordWithinBounds(password)) {
        return PASSWORD_OUT_OF_BOUNDS;
      }
      return signInOnce(context, (client) =>
        client.signInWithPassword({ email, password }),
      );
    },

    async withPasswordSession(context, email, password, use) {
      // EC-57: below 12 characters or beyond 72 bytes, nothing is sent (GoTrue answers a 500 to
      // 73 bytes, which would read as an outage).
      if (!isPasswordWithinBounds(password)) {
        return PASSWORD_OUT_OF_BOUNDS;
      }
      const client = createUserAuthClient(context);
      const signedIn = await settled(() =>
        client.signInWithPassword({ email, password }),
      );
      if ("ok" in signedIn) {
        return signedIn;
      }
      const { session, user } = signedIn.data;
      const identity = identityOf(user);
      if (session === null || identity === null) {
        if (session !== null) {
          await closeSession(session.access_token);
        }
        return MALFORMED_ANSWER;
      }
      const passwordSession: GoTruePasswordSession = {
        identity,
        async verifyTotp(factorId, code) {
          // Challenge and verification in the same request, from the same address (J3-A c5).
          const verified = await settled(() =>
            client.mfa.challengeAndVerify({ factorId, code }),
          );
          return "ok" in verified ? verified : { ok: true, value: null };
        },
        async enrollTotp(friendlyName, issuer) {
          const enrolled = await settled(() =>
            client.mfa.enroll({ factorType: "totp", friendlyName, issuer }),
          );
          if ("ok" in enrolled) {
            return enrolled;
          }
          const data = enrolled.data;
          if (data === null || !("totp" in data) || data.totp === undefined) {
            return MALFORMED_ANSWER;
          }
          const { qr_code: qrCode, secret, uri } = data.totp;
          if (
            typeof data.id !== "string" ||
            typeof qrCode !== "string" ||
            typeof secret !== "string" ||
            typeof uri !== "string"
          ) {
            return MALFORMED_ANSWER;
          }
          return {
            ok: true,
            value: {
              factorId: data.id,
              // Rule 5: the raw SVG text; auth-js turned it into a data: URL.
              qrCodeSvg: qrCode.startsWith(QR_CODE_DATA_PREFIX)
                ? qrCode.slice(QR_CODE_DATA_PREFIX.length)
                : qrCode,
              secret,
              uri,
            },
          };
        },
      };
      try {
        return { ok: true, value: await use(passwordSession) };
      } finally {
        // Rule 2: whatever `use` did or threw, the GoTrue session ends with the request. The
        // verification of a factor keeps the session id: its first token closes it.
        await closeSession(session.access_token);
      }
    },

    async listFactors(userId) {
      const outcome = await settled(() => admin.mfa.listFactors({ userId }));
      if ("ok" in outcome) {
        return outcome;
      }
      const factors = outcome.data?.factors;
      if (!Array.isArray(factors)) {
        return MALFORMED_ANSWER;
      }
      const listed: GoTrueFactor[] = [];
      for (const factor of factors) {
        if (
          typeof factor.id !== "string" ||
          typeof factor.factor_type !== "string" ||
          (factor.status !== "verified" && factor.status !== "unverified")
        ) {
          return MALFORMED_ANSWER;
        }
        listed.push({
          id: factor.id,
          factorType: factor.factor_type,
          status: factor.status,
        });
      }
      return { ok: true, value: listed };
    },

    async updateUserEmail(userId, email) {
      const outcome = await settled(() =>
        admin.updateUserById(userId, { email, email_confirm: true }),
      );
      if ("ok" in outcome) {
        return outcome;
      }
      const identity = identityOf(outcome.data.user);
      return identity === null
        ? MALFORMED_ANSWER
        : { ok: true, value: identity };
    },

    async deleteFactor(userId, factorId) {
      const outcome = await settled(() =>
        admin.mfa.deleteFactor({ userId, id: factorId }),
      );
      return "ok" in outcome ? outcome : { ok: true, value: null };
    },
  };
}

// ---------------------------------------------------------------------------------------------
// The directory of GoTrue users, for the purge of the users without an account (04 §9, D43;
// J7 decision 3). The worker's only use of GoTrue: list, read one, delete one, through the
// administration API, never a DELETE on the auth schema (02 §5.1). Nothing personal is kept of a
// listed user: its id and three instants, never its address (D60). The realignment of the same
// hourly pass (C5.b of the J7 commit 7 review) reads and writes the address of the users of the
// accounts that changed address, in memory only, never logged.
// ---------------------------------------------------------------------------------------------

/** What the purge needs of a GoTrue user: its id and its activity instants (epoch ms). */
export type GoTrueUserActivity = {
  userId: string;
  createdAt: number;
  /** null when GoTrue gives none. */
  updatedAt: number | null;
  /** null for a user who never signed in. */
  lastSignInAt: number | null;
};

export type GoTrueUserPage = {
  users: GoTrueUserActivity[];
  /** The next page number, or null after the last one. */
  nextPage: number | null;
};

export type GoTrueUserDirectory = {
  /** One page of the users (administration API, `GET /admin/users?page&per_page`). */
  listUsers(
    page: number,
    perPage: number,
  ): Promise<GoTrueOutcome<GoTrueUserPage>>;
  /** One user's activity read again; `rejected` with status 404 when it is gone. */
  readUser(userId: string): Promise<GoTrueOutcome<GoTrueUserActivity>>;
  /** Deletes a user for good (`DELETE /admin/users/{id}`, never a soft delete). */
  deleteUser(userId: string): Promise<GoTrueOutcome<null>>;
  /** The address GoTrue holds for a user; `rejected` with status 404 when it is gone. */
  readUserAddress(userId: string): Promise<GoTrueOutcome<GoTrueIdentity>>;
  /** Moves a user to an address, confirmed, nothing sent; another holder is `email_exists`. */
  moveUserAddress(
    userId: string,
    email: string,
  ): Promise<GoTrueOutcome<GoTrueIdentity>>;
  /**
   * The user holding an address, through generateLink (no lookup by address in the API): nothing
   * is sent, the code it generates is dropped unread. Called only once GoTrue said the address is
   * held (`email_exists`).
   */
  userOfAddress(email: string): Promise<GoTrueOutcome<string>>;
};

function instantOf(value: unknown): number | null {
  if (typeof value !== "string" || value === "") {
    return null;
  }
  const instant = Date.parse(value);
  return Number.isNaN(instant) ? null : instant;
}

/** The activity of a user, or null when its id or creation instant is missing (malformed). */
function activityOf(user: User | null | undefined): GoTrueUserActivity | null {
  if (user === null || user === undefined || typeof user.id !== "string") {
    return null;
  }
  const createdAt = instantOf(user.created_at);
  if (createdAt === null) {
    return null;
  }
  return {
    userId: user.id,
    createdAt,
    updatedAt: instantOf(user.updated_at),
    lastSignInAt: instantOf(user.last_sign_in_at),
  };
}

export function createGoTrueUserDirectory(
  settings: SupabaseAuthSettings,
): GoTrueUserDirectory {
  const admin = new GoTrueAdminApi({
    url: `${settings.url}/auth/v1`,
    headers: gotrueHeaders(settings.secretKey, null),
    fetch: boundedFetch(ADMIN_CALL_TIMEOUT_MS),
  });

  return {
    async listUsers(page, perPage) {
      const outcome = await settled(() => admin.listUsers({ page, perPage }));
      if ("ok" in outcome) {
        return outcome;
      }
      const users: GoTrueUserActivity[] = [];
      for (const user of outcome.data.users) {
        const activity = activityOf(user);
        if (activity === null) {
          return MALFORMED_ANSWER;
        }
        users.push(activity);
      }
      // auth-js 2.117.2 reads the page of the Link header from its FIRST digit only (page 10 is
      // read as 1): its nextPage is not trusted. A full page means there may be another one.
      return {
        ok: true,
        value: { users, nextPage: users.length < perPage ? null : page + 1 },
      };
    },

    async readUser(userId) {
      const outcome = await settled(() => admin.getUserById(userId));
      if ("ok" in outcome) {
        return outcome;
      }
      const activity = activityOf(outcome.data.user);
      return activity === null
        ? MALFORMED_ANSWER
        : { ok: true, value: activity };
    },

    async deleteUser(userId) {
      const outcome = await settled(() => admin.deleteUser(userId, false));
      return "ok" in outcome ? outcome : { ok: true, value: null };
    },

    async readUserAddress(userId) {
      const outcome = await settled(() => admin.getUserById(userId));
      if ("ok" in outcome) {
        return outcome;
      }
      const identity = identityOf(outcome.data.user);
      return identity === null
        ? MALFORMED_ANSWER
        : { ok: true, value: identity };
    },

    async moveUserAddress(userId, email) {
      const outcome = await settled(() =>
        admin.updateUserById(userId, { email, email_confirm: true }),
      );
      if ("ok" in outcome) {
        return outcome;
      }
      const identity = identityOf(outcome.data.user);
      return identity === null
        ? MALFORMED_ANSWER
        : { ok: true, value: identity };
    },

    async userOfAddress(email) {
      const outcome = await settled(() =>
        admin.generateLink({ type: "magiclink", email }),
      );
      if ("ok" in outcome) {
        return outcome;
      }
      const identity = identityOf(outcome.data.user);
      return identity === null || identity.email !== email
        ? MALFORMED_ANSWER
        : { ok: true, value: identity.userId };
    },
  };
}
