// TM1 (J7, commit 2bis) — the consent changed by a member after the sign-up, the database half
// (migration 0119; EC-10, CA47; 05 RG34, RG73, RG78, RG92): identity.set_marketing_consent() is
// the only door, and writes the consent event and its queue facts in the same transaction
// (consent.revoked priority 0, consent.granted priority 100, to Brevo and Apollo). The route
// PUT /v1/me/consent is commit 6. Every case is rolled back (member through influx_app).
import {
  inRolledBackTransaction,
  probe,
  takeRole,
  type DataSet,
  type UserContext,
} from "@influx/test-kit/db";
import type postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import {
  actAsMember,
  localSuperuser,
  loginRole,
  testDataSet,
} from "./support.ts";

const INSUFFICIENT_PRIVILEGE = "42501";
const INVALID_PARAMETER = "22023";

const SET =
  "select identity.set_marketing_consent($1::identity.consent_purpose, $2, $3::text::jsonb)";

let dataSet: DataSet;

beforeAll(async () => {
  dataSet = await testDataSet();
});

function creatorA(): UserContext {
  return {
    accountId: dataSet.accounts.creator.a.id,
    role: "creator",
    aal: "aal1",
  };
}

/** As creator A (influx_app), in a rolled-back transaction. */
function asCreator<T>(
  fn: (tx: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  return inRolledBackTransaction(loginRole("influx_app"), async (tx) => {
    await takeRole(tx, "influx_creator", creatorA());
    return fn(tx);
  });
}

async function setConsent(
  tx: postgres.TransactionSql,
  purpose: string,
  granted: boolean,
  evidence: unknown = { form: "account_settings_v1" },
): Promise<boolean | undefined> {
  const [row] = await tx.unsafe<{ changed: boolean }[]>(`${SET} as changed`, [
    purpose,
    granted,
    JSON.stringify(evidence),
  ]);
  return row?.changed;
}

/** The consent events written in this transaction, read by the member (own history). */
async function written(tx: postgres.TransactionSql) {
  const consents = await tx<
    { purpose: string; granted: boolean; source: string }[]
  >`
    select purpose::text, granted, source::text from identity.consent_events
     where account_id = (select influx.current_account_id()) and occurred_at = now()
     order by purpose`;
  return consents;
}

describe("identity.set_marketing_consent() (EC-10, CA47)", () => {
  it("withdraws a granted consent in one gesture: the event (account_settings) and consent.revoked P0 to Brevo and Apollo", async () => {
    const result = await asCreator(async (tx) => ({
      changed: await setConsent(tx, "marketing_email", false),
      events: await written(tx),
    }));
    expect(result).toEqual({
      changed: true,
      events: [
        {
          purpose: "marketing_email",
          granted: false,
          source: "account_settings",
        },
      ],
    });
  });

  it("queues consent.revoked priority 0, then consent.granted priority 100, ids and purpose only", async () => {
    // The member cannot read the queue: the superuser reads it back in the same rolled-back
    // transaction (actAsMember, support.ts).
    const account = dataSet.accounts.creator.b.id;
    const context: UserContext = {
      accountId: account,
      role: "creator",
      aal: "aal1",
    };
    const lines = await inRolledBackTransaction(
      localSuperuser(),
      async (tx) => {
        await actAsMember(tx, "influx_creator", context, async () => {
          await setConsent(tx, "marketing_email", false);
          await setConsent(tx, "marketing_email", true);
        });
        return tx<
          {
            event_type: string;
            destination: string;
            priority: number;
            payload: Record<string, unknown>;
          }[]
        >`
        select event_type, destination::text, priority, payload from leads.outbox_events
         where subject_key = ${`account:${account}`}
           and event_type in ('consent.revoked', 'consent.granted')
         order by event_type desc, destination`;
      },
    );
    expect(
      lines.map((line) => [line.event_type, line.destination, line.priority]),
    ).toEqual([
      ["consent.revoked", "apollo_contact", 0],
      ["consent.revoked", "brevo_contact", 0],
      ["consent.granted", "apollo_contact", 100],
      ["consent.granted", "brevo_contact", 100],
    ]);
    for (const line of lines) {
      expect(Object.keys(line.payload).sort()).toEqual([
        "account_id",
        "event_id",
        "purpose",
      ]);
      expect(line.payload).toMatchObject({
        account_id: account,
        purpose: "marketing_email",
      });
    }
  });

  it("changes nothing when the value in force is already the requested one (no event, no line)", async () => {
    const result = await asCreator(async (tx) => ({
      // the data set grants marketing_email at the sign-up
      granted: await setConsent(tx, "marketing_email", true),
      // no event at all for commercial_prospection: no consent, nothing to withdraw
      absent: await setConsent(tx, "commercial_prospection", false),
      events: await written(tx),
    }));
    expect(result).toEqual({ granted: false, absent: false, events: [] });
  });

  it.each([
    ["an address in the evidence", { note: "me@example.test" }],
    ["an evidence that is not an object", ["form"]],
  ])("refuses %s (22023)", async (_label, evidence) => {
    const result = await asCreator((tx) =>
      probe(tx, SET, ["marketing_email", false, JSON.stringify(evidence)]),
    );
    expect(result).toEqual({ outcome: "error", code: INVALID_PARAMETER });
  });

  it("leaves no direct INSERT to the member (RG73: the function is the only door)", async () => {
    const result = await asCreator((tx) =>
      probe(
        tx,
        "insert into identity.consent_events (account_id, purpose, granted, source) " +
          "values ((select influx.current_account_id()), 'marketing_email', false, 'account_settings')",
      ),
    );
    expect(result).toEqual({ outcome: "error", code: INSUFFICIENT_PRIVILEGE });
  });

  it.each([
    ["influx_app", "influx_agent"],
    ["influx_auth_login", "influx_auth"],
    ["influx_worker_login", "influx_worker"],
  ] as const)("is refused to %s as %s (42501)", async (login, role) => {
    const result = await inRolledBackTransaction(
      loginRole(login),
      async (tx) => {
        if (role === "influx_agent") {
          await takeRole(tx, role, {
            accountId: dataSet.accounts.agent.a.id,
            role: "agent",
            aal: "aal2",
          });
        } else {
          await takeRole(tx, role);
        }
        return probe(tx, SET, ["marketing_email", false, "{}"]);
      },
    );
    expect(result).toEqual({ outcome: "error", code: INSUFFICIENT_PRIVILEGE });
  });
});
