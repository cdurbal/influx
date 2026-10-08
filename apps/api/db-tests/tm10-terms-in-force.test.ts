// TM10 (J5, commit 3) — the database half of the public documents, migrations 0108 and 0109 (21
// EC-62 and its amendment): identity.terms_in_force() serves the version in force of a document,
// with its exact text, in the requested language, otherwise in English (05 RG25), never a version
// published for later, a closed one or an inherited one without text; it refuses the supervision
// notice and a malformed language, and is reachable by influx_auth only, which reads nothing of
// identity.terms_versions directly. identity.terms_versions.content (0109): the text matches the
// hash, a new version in force carries it, an inherited row without text can be closed or filled
// once.
//
// The behaviour cases need versions the stack does not have AND the absence of versions it may
// have (the demo accounts publish an English terms of service, the publication script of J5 the
// three documents). identity.terms_versions is never deleted and holds one version in force per
// document and language: nothing can be committed for a case. Each scenario therefore shapes the
// table in a ROLLED-BACK transaction of the migration role, then takes influx_auth in that same
// transaction through a membership granted INSIDE it (the migration role holds ADMIN on
// influx_auth). The membership disappears with the rollback, even when the run is interrupted
// (no entry needed in temporary-rights.ts), and no other connection ever sees it. The rights cases
// take the roles the way apps/api does (influx_auth from influx_auth_login, the business roles
// from influx_app, 18 T2 rule 5).
import {
  inRolledBackTransaction,
  probe,
  takeRole,
  type DataSet,
  type UserContext,
} from "@influx/test-kit/db";
import { createHash } from "node:crypto";
import type postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import { loginRole, migrationRole, testDataSet } from "./support.ts";

const INSUFFICIENT_PRIVILEGE = "42501";
const INVALID_PARAMETER = "22023";
const CHECK_VIOLATION = "23514";

const FUNCTION = "identity.terms_in_force(identity.document_kind, text)";
const IN_FORCE =
  "select id::text, document_kind::text, locale::text, version_label, content_uri, content_hash, " +
  "requires_acceptance, effective_from, content " +
  "from identity.terms_in_force($1::identity.document_kind, $2)";

type Kind = "terms_of_service" | "privacy_policy" | "cookie_policy";
type Version = {
  id: string;
  document_kind: string;
  locale: string;
  version_label: string;
  content_uri: string;
  content_hash: Buffer;
  requires_acceptance: boolean;
  effective_from: Date;
  content: string | null;
};

/**
 * Periods relative to now() of the scenario transaction, which is also the now() the function
 * reads: `current` started an hour ago, `now` starts at that very instant (the boundary of
 * effective_from <= now()), `future` starts tomorrow, `closed` ran from two days ago to yesterday.
 */
const PERIODS = {
  current: { from: "-1 hour", to: null },
  now: { from: "0 seconds", to: null },
  future: { from: "1 day", to: null },
  closed: { from: "-2 days", to: "-1 day" },
} as const;
type Period = keyof typeof PERIODS;

let dataSet: DataSet;
let migration: postgres.Sql;

/** Closes every version of `kind` still open (in force or published for later), in the scenario. */
async function withdrawAll(
  tx: postgres.TransactionSql,
  kind: Kind | "supervision_notice",
): Promise<void> {
  await tx.unsafe(
    "update identity.terms_versions " +
      "set effective_to = greatest(effective_from + interval '1 second', now()) " +
      "where document_kind = $1::identity.document_kind and effective_to is null",
    [kind],
  );
}

/** The text of a test version: not ASCII, so that the hash is over the UTF-8 bytes indeed. */
function textOf(label: string): string {
  return `# ${label}\n\nProjet non contractuel — clause d’essai, à lire.\n`;
}

const INSERT_VERSION =
  "insert into identity.terms_versions " +
  "(document_kind, locale, version_label, content_uri, content_hash, requires_acceptance, " +
  " published_at, effective_from, effective_to, content) " +
  "values ($1::identity.document_kind, $2, $3, $4, sha256(convert_to($7, 'UTF8')), " +
  "        $1::identity.document_kind = 'terms_of_service', " +
  "        least(now(), now() + $5::interval), now() + $5::interval, now() + $6::interval, $8) " +
  "returning id::text, document_kind::text, locale::text, version_label, content_uri, " +
  "          content_hash, requires_acceptance, effective_from, content";

/**
 * Parameters of INSERT_VERSION. The hash is always the one of textOf(label); `content` is the
 * stored text: the same by default, another one or none for the refusals and the inherited rows.
 */
