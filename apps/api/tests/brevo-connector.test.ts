// The Brevo connectors of the worker (J6, commit 4; src/domains/leads/connectors/brevo/) against
// the Brevo double of @influx/test-kit on the loopback (16 RG148: no test ever reaches Brevo):
// operations 1, 2, 6 and 7 of 16 §M1, the mapping of §M4 with the attributes of EC-11, the output
// check (RG137), RG142, the welcome e-mail once per account (05 RG76, RG86; 16 RG90), the error
// classes of §M5 and the scenarios 1 to 6 and 13 of RG148; 05 CA38 to CA41; J7 commit 4: the
// suppression of 05 RG93 (CA55) and the address change of RG58 (decision 5). The loop around the
// connectors (locks, schedule, outcome) is tested in leads-drain.
import {
  startBrevoDouble,
  type BrevoDouble,
} from "@influx/test-kit/brevo-double";
import { TOO_MANY_REQUESTS } from "@influx/test-kit/brevo-exchanges";
import { valuesFoundIn } from "@influx/test-kit/logs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type {
  CallDescription,
  CallResult,
  Connector,
} from "../src/domains/leads/connector.ts";
import {
  BREVO_CONTACT_ATTRIBUTES,
  checkContactOutput,
  checkEmailChangeOutput,
  checkRenderedTransactionalOutput,
  createBrevoConnectors,
  mapContact,
  type BrevoConnectorSettings,
  type BrevoSubject,
} from "../src/domains/leads/connectors/brevo/index.ts";
import type {
  AttemptState,
  ClaimedLine,
  OutboxDestination,
  SubjectAccount,
} from "../src/domains/leads/repository.ts";

const ACCOUNT = "4f6c2a51-93d7-4b8e-a1c0-7e2d9b3f5a68";
const EMAIL = "lena-k7q2@example.test";
const LEGAL_NAME = "Maison Verbeke-Lambrecht";
const CREATORS_LIST = 3;
const ADVERTISERS_LIST = 2;
const SUPPRESSION_LIST = 7;
const WELCOME_CREATOR_TEMPLATE = 12;
const WELCOME_ADVERTISER_TEMPLATE = 11;

const SETTINGS: Record<string, unknown> = {
  brevo_list_ids: { advertisers: ADVERTISERS_LIST, creators: CREATORS_LIST },
  brevo_template_ids: {
    "account.welcome_advertiser": WELCOME_ADVERTISER_TEMPLATE,
    "account.welcome_creator": WELCOME_CREATOR_TEMPLATE,
  },
};

let double: BrevoDouble;
let logLines: string[];
let reads: string[];

function logger() {
  const write = (level: string) => (object: object, message: string) => {
    logLines.push(`${level} ${message} ${JSON.stringify(object)}`);
  };
  return { info: write("info"), warn: write("warn"), error: write("error") };
}

function account(overrides: Partial<SubjectAccount> = {}): SubjectAccount {
  return {
    id: ACCOUNT,
    status: "active",
    role: "creator",
    declaredStatus: "individual",
    countryCode: "BE",
    preferredLanguage: "fr",
    emailVerified: true,
    marketingEmailConsent: true,
    commercialProspectionConsent: true,
    ...overrides,
  };
}

function state(
  overrides: Partial<SubjectAccount> = {},
  settings: Record<string, unknown> = SETTINGS,
): AttemptState {
  return { attempt: 1, account: account(overrides), settings };
}

function subject(overrides: Partial<BrevoSubject> = {}): BrevoSubject {
  return {
    email: EMAIL,
    signedUpAt: "2026-10-09T08:15:00.000Z",
    company: null,
    utmSource: "newsletter",
    utmMedium: null,
    utmCampaign: null,
    referrerDomain: null,
    heardFrom: "social_media",
    viaInvitation: false,
    consentAt: "2026-10-09T08:15:00.000Z",
    consentSource: "signup_form",
    welcomeSent: false,
    previousEmail: null,
    externalContactId: null,
    suppressed: false,
    signedInAt: null,
    browser: null,
    timeZone: "UTC",
    dataRequest: null,
    ...overrides,
  };
}

let nextLine = 1;

function line(
  destination: OutboxDestination,
  overrides: Partial<ClaimedLine> = {},
): ClaimedLine {
  const id = String(nextLine++);
  const event = `0a1b2c3d-0000-4000-8000-${id.padStart(12, "0")}`;
  return {
    id,
    eventId: event,
    eventType: "lead.created",
    destination,
    subjectKey: `account:${ACCOUNT}`,
    priority: 100,
    payload:
      destination === "brevo_transactional"
        ? {
            event_id: event,
            account_id: ACCOUNT,
            email_code: "account.welcome_creator",
          }
        : { event_id: event, account_id: ACCOUNT },
    idempotencyKey:
      destination === "brevo_transactional"
        ? `account.welcome:${ACCOUNT}`
        : `lead.created:${event}`,
    ...overrides,
  };
}

type Setup = {
  settings?: Partial<BrevoConnectorSettings>;
  subject?: BrevoSubject | null;
  mapContact?: typeof mapContact;
  timeoutMs?: number;
};

function connectors(setup: Setup = {}): {
  contact: Connector;
  transactional: Connector;
} {
  return createBrevoConnectors(
    {
      mode: "redirect",
      testRecipients: [EMAIL],
      apiKey: "local-double-key",
      baseUrl: double.baseUrl,
      senderTransactional: "no-reply@tx.influx.example",
      suppressionListId: SUPPRESSION_LIST,
      ...setup.settings,
    },
    {
      logger: logger(),
      readSubject: (claimed) => {
        reads.push(claimed.id);
        return Promise.resolve(
          setup.subject === undefined ? subject() : setup.subject,
        );
      },
      ...(setup.mapContact === undefined
        ? {}
        : { mapContact: setup.mapContact }),
      ...(setup.timeoutMs === undefined ? {} : { timeoutMs: setup.timeoutMs }),
    },
  );
}

type Prepared =
  | { kind: "skip"; reason: string }
  | { kind: "fail"; errorCode: string }
  | {
      kind: "mapped";
      description: CallDescription;
      recipientDomain: string;
      result: () => Promise<CallResult>;
    };

/** The connector's preparation, then, for a mapped line, the call (as the drain makes it). */
async function prepare(
  connector: Connector,
  claimed: ClaimedLine,
  attempt: AttemptState,
): Promise<Prepared> {
  const preparation = await connector.prepare(claimed, attempt);
  if (preparation.kind !== "mapped") {
    return preparation;
  }
  return {
    kind: "mapped",
    description: preparation.description,
    recipientDomain: preparation.recipientDomain,
    result: preparation.send,
  };
}

