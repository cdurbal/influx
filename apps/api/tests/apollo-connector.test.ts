// The Apollo connector of the worker (J6, commit 5; src/domains/leads/connectors/apollo/) against
// the Apollo double of @influx/test-kit on the loopback (no test ever reaches Apollo): the
// qualification of 05 RG81 to RG84 on the settings of each consumption (CA42 to CA45, TM1.6), the
// create or update without a duplicate, no enriched field read back (RG85), the output check, the
// error classes of the skill apollo-lead-sync. The loop around the connector is tested in
// leads-drain, the real queue in tm1-apollo-connector.
import {
  startApolloDouble,
  type ApolloDouble,
} from "@influx/test-kit/apollo-double";
import {
  ENRICHED_FIELDS,
  TOO_MANY_REQUESTS,
  UNAUTHORIZED,
  UNPROCESSABLE,
} from "@influx/test-kit/apollo-exchanges";
import { valuesFoundIn } from "@influx/test-kit/logs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type {
  CallResult,
  Connector,
  Preparation,
} from "../src/domains/leads/connector.ts";
import {
  checkContactOutput,
  createApolloConnector,
  mapContact,
  type ApolloSubject,
} from "../src/domains/leads/connectors/apollo/index.ts";
import type {
  AttemptState,
  BrandProfileAttributes,
  ClaimedLine,
  SubjectAccount,
} from "../src/domains/leads/repository.ts";

const ACCOUNT = "7d3e9b14-2c58-4f0a-b6e1-93a4c5d8f207";
const EMAIL = "noor-v5m8@example.test";
const LEGAL_NAME = "Atelier Vandenbroucke";

/** The settings of 0103 with Belgium validated: the base of most cases. */
const SETTINGS: Record<string, unknown> = {
  apollo_scope: "annonceurs_et_createurs_pro",
  apollo_legal_basis: { default: "consentement_requis", by_country: {} },
  apollo_excluded_countries: [],
};

let double: ApolloDouble;
let logLines: string[];
let reads: string[];

function logger() {
  return {
    error: (object: object, message: string) => {
      logLines.push(`error ${message} ${JSON.stringify(object)}`);
    },
  };
}

