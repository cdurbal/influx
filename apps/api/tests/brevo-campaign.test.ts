import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import cookiePlugin from "@fastify/cookie";
import { brevoCampaignRoutes } from "../src/routes/brevo-campaign-routes";
import { BrevoCampaignService } from "../src/services/brevo-campaign-service";
import { AuthService } from "../src/services/auth-service";
import { MockStore } from "../src/mocks/mock-store";

describe("Mission 5.5 : Campagnes e-mails Brevo depuis le Backoffice (Doc 16)", () => {
  let app: FastifyInstance;
  let store: MockStore;
  let authService: AuthService;
  let campaignService: BrevoCampaignService;

  let agentToken: string;
  let advertiserToken: string;

  beforeEach(async () => {
    store = MockStore.getInstance();
    store.reset();

    authService = new AuthService(store);
    campaignService = new BrevoCampaignService(store);

    const agentAuth = await authService.loginBackoffice({
      email: "alexandre@influx.io",
      password: "agentpassword",
      code: "123456",
    });
    agentToken = agentAuth.token;

    await authService.sendOtp("contact@maisonsolene.fr", "advertiser");
    const advAuth = await authService.verifyOtp({
      email: "contact@maisonsolene.fr",
      code: "123456",
    });
    advertiserToken = advAuth.token;

    app = Fastify();
    await app.register(cookiePlugin);
    await app.register(brevoCampaignRoutes, {
      campaignService,
      authServiceInstance: authService,
      store,
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("1. Refuse l'accès aux opérations e-mails aux non-agents (401 / 403)", async () => {
    const resNoAuth = await app.inject({
      method: "GET",
      url: "/api/backoffice/emails/templates",
    });
    expect(resNoAuth.statusCode).toBe(401);

    const resForbidden = await app.inject({
      method: "GET",
      url: "/api/backoffice/emails/templates",
      headers: {
        authorization: `Bearer ${advertiserToken}`,
      },
    });
    expect(resForbidden.statusCode).toBe(403);
  });

  it("2. Récupère le catalogue des modèles et prévisualise un modèle en FR et EN", async () => {
    const resList = await app.inject({
      method: "GET",
      url: "/api/backoffice/emails/templates",
      headers: {
        authorization: `Bearer ${agentToken}`,
      },
    });

    expect(resList.statusCode).toBe(200);
    const { templates } = resList.json();
    expect(templates.length).toBeGreaterThanOrEqual(2);

    const templateId = templates[0].id;

    // Prévisualisation FR
    const resFr = await app.inject({
      method: "POST",
      url: "/api/backoffice/emails/preview",
      headers: {
        authorization: `Bearer ${agentToken}`,
      },
      payload: {
        templateId,
        lang: "fr",
      },
    });
    expect(resFr.statusCode).toBe(200);
    expect(resFr.json().subject).toBeDefined();
    expect(resFr.json().body).toBeDefined();

    // Prévisualisation EN
    const resEn = await app.inject({
      method: "POST",
      url: "/api/backoffice/emails/preview",
      headers: {
        authorization: `Bearer ${agentToken}`,
      },
      payload: {
        templateId,
        lang: "en",
      },
    });
    expect(resEn.statusCode).toBe(200);
    expect(resEn.json().subject).toBeDefined();
  });

  it("3. Estime l'audience selon la source (contacts plateforme, segments Brevo, prospect unitaire)", async () => {
    // Source 1 : Contacts plateforme
    const resSource1 = await app.inject({
      method: "POST",
      url: "/api/backoffice/emails/estimate",
      headers: {
        authorization: `Bearer ${agentToken}`,
      },
      payload: {
        audienceSource: "platform_contacts",
        targetRole: "creator",
      },
    });
    expect(resSource1.statusCode).toBe(200);
    expect(resSource1.json().estimatedCount).toBeGreaterThanOrEqual(1);

    // Source 3 : Prospect unitaire
    const resSource3 = await app.inject({
      method: "POST",
      url: "/api/backoffice/emails/estimate",
      headers: {
        authorization: `Bearer ${agentToken}`,
      },
      payload: {
        audienceSource: "manual_prospect",
      },
    });
    expect(resSource3.statusCode).toBe(200);
    expect(resSource3.json().estimatedCount).toBe(1);
    expect(resSource3.json().excludedCount).toBe(0);
  });

  it("4. Déclenche un envoi avec fenêtre de grâce de 15 minutes et permet son annulation", async () => {
    // Déclenchement de l'envoi
    const sendRes = await app.inject({
      method: "POST",
      url: "/api/backoffice/emails/send",
      headers: {
        authorization: `Bearer ${agentToken}`,
      },
      payload: {
        templateId: "tpl_creator_onboarding_reminder",
        audienceSource: "platform_contacts",
        targetRole: "creator",
      },
    });

    expect(sendRes.statusCode).toBe(201);
    const { campaign } = sendRes.json();
    expect(campaign.status).toBe("scheduled");
    expect(campaign.cancelGraceUntil).toBeDefined();

    // Vérification de la fenêtre de 15 minutes
    const scheduledAt = new Date(campaign.scheduledAt).getTime();
    const graceUntil = new Date(campaign.cancelGraceUntil).getTime();
    const diffMinutes = Math.round((graceUntil - scheduledAt) / (60 * 1000));
    expect(diffMinutes).toBe(15);

    // Annulation de la campagne pendant la fenêtre
    const cancelRes = await app.inject({
      method: "POST",
      url: `/api/backoffice/emails/${campaign.id}/cancel`,
      headers: {
        authorization: `Bearer ${agentToken}`,
      },
    });

    expect(cancelRes.statusCode).toBe(200);
    expect(cancelRes.json().campaign.status).toBe("cancelled");
    expect(cancelRes.json().campaign.cancelledAt).toBeDefined();
  });

  it("5. Exige un motif de contact de 10 caractères min pour un prospect unitaire", async () => {
    const resShortReason = await app.inject({
      method: "POST",
      url: "/api/backoffice/emails/send",
      headers: {
        authorization: `Bearer ${agentToken}`,
      },
      payload: {
        templateId: "tpl_direct_prospect_outreach",
        audienceSource: "manual_prospect",
        manualRecipient: {
          email: "prospect@test.com",
          firstName: "Jean",
          company: "Test SAS",
          contactReason: "Court", // < 10 caractères
        },
      },
    });

    expect(resShortReason.statusCode).toBe(400);
  });
});
