// L3C commit 06 (09 RG103 to RG107, CA69 to CA71; jalons/l3c/modele.md §8; fiche invariant 8): what a
// published campaign sends to the contact connectors, against the Brevo and Apollo doubles on the
// loopback (no test ever reaches either). Brevo: the attributes of RG104, codes, dates and a counter
// (never a band, a budget, a text nor a note: D78, RG106), a field absent sent empty (RG107), the
// funnel stage campaign_published, campaign.published skipped no_consent without marketing consent and
// never counted as a failure (CA71). Apollo: « a publié une campagne » and its date, as two labels,
// nothing else (RG105, CA70). CA70 is held on the RAW body that leaves, not on the mapping. The real
// queue and the base's own reads are in db-tests/tm1-*-connector.test.ts and leads-campaign-reads.
import {
  startApolloDouble,
  type ApolloDouble,
} from "@influx/test-kit/apollo-double";
import {
  startBrevoDouble,
  type BrevoDouble,
} from "@influx/test-kit/brevo-double";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { CallResult, Connector } from "../src/domains/leads/connector.ts";
import {
  checkContactOutput as checkApolloOutput,
  createApolloConnector,
  mapContact as mapApolloContact,
} from "../src/domains/leads/connectors/apollo/index.ts";
import {
  BREVO_CAMPAIGN_ATTRIBUTES,
  BREVO_CONTACT_ATTRIBUTES,
  checkContactOutput as checkBrevoOutput,
  createBrevoConnectors,
  mapContact as mapBrevoContact,
} from "../src/domains/leads/connectors/brevo/index.ts";
import type {
  AttemptState,
  BrevoSubject,
  CampaignAttributes,
  ClaimedLine,
  SubjectAccount,
} from "../src/domains/leads/repository.ts";

const ACCOUNT = "4f6c2a51-93d7-4b8e-a1c0-7e2d9b3f5a68";
const EMAIL = "lena-k7q2@example.test";
const COMPANY = "Maison Verbeke-Lambrecht";
const ADVERTISERS_LIST = 2;
const CREATORS_LIST = 3;

const BREVO_SETTINGS: Record<string, unknown> = {
  brevo_list_ids: { advertisers: ADVERTISERS_LIST, creators: CREATORS_LIST },
  brevo_template_ids: {},
};
const APOLLO_SETTINGS: Record<string, unknown> = {
  apollo_scope: "annonceurs_et_createurs_pro",
  apollo_legal_basis: { default: "consentement_requis", by_country: {} },
  apollo_excluded_countries: [],
};

/** Two campaigns ever published; the last one: food, euro, France then Belgium, TikTok then Instagram. */
const PUBLISHED: CampaignAttributes = {
  hasPublished: true,
  campaignsPublished: 2,
  lastPublishedAt: "2026-11-14T08:15:00.000Z",
  lastSector: "food_beverages",
  lastCurrency: "EUR",
  lastCountries: ["FR", "BE"],
  lastNetworks: ["tiktok", "instagram"],
};

/** A brand that never published: the base serves a row with a counter at 0 and nothing else. */
const NEVER_PUBLISHED: CampaignAttributes = {
  hasPublished: false,
  campaignsPublished: 0,
  lastPublishedAt: null,
  lastSector: null,
  lastCurrency: null,
  lastCountries: null,
  lastNetworks: null,
};

/** What the base serves on an Apollo line: the boolean and the date only (RG105, CA70). */
const PUBLISHED_FOR_APOLLO: CampaignAttributes = {
  ...NEVER_PUBLISHED,
  hasPublished: true,
  campaignsPublished: null,
  lastPublishedAt: "2026-11-14T08:15:00.000Z",
};

let brevo: BrevoDouble;
let apollo: ApolloDouble;
let reads: string[];

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
  settings: Record<string, unknown>,
): AttemptState {
  return { attempt: 1, account: account(overrides), settings };
}

let nextLine = 1;

