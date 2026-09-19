import { randomUUID } from "node:crypto";
import { MockStore, OutboxEventRecord } from "../mocks/mock-store";

export interface BrevoContact {
  email: string;
  role: string;
  language: string;
  countryCode: string;
  listName: string;
  marketingConsent: boolean;
  syncedAt: string;
}

export interface ApolloLead {
  email: string;
  role: string;
  domain: string;
  enriched: boolean;
  b2bData: {
    inferredCompany: string;
    targetSegment: string;
  };
  syncedAt: string;
}

export class LeadOutboxService {
  private store: MockStore;
  private brevoContacts: Map<string, BrevoContact> = new Map();
  private apolloLeads: Map<string, ApolloLead> = new Map();

  constructor(store?: MockStore) {
    this.store = store ?? MockStore.getInstance();
  }

  /**
   * Enregistrement d'un événement lead.created dans l'outbox
   * et déclenchement automatique du worker simulé
   */
  async recordLead(params: {
    accountId?: string;
    email: string;
    role: "advertiser" | "creator" | string;
    language?: string;
    countryCode?: string;
    marketingConsent?: boolean;
    simulateFailure?: boolean;
  }): Promise<OutboxEventRecord> {
    const event: OutboxEventRecord = {
      id: randomUUID(),
      eventType: "lead.created",
      payload: {
        accountId: params.accountId ?? randomUUID(),
        email: params.email.trim().toLowerCase(),
        role: params.role,
        language: params.language ?? "fr",
        countryCode: params.countryCode ?? "FR",
        marketingConsent: params.marketingConsent ?? false,
        simulateFailure: params.simulateFailure ?? false,
      },
      status: "pending",
      attempts: 0,
      lastError: null,
      createdAt: new Date().toISOString(),
    };

    this.store.outboxEvents.push(event);
    await this.processEvent(event);
    return event;
  }

  /**
   * Traitement du worker simulé : Brevo + Apollo
   */
  async processEvent(event: OutboxEventRecord): Promise<void> {
    event.attempts += 1;
    const payload = event.payload as {
      email: string;
      role: string;
      language: string;
      countryCode: string;
      marketingConsent: boolean;
      simulateFailure?: boolean;
    };

    try {
      if (payload.simulateFailure) {
        throw new Error("Erreur de connexion API simulée");
      }

      // 1. Worker Brevo : segmentation selon rôle, langue et pays
      const listName = `leads_${payload.role}_${payload.language}`;
      const brevoContact: BrevoContact = {
        email: payload.email,
        role: payload.role,
        language: payload.language,
        countryCode: payload.countryCode,
        listName,
        marketingConsent: Boolean(payload.marketingConsent),
        syncedAt: new Date().toISOString(),
      };
      this.brevoContacts.set(payload.email, brevoContact);

      // 2. Worker Apollo : enrichissement B2B pour les annonceurs (CLAUDE §8)
      if (payload.role === "advertiser") {
        const domain = payload.email.split("@")[1] || "unknown.com";
        const companyName = domain.split(".")[0] || "COMPANY";
        const apolloLead: ApolloLead = {
          email: payload.email,
          role: payload.role,
          domain,
          enriched: true,
          b2bData: {
            inferredCompany: companyName.toUpperCase(),
            targetSegment: "B2B_ADVERTISER",
          },
          syncedAt: new Date().toISOString(),
        };
        this.apolloLeads.set(payload.email, apolloLead);
      }

      event.status = "synced";
      event.lastError = null;
    } catch (err: any) {
      event.status = "failed";
      event.lastError =
        err.message || "Erreur inconnue lors de la synchronisation du lead";
    }
  }

  /**
   * Consultation de l'ensemble des leads de l'outbox
   */
  getLeads(): OutboxEventRecord[] {
    return this.store.outboxEvents;
  }

  /**
   * Recherche un lead par son ID
   */
  getLeadById(id: string): OutboxEventRecord | undefined {
    return this.store.outboxEvents.find((e) => e.id === id);
  }

  /**
   * Rejeu manuel d'un lead (depuis le backoffice)
   */
  async replayLead(id: string): Promise<OutboxEventRecord> {
    const event = this.getLeadById(id);
    if (!event) {
      throw new Error(`Lead introuvable avec l'ID: ${id}`);
    }

    // Réinitialise la simulation d'erreur si elle avait été activée
    if (event.payload && (event.payload as any).simulateFailure) {
      (event.payload as any).simulateFailure = false;
    }

    await this.processEvent(event);
    return event;
  }

  getBrevoContact(email: string): BrevoContact | undefined {
    return this.brevoContacts.get(email.toLowerCase());
  }

  getApolloLead(email: string): ApolloLead | undefined {
    return this.apolloLeads.get(email.toLowerCase());
  }

  reset(): void {
    this.brevoContacts.clear();
    this.apolloLeads.clear();
  }
}

export const leadOutboxService = new LeadOutboxService();