async function run(
  connector: Connector,
  claimed: ClaimedLine,
  attempt: AttemptState = state(),
): Promise<CallResult> {
  const prepared = await prepare(connector, claimed, attempt);
  if (prepared.kind !== "mapped") {
    throw new Error(`expected a mapped line, got ${prepared.kind}`);
  }
  return prepared.result();
}

beforeAll(async () => {
  double = await startBrevoDouble();
});

afterAll(async () => {
  await double.close();
});

beforeEach(() => {
  double.reset();
  logLines = [];
  reads = [];
});

describe("operation 1: create or update a contact (16 §M1, §M4; 05 CA38)", () => {
  it("CA38: a consenting creator becomes a contact of the creators list, with every attribute of the mapping", async () => {
    const { contact } = connectors();
    const result = await run(contact, line("brevo_contact"));
    expect(result).toEqual({ kind: "succeeded", providerContactId: "1" });
    const [request] = double.requests;
    expect(request?.method).toBe("POST");
    expect(request?.path).toBe("/v3/contacts");
    expect(request?.headers["api-key"]).toBe("local-double-key");
    const stored = double.contacts.get(EMAIL);
    expect(stored?.listIds).toEqual([CREATORS_LIST]);
    expect(stored?.emailBlacklisted).toBe(false);
    expect(stored?.attributes).toEqual({
      INFLUX_ACCOUNT_ID: ACCOUNT,
      PROFILE_TYPE: "creator",
      DECLARED_STATUS: "individual",
      LANGUAGE: "fr",
      COUNTRY: "BE",
      COMPANY: "",
      SIGNED_UP_AT: "2026-10-09T08:15:00.000Z",
      SIGNUP_SOURCE: "direct",
      FUNNEL_STAGE: "registered",
      PROFILE_COMPLETENESS: 0,
      MAIN_TOPIC: "",
      VERIFIED_LEVEL: "none",
      MARKETING_CONSENT: true,
      CONSENT_AT: "2026-10-09T08:15:00.000Z",
      CONSENT_SOURCE: "signup_form",
      LAST_MARKETING_SENT_AT: "",
      MARKETING_SENDS_30D: 0,
      UTM_SOURCE: "newsletter",
      UTM_MEDIUM: "",
      UTM_CAMPAIGN: "",
      REFERRER_DOMAIN: "",
      HEARD_FROM: "social_media",
    });
    expect(Object.keys(stored?.attributes ?? {}).sort()).toEqual(
      [...BREVO_CONTACT_ATTRIBUTES].sort(),
    );
  });

  it("an advertiser carries its company name, in the advertisers list", async () => {
    const { contact } = connectors({
      subject: subject({ company: LEGAL_NAME }),
    });
    await run(
      contact,
      line("brevo_contact"),
      state({ role: "advertiser", declaredStatus: "business" }),
    );
    const stored = double.contacts.get(EMAIL);
    expect(stored?.attributes.COMPANY).toBe(LEGAL_NAME);
    expect(stored?.attributes.PROFILE_TYPE).toBe("advertiser");
    expect(stored?.listIds).toEqual([ADVERTISERS_LIST]);
  });

  it("RG142: COMPANY is empty for a creator, whatever was read; an absent field is sent empty, never invented", async () => {
    const { contact } = connectors({
      subject: subject({
        company: LEGAL_NAME,
        utmSource: null,
        heardFrom: null,
        consentAt: null,
        consentSource: null,
      }),
    });
    await run(contact, line("brevo_contact"));
    const attributes = double.contacts.get(EMAIL)?.attributes;
    expect(attributes?.COMPANY).toBe("");
    expect(attributes?.UTM_SOURCE).toBe("");
    expect(attributes?.HEARD_FROM).toBe("");
    expect(attributes?.CONSENT_AT).toBe("");
    expect(attributes?.CONSENT_SOURCE).toBe("");
    expect(double.requests[0]?.raw).not.toContain(LEGAL_NAME);
  });

  it("RG120, RG122: SIGNUP_SOURCE is invitation for an account created through a member invitation", async () => {
    const { contact } = connectors({
      subject: subject({ viaInvitation: true }),
    });
    await run(contact, line("brevo_contact"));
    expect(double.contacts.get(EMAIL)?.attributes.SIGNUP_SOURCE).toBe(
      "invitation",
    );
  });

  it("LANGUAGE falls back to en for a language outside fr and en (16 §M4)", async () => {
    const { contact } = connectors();
    await run(
      contact,
      line("brevo_contact"),
      state({ preferredLanguage: "de" }),
    );
    expect(double.contacts.get(EMAIL)?.attributes.LANGUAGE).toBe("en");
  });

  it("describes the call by attribute names only, never a value (decision 3, D60)", async () => {
    const { contact } = connectors({
      subject: subject({ company: LEGAL_NAME }),
    });
    const prepared = await prepare(
      contact,
      line("brevo_contact"),
      state({ role: "advertiser", declaredStatus: "business" }),
    );
    expect(prepared.kind).toBe("mapped");
    if (prepared.kind !== "mapped") {
      return;
    }
    expect(prepared.description).toEqual({
      operation: "upsert_contact",
      templateCode: null,
      attributeNames: [...BREVO_CONTACT_ATTRIBUTES].sort(),
      rejectedAttributeNames: [],
    });
    expect(prepared.recipientDomain).toBe("example.test");
    expect(
      valuesFoundIn(JSON.stringify(prepared.description), [
        EMAIL,
        LEGAL_NAME,
        ACCOUNT,
      ]),
    ).toEqual([]);
  });

  it("no list configured for the role: skipped with a clear cause, never guessed (0103)", async () => {
    const { contact } = connectors();
    const prepared = await prepare(
      contact,
      line("brevo_contact"),
      state({}, { ...SETTINGS, brevo_list_ids: { creators: null } }),
    );
    expect(prepared).toEqual({ kind: "skip", reason: "list_not_configured" });
    expect(double.requests).toHaveLength(0);
  });

  it("an account gone or not active is skipped, nothing read, nothing called", async () => {
    const { contact } = connectors();
    expect(
      await prepare(contact, line("brevo_contact"), {
        attempt: 1,
        account: null,
        settings: SETTINGS,
      }),
    ).toEqual({ kind: "skip", reason: "account_absent" });
    expect(
      await prepare(
        contact,
        line("brevo_contact"),
        state({ status: "suspended" }),
      ),
    ).toEqual({ kind: "skip", reason: "account_not_active" });
    expect(reads).toHaveLength(0);
    expect(double.requests).toHaveLength(0);
  });
});