function line(
  destination: "brevo_contact" | "apollo_contact",
  eventType = "campaign.published",
): ClaimedLine {
  const id = String(nextLine++);
  const event = `0a1b2c3d-0000-4000-8000-${id.padStart(12, "0")}`;
  return {
    id,
    eventId: event,
    eventType,
    destination,
    subjectKey: `account:${ACCOUNT}`,
    priority: 100,
    payload: { event_id: event, account_id: ACCOUNT, campaign_id: ACCOUNT },
    idempotencyKey: `${eventType}:${event}`,
  };
}

function brevoSubject(): BrevoSubject {
  return {
    email: EMAIL,
    signedUpAt: "2026-10-09T08:15:00.000Z",
    company: COMPANY,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    referrerDomain: null,
    heardFrom: null,
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
  };
}

/** The reader of the campaigns: what it serves, whatever extra a hostile base might add. */
type Served =
  CampaignAttributes | (CampaignAttributes & Record<string, unknown>);

function brevoContact(campaigns: Served | null): Connector {
  return createBrevoConnectors(
    {
      mode: "redirect",
      testRecipients: [EMAIL],
      apiKey: "local-double-key",
      baseUrl: brevo.baseUrl,
      senderTransactional: "no-reply@tx.influx.example",
      suppressionListId: null,
    },
    {
      logger: { error: () => {} },
      readSubject: (claimed) => {
        reads.push(`subject:${claimed.id}`);
        return Promise.resolve(brevoSubject());
      },
      readErasureSubject: () => Promise.resolve(null),
      readErasureNotificationSubject: () => Promise.resolve(null),
      readProfileDecision: () => Promise.resolve(null),
      readCreatorProfileDecision: () => Promise.resolve(null),
      readPortfolioDecision: () => Promise.resolve(null),
      readCreatorProfile: () => Promise.resolve(null),
      readBrandProfile: () => Promise.resolve(null),
      readVerificationEmail: () => Promise.resolve(null),
      readBadgeEmail: () => Promise.resolve(null),
      readVerifiedBadge: () => Promise.resolve(null),
      readCampaignDecision: () => Promise.resolve(null),
      readCampaignAttributes: (claimed) => {
        reads.push(`campaigns:${claimed.id}`);
        return Promise.resolve(campaigns);
      },
    },
  ).contact;
}

function apolloContact(campaigns: Served | null): Connector {
  return createApolloConnector(
    { apiKey: "local-double-key", baseUrl: apollo.baseUrl },
    {
      logger: { error: () => {} },
      readSubject: (claimed) => {
        reads.push(`subject:${claimed.id}`);
        return Promise.resolve({
          email: EMAIL,
          company: COMPANY,
          prospectionOpposed: false,
          externalContactId: null,
        });
      },
      readBrandProfile: () => Promise.resolve(null),
      readCampaignAttributes: (claimed) => {
        reads.push(`campaigns:${claimed.id}`);
        return Promise.resolve(campaigns);
      },
    },
  );
}

async function run(
  connector: Connector,
  claimed: ClaimedLine,
  attempt: AttemptState,
): Promise<CallResult> {
  const preparation = await connector.prepare(claimed, attempt);
  if (preparation.kind !== "mapped") {
    throw new Error(`expected a mapped line, got ${preparation.kind}`);
  }
  return preparation.send();
}

beforeAll(async () => {
  brevo = await startBrevoDouble();
  apollo = await startApolloDouble();
});

afterAll(async () => {
  await brevo.close();
  await apollo.close();
});

beforeEach(() => {
  brevo.reset();
  apollo.reset();
  reads = [];
});

