import { randomUUID } from "node:crypto";
import {
  type BrevoCampaign,
  type BrevoTemplate,
  type EstimateAudienceInput,
  type SendBrevoCampaignInput,
  BREVO_TEMPLATES_CATALOG,
  BrevoCampaignSchema,
} from "@influx/contracts";
import { MockStore } from "../mocks/mock-store";

export class BrevoCampaignService {
  constructor(private store: MockStore = MockStore.getInstance()) {}

  public getTemplates(): BrevoTemplate[] {
    return BREVO_TEMPLATES_CATALOG;
  }

  public getTemplateById(templateId: string): BrevoTemplate | undefined {
    return BREVO_TEMPLATES_CATALOG.find((t) => t.id === templateId);
  }

  /**
   * Estimation des destinataires selon la source encadrée (Doc 16 §US2)
   */
  public estimateAudience(input: EstimateAudienceInput): {
    estimatedCount: number;
    excludedCount: number;
    description: string;
  } {
    if (input.audienceSource === "manual_prospect") {
      return {
        estimatedCount: 1,
        excludedCount: 0,
        description: "Envoi unitaire direct (1 prospect qualifié)",
      };
    }

    if (input.audienceSource === "brevo_segments") {
      // Simulation d'un segment synchronisé avec Brevo
      return {
        estimatedCount: 28,
        excludedCount: 3,
        description:
          "Segment Brevo actif (3 contacts exclus pour désinscription ou rebond)",
      };
    }

    // Source 1 : Contacts plateforme consentants
    const accounts = Array.from(this.store.accounts.values());
    const targetRole = input.targetRole || "both";

    let eligible = 0;
    let excluded = 0;

    for (const acc of accounts) {
      if (acc.role === "agent" || acc.role === "admin") continue;
      if (targetRole !== "both" && acc.role !== targetRole) continue;

      // Vérification du consentement
      const consents = Array.from(this.store.consentEvents.values()).filter(
        (c) => c.accountId === acc.id,
      );
      const lastConsent = consents[consents.length - 1];
      const isConsenting =
        lastConsent !== undefined
          ? Boolean(lastConsent.marketingConsent)
          : true; // Consentement initial à l'inscription

      if (isConsenting) {
        eligible += 1;
      } else {
        excluded += 1;
      }
    }

    return {
      estimatedCount: Math.max(eligible, 4), // Minimum réaliste avec le seed
      excludedCount: excluded,
      description: `Contacts plateforme consentants (${targetRole === "both" ? "Annonceurs & Créateurs" : targetRole})`,
    };
  }

  /**
   * Prévisualisation du message avec fusion des variables
   */
  public previewTemplate(
    templateId: string,
    lang: "fr" | "en" = "fr",
    variables: Record<string, string> = {},
  ): { subject: string; body: string } {
    const template = this.getTemplateById(templateId);
    if (!template) {
      throw new Error(`Modèle introuvable : ${templateId}`);
    }

    let subject = lang === "fr" ? template.subjectFr : template.subjectEn;
    let body = lang === "fr" ? template.bodyFr : template.bodyEn;

    const defaultVars = {
      firstName: "Alexandre",
      company: "Acme Corp",
      ...variables,
    };

    for (const [key, val] of Object.entries(defaultVars)) {
      subject = subject.replace(new RegExp(`{{${key}}}`, "g"), val);
      body = body.replace(new RegExp(`{{${key}}}`, "g"), val);
    }

    return { subject, body };
  }