describe("RG137: the output check refuses, it never cleans", () => {
  it("a field outside the mapping is refused by name, and the call never leaves", async () => {
    const { contact } = connectors({
      mapContact: (...args) => {
        const body = mapContact(...args);
        return {
          ...body,
          attributes: { ...body.attributes, FIRSTNAME: "Lena" },
        };
      },
    });
    const prepared = await prepare(contact, line("brevo_contact"), state());
    expect(prepared.kind).toBe("mapped");
    if (prepared.kind !== "mapped") {
      return;
    }
    expect(prepared.description.rejectedAttributeNames).toEqual(["FIRSTNAME"]);
    // Defence in depth: the call itself refuses a refused body.
    expect(await prepared.result()).toEqual({
      kind: "failed",
      errorCode: "output_check_rejected",
    });
    expect(double.requests).toHaveLength(0);
  });

  it("checks the attribute names and the fields of the body, against closed lists", () => {
    expect(
      checkContactOutput({
        email: EMAIL,
        attributes: { LANGUAGE: "fr", SMS: "+32470000000", NOTE: "x" },
        listIds: [2],
        updateEnabled: true,
      }),
    ).toEqual(["NOTE", "SMS"]);
    expect(
      checkContactOutput({
        email: EMAIL,
        attributes: { LANGUAGE: "fr" },
        updateEnabled: true,
        ext_id: "x",
      }),
    ).toEqual(["ext_id"]);
    expect(
      checkContactOutput({
        email: EMAIL,
        attributes: { LANGUAGE: "fr" },
        updateEnabled: true,
      }),
    ).toEqual([]);
  });
});

describe("RG148 scenarios 1 and 2: consent read at consumption (05 RG37, RG80; CA39)", () => {
  it("scenario 1, CA39: no consent at sign-up, the line is skipped no_consent, no contact, no call", async () => {
    const { contact } = connectors();
    const prepared = await prepare(
      contact,
      line("brevo_contact"),
      state({ marketingEmailConsent: false }),
    );
    expect(prepared).toEqual({ kind: "skip", reason: "no_consent" });
    expect(double.requests).toHaveLength(0);
    expect(double.contacts.size).toBe(0);
  });

  it("scenario 2: consent withdrawn after the emission, the contact is unsubscribed and excluded, never re-subscribed", async () => {
    const { contact } = connectors();
    await run(contact, line("brevo_contact"));
    const result = await run(
      contact,
      line("brevo_contact", { eventType: "lead.updated", priority: 0 }),
      state({ marketingEmailConsent: false }),
    );
    expect(result).toEqual({ kind: "succeeded" });
    expect(
      double.requests.map((request) => `${request.method} ${request.path}`),
    ).toEqual([
      "POST /v3/contacts",
      `PUT /v3/contacts/${encodeURIComponent(EMAIL)}`,
      `POST /v3/contacts/lists/${SUPPRESSION_LIST}/contacts/add`,
    ]);
    expect(double.requests[1]?.body).toEqual({ emailBlacklisted: true });
    expect(double.contacts.get(EMAIL)?.emailBlacklisted).toBe(true);
    expect(double.lists.get(SUPPRESSION_LIST)?.has(EMAIL)).toBe(true);
  });

  it("an unsubscription replayed has no further effect (16 §M3)", async () => {
    const { contact } = connectors();
    await run(contact, line("brevo_contact"));
    const revoked = line("brevo_contact", { eventType: "lead.updated" });
    const withdrawn = state({ marketingEmailConsent: false });
    await run(contact, revoked, withdrawn);
    expect(await run(contact, revoked, withdrawn)).toEqual({
      kind: "succeeded",
    });
    expect(double.contacts.get(EMAIL)?.emailBlacklisted).toBe(true);
    expect(double.lists.get(SUPPRESSION_LIST)?.size).toBe(1);
  });

  it("no contact at Brevo: nothing to unsubscribe, nothing created", async () => {
    const { contact } = connectors();
    const result = await run(
      contact,
      line("brevo_contact", { eventType: "lead.updated" }),
      state({ marketingEmailConsent: false }),
    );
    expect(result).toEqual({ kind: "succeeded" });
    expect(double.contacts.size).toBe(0);
    expect(double.requests).toHaveLength(1);
  });
});

describe("RG148 scenarios 3 to 5: the error classes of 16 §M5", () => {
  it("scenario 3: 5xx, a transport failure or a time-out is transient: the schedule of RG79 applies", async () => {
    const { contact } = connectors({ timeoutMs: 200 });
    double.queue({ status: 503 });
    expect(await run(contact, line("brevo_contact"))).toEqual({
      kind: "retry",
      errorCode: "brevo.unavailable",
      errorMessage: "Brevo answered 503",
    });
    double.queue({ status: 0, destroy: true });
    expect(await run(contact, line("brevo_contact"))).toMatchObject({
      kind: "retry",
      errorCode: "brevo.unreachable",
    });
    double.queue({ status: 201, delayMs: 1_000 });
    expect(await run(contact, line("brevo_contact"))).toMatchObject({
      kind: "retry",
      errorCode: "brevo.unreachable",
    });
    expect(double.contacts.size).toBe(0);
  });

  it("scenario 4: a 429 pauses the category for the delay Brevo gives (16 RG139)", async () => {
    const { contact } = connectors();
    double.queue({
      status: TOO_MANY_REQUESTS.response.status,
      headers: TOO_MANY_REQUESTS.response.headers ?? {},
      body: TOO_MANY_REQUESTS.response.body,
    });
    expect(await run(contact, line("brevo_contact"))).toEqual({
      kind: "retry",
      errorCode: "brevo.rate_limited",
      errorMessage: "Brevo answered 429",
      retryAfterSeconds: 17,
      rateLimited: true,
    });
  });

  it("scenario 5: a refused key stops the destination for an hour, with an error line naming no key", async () => {
    const { contact } = connectors();
    double.queue({
      status: 401,
      body: { code: "unauthorized", message: "Key not found" },
    });
    expect(await run(contact, line("brevo_contact"))).toEqual({
      kind: "retry",
      errorCode: "brevo.unauthorized",
      errorMessage: "Brevo answered 401",
      retryAfterSeconds: 3_600,
      rateLimited: true,
    });
    expect(
      logLines.some((entry) =>
        entry.startsWith("error leads.brevo.unauthorized"),
      ),
    ).toBe(true);
    expect(
      valuesFoundIn(logLines.join("\n"), ["local-double-key", EMAIL]),
    ).toEqual([]);
  });

  it("a 400 is permanent: failed at once, Brevo's code in clear but never its message", async () => {
    const { contact } = connectors();
    double.queue({
      status: 400,
      body: { code: "invalid_parameter", message: `${EMAIL} is not valid` },
    });
    expect(await run(contact, line("brevo_contact"))).toEqual({
      kind: "failed",
      errorCode: "brevo.rejected",
      errorMessage: "Brevo answered 400 invalid_parameter",
    });
  });
});

