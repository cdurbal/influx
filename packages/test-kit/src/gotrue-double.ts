// The GoTrue double of the purge of the users without an account (04 §9, J7 decision 3): a fake
// administration API on the LOOPBACK only, so that the purge runs through the real adapter
// (apps/api/src/platform/supabase.ts, createGoTrueUserDirectory) without any real GoTrue.
// It answers, as GoTrue 2.x and @supabase/auth-js 2.117.2 expect:
//   GET    /auth/v1/admin/users?page&per_page   `{users, aud}`, headers x-total-count and link
//   GET    /auth/v1/admin/users/{id}            the user, or 404 user_not_found
//   DELETE /auth/v1/admin/users/{id}            the user deleted, or 404 user_not_found
//   PUT    /auth/v1/admin/users/{id}            {email}: the user moved, 422 email_exists when
//                                               another user holds it, or 404 user_not_found
//   POST   /auth/v1/admin/generate_link         {type, email}: the user holding the address with
//                                               a code (never sent), or a NEW user (magiclink
//                                               creates one, as GoTrue does)
// (the last two for the realignment of C5.b, J7 commit 7 review).
// Users are listed by creation, as GoTrue does. Every request is recorded; an answer queued by a
// test is used by the next request, whatever its path, and changes nothing.
import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

export type GoTrueDoubleUser = {
  id: string;
  email: string;
  /** ISO 8601. */
  created_at: string;
  updated_at: string;
  last_sign_in_at: string | null;
};

export type GoTrueDoubleRequest = {
  method: string;
  path: string;
  authorization: string | undefined;
  /** The JSON body, or undefined. */
  body: unknown;
};

export type GoTrueDoubleAnswer = { status: number; body: unknown };

export type GoTrueDouble = {
  /** `http://127.0.0.1:<port>`: the value of SUPABASE_URL. */
  url: string;
  /** The users, by id. */
  users: Map<string, GoTrueDoubleUser>;
  requests: GoTrueDoubleRequest[];
  /** A user created `ageHours` ago, never signed in unless told; its id. */
  addUser(user: {
    ageHours: number;
    updatedHoursAgo?: number;
    signedInHoursAgo?: number | null;
    id?: string;
    /** gotrue-<id>@example.test when absent. */
    email?: string;
  }): string;
  queue(...answers: GoTrueDoubleAnswer[]): void;
  reset(): void;
  close(): Promise<void>;
};

const USERS_PATH = "/auth/v1/admin/users";
const USER_PATH = /^\/auth\/v1\/admin\/users\/([0-9a-f-]{36})$/;
const GENERATE_LINK_PATH = "/auth/v1/admin/generate_link";
const HOUR_MS = 3_600_000;

const NOT_FOUND: GoTrueDoubleAnswer = {
  status: 404,
  body: { code: 404, error_code: "user_not_found", msg: "User not found" },
};

const EMAIL_EXISTS: GoTrueDoubleAnswer = {
  status: 422,
  body: {
    code: 422,
    error_code: "email_exists",
    msg: "A user with this email address has already been registered",
  },
};

function emailOf(body: unknown): string | null {
  return typeof body === "object" &&
    body !== null &&
    "email" in body &&
    typeof body.email === "string"
    ? body.email.toLowerCase()
    : null;
}

function asGoTrue(user: GoTrueDoubleUser): Record<string, unknown> {
  return {
    ...user,
    aud: "authenticated",
    role: "authenticated",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    identities: [],
    is_anonymous: false,
  };
}

