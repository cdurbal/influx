import { randomUUID } from "node:crypto";
import {
  type Account,
  type Introduction,
  type IntroductionStatus,
  type BrandContactRequest,
  type CreatorApplyRequest,
  type InfluxProposalRequest,
  type IntroductionDecision,
  IntroductionSchema,
} from "@influx/contracts";
import { MockStore } from "../mocks/mock-store";
import { RevealService } from "./reveal-service";

export interface IntroductionServiceError {
  status: number;
  code: string;
  message: string;
}

export class IntroductionService {
  private store: MockStore;

  constructor(store?: MockStore) {
    this.store = store ?? MockStore.getInstance();
  }

  /**
   * Génère une référence lisible formatée : MER-YYYY-NNNNNN (RG-M1)
   */
  private generateReference(): string {
    const year = new Date().getFullYear();
    const count = this.store.introductions.size + 1;
    return `MER-${year}-${count.toString().padStart(6, "0")}`;
  }

  /**
   * Calcule le délai SLA pour la prise en charge (1 jour ouvré par défaut, D39)
   */
  private calculateSlaDueAt(): string {
    return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  }

  /**
   * Vérifie si une mise en relation active existe déjà pour ce couple marque / créateur
   * sur la campagne donnée (ou hors campagne si campaignId est null).
   */
  private findActiveIntroduction(
    advertiserAccountId: string,
    creatorAccountId: string,
    campaignId?: string | null,
  ): Introduction | null {
    for (const raw of this.store.introductions.values()) {
      const intro = raw as unknown as Introduction;
      const isSameAdvertiser =
        intro.advertiserAccountId === advertiserAccountId;
      const isSameCreator = intro.creatorAccountId === creatorAccountId;
      const isSameCampaign =
        (intro.campaignId ?? null) === (campaignId ?? null);

      if (isSameAdvertiser && isSameCreator && isSameCampaign) {
        // Est considérée active si elle n'est ni rejetée, ni retirée, ni expirée
        if (!["rejected", "withdrawn", "expired"].includes(intro.status)) {
          return intro;
        }
      }
    }
    return null;
  }

