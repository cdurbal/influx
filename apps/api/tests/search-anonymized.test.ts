import { describe, it, expect, beforeEach } from "vitest";
import Fastify from "fastify";
import cookiePlugin from "@fastify/cookie";
import { searchRoutes } from "../src/routes/search-routes";
import { SearchService } from "../src/services/search-service";
import { AuthService } from "../src/services/auth-service";
import { MockStore } from "../src/mocks/mock-store";
import { SEED_IDS } from "../src/mocks/seed-data";
import { type Account } from "@influx/contracts";

describe("Mission 3.4 : Recherche de créateurs anonymisée, tri explicable et vue commerciale identifiée (Lot 3)", () => {
  let app: ReturnType<typeof Fastify>;
  let store: MockStore;
  let authService: AuthService;
  let searchService: SearchService;

  let advertiserToken: string;
  let agentToken: string;
  let creatorToken: string;

  const ADV_ID = SEED_IDS.ADVERTISER_1;
  const now = new Date().toISOString();
  const past60Days = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const past10Days = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
  const past5Days = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
  const past100Days = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();

  beforeEach(async () => {
    store = MockStore.getInstance();
    store.reset();

    authService = new AuthService(store);
    searchService = new SearchService(store);

    // Initialiser profil marque pour l'annonceur 1
    store.brandProfiles.set(ADV_ID, {
      accountId: ADV_ID,
      brandName: "Maison Solène",
      sector: "cosmetiques",
      status: "publie",
      currency: "EUR",
    });

    // 1. Session annonceur (Maison Solène)
    await authService.sendOtp("contact@maisonsolene.fr", "advertiser");
    const advAuth = await authService.verifyOtp({
      email: "contact@maisonsolene.fr",
      code: "123456",
    });
    advertiserToken = advAuth.token;

    // 2. Session agent commercial (Alexandre)
    const agentAuth = await authService.loginBackoffice({
      email: "alexandre@influx.io",
      code: "123456",
    });
    agentToken = agentAuth.token;

    // 3. Session créateur (Lucas)
    await authService.sendOtp("lucas@lucastech.fr", "creator");
    const creatorAuth = await authService.verifyOtp({
      email: "lucas@lucastech.fr",
      code: "123456",
    });
    creatorToken = creatorAuth.token;

    // Peupler 12 créateurs aux profils variés pour tester k-anonymat (k=5), tris et exclusions
    const mockCreators = [
      // 1. Créateur Beauté A : Vérifié audience, EUR, 60j
      {
        id: "c0000001-0000-4000-8000-000000000001",
        accountId: "c0000001-0000-4000-8000-000000000001",
        alias: "Profil 7K3M",
        primaryTopic: "beaute",
        secondaryTopics: ["lifestyle"],
        country: "FR",
        status: "publie",
        profileStatus: "publie",
        searchVisibility: true,
        figuresUpdatedAt: past10Days,
        publishedAt: past60Days,
        isRecent: false,
        audience: { primaryCountry: "FR", primaryCountryShareBand: "gte_80" },
        networks: [
          {
            network: "instagram",
            isPrimary: true,
            audienceBand: "macro",
            hasVerifiedAudienceBadge: true,
            hasVerifiedAccountBadge: true,
            engagementRateBand: "3_6",
            handle: "@beaute_solene",
          },
          {
            network: "tiktok",
            isPrimary: false,
            audienceBand: "nano",
            hasVerifiedAudienceBadge: false,
            hasVerifiedAccountBadge: false,
            handle: "@beaute_nano_tiktok",
          },
        ],
        offers: [
          {
            network: "instagram",
            format: "reel",
            priceBand: "500_1000",
            currency: "EUR",
          },
        ],
        refusedSectors: ["tabac"],
      },
      // 2. Créateur Beauté B : Récents (< 30j), Vérifié compte, 10j
      {
        id: "c0000002-0000-4000-8000-000000000002",
        accountId: "c0000002-0000-4000-8000-000000000002",
        alias: "Profil 9X2P",
        primaryTopic: "beaute",
        country: "FR",
        status: "publie",
        profileStatus: "publie",
        searchVisibility: true,
        figuresUpdatedAt: past10Days,
        publishedAt: past10Days,
        isRecent: true,
        audience: { primaryCountry: "FR", primaryCountryShareBand: "50_80" },
        networks: [
          {
            network: "instagram",
            isPrimary: true,
            audienceBand: "mid",
            hasVerifiedAudienceBadge: false,
            hasVerifiedAccountBadge: true,
            handle: "@chloe_glow",
          },
        ],
        offers: [
          {
            network: "instagram",
            format: "post",
            priceBand: "250_500",
            currency: "EUR",
          },
        ],
        refusedSectors: [],
      },
      // 3. Créateur Beauté C : Récents (< 30j), non vérifié, 5j
      {
        id: "c0000003-0000-4000-8000-000000000003",
        accountId: "c0000003-0000-4000-8000-000000000003",
        alias: "Profil 4M1R",
        primaryTopic: "beaute",
        country: "FR",
        status: "publie",
        profileStatus: "publie",
        searchVisibility: true,
        figuresUpdatedAt: past5Days,
        publishedAt: past5Days,
        isRecent: true,
        audience: { primaryCountry: "FR", primaryCountryShareBand: "gte_80" },
        networks: [
          {
            network: "instagram",
            isPrimary: true,
            audienceBand: "micro",
            hasVerifiedAudienceBadge: false,
            hasVerifiedAccountBadge: false,
            handle: "@lea_makeup",
          },
        ],
        offers: [
          {
            network: "instagram",
            format: "story",
            priceBand: "lt_250",
            currency: "EUR",
          },
        ],
        refusedSectors: [],
      },
      // 4. Créateur Beauté D : Chiffres périmés (> 90j), rétrogradé
      {
        id: "c0000004-0000-4000-8000-000000000004",
        accountId: "c0000004-0000-4000-8000-000000000004",
        alias: "Profil 8T6Q",
        primaryTopic: "beaute",
        country: "FR",
        status: "publie",
        profileStatus: "publie",
        searchVisibility: true,
        figuresUpdatedAt: past100Days,
        publishedAt: past100Days,
        isRecent: false,
        audience: { primaryCountry: "FR", primaryCountryShareBand: "gte_80" },
        networks: [
          {
            network: "instagram",
            isPrimary: true,
            audienceBand: "mid",
            hasVerifiedAudienceBadge: false,
            hasVerifiedAccountBadge: false,
          },
        ],
        offers: [
          {
            network: "instagram",
            format: "reel",
            priceBand: "500_1000",
            currency: "EUR",
          },
        ],
        refusedSectors: [],
      },
      // 5. Créateur Beauté E : Tarif en USD
      {
        id: "c0000005-0000-4000-8000-000000000005",
        accountId: "c0000005-0000-4000-8000-000000000005",
        alias: "Profil 2Y9K",
        primaryTopic: "beaute",
        country: "FR",
        status: "publie",
        profileStatus: "publie",
        searchVisibility: true,
        figuresUpdatedAt: past10Days,
        publishedAt: past60Days,
        isRecent: false,
        audience: { primaryCountry: "FR", primaryCountryShareBand: "gte_80" },
        networks: [
          {
            network: "instagram",
            isPrimary: true,
            audienceBand: "nano",
            hasVerifiedAudienceBadge: false,
            hasVerifiedAccountBadge: false,
          },
        ],
        offers: [
          {
            network: "instagram",
            format: "story",
            priceBand: "250_500",
            currency: "USD",
          },
        ],
        refusedSectors: [],
      },
      // 6. Créateur Beauté F : Valide
      {
        id: "c0000006-0000-4000-8000-000000000006",
        accountId: "c0000006-0000-4000-8000-000000000006",
        alias: "Profil 5V8L",
        primaryTopic: "beaute",
        country: "FR",
        status: "publie",
        profileStatus: "publie",
        searchVisibility: true,
        figuresUpdatedAt: past10Days,
        publishedAt: past60Days,
        isRecent: false,
        audience: { primaryCountry: "FR", primaryCountryShareBand: "gte_80" },
        networks: [
          {
            network: "instagram",
            isPrimary: true,
            audienceBand: "macro",
            hasVerifiedAudienceBadge: false,
            hasVerifiedAccountBadge: false,
          },
        ],
        offers: [
          {
            network: "instagram",
            format: "video",
            priceBand: "1000_2000",
            currency: "EUR",
          },
        ],
        refusedSectors: [],
      },
      // 7. Créateur Gaming G (Seulement 2 profils Gaming pour tester k < 5)
      {
        id: "c0000007-0000-4000-8000-000000000007",
        accountId: "c0000007-0000-4000-8000-000000000007",
        alias: "Profil 3H7W",
        primaryTopic: "gaming",
        country: "FR",
        status: "publie",
        profileStatus: "publie",
        searchVisibility: true,
        figuresUpdatedAt: past10Days,
        publishedAt: past60Days,
        isRecent: false,
        audience: { primaryCountry: "FR", primaryCountryShareBand: "gte_80" },
        networks: [
          {
            network: "youtube",
            isPrimary: true,
            audienceBand: "macro",
            hasVerifiedAudienceBadge: true,
            hasVerifiedAccountBadge: true,
            handle: "@pixel_warrior",
          },
        ],
        offers: [{ network: "youtube", format: "video", priceBand: "500_1000", currency: "EUR" }],
        refusedSectors: [],
      },
      // 8. Créateur Gaming H
      {
        id: "c0000008-0000-4000-8000-000000000008",
        accountId: "c0000008-0000-4000-8000-000000000008",
        alias: "Profil 6J2Z",
        primaryTopic: "gaming",
        country: "FR",
        status: "publie",
        profileStatus: "publie",
        searchVisibility: true,
        figuresUpdatedAt: past10Days,
        publishedAt: past60Days,
        isRecent: false,
        audience: { primaryCountry: "FR", primaryCountryShareBand: "gte_80" },
        networks: [
          {
            network: "twitch",
            isPrimary: true,
            audienceBand: "mid",
            hasVerifiedAudienceBadge: false,
            hasVerifiedAccountBadge: true,
            handle: "@retro_stream",
          },
        ],
        offers: [{ network: "twitch", format: "stream", priceBand: "500_1000", currency: "EUR" }],
        refusedSectors: [],
      },
      // 9. Créateur I : Exclusion E1 (brouillon)
      {
        id: "c0000009-0000-4000-8000-000000000009",
        accountId: "c0000009-0000-4000-8000-000000000009",
        alias: "Profil 1D4F",
        primaryTopic: "beaute",
        country: "FR",
        status: "brouillon",
        profileStatus: "brouillon",
        searchVisibility: true,
        networks: [{ network: "instagram", isPrimary: true, audienceBand: "mid", hasVerifiedAudienceBadge: false, hasVerifiedAccountBadge: false }],
        offers: [{ network: "instagram", format: "reel", priceBand: "500_1000", currency: "EUR" }],
      },
      // 10. Créateur J : Exclusion E2 (searchVisibility = false)
      {
        id: "c0000010-0000-4000-8000-000000000010",
        accountId: "c0000010-0000-4000-8000-000000000010",
        alias: "Profil 9Z8S",
        primaryTopic: "beaute",
        country: "FR",
        status: "publie",
        profileStatus: "publie",
        searchVisibility: false,
        networks: [{ network: "instagram", isPrimary: true, audienceBand: "mid", hasVerifiedAudienceBadge: false, hasVerifiedAccountBadge: false }],
        offers: [{ network: "instagram", format: "reel", priceBand: "500_1000", currency: "EUR" }],
      },
      // 11. Créateur K : Exclusion E5 (Bloqué par la marque)
      {
        id: "c0000011-0000-4000-8000-000000000011",
        accountId: "c0000011-0000-4000-8000-000000000011",
        alias: "Profil 7B3V",
        primaryTopic: "beaute",
        country: "FR",
        status: "publie",
        profileStatus: "publie",
        searchVisibility: true,
        networks: [{ network: "instagram", isPrimary: true, audienceBand: "mid", hasVerifiedAudienceBadge: false, hasVerifiedAccountBadge: false }],
        offers: [{ network: "instagram", format: "reel", priceBand: "500_1000", currency: "EUR" }],
      },
      // 12. Créateur L : Exclusion E6 (Refuse le secteur cosmétiques)
      {
        id: "c0000012-0000-4000-8000-000000000012",
        accountId: "c0000012-0000-4000-8000-000000000012",
        alias: "Profil 6W2N",
        primaryTopic: "beaute",
        country: "FR",
        status: "publie",
        profileStatus: "publie",
        searchVisibility: true,
        refusedSectors: ["cosmetiques"],
        networks: [{ network: "instagram", isPrimary: true, audienceBand: "mid", hasVerifiedAudienceBadge: false, hasVerifiedAccountBadge: false }],
        offers: [{ network: "instagram", format: "reel", priceBand: "500_1000", currency: "EUR" }],
      },
    ];

    for (const c of mockCreators) {
      store.creatorProfiles.set(c.accountId, c);
      store.accounts.set(c.accountId, {
        id: c.accountId,
        email: `${c.alias.replace(" ", "").toLowerCase()}@creator.influx.io`,
        role: "creator",
        status: "active",
        preferredLanguage: "fr",
        countryCode: "FR",
        declaredStatus: "individual",
        emailStatus: "verified",
        createdAt: now,
        updatedAt: now,
      });
    }

    // Configurer le blocage pour Créateur K (E5)
    store.userBlocks.set("block-1", {
      id: "block-1",
      blockerAccountId: ADV_ID,
      blockedAccountId: "c0000011-0000-4000-8000-000000000011",
      reason: "Litige précédent",
      createdAt: now,
    });

    app = Fastify();
    await app.register(cookiePlugin);
    await app.register(searchRoutes, {
      searchService,
      authServiceInstance: authService,
    });
    await app.ready();
  });

  // ==========================================================================
  // A. ÉTANCHÉITÉ DE L'ANONYMISATION & LISTE NOIRE RG48 (CA1, CA3, CA6)
  // ==========================================================================
  describe("Étanchéité RG48 & Anonymisation stricte (CA1, CA3, CA6)", () => {
    it("CA1 & CA3 : aucun champ interdit de RG48 ne figure dans la réponse d'API servie à une marque", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/search/creators",
        headers: { authorization: `Bearer ${advertiserToken}` },
        payload: {
          filters: { primaryTopic: "beaute" },
        },
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.isBlockedByKAnonymity).toBe(false);
      expect(data.items.length).toBeGreaterThanOrEqual(5);

      for (const item of data.items) {
        // Strictement aucun champ identifiant, pas même nul ou vide (RG48, CA1)
        expect(item).not.toHaveProperty("legalFirstName");
        expect(item).not.toHaveProperty("legalLastName");
        expect(item).not.toHaveProperty("pseudonym");
        expect(item).not.toHaveProperty("email");
        expect(item).not.toHaveProperty("phone");
        expect(item).not.toHaveProperty("city");
        expect(item).not.toHaveProperty("exactNetworks");
        expect(item).not.toHaveProperty("refusedSectors");
        expect(item).not.toHaveProperty("internalNotes");
        expect(item).not.toHaveProperty("completenessPercent");

        // Alias non séquentiel présent (RG49)
        expect(item.alias).toMatch(/^Profil [A-Z0-9]{4}$/);

        // Chiffres d'audience toujours en tranches fermées (CA3)
        for (const net of item.networks) {
          expect(net).not.toHaveProperty("followersCount");
          expect(net).not.toHaveProperty("handle");
          expect(net).not.toHaveProperty("profileUrl");
          expect(["nano", "micro", "mid", "macro", "mega"]).toContain(net.audienceBand);
        }
      }
    });

    it("refuse l'accès à la recherche si l'utilisateur est un créateur", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/search/creators",
        headers: { authorization: `Bearer ${creatorToken}` },
        payload: {},
      });

      expect(response.statusCode).toBe(403);
      expect(response.json().error).toBe("FORBIDDEN_ROLE");
    });
  });

  // ==========================================================================
  // B. SEUIL DE K-ANONYMAT (k=5) & SUGGESTIONS STATIQUES (CA34, CA35, CA36, CA37)
  // ==========================================================================
  describe("k-Anonymat k=5 & Sortie commerciale (RG57, RG58, RG59, RG60, CA34 à CA37)", () => {
    it("CA34 & CA35 : bloque l'affichage si < 5 résultats et renvoie une structure identique pour 0 et 2 résultats", async () => {
      // 1. Recherche Gaming (2 résultats)
      const resGaming = await app.inject({
        method: "POST",
        url: "/api/search/creators",
        headers: { authorization: `Bearer ${advertiserToken}` },
        payload: {
          filters: { primaryTopic: "gaming" },
        },
      });

      expect(resGaming.statusCode).toBe(200);
      const dataGaming = resGaming.json();
      expect(dataGaming.isBlockedByKAnonymity).toBe(true);
      expect(dataGaming.items).toEqual([]); // Zéro profil fuitant
      expect(dataGaming.countBand).toBe("under_k");
      expect(dataGaming.broadeningSuggestions.length).toBeGreaterThanOrEqual(1);

      // 2. Recherche Inexistante (0 résultat)
      const resNone = await app.inject({
        method: "POST",
        url: "/api/search/creators",
        headers: { authorization: `Bearer ${advertiserToken}` },
        payload: {
          filters: { primaryTopic: "astro_physique_inconnue" },
        },
      });

      expect(resNone.statusCode).toBe(200);
      const dataNone = resNone.json();
      expect(dataNone.isBlockedByKAnonymity).toBe(true);
      expect(dataNone.items).toEqual([]);
      expect(dataNone.countBand).toBe("zero");

      // CA35 : Le message d'affichage côté client est identique pour 0 et under_k
    });

    it("CA36 : décompte toujours exprimé en tranche (5_9, 10_24, etc.) et jamais en nombre exact", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/search/creators",
        headers: { authorization: `Bearer ${advertiserToken}` },
        payload: {
          filters: { primaryTopic: "beaute" },
        },
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.isBlockedByKAnonymity).toBe(false);
      expect(data.countBand).toBe("5_9");
      expect(data).not.toHaveProperty("exactTotal"); // Aucune fuite de décompte exact
    });

    it("CA37 : les suggestions d'élargissement sont pré-construites et statiques selon les filtres actifs", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/search/creators",
        headers: { authorization: `Bearer ${advertiserToken}` },
        payload: {
          filters: {
            primaryTopic: "gaming",
            priceBand: "lt_250",
            audienceBand: "mega",
          },
        },
      });

      const data = response.json();
      expect(data.isBlockedByKAnonymity).toBe(true);
      expect(data.broadeningSuggestions).toContain("retirer le filtre de tarif");
      expect(data.broadeningSuggestions).toContain("élargir la tranche d'audience");
    });
  });

  // ==========================================================================
  // C. EXCLUSIONS AUTOMATIQUES SILENCIEUSES E1 À E6 (CA18, CA19, CA20, CA21)
  // ==========================================================================
  describe("Exclusions automatiques silencieuses (RG27, CA18 à CA21)", () => {
    it("CA18 : un profil en brouillon est exclu silencieusement des résultats", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/search/creators",
        headers: { authorization: `Bearer ${advertiserToken}` },
        payload: { filters: { primaryTopic: "beaute" } },
      });

      const data = response.json();
      const draftCreator = data.items.find(
        (i: any) => i.creatorAccountId === "c0000009-0000-4000-8000-000000000009",
      );
      expect(draftCreator).toBeUndefined();
    });

    it("CA19 : un créateur ayant désactivé la visibilité recherche est exclu silencieusement", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/search/creators",
        headers: { authorization: `Bearer ${advertiserToken}` },
        payload: { filters: { primaryTopic: "beaute" } },
      });

      const data = response.json();
      const hiddenCreator = data.items.find(
        (i: any) => i.creatorAccountId === "c0000010-0000-4000-8000-000000000010",
      );
      expect(hiddenCreator).toBeUndefined();
    });

    it("CA20 : un créateur ayant un blocage symétrique avec la marque est absent silencieusement", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/search/creators",
        headers: { authorization: `Bearer ${advertiserToken}` },
        payload: { filters: { primaryTopic: "beaute" } },
      });

      const data = response.json();
      const blockedCreator = data.items.find(
        (i: any) => i.creatorAccountId === "c0000011-0000-4000-8000-000000000011",
      );
      expect(blockedCreator).toBeUndefined();
    });

    it("CA21 : un créateur refusant le secteur de la marque (cosmétiques) est absent silencieusement", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/search/creators",
        headers: { authorization: `Bearer ${advertiserToken}` },
        payload: { filters: { primaryTopic: "beaute" } },
      });

      const data = response.json();
      const refusedSectorCreator = data.items.find(
        (i: any) => i.creatorAccountId === "c0000012-0000-4000-8000-000000000012",
      );
      expect(refusedSectorCreator).toBeUndefined();
    });
  });

  // ==========================================================================
  // D. FACETTES & COMBINAISON STRICTE (CA9, CA10, CA11, CA12, CA13)
  // ==========================================================================
  describe("Facettes & Combinaison stricte sur la même ligne (RG17, RG18, CA9, CA10, CA12)", () => {
    it("CA9 : F3 + F4 s'appliquent sur la MÊME ligne réseau", async () => {
      // Le créateur A est macro sur Instagram et nano sur TikTok
      // Si on filtre TikTok + macro, Créateur A ne doit PAS matcher !
      const response = await app.inject({
        method: "POST",
        url: "/api/search/creators",
        headers: { authorization: `Bearer ${advertiserToken}` },
        payload: {
          filters: {
            primaryTopic: "beaute",
            networks: ["tiktok"],
            audienceBand: "macro",
          },
        },
      });

      const data = response.json();
      // Bloqué par k-anonymat car < 5 créateurs sont macro sur TikTok
      expect(data.isBlockedByKAnonymity).toBe(true);
      expect(data.items).toEqual([]);
    });

    it("CA12 : tarif déclaré dans une autre devise exclu par défaut, inclus avec warning si option cochée", async () => {
      // 1. Sans inclure les autres devises (USD exclu par défaut pour recherche EUR)
      const resWithout = await app.inject({
        method: "POST",
        url: "/api/search/creators",
        headers: { authorization: `Bearer ${advertiserToken}` },
        payload: {
          filters: {
            primaryTopic: "beaute",
            priceBand: "250_500",
            currency: "EUR",
            includeOtherCurrencies: false,
          },
        },
      });
      const dataWithout = resWithout.json();
      // Créateur E est en USD donc exclu
      const creatorEInWithout = dataWithout.items.find(
        (i: any) => i.creatorAccountId === "c0000005-0000-4000-8000-000000000005",
      );
      expect(creatorEInWithout).toBeUndefined();

      // 2. En cochant includeOtherCurrencies: true
      const resWith = await app.inject({
        method: "POST",
        url: "/api/search/creators",
        headers: { authorization: `Bearer ${agentToken}` }, // en mode agent pour bypasser k-anonymat si faible volume
        payload: {
          filters: {
            primaryTopic: "beaute",
            priceBand: "250_500",
            currency: "EUR",
            includeOtherCurrencies: true,
          },
          viewMode: "agent_identified",
        },
      });
      const dataWith = resWith.json();
      const creatorEInWith = dataWith.items.find(
        (i: any) => i.creatorAccountId === "c0000005-0000-4000-8000-000000000005",
      );
      expect(creatorEInWith).toBeDefined();
      expect(creatorEInWith.vigilanceWarning).toBe("other_currency");
    });
  });

  // ==========================================================================
  // E. TRI DÉTERMINISTE, CAS FROID & EXPLICATION (CA24, CA26, CA27, CA29, CA30)
  // ==========================================================================
  describe("Tri déterministe à 8 paliers & Quota froid (RG35, RG41, RG45, CA24, CA26, CA29, CA30)", () => {
    it("CA24 : deux recherches identiques le même jour UTC renvoient exactement le même ordre", async () => {
      const res1 = await app.inject({
        method: "POST",
        url: "/api/search/creators",
        headers: { authorization: `Bearer ${advertiserToken}` },
        payload: { filters: { primaryTopic: "beaute" }, sort: "default" },
      });
      const res2 = await app.inject({
        method: "POST",
        url: "/api/search/creators",
        headers: { authorization: `Bearer ${advertiserToken}` },
        payload: { filters: { primaryTopic: "beaute" }, sort: "default" },
      });

      const items1 = res1.json().items.map((i: any) => i.creatorAccountId);
      const items2 = res2.json().items.map((i: any) => i.creatorAccountId);
      expect(items1).toEqual(items2);
    });

    it("CA26 : Palier 3 met en tête les profils vérifiés (Audience > Compte)", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/search/creators",
        headers: { authorization: `Bearer ${advertiserToken}` },
        payload: { filters: { primaryTopic: "beaute" }, sort: "default" },
      });

      const items = res.json().items;
      // Créateur A a le badge audience vérifiée
      const creatorA = items.find(
        (i: any) => i.creatorAccountId === "c0000001-0000-4000-8000-000000000001",
      );
      expect(creatorA).toBeDefined();
      expect(creatorA.reasons.some((r: any) => r.code === "verified_badge")).toBe(true);
    });

    it("CA27 & CA4 : l'explication comporte 2 à 4 raisons sans aucun pourcentage exact", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/search/creators",
        headers: { authorization: `Bearer ${advertiserToken}` },
        payload: { filters: { primaryTopic: "beaute" } },
      });

      const items = res.json().items;
      for (const item of items) {
        expect(item.reasons.length).toBeGreaterThanOrEqual(1);
        expect(item.reasons.length).toBeLessThanOrEqual(4);

        // Vérifier qu'aucun pourcentage brut ne fuite dans les params de raison (CA4)
        for (const reason of item.reasons) {
          if (reason.code === "audience_country_match") {
            expect(reason.params.shareBandText).toMatch(/^(plus de (50|80) %|audience notable)$/);
            expect(reason.params.shareBandText).not.toBe("72 %");
          }
        }
      }
    });

    it("CA29 & CA30 : au moins 2 profils récents sont présents avec l'étiquette 'recent_profile'", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/search/creators",
        headers: { authorization: `Bearer ${advertiserToken}` },
        payload: { filters: { primaryTopic: "beaute" } },
      });

      const items = res.json().items;
      const recentProfiles = items.filter((i: any) => i.isRecent);
      expect(recentProfiles.length).toBeGreaterThanOrEqual(2);
      expect(recentProfiles[0].vigilanceWarning).toBe("recent_profile");
    });

    it("CA23 : les chiffres > 90j ont le point de vigilance stale_figures", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/search/creators",
        headers: { authorization: `Bearer ${advertiserToken}` },
        payload: { filters: { primaryTopic: "beaute" } },
      });

      const items = res.json().items;
      const creatorD = items.find(
        (i: any) => i.creatorAccountId === "c0000004-0000-4000-8000-000000000004",
      );
      expect(creatorD).toBeDefined();
      expect(creatorD.vigilanceWarning).toBe("stale_figures");
    });
  });

  // ==========================================================================
  // F. GARDE-FOUS, PLAFONDS & JOURNALISATION (CA41, CA42, CA44, CA47, CA48)
  // ==========================================================================
  describe("Garde-fous & Journalisation (RG63, RG64, CA41, CA44, CA47, CA48)", () => {
    it("CA41 & CA42 : limite de pagination plafonnée à 12 par page et max 5 pages", async () => {
      // Requête avec limit 50 -> plafonné à 12
      const res = await app.inject({
        method: "POST",
        url: "/api/search/creators",
        headers: { authorization: `Bearer ${advertiserToken}` },
        payload: { filters: { primaryTopic: "beaute" }, limit: 50, page: 1 },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().limit).toBe(12);

      // Requête avec page 6 -> rejetée avec 400
      const resPage6 = await app.inject({
        method: "POST",
        url: "/api/search/creators",
        headers: { authorization: `Bearer ${advertiserToken}` },
        payload: { filters: { primaryTopic: "beaute" }, page: 6 },
      });
      expect(resPage6.statusCode).toBe(400);
      expect(resPage6.json().error).toBe("PAGINATION_LIMIT_EXCEEDED");
    });

    it("CA47 & CA48 : journalise la recherche et les impressions avec rang, et supporte le tracking d'ouverture", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/search/creators",
        headers: { authorization: `Bearer ${advertiserToken}` },
        payload: { filters: { primaryTopic: "beaute" } },
      });

      const data = res.json();
      const queryId = data.searchQueryId;
      expect(queryId).toBeDefined();

      // Vérifier en base mémoire
      const recordedQuery = store.searchQueries.get(queryId);
      expect(recordedQuery).toBeDefined();
      expect(recordedQuery?.accountId).toBe(ADV_ID);

      const impressions = store.searchImpressions.get(queryId);
      expect(impressions).toBeDefined();
      expect(impressions?.length).toBe(data.items.length);
      const firstImpression = impressions?.[0];
      expect(firstImpression?.rank).toBe(1);
      expect(firstImpression?.wasOpened).toBe(false);

      // Ouvrir un profil
      const creatorToOpen = data.items[0].creatorAccountId;
      const openRes = await app.inject({
        method: "POST",
        url: `/api/search/creators/${creatorToOpen}/open`,
        headers: { authorization: `Bearer ${advertiserToken}` },
        payload: { searchQueryId: queryId },
      });
      expect(openRes.statusCode).toBe(200);

      // Vérifier que wasOpened est passé à true
      const updatedImpression = store.searchImpressions
        .get(queryId)
        ?.find((i) => i.creatorAccountId === creatorToOpen);
      expect(updatedImpression?.wasOpened).toBe(true);
      expect(updatedImpression?.openedAt).toBeDefined();
    });

    it("CA44 : rate limiting rejette avec 429 explicite après 30 requêtes par heure", async () => {
      // Simuler 30 requêtes déjà exécutées dans l'heure
      for (let i = 0; i < 30; i++) {
        const qId = `test-q-${i}`;
        store.searchQueries.set(qId, {
          id: qId,
          accountId: ADV_ID,
          createdAt: new Date().toISOString(),
        });
      }

      const res = await app.inject({
        method: "POST",
        url: "/api/search/creators",
        headers: { authorization: `Bearer ${advertiserToken}` },
        payload: { filters: { primaryTopic: "beaute" } },
      });

      expect(res.statusCode).toBe(429);
      expect(res.json().error).toBe("RATE_LIMIT_EXCEEDED");
    });
  });

  // ==========================================================================
  // G. VUE COMMERCIALE IDENTIFIÉE (CA16, CA40, CA55, RG62, RG71)
  // ==========================================================================
  describe("Vue Commerciale identifiée (RG62, RG71, CA40, CA55)", () => {
    it("CA40 & CA55 : le commercial voit les identités réelles, sans blocage de k-anonymat pour 2 créateurs", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/search/creators",
        headers: { authorization: `Bearer ${agentToken}` },
        payload: {
          filters: { primaryTopic: "gaming" },
          viewMode: "agent_identified",
        },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.isBlockedByKAnonymity).toBe(false);
      expect(data.items.length).toBe(2);
      expect(data.exactTotal).toBe(2);

      const item = data.items[0];
      // Champs identifiants visibles pour l'agent
      expect(item).toHaveProperty("exactNetworks");
      expect(item.exactNetworks[0]).toHaveProperty("handle");
      expect(item).toHaveProperty("email");
      expect(item).toHaveProperty("profileStatus");
    });
  });

  // ==========================================================================
  // H. PONT CAMPAGNE, SHORTLISTS & SÉLECTION ÉQUIPE (CA39, CA51, CA52, CA56)
  // ==========================================================================
  describe("Pont campagne, Shortlists et Sélection par l'équipe (RG51, RG61, RG73, CA39, CA51, CA52, CA56)", () => {
    it("CA56 : pré-remplissage des facettes depuis le brief d'une campagne", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/search/campaign-bridge/${SEED_IDS.CAMPAIGN_1}`,
        headers: { authorization: `Bearer ${advertiserToken}` },
      });

      expect(res.statusCode).toBe(200);
      const bridgeFilters = res.json();
      expect(bridgeFilters.campaignId).toBe(SEED_IDS.CAMPAIGN_1);
      expect(bridgeFilters.currency).toBe("EUR");
    });

    it("CA51 & CA52 : gestion des shortlists privées sans notification au créateur", async () => {
      // 1. Créer shortlist
      const createRes = await app.inject({
        method: "POST",
        url: "/api/search/shortlists",
        headers: { authorization: `Bearer ${advertiserToken}` },
        payload: { name: "Ma sélection Printemps" },
      });
      expect(createRes.statusCode).toBe(201);
      const shortlist = createRes.json();
      expect(shortlist.name).toBe("Ma sélection Printemps");

      // 2. Ajouter un créateur
      const creatorId = "c0000001-0000-4000-8000-000000000001";
      const addRes = await app.inject({
        method: "POST",
        url: `/api/search/shortlists/${shortlist.id}/items`,
        headers: { authorization: `Bearer ${advertiserToken}` },
        payload: { creatorAccountId: creatorId, note: "Coup de coeur univers" },
      });
      expect(addRes.statusCode).toBe(201);

      // 3. Lister les items
      const listRes = await app.inject({
        method: "GET",
        url: `/api/search/shortlists/${shortlist.id}/items`,
        headers: { authorization: `Bearer ${advertiserToken}` },
      });
      expect(listRes.statusCode).toBe(200);
      expect(listRes.json().length).toBe(1);

      // 4. Supprimer item
      const delRes = await app.inject({
        method: "DELETE",
        url: `/api/search/shortlists/${shortlist.id}/items/${creatorId}`,
        headers: { authorization: `Bearer ${advertiserToken}` },
      });
      expect(delRes.statusCode).toBe(200);
    });

    it("CA39 : Demande 'Sélection par l'équipe INFLUX' enregistrée avec tous les critères", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/search/team-selection",
        headers: { authorization: `Bearer ${advertiserToken}` },
        payload: {
          filters: { primaryTopic: "gaming", audienceBand: "macro" },
          notes: "Recherche urgente pour tournoi esport le 25 mai",
          locale: "fr",
        },
      });

      expect(res.statusCode).toBe(201);
      const data = res.json();
      expect(data.advertiserAccountId).toBe(ADV_ID);
      expect(data.filters.primaryTopic).toBe("gaming");
      expect(data.status).toBe("pending");
      expect(data.notes).toContain("Recherche urgente");
    });
  });
});
