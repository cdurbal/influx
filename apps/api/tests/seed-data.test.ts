import { beforeEach, describe, expect, it } from "vitest";
import { MockStore } from "../src/mocks/mock-store";
import {
  SEED_ACCOUNTS,
  SEED_BRAND_PROFILES,
  SEED_CAMPAIGNS,
  SEED_CREATOR_PROFILES,
  SEED_IDS,
  SEED_VERIFICATION_REQUESTS,
} from "../src/mocks/seed-data";

describe("Seed Data & Default Mock Population", () => {
  let store: MockStore;

  beforeEach(() => {
    store = MockStore.getInstance();
    store.reset(); // Reset to default seed
  });

  it("populates all 7 seed accounts with appropriate roles", () => {
    expect(store.accounts.size).toBe(SEED_ACCOUNTS.length);
    expect(store.accounts.size).toBe(7);

    // Advertisers
    const maisonSolene = store.getAccountByEmail("contact@maisonsolene.fr");
    expect(maisonSolene).toBeDefined();
    expect(maisonSolene?.role).toBe("advertiser");
    expect(maisonSolene?.ownerAgentId).toBe(SEED_IDS.AGENT_1);

    const techgear = store.getAccountByEmail("partenariats@techgear.fr");
    expect(techgear).toBeDefined();
    expect(techgear?.role).toBe("advertiser");

    // Creators
    const lucas = store.getAccountByEmail("lucas@lucastech.fr");
    expect(lucas).toBeDefined();
    expect(lucas?.role).toBe("creator");

    const sophie = store.getAccountByEmail("sophie@lifestyle-mode.com");
    expect(sophie).toBeDefined();
    expect(sophie?.role).toBe("creator");

    const maxime = store.getAccountByEmail("maxime@outdoor-travel.com");
    expect(maxime).toBeDefined();
    expect(maxime?.role).toBe("creator");

    // Commercial & Admin
    const alexandre = store.getAccountByEmail("alexandre@influx.io");
    expect(alexandre).toBeDefined();
    expect(alexandre?.role).toBe("agent");

    const sarah = store.getAccountByEmail("sarah.admin@influx.io");
    expect(sarah).toBeDefined();
    expect(sarah?.role).toBe("admin");
  });

  it("populates brand profiles with correct business information", () => {
    expect(store.brandProfiles.size).toBe(SEED_BRAND_PROFILES.length);

    const soleneProfile = store.brandProfiles.get(SEED_IDS.ADVERTISER_1);
    expect(soleneProfile).toBeDefined();
    expect(soleneProfile?.companyName).toBe("Maison Solène");
    expect(soleneProfile?.sector).toBe("Cosmétiques & Beauté Bio");
    expect(soleneProfile?.currency).toBe("EUR");
  });

  it("populates creator profiles with anonymous layers and badge statuses", () => {
    expect(store.creatorProfiles.size).toBe(SEED_CREATOR_PROFILES.length);

    // Lucas Tech: verified badge Level 1
    const lucasProfile = store.creatorProfiles.get(SEED_IDS.CREATOR_1);
    expect(lucasProfile).toBeDefined();
    expect(lucasProfile?.anonymousTitle).toBe("Créateur High-Tech & Hardware");
    expect(lucasProfile?.audienceBand).toBe("50k-100k");
    const lucasBadge = lucasProfile?.badge as {
      level: number;
      name: string;
    } | null;
    expect(lucasBadge).toBeDefined();
    expect(lucasBadge?.level).toBe(1);

    // Sophie Mode: unverified, has pending verification request
    const sophieProfile = store.creatorProfiles.get(SEED_IDS.CREATOR_2);
    expect(sophieProfile).toBeDefined();
    expect(sophieProfile?.badge).toBeNull();
    expect(store.verificationRequests.size).toBe(
      SEED_VERIFICATION_REQUESTS.length,
    );
    const sophieReq = store.verificationRequests.get("req-verif-1");
    expect(sophieReq).toBeDefined();
    expect(sophieReq?.creatorAccountId).toBe(SEED_IDS.CREATOR_2);

    // Maxime: verified badge Level 2
    const maximeProfile = store.creatorProfiles.get(SEED_IDS.CREATOR_3);
    expect(maximeProfile).toBeDefined();
    const maximeBadge = maximeProfile?.badge as {
      level: number;
      name: string;
    } | null;
    expect(maximeBadge?.level).toBe(2);
  });

  it("populates initial active campaigns", () => {
    expect(store.campaigns.size).toBe(SEED_CAMPAIGNS.length);

    const campaign1 = store.campaigns.get(SEED_IDS.CAMPAIGN_1);
    expect(campaign1).toBeDefined();
    expect(campaign1?.title).toBe("Lancement Sérum Éco-Bio Printemps");
    expect(["published", "publiee"]).toContain(campaign1?.status);
    expect(campaign1?.advertiserAccountId).toBe(SEED_IDS.ADVERTISER_1);
  });

  it("seeds terms acceptances and marketing consents for all accounts", () => {
    expect(store.termsAcceptances.size).toBe(SEED_ACCOUNTS.length);
    expect(store.consentEvents.size).toBe(SEED_ACCOUNTS.length);

    for (const acc of SEED_ACCOUNTS) {
      const hasAccepted = Array.from(store.termsAcceptances.values()).some(
        (t) => t.accountId === acc.id && t.hasNonCircumventionAcknowledged,
      );
      expect(hasAccepted).toBe(true);
    }
  });
});