describe("operation 6: the welcome e-mail (05 RG76, RG86; 16 RG89, RG90; CA40, CA41)", () => {
  it("CA40: leaves whatever the consent, in the account's language, with the template of its role", async () => {
    const { transactional } = connectors();
    const claimed = line("brevo_transactional");
    const result = await run(
      transactional,
      claimed,
      state({ marketingEmailConsent: false, preferredLanguage: "fr" }),
    );
    expect(result).toMatchObject({ kind: "succeeded", locale: "fr" });
    expect(result.kind === "succeeded" && result.providerMessageId).toMatch(
      /@double\.brevo\.test>$/,
    );
    expect(double.delivered).toHaveLength(1);
    const [message] = double.delivered;
    expect(message?.headers["idempotency-key"]).toBe(
      `account.welcome:${ACCOUNT}`,
    );
    expect(message?.body).toEqual({
      sender: { name: "INFLUX", email: "no-reply@tx.influx.example" },
      to: [{ email: EMAIL }],
      templateId: WELCOME_CREATOR_TEMPLATE,
      params: { LANGUAGE: "fr" },
      tags: ["account.welcome_creator"],
    });
  });

  it("the advertiser's welcome uses the advertiser's template", async () => {
    const { transactional } = connectors();
    await run(
      transactional,
      line("brevo_transactional", {
        payload: {
          account_id: ACCOUNT,
          email_code: "account.welcome_advertiser",
        },
      }),
      state({ role: "advertiser", preferredLanguage: "en" }),
    );
    expect(double.delivered[0]?.body.templateId).toBe(
      WELCOME_ADVERTISER_TEMPLATE,
    );
    expect(double.delivered[0]?.body.params).toEqual({ LANGUAGE: "en" });
  });

  it("describes the send by its template and parameter names only", async () => {
    const { transactional } = connectors();
    const prepared = await prepare(
      transactional,
      line("brevo_transactional"),
      state(),
    );
    expect(prepared.kind === "mapped" && prepared.description).toEqual({
      operation: "send_transactional",
      templateCode: "account.welcome_creator",
      attributeNames: ["LANGUAGE"],
      rejectedAttributeNames: [],
    });
  });

  it("CA41, scenario 6: a welcome already journaled is skipped already_sent, nothing called", async () => {
    const { transactional } = connectors({
      subject: subject({ welcomeSent: true }),
    });
    expect(
      await prepare(transactional, line("brevo_transactional"), state()),
    ).toEqual({ kind: "skip", reason: "already_sent" });
    expect(double.requests).toHaveLength(0);
  });

  it("scenario 6, second belt: a replay the journal missed carries the same Idempotency-Key, Brevo delivers once", async () => {
    const { transactional } = connectors();
    const claimed = line("brevo_transactional");
    const first = await run(transactional, claimed);
    const replay = await run(transactional, { ...claimed, id: "replayed" });
    expect(double.messages).toHaveLength(2);
    expect(double.delivered).toHaveLength(1);
    expect(replay).toEqual(first);
  });

  it("no template configured: skipped with a clear cause (0103); a code outside the welcomes fails", async () => {
    const { transactional } = connectors();
    expect(
      await prepare(
        transactional,
        line("brevo_transactional"),
        state({}, { ...SETTINGS, brevo_template_ids: {} }),
      ),
    ).toEqual({ kind: "skip", reason: "template_not_configured" });
    expect(
      await prepare(
        transactional,
        line("brevo_transactional", {
          payload: {
            account_id: ACCOUNT,
            email_code: "account.email_corrected",
          },
        }),
        state(),
      ),
    ).toEqual({ kind: "fail", errorCode: "template_not_supported" });
    expect(double.requests).toHaveLength(0);
  });
});

describe("CA41, scenario 6: a contact replayed is updated, never duplicated", () => {
  it("the same event twice: one contact, the second call an update", async () => {
    const { contact } = connectors();
    const claimed = line("brevo_contact");
    expect(await run(contact, claimed)).toEqual({
      kind: "succeeded",
      providerContactId: "1",
    });
    expect(await run(contact, claimed)).toEqual({ kind: "succeeded" });
    expect(double.contacts.size).toBe(1);
    expect(
      double.requests.every((request) => request.answeredStatus < 300),
    ).toBe(true);
  });
});

describe("RG148 scenario 13, 16 RG117: BREVO_MODE=redirect reaches no real recipient", () => {
  it("an address outside BREVO_TEST_RECIPIENTS is skipped_non_production on both destinations, nothing called", async () => {
    const { contact, transactional } = connectors({
      settings: { testRecipients: ["someone-else@example.test"] },
    });
    expect(await prepare(contact, line("brevo_contact"), state())).toEqual({
      kind: "skip",
      reason: "skipped_non_production",
    });
    expect(
      await prepare(transactional, line("brevo_transactional"), state()),
    ).toEqual({ kind: "skip", reason: "skipped_non_production" });
    expect(double.requests).toHaveLength(0);
  });

  it("the comparison ignores case; a listed address is reached", async () => {
    const { transactional } = connectors({
      settings: { testRecipients: [EMAIL.toUpperCase()] },
    });
    await run(transactional, line("brevo_transactional"));
    expect(double.delivered).toHaveLength(1);
  });

  it("the output check still fails a refused body before the redirect lock", async () => {
    const { contact } = connectors({
      settings: { testRecipients: [] },
      mapContact: (...args) => {
        const body = mapContact(...args);
        return { ...body, attributes: { ...body.attributes, PHONE: "x" } };
      },
    });
    const prepared = await prepare(contact, line("brevo_contact"), state());
    expect(
      prepared.kind === "mapped" && prepared.description.rejectedAttributeNames,
    ).toEqual(["PHONE"]);
  });
});

