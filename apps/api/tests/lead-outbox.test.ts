import { describe, it, expect, beforeEach } from "vitest";
import Fastify from "fastify";
import {
  leadOutboxService,
  LeadOutboxService,
} from "../src/services/lead-outbox-service";
import { leadRoutes } from "../src/routes/lead-routes";
import { MockStore } from "../src/mocks/mock-store";

describe("Mission 1.3 : Outbox Événementielle & Workers Brevo/Apollo", () => {
  let app: ReturnType<typeof Fastify>;
  let customService: LeadOutboxService;
  let store: MockStore;

  beforeEach(async () => {
    store = MockStore.getInstance();
    store.reset();
    customService = new LeadOutboxService(store);
    leadOutboxService.reset();

    app = Fastify();
    await app.register(leadRoutes, { service: customService });
    await app.ready();
  });

  describe("Service LeadOutboxService", () => {
    it("enregistre un lead annonceur et le synchronise avec Brevo et Apollo", async () => {
      const event = await customService.recordLead({
        email: "contact@techbrand.io",
        role: "advertiser",
        language: "fr",
        countryCode: "FR",
        marketingConsent: true,
      });

      expect(event.eventType).toBe("lead.created");
      expect(event.status).toBe("synced");
      expect(event.attempts).toBe(1);
      expect(event.lastError).toBeNull();

      // Vérifie la synchronisation Brevo (segmentation rôle + langue)
      const brevo = customService.getBrevoContact("contact@techbrand.io");
      expect(brevo).toBeDefined();
      expect(brevo?.listName).toBe("leads_advertiser_fr");
      expect(brevo?.marketingConsent).toBe(true);

      // Vérifie la synchronisation Apollo (enrichissement B2B pour les annonceurs)
      const apollo = customService.getApolloLead("contact@techbrand.io");
      expect(apollo).toBeDefined();
      expect(apollo?.enriched).toBe(true);
      expect(apollo?.domain).toBe("techbrand.io");
      expect(apollo?.b2bData.inferredCompany).toBe("TECHBRAND");
    });

    it("enregistre un lead créateur avec Brevo sans enrichissement B2B Apollo", async () => {
      const event = await customService.recordLead({
        email: "lucas@creator.fr",
        role: "creator",
        language: "en",
        countryCode: "FR",
      });

      expect(event.status).toBe("synced");

      const brevo = customService.getBrevoContact("lucas@creator.fr");
      expect(brevo).toBeDefined();
      expect(brevo?.listName).toBe("leads_creator_en");

      const apollo = customService.getApolloLead("lucas@creator.fr");
      expect(apollo).toBeUndefined();
    });

    it("bascule en statut failed lors d'un échec de synchronisation", async () => {
      const event = await customService.recordLead({
        email: "fail@example.com",
        role: "advertiser",
        simulateFailure: true,
      });

      expect(event.status).toBe("failed");
      expect(event.attempts).toBe(1);
      expect(event.lastError).toContain("Erreur de connexion API simulée");
    });

    it("rejoue un lead en échec avec succès", async () => {
      const event = await customService.recordLead({
        email: "retry@example.com",
        role: "advertiser",
        simulateFailure: true,
      });
      expect(event.status).toBe("failed");

      const replayed = await customService.replayLead(event.id);
      expect(replayed.status).toBe("synced");
      expect(replayed.attempts).toBe(2);
      expect(replayed.lastError).toBeNull();
    });

    it("échoue lors du rejeu d'un ID inexistant", async () => {
      await expect(customService.replayLead("non-existent-id")).rejects.toThrow(
        "Lead introuvable",
      );
    });
  });

  describe("Routes HTTP Fastify - Backoffice Leads", () => {
    it("GET /api/backoffice/leads renvoie la liste et les compteurs d'état", async () => {
      await customService.recordLead({
        email: "synced1@brand.fr",
        role: "advertiser",
      });
      await customService.recordLead({
        email: "failed1@brand.fr",
        role: "advertiser",
        simulateFailure: true,
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/backoffice/leads",
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.total).toBe(2);
      expect(body.synced).toBe(1);
      expect(body.failed).toBe(1);
      expect(body.leads.length).toBe(2);
    });

    it("POST /api/backoffice/leads crée un nouveau lead", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/backoffice/leads",
        payload: {
          email: "nouveau-lead@marque.com",
          role: "advertiser",
          language: "fr",
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.lead.status).toBe("synced");
    });

    it("POST /api/backoffice/leads rejette un rôle invalide", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/backoffice/leads",
        payload: {
          email: "admin@influx.io",
          role: "admin",
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expect(body.error).toBe("ValidationError");
    });

    it("POST /api/backoffice/leads/:id/replay rejoue un lead en échec", async () => {
      const failedEvent = await customService.recordLead({
        email: "test-replay@brand.io",
        role: "advertiser",
        simulateFailure: true,
      });
      expect(failedEvent.status).toBe("failed");

      const res = await app.inject({
        method: "POST",
        url: `/api/backoffice/leads/${failedEvent.id}/replay`,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.lead.status).toBe("synced");
      expect(body.lead.attempts).toBe(2);
    });

    it("POST /api/backoffice/leads/:id/replay renvoie 404 pour un lead inexistant", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/backoffice/leads/unknown-id-1234/replay",
      });

      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.payload);
      expect(body.error).toBe("NotFound");
    });
  });
});