function versionParameters(
  kind: Kind | "supervision_notice",
  locale: string,
  period: Period,
  content?: string | null,
): postgres.ParameterOrJSON<never>[] {
  const label = `tm10-ec62-${locale}-${period}`;
  const { from, to } = PERIODS[period];
  return [
    kind,
    locale,
    label,
    `legal/${kind}/${locale}/${label}.md`,
    from,
    to,
    textOf(label),
    content === undefined ? textOf(label) : content,
  ] as postgres.ParameterOrJSON<never>[];
}

/** Publishes one version of `kind` in `locale` for `period`, with its text; returns it. */
async function publish(
  tx: postgres.TransactionSql,
  kind: Kind | "supervision_notice",
  locale: string,
  period: Period,
): Promise<Version> {
  const [row] = await tx.unsafe<Version[]>(
    INSERT_VERSION,
    versionParameters(kind, locale, period),
  );
  if (row === undefined) {
    throw new Error("terms version not inserted");
  }
  return row;
}

/**
 * An INHERITED version in force, published without text before 0109 (draft-2 on the workstations,
 * demo-fictive-1 on staging). Such a row can no longer be inserted: the NOT VALID constraint is
 * dropped for the insert and put back at once, NOT VALID as 0109 leaves it, inside the rolled-back
 * transaction of the scenario (ACCESS EXCLUSIVE lock until the rollback; files run one by one).
 */
async function publishInherited(
  tx: postgres.TransactionSql,
  kind: Kind,
  locale: string,
): Promise<Version> {
  await tx.unsafe(
    "alter table identity.terms_versions drop constraint terms_versions_content_required",
  );
  const [row] = await tx.unsafe<Version[]>(
    INSERT_VERSION,
    versionParameters(kind, locale, "current", null),
  );
  await tx.unsafe(
    "alter table identity.terms_versions add constraint terms_versions_content_required " +
      "check (content is not null or effective_to is not null) not valid",
  );
  if (row === undefined) {
    throw new Error("inherited terms version not inserted");
  }
  return row;
}

/** Takes influx_auth in a migration-role transaction (see the head of the file). */
async function becomeAuth(tx: postgres.TransactionSql): Promise<void> {
  await tx.unsafe(
    "grant influx_auth to current_user with inherit false, set true",
  );
  await tx.unsafe("set local role influx_auth");
}

/**
 * Shapes identity.terms_versions as the migration role, then takes influx_auth in the same
 * rolled-back transaction (see the head of the file) and acts.
 */