describe("09 RG104, CA69: the contact of a brand carries the attributes of its campaigns", () => {
  it("campaign.published rewrites the Brevo contact with codes, dates and a counter, and the funnel stage campaign_published", async () => {
    const claimed = line("brevo_contact");
    const result = await run(
      brevoContact(PUBLISHED),
      claimed,
      state({}, BREVO_SETTINGS),
    );
    expect(result).toEqual({ kind: "succeeded", providerContactId: "1" });
    const stored = brevo.contacts.get(EMAIL);
    expect(stored?.listIds).toEqual([ADVERTISERS_LIST]);
    expect(stored?.attributes).toMatchObject({
      FUNNEL_STAGE: "campaign_published",
      CAMPAIGNS_PUBLISHED: 2,
      LAST_CAMPAIGN_AT: "2026-11-14T08:15:00.000Z",
      LAST_CAMPAIGN_SECTOR: "food_beverages",
      LAST_CAMPAIGN_CURRENCY: "EUR",
      LAST_CAMPAIGN_COUNTRIES: "FR,BE",
      LAST_CAMPAIGN_NETWORKS: "tiktok,instagram",
    });
    // the contact is the whole mapping of 16 §M4 plus the six attributes of the campaigns, no more
    expect(Object.keys(stored?.attributes ?? {}).sort()).toEqual(
      [...BREVO_CONTACT_ATTRIBUTES, ...BREVO_CAMPAIGN_ATTRIBUTES].sort(),
    );
    // read once, for this line, after the subject
    expect(reads).toEqual([`subject:${claimed.id}`, `campaigns:${claimed.id}`]);
  });

  it("RG107: a brand that never published sends the counter at 0 and every other campaign attribute empty, and no campaign stage", async () => {
    await run(
      brevoContact(NEVER_PUBLISHED),
      line("brevo_contact", "lead.updated"),
      state({}, BREVO_SETTINGS),
    );
    const attributes = brevo.contacts.get(EMAIL)?.attributes;
    expect(attributes).toMatchObject({
      FUNNEL_STAGE: "registered",
      CAMPAIGNS_PUBLISHED: 0,
      LAST_CAMPAIGN_AT: "",
      LAST_CAMPAIGN_SECTOR: "",
      LAST_CAMPAIGN_CURRENCY: "",
      LAST_CAMPAIGN_COUNTRIES: "",
      LAST_CAMPAIGN_NETWORKS: "",
    });
  });

  it("a last campaign that names no country nor network sends them empty (RG107), never a guess", async () => {
    await run(
      brevoContact({ ...PUBLISHED, lastCountries: [], lastNetworks: [] }),
      line("brevo_contact"),
      state({}, BREVO_SETTINGS),
    );
    expect(brevo.contacts.get(EMAIL)?.attributes).toMatchObject({
      CAMPAIGNS_PUBLISHED: 2,
      LAST_CAMPAIGN_COUNTRIES: "",
      LAST_CAMPAIGN_NETWORKS: "",
    });
  });

  it("every rewrite of the contact reads the campaigns again: a replayed lead.created keeps them", async () => {
    await run(
      brevoContact(PUBLISHED),
      line("brevo_contact", "lead.created"),
      state({}, BREVO_SETTINGS),
    );
    expect(brevo.contacts.get(EMAIL)?.attributes).toMatchObject({
      FUNNEL_STAGE: "campaign_published",
      CAMPAIGNS_PUBLISHED: 2,
    });
  });

  it("a creator, or an account the base serves no campaign of, sends no campaign attribute at all, and a creator's campaigns are not even read", async () => {
    const creator = line("brevo_contact");
    await run(
      brevoContact(PUBLISHED),
      creator,
      state({ role: "creator", declaredStatus: "individual" }, BREVO_SETTINGS),
    );
    expect(reads).toEqual([`subject:${creator.id}`]);
    brevo.reset();
    await run(
      brevoContact(null),
      line("brevo_contact"),
      state({}, BREVO_SETTINGS),
    );
    for (const stored of brevo.contacts.values()) {
      expect(Object.keys(stored.attributes).sort()).toEqual(
        [...BREVO_CONTACT_ATTRIBUTES].sort(),
      );
    }
  });

  it("CA70, on the raw body: nothing of a campaign leaves but the six attributes, whatever else the read carried", async () => {
    const hostile = {
      ...PUBLISHED,
      title: "SENTINEL-TITLE",
      publicSummary: "SENTINEL-SUMMARY",
      totalBudgetMinor: 987654321,
      budgetBand: "SENTINEL-BAND",
      internalReference: "SENTINEL-REF",
      internalNote: "SENTINEL-NOTE",
      rejectionReason: "SENTINEL-REASON",
      declaration: "SENTINEL-DECLARATION",
    };
    await run(
      brevoContact(hostile),
      line("brevo_contact"),
      state({}, BREVO_SETTINGS),
    );
    const [request] = brevo.requests;
    expect(request?.raw).not.toMatch(/SENTINEL|987654321/);
    const body = request?.body as {
      attributes: Record<string, unknown>;
      listIds: unknown;
      email: unknown;
      updateEnabled: unknown;
    };
    expect(Object.keys(body).sort()).toEqual([
      "attributes",
      "email",
      "listIds",
      "updateEnabled",
    ]);
    const campaignValues = BREVO_CAMPAIGN_ATTRIBUTES.map(
      (name) => body.attributes[name],
    );
    // a counter, a date, codes of closed lists: no text with a space, no amount
    for (const value of campaignValues) {
      expect(
        typeof value === "number" || /^[A-Za-z0-9:.,_-]*$/.test(String(value)),
      ).toBe(true);
    }
    // every attribute naming a campaign is one of the six, none of a budget, a band or a text
    expect(
      Object.keys(body.attributes)
        .filter((name) => /^(CAMPAIGNS_|LAST_CAMPAIGN)/.test(name))
        .sort(),
    ).toEqual([...BREVO_CAMPAIGN_ATTRIBUTES].sort());
  });
});