export async function startGoTrueDouble(): Promise<GoTrueDouble> {
  const users = new Map<string, GoTrueDoubleUser>();
  const requests: GoTrueDoubleRequest[] = [];
  const pending: GoTrueDoubleAnswer[] = [];

  function list(query: URLSearchParams): {
    answer: GoTrueDoubleAnswer;
    headers: Record<string, string>;
  } {
    const page = Math.max(1, Number(query.get("page") || "1"));
    const perPage = Math.max(1, Number(query.get("per_page") || "50"));
    const all = [...users.values()].sort((a, b) =>
      a.created_at.localeCompare(b.created_at),
    );
    const lastPage = Math.max(1, Math.ceil(all.length / perPage));
    const links = [
      `</admin/users?page=${lastPage}&per_page=${perPage}>; rel="last"`,
    ];
    if (page < lastPage) {
      links.unshift(
        `</admin/users?page=${page + 1}&per_page=${perPage}>; rel="next"`,
      );
    }
    return {
      answer: {
        status: 200,
        body: {
          users: all.slice((page - 1) * perPage, page * perPage).map(asGoTrue),
          aud: "authenticated",
        },
      },
      headers: { "x-total-count": String(all.length), link: links.join(",") },
    };
  }

  function holderOf(email: string): GoTrueDoubleUser | undefined {
    return [...users.values()].find((user) => user.email === email);
  }

  const server: Server = createServer((request, response) => {
    let text = "";
    request.on("data", (chunk: Buffer) => {
      text += chunk.toString("utf8");
    });
    request.on("end", () => {
      const method = request.method ?? "GET";
      const url = new URL(request.url ?? "/", "http://double.invalid");
      let body: unknown;
      try {
        body = text === "" ? undefined : JSON.parse(text);
      } catch {
        body = undefined;
      }
      requests.push({
        method,
        path: url.pathname + url.search,
        authorization: request.headers.authorization,
        body,
      });
      let answer: GoTrueDoubleAnswer = NOT_FOUND;
      let headers: Record<string, string> = {};
      const queued = pending.shift();
      const single = USER_PATH.exec(url.pathname);
      if (queued !== undefined) {
        answer = queued;
      } else if (method === "GET" && url.pathname === USERS_PATH) {
        ({ answer, headers } = list(url.searchParams));
      } else if (method === "POST" && url.pathname === GENERATE_LINK_PATH) {
        const email = emailOf(body);
        if (email !== null) {
          const now = new Date().toISOString();
          let user = holderOf(email);
          if (user === undefined) {
            user = {
              id: randomUUID(),
              email,
              created_at: now,
              updated_at: now,
              last_sign_in_at: null,
            };
            users.set(user.id, user);
          }
          answer = {
            status: 200,
            body: {
              ...asGoTrue(user),
              action_link: "http://double.invalid/verify",
              email_otp: "000000",
              hashed_token: "hashed",
              redirect_to: "http://double.invalid",
              verification_type: "magiclink",
            },
          };
        }
      } else if (single?.[1] !== undefined) {
        const user = users.get(single[1]);
        if (user !== undefined && method === "GET") {
          answer = { status: 200, body: asGoTrue(user) };
        } else if (user !== undefined && method === "DELETE") {
          users.delete(user.id);
          answer = { status: 200, body: asGoTrue(user) };
        } else if (user !== undefined && method === "PUT") {
          const email = emailOf(body);
          const holder = email === null ? undefined : holderOf(email);
          if (holder !== undefined && holder.id !== user.id) {
            answer = EMAIL_EXISTS;
          } else {
            if (email !== null) {
              user.email = email;
              user.updated_at = new Date().toISOString();
            }
            answer = { status: 200, body: asGoTrue(user) };
          }
        }
      }
      response.writeHead(answer.status, {
        "content-type": "application/json",
        "x-supabase-api-version": "2024-01-01",
        ...headers,
      });
      response.end(JSON.stringify(answer.body));
    });
  });
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    users,
    requests,
    addUser({ ageHours, updatedHoursAgo, signedInHoursAgo = null, id, email }) {
      const now = Date.now();
      const at = (hours: number) =>
        new Date(now - hours * HOUR_MS).toISOString();
      const userId = id ?? randomUUID();
      users.set(userId, {
        id: userId,
        email: email ?? `gotrue-${userId}@example.test`,
        created_at: at(ageHours),
        updated_at: at(updatedHoursAgo ?? ageHours),
        last_sign_in_at:
          signedInHoursAgo === null ? null : at(signedInHoursAgo),
      });
      return userId;
    },
    queue(...answers) {
      pending.push(...answers);
    },
    reset() {
      users.clear();
      requests.length = 0;
      pending.length = 0;
    },
    close() {
      return new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      });
    },
  };
}
