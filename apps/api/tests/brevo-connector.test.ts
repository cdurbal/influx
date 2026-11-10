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
  WORKER_RENDERED_EMAILS,
  mapContact,
  type BrevoConnectorSettings,
  type BrevoSubject,
} from "../src/domains/leads/connectors/brevo/index.ts";
import type { ErasureNotificationSubject } from "../src/domains/privacy/erasure-notification-subject.ts";
import type {
  AttemptState,
  BrandProfileAttributes,
  BrevoBadgeEmail,
  BrevoErasureSubject,
  BrevoProfileDecision,
  BrevoVerificationEmail,
  ClaimedLine,
  OutboxDestination,
  SubjectAccount,
  VerifiedBadge,
} from "../src/domains/leads/repository.ts";

const ACCOUNT = "4f6c2a51-93d7-4b8e-a1c0-7e2d9b3f5a68";
const EMAIL = "lena-k7q2@example.test";
const LEGAL_NAME = "Maison Verbeke-Lambrecht";
const CREATORS_LIST = 3;
const ADVERTISERS_LIST = 2;
const SUPPRESSION_LIST = 7;

const SETTINGS: Record<string, unknown> = {
  brevo_list_ids: { advertisers: ADVERTISERS_LIST, creators: CREATORS_LIST },
  // D69: every queue e-mail is written by INFLUX, no Brevo template id is read
  brevo_template_ids: {},
};

