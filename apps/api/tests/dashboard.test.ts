import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import cookiePlugin from "@fastify/cookie";
import { dashboardRoutes } from "../src/routes/dashboard-routes";
import { DashboardService } from "../src/services/dashboard-service";
import { AuthService } from "../src/services/auth-service";
import { MockStore } from "../src/mocks/mock-store";
import { randomUUID } from "node:crypto";
import { CommissionReceipt, Deal } from "@influx/contracts";

describe("Mission 5.3 : Tableau de bord & métriques SLA (Doc 15 §Tableau de bord, CA1 à CA4)", () => {
  let app: FastifyInstance;
  let store: MockStore;
  let authService: AuthService;
  let dashboardService: DashboardService;

  let agentToken: string;
  let advertiserToken: string;
  let agentId: string;

  beforeEach(async () => {
    store = MockStore.getInstance();
    store.reset();

    authService = new AuthService(store);
    dashboardService = new DashboardService(store);

    const agentAuth = await authService.loginBackoffice({
      email: "alexandre@influx.io",
      password: "agentpassword",
      code: "123456",
    });
    agentToken = agentAuth.token;
    agentId = agentAuth.account.id;

    await authService.sendOtp("contact@maisonsolene.fr", "advertiser");
    const advAuth = await authService.verifyOtp({
      email: "contact@maisonsolene.fr",
      code: "123456",
    });
    advertiserToken = advAuth.token;

    app = Fastify();
    await app.register(cookiePlugin);
    await app.register(dashboardRoutes, {
      dashboardService,
      authServiceInstance: authService,
      store,
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("1. Refuse l'accès au tableau de bord aux non-agents (401 / 403)", async () => {
    const resNoAuth = await app.inject({
      method: "GET",
      url: "/api/backoffice/dashboard/kpis",
    });
    expect(resNoAuth.statusCode).toBe(401);

    const resForbidden = await app.inject({
      method: "GET",
      url: "/api/backoffice/dashboard/kpis",
      headers: {
        authorization: `Bearer ${advertiserToken}`,
      },
    });
    expect(resForbidden.statusCode).toBe(403);
  });

  it("2. Regroupe les encaissements STRICTEMENT par devise sans aucun mélange ni total global (CA4)", async () => {
    const now = new Date().toISOString();

    // Receipt en EUR : 1 200,00 EUR (120 000 minor)
    const receiptEur: CommissionReceipt = {
      id: randomUUID(),
      dealId: randomUUID(),
      kind: "paiement",
      amountMinor: 120000,
      currency: "EUR",
      receivedOn: "2026-09-20",
      payerSide: "advertiser",
      paymentMethod: "virement",
      externalRef: "VIR-EUR-1",
      note: null,
      recordedByAccountId: agentId,
      recordedAt: now,
    };
    store.commissionReceipts.set(
      receiptEur.id,
      receiptEur as unknown as Record<string, unknown>,
    );

    // Receipt en USD : 500,00 USD (50 000 minor)
    const receiptUsd: CommissionReceipt = {
      id: randomUUID(),
      dealId: randomUUID(),
      kind: "paiement",
      amountMinor: 50000,
      currency: "USD",
      receivedOn: "2026-09-21",
      payerSide: "creator",
      paymentMethod: "carte",
      externalRef: "CARTE-USD-1",
      note: null,
      recordedByAccountId: agentId,
      recordedAt: now,
    };
    store.commissionReceipts.set(
      receiptUsd.id,
      receiptUsd as unknown as Record<string, unknown>,
    );

    const res = await app.inject({
      method: "GET",
      url: "/api/backoffice/dashboard/kpis",
      headers: {
        authorization: `Bearer ${agentToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.commissionsByCurrency.EUR).toBeDefined();
    expect(body.commissionsByCurrency.EUR.totalMinor).toBe(120000);
    expect(body.commissionsByCurrency.USD).toBeDefined();
    expect(body.commissionsByCurrency.USD.totalMinor).toBe(50000);

    // Vérifie qu'aucun champ "totalGlobal" ou somme multi-devises n'existe
    expect(body.totalCommissions).toBeUndefined();
    expect(body.globalTotal).toBeUndefined();
  });

  it("3. Calcule le nombre d'affaires actives par commercial", async () => {
    const now = new Date().toISOString();
    const deal1: Deal = {
      id: randomUUID(),
      introductionId: randomUUID(),
      campaignId: null,
      advertiserAccountId: randomUUID(),
      creatorAccountId: randomUUID(),
      ownerAgentId: agentId,
      status: "negotiating",
      currency: "EUR",
      negotiatedAmountMinor: 400000,
      agreedCommissionMinor: 140000,
      contractSendingMode: null,
      createdAt: now,
      updatedAt: now,
    };
    store.deals.set(deal1.id, deal1 as unknown as Record<string, unknown>);

    const res = await app.inject({
      method: "GET",
      url: "/api/backoffice/dashboard/kpis",
      headers: {
        authorization: `Bearer ${agentToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.summaryMetrics.activeDealsCount).toBeGreaterThanOrEqual(1);

    const agentMetric = body.activeDealsByAgent.find(
      (a: any) => a.agentId === agentId,
    );
    expect(agentMetric).toBeDefined();
    expect(agentMetric.activeDealsCount).toBeGreaterThanOrEqual(1);
  });

  it("4. Détecte et remonte les alertes SLA en cas de dépassement de délai", async () => {
    // Création d'une demande de vérification dont la date SLA est échue depuis 2 heures
    const pastSla = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
    const verifId = randomUUID();
    store.verificationRequests.set(verifId, {
      id: verifId,
      status: "submitted",
      type: "identity",
      createdAt: new Date(Date.now() - 26 * 3600 * 1000).toISOString(),
      slaDueAt: pastSla,
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/backoffice/dashboard/kpis",
      headers: {
        authorization: `Bearer ${agentToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.slaAlerts.length).toBeGreaterThanOrEqual(1);
    const breach = body.slaAlerts.find((a: any) => a.id === verifId);
    expect(breach).toBeDefined();
    expect(breach.isOverdue).toBe(true);
    expect(breach.overdueHours).toBeGreaterThanOrEqual(1);
  });
});
