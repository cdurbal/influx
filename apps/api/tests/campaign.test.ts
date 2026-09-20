import { describe, it, expect, beforeEach } from "vitest";
import Fastify from "fastify";
import cookiePlugin from "@fastify/cookie";
import { campaignRoutes } from "../src/routes/campaign-routes";
import { CampaignService } from "../src/services/campaign-service";
import { AuthService } from "../src/services/auth-service";
import { BrandProfileService } from "../src/services/brand-profile-service";
import { CreatorProfileService } from "../src/services/creator-profile-service";
import { MockStore } from "../src/mocks/mock-store";
import { SEED_IDS } from "../src/mocks/seed-data";
import { type Campaign } from "@influx/contracts";

describe("Mission 3.1 : Contrats & Service Campagnes Marque", () => {
  let app: ReturnType<typeof Fastify>;
  let store: MockStore;
  let authService: AuthService;
  let campaignService: CampaignService;
  let brandProfileService: BrandProfileService;
  let creatorProfileService: CreatorProfileService;

  let advertiserToken: string;
  let creatorToken: string;
  let agentToken: string;
  let adminToken: string;

  beforeEach(async () => {
    store = MockStore.getInstance();
    store.reset();

    authService = new AuthService(store);
    campaignService = new CampaignService(store);
    brandProfileService = new BrandProfileService(store);
    creatorProfileService = new CreatorProfileService(store);

    // 1. Session annonceur (Maison Solène)
    await authService.sendOtp("contact@maisonsolene.fr", "advertiser");
    const advAuth = await authService.verifyOtp({
      email: "contact@maisonsolene.fr",
      code: "123456",
    });
    advertiserToken = advAuth.token;

    // 2. Session créateur (Lucas Tech)
    await authService.sendOtp("lucas@lucastech.fr", "creator");
    const creatorAuth = await authService.verifyOtp({
      email: "lucas@lucastech.fr",
      code: "123456",
    });
    creatorToken = creatorAuth.token;

    // 3. Session agent (Alexandre)
    const agentAuth = await authService.loginBackoffice({
      email: "alexandre@influx.io",
      code: "123456",
    });
    agentToken = agentAuth.token;

    // 4. Session admin (Sarah)
    const adminAuth = await authService.loginBackoffice({
      email: "sarah.admin@influx.io",
      code: "123456",
    });
    adminToken = adminAuth.token;

    app = Fastify();
    await app.register(cookiePlugin);
    await app.register(campaignRoutes, {
      campaignService,
      authServiceInstance: authService,
    });
    await app.ready();
  });

  describe("CA1 & RG108 : Création et sauvegarde incrémentale de brouillon", () => {
    it("crée un brouillon de campagne avec état 'brouillon' et dérivation des réseaux", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/campaigns/draft",
        headers: { authorization: `Bearer ${advertiserToken}` },
        payload: {
          title: "Nouvelle campagne Automne 2026",
          campaignType: "placement_produit",
          deliverables: [
            { network: "instagram", format: "reel", quantity: 1 },
            { network: "tiktok", format: "video_tiktok", quantity: 2 },
          ],
        },
      });

      expect(response.statusCode).toBe(201);
      const data = response.json();
      expect(data.campaign).toBeDefined();
      expect(data.campaign.status).toBe("brouillon");
      expect(data.campaign.brandAccountId).toBe(SEED_IDS.ADVERTISER_1);
      expect(data.campaign.targetNetworks).toEqual(["instagram", "tiktok"]);
    });

    it("met à jour le brouillon de campagne incrémentalement", async () => {
      // Création initiale
      const createRes = await app.inject({
        method: "POST",
        url: "/api/campaigns/draft",
        headers: { authorization: `Bearer ${advertiserToken}` },
        payload: { title: "Titre initial brouillon" },
      });
      const campaignId = createRes.json().campaign.id;

      // Mise à jour
      const updateRes = await app.inject({
        method: "PUT",
        url: `/api/campaigns/${campaignId}`,
        headers: { authorization: `Bearer ${advertiserToken}` },
        payload: {
          title: "Titre modifié avec soin",
          minCompensationMinor: 50000,
          maxCompensationMinor: 100000,
        },
      });

      expect(updateRes.statusCode).toBe(200);
      const updated = updateRes.json().campaign;
      expect(updated.title).toBe("Titre modifié avec soin");
      expect(updated.derivedPriceBands).toContain("500_1000");
    });
  });

  describe("CA2, CA3, CA4 : Soumission pour validation commerciale", () => {
    it("refuse la soumission si le profil marque n'est pas publié (CA2)", async () => {
      // S'assurer que le profil de marque de l'annonceur 1 est en brouillon
      const brandProfile = brandProfileService.getOrCreateProfile({
        id: SEED_IDS.ADVERTISER_1,
        email: "contact@maisonsolene.fr",
        role: "advertiser",
        status: "active",
        preferredLanguage: "fr",
        countryCode: "FR",
        declaredStatus: "company",
        emailStatus: "verified",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      brandProfile.status = "brouillon";
      store.brandProfiles.set(
        SEED_IDS.ADVERTISER_1,
        brandProfile as unknown as Record<string, unknown>,
      );

      // Créer une campagne
      const createRes = await app.inject({
        method: "POST",
        url: "/api/campaigns/draft",
        headers: { authorization: `Bearer ${advertiserToken}` },
        payload: { title: "Campagne test profil non publié" },
      });
      const campaignId = createRes.json().campaign.id;

      // Tenter de soumettre
      const submitRes = await app.inject({
        method: "POST",
        url: `/api/campaigns/${campaignId}/submit`,
        headers: { authorization: `Bearer ${advertiserToken}` },
      });

      expect(submitRes.statusCode).toBe(400);
      expect(submitRes.json().message).toContain(
        "Publiez votre profil de marque",
      );
    });

    it("refuse la soumission si des champs obligatoires manquent et liste les manques (CA3)", async () => {
      // Passer le profil marque en 'publie'
      const brandProfile = brandProfileService.getProfileByAccountId(
        SEED_IDS.ADVERTISER_1,
      )!;
      brandProfile.status = "publie";
      store.brandProfiles.set(
        SEED_IDS.ADVERTISER_1,
        brandProfile as unknown as Record<string, unknown>,
      );

      // Créer une campagne incomplète
      const createRes = await app.inject({
        method: "POST",
        url: "/api/campaigns/draft",
        headers: { authorization: `Bearer ${advertiserToken}` },
        payload: { title: "Campagne incomplète" },
      });
      const campaignId = createRes.json().campaign.id;

      const submitRes = await app.inject({
        method: "POST",
        url: `/api/campaigns/${campaignId}/submit`,
        headers: { authorization: `Bearer ${advertiserToken}` },
      });

      expect(submitRes.statusCode).toBe(400);
      const body = submitRes.json();
      expect(body.message).toContain("Il manque des informations");
      expect(body.message).toContain("Brief détaillé");
      expect(body.message.toLowerCase()).toContain("livrable");
    });

    it("accepte la soumission d'une campagne complète (CA4)", async () => {
      // Profil publié
      const brandProfile = brandProfileService.getProfileByAccountId(
        SEED_IDS.ADVERTISER_1,
      )!;
      brandProfile.status = "publie";
      store.brandProfiles.set(
        SEED_IDS.ADVERTISER_1,
        brandProfile as unknown as Record<string, unknown>,
      );

      // Création d'une campagne complète
      const fullCampaignData = {
        title: "Campagne Validée Complète Parfaite 2026",
        campaignType: "placement_produit",
        publicSummary:
          "Nous recherchons des créatrices et créateurs engagés pour présenter notre tout nouveau soin bio à leur communauté avec sincérité et passion.",
        detailedBrief:
          "Voici le brief complet détaillé qui décrit toutes les attentes créatives pour la routine matinale. Deux formats sont attendus : un reel explicatif et deux stories de suivi à J+7. Les contenus doivent être authentiques, sincères et soignés. Nous comptons sur vous pour partager votre ressenti honnête auprès de votre communauté.",
        productName: "Sérum Botanique Éclat 50ml",
        productCategory: "Cosmétiques & Beauté Bio",
        keyMessages: [
          "100% biologique certifié",
          "Fabrication française en circuit court",
        ],
        productShipped: true,
        productValueBand: "lt_250",
        productKept: true,
        productShippingCost: "marque",
        deliverables: [{ network: "instagram", format: "reel", quantity: 1 }],
        usageRights: "repost_organique",
        usageDuration: "3_mois",
        usageTerritory: ["FR"],
        exclusivity: "none",
        contentValidationDelay: "48h",
        targetCountries: ["FR"],
        targetLanguages: ["fr"],
        targetTopics: ["beaute"],
        minCompensationMinor: 100000,
        maxCompensationMinor: 200000,
        currency: "EUR",
        compensationNature: "numeraire_et_dotation",
        creatorsCount: 3,
        applicationDeadline: "2026-10-15",
        startsOn: "2026-11-01",
        endsOn: "2026-11-30",
      };

      const createRes = await app.inject({
        method: "POST",
        url: "/api/campaigns/draft",
        headers: { authorization: `Bearer ${advertiserToken}` },
        payload: fullCampaignData,
      });
      const campaignId = createRes.json().campaign?.id;

      const submitRes = await app.inject({
        method: "POST",
        url: `/api/campaigns/${campaignId}/submit`,
        headers: { authorization: `Bearer ${advertiserToken}` },
      });

      expect(submitRes.statusCode).toBe(200);
      expect(submitRes.json().campaign.status).toBe("a_valider");
      expect(submitRes.json().campaign.submittedAt).toBeDefined();
    });
  });

  describe("CA38, CA39, CA41 : Consultation étanche Créateur vs Marque", () => {
    it("sert la vue Créateur : JAMAIS de budget total ni de notes, net estimé calculé depuis le barème (RG60, RG65, CA38, CA41)", async () => {
      // Consultation de la campagne publiée SEED_IDS.CAMPAIGN_1
      const response = await app.inject({
        method: "GET",
        url: `/api/campaigns/public/${SEED_IDS.CAMPAIGN_1}`,
        headers: { authorization: `Bearer ${creatorToken}` },
      });

      expect(response.statusCode).toBe(200);
      const campaign = response.json().campaign;

      // Invariants de sécurité stricts (A2, RG65, CA41)
      expect(campaign.totalBudgetMinor).toBeUndefined();
      expect(campaign.internalNotes).toBeUndefined();
      expect(campaign.internalReference).toBeUndefined();
      expect(campaign.validatorAgentId).toBeUndefined();

      // Données financières créateur (RG60, CA38)
      expect(campaign.minCompensationMinor).toBe(100000);
      expect(campaign.maxCompensationMinor).toBe(200000);
      expect(campaign.estimatedNet).toBeDefined();
      expect(campaign.estimatedNet.formattedLabel).toContain(
        "environ 650 – 1 300 EUR",
      );

      // Mention RG32
      expect(
        campaign.notices.some(
          (n: any) => n.key === "campaign.disclosure.notice",
        ),
      ).toBe(true);

      // Profil marque public attaché (CA64)
      expect(campaign.brandProfile).toBeDefined();
      expect(campaign.brandProfile.companyName).toBe("Maison Solène");
      expect(campaign.brandProfile.contactEmail).toBeUndefined();
      expect(campaign.brandProfile.contactPhone).toBeUndefined();
    });

    it("sert la vue Marque : contient le budget total mais JAMAIS le net créateur (RG61, CA39)", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/campaigns/my/${SEED_IDS.CAMPAIGN_1}`,
        headers: { authorization: `Bearer ${advertiserToken}` },
      });

      expect(response.statusCode).toBe(200);
      const campaign = response.json().campaign;

      expect(campaign.totalBudgetMinor).toBe(600000);
      expect(campaign.internalReference).toBe("SERUM-BIO-2026");
      expect(campaign.estimatedNet).toBeUndefined();
    });

    it("interdit au créateur de consulter une campagne clôturée ou en brouillon (RG100, CA66)", async () => {
      // Clôturer la campagne 1
      campaignService.closeCampaign(SEED_IDS.CAMPAIGN_1, {
        brandAccountId: SEED_IDS.ADVERTISER_1,
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/campaigns/public/${SEED_IDS.CAMPAIGN_1}`,
        headers: { authorization: `Bearer ${creatorToken}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("RG8, RG9, CA8, CA9 : Cycle de vie (Pause, Reprise, Clôture, Duplication)", () => {
    it("met en pause puis reprend une campagne publiée (RG8, CA8)", async () => {
      // Pause
      const pauseRes = await app.inject({
        method: "POST",
        url: `/api/campaigns/${SEED_IDS.CAMPAIGN_1}/pause`,
        headers: { authorization: `Bearer ${advertiserToken}` },
      });
      expect(pauseRes.statusCode).toBe(200);
      expect(pauseRes.json().campaign.status).toBe("en_pause");

      // Consultation créateur pendant la pause : lisible mais marquée en pause
      const creatorView = await app.inject({
        method: "GET",
        url: `/api/campaigns/public/${SEED_IDS.CAMPAIGN_1}`,
        headers: { authorization: `Bearer ${creatorToken}` },
      });
      expect(creatorView.statusCode).toBe(200);
      expect(creatorView.json().campaign.isPaused).toBe(true);

      // Reprise
      const resumeRes = await app.inject({
        method: "POST",
        url: `/api/campaigns/${SEED_IDS.CAMPAIGN_1}/resume`,
        headers: { authorization: `Bearer ${advertiserToken}` },
      });
      expect(resumeRes.statusCode).toBe(200);
      expect(resumeRes.json().campaign.status).toBe("publiee");
    });

    it("clôture définitivement et permet la duplication vers un nouveau brouillon (RG9, CA9)", async () => {
      // Clôture
      const closeRes = await app.inject({
        method: "POST",
        url: `/api/campaigns/${SEED_IDS.CAMPAIGN_1}/close`,
        headers: { authorization: `Bearer ${advertiserToken}` },
      });
      expect(closeRes.statusCode).toBe(200);
      expect(closeRes.json().campaign.status).toBe("cloturee");

      // Duplication
      const dupRes = await app.inject({
        method: "POST",
        url: `/api/campaigns/${SEED_IDS.CAMPAIGN_1}/duplicate`,
        headers: { authorization: `Bearer ${advertiserToken}` },
      });
      expect(dupRes.statusCode).toBe(201);
      const copy = dupRes.json().campaign;
      expect(copy.id).not.toBe(SEED_IDS.CAMPAIGN_1);
      expect(copy.status).toBe("brouillon");
      expect(copy.title).toContain("(copie)");
    });
  });

  describe("RG85, RG88, RG90, CA56, CA57, CA58, CA59 : Modération Backoffice", () => {
    it("pose un verrou nominatif de 30 min et empêche un autre agent d'intervenir (RG88, CA58)", async () => {
      // Campagne en attente de validation
      const camp = campaignService.createDraft(SEED_IDS.ADVERTISER_1, {
        title: "Campagne en attente de modération",
      });
      camp.status = "a_valider";
      store.campaigns.set(camp.id, camp as unknown as Record<string, unknown>);

      // Agent 1 pose son verrou
      const claim1 = await app.inject({
        method: "POST",
        url: `/api/backoffice/campaigns/${camp.id}/claim`,
        headers: { authorization: `Bearer ${agentToken}` },
      });
      expect(claim1.statusCode).toBe(200);
      expect(claim1.json().campaign.lockedByAgentId).toBe(SEED_IDS.AGENT_1);

      // Session pour un deuxième agent distinct
      const agent2Auth = await authService.loginBackoffice({
        email: "sarah.admin@influx.io",
        code: "123456",
      });
      // Sarah avec rôle agent
      const claim2 = await app.inject({
        method: "POST",
        url: `/api/backoffice/campaigns/${camp.id}/claim`,
        headers: { authorization: `Bearer ${agent2Auth.token}` },
      });
      // Doit échouer car verrouillé par Agent 1
      expect(claim2.statusCode).toBe(409);
      expect(claim2.json().message).toContain("déjà prise en charge");
    });

    it("exige une double validation pour publier une campagne en secteur sensible (RG85, CA56, CA57)", async () => {
      // Campagne sensible en attente
      const camp = campaignService.createDraft(SEED_IDS.ADVERTISER_1, {
        title: "Campagne Gin Artisanal 2026",
        productCategory: "alcool",
        sensitiveDeclarationAccepted: true,
      });
      camp.status = "a_valider";
      store.campaigns.set(camp.id, camp as unknown as Record<string, unknown>);

      // Tentative de publication par un agent seul (non admin) -> Refus 400 (CA57)
      const publishSingleAgent = await app.inject({
        method: "POST",
        url: `/api/backoffice/campaigns/${camp.id}/publish`,
        headers: { authorization: `Bearer ${agentToken}` },
        payload: {},
      });
      expect(publishSingleAgent.statusCode).toBe(400);
      expect(publishSingleAgent.json().message).toContain("double validation");

      // Publication par un Admin -> Réussite (CA56)
      const publishAdmin = await app.inject({
        method: "POST",
        url: `/api/backoffice/campaigns/${camp.id}/publish`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {},
      });
      expect(publishAdmin.statusCode).toBe(200);
      expect(publishAdmin.json().campaign.status).toBe("publiee");
    });

    it("refuse avec motif typé fermé et message explicite (RG90, CA59)", async () => {
      const camp = campaignService.createDraft(SEED_IDS.ADVERTISER_1, {
        title: "Campagne Brief Flou",
      });
      camp.status = "a_valider";
      store.campaigns.set(camp.id, camp as unknown as Record<string, unknown>);

      // Rejet avec motif invalide
      const rejectInvalid = await app.inject({
        method: "POST",
        url: `/api/backoffice/campaigns/${camp.id}/reject`,
        headers: { authorization: `Bearer ${agentToken}` },
        payload: { reason: "motif_inconnu_fantaisiste" },
      });
      expect(rejectInvalid.statusCode).toBe(400);

      // Rejet avec motif valide
      const rejectValid = await app.inject({
        method: "POST",
        url: `/api/backoffice/campaigns/${camp.id}/reject`,
        headers: { authorization: `Bearer ${agentToken}` },
        payload: {
          reason: "brief_insuffisant",
          comment: "Merci de préciser les consignes de tournage du produit.",
        },
      });
      expect(rejectValid.statusCode).toBe(200);
      const rejected = rejectValid.json().campaign;
      expect(rejected.status).toBe("refusee");
      expect(rejected.rejectionReason).toBe("brief_insuffisant");
      expect(rejected.rejectionComment).toContain("consignes de tournage");
    });

    it("expose la file backoffice paginée avec métriques SLA (RG87, RG96)", async () => {
      const campPending = campaignService.createDraft(SEED_IDS.ADVERTISER_1, {
        title: "Campagne En Attente Pour File",
        productCategory: "mode",
      });
      campPending.status = "a_valider";
      campPending.submittedAt = new Date(
        Date.now() - 3600 * 1000 * 4,
      ).toISOString();
      store.campaigns.set(
        campPending.id,
        campPending as unknown as Record<string, unknown>,
      );

      const res = await app.inject({
        method: "GET",
        url: "/api/backoffice/campaigns?status=a_valider&limit=10&page=1",
        headers: { authorization: `Bearer ${agentToken}` },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.items).toBeDefined();
      expect(Array.isArray(json.items)).toBe(true);
      expect(json.page).toBe(1);
      expect(json.limit).toBe(10);
      expect(json.metrics).toBeDefined();
      expect(json.metrics.totalPending).toBeGreaterThanOrEqual(1);
      expect(json.metrics.oldestPendingHours).toBeGreaterThanOrEqual(4);
    });

    it("modère une campagne via la route unifiée POST /moderate (publier ou refuser) (RG89)", async () => {
      // Test refus unifié
      const campToReject = campaignService.createDraft(SEED_IDS.ADVERTISER_1, {
        title: "Campagne Pour Refus Unifié",
      });
      campToReject.status = "a_valider";
      store.campaigns.set(
        campToReject.id,
        campToReject as unknown as Record<string, unknown>,
      );

      const rejectRes = await app.inject({
        method: "POST",
        url: `/api/backoffice/campaigns/${campToReject.id}/moderate`,
        headers: { authorization: `Bearer ${agentToken}` },
        payload: {
          decision: "reject",
          reason: "coordonnee_directe",
          comment: "Numéro de téléphone trouvé dans le résumé.",
        },
      });
      expect(rejectRes.statusCode).toBe(200);
      expect(rejectRes.json().campaign.status).toBe("refusee");
      expect(rejectRes.json().campaign.rejectionReason).toBe(
        "coordonnee_directe",
      );

      // Test publication unifiée (non sensible)
      const campToPublish = campaignService.createDraft(SEED_IDS.ADVERTISER_1, {
        title: "Campagne Pour Publication Unifiée",
        productCategory: "mode",
      });
      campToPublish.status = "a_valider";
      store.campaigns.set(
        campToPublish.id,
        campToPublish as unknown as Record<string, unknown>,
      );

      const publishRes = await app.inject({
        method: "POST",
        url: `/api/backoffice/campaigns/${campToPublish.id}/moderate`,
        headers: { authorization: `Bearer ${agentToken}` },
        payload: {
          decision: "publish",
        },
      });
      expect(publishRes.statusCode).toBe(200);
      expect(publishRes.json().campaign.status).toBe("publiee");
    });
  });

  describe("Mission 3.7 : Fil des Campagnes Créateur (C5, RG13 à RG36)", () => {
    it("interdit l'accès au fil si non authentifié (401) ou rôle annonceur (403)", async () => {
      const unauth = await app.inject({
        method: "GET",
        url: "/api/campaigns/feed",
      });
      expect(unauth.statusCode).toBe(401);

      const advForbidden = await app.inject({
        method: "GET",
        url: "/api/campaigns/feed",
        headers: { authorization: `Bearer ${advertiserToken}` },
      });
      expect(advForbidden.statusCode).toBe(403);
    });

    it("sert le fil aux créateurs connectés avec les 5 conditions RG14 et zéro fuite interne (RG37, RG38)", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/campaigns/feed",
        headers: { authorization: `Bearer ${creatorToken}` },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.items).toBeDefined();
      expect(Array.isArray(json.items)).toBe(true);
      expect(json.total).toBeGreaterThanOrEqual(1);

      // Vérification zéro fuite de données (RG37, RG38)
      for (const item of json.items) {
        expect(item.id).toBeDefined();
        expect(item.title).toBeDefined();
        expect(item.brandName).toBeDefined();
        expect(item.compensationNature).toBeDefined();
        // Données strictement interdites côté créateur
        expect((item as any).totalBudgetMinor).toBeUndefined();
        expect((item as any).contactEmail).toBeUndefined();
        expect((item as any).contactPhone).toBeUndefined();
        expect((item as any).internalNotes).toBeUndefined();
        expect((item as any).applicationsCount).toBeUndefined();
      }

      // Vérification journalisation de la requête (RG32)
      const queries = Array.from(store.searchQueries.values());
      expect(queries.some((q) => q.viewMode === "creator_feed")).toBe(true);
    });

    it("applique l'exclusion silencieuse E6 sur les secteurs refusés par le créateur (RG42)", async () => {
      // Configurer un secteur refusé sur le profil de Lucas
      const lucasProfile = creatorProfileService.getProfileByAccountId(
        SEED_IDS.CREATOR_1,
      );
      if (lucasProfile) {
        lucasProfile.refusedSectors = ["High-Tech & Accessoires"];
        store.creatorProfiles.set(
          lucasProfile.accountId,
          lucasProfile as unknown as Record<string, unknown>,
        );
      }

      const res = await app.inject({
        method: "GET",
        url: "/api/campaigns/feed",
        headers: { authorization: `Bearer ${creatorToken}` },
      });

      expect(res.statusCode).toBe(200);
      const items = res.json().items;
      // La campagne TechNova (High-Tech & Accessoires) est exclue SILENCIEUSEMENT
      expect(items.some((i: any) => i.id === SEED_IDS.CAMPAIGN_2)).toBe(false);
      // La campagne cosmétique reste visible
      expect(items.some((i: any) => i.id === SEED_IDS.CAMPAIGN_1)).toBe(true);
    });

    it("applique les filtres C1 (thématiques) et C5 (rémunération avec devise RG28)", async () => {
      // Filtre thématique 'beaute'
      const resTopics = await app.inject({
        method: "GET",
        url: "/api/campaigns/feed?topics=beaute",
        headers: { authorization: `Bearer ${creatorToken}` },
      });
      expect(resTopics.statusCode).toBe(200);
      expect(
        resTopics
          .json()
          .items.every((i: any) => i.targetTopics.includes("beaute")),
      ).toBe(true);

      // Filtre rémunération sans devise -> Erreur 400 (RG28)
      const resNoCurrency = await app.inject({
        method: "GET",
        url: "/api/campaigns/feed?minCompensationMinor=100000",
        headers: { authorization: `Bearer ${creatorToken}` },
      });
      expect(resNoCurrency.statusCode).toBe(400);

      // Filtre rémunération avec devise
      const resWithCurrency = await app.inject({
        method: "GET",
        url: "/api/campaigns/feed?minCompensationMinor=100000&currency=EUR",
        headers: { authorization: `Bearer ${creatorToken}` },
      });
      expect(resWithCurrency.statusCode).toBe(200);
    });

    it("journalise la consultation d'une fiche de campagne (RG22)", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/campaigns/public/${SEED_IDS.CAMPAIGN_1}`,
        headers: { authorization: `Bearer ${creatorToken}` },
      });

      expect(res.statusCode).toBe(200);

      // Vérifie l'événement d'audit
      const auditEvents = store.auditEvents;
      const viewEvent = auditEvents.find(
        (e) =>
          e.eventType === "campaign.viewed_by_creator" &&
          e.payload.campaignId === SEED_IDS.CAMPAIGN_1,
      );
      expect(viewEvent).toBeDefined();
      expect(viewEvent?.accountId).toBe(SEED_IDS.CREATOR_1);
    });
  });
});