describe("02 §12.4 lock 1: the key of the worker", () => {
  it("BREVO_MODE=disabled, or no key: no credentials, the drain skips without a call", () => {
    expect(
      connectors({ settings: { mode: "disabled" } }).contact.hasCredentials,
    ).toBe(false);
    expect(
      connectors({ settings: { apiKey: null } }).transactional.hasCredentials,
    ).toBe(false);
    const { contact, transactional } = connectors();
    expect(contact.hasCredentials && transactional.hasCredentials).toBe(true);
    expect(contact.destination).toBe("brevo_contact");
    expect(transactional.destination).toBe("brevo_transactional");
  });
});

describe("J6T-3: a consent given again re-subscribes the contact (consent.granted only)", () => {
  it("lifts the blacklist of a withdrawal and puts the contact back in its list", async () => {
    const { contact } = connectors();
    await run(contact, line("brevo_contact"));
    await run(
      contact,
      line("brevo_contact", { eventType: "consent.revoked", priority: 0 }),
      state({ marketingEmailConsent: false }),
    );
    expect(double.contacts.get(EMAIL)?.emailBlacklisted).toBe(true);

    const result = await run(
      contact,
      line("brevo_contact", { eventType: "consent.granted" }),
      state({ marketingEmailConsent: true }),
    );
    expect(result).toMatchObject({ kind: "succeeded" });
    const upsert = double.requests.at(-1);
    expect(`${upsert?.method} ${upsert?.path}`).toBe("POST /v3/contacts");
    expect(upsert?.body).toMatchObject({
      emailBlacklisted: false,
      updateEnabled: true,
    });
    expect(double.contacts.get(EMAIL)?.emailBlacklisted).toBe(false);
  });

  it("never lifts it on another event, nor once the consent is withdrawn again, nor for a suppressed contact", async () => {
    const { contact } = connectors();
    await run(contact, line("brevo_contact", { eventType: "lead.updated" }));
    expect(double.requests.at(-1)?.body).not.toHaveProperty("emailBlacklisted");

    // withdrawn again between the emission and the consumption (RG37): operation 2
    const later = await prepare(
      contact,
      line("brevo_contact", { eventType: "consent.granted" }),
      state({ marketingEmailConsent: false }),
    );
    expect(later.kind === "mapped" && later.description.operation).toBe(
      "unsubscribe_contact",
    );

    const suppressed = await prepare(
      connectors({ subject: subject({ suppressed: true }) }).contact,
      line("brevo_contact", { eventType: "consent.granted" }),
      state({ marketingEmailConsent: true }),
    );
    expect(
      suppressed.kind === "mapped" && suppressed.description.operation,
    ).toBe("unsubscribe_contact");
  });

  it("refuses an operation 1 that would blacklist (RG137)", () => {
    expect(
      checkContactOutput({
        email: EMAIL,
        attributes: {},
        listIds: [1],
        updateEnabled: true,
        emailBlacklisted: true,
      }),
    ).toEqual(["emailBlacklisted"]);
  });
});

describe("05 RG93, CA55: a contact under suppression is never resynchronised by an ordinary replay", () => {
  it("a complaint recorded, the consent given again: the replay unsubscribes, never upserts", async () => {
    const { contact } = connectors({ subject: subject({ suppressed: true }) });
    const result = await run(
      contact,
      line("brevo_contact", { eventType: "lead.updated" }),
      state({ marketingEmailConsent: true }),
    );
    expect(result).toEqual({ kind: "succeeded" });
    expect(
      double.requests.map((request) => `${request.method} ${request.path}`),
    ).toEqual([`PUT /v3/contacts/${encodeURIComponent(EMAIL)}`]);
    expect(double.contacts.size).toBe(0);
  });

  it("a contact known at Brevo stays blacklisted and in the suppression list", async () => {
    await run(connectors().contact, line("brevo_contact"));
    const { contact } = connectors({ subject: subject({ suppressed: true }) });
    const prepared = await prepare(
      contact,
      line("brevo_contact", { eventType: "lead.updated" }),
      state(),
    );
    expect(prepared.kind === "mapped" && prepared.description.operation).toBe(
      "unsubscribe_contact",
    );
    if (prepared.kind === "mapped") {
      expect(await prepared.result()).toEqual({ kind: "succeeded" });
    }
    expect(double.contacts.get(EMAIL)?.emailBlacklisted).toBe(true);
    expect(double.lists.get(SUPPRESSION_LIST)?.has(EMAIL)).toBe(true);
  });
});