describe("09 CA71: without marketing consent no marketing contact is updated, and the line is not a failure", () => {
  it("campaign.published of a brand without consent is skipped no_consent, nothing read, nothing sent", async () => {
    const claimed = line("brevo_contact");
    const preparation = await brevoContact(PUBLISHED).prepare(
      claimed,
      state({ marketingEmailConsent: false }, BREVO_SETTINGS),
    );
    expect(preparation).toEqual({ kind: "skip", reason: "no_consent" });
    expect(reads).toEqual([]);
    expect(brevo.requests).toHaveLength(0);
  });

  it("a consent withdrawn since the first publication is an unsubscription (operation 2), as for any other event", async () => {
    const claimed = line("brevo_contact", "lead.updated");
    const preparation = await brevoContact(PUBLISHED).prepare(
      claimed,
      state({ marketingEmailConsent: false }, BREVO_SETTINGS),
    );
    expect(preparation).toMatchObject({
      kind: "mapped",
      description: { operation: "unsubscribe_contact" },
    });
    expect(reads.filter((read) => read.startsWith("campaigns:"))).toEqual([]);
  });
});

describe("09 RG106: the output check of the Brevo contact", () => {
  it("accepts the six attributes of the campaigns with the closed list, and refuses any other name", () => {
    const attributes = Object.fromEntries(
      BREVO_CAMPAIGN_ATTRIBUTES.map((name) => [name, ""]),
    );
    expect(
      checkBrevoOutput({
        email: EMAIL,
        attributes,
        listIds: [],
        updateEnabled: true,
      }),
    ).toEqual([]);
    for (const name of [
      "LAST_CAMPAIGN_TITLE",
      "LAST_CAMPAIGN_BAND",
      "CAMPAIGN_BUDGET",
      "LAST_CAMPAIGN_REFERENCE",
    ]) {
      expect(
        checkBrevoOutput({ email: EMAIL, attributes: { [name]: "x" } }),
      ).toEqual([name]);
    }
  });

  it("the mapping puts the funnel stage of a brand with a published campaign ahead of profile_completed", () => {
    const body = mapBrevoContact(
      account(),
      brevoSubject(),
      ADVERTISERS_LIST,
      {
        status: "published",
        completenessPercent: 85,
        primarySector: "food_beverages",
        companySizeBand: "11_50",
        websiteDomain: null,
        mainTopic: null,
        targetMarkets: [],
        everPublished: true,
      },
      null,
      null,
      PUBLISHED,
    );
    expect(body.attributes.FUNNEL_STAGE).toBe("campaign_published");
    const without = mapBrevoContact(
      account(),
      brevoSubject(),
      ADVERTISERS_LIST,
      {
        status: "published",
        completenessPercent: 85,
        primarySector: null,
        companySizeBand: null,
        websiteDomain: null,
        mainTopic: null,
        targetMarkets: [],
        everPublished: true,
      },
      null,
      null,
      NEVER_PUBLISHED,
    );
    expect(without.attributes.FUNNEL_STAGE).toBe("profile_completed");
  });
});