  /**
   * DÉCLENCHEUR 1 : Demande de contact marque (sur profil créateur anonymisé)
   * - Vérifie le rôle annonceur
   * - Contrôle l'existence du créateur
   * - Contrôle la campagne si fournie (doit appartenir à la marque)
   * - Bloque les doublons
   * - Enregistre en file d'attente (status = pending_review)
   */
  public async createBrandContactRequest(
    advertiserAccount: Account,
    input: BrandContactRequest,
  ): Promise<Introduction> {
    if (advertiserAccount.role !== "advertiser") {
      const err: IntroductionServiceError = {
        status: 403,
        code: "FORBIDDEN",
        message: "Seul un compte annonceur peut initier une demande de contact",
      };
      throw err;
    }

    const creatorAccount = this.store.accounts.get(input.creatorAccountId);
    if (!creatorAccount || creatorAccount.role !== "creator") {
      const err: IntroductionServiceError = {
        status: 404,
        code: "CREATOR_NOT_FOUND",
        message: "Le créateur sélectionné est introuvable",
      };
      throw err;
    }

    if (input.campaignId) {
      const campaign = this.store.campaigns.get(input.campaignId);
      if (!campaign) {
        const err: IntroductionServiceError = {
          status: 404,
          code: "CAMPAIGN_NOT_FOUND",
          message: "La campagne rattachée est introuvable",
        };
        throw err;
      }
      const brandAccountId = (campaign as { brandAccountId?: string })
        .brandAccountId;
      if (brandAccountId !== advertiserAccount.id) {
        const err: IntroductionServiceError = {
          status: 403,
          code: "CAMPAIGN_NOT_OWNED",
          message: "Cette campagne n'appartient pas à l'annonceur connecté",
        };
        throw err;
      }
    }

    const existingActive = this.findActiveIntroduction(
      advertiserAccount.id,
      input.creatorAccountId,
      input.campaignId,
    );
    if (existingActive) {
      const err: IntroductionServiceError = {
        status: 409,
        code: "DUPLICATE_INTRODUCTION",
        message: `Une mise en relation active existe déjà pour ce créateur (${existingActive.reference})`,
      };
      throw err;
    }

    const now = new Date().toISOString();
    const introduction: Introduction = {
      id: randomUUID(),
      reference: this.generateReference(),
      origin: "brand_contact_request",
      originReason: input.message,
      campaignId: input.campaignId ?? null,
      advertiserAccountId: advertiserAccount.id,
      creatorAccountId: input.creatorAccountId,
      ownerAgentId: null,
      claimedByAgentId: null,
      claimedAt: null,
      status: "pending_review",
      rejectionReasonCode: null,
      rejectionReasonComment: null,
      advertiserCountryAtIntro: advertiserAccount.countryCode,
      creatorCountryAtIntro: creatorAccount.countryCode,
      advertiserTermsVersionId: "cgu-v1",
      creatorTermsVersionId: null,
      advertiserAcceptedAt: now,
      creatorAcceptedAt: null,
      identityRevealedAt: null,
      conversationId: null,
      dealId: null,
      slaDueAt: this.calculateSlaDueAt(),
      decidedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    const validated = IntroductionSchema.parse(introduction);
    this.store.introductions.set(
      validated.id,
      validated as unknown as Record<string, unknown>,
    );

    this.store.recordAuditEvent(
      "introduction.brand_contact_requested",
      {
        introductionId: validated.id,
        reference: validated.reference,
        advertiserId: advertiserAccount.id,
        creatorId: input.creatorAccountId,
        campaignId: input.campaignId,
      },
      advertiserAccount.id,
    );

    return validated;
  }

  /**
   * DÉCLENCHEUR 2 : Candidature créateur (depuis campagne publiée)
   * - Vérifie le rôle créateur
   * - Contrôle la campagne (doit être publiée)
   * - Contrôle le plafond de candidatures actives (10 max)
   * - Bloque les doublons
   * - Enregistre en file d'attente (status = pending_review)
   */
  public async createCreatorApplication(
    creatorAccount: Account,
    input: CreatorApplyRequest,
  ): Promise<Introduction> {
    if (creatorAccount.role !== "creator") {
      const err: IntroductionServiceError = {
        status: 403,
        code: "FORBIDDEN",
        message: "Seul un compte créateur peut postuler à une campagne",
      };
      throw err;
    }

    const campaignRaw = this.store.campaigns.get(input.campaignId);
    if (!campaignRaw) {
      const err: IntroductionServiceError = {
        status: 404,
        code: "CAMPAIGN_NOT_FOUND",
        message: "Campagne introuvable",
      };
      throw err;
    }

    const campaign = campaignRaw as { brandAccountId: string; status: string };
    if (campaign.status !== "publiee") {
      const err: IntroductionServiceError = {
        status: 400,
        code: "CAMPAIGN_NOT_OPEN",
        message: "Cette campagne n'est pas ouverte aux candidatures",
      };
      throw err;
    }

    const advertiserAccount = this.store.accounts.get(campaign.brandAccountId);
    if (!advertiserAccount) {
      const err: IntroductionServiceError = {
        status: 404,
        code: "ADVERTISER_NOT_FOUND",
        message: "Annonceur de la campagne introuvable",
      };
      throw err;
    }

    const existingActive = this.findActiveIntroduction(
      campaign.brandAccountId,
      creatorAccount.id,
      input.campaignId,
    );
    if (existingActive) {
      const err: IntroductionServiceError = {
        status: 409,
        code: "DUPLICATE_APPLICATION",
        message: `Vous avez déjà postulé à cette campagne (${existingActive.reference})`,
      };
      throw err;
    }

    // Contrôle du plafond de candidatures actives (10 max simultanées, D38)
    let activeApplicationsCount = 0;
    for (const raw of this.store.introductions.values()) {
      const intro = raw as unknown as Introduction;
      if (
        intro.creatorAccountId === creatorAccount.id &&
        intro.origin === "creator_application" &&
        ["pending_review", "in_review"].includes(intro.status)
      ) {
        activeApplicationsCount++;
      }
    }
    if (activeApplicationsCount >= 10) {
      const err: IntroductionServiceError = {
        status: 429,
        code: "APPLICATION_QUOTA_EXCEEDED",
        message:
          "Plafond de candidatures actives atteint (10 candidatures simultanées autorisées)",
      };
      throw err;
    }

    const now = new Date().toISOString();
    const introduction: Introduction = {
      id: randomUUID(),
      reference: this.generateReference(),
      origin: "creator_application",
      originReason: input.message,
      campaignId: input.campaignId,
      advertiserAccountId: campaign.brandAccountId,
      creatorAccountId: creatorAccount.id,
      ownerAgentId: null,
      claimedByAgentId: null,
      claimedAt: null,
      status: "pending_review",
      rejectionReasonCode: null,
      rejectionReasonComment: null,
      advertiserCountryAtIntro: advertiserAccount.countryCode,
      creatorCountryAtIntro: creatorAccount.countryCode,
      advertiserTermsVersionId: null,
      creatorTermsVersionId: "cgu-v1",
      advertiserAcceptedAt: null,
      creatorAcceptedAt: now,
      identityRevealedAt: null,
      conversationId: null,
      dealId: null,
      slaDueAt: this.calculateSlaDueAt(),
      decidedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    const validated = IntroductionSchema.parse(introduction);
    this.store.introductions.set(
      validated.id,
      validated as unknown as Record<string, unknown>,
    );

    this.store.recordAuditEvent(
      "introduction.creator_applied",
      {
        introductionId: validated.id,
        reference: validated.reference,
        creatorId: creatorAccount.id,
        campaignId: input.campaignId,
      },
      creatorAccount.id,
    );

    return validated;
  }

  /**
   * DÉCLENCHEUR 3 : Proposition INFLUX (Le commercial rapproche)
   * - Vérifie le rôle agent ou admin
   * - Contrôle la campagne
   * - Sélection d'un ou plusieurs créateurs -> génère N objets introduction distincts (Règle 1)
   * - Court-circuite la file de validation : status = approved directement
   * - L'agent devient le responsable (ownerAgentId)
   * - INVARIANT ABSOLU : Le consentement n'est PAS court-circuité. identityRevealedAt = null
   *   tant que les deux parties n'ont pas accepté à l'écran.
   */
  public async createInfluxProposal(
    agentAccount: Account,
    input: InfluxProposalRequest,
  ): Promise<Introduction[]> {
    if (agentAccount.role !== "agent" && agentAccount.role !== "admin") {
      const err: IntroductionServiceError = {
        status: 403,
        code: "FORBIDDEN",
        message:
          "Seul un commercial ou administrateur INFLUX peut émettre une proposition",
      };
      throw err;
    }

    const campaignRaw = this.store.campaigns.get(input.campaignId);
    if (!campaignRaw) {
      const err: IntroductionServiceError = {
        status: 404,
        code: "CAMPAIGN_NOT_FOUND",
        message: "Campagne introuvable",
      };
      throw err;
    }

    const campaign = campaignRaw as { brandAccountId: string; status: string };
    const advertiserAccount = this.store.accounts.get(campaign.brandAccountId);
    if (!advertiserAccount) {
      const err: IntroductionServiceError = {
        status: 404,
        code: "ADVERTISER_NOT_FOUND",
        message: "Annonceur de la campagne introuvable",
      };
      throw err;
    }

    const creatorIds =
      input.creatorAccountIds && input.creatorAccountIds.length > 0
        ? input.creatorAccountIds
        : input.creatorAccountId
          ? [input.creatorAccountId]
          : [];

    if (creatorIds.length === 0) {
      const err: IntroductionServiceError = {
        status: 400,
        code: "NO_CREATOR_SELECTED",
        message: "Au moins un créateur doit être sélectionné",
      };
      throw err;
    }

    const createdList: Introduction[] = [];
    const now = new Date().toISOString();

    for (const creatorId of creatorIds) {
      const creatorAccount = this.store.accounts.get(creatorId);
      if (!creatorAccount || creatorAccount.role !== "creator") {
        const err: IntroductionServiceError = {
          status: 404,
          code: "CREATOR_NOT_FOUND",
          message: `Le créateur ${creatorId} est introuvable`,
        };
        throw err;
      }

      // Vérification anti-doublon
      const existingActive = this.findActiveIntroduction(
        campaign.brandAccountId,
        creatorId,
        input.campaignId,
      );
      if (existingActive) {
        const err: IntroductionServiceError = {
          status: 409,
          code: "DUPLICATE_PROPOSAL",
          message: `Une mise en relation active existe déjà pour le créateur ${creatorAccount.email} sur cette campagne (${existingActive.reference})`,
        };
        throw err;
      }

      const introduction: Introduction = {
        id: randomUUID(),
        reference: this.generateReference(),
        origin: "influx_proposal",
        originReason: input.message,
        campaignId: input.campaignId,
        advertiserAccountId: campaign.brandAccountId,
        creatorAccountId: creatorId,
        ownerAgentId: agentAccount.id,
        claimedByAgentId: agentAccount.id,
        claimedAt: now,
        status: "approved", // Court-circuitée de la file commerciale
        rejectionReasonCode: null,
        rejectionReasonComment: null,
        advertiserCountryAtIntro: advertiserAccount.countryCode,
        creatorCountryAtIntro: creatorAccount.countryCode,
        advertiserTermsVersionId: null,
        creatorTermsVersionId: null,
        advertiserAcceptedAt: null,
        creatorAcceptedAt: null,
        identityRevealedAt: null, // Masquée tant que les deux parties n'ont pas validé l'invitation
        conversationId: null,
        dealId: null,
        slaDueAt: now,
        decidedAt: now,
        createdAt: now,
        updatedAt: now,
      };

      const validated = IntroductionSchema.parse(introduction);
      this.store.introductions.set(
        validated.id,
        validated as unknown as Record<string, unknown>,
      );

      this.store.recordAuditEvent(
        "introduction.influx_proposal_created",
        {
          introductionId: validated.id,
          reference: validated.reference,
          agentId: agentAccount.id,
          creatorId,
          campaignId: input.campaignId,
        },
        agentAccount.id,
      );

      createdList.push(validated);
    }

    return createdList;
  }

  /**
   * Consultation des mises en relation de l'utilisateur connecté
   */
  public async getMyIntroductions(account: Account): Promise<Introduction[]> {
    const list: Introduction[] = [];
    for (const raw of this.store.introductions.values()) {
      const intro = raw as unknown as Introduction;
      if (
        account.role === "advertiser" &&
        intro.advertiserAccountId === account.id
      ) {
        list.push(intro);
      } else if (
        account.role === "creator" &&
        intro.creatorAccountId === account.id
      ) {
        list.push(intro);
      } else if (account.role === "agent" || account.role === "admin") {
        list.push(intro);
      }
    }
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /**
   * Consultation d'une mise en relation par identifiant
   */
  public async getIntroductionById(
    id: string,
    viewerAccount: Account,
  ): Promise<Introduction | null> {
    const raw = this.store.introductions.get(id);
    if (!raw) return null;
    const intro = raw as unknown as Introduction;

    const isAuthorized =
      viewerAccount.role === "agent" ||
      viewerAccount.role === "admin" ||
      intro.advertiserAccountId === viewerAccount.id ||
      intro.creatorAccountId === viewerAccount.id;

    if (!isAuthorized) {
      const err: IntroductionServiceError = {
        status: 403,
        code: "FORBIDDEN",
        message: "Accès refusé à cette mise en relation",
      };
      throw err;
    }

    return intro;
  }

  /**
   * Consultation de la file de validation commerciale
   */
  public async getValidationQueue(
    statusFilter?: IntroductionStatus,
  ): Promise<Introduction[]> {
    const queue: Introduction[] = [];
    for (const raw of this.store.introductions.values()) {
      const intro = raw as unknown as Introduction;
      if (statusFilter) {
        if (intro.status === statusFilter) queue.push(intro);
      } else {
        if (["pending_review", "in_review"].includes(intro.status)) {
          queue.push(intro);
        }
      }
    }
    // Tri par urgence SLA
    return queue.sort((a, b) => a.slaDueAt.localeCompare(b.slaDueAt));
  }

  /**
   * VERROU D'AGENT (Mission 4.2) : Prise en charge d'une demande par un commercial
   * Transition conditionnelle atomique : pending_review -> in_review (RG13 §2)
   */
  public async claimIntroduction(
    id: string,
    agentAccount: Account,
  ): Promise<Introduction> {
    if (agentAccount.role !== "agent" && agentAccount.role !== "admin") {
      const err: IntroductionServiceError = {
        status: 403,
        code: "FORBIDDEN",
        message: "Action réservée aux agents et administrateurs INFLUX",
      };
      throw err;
    }

    const raw = this.store.introductions.get(id);
    if (!raw) {
      const err: IntroductionServiceError = {
        status: 404,
        code: "NOT_FOUND",
        message: "Mise en relation introuvable",
      };
      throw err;
    }

    const intro = { ...(raw as unknown as Introduction) };

    if (["rejected", "withdrawn", "expired"].includes(intro.status)) {
      const err: IntroductionServiceError = {
        status: 400,
        code: "INTRO_CLOSED",
        message: "Cette mise en relation n'est plus active",
      };
      throw err;
    }

    // Contrôle du verrou anti-double-traitement
    if (
      intro.claimedByAgentId &&
      intro.claimedByAgentId !== agentAccount.id &&
      intro.status === "in_review"
    ) {
      const claimingAgent = this.store.accounts.get(intro.claimedByAgentId);
      const agentName = claimingAgent?.email || "un autre commercial";
      const err: IntroductionServiceError = {
        status: 409,
        code: "ALREADY_CLAIMED",
        message: `Cette demande est déjà prise en charge par ${agentName}`,
      };
      throw err;
    }

    const now = new Date().toISOString();
    intro.status = "in_review";
    intro.claimedByAgentId = agentAccount.id;
    intro.claimedAt = now;
    intro.updatedAt = now;

    const validated = IntroductionSchema.parse(intro);
    this.store.introductions.set(
      validated.id,
      validated as unknown as Record<string, unknown>,
    );

    this.store.recordAuditEvent(
      "introduction.claimed",
      {
        introductionId: validated.id,
        reference: validated.reference,
        agentId: agentAccount.id,
      },
      agentAccount.id,
    );

    return validated;
  }

  /**
   * LIBÉRATION DU VERROU : Remet la demande en file (in_review -> pending_review)
   */
  public async releaseIntroduction(
    id: string,
    agentAccount: Account,
  ): Promise<Introduction> {
    if (agentAccount.role !== "agent" && agentAccount.role !== "admin") {
      const err: IntroductionServiceError = {
        status: 403,
        code: "FORBIDDEN",
        message: "Action réservée aux agents et administrateurs INFLUX",
      };
      throw err;
    }

    const raw = this.store.introductions.get(id);
    if (!raw) {
      const err: IntroductionServiceError = {
        status: 404,
        code: "NOT_FOUND",
        message: "Mise en relation introuvable",
      };
      throw err;
    }

    const intro = { ...(raw as unknown as Introduction) };

    if (
      intro.claimedByAgentId &&
      intro.claimedByAgentId !== agentAccount.id &&
      agentAccount.role !== "admin"
    ) {
      const err: IntroductionServiceError = {
        status: 403,
        code: "FORBIDDEN",
        message:
          "Seul l'agent titulaire du verrou ou un administrateur peut libérer cette demande",
      };
      throw err;
    }

    const now = new Date().toISOString();
    intro.status = "pending_review";
    intro.claimedByAgentId = null;
    intro.claimedAt = null;
    intro.updatedAt = now;

    const validated = IntroductionSchema.parse(intro);
    this.store.introductions.set(
      validated.id,
      validated as unknown as Record<string, unknown>,
    );

    this.store.recordAuditEvent(
      "introduction.released",
      {
        introductionId: validated.id,
        reference: validated.reference,
        agentId: agentAccount.id,
      },
      agentAccount.id,
    );

    return validated;
  }

  /**
   * DÉCISION COMMERCIALE (Mission 4.2) : Valider (approve) ou Refuser (reject)
   * Le refus impose un motif typé fermé obligatoire (RG13 §G)
   */
  public async decideIntroduction(
    id: string,
    agentAccount: Account,
    decision: IntroductionDecision,
  ): Promise<Introduction> {
    if (agentAccount.role !== "agent" && agentAccount.role !== "admin") {
      const err: IntroductionServiceError = {
        status: 403,
        code: "FORBIDDEN",
        message: "Action réservée aux agents et administrateurs INFLUX",
      };
      throw err;
    }

    const raw = this.store.introductions.get(id);
    if (!raw) {
      const err: IntroductionServiceError = {
        status: 404,
        code: "NOT_FOUND",
        message: "Mise en relation introuvable",
      };
      throw err;
    }

    const intro = { ...(raw as unknown as Introduction) };

    if (intro.status === "approved" || intro.status === "rejected") {
      const err: IntroductionServiceError = {
        status: 400,
        code: "ALREADY_DECIDED",
        message: "Cette mise en relation a déjà fait l'objet d'une décision",
      };
      throw err;
    }

    if (
      intro.claimedByAgentId &&
      intro.claimedByAgentId !== agentAccount.id &&
      agentAccount.role !== "admin"
    ) {
      const err: IntroductionServiceError = {
        status: 403,
        code: "FORBIDDEN",
        message: "Cette demande est prise en charge par un autre commercial",
      };
      throw err;
    }

    const now = new Date().toISOString();
    intro.decidedAt = now;
    intro.updatedAt = now;
    intro.ownerAgentId = agentAccount.id; // L'agent qui décide devient titulaire de l'affaire

    if (decision.action === "approve") {
      intro.status = "approved";
      intro.rejectionReasonCode = null;
      intro.rejectionReasonComment = null;

      this.store.recordAuditEvent(
        "introduction.approved",
        {
          introductionId: intro.id,
          reference: intro.reference,
          agentId: agentAccount.id,
        },
        agentAccount.id,
      );
    } else {
      intro.status = "rejected";
      intro.rejectionReasonCode = decision.rejectionReasonCode ?? null;
      intro.rejectionReasonComment = decision.rejectionReasonComment ?? null;

      this.store.recordAuditEvent(
        "introduction.rejected",
        {
          introductionId: intro.id,
          reference: intro.reference,
          agentId: agentAccount.id,
          reason: decision.rejectionReasonCode,
        },
        agentAccount.id,
      );
    }

    const validated = IntroductionSchema.parse(intro);
    this.store.introductions.set(
      validated.id,
      validated as unknown as Record<string, unknown>,
    );

    // Déclenchement atomique si les deux parties avaient déjà accepté
    if (
      validated.status === "approved" &&
      validated.advertiserAcceptedAt &&
      validated.creatorAcceptedAt &&
      !validated.identityRevealedAt
    ) {
      const revealService = new RevealService(this.store);
      const revealResult = await revealService.revealIdentity(validated.id);
      return revealResult.introduction;
    }

    return validated;
  }
}