describe("05 RG58, J7 decision 5: email.changed updates the contact in place, never duplicates it", () => {
  const NEW_EMAIL = "lena-new-p3x8@example.test";

  function changed(): ClaimedLine {
    return line("brevo_contact", {
      eventType: "email.changed",
      payload: {
        event_id: "0a1b2c3d-0000-4000-8000-00000000e0e0",
        account_id: ACCOUNT,
        request_id: "5d0c7e1a-2b3f-4c6d-8e9f-0a1b2c3d4e5f",
      },
    });
  }

  function movedSubject(overrides: Partial<BrevoSubject> = {}): BrevoSubject {
    return subject({
      email: NEW_EMAIL,
      previousEmail: EMAIL,
      externalContactId: "1",
      ...overrides,
    });
  }

  function moving(overrides: Partial<BrevoSubject> = {}): Connector {
    return connectors({
      settings: { testRecipients: [EMAIL, NEW_EMAIL] },
      subject: movedSubject(overrides),
    }).contact;
  }

  it("by its Brevo id: one contact, at the new address, its attributes and lists kept", async () => {
    await run(connectors().contact, line("brevo_contact"));
    const prepared = await prepare(moving(), changed(), state());
    expect(prepared.kind === "mapped" && prepared.description).toEqual({
      operation: "change_contact_email",
      templateCode: null,
      attributeNames: ["EMAIL"],
      rejectedAttributeNames: [],
    });
    if (prepared.kind === "mapped") {
      expect(await prepared.result()).toEqual({ kind: "succeeded" });
    }
    const request = double.requests.at(-1);
    expect(`${request?.method} ${request?.path}`).toBe(
      "PUT /v3/contacts/1?identifierType=contact_id",
    );
    expect(request?.body).toEqual({ attributes: { EMAIL: NEW_EMAIL } });
    expect([...double.contacts.keys()]).toEqual([NEW_EMAIL]);
    expect(double.contacts.get(NEW_EMAIL)).toMatchObject({
      id: 1,
      listIds: [CREATORS_LIST],
      emailBlacklisted: false,
    });
    expect(double.contacts.get(NEW_EMAIL)?.attributes.INFLUX_ACCOUNT_ID).toBe(
      ACCOUNT,
    );
  });

  it("without a known id: by its old address (email_id)", async () => {
    await run(connectors().contact, line("brevo_contact"));
    const result = await run(
      moving({ externalContactId: null }),
      changed(),
      state(),
    );
    expect(result).toEqual({ kind: "succeeded" });
    expect(double.requests.at(-1)?.path).toBe(
      `/v3/contacts/${encodeURIComponent(EMAIL)}?identifierType=email_id`,
    );
    expect([...double.contacts.keys()]).toEqual([NEW_EMAIL]);
  });

  it("consent withdrawn: Brevo lifts the blacklist with the address, operations 2 and 7 follow", async () => {
    await run(connectors().contact, line("brevo_contact"));
    const result = await run(
      moving(),
      changed(),
      state({ marketingEmailConsent: false }),
    );
    expect(result).toEqual({ kind: "succeeded" });
    expect(
      double.requests
        .slice(1)
        .map((request) => `${request.method} ${request.path}`),
    ).toEqual([
      "PUT /v3/contacts/1?identifierType=contact_id",
      `PUT /v3/contacts/${encodeURIComponent(NEW_EMAIL)}`,
      `POST /v3/contacts/lists/${SUPPRESSION_LIST}/contacts/add`,
    ]);
    expect(double.contacts.get(NEW_EMAIL)?.emailBlacklisted).toBe(true);
    expect(double.lists.get(SUPPRESSION_LIST)?.has(NEW_EMAIL)).toBe(true);
  });

  it("a suppressed contact (RG93) is excluded again under its new address, whatever the consent", async () => {
    await run(connectors().contact, line("brevo_contact"));
    await run(moving({ suppressed: true }), changed(), state());
    expect(double.contacts.get(NEW_EMAIL)?.emailBlacklisted).toBe(true);
    expect(double.lists.get(SUPPRESSION_LIST)?.has(NEW_EMAIL)).toBe(true);
  });

  it("no contact at Brevo: nothing moved, nothing created", async () => {
    expect(await run(moving(), changed(), state())).toEqual({
      kind: "succeeded",
    });
    expect(double.contacts.size).toBe(0);
    expect(double.requests).toHaveLength(1);
  });

  it("the new address already held by another contact: failed, visible, nothing duplicated", async () => {
    await run(connectors().contact, line("brevo_contact"));
    await run(
      connectors({
        settings: { testRecipients: [EMAIL, NEW_EMAIL] },
        subject: subject({ email: NEW_EMAIL }),
      }).contact,
      line("brevo_contact"),
    );
    const result = await run(moving(), changed(), state());
    expect(result).toEqual({
      kind: "failed",
      errorCode: "brevo.rejected",
      errorMessage: "Brevo answered 400 duplicate_parameter",
    });
    expect(double.contacts.size).toBe(2);
  });

  it("no completed request behind the line: failed email_change_not_found, no call", async () => {
    const prepared = await prepare(
      moving({ previousEmail: null }),
      changed(),
      state(),
    );
    expect(prepared).toEqual({
      kind: "fail",
      errorCode: "email_change_not_found",
    });
    expect(double.requests).toHaveLength(0);
  });

  it("redirect: the old address outside BREVO_TEST_RECIPIENTS is skipped_non_production", async () => {
    const { contact } = connectors({
      settings: { testRecipients: [NEW_EMAIL] },
      subject: movedSubject(),
    });
    expect(await prepare(contact, changed(), state())).toEqual({
      kind: "skip",
      reason: "skipped_non_production",
    });
  });

  it("RG137: only the new address may leave", () => {
    expect(
      checkEmailChangeOutput({ attributes: { EMAIL: NEW_EMAIL } }),
    ).toEqual([]);
    expect(
      checkEmailChangeOutput({
        attributes: { EMAIL: NEW_EMAIL, FIRSTNAME: "x" },
        emailBlacklisted: false,
      }),
    ).toEqual(["FIRSTNAME", "emailBlacklisted"]);
  });
});