describe("09 RG105, CA70: Apollo receives « a publié une campagne » and its date, nothing else", () => {
  it("a brand that published carries two labels more, and the body keeps its fields", async () => {
    const claimed = line("apollo_contact");
    const result = await run(
      apolloContact(PUBLISHED_FOR_APOLLO),
      claimed,
      state({}, APOLLO_SETTINGS),
    );
    expect(result.kind).toBe("succeeded");
    const [request] = apollo.requests;
    const body = request?.body as { label_names: string[] } & Record<
      string,
      unknown
    >;
    expect(body.label_names).toEqual([
      "influx",
      "influx_profile_advertiser",
      "influx_status_business",
      "influx_country_be",
      "influx_language_fr",
      "influx_scope_annonceurs_et_createurs_pro",
      "influx_basis_consentement_requis",
      "influx_campaign_published",
      "influx_campaign_published_on_2026_11_14",
    ]);
    expect(Object.keys(body).sort()).toEqual([
      "email",
      "label_names",
      "organization_name",
      "run_dedupe",
    ]);
    expect(reads).toEqual([`subject:${claimed.id}`, `campaigns:${claimed.id}`]);
  });

  it("CA70, on the raw body: no sector, currency, country, network, counter, text nor budget, whatever the read carried", async () => {
    const hostile = {
      ...PUBLISHED,
      title: "SENTINEL-TITLE",
      totalBudgetMinor: 987654321,
      budgetBand: "SENTINEL-BAND",
      internalNote: "SENTINEL-NOTE",
    };
    await run(
      apolloContact(hostile),
      line("apollo_contact"),
      state({}, APOLLO_SETTINGS),
    );
    const raw = apollo.requests[0]?.raw ?? "";
    expect(raw).not.toMatch(/SENTINEL|987654321/);
    // only the boolean and the date: not what Brevo alone receives
    for (const brevoOnly of [
      "food_beverages",
      "EUR",
      "tiktok",
      "instagram",
      "CAMPAIGNS_PUBLISHED",
    ]) {
      expect(raw).not.toContain(brevoOnly);
    }
    expect(raw).not.toMatch(/"FR,BE"|\bFR\b.*\bBE\b/);
    expect(raw).toContain("influx_campaign_published_on_2026_11_14");
  });

  it("a brand that never published, a creator, and an account without a brand profile carry no campaign label", async () => {
    for (const [served, overrides] of [
      [NEVER_PUBLISHED, {}],
      [null, {}],
      [PUBLISHED_FOR_APOLLO, { role: "creator", declaredStatus: "business" }],
    ] as const) {
      apollo.reset();
      reads = [];
      const claimed = line("apollo_contact");
      await run(
        apolloContact(served),
        claimed,
        state(overrides, APOLLO_SETTINGS),
      );
      const raw = apollo.requests[0]?.raw ?? "";
      expect(raw).not.toContain("influx_campaign_published");
      if (overrides.role === "creator") {
        // the campaigns of a creator are not read: it has none
        expect(reads).toEqual([`subject:${claimed.id}`]);
      }
    }
  });

  it("the label vocabulary admits the two labels and refuses a campaign label that would carry more", () => {
    const body = mapApolloContact(
      account(),
      EMAIL,
      COMPANY,
      {
        scope: "annonceurs_et_createurs_pro",
        legalBasis: "consentement_requis",
      },
      null,
      PUBLISHED_FOR_APOLLO,
    );
    expect(checkApolloOutput(body)).toEqual([]);
    for (const label of [
      "influx_campaign_published_food_beverages",
      "influx_campaign_published_on_14_11_2026",
      "influx_campaign_published_on_2026-11-14",
      "influx_campaign_count_2",
      "influx_campaign_budget_band",
    ]) {
      expect(
        checkApolloOutput({
          ...body,
          label_names: [...body.label_names, label],
        }),
      ).toEqual(["label_names"]);
    }
  });

  it("a creator never gets the labels, even from a read that would serve them", () => {
    const body = mapApolloContact(
      account({ role: "creator" }),
      EMAIL,
      null,
      { scope: "tous_les_inscrits", legalBasis: "consentement_requis" },
      null,
      PUBLISHED_FOR_APOLLO,
    );
    expect(body.label_names.join(" ")).not.toContain("campaign");
  });
});