function scenario<T>(
  shape: (tx: postgres.TransactionSql) => Promise<void>,
  act: (tx: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  return inRolledBackTransaction(migration, async (tx) => {
    await shape(tx);
    await becomeAuth(tx);
    return act(tx);
  });
}

function inForce(
  tx: postgres.TransactionSql,
  kind: string | null,
  locale: string | null,
): Promise<Version[]> {
  return tx.unsafe<Version[]>(IN_FORCE, [kind, locale]);
}

function asAuth<T>(
  fn: (tx: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  return inRolledBackTransaction(loginRole("influx_auth_login"), async (tx) => {
    await takeRole(tx, "influx_auth");
    return fn(tx);
  });
}

const TAKEN = {
  advertiser: "influx_advertiser",
  creator: "influx_creator",
  agent: "influx_agent",
  admin: "influx_admin",
} as const;

function contextOf(role: UserContext["role"]): UserContext {
  return {
    accountId: dataSet.accounts[role].a.id,
    role,
    aal: role === "agent" || role === "admin" ? "aal2" : "aal1",
  };
}

function asMember<T>(
  context: UserContext,
  fn: (tx: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  return inRolledBackTransaction(loginRole("influx_app"), async (tx) => {
    await takeRole(tx, TAKEN[context.role], context);
    return fn(tx);
  });
}

beforeAll(async () => {
  migration = migrationRole();
  dataSet = await testDataSet();
});

describe("EC-62: identity.terms_in_force() serves the version in force", () => {
  it("serves the version in force in the requested language, every column, its text", async () => {
    let fr: Version | undefined;
    const rows = await scenario(
      async (tx) => {
        await withdrawAll(tx, "terms_of_service");
        fr = await publish(tx, "terms_of_service", "fr", "current");
        await publish(tx, "terms_of_service", "en", "current");
      },
      (tx) => inForce(tx, "terms_of_service", "fr"),
    );
    expect(rows).toEqual([fr]);
    const [served] = rows;
    expect(served?.locale).toBe("fr");
    // 0109: the published text, whose SHA-256 over UTF-8 is content_hash (what apps/api checks)
    expect(served?.content).toBe(textOf("tm10-ec62-fr-current"));
    expect(
      createHash("sha256")
        .update(served?.content ?? "", "utf8")
        .digest()
        .equals(served?.content_hash ?? Buffer.alloc(0)),
    ).toBe(true);
  });

  it("serves a version whose effective_from is the current instant", async () => {
    let fr: Version | undefined;
    const rows = await scenario(
      async (tx) => {
        await withdrawAll(tx, "cookie_policy");
        fr = await publish(tx, "cookie_policy", "fr", "now");
      },
      (tx) => inForce(tx, "cookie_policy", "fr"),
    );
    expect(rows).toEqual([fr]);
  });

  it("falls back to English when the language has no version, locale = en (RG25)", async () => {
    let en: Version | undefined;
    const rows = await scenario(
      async (tx) => {
        await withdrawAll(tx, "privacy_policy");
        en = await publish(tx, "privacy_policy", "en", "current");
      },
      (tx) => inForce(tx, "privacy_policy", "fr"),
    );
    expect(rows).toEqual([en]);
    expect(rows[0]?.locale).toBe("en");
  });

  it("falls back to English for any other well-formed language", async () => {
    let en: Version | undefined;
    const rows = await scenario(
      async (tx) => {
        await withdrawAll(tx, "terms_of_service");
        await publish(tx, "terms_of_service", "fr", "current");
        en = await publish(tx, "terms_of_service", "en", "current");
      },
      (tx) => inForce(tx, "terms_of_service", "de"),
    );
    expect(rows).toEqual([en]);
  });

  it("returns no row when nothing is published, in the language nor in English", async () => {
    const rows = await scenario(
      (tx) => withdrawAll(tx, "cookie_policy"),
      async (tx) => [
        ...(await inForce(tx, "cookie_policy", "fr")),
        ...(await inForce(tx, "cookie_policy", "en")),
      ],
    );
    expect(rows).toEqual([]);
  });

  it("does not fall back from English to another language", async () => {
    const rows = await scenario(
      async (tx) => {
        await withdrawAll(tx, "terms_of_service");
        await publish(tx, "terms_of_service", "fr", "current");
      },
      (tx) => inForce(tx, "terms_of_service", "en"),
    );
    expect(rows).toEqual([]);
  });

  it("ignores a version published for later (effective_from > now())", async () => {
    let en: Version | undefined;
    const rows = await scenario(
      async (tx) => {
        await withdrawAll(tx, "terms_of_service");
        await publish(tx, "terms_of_service", "fr", "future");
        en = await publish(tx, "terms_of_service", "en", "current");
      },
      async (tx) => ({
        fr: await inForce(tx, "terms_of_service", "fr"),
        en: await inForce(tx, "terms_of_service", "en"),
      }),
    );
    // the French version of tomorrow is not served: English is
    expect(rows.fr).toEqual([en]);
    expect(rows.en).toEqual([en]);
  });

  it("returns no row when the only versions start later", async () => {
    const rows = await scenario(
      async (tx) => {
        await withdrawAll(tx, "privacy_policy");
        await publish(tx, "privacy_policy", "fr", "future");
        await publish(tx, "privacy_policy", "en", "future");
      },
      (tx) => inForce(tx, "privacy_policy", "fr"),
    );
    expect(rows).toEqual([]);
  });

  it("ignores a closed version (effective_to set)", async () => {
    let en: Version | undefined;
    const rows = await scenario(
      async (tx) => {
        await withdrawAll(tx, "cookie_policy");
        await publish(tx, "cookie_policy", "fr", "closed");
        en = await publish(tx, "cookie_policy", "en", "current");
      },
      (tx) => inForce(tx, "cookie_policy", "fr"),
    );
    expect(rows).toEqual([en]);
  });

  it("returns no row when every version is closed", async () => {
    const rows = await scenario(
      async (tx) => {
        await withdrawAll(tx, "cookie_policy");
        await publish(tx, "cookie_policy", "fr", "closed");
        await publish(tx, "cookie_policy", "en", "closed");
      },
      (tx) => inForce(tx, "cookie_policy", "fr"),
    );
    expect(rows).toEqual([]);
  });

  it("ignores an inherited version without text and falls back to English (EC-62 (B))", async () => {
    let en: Version | undefined;
    const rows = await scenario(
      async (tx) => {
        await withdrawAll(tx, "terms_of_service");
        await publishInherited(tx, "terms_of_service", "fr");
        en = await publish(tx, "terms_of_service", "en", "current");
      },
      (tx) => inForce(tx, "terms_of_service", "fr"),
    );
    expect(rows).toEqual([en]);
    expect(rows[0]?.locale).toBe("en");
  });

  it("returns no row when the versions in force have no text, in the language nor in English", async () => {
    const rows = await scenario(
      async (tx) => {
        await withdrawAll(tx, "privacy_policy");
        await publishInherited(tx, "privacy_policy", "fr");
        await publishInherited(tx, "privacy_policy", "en");
      },
      async (tx) => [
        ...(await inForce(tx, "privacy_policy", "fr")),
        ...(await inForce(tx, "privacy_policy", "en")),
      ],
    );
    expect(rows).toEqual([]);
  });

  it("serves only the requested document", async () => {
    const rows = await scenario(
      async (tx) => {
        await withdrawAll(tx, "terms_of_service");
        await withdrawAll(tx, "cookie_policy");
        await publish(tx, "cookie_policy", "fr", "current");
        await publish(tx, "cookie_policy", "en", "current");
      },
      (tx) => inForce(tx, "terms_of_service", "fr"),
    );
    expect(rows).toEqual([]);
  });
});

describe("0109: identity.terms_versions.content, the exact text of a version", () => {
  /** As the migration role (the publication script), cookie policy withdrawn, rolled back. */
  function asPublisher<T>(
    fn: (tx: postgres.TransactionSql) => Promise<T>,
  ): Promise<T> {
    return inRolledBackTransaction(migration, async (tx) => {
      await withdrawAll(tx, "cookie_policy");
      return fn(tx);
    });
  }

  function insertVersion(content: string | null, period: Period = "current") {
    return asPublisher((tx) =>
      probe(
        tx,
        INSERT_VERSION,
        versionParameters("cookie_policy", "fr", period, content),
      ),
    );
  }

  it("refuses a text that does not match the hash", async () => {
    expect(await insertVersion("another text")).toEqual({
      outcome: "error",
      code: CHECK_VIOLATION,
    });
  });

  it("refuses an empty text", async () => {
    expect(await insertVersion("")).toEqual({
      outcome: "error",
      code: CHECK_VIOLATION,
    });
  });

  it.each([["current"], ["now"], ["future"]] as const)(
    "refuses a new version without text (%s)",
    async (period) => {
      expect(await insertVersion(null, period)).toEqual({
        outcome: "error",
        code: CHECK_VIOLATION,
      });
    },
  );

  it("accepts a closed version without text (history, never served)", async () => {
    expect(await insertVersion(null, "closed")).toEqual({
      outcome: "rows",
      count: 1,
    });
  });

  it("lets an inherited version without text be closed", async () => {
    expect(
      await asPublisher(async (tx) => {
        const inherited = await publishInherited(tx, "cookie_policy", "fr");
        return probe(
          tx,
          "update identity.terms_versions set effective_to = now() where id = $1",
          [inherited.id],
        );
      }),
    ).toEqual({ outcome: "rows", count: 1 });
  });

  it("fills the text of an inherited version once, then refuses any change", async () => {
    const label = "tm10-ec62-fr-current";
    const outcome = await asPublisher(async (tx) => {
      const inherited = await publishInherited(tx, "cookie_policy", "fr");
      const fill = (content: string | null) =>
        probe(
          tx,
          "update identity.terms_versions set content = $2 where id = $1",
          [inherited.id, content],
        );
      const result = {
        id: inherited.id,
        wrongText: await fill("another text"),
        first: await fill(textOf(label)),
        again: await fill(`${textOf(label)} `),
        emptied: await fill(null),
      };
      await becomeAuth(tx);
      return { ...result, served: await inForce(tx, "cookie_policy", "fr") };
    });
    expect(outcome.wrongText).toEqual({
      outcome: "error",
      code: CHECK_VIOLATION,
    });
    expect(outcome.first).toEqual({ outcome: "rows", count: 1 });
    expect(outcome.again).toEqual({
      outcome: "error",
      code: INSUFFICIENT_PRIVILEGE,
    });
    expect(outcome.emptied).toEqual({
      outcome: "error",
      code: INSUFFICIENT_PRIVILEGE,
    });
    // once filled, the inherited version is served, with its text
    expect(outcome.served.map((row) => [row.id, row.content])).toEqual([
      [outcome.id, textOf(label)],
    ]);
  });

  it("refuses to change the text of a version published with it", async () => {
    expect(
      await asPublisher(async (tx) => {
        const version = await publish(tx, "cookie_policy", "fr", "current");
        return probe(
          tx,
          "update identity.terms_versions set content = $2 where id = $1",
          [version.id, `${textOf(version.version_label)} `],
        );
      }),
    ).toEqual({ outcome: "error", code: INSUFFICIENT_PRIVILEGE });
  });
});

describe("EC-62: identity.terms_in_force() refuses what is not a public document", () => {
  it("refuses the supervision notice, even when one is in force (12 RG103)", async () => {
    expect(
      await scenario(
        async (tx) => {
          await withdrawAll(tx, "supervision_notice");
          await publish(tx, "supervision_notice", "fr", "current");
        },
        (tx) => probe(tx, IN_FORCE, ["supervision_notice", "fr"]),
      ),
    ).toEqual({ outcome: "error", code: INVALID_PARAMETER });
  });

  it("refuses a missing document", async () => {
    expect(await asAuth((tx) => probe(tx, IN_FORCE, [null, "fr"]))).toEqual({
      outcome: "error",
      code: INVALID_PARAMETER,
    });
  });

  it.each([["FR"], ["fra"], ["f"], [""], ["f1"], [" fr"], ["fr "], [null]])(
    "refuses the locale %j",
    async (locale) => {
      expect(
        await asAuth((tx) => probe(tx, IN_FORCE, ["terms_of_service", locale])),
      ).toEqual({ outcome: "error", code: INVALID_PARAMETER });
    },
  );
});

describe("EC-62: identity.terms_in_force() is reached by influx_auth only", () => {
  it("is executed by influx_auth, taken from influx_auth_login", async () => {
    // whatever the workstation published: the version in force with a text, French first
    const expected = await migration<{ id: string }[]>`
      select id::text from identity.terms_versions
       where document_kind = 'terms_of_service' and locale in ('fr', 'en')
         and effective_to is null and effective_from <= now() and content is not null
       order by locale = 'fr' desc
       limit 1`;
    const rows = await asAuth((tx) => inForce(tx, "terms_of_service", "fr"));
    expect(rows.map((row) => row.id)).toEqual(expected.map((row) => row.id));
  });

  it("leaves influx_auth without any direct read of identity.terms_versions", async () => {
    expect(
      await asAuth((tx) =>
        probe(tx, "select id from identity.terms_versions limit 1"),
      ),
    ).toEqual({ outcome: "error", code: INSUFFICIENT_PRIVILEGE });
    const [rights] = await migration<{ any: boolean }[]>`
      select pg_catalog.has_any_column_privilege('influx_auth', 'identity.terms_versions',
                                                 'SELECT, INSERT, UPDATE, REFERENCES')
          or pg_catalog.has_table_privilege('influx_auth', 'identity.terms_versions',
                                            'DELETE, TRUNCATE, TRIGGER') as any`;
    expect(rights?.any).toBe(false);
  });

  it.each(["advertiser", "creator", "agent", "admin"] as const)(
    "is not executable by %s",
    async (role) => {
      expect(
        await asMember(contextOf(role), (tx) =>
          probe(tx, IN_FORCE, ["terms_of_service", "fr"]),
        ),
      ).toEqual({ outcome: "error", code: INSUFFICIENT_PRIVILEGE });
    },
  );

  it("grants EXECUTE to influx_auth and its owner only, never PUBLIC", async () => {
    const rows = await migration<{ grantee: string }[]>`
      select case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end as grantee
        from pg_catalog.pg_proc p,
             pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
       where p.oid = ${FUNCTION}::regprocedure and a.privilege_type = 'EXECUTE'
       order by 1`;
    expect(rows.map((row) => row.grantee)).toEqual([
      "influx_auth",
      "influx_identity_definer",
    ]);
  });

  it("is executable by none of the Supabase roles (anon, authenticated, service_role)", async () => {
    const rows = await migration<{ role: string; can: boolean }[]>`
      select r as role, pg_catalog.has_function_privilege(r, ${FUNCTION}, 'EXECUTE') as can
        from unnest(array['anon', 'authenticated', 'service_role']) r
       order by 1`;
    expect(rows).toEqual([
      { role: "anon", can: false },
      { role: "authenticated", can: false },
      { role: "service_role", can: false },
    ]);
  });

  it("is SECURITY DEFINER, STABLE, owned by influx_identity_definer, empty search_path", async () => {
    const [definition] = await migration`
      select pg_catalog.pg_get_userbyid(proowner) as owner, prosecdef, provolatile, proconfig
        from pg_catalog.pg_proc where oid = ${FUNCTION}::regprocedure`;
    expect(definition).toEqual({
      owner: "influx_identity_definer",
      prosecdef: true,
      provolatile: "s",
      proconfig: ['search_path=""'],
    });
  });
});