describe("05 RG58, J7 commit 7: the notice of a changed address, to both addresses (16 §H)", () => {
  const NEW_EMAIL = "lena-new-p3x8@example.test";
  const NOTICE_TEMPLATE = 21;
  const REQUEST = "5d0c7e1a-2b3f-4c6d-8e9f-0a1b2c3d4e5f";
  const NOTICE_SETTINGS = {
    ...SETTINGS,
    brevo_template_ids: {
      ...(SETTINGS.brevo_template_ids as Record<string, number>),
      "auth.email_changed_notice": NOTICE_TEMPLATE,
    },
  };

  function notice(recipient: unknown): ClaimedLine {
    return line("brevo_transactional", {
      eventType: "email.changed",
      priority: 0,
      payload: {
        event_id: "0a1b2c3d-0000-4000-8000-00000000e1e1",
        account_id: ACCOUNT,
        request_id: REQUEST,
        email_code: "auth.email_changed_notice",
        recipient,
      },
      idempotencyKey: `auth.email_changed_notice:${REQUEST}:${String(recipient)}`,
    });
  }

  function noticing(overrides: Partial<BrevoSubject> = {}): Connector {
    return connectors({
      settings: { testRecipients: [EMAIL, NEW_EMAIL] },
      subject: subject({
        email: NEW_EMAIL,
        previousEmail: EMAIL,
        ...overrides,
      }),
    }).transactional;
  }

  it("previous: to the old address of the completed request, read by the subject read, never carried by the line", async () => {
    const prepared = await prepare(
      noticing(),
      notice("previous"),
      state({}, NOTICE_SETTINGS),
    );
    expect(prepared.kind === "mapped" && prepared.description).toEqual({
      operation: "send_transactional",
      templateCode: "auth.email_changed_notice",
      attributeNames: ["LANGUAGE"],
      rejectedAttributeNames: [],
    });
    expect(prepared.kind === "mapped" && prepared.recipientDomain).toBe(
      "example.test",
    );
    if (prepared.kind !== "mapped") {
      throw new Error("expected a mapped notice");
    }
    expect((await prepared.result()).kind).toBe("succeeded");
    expect(double.messages).toHaveLength(1);
    const [message] = double.messages;
    expect(message?.body.to).toEqual([{ email: EMAIL }]);
    expect(message?.body.templateId).toBe(NOTICE_TEMPLATE);
    expect(message?.body.params).toEqual({ LANGUAGE: "fr" });
    expect(message?.body.tags).toEqual(["auth.email_changed_notice"]);
    expect(message?.headers["idempotency-key"]).toBe(
      `auth.email_changed_notice:${REQUEST}:previous`,
    );
    // RG74: the queue line holds no address
    expect(JSON.stringify(notice("previous").payload)).not.toContain("@");
  });

  it("current: to the account's address; whatever the consent (a transactional e-mail, RG35)", async () => {
    await run(
      noticing(),
      notice("current"),
      state(
        { marketingEmailConsent: false, commercialProspectionConsent: false },
        NOTICE_SETTINGS,
      ),
    );
    expect(double.messages.map((message) => message.body.to)).toEqual([
      [{ email: NEW_EMAIL }],
    ]);
  });

  it("is not once per account: a second change notifies again (welcomeSent says nothing of it)", async () => {
    const prepared = await prepare(
      noticing({ welcomeSent: true }),
      notice("current"),
      state({}, NOTICE_SETTINGS),
    );
    expect(prepared.kind).toBe("mapped");
  });

  it("no completed request behind a previous notice: failed email_change_not_found, no call", async () => {
    expect(
      await prepare(
        noticing({ previousEmail: null }),
        notice("previous"),
        state({}, NOTICE_SETTINGS),
      ),
    ).toEqual({ kind: "fail", errorCode: "email_change_not_found" });
    expect(double.requests).toHaveLength(0);
  });

  it("a side outside previous and current fails, visible, never guessed", async () => {
    for (const side of ["old", undefined, "lena@example.test"]) {
      expect(
        await prepare(noticing(), notice(side), state({}, NOTICE_SETTINGS)),
      ).toEqual({ kind: "fail", errorCode: "notice_recipient_unknown" });
    }
    expect(double.requests).toHaveLength(0);
  });

  it("EC-8: no template configured (NULL, 0118), skipped template_not_configured, never guessed", async () => {
    expect(
      await prepare(
        noticing(),
        notice("previous"),
        state(
          {},
          {
            ...SETTINGS,
            brevo_template_ids: {
              ...(SETTINGS.brevo_template_ids as Record<string, number>),
              "auth.email_changed_notice": null,
            },
          },
        ),
      ),
    ).toEqual({ kind: "skip", reason: "template_not_configured" });
    expect(reads).toHaveLength(0);
  });

  it("redirect: the old address outside BREVO_TEST_RECIPIENTS is skipped_non_production", async () => {
    const { transactional } = connectors({
      settings: { testRecipients: [NEW_EMAIL] },
      subject: subject({ email: NEW_EMAIL, previousEmail: EMAIL }),
    });
    expect(
      await prepare(
        transactional,
        notice("previous"),
        state({}, NOTICE_SETTINGS),
      ),
    ).toEqual({ kind: "skip", reason: "skipped_non_production" });
    expect(double.requests).toHaveLength(0);
  });
});

describe("05 RG141, RG142, J7 commit 8: auth.new_device, written by INFLUX without any link (16 RG157, RG158)", () => {
  const SESSION = "7e1f0a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b";
  const DAY_KEY = `auth.new_device:${ACCOUNT}:safari.ios:2026-10-14`;

  function newDevice(): ClaimedLine {
    return line("brevo_transactional", {
      eventType: "auth.new_device",
      payload: {
        event_id: "0a1b2c3d-0000-4000-8000-00000000d1d1",
        account_id: ACCOUNT,
        session_id: SESSION,
        email_code: "auth.new_device",
      },
      idempotencyKey: DAY_KEY,
    });
  }

  function signalling(overrides: Partial<BrevoSubject> = {}): Connector {
    return connectors({
      subject: subject({
        signedInAt: "2026-10-14T09:30:00.000Z",
        browser: "safari.ios",
        ...overrides,
      }),
    }).transactional;
  }

  it("sends the text of RG157 in the account's language, no template, no parameter, under the day's key", async () => {
    // no template id is ever configured for this code: the text is INFLUX's (16 RG67)
    const prepared = await prepare(signalling(), newDevice(), state({}, {}));
    expect(prepared.kind === "mapped" && prepared.description).toEqual({
      operation: "send_transactional",
      templateCode: "auth.new_device",
      attributeNames: [],
      rejectedAttributeNames: [],
    });
    if (prepared.kind !== "mapped") {
      throw new Error("expected a mapped e-mail");
    }
    expect(await prepared.result()).toMatchObject({
      kind: "succeeded",
      locale: "fr",
    });
    const [message] = double.messages;
    expect(Object.keys(message?.body ?? {}).sort()).toEqual([
      "htmlContent",
      "sender",
      "subject",
      "tags",
      "textContent",
      "to",
    ]);
    expect(message?.body.to).toEqual([{ email: EMAIL }]);
    expect(message?.body.subject).toBe(
      "Nouvelle connexion à votre compte INFLUX",
    );
    expect(message?.body.textContent).toContain(
      "le 14 octobre 2026 à 09:30 (UTC) depuis Safari sur iOS.",
    );
    expect(message?.body.tags).toEqual(["auth.new_device"]);
    expect(message?.headers["idempotency-key"]).toBe(DAY_KEY);
    // whatever the consent: a security e-mail (RG35)
    double.reset();
    await run(
      signalling(),
      newDevice(),
      state({ marketingEmailConsent: false, preferredLanguage: "en" }, {}),
    );
    expect(double.messages[0]?.body.subject).toBe(
      "New sign-in to your INFLUX account",
    );
  });

  it("RG157: the instant in the account's time zone, its name written", async () => {
    await run(
      signalling({ timeZone: "America/Toronto" }),
      newDevice(),
      state({ preferredLanguage: "en" }, {}),
    );
    // \s: the space before AM is the one of the ICU data of the runtime
    expect(double.messages[0]?.body.textContent).toMatch(
      /on October 14, 2026 at 5:30\sAM \(EDT\) from Safari on iOS\./,
    );
  });

  it("a summary outside the closed list is never quoted: 'un navigateur non identifié'", async () => {
    await run(
      signalling({ browser: "netscape.beos" }),
      newDevice(),
      state({}, {}),
    );
    const text = double.messages[0]?.body.textContent ?? "";
    expect(text).toContain("depuis un navigateur non identifié.");
    expect(text).not.toContain("netscape");
  });

  it("no session of the account behind the line: failed session_not_found, no call", async () => {
    expect(
      await prepare(
        signalling({ signedInAt: null, browser: null }),
        newDevice(),
        state(),
      ),
    ).toEqual({ kind: "fail", errorCode: "session_not_found" });
    expect(double.requests).toHaveLength(0);
  });

  it("redirect: an address outside BREVO_TEST_RECIPIENTS is skipped_non_production", async () => {
    const { transactional } = connectors({
      settings: { testRecipients: [] },
      subject: subject({
        signedInAt: "2026-10-14T09:30:00.000Z",
        browser: "safari.ios",
      }),
    });
    expect(await prepare(transactional, newDevice(), state())).toEqual({
      kind: "skip",
      reason: "skipped_non_production",
    });
    expect(double.requests).toHaveLength(0);
  });

  it("RG158 and RG137: the output check refuses a template, a parameter, and anything like a link", () => {
    const body = {
      sender: { name: "INFLUX", email: "no-reply@tx.influx.example" },
      to: [{ email: EMAIL }],
      subject: "s",
      htmlContent: "<p>h</p>",
      textContent: "t",
      tags: ["auth.new_device"],
    };
    expect(checkRenderedTransactionalOutput(body)).toEqual([]);
    expect(
      checkRenderedTransactionalOutput({ ...body, templateId: 1, params: {} }),
    ).toEqual(["params", "templateId"]);
    for (const link of [
      '<a href="x">y</a>',
      "https://influx.example",
      "voir influx.example://x",
      "mailto:a",
      "www.influx.example",
      "<A >",
      // RG160 point 5: neither an address nor a domain name
      "écrivez à support@x",
      "rendez-vous sur influx.example",
      "INFLUX.COM",
    ]) {
      expect(
        checkRenderedTransactionalOutput({ ...body, htmlContent: link }),
        link,
      ).toEqual(["htmlContent"]);
      expect(
        checkRenderedTransactionalOutput({ ...body, textContent: link }),
        link,
      ).toEqual(["textContent"]);
    }
  });
});