  /**
   * Déclenche un envoi simulé avec délai de grâce d'annulation de 15 minutes (Doc 16)
   */
  public async sendCampaign(
    input: SendBrevoCampaignInput,
    agentId: string,
  ): Promise<BrevoCampaign> {
    const template = this.getTemplateById(input.templateId);
    if (!template) {
      throw new Error(`Modèle de campagne invalide : ${input.templateId}`);
    }

    const now = new Date();
    const nowIso = now.toISOString();
    // Délai de grâce d'annulation de 15 minutes (15 * 60 * 1000 ms)
    const graceUntil = new Date(now.getTime() + 15 * 60 * 1000).toISOString();

    const estimation = this.estimateAudience({
      audienceSource: input.audienceSource,
      targetRole: input.targetRole,
      segmentId: input.segmentId,
    });

    const campaignId = randomUUID();
    const campaign: BrevoCampaign = {
      id: campaignId,
      templateId: template.id,
      templateName: template.name,
      audienceSource: input.audienceSource,
      targetRole: input.targetRole || null,
      segmentId: input.segmentId || null,
      manualRecipient: input.manualRecipient || null,
      status: "scheduled",
      scheduledAt: nowIso,
      cancelGraceUntil: graceUntil,
      sentAt: null,
      cancelledAt: null,
      cancelledByAgentId: null,
      createdByAgentId: agentId,
      estimatedCount: estimation.estimatedCount,
      excludedCount: estimation.excludedCount,
      stats: {
        sent: 0,
        opened: 0,
        clicked: 0,
        bounced: 0,
        unsubscribed: 0,
      },
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const validated = BrevoCampaignSchema.parse(campaign);
    this.store.brevoCampaigns.set(
      validated.id,
      validated as unknown as Record<string, unknown>,
    );

    this.store.recordAuditEvent("brevo_campaign_scheduled", {
      campaignId: validated.id,
      templateId: validated.templateId,
      estimatedCount: validated.estimatedCount,
      cancelGraceUntil: validated.cancelGraceUntil,
      agentId,
    });

    return validated;
  }

  /**
   * Annulation immédiate durant la fenêtre de grâce de 15 minutes
   */
  public async cancelCampaign(
    campaignId: string,
    agentId: string,
  ): Promise<BrevoCampaign> {
    const raw = this.store.brevoCampaigns.get(campaignId);
    if (!raw) {
      throw new Error(`Campagne introuvable : ${campaignId}`);
    }
    const campaign = BrevoCampaignSchema.parse(raw);

    if (campaign.status === "cancelled") {
      return campaign;
    }

    const now = new Date();
    const graceLimit = new Date(campaign.cancelGraceUntil);

    if (now > graceLimit && campaign.status === "sent") {
      throw new Error(
        "Le délai de grâce d'annulation de 15 minutes est écoulé. La campagne ne peut plus être annulée.",
      );
    }

    const updated: BrevoCampaign = {
      ...campaign,
      status: "cancelled",
      cancelledAt: now.toISOString(),
      cancelledByAgentId: agentId,
      updatedAt: now.toISOString(),
    };

    const validated = BrevoCampaignSchema.parse(updated);
    this.store.brevoCampaigns.set(
      validated.id,
      validated as unknown as Record<string, unknown>,
    );

    this.store.recordAuditEvent("brevo_campaign_cancelled", {
      campaignId: validated.id,
      agentId,
      cancelledAt: validated.cancelledAt,
    });

    return validated;
  }

  /**
   * Liste des campagnes avec actualisation automatique de l'état si le délai est passé
   */
  public async listCampaigns(): Promise<BrevoCampaign[]> {
    const rawList = Array.from(this.store.brevoCampaigns.values());
    const now = new Date();

    const campaigns: BrevoCampaign[] = [];
    for (const raw of rawList) {
      const c = BrevoCampaignSchema.parse(raw);

      // Si la fenêtre de grâce est échue et que la campagne était scheduled -> bascule automatique à 'sent'
      if (c.status === "scheduled" && now >= new Date(c.cancelGraceUntil)) {
        c.status = "sent";
        c.sentAt = c.cancelGraceUntil;
        c.stats = {
          sent: c.estimatedCount,
          opened: Math.round(c.estimatedCount * 0.45),
          clicked: Math.round(c.estimatedCount * 0.18),
          bounced: 0,
          unsubscribed: 0,
        };
        c.updatedAt = now.toISOString();
        this.store.brevoCampaigns.set(
          c.id,
          c as unknown as Record<string, unknown>,
        );
      }

      campaigns.push(c);
    }

    return campaigns.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }
}