let double: BrevoDouble;
let logLines: string[];
let reads: string[];
/** The reads of 0227, kept apart so that the order of `reads` stays the one of the older cases. */
let verificationReads: string[];
let badgeReads: string[];
let badgeEmailReads: string[];

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
    exportExpiresAt: null,
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
  erasureSubject?: BrevoErasureSubject | null;
  notificationSubject?: ErasureNotificationSubject | null;
  /** The decision read of a profile.decision line (0211); none by default. */
  decision?: BrevoProfileDecision | null;
  /** The live brand profile read of a contact line (0212); none by default. */
  brandProfile?: BrandProfileAttributes | null;
  /** The facts of a verification e-mail line (0227); none by default. */
  verification?: BrevoVerificationEmail | null;
  /** The facts of an e-mail of the life of the badge (0236); none by default. */
  badgeEmail?: BrevoBadgeEmail | null;
  /** The badge level of a contact line (0227); none by default. */
  badge?: VerifiedBadge | null;
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
      readErasureSubject: (claimed) => {
        reads.push(claimed.id);
        return Promise.resolve(
          setup.erasureSubject === undefined
            ? { externalContactId: null, email: EMAIL }
            : setup.erasureSubject,
        );
      },
      readErasureNotificationSubject: () => {
        reads.push("notification");
        return Promise.resolve(
          setup.notificationSubject === undefined
            ? {
                email: EMAIL,
                preferredLanguage: "fr",
                timeZone: "UTC",
                erasedAt: "2026-10-28T09:30:00.000Z",
              }
            : setup.notificationSubject,
        );
      },
      readProfileDecision: (claimed) => {
        reads.push(`decision:${claimed.id}`);
        return Promise.resolve(
          setup.decision === undefined ? null : setup.decision,
        );
      },
      readBrandProfile: (claimed) => {
        reads.push(`brand:${claimed.id}`);
        return Promise.resolve(
          setup.brandProfile === undefined ? null : setup.brandProfile,
        );
      },
      readVerificationEmail: (claimed) => {
        verificationReads.push(claimed.id);
        return Promise.resolve(
          setup.verification === undefined ? null : setup.verification,
        );
      },
      readBadgeEmail: (claimed) => {
        badgeEmailReads.push(claimed.id);
        return Promise.resolve(
          setup.badgeEmail === undefined ? null : setup.badgeEmail,
        );
      },
      readVerifiedBadge: (claimed) => {
        badgeReads.push(claimed.id);
        return Promise.resolve(setup.badge === undefined ? null : setup.badge);
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
  verificationReads = [];
  badgeReads = [];
  badgeEmailReads = [];
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
      SECTOR: "",
      COMPANY_SIZE: "",
      TARGET_MARKETS: "",
      PROFILE_STATUS: "",
      VERIFIED_LEVEL: "none",
      VERIFIED_AT: "",
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
      missingSettings: [],
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

  it("05 RG164: no list for the role is named with the mapping, never guessed, and the call never leaves (RG160)", async () => {
    const { contact } = connectors();
    const prepared = await prepare(
      contact,
      line("brevo_contact"),
      state({}, { ...SETTINGS, brevo_list_ids: { creators: null } }),
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
      missingSettings: ["brevo_list_ids.creators"],
    });
    // the drain fails such a line before any call; the call refuses it again (defence in depth)
    expect(await prepared.result()).toEqual({
      kind: "failed",
      errorCode: "list_not_configured",
    });
    expect(double.requests).toHaveLength(0);
  });

  it("05 RG164: an advertiser without the advertisers list is named by its own path", async () => {
    const { contact } = connectors({
      subject: subject({ company: LEGAL_NAME }),
    });
    const prepared = await prepare(
      contact,
      line("brevo_contact"),
      state(
        { role: "advertiser", declaredStatus: "business" },
        {
          ...SETTINGS,
          brevo_list_ids: { advertisers: null, creators: CREATORS_LIST },
        },
      ),
    );
    expect(
      prepared.kind === "mapped" && prepared.description.missingSettings,
    ).toEqual(["brevo_list_ids.advertisers"]);
  });

  it("05 RG164 (a): without consent at sign-up and without a list, skipped no_consent, never a configuration failure", async () => {
    const { contact } = connectors();
    expect(
      await prepare(
        contact,
        line("brevo_contact"),
        state(
          { marketingEmailConsent: false },
          {
            ...SETTINGS,
            brevo_list_ids: { advertisers: null, creators: null },
          },
        ),
      ),
    ).toEqual({ kind: "skip", reason: "no_consent" });
    expect(reads).toHaveLength(0);
  });

  it("05 RG160 point 5, CA84: a withdrawal needs no list, it is unsubscribed whatever the lists", async () => {
    const { contact } = connectors();
    const prepared = await prepare(
      contact,
      line("brevo_contact", { eventType: "consent.revoked" }),
      state(
        { marketingEmailConsent: false },
        { ...SETTINGS, brevo_list_ids: { advertisers: null, creators: null } },
      ),
    );
    expect(prepared.kind === "mapped" && prepared.description).toEqual({
      operation: "unsubscribe_contact",
      templateCode: null,
      attributeNames: [],
      rejectedAttributeNames: [],
      missingSettings: [],
    });
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
  it("CA40: leaves whatever the consent, in the account's language, with the text of its role (D69)", async () => {
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
    expect(message?.body).toMatchObject({
      sender: { name: "INFLUX", email: "no-reply@tx.influx.example" },
      to: [{ email: EMAIL }],
      subject: "Bienvenue sur INFLUX",
      tags: ["account.welcome_creator"],
    });
    // D69 (16 RG67): written by INFLUX, Brevo only carries it
    expect(message?.body).not.toHaveProperty("templateId");
    expect(message?.body).not.toHaveProperty("params");
    expect(message?.body.textContent).toContain(
      "Votre compte créateur est créé",
    );
    expect(message?.body.htmlContent).toContain('<html lang="fr">');
    // RG86, D48: no promotional content, no amount, no percentage, no link
    expect(
      `${String(message?.body.textContent)}${String(message?.body.htmlContent)}`,
    ).not.toMatch(/%|€|\$|href|https?:/);
  });

  it("the advertiser's welcome uses the advertiser's text, in the account's language", async () => {
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
    expect(double.delivered[0]?.body.subject).toBe("Welcome to INFLUX");
    expect(double.delivered[0]?.body.textContent).toContain(
      "Your brand account is ready",
    );
  });

  it("describes the send by its code only", async () => {
    const { transactional } = connectors();
    const prepared = await prepare(
      transactional,
      line("brevo_transactional"),
      state(),
    );
    expect(prepared.kind === "mapped" && prepared.description).toEqual({
      operation: "send_transactional",
      templateCode: "account.welcome_creator",
      attributeNames: [],
      rejectedAttributeNames: [],
      missingSettings: [],
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

  it("D69: a template id left in the settings is ignored; a code outside the queue e-mails fails", async () => {
    const { transactional } = connectors();
    await run(
      transactional,
      line("brevo_transactional"),
      state(
        {},
        {
          ...SETTINGS,
          brevo_template_ids: { "account.welcome_creator": 12 },
        },
      ),
    );
    expect(double.messages[0]?.body).not.toHaveProperty("templateId");
    double.messages.length = 0;
    double.requests.length = 0;
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
      missingSettings: [],
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
  const REQUEST = "5d0c7e1a-2b3f-4c6d-8e9f-0a1b2c3d4e5f";
  const NOTICE_SETTINGS = SETTINGS;

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
      attributeNames: [],
      rejectedAttributeNames: [],
      missingSettings: [],
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
    // D69: the text of INFLUX for the old address, which never names the new one
    expect(message?.body).not.toHaveProperty("templateId");
    expect(message?.body.subject).toBe(
      "L'adresse de votre compte INFLUX a changé",
    );
    expect(String(message?.body.textContent)).not.toContain(NEW_EMAIL);
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

  it("D69: the current address has its own text, which never names the old one", async () => {
    await run(
      noticing(),
      notice("current"),
      state({ preferredLanguage: "en" }),
    );
    const [message] = double.messages;
    expect(message?.body.subject).toBe(
      "This address is now the one of your INFLUX account",
    );
    expect(String(message?.body.textContent)).not.toContain(EMAIL);
    expect(message?.body).not.toHaveProperty("templateId");
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
      missingSettings: [],
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
  const EXPORT = {
    type: "access",
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
      subject: subject({ dataRequest: EXPORT, ...overrides }),
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
      missingSettings: [],
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
      "Your INFLUX data export request has been received",
    );
    const text = String(message?.body.textContent);
    expect(text).toMatch(
      /submitted from your INFLUX account on October 14, 2026 at 5:00\sPM \(EDT\)\./,
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

  it("RG160: another type fails unsupported_request_type, an erasure included (D72); a request closed since is skipped request_closed", async () => {
    for (const type of ["rectification", "erasure"]) {
      expect(
        await prepare(
          acknowledging({ dataRequest: { ...EXPORT, type } }),
          acknowledgement(),
          state(),
        ),
        type,
      ).toEqual({ kind: "fail", errorCode: "unsupported_request_type" });
    }
    expect(
      await prepare(
        acknowledging({ dataRequest: { ...EXPORT, closed: true } }),
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
      subject: subject({ dataRequest: EXPORT }),
    });
    expect(await prepare(transactional, acknowledgement(), state())).toEqual({
      kind: "skip",
      reason: "skipped_non_production",
    });
    expect(double.requests).toHaveLength(0);
  });
});

describe("04 §9.2, 15 RG79, J8 commit 8: account.deleted deletes the contact of an erased account (operation 2)", () => {
  const REQUEST = "6e5d4c3b-2a19-4807-b6f5-e4d3c2b1a090";

  function deleted(): ClaimedLine {
    return line("brevo_contact", {
      eventType: "account.deleted",
      payload: {
        event_id: "0a1b2c3d-0000-4000-8000-00000000d0d0",
        account_id: ACCOUNT,
        request_id: REQUEST,
      },
    });
  }

  it("by its Brevo id, then by the held address: the contact and its list memberships are gone, before the account step", async () => {
    await run(connectors().contact, line("brevo_contact"));
    expect(double.contacts.has(EMAIL)).toBe(true);
    const prepared = await prepare(
      connectors({ erasureSubject: { externalContactId: "1", email: EMAIL } })
        .contact,
      deleted(),
      state({ status: "deleted", marketingEmailConsent: false }),
    );
    expect(prepared.kind === "mapped" && prepared.description).toEqual({
      operation: "delete_contact",
      templateCode: null,
      attributeNames: [],
      rejectedAttributeNames: [],
      missingSettings: [],
    });
    if (prepared.kind !== "mapped") {
      throw new Error("expected a mapped deletion");
    }
    expect(await prepared.result()).toEqual({ kind: "succeeded" });
    expect(
      double.requests
        .slice(1)
        .map((request) => `${request.method} ${request.path}`),
    ).toEqual([
      "DELETE /v3/contacts/1?identifierType=contact_id",
      `DELETE /v3/contacts/${encodeURIComponent(EMAIL)}?identifierType=email_id`,
    ]);
    expect(double.contacts.size).toBe(0);
    expect(double.lists.get(CREATORS_LIST)?.has(EMAIL) ?? false).toBe(false);
  });

  it("F5: a stale Brevo id (404) never closes it while a contact remains under the address", async () => {
    await run(connectors().contact, line("brevo_contact"));
    expect(
      await run(
        connectors({
          erasureSubject: { externalContactId: "999", email: EMAIL },
        }).contact,
        deleted(),
        state({ status: "deleted" }),
      ),
    ).toEqual({ kind: "succeeded" });
    expect(double.contacts.size).toBe(0);
  });

  it("a failure on either identifier fails the call: never a success while Brevo did not answer", async () => {
    await run(connectors().contact, line("brevo_contact"));
    double.queue({ status: 503 });
    const result = await run(
      connectors({ erasureSubject: { externalContactId: "1", email: EMAIL } })
        .contact,
      deleted(),
      state({ status: "deleted" }),
    );
    expect(result).toMatchObject({
      kind: "retry",
      errorCode: "brevo.unavailable",
    });
  });

  it("without a known id: by the address the request holds until Brevo confirms (email_id)", async () => {
    await run(connectors().contact, line("brevo_contact"));
    expect(
      await run(connectors().contact, deleted(), state({ status: "deleted" })),
    ).toEqual({ kind: "succeeded" });
    expect(double.requests.at(-1)?.path).toBe(
      `/v3/contacts/${encodeURIComponent(EMAIL)}?identifierType=email_id`,
    );
    expect(double.contacts.size).toBe(0);
  });

  it("a contact Brevo does not know (never created, already deleted) is a success: nothing of the person is left", async () => {
    expect(
      await run(connectors().contact, deleted(), state({ status: "deleted" })),
    ).toEqual({ kind: "succeeded" });
    expect(double.requests.at(-1)?.method).toBe("DELETE");
  });

  it("an account that is not erased fails account_not_erased, before any read or call", async () => {
    expect(await prepare(connectors().contact, deleted(), state())).toEqual({
      kind: "fail",
      errorCode: "account_not_erased",
    });
    expect(reads).toEqual([]);
    expect(double.requests).toHaveLength(0);
  });

  it("no request of the account behind the line fails erasure_not_found; a closed request (address released) is skipped erasure_closed", async () => {
    expect(
      await prepare(
        connectors({ erasureSubject: null }).contact,
        deleted(),
        state({ status: "deleted" }),
      ),
    ).toEqual({ kind: "fail", errorCode: "erasure_not_found" });
    expect(
      await prepare(
        connectors({ erasureSubject: { externalContactId: "1", email: null } })
          .contact,
        deleted(),
        state({ status: "deleted" }),
      ),
    ).toEqual({ kind: "skip", reason: "erasure_closed" });
    expect(double.requests).toHaveLength(0);
  });

  it("redirect: an address outside BREVO_TEST_RECIPIENTS is skipped_non_production, never deleted", async () => {
    const { contact } = connectors({ settings: { testRecipients: [] } });
    expect(
      await prepare(contact, deleted(), state({ status: "deleted" })),
    ).toEqual({ kind: "skip", reason: "skipped_non_production" });
    expect(double.requests).toHaveLength(0);
  });

  it("logs no address, no contact id (D60)", async () => {
    await run(connectors().contact, line("brevo_contact"));
    await run(
      connectors({ erasureSubject: { externalContactId: "1", email: EMAIL } })
        .contact,
      deleted(),
      state({ status: "deleted" }),
    );
    expect(valuesFoundIn(logLines.join("\n"), [EMAIL])).toEqual([]);
  });
});

describe("runbook demandes-rgpd §4, J8 commit 8: privacy.export_ready, written by INFLUX without any link", () => {
  const REQUEST = "7f6e5d4c-3b2a-4918-87a6-f5e4d3c2b1a0";
  const EXPORT = "8a7f6e5d-4c3b-4a29-9817-a6f5e4d3c2b1";
  const ACCESS = {
    type: "access",
    receivedAt: "2026-10-14T21:00:00.000Z",
    dueAt: "2026-11-13T21:00:00.000Z",
    closed: false,
  };

  function ready(): ClaimedLine {
    return line("brevo_transactional", {
      eventType: "privacy.export_ready",
      payload: {
        event_id: "0a1b2c3d-0000-4000-8000-00000000e1e1",
        account_id: ACCOUNT,
        request_id: REQUEST,
        export_id: EXPORT,
        email_code: "privacy.export_ready",
      },
      idempotencyKey: `privacy.export_ready:${REQUEST}`,
    });
  }

  function announcing(overrides: Partial<BrevoSubject> = {}): Connector {
    return connectors({
      subject: subject({
        dataRequest: ACCESS,
        exportExpiresAt: "2026-10-23T09:30:00.000Z",
        ...overrides,
      }),
    }).transactional;
  }

  it("says where and until when, in the account's language and time zone, no template, no link", async () => {
    const prepared = await prepare(
      announcing({ timeZone: "Europe/Paris" }),
      ready(),
      state({ marketingEmailConsent: false }, {}),
    );
    expect(prepared.kind === "mapped" && prepared.description).toEqual({
      operation: "send_transactional",
      templateCode: "privacy.export_ready",
      attributeNames: [],
      rejectedAttributeNames: [],
      missingSettings: [],
    });
    if (prepared.kind !== "mapped") {
      throw new Error("expected a mapped e-mail");
    }
    expect(await prepared.result()).toMatchObject({
      kind: "succeeded",
      locale: "fr",
    });
    const [message] = double.messages;
    expect(message?.body.to).toEqual([{ email: EMAIL }]);
    expect(message?.body).not.toHaveProperty("templateId");
    expect(message?.body).not.toHaveProperty("attachment");
    expect(message?.body.subject).toBe(
      "Votre export de données INFLUX est disponible",
    );
    const text = String(message?.body.textContent);
    expect(text).toContain(
      "rubrique « Mes données », jusqu'au 23 octobre 2026 à 11:30",
    );
    expect(text).toContain("trois fois au plus");
    expect(text).not.toMatch(/https?:|www\.|\.(?:com|fr|io)\b/);
    expect(message?.body.tags).toEqual(["privacy.export_ready"]);
    expect(message?.headers["idempotency-key"]).toBe(
      `privacy.export_ready:${REQUEST}`,
    );
  });

  it("no export of the account behind the line fails export_not_found; a request closed since is skipped", async () => {
    expect(
      await prepare(announcing({ exportExpiresAt: null }), ready(), state()),
    ).toEqual({ kind: "fail", errorCode: "export_not_found" });
    expect(
      await prepare(
        announcing({ dataRequest: { ...ACCESS, closed: true } }),
        ready(),
        state(),
      ),
    ).toEqual({ kind: "skip", reason: "request_closed" });
    expect(double.requests).toHaveLength(0);
  });
});

describe("D72, 16 RG160 bis: privacy.erasure_completed answers an erasure after the account is gone", () => {
  const REQUEST = "7b1f0c3e-5a2d-4e86-9c14-d3a8b6f20e51";

  function answer(): ClaimedLine {
    return line("brevo_transactional", {
      eventType: "privacy.erasure_completed",
      payload: {
        event_id: "0a1b2c3d-0000-4000-8000-00000000d721",
        account_id: ACCOUNT,
        request_id: REQUEST,
        email_code: "privacy.erasure_completed",
      },
      idempotencyKey: `privacy.erasure_completed:${REQUEST}`,
    });
  }

  /** The state the drain reads once the worker anonymised the account (04 §9.2). */
  function erased(): AttemptState {
    return state({ status: "deleted" });
  }

  it("leaves to the held address, in the language and time zone of the execution, with its code and key", async () => {
    const { transactional } = connectors({
      notificationSubject: {
        email: EMAIL,
        preferredLanguage: "en",
        timeZone: "America/Toronto",
        erasedAt: "2026-10-28T09:30:00.000Z",
      },
    });
    const result = await run(transactional, answer(), erased());
    expect(result).toMatchObject({ kind: "succeeded", locale: "en" });
    expect(result.kind === "succeeded" && result.providerMessageId).toMatch(
      /@double\.brevo\.test>$/,
    );
    const [message] = double.delivered;
    expect(message?.body).toMatchObject({
      to: [{ email: EMAIL }],
      subject: "Your INFLUX account has been deleted",
      tags: ["privacy.erasure_completed"],
    });
    expect(message?.body.textContent).toMatch(
      /October 28, 2026 at 5:30\sAM \(EDT\)/,
    );
    expect(message?.headers["idempotency-key"]).toBe(
      `privacy.erasure_completed:${REQUEST}`,
    );
    // read by the request of the line; the subject read of an active account is never made
    expect(reads).toEqual(["notification"]);
  });

  it("is sent whatever the account state, even absent: the account is erased by construction", async () => {
    const { transactional } = connectors();
    const claimed = answer();
    expect(
      (await prepare(transactional, claimed, { ...erased(), account: null }))
        .kind,
    ).toBe("mapped");
    expect(
      (await prepare(transactional, claimed, state({ status: "suspended" })))
        .kind,
    ).toBe("mapped");
  });

  it("English for any language outside fr, French when the execution captured it", async () => {
    const { transactional } = connectors({
      notificationSubject: {
        email: EMAIL,
        preferredLanguage: "de",
        timeZone: "UTC",
        erasedAt: "2026-10-28T09:30:00.000Z",
      },
    });
    expect(await run(transactional, answer(), erased())).toMatchObject({
      locale: "en",
    });
    const french = connectors();
    expect(await run(french.transactional, answer(), erased())).toMatchObject({
      locale: "fr",
    });
  });

  it("no executed, open erasure behind the line fails erasure_not_found, nothing called", async () => {
    const { transactional } = connectors({ notificationSubject: null });
    expect(await prepare(transactional, answer(), erased())).toEqual({
      kind: "fail",
      errorCode: "erasure_not_found",
    });
    const noRequest = answer();
    expect(
      await prepare(
        transactional,
        { ...noRequest, payload: { email_code: "privacy.erasure_completed" } },
        erased(),
      ),
    ).toEqual({ kind: "fail", errorCode: "erasure_not_found" });
    expect(double.requests).toHaveLength(0);
  });

  it("redirect: an address outside BREVO_TEST_RECIPIENTS is skipped_non_production", async () => {
    const { transactional } = connectors({
      settings: { testRecipients: ["someone-else@example.test"] },
    });
    expect(await prepare(transactional, answer(), erased())).toEqual({
      kind: "skip",
      reason: "skipped_non_production",
    });
    expect(double.requests).toHaveLength(0);
  });

  it("describes the send by its code only", async () => {
    const { transactional } = connectors();
    const prepared = await prepare(transactional, answer(), erased());
    expect(prepared.kind === "mapped" && prepared.description).toEqual({
      operation: "send_transactional",
      templateCode: "privacy.erasure_completed",
      attributeNames: [],
      rejectedAttributeNames: [],
      missingSettings: [],
    });
  });
});

describe("L2C commit 09, 06 RG66, RG69: profile.decision answers the examination of a brand profile", () => {
  const ENTRY = "5c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1e2f";

  function decided(): ClaimedLine {
    return line("brevo_transactional", {
      eventType: "profile.decision",
      payload: {
        event_id: "0a1b2c3d-0000-4000-8000-00000000d801",
        account_id: ACCOUNT,
        entry_id: ENTRY,
        email_code: "profile.decision",
      },
      idempotencyKey: `profile.decision:${ENTRY}`,
    });
  }

  const PUBLISHED: BrevoProfileDecision = {
    decision: "published",
    reasonCode: null,
    memberMessage: null,
    preferredLanguage: "fr",
  };

  const OTHER: BrevoProfileDecision = {
    decision: "rejected",
    reasonCode: "other",
    memberMessage:
      "Votre numéro de TVA ne correspond à aucune entreprise connue de nos équipes.",
    preferredLanguage: "fr",
  };

  it("a publication leaves in the language read with its code and the key of the decision, without any template", async () => {
    const { transactional } = connectors({
      decision: { ...PUBLISHED, preferredLanguage: "en" },
    });
    const claimed = decided();
    const result = await run(transactional, claimed);
    expect(result).toMatchObject({ kind: "succeeded", locale: "en" });
    const [message] = double.delivered;
    expect(message?.body).toMatchObject({
      to: [{ email: EMAIL }],
      subject: "Your INFLUX brand profile is published",
      tags: ["profile.decision"],
    });
    expect(message?.body.templateId).toBeUndefined();
    expect(message?.headers["idempotency-key"]).toBe(
      `profile.decision:${ENTRY}`,
    );
    // the address comes from the subject read, the decision from its own read
    expect(reads).toEqual([claimed.id, `decision:${claimed.id}`]);
  });

  it("a refusal carries the message of its reason, in French for fr", async () => {
    const { transactional } = connectors({
      decision: {
        decision: "rejected",
        reasonCode: "duplicate_brand",
        memberMessage: null,
        preferredLanguage: "fr",
      },
    });
    expect(await run(transactional, decided())).toMatchObject({
      kind: "succeeded",
      locale: "fr",
    });
    const [message] = double.delivered;
    expect(message?.body.subject).toBe(
      "Votre profil marque INFLUX n'a pas été publié",
    );
    expect(message?.body.textContent).toContain(
      "Cette marque dispose déjà d'un compte INFLUX.",
    );
  });

  it("the message of the agent (other) is escaped in the HTML part", async () => {
    const { transactional } = connectors({
      decision: {
        ...OTHER,
        memberMessage:
          "Votre profil <b>mélange</b> deux marques & deux activités différentes.",
      },
    });
    await run(transactional, decided());
    const [message] = double.delivered;
    expect(message?.body.htmlContent).toContain(
      "Votre profil &lt;b&gt;mélange&lt;/b&gt; deux marques &amp; deux activités différentes.",
    );
    expect(message?.body.htmlContent).not.toContain("<b>");
  });

  it("a message of the agent that looks like a link is refused by the output check, nothing sent", async () => {
    for (const message of [
      "Voyez notre page sur https://exemple.invalid/marque pour comprendre.",
      "Écrivez-nous à contact@exemple.invalid pour en discuter ensemble.",
      "Passez par exemple.com pour corriger votre présentation de marque.",
    ]) {
      const { transactional } = connectors({
        decision: { ...OTHER, memberMessage: message },
      });
      const prepared = await prepare(transactional, decided(), state());
      expect(prepared.kind === "mapped" && prepared.description).toMatchObject({
        operation: "send_transactional",
        rejectedAttributeNames: ["htmlContent", "textContent"],
      });
      expect(await run(transactional, decided())).toEqual({
        kind: "failed",
        errorCode: "output_check_rejected",
      });
    }
    expect(double.requests).toHaveLength(0);
  });

  it("fails visibly, nothing sent: no decided entry, a reason outside the list, other without its message", async () => {
    const failure = (decision: BrevoProfileDecision | null) =>
      prepare(connectors({ decision }).transactional, decided(), state());
    expect(await failure(null)).toEqual({
      kind: "fail",
      errorCode: "decision_not_found",
    });
    expect(await failure({ ...PUBLISHED, decision: "withdrawn" })).toEqual({
      kind: "fail",
      errorCode: "decision_unknown",
    });
    expect(
      await failure({ ...OTHER, reasonCode: "made_up", memberMessage: null }),
    ).toEqual({ kind: "fail", errorCode: "rejection_reason_unknown" });
    expect(await failure({ ...OTHER, reasonCode: null })).toEqual({
      kind: "fail",
      errorCode: "rejection_reason_unknown",
    });
    expect(await failure({ ...OTHER, memberMessage: null })).toEqual({
      kind: "fail",
      errorCode: "member_message_missing",
    });
    expect(double.requests).toHaveLength(0);
  });

  it("an account that is not active gets nothing and its decision is not read", async () => {
    const { transactional } = connectors({ decision: PUBLISHED });
    expect(
      (await prepare(transactional, decided(), state({ status: "deleted" })))
        .kind,
    ).toBe("skip");
    expect(reads.filter((read) => read.startsWith("decision:"))).toEqual([]);
  });

  it("redirect: an address outside BREVO_TEST_RECIPIENTS is skipped_non_production", async () => {
    const { transactional } = connectors({
      decision: PUBLISHED,
      settings: { testRecipients: ["someone-else@example.test"] },
    });
    expect(await prepare(transactional, decided(), state())).toEqual({
      kind: "skip",
      reason: "skipped_non_production",
    });
  });
});

const PUBLISHED_BRAND: BrandProfileAttributes = {
  status: "published",
  completenessPercent: 85,
  primarySector: "food_beverages",
  companySizeBand: "11_50",
  websiteDomain: "maison-verbeke.example",
  mainTopic: "cooking",
  targetMarkets: ["BE", "FR", "NL"],
  everPublished: true,
};

const BRAND_STATE = {
  role: "advertiser",
  declaredStatus: "business",
} as const;

describe("L2C commit 10, 06 RG78 to RG81, CA40 to CA43: profile.completed enriches the brand contact", () => {
  it("CA40, RG79: profile.completed rewrites the contact like lead.updated, with the real attributes of the live profile", async () => {
    const { contact } = connectors({
      subject: subject({ company: LEGAL_NAME }),
      brandProfile: PUBLISHED_BRAND,
    });
    const completed = line("brevo_contact", {
      eventType: "profile.completed",
      idempotencyKey: `profile.completed:${ACCOUNT}`,
    });
    expect(await run(contact, completed, state(BRAND_STATE))).toEqual({
      kind: "succeeded",
      providerContactId: "1",
    });
    const stored = double.contacts.get(EMAIL);
    expect(stored?.listIds).toEqual([ADVERTISERS_LIST]);
    expect(stored?.attributes).toMatchObject({
      PROFILE_TYPE: "advertiser",
      COMPANY: LEGAL_NAME,
      FUNNEL_STAGE: "profile_completed",
      PROFILE_COMPLETENESS: 85,
      MAIN_TOPIC: "cooking",
      SECTOR: "food_beverages",
      COMPANY_SIZE: "11_50",
      TARGET_MARKETS: "BE,FR,NL",
      PROFILE_STATUS: "published",
      VERIFIED_LEVEL: "none",
    });
    expect(Object.keys(stored?.attributes ?? {}).sort()).toEqual(
      [...BREVO_CONTACT_ATTRIBUTES].sort(),
    );
    expect(reads).toHaveLength(2);
    expect(reads[1]).toBe(`brand:${completed.id}`);
  });

  it("lead.updated after the publication carries the same attributes, a modification waiting in the review being left out (RG9)", async () => {
    const { contact } = connectors({
      subject: subject({ company: LEGAL_NAME }),
      brandProfile: { ...PUBLISHED_BRAND, completenessPercent: 90 },
    });
    await run(
      contact,
      line("brevo_contact", { eventType: "lead.updated" }),
      state(BRAND_STATE),
    );
    expect(double.contacts.get(EMAIL)?.attributes).toMatchObject({
      FUNNEL_STAGE: "profile_completed",
      PROFILE_COMPLETENESS: 90,
      PROFILE_STATUS: "published",
    });
  });

  it("RG81, 16 RG142: a draft brand is registered, and every field not filled is sent empty, never invented", async () => {
    const { contact } = connectors({
      subject: subject({ company: LEGAL_NAME }),
      brandProfile: {
        status: "draft",
        completenessPercent: null,
        primarySector: null,
        companySizeBand: null,
        websiteDomain: null,
        mainTopic: null,
        targetMarkets: [],
        everPublished: false,
      },
    });
    await run(contact, line("brevo_contact"), state(BRAND_STATE));
    expect(double.contacts.get(EMAIL)?.attributes).toMatchObject({
      FUNNEL_STAGE: "registered",
      PROFILE_COMPLETENESS: 0,
      MAIN_TOPIC: "",
      SECTOR: "",
      COMPANY_SIZE: "",
      TARGET_MARKETS: "",
      PROFILE_STATUS: "draft",
    });
  });

  it("a brand without any profile row keeps the defaults of 16 §M4; a creator never reads a brand profile", async () => {
    const { contact } = connectors({
      subject: subject({ company: LEGAL_NAME }),
      brandProfile: null,
    });
    await run(contact, line("brevo_contact"), state(BRAND_STATE));
    expect(double.contacts.get(EMAIL)?.attributes).toMatchObject({
      FUNNEL_STAGE: "registered",
      PROFILE_COMPLETENESS: 0,
      PROFILE_STATUS: "",
    });
    reads = [];
    const creators = connectors({ brandProfile: PUBLISHED_BRAND });
    await run(creators.contact, line("brevo_contact"));
    expect(reads.filter((read) => read.startsWith("brand:"))).toEqual([]);
    expect(double.contacts.get(EMAIL)?.attributes.SECTOR).toBe("");
  });

  it("CA41: profile.completed without marketing consent is skipped no_consent, before any read, any list and any call", async () => {
    const { contact } = connectors({ brandProfile: PUBLISHED_BRAND });
    expect(
      await prepare(
        contact,
        line("brevo_contact", { eventType: "profile.completed" }),
        state(
          { ...BRAND_STATE, marketingEmailConsent: false },
          {
            ...SETTINGS,
            brevo_list_ids: { advertisers: null, creators: null },
          },
        ),
      ),
    ).toEqual({ kind: "skip", reason: "no_consent" });
    expect(reads).toEqual([]);
    expect(double.requests).toHaveLength(0);
  });

  it("RG80, CA42: the closed list holds the four new attributes and refuses the legal name, the registration number, a note and the contact person", () => {
    for (const name of [
      "SECTOR",
      "COMPANY_SIZE",
      "TARGET_MARKETS",
      "PROFILE_STATUS",
    ]) {
      expect(
        checkContactOutput({ email: EMAIL, attributes: { [name]: "x" } }),
      ).toEqual([]);
    }
    for (const name of [
      "LEGAL_NAME",
      "REGISTRATION_NUMBER",
      "INTERNAL_NOTE",
      "CONTACT_EMAIL",
      "CONTACT_PHONE",
      "CONTACT_FIRST_NAME",
      "BUDGET",
    ]) {
      expect(
        checkContactOutput({ email: EMAIL, attributes: { [name]: "x" } }),
      ).toEqual([name]);
    }
  });

  it("CA42, L2CT-8: what leaves holds none of the values RG80 forbids, even when the reads hold them", async () => {
    // The doubles hold the REAL raison sociale, number, contact and note next to the trading name:
    // a mapping that copied a read as a whole (a spread, a lookup by name) would send them. The
    // readers' types do not name these fields, so the object is built outside any literal check.
    const forbidden = [
      "Verbeke-Lambrecht Holding SA",
      "BE0123456789",
      "contact-person@maison-verbeke.example",
      "+3225550123",
      "internal note: prefers a call",
    ];
    const enrichedSubject = {
      ...subject({ company: LEGAL_NAME }),
      legalName: forbidden[0],
      raisonSociale: forbidden[0],
      registrationNumber: forbidden[1],
      contactEmail: forbidden[2],
      contactPhone: forbidden[3],
      internalNote: forbidden[4],
    };
    const enrichedProfile = {
      ...PUBLISHED_BRAND,
      legalName: forbidden[0],
      registrationNumber: forbidden[1],
      contactPerson: forbidden[2],
      note: forbidden[4],
    };
    const enrichedBadge = {
      level: "n1" as const,
      at: "2026-11-03T10:00:00.000Z",
      handle: "@maison_verbeke",
      followers: 4730012,
      reason: forbidden[4],
    };
    const { contact } = connectors({
      subject: enrichedSubject,
      brandProfile: enrichedProfile,
      badge: enrichedBadge,
    });
    for (const eventType of ["profile.completed", "lead.updated"]) {
      double.reset();
      await run(
        contact,
        line("brevo_contact", { eventType }),
        state(BRAND_STATE),
      );
      const raw = double.requests[0]?.raw ?? "";
      expect(raw).toContain(LEGAL_NAME);
      expect(
        valuesFoundIn(raw, [...forbidden, "maison_verbeke", "4730012"]),
      ).toEqual([]);
      // the badge leaves as a level and a date, and nothing else of it
      expect(double.contacts.get(EMAIL)?.attributes).toMatchObject({
        VERIFIED_LEVEL: "n1",
        VERIFIED_AT: "2026-11-03T10:00:00.000Z",
      });
    }
  });

  it("a mapping that adds a field outside the list is refused by name, the call never leaves (16 RG137)", async () => {
    const { contact } = connectors({
      subject: subject({ company: LEGAL_NAME }),
      brandProfile: PUBLISHED_BRAND,
      mapContact: (account, subjectRead, listId, profile) => {
        const body = mapContact(account, subjectRead, listId, profile);
        return {
          ...body,
          attributes: {
            ...body.attributes,
            REGISTRATION_NUMBER: "BE0123456789",
          },
        };
      },
    });
    const prepared = await prepare(
      contact,
      line("brevo_contact", { eventType: "profile.completed" }),
      state(BRAND_STATE),
    );
    expect(
      prepared.kind === "mapped" && prepared.description.rejectedAttributeNames,
    ).toEqual(["REGISTRATION_NUMBER"]);
    expect(double.requests).toHaveLength(0);
  });

  it("CA43: Brevo unavailable on profile.completed is a retry of the line, never an error that reaches the publication", async () => {
    double.queue({ status: 503 });
    const { contact } = connectors({
      subject: subject({ company: LEGAL_NAME }),
      brandProfile: PUBLISHED_BRAND,
    });
    expect(
      await run(
        contact,
        line("brevo_contact", { eventType: "profile.completed" }),
        state(BRAND_STATE),
      ),
    ).toMatchObject({ kind: "retry", errorMessage: "Brevo answered 503" });
  });
});

describe("L2E commit 16, 08 RG92, RG94: the badge level of a contact, the verification e-mails of its worker", () => {
  const REQUEST = "7d3e9a10-5b2c-4f68-9a41-c0b2d8e6f713";
  const CODE = "9e1f4c72-0a3b-4d85-b6c9-2f7a8d1e5b30";
  const HOLDS: VerifiedBadge = { level: "n2", at: "2026-11-03T10:00:00.000Z" };

  function verificationLine(
    eventType:
      | "verification.received"
      | "verification.code_issued"
      | "verification.decision"
      | "verification.request_expired",
  ): ClaimedLine {
    const key =
      eventType === "verification.code_issued"
        ? `${eventType}:${CODE}`
        : `${eventType}:${REQUEST}`;
    return line("brevo_transactional", {
      eventType,
      payload: {
        event_id: "0a1b2c3d-0000-4000-8000-00000000e160",
        account_id: ACCOUNT,
        request_id: REQUEST,
        email_code: eventType,
      },
      idempotencyKey: key,
    });
  }

  function facts(
    overrides: Partial<BrevoVerificationEmail> = {},
  ): BrevoVerificationEmail {
    return {
      level: "audience_verified",
      networkCode: "instagram",
      requestStatus: "approved",
      reasonCode: null,
      memberMessage: null,
      grantedAt: "2026-11-03T10:00:00.000Z",
      badgeExpiresAt: "2027-02-01T10:00:00.000Z",
      codeKind: null,
      codeExpiresAt: null,
      codeRevoked: false,
      disputeWindowDays: null,
      preferredLanguage: "fr",
      ...overrides,
    };
  }

  function textOfFirstMessage(): string {
    return String(double.delivered[0]?.body.textContent);
  }

  describe("VERIFIED_LEVEL and VERIFIED_AT (16 §M4; modele §1 point 7)", () => {
    it("a contact carries the level of its badge and the date of the badge that fixes it", async () => {
      const { contact } = connectors({ badge: HOLDS });
      await run(contact, line("brevo_contact", { eventType: "lead.updated" }));
      expect(double.contacts.get(EMAIL)?.attributes).toMatchObject({
        VERIFIED_LEVEL: "n2",
        VERIFIED_AT: "2026-11-03T10:00:00.000Z",
      });
    });

    it("without a badge, none and an empty date: never a guess from the event", async () => {
      for (const badge of [null, { level: "none" as const, at: null }]) {
        double.reset();
        const { contact } = connectors({ badge });
        await run(contact, line("brevo_contact"));
        expect(double.contacts.get(EMAIL)?.attributes).toMatchObject({
          VERIFIED_LEVEL: "none",
          VERIFIED_AT: "",
        });
      }
    });

    it("the level is read at every rewrite of the contact, a replayed lead.created and a consent given again included", async () => {
      for (const eventType of [
        "lead.created",
        "lead.updated",
        "consent.granted",
        "profile.completed",
      ]) {
        badgeReads = [];
        double.reset();
        const { contact } = connectors({ badge: HOLDS });
        const claimed = line("brevo_contact", { eventType });
        await run(contact, claimed, state(BRAND_STATE));
        expect(badgeReads).toEqual([claimed.id]);
        expect(double.contacts.get(EMAIL)?.attributes.VERIFIED_LEVEL).toBe(
          "n2",
        );
      }
    });

    it("nothing is read for a contact that is unsubscribed, nor for one without consent at sign-up", async () => {
      const { contact } = connectors({ badge: HOLDS });
      await prepare(
        contact,
        line("brevo_contact"),
        state({ marketingEmailConsent: false }),
      );
      await prepare(
        contact,
        line("brevo_contact", { eventType: "lead.created" }),
        state({ marketingEmailConsent: false }),
      );
      expect(badgeReads).toEqual([]);
    });
  });

  describe("the five e-mails, written by INFLUX from the facts read at consumption", () => {
    it("the four queue codes are worker-rendered e-mails", () => {
      for (const code of [
        "verification.received",
        "verification.code_issued",
        "verification.decision",
        "verification.request_expired",
      ]) {
        expect(WORKER_RENDERED_EMAILS).toContain(code);
      }
    });

    it("a granted audience badge leaves in the language read, with its code as tag, its key, no template, no figure", async () => {
      const { transactional } = connectors({
        verification: facts({ preferredLanguage: "en" }),
      });
      const claimed = verificationLine("verification.decision");
      expect(await run(transactional, claimed)).toMatchObject({
        kind: "succeeded",
        locale: "en",
      });
      const [message] = double.delivered;
      expect(message?.body).toMatchObject({
        to: [{ email: EMAIL }],
        subject: "Your INFLUX badge is granted",
        tags: ["verification.decision"],
      });
      expect(message?.body.templateId).toBeUndefined();
      expect(message?.headers["idempotency-key"]).toBe(
        `verification.decision:${REQUEST}`,
      );
      const text = textOfFirstMessage();
      expect(text).toContain("Audience verified — Instagram");
      expect(text).toContain("November 3, 2026");
      expect(text).toContain("makes no claim about follower authenticity");
      expect(verificationReads).toEqual([claimed.id]);
      expect(reads).toEqual([claimed.id]);
    });

    it("a refusal carries the text of its reason in the language read, and what to do next", async () => {
      const { transactional } = connectors({
        verification: facts({
          requestStatus: "rejected",
          reasonCode: "evidence_too_wide",
          grantedAt: null,
          badgeExpiresAt: null,
        }),
      });
      await run(transactional, verificationLine("verification.decision"));
      const text = textOfFirstMessage();
      expect(text).toContain(
        "Votre capture montre des informations concernant d'autres personnes.",
      );
      expect(text).toContain("redemander la vérification");
    });

    it("the refusal of a creator says how long an appeal stays open, one of a brand or of a closed request does not (L2F commit 12)", async () => {
      const refused = {
        requestStatus: "rejected",
        reasonCode: "evidence_too_wide",
        grantedAt: null,
        badgeExpiresAt: null,
        disputeWindowDays: 30,
      } as const;
      const { transactional } = connectors({ verification: facts(refused) });
      await run(transactional, verificationLine("verification.decision"));
      expect(textOfFirstMessage()).toContain(
        "Vous pouvez contester cette décision pendant 30 jours.",
      );

      for (const [override, status] of [
        [
          {
            level: "brand_verified",
            networkCode: null,
            reasonCode: "name_mismatch",
          },
          "brand",
        ],
        [{ requestStatus: "closed" }, "closed"],
      ] as const) {
        double.reset();
        const { transactional: other } = connectors({
          verification: facts({ ...refused, ...override }),
        });
        await run(other, verificationLine("verification.decision"));
        expect(textOfFirstMessage(), status).not.toContain("contester");
      }
    });

    it("a brand refusal uses the brand list: a creator reason is a visible failure, never the wrong text", async () => {
      const brand = {
        level: "brand_verified",
        networkCode: null,
        requestStatus: "rejected",
        grantedAt: null,
        badgeExpiresAt: null,
      } as const;
      const ok = connectors({
        verification: facts({ ...brand, reasonCode: "name_mismatch" }),
      });
      await run(ok.transactional, verificationLine("verification.decision"));
      expect(textOfFirstMessage()).toContain(
        "La raison sociale saisie ne correspond pas à celle du registre.",
      );
      const wrong = connectors({
        verification: facts({ ...brand, reasonCode: "evidence_too_wide" }),
      });
      expect(
        await prepare(
          wrong.transactional,
          verificationLine("verification.decision"),
          state(),
        ),
      ).toEqual({ kind: "fail", errorCode: "rejection_reason_unknown" });
    });

    it("the agent's message is added for other and terms_breach only, and refused when it looks like a link", async () => {
      const refused = (reasonCode: string, memberMessage: string | null) =>
        connectors({
          verification: facts({
            requestStatus: "rejected",
            reasonCode,
            memberMessage,
            grantedAt: null,
            badgeExpiresAt: null,
          }),
        });
      for (const code of ["other", "terms_breach"]) {
        double.reset();
        await run(
          refused(code, "Merci de préciser votre activité.").transactional,
          verificationLine("verification.decision"),
        );
        expect(textOfFirstMessage()).toContain(
          "Merci de préciser votre activité.",
        );
      }
      double.reset();
      await run(
        refused("minor", "never shown").transactional,
        verificationLine("verification.decision"),
      );
      expect(textOfFirstMessage()).not.toContain("never shown");
      expect(
        await prepare(
          refused("other", null).transactional,
          verificationLine("verification.decision"),
          state(),
        ),
      ).toEqual({ kind: "fail", errorCode: "member_message_missing" });
      const linked = await prepare(
        refused("other", "Écrivez à contact@exemple.invalid").transactional,
        verificationLine("verification.decision"),
        state(),
      );
      expect(
        linked.kind === "mapped" && linked.description.rejectedAttributeNames,
      ).toEqual(["htmlContent", "textContent"]);
    });

    it("a closed request is answered with account_unavailable", async () => {
      const { transactional } = connectors({
        verification: facts({
          requestStatus: "closed",
          reasonCode: "account_unavailable",
          grantedAt: null,
          badgeExpiresAt: null,
        }),
      });
      await run(transactional, verificationLine("verification.decision"));
      expect(textOfFirstMessage()).toContain(
        "tant que votre compte est suspendu",
      );
    });

    it("received is sent once the request is pending or decided, never for a cancelled one, and tells RG29", async () => {
      const cancelled = connectors({
        verification: facts({ requestStatus: "cancelled" }),
      });
      expect(
        await prepare(
          cancelled.transactional,
          verificationLine("verification.received"),
          state(),
        ),
      ).toEqual({ kind: "skip", reason: "request_closed" });
      const pending = connectors({
        verification: facts({ requestStatus: "pending" }),
      });
      await run(
        pending.transactional,
        verificationLine("verification.received"),
      );
      const text = textOfFirstMessage();
      expect(text).toContain("Audience vérifiée — Instagram");
      expect(text).toContain(
        "INFLUX ne vous demandera jamais votre mot de passe",
      );
    });

    it("code_issued names its own code's kind and date, never the code, and skips a revoked, expired or closed one", async () => {
      const open = {
        requestStatus: "draft",
        codeKind: "network",
        codeExpiresAt: "2999-01-01T00:00:00.000Z",
        grantedAt: null,
        badgeExpiresAt: null,
      } as const;
      const { transactional } = connectors({ verification: facts(open) });
      await run(transactional, verificationLine("verification.code_issued"));
      const text = textOfFirstMessage();
      expect(text).toContain("Instagram");
      expect(text).toContain(
        "INFLUX ne vous demandera jamais votre mot de passe",
      );
      expect(text).not.toMatch(/INFLUX-[A-Z0-9]{8}/);
      for (const override of [
        { codeRevoked: true },
        { codeExpiresAt: "2020-01-01T00:00:00.000Z" },
        { requestStatus: "approved" },
        { requestStatus: "cancelled" },
      ]) {
        const skipped = connectors({
          verification: facts({ ...open, ...override }),
        });
        expect(
          await prepare(
            skipped.transactional,
            verificationLine("verification.code_issued"),
            state(),
          ),
        ).toEqual({ kind: "skip", reason: "code_obsolete" });
      }
      const missing = connectors({
        verification: facts({ ...open, codeKind: null }),
      });
      expect(
        await prepare(
          missing.transactional,
          verificationLine("verification.code_issued"),
          state(),
        ),
      ).toEqual({ kind: "fail", errorCode: "code_not_found" });
    });

    it("a brand's domain code speaks of the domain, and of no network", async () => {
      const { transactional } = connectors({
        verification: facts({
          level: "brand_verified",
          networkCode: null,
          requestStatus: "draft",
          codeKind: "domain",
          codeExpiresAt: "2999-01-01T00:00:00.000Z",
          grantedAt: null,
          badgeExpiresAt: null,
        }),
      });
      await run(transactional, verificationLine("verification.code_issued"));
      expect(textOfFirstMessage()).toContain("enregistrement DNS");
    });

    it("request_expired is sent for an expired request and fails visibly for any other", async () => {
      const expired = connectors({
        verification: facts({
          requestStatus: "expired",
          grantedAt: null,
          badgeExpiresAt: null,
        }),
      });
      await run(
        expired.transactional,
        verificationLine("verification.request_expired"),
      );
      expect(textOfFirstMessage()).toContain(
        "Vous pouvez en générer un nouveau.",
      );
      const live = connectors({
        verification: facts({ requestStatus: "draft" }),
      });
      expect(
        await prepare(
          live.transactional,
          verificationLine("verification.request_expired"),
          state(),
        ),
      ).toEqual({ kind: "fail", errorCode: "request_not_expired" });
    });

    it("nothing to read, an unknown level, an unknown network or a granted badge without its date: failed, visible, never guessed", async () => {
      const failing = (verification: BrevoVerificationEmail | null) =>
        prepare(
          connectors({ verification }).transactional,
          verificationLine("verification.decision"),
          state(),
        );
      expect(await failing(null)).toEqual({
        kind: "fail",
        errorCode: "verification_not_found",
      });
      expect(await failing(facts({ level: "gold" }))).toEqual({
        kind: "fail",
        errorCode: "verification_level_unknown",
      });
      expect(await failing(facts({ networkCode: "myspace" }))).toEqual({
        kind: "fail",
        errorCode: "network_unknown",
      });
      expect(await failing(facts({ grantedAt: null }))).toEqual({
        kind: "fail",
        errorCode: "badge_not_found",
      });
      expect(await failing(facts({ requestStatus: "pending" }))).toEqual({
        kind: "fail",
        errorCode: "decision_unknown",
      });
    });

    it("an account that is not active is skipped before any read of the facts", async () => {
      const { transactional } = connectors({ verification: facts() });
      expect(
        await prepare(
          transactional,
          verificationLine("verification.decision"),
          state({ status: "suspended" }),
        ),
      ).toMatchObject({ kind: "skip" });
      expect(verificationReads).toEqual([]);
    });
  });
});

describe("L2F commit 12, 08 RG93, RG94: the eight e-mails of the life of the badge, written from the facts of 0236", () => {
  const OBJECT = "b3a4c5d6-1f20-4e3a-9b8c-0d1e2f3a4b5c";
  const CODES = [
    "verification.expiry_reminder",
    "verification.expiry_to_refresh",
    "verification.expiry_removed",
    "verification.revoked_notice",
    "verification.dispute_received",
    "verification.dispute_outcome",
    "verification.reconfirm_required",
    "verification.agent_opened_notice",
  ] as const;
  type Code = (typeof CODES)[number];

  /** The payload names the object by its id, as the migrations 0230 to 0234 queue it (ids only). */
  function badgeLine(code: Code): ClaimedLine {
    const key = code.startsWith("verification.dispute_")
      ? "dispute_id"
      : code === "verification.reconfirm_required"
        ? "review_id"
        : code === "verification.agent_opened_notice"
          ? "request_id"
          : "badge_id";
    return line("brevo_transactional", {
      eventType: code,
      payload: {
        event_id: "0a1b2c3d-0000-4000-8000-00000000e170",
        account_id: ACCOUNT,
        [key]: OBJECT,
        email_code: code,
      },
      idempotencyKey: `${code}:${OBJECT}`,
    });
  }

  function facts(overrides: Partial<BrevoBadgeEmail> = {}): BrevoBadgeEmail {
    return {
      level: "audience_verified",
      networkCode: "instagram",
      objectState: "active",
      contestedDecision: null,
      badgeExpiresAt: "2027-02-01T10:00:00.000Z",
      graceEndsAt: "2027-03-03T10:00:00.000Z",
      reasonCode: null,
      memberMessage: null,
      outcomeReasonCode: null,
      restoredAt: null,
      disputeWindowDays: null,
      preferredLanguage: "fr",
      ...overrides,
    };
  }

  const BRAND = { level: "brand_verified", networkCode: null } as const;

  function body(): Record<string, unknown> {
    return double.delivered[0]?.body ?? {};
  }

  it("the eight codes are worker-rendered e-mails, written by INFLUX, never from a Brevo template", () => {
    for (const code of CODES) {
      expect(WORKER_RENDERED_EMAILS).toContain(code);
    }
  });

  it("each e-mail is read from the facts of its line alone, leaves with its code as tag and its key, no template, no link", async () => {
    const cases: [Code, Partial<BrevoBadgeEmail>][] = [
      ["verification.expiry_reminder", {}],
      ["verification.expiry_to_refresh", { objectState: "to_refresh" }],
      ["verification.expiry_removed", { objectState: "expired" }],
      [
        "verification.revoked_notice",
        {
          objectState: "revoked",
          reasonCode: "influx_error",
          disputeWindowDays: 30,
        },
      ],
      ["verification.dispute_received", { objectState: "open" }],
      [
        "verification.dispute_outcome",
        {
          objectState: "overturned",
          outcomeReasonCode: "decision_overturned",
          restoredAt: "2026-11-09T09:00:00.000Z",
        },
      ],
      [
        "verification.reconfirm_required",
        { level: "account_verified", objectState: "proof_required" },
      ],
      ["verification.agent_opened_notice", { objectState: "pending" }],
    ];
    for (const [code, override] of cases) {
      double.reset();
      badgeEmailReads = [];
      const { transactional } = connectors({ badgeEmail: facts(override) });
      const claimed = badgeLine(code);
      expect(await run(transactional, claimed), code).toMatchObject({
        kind: "succeeded",
        locale: "fr",
      });
      const [message] = double.delivered;
      expect(message?.body, code).toMatchObject({
        to: [{ email: EMAIL }],
        tags: [code],
      });
      expect(message?.body.templateId, code).toBeUndefined();
      expect(message?.headers["idempotency-key"], code).toBe(
        `${code}:${OBJECT}`,
      );
      expect(
        checkRenderedTransactionalOutput(message?.body ?? {}),
        code,
      ).toEqual([]);
      expect(badgeEmailReads, code).toEqual([claimed.id]);
    }
  });

  it("the reminder and the \"to refresh\" e-mail say the date, the creator's audience or the brand's badge, in the language read", async () => {
    const creator = connectors({
      badgeEmail: facts({ preferredLanguage: "en" }),
    });
    await run(creator.transactional, badgeLine("verification.expiry_reminder"));
    expect(String(body().textContent)).toContain(
      "Your verified audience expires on February 1, 2027. Upload a recent screenshot to keep it.",
    );

    double.reset();
    const brand = connectors({
      badgeEmail: facts({ ...BRAND, objectState: "to_refresh" }),
    });
    await run(brand.transactional, badgeLine("verification.expiry_to_refresh"));
    expect(body().subject).toBe("Votre badge Marque vérifiée est à rafraîchir");
    expect(String(body().textContent)).toContain(
      "Il reste affiché avec sa date jusqu'au 3 mars 2027.",
    );
  });

  it("a badge replaced, refreshed or ended since the line was queued is skipped, never announced", async () => {
    const stale: [Code, string][] = [
      ["verification.expiry_reminder", "to_refresh"],
      ["verification.expiry_to_refresh", "expired"],
      ["verification.expiry_removed", "active"],
      ["verification.revoked_notice", "replaced"],
    ];
    for (const [code, objectState] of stale) {
      const { transactional } = connectors({
        badgeEmail: facts({ objectState }),
      });
      const prepared = await prepare(transactional, badgeLine(code), state());
      expect(prepared, code).toMatchObject({
        kind: "skip",
        reason: "badge_changed",
      });
    }
    expect(double.delivered).toHaveLength(0);
  });

  it("a withdrawal gives the text of its reason, the agent's message where one is required, and the appeal window to a creator only", async () => {
    const revoked = facts({
      objectState: "revoked",
      reasonCode: "terms_breach",
      memberMessage: "Votre profil contient des contenus interdits.",
      disputeWindowDays: 30,
    });
    await run(
      connectors({ badgeEmail: revoked }).transactional,
      badgeLine("verification.revoked_notice"),
    );
    const text = String(body().textContent);
    expect(text).toContain(
      "Votre badge a été retiré : Votre profil ne respecte pas",
    );
    expect(text).toContain("Votre profil contient des contenus interdits.");
    expect(text).toContain(
      "Vous pouvez contester cette décision pendant 30 jours.",
    );

    double.reset();
    await run(
      connectors({
        badgeEmail: facts({
          ...BRAND,
          objectState: "revoked",
          reasonCode: "company_dissolved",
          disputeWindowDays: 30,
        }),
      }).transactional,
      badgeLine("verification.revoked_notice"),
    );
    const brandText = String(body().textContent);
    expect(brandText).toContain("La société a été radiée du registre public.");
    expect(brandText).not.toContain("contester");
  });

  it("influx_error apologises and never accuses the member", async () => {
    const { transactional } = connectors({
      badgeEmail: facts({
        objectState: "revoked",
        reasonCode: "influx_error",
        preferredLanguage: "en",
      }),
    });
    await run(transactional, badgeLine("verification.revoked_notice"));
    expect(String(body().textContent)).toContain(
      "INFLUX granted this badge by mistake. You are not at fault, and we apologise.",
    );
  });

  it("a reason outside the list, or a required message that is missing, is a visible failure, never guessed", async () => {
    for (const [override, errorCode] of [
      [{ reasonCode: "pirate" }, "revocation_reason_unknown"],
      [{ reasonCode: null }, "revocation_reason_unknown"],
      [
        { reasonCode: "terms_breach", memberMessage: null },
        "member_message_missing",
      ],
    ] as const) {
      const { transactional } = connectors({
        badgeEmail: facts({ objectState: "revoked", ...override }),
      });
      expect(
        await prepare(
          transactional,
          badgeLine("verification.revoked_notice"),
          state(),
        ),
      ).toMatchObject({ kind: "fail", errorCode });
    }
  });

  it("an appeal received names the badge; an outcome upheld names the original reason, a refusal's or a withdrawal's", async () => {
    await run(
      connectors({ badgeEmail: facts({ objectState: "open" }) }).transactional,
      badgeLine("verification.dispute_received"),
    );
    expect(String(body().textContent)).toContain(
      "concernant le badge « Audience vérifiée — Instagram »",
    );

    double.reset();
    await run(
      connectors({
        badgeEmail: facts({
          objectState: "upheld",
          outcomeReasonCode: "decision_confirmed",
          contestedDecision: "refusal",
          reasonCode: "evidence_too_old",
        }),
      }).transactional,
      badgeLine("verification.dispute_outcome"),
    );
    expect(String(body().textContent)).toContain(
      "la décision est maintenue pour son motif initial : La période affichée sur votre capture se termine il y a plus de 30 jours.",
    );

    double.reset();
    await run(
      connectors({
        badgeEmail: facts({
          objectState: "upheld",
          outcomeReasonCode: "decision_confirmed",
          contestedDecision: "revocation",
          reasonCode: "owner_changed",
          preferredLanguage: "en",
        }),
      }).transactional,
      badgeLine("verification.dispute_outcome"),
    );
    expect(String(body().textContent)).toContain(
      "the decision stands for its original reason: The social media account concerned has changed hands.",
    );
  });

  it("an overturned appeal gives the date of the badge handed back; the team's message follows `other` only", async () => {
    await run(
      connectors({
        badgeEmail: facts({
          objectState: "overturned",
          outcomeReasonCode: "decision_overturned",
          restoredAt: "2026-11-09T09:00:00.000Z",
        }),
      }).transactional,
      badgeLine("verification.dispute_outcome"),
    );
    expect(String(body().textContent)).toContain(
      "votre badge « Audience vérifiée — Instagram » est accordé à la date du 9 novembre 2026.",
    );

    double.reset();
    await run(
      connectors({
        badgeEmail: facts({
          objectState: "upheld",
          outcomeReasonCode: "other",
          memberMessage: "Merci de redéposer une capture récente.",
        }),
      }).transactional,
      badgeLine("verification.dispute_outcome"),
    );
    const text = String(body().textContent);
    expect(text).toContain("Le message de l'équipe INFLUX :");
    expect(text).toContain("Merci de redéposer une capture récente.");
  });

  it("an outcome that contradicts its state, an unknown code, or a missing message is a visible failure; a withdrawn appeal is skipped", async () => {
    for (const [override, errorCode] of [
      [
        { objectState: "upheld", outcomeReasonCode: "decision_overturned" },
        "dispute_outcome_unknown",
      ],
      [
        { objectState: "overturned", outcomeReasonCode: "decision_confirmed" },
        "dispute_outcome_unknown",
      ],
      [
        { objectState: "open", outcomeReasonCode: null },
        "dispute_outcome_unknown",
      ],
      [
        {
          objectState: "upheld",
          outcomeReasonCode: "other",
          memberMessage: null,
        },
        "member_message_missing",
      ],
      [
        {
          objectState: "overturned",
          outcomeReasonCode: "decision_overturned",
          restoredAt: null,
        },
        "badge_dates_missing",
      ],
      [
        {
          objectState: "upheld",
          outcomeReasonCode: "decision_confirmed",
          contestedDecision: "refusal",
          reasonCode: "pirate",
        },
        "rejection_reason_unknown",
      ],
    ] as const) {
      const { transactional } = connectors({ badgeEmail: facts(override) });
      expect(
        await prepare(
          transactional,
          badgeLine("verification.dispute_outcome"),
          state(),
        ),
      ).toMatchObject({ kind: "fail", errorCode });
    }
    const { transactional } = connectors({
      badgeEmail: facts({ objectState: "withdrawn" }),
    });
    expect(
      await prepare(
        transactional,
        badgeLine("verification.dispute_outcome"),
        state(),
      ),
    ).toMatchObject({ kind: "skip", reason: "dispute_withdrawn" });
  });

  it("the proof to reconfirm names the network, and only while it is still required", async () => {
    await run(
      connectors({
        badgeEmail: facts({
          level: "account_verified",
          objectState: "proof_required",
        }),
      }).transactional,
      badgeLine("verification.reconfirm_required"),
    );
    expect(String(body().textContent)).toContain(
      "Vous avez modifié l'identifiant de votre compte Instagram. Pour conserver votre badge",
    );
    const { transactional } = connectors({
      badgeEmail: facts({
        level: "account_verified",
        objectState: "withdrawn",
      }),
    });
    expect(
      await prepare(
        transactional,
        badgeLine("verification.reconfirm_required"),
        state(),
      ),
    ).toMatchObject({ kind: "skip", reason: "review_changed" });
  });

  it("the verification opened by an agent tells a creator where the code is, a brand that anything needed is in its space; no code, no agent", async () => {
    await run(
      connectors({
        badgeEmail: facts({ objectState: "pending", preferredLanguage: "en" }),
      }).transactional,
      badgeLine("verification.agent_opened_notice"),
    );
    const creatorText = String(body().textContent);
    expect(creatorText).toContain(
      "Your INFLUX salesperson started the verification of your Instagram account. Find the code to publish in your INFLUX space.",
    );

    double.reset();
    await run(
      connectors({ badgeEmail: facts({ ...BRAND, objectState: "pending" }) })
        .transactional,
      badgeLine("verification.agent_opened_notice"),
    );
    expect(String(body().textContent)).toContain(
      "Si une action de votre part est nécessaire, elle est indiquée dans votre espace INFLUX.",
    );

    const { transactional } = connectors({
      badgeEmail: facts({ objectState: "cancelled" }),
    });
    expect(
      await prepare(
        transactional,
        badgeLine("verification.agent_opened_notice"),
        state(),
      ),
    ).toMatchObject({ kind: "skip", reason: "request_closed" });
  });

  it("an object that is not the account's, a level or a network outside the lists, or an account badge that expires: visible failures", async () => {
    expect(
      await prepare(
        connectors({ badgeEmail: null }).transactional,
        badgeLine("verification.expiry_reminder"),
        state(),
      ),
    ).toMatchObject({ kind: "fail", errorCode: "badge_notice_not_found" });
    for (const [override, errorCode] of [
      [{ level: "gold" }, "verification_level_unknown"],
      [{ networkCode: "myspace" }, "network_unknown"],
      [{ level: "account_verified" }, "badge_level_unexpected"],
    ] as const) {
      expect(
        await prepare(
          connectors({ badgeEmail: facts(override) }).transactional,
          badgeLine("verification.expiry_reminder"),
          state(),
        ),
      ).toMatchObject({ kind: "fail", errorCode });
    }
  });

  it("a message of the agent that looks like a link is refused by its name, never sent (RG158)", async () => {
    const { transactional } = connectors({
      badgeEmail: facts({
        objectState: "revoked",
        reasonCode: "terms_breach",
        memberMessage: "Voir https://example.test/regles pour les détails.",
      }),
    });
    const prepared = await prepare(
      transactional,
      badgeLine("verification.revoked_notice"),
      state(),
    );
    expect(prepared.kind).toBe("mapped");
    if (prepared.kind === "mapped") {
      expect(prepared.description.rejectedAttributeNames).not.toEqual([]);
    }
    expect(double.delivered).toHaveLength(0);
  });
});