describe("16 RG160, CA117: privacy.request_received, written by INFLUX without any link (architecte, 2026-10-14)", () => {
  const REQUEST = "3c2b1a0f-9e8d-4c7b-8a69-584736251403";
  const ERASURE = {
    type: "erasure",
    receivedAt: "2026-10-14T21:00:00.000Z",
    dueAt: "2026-11-13T21:00:00.000Z",
    closed: false,
  };

  function acknowledgement(): ClaimedLine {
    return line("brevo_transactional", {
      eventType: "privacy.request_received",
      payload: {
        event_id: "0a1b2c3d-0000-4000-8000-00000000a1a1",
        account_id: ACCOUNT,
        request_id: REQUEST,
        email_code: "privacy.request_received",
      },
      idempotencyKey: `privacy.request_received:${REQUEST}`,
    });
  }

  function acknowledging(overrides: Partial<BrevoSubject> = {}): Connector {
    return connectors({
      subject: subject({ dataRequest: ERASURE, ...overrides }),
    }).transactional;
  }

  it("sends the text of RG160 in the account's language and time zone, no template, whatever the consent", async () => {
    // no template id is configured for this code any more (0128): the text is INFLUX's (16 RG67)
    const prepared = await prepare(
      acknowledging({ timeZone: "America/Toronto", welcomeSent: true }),
      acknowledgement(),
      state({ marketingEmailConsent: false, preferredLanguage: "en" }, {}),
    );
    expect(prepared.kind === "mapped" && prepared.description).toEqual({
      operation: "send_transactional",
      templateCode: "privacy.request_received",
      attributeNames: [],
      rejectedAttributeNames: [],
    });
    if (prepared.kind !== "mapped") {
      throw new Error("expected a mapped e-mail");
    }
    expect(await prepared.result()).toMatchObject({
      kind: "succeeded",
      locale: "en",
    });
    const [message] = double.messages;
    expect(Object.keys(message?.body ?? {}).sort()).toEqual([
      "htmlContent",
      "sender",
      "subject",
      "tags",
      "textContent",
      "to",
    ]);
    expect(message?.body.to).toEqual([{ email: EMAIL }]);
    expect(message?.body.subject).toBe(
      "Your INFLUX account deletion request has been received",
    );
    const text = String(message?.body.textContent);
    expect(text).toMatch(
      /submitted from your account on October 14, 2026 at 5:00\sPM \(EDT\)\./,
    );
    expect(text).toContain("by November 13, 2026 at the latest.");
    expect(message?.body.tags).toEqual(["privacy.request_received"]);
    expect(message?.headers["idempotency-key"]).toBe(
      `privacy.request_received:${REQUEST}`,
    );
  });

  it("no request of the account behind the line: failed request_not_found, no call", async () => {
    expect(
      await prepare(
        acknowledging({ dataRequest: null }),
        acknowledgement(),
        state(),
      ),
    ).toEqual({ kind: "fail", errorCode: "request_not_found" });
    expect(double.requests).toHaveLength(0);
  });

  it("RG160: another type fails unsupported_request_type; a request closed since is skipped request_closed", async () => {
    expect(
      await prepare(
        acknowledging({ dataRequest: { ...ERASURE, type: "rectification" } }),
        acknowledgement(),
        state(),
      ),
    ).toEqual({ kind: "fail", errorCode: "unsupported_request_type" });
    expect(
      await prepare(
        acknowledging({ dataRequest: { ...ERASURE, closed: true } }),
        acknowledgement(),
        state(),
      ),
    ).toEqual({ kind: "skip", reason: "request_closed" });
    expect(double.requests).toHaveLength(0);
  });

  it("a template id left in the settings is ignored: never a template for this code", async () => {
    await run(
      acknowledging(),
      acknowledgement(),
      state({}, { brevo_template_ids: { "privacy.request_received": 31 } }),
    );
    expect(double.messages[0]?.body).not.toHaveProperty("templateId");
  });

  it("redirect: an address outside BREVO_TEST_RECIPIENTS is skipped_non_production", async () => {
    const { transactional } = connectors({
      settings: { testRecipients: [] },
      subject: subject({ dataRequest: ERASURE }),
    });
    expect(await prepare(transactional, acknowledgement(), state())).toEqual({
      kind: "skip",
      reason: "skipped_non_production",
    });
    expect(double.requests).toHaveLength(0);
  });
});
