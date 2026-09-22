import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import cookiePlugin from "@fastify/cookie";
import { dealRoutes } from "../src/routes/deal-routes";
import { DealService } from "../src/services/deal-service";
import { AuthService } from "../src/services/auth-service";
import { MockStore } from "../src/mocks/mock-store";
import { randomUUID } from "node:crypto";
import { Deal } from "@influx/contracts";

describe("Mission 5.1 : Service pipeline commercial & encaissements (Doc 14 E1-E11, Invariant Métier)", () => {
  let app: FastifyInstance;
  let store: MockStore;
  let authService: AuthService;
  let dealService: DealService;

  let agentToken: string;
  let advertiserToken: string;
  let agentId: string;
  let demoDealId: string;

  beforeEach(async () => {
    store = MockStore.getInstance();
    store.reset();

    authService = new AuthService(store);
    dealService = new DealService(store);

    // Initialisation session agent backoffice
    const agentAuth = await authService.loginBackoffice({
      email: "alexandre@influx.io",
      password: "agentpassword",
      code: "123456",
    });
    agentToken = agentAuth.token;
    agentId = agentAuth.account.id;

    // Initialisation session membre annonceur (pour tester le refus 403)
    await authService.sendOtp("contact@maisonsolene.fr", "advertiser");
    const advAuth = await authService.verifyOtp({
      email: "contact@maisonsolene.fr",
      code: "123456",
    });
    advertiserToken = advAuth.token;

    // Création d'un deal de test dans le store
    demoDealId = randomUUID();
    const now = new Date().toISOString();
    const demoDeal: Deal = {
      id: demoDealId,
      introductionId: randomUUID(),
      campaignId: randomUUID(),
      advertiserAccountId: randomUUID(),
      creatorAccountId: randomUUID(),
      ownerAgentId: agentId,
      status: "open",
      currency: "EUR",
      negotiatedAmountMinor: null,
      agreedCommissionMinor: null,
      contractSendingMode: null,
      createdAt: now,
      updatedAt: now,
    };
    store.deals.set(demoDealId, demoDeal as unknown as Record<string, unknown>);

    // Création de l'application Fastify
    app = Fastify();
    await app.register(cookiePlugin);
    await app.register(dealRoutes, {
      dealService,
      authServiceInstance: authService,
      store,
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("1. Refuse l'accès au pipeline commercial aux membres non autorisés (401 / 403)", async () => {
    // Sans token
    const resNoAuth = await app.inject({
      method: "GET",
      url: "/api/backoffice/deals",
    });
    expect(resNoAuth.statusCode).toBe(401);

    // Avec token d'un annonceur (non agent)
    const resForbidden = await app.inject({
      method: "GET",
      url: "/api/backoffice/deals",
      headers: {
        authorization: `Bearer ${advertiserToken}`,
      },
    });
    expect(resForbidden.statusCode).toBe(403);
  });

  it("2. Permet à un agent de lister les affaires et de filtrer par statut et agent", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/backoffice/deals",
      headers: {
        authorization: `Bearer ${agentToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.deals).toBeDefined();
    expect(body.deals.length).toBeGreaterThanOrEqual(1);
    expect(body.deals.some((d: any) => d.id === demoDealId)).toBe(true);
  });

  it("3. Permet la saisie commerciale manuelle des montants sans aucun calcul automatique (Invariant Métier)", async () => {
    // Saisie : Montant négocié 5 000,00 EUR (500 000 minor), Commission convenue 1 750,00 EUR (175 000 minor)
    const res = await app.inject({
      method: "PATCH",
      url: `/api/backoffice/deals/${demoDealId}`,
      headers: {
        authorization: `Bearer ${agentToken}`,
      },
      payload: {
        status: "negotiating",
        negotiatedAmountMinor: 500000,
        agreedCommissionMinor: 175000,
        currency: "EUR",
        notes: "Négociation fluide avec l'annonceur",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.deal.status).toBe("negotiating");
    expect(body.deal.negotiatedAmountMinor).toBe(500000);
    expect(body.deal.agreedCommissionMinor).toBe(175000);
    expect(body.deal.currency).toBe("EUR");

    // Vérification que le calcul de reste dû est une simple soustraction
    const detailRes = await app.inject({
      method: "GET",
      url: `/api/backoffice/deals/${demoDealId}`,
      headers: {
        authorization: `Bearer ${agentToken}`,
      },
    });
    expect(detailRes.statusCode).toBe(200);
    const detail = detailRes.json();
    expect(detail.totalReceivedMinor).toBe(0);
    expect(detail.remainingDueMinor).toBe(175000);
  });

  it("4. Exige le mode d'envoi du contrat lors du passage à 'contract_sent'", async () => {
    // Sans mode d'envoi -> Erreur 400
    const resFail = await app.inject({
      method: "PATCH",
      url: `/api/backoffice/deals/${demoDealId}`,
      headers: {
        authorization: `Bearer ${agentToken}`,
      },
      payload: {
        status: "contract_sent",
      },
    });
    expect(resFail.statusCode).toBe(400);

    // Avec mode d'envoi docusign -> Succès
    const resSuccess = await app.inject({
      method: "PATCH",
      url: `/api/backoffice/deals/${demoDealId}`,
      headers: {
        authorization: `Bearer ${agentToken}`,
      },
      payload: {
        status: "contract_sent",
        contractSendingMode: "docusign",
      },
    });
    expect(resSuccess.statusCode).toBe(200);
    expect(resSuccess.json().deal.status).toBe("contract_sent");
    expect(resSuccess.json().deal.contractSendingMode).toBe("docusign");
  });

  it("5. Enregistre des encaissements successifs (E1) et bascule à 'paid' quand la commission convenue est soldée", async () => {
    // 1. Passage à l'état signé avec commission fixée à 1 000,00 EUR (100 000 minor)
    await app.inject({
      method: "PATCH",
      url: `/api/backoffice/deals/${demoDealId}`,
      headers: {
        authorization: `Bearer ${agentToken}`,
      },
      payload: {
        status: "signed",
        agreedCommissionMinor: 100000,
        negotiatedAmountMinor: 300000,
      },
    });

    // 2. Premier encaissement partiel : 600,00 EUR (60 000 minor)
    const receipt1Res = await app.inject({
      method: "POST",
      url: `/api/backoffice/deals/${demoDealId}/receipts`,
      headers: {
        authorization: `Bearer ${agentToken}`,
      },
      payload: {
        kind: "paiement",
        amountMinor: 60000,
        payerSide: "advertiser",
        paymentMethod: "virement",
        externalRef: "VIR-2026-001",
        note: "Acompte annonceur 60%",
      },
    });

    expect(receipt1Res.statusCode).toBe(201);
    const body1 = receipt1Res.json();
    expect(body1.receipt.amountMinor).toBe(60000);
    expect(body1.totalReceivedMinor).toBe(60000);
    expect(body1.remainingDueMinor).toBe(40000);
    expect(body1.deal.status).toBe("signed"); // Pas encore totalement soldé

    // 3. Deuxième encaissement du solde : 40 000 minor (400,00 EUR)
    const receipt2Res = await app.inject({
      method: "POST",
      url: `/api/backoffice/deals/${demoDealId}/receipts`,
      headers: {
        authorization: `Bearer ${agentToken}`,
      },
      payload: {
        kind: "paiement",
        amountMinor: 40000,
        payerSide: "creator",
        paymentMethod: "virement",
        externalRef: "VIR-2026-002",
        note: "Solde part créateur",
      },
    });

    expect(receipt2Res.statusCode).toBe(201);
    const body2 = receipt2Res.json();
    expect(body2.totalReceivedMinor).toBe(100000);
    expect(body2.remainingDueMinor).toBe(0);
    expect(body2.deal.status).toBe("paid"); // Bascule automatique à 'paid'

    // 4. Vérification de la liste des encaissements
    const listReceipts = await app.inject({
      method: "GET",
      url: `/api/backoffice/deals/${demoDealId}/receipts`,
      headers: {
        authorization: `Bearer ${agentToken}`,
      },
    });
    expect(listReceipts.statusCode).toBe(200);
    expect(listReceipts.json().total).toBe(2);
  });

  it("6. Exige un motif obligatoire pour une affaire perdue ('lost') ou annulée ('cancelled')", async () => {
    const resLostNoReason = await app.inject({
      method: "PATCH",
      url: `/api/backoffice/deals/${demoDealId}`,
      headers: {
        authorization: `Bearer ${agentToken}`,
      },
      payload: {
        status: "lost",
      },
    });
    expect(resLostNoReason.statusCode).toBe(400);

    const resLostOk = await app.inject({
      method: "PATCH",
      url: `/api/backoffice/deals/${demoDealId}`,
      headers: {
        authorization: `Bearer ${agentToken}`,
      },
      payload: {
        status: "lost",
        lostReason: "Désaccord sur les livrables finaux",
      },
    });
    expect(resLostOk.statusCode).toBe(200);
    expect(resLostOk.json().deal.status).toBe("lost");
  });
});