function account(overrides: Partial<SubjectAccount> = {}): SubjectAccount {
  return {
    id: ACCOUNT,
    status: "active",
    role: "advertiser",
    declaredStatus: "business",
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
  settings: Record<string, unknown> = {},
): AttemptState {
  return {
    attempt: 1,
    account: account(overrides),
    settings: { ...SETTINGS, ...settings },
  };
}

function subject(overrides: Partial<ApolloSubject> = {}): ApolloSubject {
  return {
    email: EMAIL,
    company: LEGAL_NAME,
    prospectionOpposed: false,
    externalContactId: null,
    ...overrides,
  };
}

let nextLine = 1;

function line(eventType = "lead.created"): ClaimedLine {
  const id = String(nextLine++);
  const event = `1b2c3d4e-0000-4000-8000-${id.padStart(12, "0")}`;
  return {
    id,
    eventId: event,
    eventType,
    destination: "apollo_contact",
    subjectKey: `account:${ACCOUNT}`,
    priority: 100,
    payload: { event_id: event, account_id: ACCOUNT },
    idempotencyKey: `${eventType}:${event}`,
  };
}

type Setup = {
  apiKey?: string | null;
  subject?: ApolloSubject | null;
  /** The live brand profile read of a contact line (0212); none by default. */
  brandProfile?: BrandProfileAttributes | null;
  mapContact?: typeof mapContact;
  timeoutMs?: number;
};

function connector(setup: Setup = {}): Connector {
  return createApolloConnector(
    {
      apiKey: setup.apiKey === undefined ? "local-double-key" : setup.apiKey,
      baseUrl: double.baseUrl,
    },
    {
      logger: logger(),
      readSubject: (claimed) => {
        reads.push(claimed.id);
        return Promise.resolve(
          setup.subject === undefined ? subject() : setup.subject,
        );
      },
      readBrandProfile: (claimed) => {
        reads.push(`brand:${claimed.id}`);
        return Promise.resolve(
          setup.brandProfile === undefined ? null : setup.brandProfile,
        );
      },
      ...(setup.mapContact === undefined
        ? {}
        : { mapContact: setup.mapContact }),
      ...(setup.timeoutMs === undefined ? {} : { timeoutMs: setup.timeoutMs }),
    },
  );
}

async function run(
  apollo: Connector,
  attempt: AttemptState = state(),
  claimed: ClaimedLine = line(),
): Promise<CallResult> {
  const preparation = await apollo.prepare(claimed, attempt);
  if (preparation.kind !== "mapped") {
    throw new Error(`expected a mapped line, got ${preparation.kind}`);
  }
  return preparation.send();
}

function skipOf(preparation: Preparation): string {
  return preparation.kind === "skip" ? preparation.reason : preparation.kind;
}

beforeAll(async () => {
  double = await startApolloDouble();
});

afterAll(async () => {
  await double.close();
});

beforeEach(() => {
  double.reset();
  logLines = [];
  reads = [];
});

describe("create or update a contact, never a duplicate", () => {
  it("a qualified advertiser becomes a contact: its address, its company, the INFLUX context as labels, run_dedupe", async () => {
    const result = await run(connector());
    expect(result).toEqual({
      kind: "succeeded",
      providerContactId: "65f0c0ffee00000000000001",
    });
    const [request] = double.requests;
    expect(request?.method).toBe("POST");
    expect(request?.path).toBe("/api/v1/contacts");
    expect(request?.headers["x-api-key"]).toBe("local-double-key");
    expect(request?.body).toEqual({
      email: EMAIL,
      organization_name: LEGAL_NAME,
      label_names: [
        "influx",
        "influx_profile_advertiser",
        "influx_status_business",
        "influx_country_be",
        "influx_language_fr",
        "influx_scope_annonceurs_et_createurs_pro",
        "influx_basis_consentement_requis",
      ],
      run_dedupe: true,
    });
  });

  it("a business creator carries no company, never its pseudonym; an absent field is not sent", async () => {
    await run(
      connector({ subject: subject({ company: LEGAL_NAME }) }),
      state({ role: "creator", preferredLanguage: "de" }),
    );
    const body = double.requests[0]?.body as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual([
      "email",
      "label_names",
      "run_dedupe",
    ]);
    expect(body.label_names).toContain("influx_profile_creator");
    expect(body.label_names).toContain("influx_language_en");
    expect(double.requests[0]?.raw).not.toContain(LEGAL_NAME);
  });

  it("a known Apollo id is updated by that id, without run_dedupe", async () => {
    await run(connector());
    const [known] = [...double.contacts.keys()];
    const result = await run(
      connector({ subject: subject({ externalContactId: known ?? null }) }),
    );
    expect(result).toEqual({ kind: "succeeded", providerContactId: known });
    const update = double.requests[1];
    expect(update?.method).toBe("PUT");
    expect(update?.path).toBe(`/api/v1/contacts/${known}`);
    expect(update?.body).not.toHaveProperty("run_dedupe");
    expect(double.contacts.size).toBe(1);
  });

  it("the same lead twice without a known id: run_dedupe gives back the same contact", async () => {
    const first = await run(connector());
    const second = await run(connector());
    expect(second).toEqual(first);
    expect(double.contacts.size).toBe(1);
  });

  it("an id Apollo no longer knows falls back to a create", async () => {
    const result = await run(
      connector({
        subject: subject({ externalContactId: "65f0c0ffee0000000000dead" }),
      }),
    );
    expect(result.kind).toBe("succeeded");
    expect(double.requests.map((request) => request.method)).toEqual([
      "PUT",
      "POST",
    ]);
  });

  it("a 422 on an update that is not a deletion fails, without a create", async () => {
    double.queue(UNPROCESSABLE.response);
    const result = await run(
      connector({
        subject: subject({ externalContactId: "65f0c0ffee0000000000a001" }),
      }),
    );
    expect(result).toEqual({
      kind: "failed",
      errorCode: "apollo.rejected",
      errorMessage: "Apollo answered 422",
    });
    expect(double.requests.map((request) => request.method)).toEqual(["PUT"]);
  });

  it("calls no other path: no sequence, no enrichment", async () => {
    await run(connector());
    expect(
      double.requests.every((request) =>
        request.path.startsWith("/api/v1/contacts"),
      ),
    ).toBe(true);
    expect(double.requests[0]?.raw).not.toMatch(/sequence|emailer_campaign/i);
  });

  it("describes the call by field names only, never a value (decision 3, D60)", async () => {
    const preparation = await connector().prepare(line(), state());
    expect(preparation.kind).toBe("mapped");
    if (preparation.kind !== "mapped") {
      return;
    }
    expect(preparation.description).toEqual({
      operation: "create_contact",
      templateCode: null,
      attributeNames: ["email", "label_names", "organization_name"],
      rejectedAttributeNames: [],
      missingSettings: [],
    });
    expect(preparation.recipientDomain).toBe("example.test");
    expect(
      valuesFoundIn(JSON.stringify(preparation.description), [
        EMAIL,
        LEGAL_NAME,
        ACCOUNT,
      ]),
    ).toEqual([]);
  });
});

describe("05 RG85: no enriched field is read back", () => {
  it("of an answer full of Apollo's own data, only the contact id comes back", async () => {
    const result = await run(connector());
    expect(Object.keys(result).sort()).toEqual(["kind", "providerContactId"]);
    expect(
      valuesFoundIn(JSON.stringify(result), [
        ENRICHED_FIELDS.title,
        ENRICHED_FIELDS.linkedin_url,
        ENRICHED_FIELDS.organization.name,
        ENRICHED_FIELDS.phone_numbers[0].raw_number,
      ]),
    ).toEqual([]);
  });

  it("an answer without a contact id is retried, never taken as a success", async () => {
    double.queue({ status: 200, body: { contact: { ...ENRICHED_FIELDS } } });
    const result = await run(connector());
    expect(result).toMatchObject({
      kind: "retry",
      errorCode: "apollo.no_contact_id",
    });
  });
});

describe("05 RG81 to RG84: the qualification, before any call", () => {
  it("CA42: an individual creator under annonceurs_et_createurs_pro is out of scope, nothing read, nothing sent", async () => {
    const apollo = connector();
    const preparation = await apollo.prepare(
      line(),
      state({ role: "creator", declaredStatus: "individual" }),
    );
    expect(skipOf(preparation)).toBe("out_of_apollo_scope_individual");
    expect(reads).toEqual([]);
    expect(double.requests).toEqual([]);
  });

  it("TM1.6, CA43: the scope switch acts on the next consumption, without a restart", async () => {
    const apollo = connector();
    const creator = {
      role: "creator" as const,
      declaredStatus: "individual" as const,
    };
    expect(skipOf(await apollo.prepare(line(), state(creator)))).toBe(
      "out_of_apollo_scope_individual",
    );
    expect(
      (
        await apollo.prepare(
          line(),
          state(creator, { apollo_scope: "tous_les_inscrits" }),
        )
      ).kind,
    ).toBe("mapped");
    expect(
      skipOf(
        await apollo.prepare(
          line(),
          state(
            { role: "creator", declaredStatus: "business" },
            { apollo_scope: "annonceurs_seuls" },
          ),
        ),
      ),
    ).toBe("out_of_apollo_scope");
    expect(
      (
        await apollo.prepare(
          line(),
          state({ role: "creator", declaredStatus: "business" }),
        )
      ).kind,
    ).toBe("mapped");
  });

  // 0141 (D33 and RG84 overridden by the founder, 2026-10-19): a block-list, empty by default.
  it("RG84: an empty list of excluded countries excludes none", async () => {
    const preparation = await connector().prepare(
      line(),
      state({ countryCode: "CA" }, { apollo_excluded_countries: [] }),
    );
    expect(preparation.kind).toBe("mapped");
  });

  it("RG84: an excluded country is skipped country_excluded, before any read or call", async () => {
    const apollo = connector();
    const preparation = await apollo.prepare(
      line(),
      state({ countryCode: "CA" }, { apollo_excluded_countries: ["CA"] }),
    );
    expect(skipOf(preparation)).toBe("country_excluded");
    expect(reads).toEqual([]);
    expect(double.requests).toEqual([]);
  });

  it("CA45: consentement_requis refuses an advertiser without consent; interet_legitime_avec_opposition takes it, no code change", async () => {
    const apollo = connector();
    const refused = { commercialProspectionConsent: false };
    expect(skipOf(await apollo.prepare(line(), state(refused)))).toBe(
      "no_consent",
    );
    expect(reads).toEqual([]);
    const preparation = await apollo.prepare(
      line(),
      state(refused, {
        apollo_legal_basis: {
          default: "interet_legitime_avec_opposition",
          by_country: {},
        },
      }),
    );
    expect(preparation.kind).toBe("mapped");
  });

  it("RG83: the legal basis of the country overrides the default", async () => {
    const preparation = await connector().prepare(
      line(),
      state(
        { commercialProspectionConsent: false },
        {
          apollo_legal_basis: {
            default: "interet_legitime_avec_opposition",
            by_country: { BE: "consentement_requis" },
          },
        },
      ),
    );
    expect(skipOf(preparation)).toBe("no_consent");
  });

  it("RG83: under interet_legitime_avec_opposition, an opposition excludes for good", async () => {
    const preparation = await connector({
      subject: subject({ prospectionOpposed: true }),
    }).prepare(
      line(),
      state(
        { commercialProspectionConsent: true },
        {
          apollo_legal_basis: {
            default: "interet_legitime_avec_opposition",
            by_country: {},
          },
        },
      ),
    );
    expect(skipOf(preparation)).toBe("prospection_opposed");
    expect(double.requests).toEqual([]);
  });

  it("RG82: an unverified address, an advertiser without a company name are skipped with their reason", async () => {
    expect(
      skipOf(
        await connector().prepare(line(), state({ emailVerified: false })),
      ),
    ).toBe("email_not_verified");
    expect(
      skipOf(
        await connector({ subject: subject({ company: null }) }).prepare(
          line(),
          state(),
        ),
      ),
    ).toBe("company_not_identified");
    expect(
      skipOf(
        await connector({ subject: subject({ company: "  " }) }).prepare(
          line(),
          state(),
        ),
      ),
    ).toBe("company_not_identified");
  });

  it("an account gone or not active is skipped; a subject gone at the read is skipped", async () => {
    const apollo = connector();
    expect(
      skipOf(await apollo.prepare(line(), { ...state(), account: null })),
    ).toBe("account_absent");
    expect(
      skipOf(await apollo.prepare(line(), state({ status: "suspended" }))),
    ).toBe("account_not_active");
    expect(
      skipOf(await connector({ subject: null }).prepare(line(), state())),
    ).toBe("account_absent");
  });

  it("05 RG160, RG164 (b): a setting that does not read fails the line without a mapping, logged by its key only", async () => {
    const preparation = await connector().prepare(
      line(),
      state({}, { apollo_scope: "everyone" }),
    );
    expect(preparation).toEqual({
      kind: "fail",
      errorCode: "apollo_settings_invalid",
    });
    expect(logLines).toEqual([
      'error leads.settings.invalid {"key":"apollo","destination":"apollo_contact"}',
    ]);
  });

  it("05 RG164 (a): an account gone or not active stays a skip, whatever the settings", async () => {
    expect(
      skipOf(
        await connector().prepare(
          line(),
          state({ status: "suspended" }, { apollo_scope: "everyone" }),
        ),
      ),
    ).toBe("account_not_active");
  });
});

describe("the output check refuses, it never cleans", () => {
  it("a field outside the mapping is refused by name, and the call never leaves", async () => {
    const apollo = connector({
      mapContact: (...args) => ({
        ...mapContact(...args),
        title: "Founder",
      }),
    });
    const preparation = await apollo.prepare(line(), state());
    expect(preparation.kind).toBe("mapped");
    if (preparation.kind !== "mapped") {
      return;
    }
    expect(preparation.description.rejectedAttributeNames).toEqual(["title"]);
    expect(await preparation.send()).toEqual({
      kind: "failed",
      errorCode: "output_check_rejected",
    });
    expect(double.requests).toEqual([]);
  });

  it("checks the fields and the label vocabulary against closed lists", () => {
    expect(
      checkContactOutput({
        email: EMAIL,
        label_names: ["influx", "influx_country_be"],
        run_dedupe: true,
      }),
    ).toEqual([]);
    expect(
      checkContactOutput({
        email: EMAIL,
        label_names: ["influx", `influx_${LEGAL_NAME}`],
        emailer_campaign_id: "x",
      }),
    ).toEqual(["emailer_campaign_id", "label_names"]);
  });
});

describe("the error classes of the skill apollo-lead-sync", () => {
  it("5xx, a transport failure or a time-out is transient", async () => {
    double.queue({ status: 503 }, { status: 200, destroy: true });
    expect(await run(connector())).toMatchObject({
      kind: "retry",
      errorCode: "apollo.unavailable",
    });
    expect(await run(connector())).toMatchObject({
      kind: "retry",
      errorCode: "apollo.unreachable",
    });
    double.setDefaultDelay(500);
    expect(await run(connector({ timeoutMs: 50 }))).toMatchObject({
      kind: "retry",
      errorCode: "apollo.unreachable",
    });
  });

  it("a 429 (rate or quota) pauses the category for Apollo's delay, no lead lost", async () => {
    double.queue(TOO_MANY_REQUESTS.response);
    expect(await run(connector())).toEqual({
      kind: "retry",
      errorCode: "apollo.rate_limited",
      errorMessage: "Apollo answered 429",
      retryAfterSeconds: 60,
      rateLimited: true,
    });
  });

  it("a refused key stops the destination for an hour, with an error line naming no key", async () => {
    double.queue(UNAUTHORIZED.response);
    expect(await run(connector())).toMatchObject({
      kind: "retry",
      errorCode: "apollo.unauthorized",
      retryAfterSeconds: 3_600,
      rateLimited: true,
    });
    expect(logLines).toEqual([
      'error leads.apollo.unauthorized {"destination":"apollo_contact","statusCode":401}',
    ]);
  });

  it("another 4xx is permanent: failed at once, the status in clear, never Apollo's message", async () => {
    double.queue(UNPROCESSABLE.response);
    const result = await run(connector());
    expect(result).toEqual({
      kind: "failed",
      errorCode: "apollo.rejected",
      errorMessage: "Apollo answered 422",
    });
  });
});

describe("02 §12.4 lock 1: APOLLO_API_KEY, the worker's only", () => {
  it("no key: no credentials, the drain skips without a call", () => {
    expect(connector({ apiKey: null }).hasCredentials).toBe(false);
    expect(connector().hasCredentials).toBe(true);
  });
});

describe("15 RG79, J8 commit 8: account.deleted is noted, never propagated to Apollo before the Lot 5", () => {
  it("skips erasure_not_propagated, before the account step, without any read or call", async () => {
    const deleted: ClaimedLine = {
      ...line(),
      eventType: "account.deleted",
      priority: 0,
    };
    for (const attempt of [state({ status: "deleted" }), state()]) {
      expect(skipOf(await connector().prepare(deleted, attempt))).toBe(
        "erasure_not_propagated",
      );
    }
    expect(reads).toEqual([]);
    expect(double.requests).toHaveLength(0);
  });
});

const PUBLISHED_BRAND: BrandProfileAttributes = {
  status: "published",
  completenessPercent: 85,
  primarySector: "food_beverages",
  companySizeBand: "11_50",
  websiteDomain: "atelier-vandenbroucke.example",
  mainTopic: "cooking",
  targetMarkets: ["BE", "FR"],
  everPublished: true,
};

describe("L2C commit 10, 06 RG78 to RG81, CA40 to CA43: profile.completed enriches the brand contact", () => {
  it("RG79: profile.completed rewrites the contact as lead.updated does: domain, sector and size in the closed vocabulary", async () => {
    const completed = line("profile.completed");
    expect(
      await run(
        connector({ brandProfile: PUBLISHED_BRAND }),
        state(),
        completed,
      ),
    ).toMatchObject({ kind: "succeeded" });
    expect(reads).toEqual([`${completed.id}`, `brand:${completed.id}`]);
    expect(double.requests[0]?.body).toEqual({
      email: EMAIL,
      organization_name: LEGAL_NAME,
      website_url: "https://atelier-vandenbroucke.example",
      label_names: [
        "influx",
        "influx_profile_advertiser",
        "influx_status_business",
        "influx_country_be",
        "influx_language_fr",
        "influx_scope_annonceurs_et_createurs_pro",
        "influx_basis_consentement_requis",
        "influx_sector_food_beverages",
        "influx_size_11_50",
      ],
      run_dedupe: true,
    });
  });

  it("RG81: a field the brand has not filled is not sent; a brand without a profile row carries the context only", async () => {
    await run(
      connector({
        brandProfile: {
          ...PUBLISHED_BRAND,
          primarySector: null,
          companySizeBand: null,
          websiteDomain: null,
        },
      }),
      state(),
      line("lead.updated"),
    );
    const sent = double.requests[0]?.body as Record<string, unknown>;
    expect(Object.keys(sent).sort()).toEqual(
      ["email", "label_names", "organization_name", "run_dedupe"].sort(),
    );
    expect(sent.label_names).toHaveLength(7);
    double.reset();
    await run(connector({ brandProfile: null }), state(), line("lead.updated"));
    expect(
      (double.requests[0]?.body as { label_names: string[] }).label_names,
    ).toHaveLength(7);
  });

  it("a creator never reads a brand profile and carries no website, sector nor size", async () => {
    await run(
      connector({ brandProfile: PUBLISHED_BRAND }),
      state({ role: "creator", declaredStatus: "business" }),
      line("lead.updated"),
    );
    expect(reads.filter((read) => read.startsWith("brand:"))).toEqual([]);
    const sent = double.requests[0]?.body as Record<string, unknown>;
    expect(sent.website_url).toBeUndefined();
    expect(JSON.stringify(sent)).not.toContain("influx_sector_");
  });

  it("RG83, CA41: without the consent the legal basis requires, profile.completed is skipped no_consent, nothing read of the profile", async () => {
    const claimed = line("profile.completed");
    expect(
      skipOf(
        await connector({ brandProfile: PUBLISHED_BRAND }).prepare(
          claimed,
          state({ commercialProspectionConsent: false }),
        ),
      ),
    ).toBe("no_consent");
    expect(reads).toEqual([]);
    expect(double.requests).toHaveLength(0);
  });

  it("RG80, CA42: the closed list refuses the legal name, the registration number, a note and the contact person", () => {
    for (const field of [
      "legal_name",
      "registration_number",
      "notes",
      "first_name",
      "last_name",
      "phone",
      "direct_phone",
      "typed_custom_fields",
    ]) {
      expect(
        checkContactOutput({
          email: EMAIL,
          label_names: ["influx"],
          [field]: "x",
        }),
      ).toEqual([field]);
    }
  });

  it("the website is an https domain only: a path, a query, credentials, a port or another scheme is refused", () => {
    const body = (website: string) => ({
      email: EMAIL,
      label_names: ["influx"],
      website_url: website,
    });
    expect(checkContactOutput(body("https://maison-verbeke.example"))).toEqual(
      [],
    );
    for (const website of [
      "http://maison-verbeke.example",
      "https://maison-verbeke.example/contact",
      "https://maison-verbeke.example?ref=1",
      "https://user@maison-verbeke.example",
      "https://maison-verbeke.example:8443",
      "https://",
      "maison-verbeke.example",
    ]) {
      expect(checkContactOutput(body(website))).toEqual(["website_url"]);
    }
  });

  it("the labels of sector and size stay in the closed vocabulary: a label outside it refuses label_names as a whole", () => {
    const labels = (names: string[]) => ({ email: EMAIL, label_names: names });
    expect(
      checkContactOutput(
        labels(["influx_sector_food_beverages", "influx_size_1001_plus"]),
      ),
    ).toEqual([]);
    for (const label of [
      "influx_sector_Food",
      "influx_sector_",
      "influx_size_12",
      "influx_size_",
      "influx_budget_1000",
    ]) {
      expect(checkContactOutput(labels([label]))).toEqual(["label_names"]);
    }
  });

  it("CA43: Apollo unavailable on profile.completed is a retry of the line, never an error that reaches the publication", async () => {
    double.queue({ status: 503 });
    expect(
      await run(
        connector({ brandProfile: PUBLISHED_BRAND }),
        state(),
        line("profile.completed"),
      ),
    ).toMatchObject({ kind: "retry" });
  });
});
