import { randomUUID } from "node:crypto";
import {
  type Campaign,
  type CampaignStatus,
  type CampaignBrandView,
  type CampaignPublicCreatorView,
  type CampaignBackofficeView,
  type CreateCampaignDraftInput,
  type UpdateCampaignInput,
  type CampaignRejectionReason,
  type PriceBand,
  type CampaignDeliverable,
  CampaignSchema,
  calculateCampaignCompleteness,
  deriveCampaignPriceBands,
  isSensitiveSector,
  isDeliverableFormatValid,
  validateCampaignDates,
  sanitizeCampaignForBrand,
  sanitizeCampaignForCreator,
  sanitizeCampaignForBackoffice,
  type BrandProfile,
  sanitizeBrandProfileToPublic,
  type CreatorProfile,
  type CampaignQueueResponse,
  type CampaignFeedFilters,
  type CampaignFeedCard,
  type CampaignFeedResponse,
  sanitizeCampaignForFeedCard,
} from "@influx/contracts";
import { MockStore } from "../mocks/mock-store";
import { BrandProfileService } from "./brand-profile-service";
import { CreatorProfileService } from "./creator-profile-service";

export interface CampaignListFilters {
  status?: CampaignStatus;
  sensitiveOnly?: boolean;
  brandAccountId?: string;
  agentId?: string;
}

export class CampaignService {
  private store: MockStore;
  private brandProfileService: BrandProfileService;
  private creatorProfileService: CreatorProfileService;

  constructor(store?: MockStore) {
    this.store = store ?? MockStore.getInstance();
    this.brandProfileService = new BrandProfileService(this.store);
    this.creatorProfileService = new CreatorProfileService(this.store);
  }

  /**
   * Parse et valide un enregistrement campagne brut stocké
   */
  private ensureParsed(raw: Record<string, unknown>): Campaign {
    return CampaignSchema.parse(raw);
  }

  /**
   * Récupère une campagne par son ID
   */
  getCampaignById(id: string): Campaign | undefined {
    const raw = this.store.campaigns.get(id);
    if (!raw) return undefined;
    return this.ensureParsed(raw);
  }

  /**
   * Crée un brouillon de campagne (RG1, RG16, RG108, CA1)
   */
  createDraft(
    brandAccountId: string,
    input: CreateCampaignDraftInput = {},
    agentId?: string,
  ): Campaign {
    const now = new Date().toISOString();
    const id = randomUUID();

    // Dérivation des réseaux cibles depuis les livrables (RG35)
    const deliverables = input.deliverables ?? [];
    const targetNetworks = Array.from(
      new Set(deliverables.map((d) => d.network.toLowerCase())),
    );

    // Dérivation des tranches de prix couvertes (RG59)
    const derivedPriceBands = deriveCampaignPriceBands(
      input.minCompensationMinor,
      input.maxCompensationMinor,
      input.currency || "EUR",
    );

    const draftData: Campaign = {
      id,
      brandAccountId,
      status: "brouillon",

      // Bloc 1
      title: input.title || "Nouvelle campagne",
      campaignType: input.campaignType || "placement_produit",
      publicSummary: input.publicSummary || "",
      detailedBrief: input.detailedBrief || "",
      internalReference: input.internalReference ?? null,

      // Bloc 2
      productName: input.productName || "",
      productCategory: input.productCategory || "",
      keyMessages: input.keyMessages || [],
      prohibitions: input.prohibitions ?? null,
      productShipped: input.productShipped ?? false,
      productValueBand: input.productValueBand ?? null,
      productCurrency: input.productCurrency || "EUR",
      productKept: input.productKept ?? null,
      productShippingCost: input.productShippingCost ?? null,

      // Bloc 3
      deliverables,
      targetNetworks,
      usageRights: input.usageRights || "aucun",
      usageDuration: input.usageDuration ?? null,
      usageTerritory: input.usageTerritory ?? null,
      exclusivity: input.exclusivity || "none",
      contentValidationDelay: input.contentValidationDelay || "48h",

      // Bloc 4
      targetCountries: input.targetCountries || ["FR"],
      targetLanguages: input.targetLanguages || ["fr"],
      targetTopics: input.targetTopics || [],
      targetAudienceBands: input.targetAudienceBands || [],
      targetAgeBands: input.targetAgeBands || [],
      targetGender: input.targetGender ?? null,

      // Bloc 5
      minCompensationMinor: input.minCompensationMinor ?? null,
      maxCompensationMinor: input.maxCompensationMinor ?? null,
      currency: input.currency || "EUR",
      compensationNature: input.compensationNature || "numeraire",
      creatorsCount: input.creatorsCount || 1,
      totalBudgetMinor: input.totalBudgetMinor ?? null,
      derivedPriceBands,

      // Bloc 6
      applicationDeadline:
        input.applicationDeadline || (now.split("T")[0] ?? ""),
      deliveryDeadline: input.deliveryDeadline ?? null,
      startsOn: input.startsOn || (now.split("T")[0] ?? ""),
      endsOn: input.endsOn || (now.split("T")[0] ?? ""),

      // Bloc 7
      requestedCandidateElements: input.requestedCandidateElements || [],
      applicationCap: input.applicationCap ?? null,
      verifiedOnly: input.verifiedOnly ?? false,

      // Bloc 8
      internalNotes: input.internalNotes ?? null,
      responsibleAgentId: agentId ?? null,
      validatorAgentId: null,
      secondValidatorAgentId: null,
      rejectionReason: null,
      rejectionComment: null,
      sensitiveDeclarationAcceptedAt: input.sensitiveDeclarationAccepted
        ? now
        : null,
      lockedByAgentId: null,
      lockedAt: null,

      lastPublishedSnapshot: null,
      createdAt: now,
      updatedAt: now,
      submittedAt: null,
      publishedAt: null,
      pausedAt: null,
      closedAt: null,
      applicationsCount: 0,
    };

    this.store.campaigns.set(
      id,
      draftData as unknown as Record<string, unknown>,
    );

    this.store.recordAuditEvent(
      "campaign.draft_created",
      {
        campaignId: id,
        brandAccountId,
        createdByAgent: Boolean(agentId),
        agentId: agentId ?? null,
      },
      brandAccountId,
    );

    return draftData;
  }

  /**
   * Met à jour une campagne (RG7, RG14, CA6, CA7, CA60)
   */
  updateCampaign(
    campaignId: string,
    brandAccountId: string,
    input: UpdateCampaignInput,
    agentId?: string,
  ): Campaign {
    const existing = this.getCampaignById(campaignId);
    if (!existing) {
      throw new Error(`Campagne introuvable : ${campaignId}`);
    }

    if (existing.brandAccountId !== brandAccountId && !agentId) {
      throw new Error(
        "Accès refusé : cette campagne appartient à une autre marque",
      );
    }

    if (existing.status === "cloturee") {
      throw new Error(
        "Action impossible : une campagne clôturée ne peut plus être modifiée (RG9)",
      );
    }

    const now = new Date().toISOString();

    // RG36: Validation de la compatibilité réseau / format sur chaque livrable
    if (input.deliverables) {
      for (const deliv of input.deliverables) {
        if (!isDeliverableFormatValid(deliv.network, deliv.format)) {
          throw new Error(
            `Format incompatible pour ${deliv.network} : format '${deliv.format}' non autorisé (RG36, CA23)`,
          );
        }
      }
    }

    // RG7: Gestion des modifications sur une campagne déjà publiée
    let newStatus = existing.status;
    let newLastPublishedSnapshot = existing.lastPublishedSnapshot;

    if (existing.status === "publiee") {
      const isSubstantialChange =
        input.title !== undefined ||
        input.campaignType !== undefined ||
        input.publicSummary !== undefined ||
        input.detailedBrief !== undefined ||
        input.productName !== undefined ||
        input.productCategory !== undefined ||
        input.keyMessages !== undefined ||
        input.prohibitions !== undefined ||
        input.productShipped !== undefined ||
        input.productValueBand !== undefined ||
        input.deliverables !== undefined ||
        input.usageRights !== undefined ||
        input.usageDuration !== undefined ||
        input.usageTerritory !== undefined ||
        input.exclusivity !== undefined ||
        input.targetCountries !== undefined ||
        input.targetLanguages !== undefined ||
        input.targetTopics !== undefined ||
        input.minCompensationMinor !== undefined ||
        input.maxCompensationMinor !== undefined ||
        input.compensationNature !== undefined ||
        input.deliveryDeadline !== undefined ||
        input.startsOn !== undefined ||
        input.endsOn !== undefined ||
        input.verifiedOnly !== undefined;

      if (isSubstantialChange) {
        // Sauvegarde de la version publiée actuelle pour affichage continu aux créateurs (RG7, CA6)
        newLastPublishedSnapshot = { ...existing };
        newStatus = "a_valider";
      }
      // Les autres champs (report applicationDeadline, hausse applicationCap, créateursCount, notes) prennent effet immédiatement (RG7, CA7)
    }

    // Dérivation livrables & réseaux
    const deliverables = input.deliverables ?? existing.deliverables;
    const targetNetworks = Array.from(
      new Set(deliverables.map((d) => d.network.toLowerCase())),
    );

    // Dérivation tranches de prix
    const minComp =
      input.minCompensationMinor !== undefined
        ? input.minCompensationMinor
        : existing.minCompensationMinor;
    const maxComp =
      input.maxCompensationMinor !== undefined
        ? input.maxCompensationMinor
        : existing.maxCompensationMinor;
    const curr = input.currency || existing.currency;

    const derivedPriceBands = deriveCampaignPriceBands(minComp, maxComp, curr);

    const updated: Campaign = {
      ...existing,
      status: newStatus,
      lastPublishedSnapshot: newLastPublishedSnapshot,
      title: input.title ?? existing.title,
      campaignType: input.campaignType ?? existing.campaignType,
      publicSummary: input.publicSummary ?? existing.publicSummary,
      detailedBrief: input.detailedBrief ?? existing.detailedBrief,
      internalReference:
        input.internalReference !== undefined
          ? input.internalReference
          : existing.internalReference,

      productName: input.productName ?? existing.productName,
      productCategory: input.productCategory ?? existing.productCategory,
      keyMessages: input.keyMessages ?? existing.keyMessages,
      prohibitions:
        input.prohibitions !== undefined
          ? input.prohibitions
          : existing.prohibitions,
      productShipped:
        input.productShipped !== undefined
          ? input.productShipped
          : existing.productShipped,
      productValueBand:
        input.productValueBand !== undefined
          ? input.productValueBand
          : existing.productValueBand,
      productCurrency: input.productCurrency ?? existing.productCurrency,
      productKept:
        input.productKept !== undefined
          ? input.productKept
          : existing.productKept,
      productShippingCost:
        input.productShippingCost !== undefined
          ? input.productShippingCost
          : existing.productShippingCost,

      deliverables,
      targetNetworks,
      usageRights: input.usageRights ?? existing.usageRights,
      usageDuration:
        input.usageDuration !== undefined
          ? input.usageDuration
          : existing.usageDuration,
      usageTerritory:
        input.usageTerritory !== undefined
          ? input.usageTerritory
          : existing.usageTerritory,
      exclusivity: input.exclusivity ?? existing.exclusivity,
      contentValidationDelay:
        input.contentValidationDelay ?? existing.contentValidationDelay,

      targetCountries: input.targetCountries ?? existing.targetCountries,
      targetLanguages: input.targetLanguages ?? existing.targetLanguages,
      targetTopics: input.targetTopics ?? existing.targetTopics,
      targetAudienceBands:
        input.targetAudienceBands ?? existing.targetAudienceBands,
      targetAgeBands: input.targetAgeBands ?? existing.targetAgeBands,
      targetGender:
        input.targetGender !== undefined
          ? input.targetGender
          : existing.targetGender,

      minCompensationMinor: minComp,
      maxCompensationMinor: maxComp,
      currency: curr,
      compensationNature:
        input.compensationNature ?? existing.compensationNature,
      creatorsCount: input.creatorsCount ?? existing.creatorsCount,
      totalBudgetMinor:
        input.totalBudgetMinor !== undefined
          ? input.totalBudgetMinor
          : existing.totalBudgetMinor,
      derivedPriceBands,

      applicationDeadline:
        input.applicationDeadline ?? existing.applicationDeadline,
      deliveryDeadline:
        input.deliveryDeadline !== undefined
          ? input.deliveryDeadline
          : existing.deliveryDeadline,
      startsOn: input.startsOn ?? existing.startsOn,
      endsOn: input.endsOn ?? existing.endsOn,

      requestedCandidateElements:
        input.requestedCandidateElements ?? existing.requestedCandidateElements,
      applicationCap:
        input.applicationCap !== undefined
          ? input.applicationCap
          : existing.applicationCap,
      verifiedOnly: input.verifiedOnly ?? existing.verifiedOnly,

      internalNotes: input.internalNotes ?? existing.internalNotes,
      sensitiveDeclarationAcceptedAt:
        input.sensitiveDeclarationAccepted === true
          ? now
          : existing.sensitiveDeclarationAcceptedAt,
      updatedAt: now,
    };

    this.store.campaigns.set(
      campaignId,
      updated as unknown as Record<string, unknown>,
    );

    this.store.recordAuditEvent(
      "campaign.updated",
      {
        campaignId,
        modifiedByAgent: Boolean(agentId),
        agentId: agentId ?? null,
        revalidationTriggered: newStatus === "a_valider",
      },
      brandAccountId,
    );

    return updated;
  }

  /**
   * Soumet une campagne pour validation commerciale (RG4, RG15, CA2, CA3, CA4, CA10)
   */
  submitCampaign(campaignId: string, brandAccountId: string): Campaign {
    const campaign = this.getCampaignById(campaignId);
    if (!campaign) {
      throw new Error(`Campagne introuvable : ${campaignId}`);
    }

    if (campaign.brandAccountId !== brandAccountId) {
      throw new Error(
        "Accès refusé : cette campagne appartient à une autre marque",
      );
    }

    // RG15: Plafond de 10 campagnes simultanément actives (publiées ou en pause) (CA10)
    const activeCampaigns = Array.from(this.store.campaigns.values()).filter(
      (c) =>
        c.brandAccountId === brandAccountId &&
        c.id !== campaignId &&
        (c.status === "publiee" || c.status === "en_pause"),
    );

    if (activeCampaigns.length >= 10) {
      const activeTitles = activeCampaigns.map((c) => c.title).join(", ");
      throw new Error(
        `Plafond atteint : une marque ne peut avoir plus de 10 campagnes actives simultanément (RG15). Clôturez d'abord une de vos campagnes : ${activeTitles}`,
      );
    }

    // RG4: Profil marque publié obligatoire (CA2)
    const brandProfile =
      this.brandProfileService.getProfileByAccountId(brandAccountId);
    const isBrandProfilePublished = brandProfile?.status === "publie";

    if (!isBrandProfilePublished) {
      throw new Error(
        "Publiez votre profil de marque avant de soumettre une campagne (RG4, CA2).",
      );
    }

    // RG4: Contrôle de complétude de tous les champs obligatoires (CA3)
    const completeness = calculateCampaignCompleteness(
      campaign,
      isBrandProfilePublished,
    );

    if (!completeness.isSubmittable) {
      const missing = completeness.missingFieldLabels.join(", ");
      throw new Error(
        `Il manque des informations pour soumettre votre campagne : ${missing} (RG4, CA3).`,
      );
    }

    const now = new Date().toISOString();
    const updated: Campaign = {
      ...campaign,
      status: "a_valider",
      submittedAt: now,
      updatedAt: now,
    };

    this.store.campaigns.set(
      campaignId,
      updated as unknown as Record<string, unknown>,
    );

    this.store.recordAuditEvent(
      "campaign.submitted",
      {
        campaignId,
        brandAccountId,
        productCategory: campaign.productCategory,
        isSensitive: isSensitiveSector(campaign.productCategory),
      },
      brandAccountId,
    );

    return updated;
  }

  /**
   * Consultation d'une campagne par sa marque propriétaire (US3, US4, RG61, CA39)
   */
  getCampaignForBrand(
    campaignId: string,
    brandAccountId: string,
  ): CampaignBrandView {
    const campaign = this.getCampaignById(campaignId);
    if (!campaign) {
      throw new Error(`Campagne introuvable : ${campaignId}`);
    }
    if (campaign.brandAccountId !== brandAccountId) {
      throw new Error("Accès refusé");
    }
    return sanitizeCampaignForBrand(campaign);
  }

  /**
   * Liste des campagnes de la marque propriétaire
   */
  listCampaignsForBrand(brandAccountId: string): CampaignBrandView[] {
    const results: CampaignBrandView[] = [];
    for (const raw of this.store.campaigns.values()) {
      if (raw.brandAccountId === brandAccountId) {
        const c = this.ensureParsed(raw);
        results.push(sanitizeCampaignForBrand(c));
      }
    }
    return results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /**
   * Consultation publique sécurisée pour un créateur (RG60, RG65, RG86, RG98, RG100, CA36, CA41, CA64, CA66)
   */
  getCampaignForCreator(
    campaignId: string,
    creatorAccountId?: string,
  ): CampaignPublicCreatorView {
    const campaign = this.getCampaignById(campaignId);
    if (!campaign) {
      throw new Error(`Campagne introuvable : ${campaignId}`);
    }

    // RG100: Une campagne en brouillon, refusée ou clôturée n'est servie à aucun créateur (CA66)
    if (
      campaign.status !== "publiee" &&
      campaign.status !== "en_pause" &&
      campaign.status !== "a_valider"
    ) {
      throw new Error("Cette campagne n'est pas accessible (RG100)");
    }

    // Si la campagne est en re-validation mais a une snapshot validée (RG7, CA6)
    let campaignToDisplay = campaign;
    if (campaign.status === "a_valider") {
      if (!campaign.lastPublishedSnapshot) {
        throw new Error("Cette campagne n'est pas accessible (RG100)");
      }
      campaignToDisplay = this.ensureParsed(
        campaign.lastPublishedSnapshot as Record<string, unknown>,
      );
    }

    // RG86: Exclusion silencieuse si la catégorie fait partie des secteurs refusés par le créateur (CA36)
    if (creatorAccountId) {
      const creatorProfile =
        this.creatorProfileService.getProfileByAccountId(creatorAccountId);
      if (
        creatorProfile &&
        creatorProfile.refusedSectors &&
        creatorProfile.refusedSectors.includes(
          campaignToDisplay.productCategory,
        )
      ) {
        // Exclusion silencieuse sans aucun message (matching-spec A8, RG86)
        throw new Error("Campagne non trouvée");
      }
    }

    // Récupération du profil marque public (RG98, CA64)
    const brandProfile = this.brandProfileService.getProfileByAccountId(
      campaignToDisplay.brandAccountId,
    );
    if (!brandProfile) {
      throw new Error("Profil marque introuvable pour cette campagne");
    }

    const brandPublic = sanitizeBrandProfileToPublic(brandProfile);

    // Sanitisation étanche (RG65, CA41, Invariant A2)
    return sanitizeCampaignForCreator(campaignToDisplay, brandPublic);
  }

  /**
   * Enregistre la consultation d'une fiche de campagne par un créateur (RG22)
   */
  recordCampaignView(creatorAccountId: string, campaignId: string): void {
    this.store.recordAuditEvent(
      "campaign.viewed_by_creator",
      {
        campaignId,
        creatorAccountId,
        viewedAt: new Date().toISOString(),
      },
      creatorAccountId,
    );
  }

  /**
   * Récupère le fil des campagnes ouvertes pour un créateur (C5, RG13 à RG36)
   */
  getCampaignFeed(
    creatorAccountId: string,
    filters: Partial<CampaignFeedFilters> = {},
  ): CampaignFeedResponse {
    const creatorProfile =
      this.creatorProfileService.getProfileByAccountId(creatorAccountId);

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0] ?? "";

    // Contexte créateur pour l'éligibilité (RG46)
    const isProfilePublished = creatorProfile?.status === "publie";
    const hasAudienceVerifiedBadge = Boolean(
      creatorProfile?.networks?.some((n) => n.hasVerifiedAudienceBadge),
    );

    const creatorNetworksAndFormats: Array<{
      network: string;
      format: string;
    }> = [];
    if (creatorProfile?.offers) {
      for (const off of creatorProfile.offers) {
        if (off.network && off.format) {
          creatorNetworksAndFormats.push({
            network: off.network,
            format: off.format,
          });
        }
      }
    }

    const refusedSectors = creatorProfile?.refusedSectors || [];

    // Récupérer toutes les campagnes stockées
    const allCampaigns = Array.from(this.store.campaigns.values()).map((raw) =>
      this.ensureParsed(raw),
    );

    let otherCurrencyCampaignsCount = 0;
    const eligibleFeedCards: CampaignFeedCard[] = [];

    for (const campaign of allCampaigns) {
      // 1. Condition RG14 #1 : état 'publiee' (ou clôturée depuis <= 7 jours RG26)
      const isPublished = campaign.status === "publiee";
      const isClosedState = campaign.status === "cloturee";

      const isDeadlinePassed = Boolean(
        campaign.applicationDeadline && campaign.applicationDeadline < todayStr,
      );
      const isEndPassed = Boolean(
        campaign.endsOn && campaign.endsOn < todayStr,
      );
      const isCapReached =
        campaign.applicationCap != null &&
        campaign.applicationsCount >= campaign.applicationCap;

      const isClosed =
        isClosedState || isDeadlinePassed || isEndPassed || isCapReached;

      // Si fermée, vérifier RG26: visible en grisé si fermée depuis <= 7 jours, sinon exclure
      if (isClosed) {
        const closedDateStr = campaign.closedAt
          ? campaign.closedAt.split("T")[0]
          : campaign.applicationDeadline;
        if (closedDateStr) {
          const closedTime = new Date(`${closedDateStr}T00:00:00Z`).getTime();
          const diffDays = Math.floor(
            (now.getTime() - closedTime) / (24 * 3600 * 1000),
          );
          if (diffDays > 7) {
            continue; // Dépassé de plus de 7 jours -> disparaît du fil (RG26)
          }
        } else if (!isPublished) {
          continue;
        }
      } else if (!isPublished) {
        continue;
      }

      // 2. Condition RG14 #2 : profil marque publié et compte actif
      const brandProfile = this.brandProfileService.getProfileByAccountId(
        campaign.brandAccountId,
      );
      if (!brandProfile || brandProfile.status !== "publie") {
        continue;
      }

      const brandAccount = this.store.accounts.get(campaign.brandAccountId);
      if (brandAccount?.status === "suspended") {
        continue;
      }

      // 3. Exclusion silencieuse des secteurs refusés par le créateur (RG42)
      if (
        refusedSectors.length > 0 &&
        (refusedSectors.includes(campaign.productCategory) ||
          refusedSectors.includes(brandProfile.sector))
      ) {
        continue; // Exclusion silencieuse E6
      }

      // RG18: Une campagne sans rémunération par créateur n'apparaît pas
      if (
        campaign.compensationNature !== "dotation_seule" &&
        (campaign.minCompensationMinor == null ||
          campaign.maxCompensationMinor == null)
      ) {
        continue;
      }

      // Filtres C1 à C7
      // C1: Thématiques
      if (
        filters.topics &&
        filters.topics.length > 0 &&
        !campaign.targetTopics.some((t) => filters.topics!.includes(t))
      ) {
        continue;
      }

      // C2: Réseaux
      if (
        filters.networks &&
        filters.networks.length > 0 &&
        !campaign.targetNetworks.some((n) => filters.networks!.includes(n))
      ) {
        continue;
      }

      // C3: Formats (livrables)
      if (
        filters.formats &&
        filters.formats.length > 0 &&
        !campaign.deliverables.some((d) => filters.formats!.includes(d.format))
      ) {
        continue;
      }

      // C4: Pays d'audience visés
      if (
        filters.targetCountries &&
        filters.targetCountries.length > 0 &&
        !campaign.targetCountries.some((c) =>
          filters.targetCountries!.includes(c),
        )
      ) {
        continue;
      }

      // C5: Rémunération minimale (RG27, RG28)
      if (filters.minCompensationMinor != null && filters.currency) {
        if (campaign.currency !== filters.currency) {
          otherCurrencyCampaignsCount++;
          continue; // Pas de conversion, classée à part (RG28)
        }
        if (
          campaign.maxCompensationMinor == null ||
          campaign.maxCompensationMinor < filters.minCompensationMinor
        ) {
          continue;
        }
      }

      // C6: Nature de rémunération
      if (
        filters.compensationNatures &&
        filters.compensationNatures.length > 0 &&
        !filters.compensationNatures.includes(campaign.compensationNature)
      ) {
        continue;
      }

      // Sanitisation en carte de fil sécurisée (RG15)
      const brandPublic = sanitizeBrandProfileToPublic(brandProfile);
      const card = sanitizeCampaignForFeedCard(campaign, brandPublic, {
        isProfilePublished,
        hasAudienceVerifiedBadge,
        creatorNetworksAndFormats,
        hasApplied: false,
        appliedAt: null,
        activeApplicationsCount: 0,
        maxActiveApplicationsCap: 10,
      });

      // C7: Campagnes auxquelles je peux candidater
      if (filters.onlyEligible && !card.canApply) {
        continue;
      }

      eligibleFeedCards.push(card);
    }

    // Tris (RG33)
    eligibleFeedCards.sort((a, b) => {
      if (filters.sortBy === "deadline") {
        const dlA = a.applicationDeadline || "9999-99-99";
        const dlB = b.applicationDeadline || "9999-99-99";
        const cmp = dlA.localeCompare(dlB);
        if (cmp !== 0) return cmp;
      } else {
        // "recent" par défaut
        const pubA = a.publishedAt || "";
        const pubB = b.publishedAt || "";
        const cmp = pubB.localeCompare(pubA);
        if (cmp !== 0) return cmp;
      }
      // Départage stable par identifiant
      return a.id.localeCompare(b.id);
    });

    // Journalisation de la recherche dans searchQueries (RG32)
    this.store.searchQueries.set(randomUUID(), {
      id: randomUUID(),
      accountId: creatorAccountId,
      viewMode: "creator_feed",
      filters: filters as unknown as Record<string, unknown>,
      resultsCount: eligibleFeedCards.length,
      createdAt: now.toISOString(),
    });

    // Pagination (RG21, RG36)
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(20, Math.max(1, filters.limit || 12));
    const total = eligibleFeedCards.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const items = eligibleFeedCards.slice(startIndex, startIndex + limit);

    return {
      items,
      total,
      page,
      limit,
      totalPages,
      otherCurrencyCampaignsCount,
    };
  }

  /**
   * Met une campagne en pause (RG8, CA8)
   */
  pauseCampaign(
    campaignId: string,
    actor: { brandAccountId?: string; agentId?: string },
  ): Campaign {
    const campaign = this.getCampaignById(campaignId);
    if (!campaign) {
      throw new Error(`Campagne introuvable : ${campaignId}`);
    }

    if (
      actor.brandAccountId &&
      campaign.brandAccountId !== actor.brandAccountId &&
      !actor.agentId
    ) {
      throw new Error("Accès refusé");
    }

    if (campaign.status !== "publiee") {
      throw new Error(
        "Seule une campagne publiée peut être mise en pause (RG8)",
      );
    }

    const now = new Date().toISOString();
    const updated: Campaign = {
      ...campaign,
      status: "en_pause",
      pausedAt: now,
      updatedAt: now,
    };

    this.store.campaigns.set(
      campaignId,
      updated as unknown as Record<string, unknown>,
    );

    this.store.recordAuditEvent(
      "campaign.paused",
      {
        campaignId,
        pausedByAgent: Boolean(actor.agentId),
        agentId: actor.agentId ?? null,
      },
      campaign.brandAccountId,
    );

    return updated;
  }

  /**
   * Reprend une campagne en pause (RG8)
   */
  resumeCampaign(
    campaignId: string,
    actor: { brandAccountId?: string; agentId?: string },
  ): Campaign {
    const campaign = this.getCampaignById(campaignId);
    if (!campaign) {
      throw new Error(`Campagne introuvable : ${campaignId}`);
    }

    if (
      actor.brandAccountId &&
      campaign.brandAccountId !== actor.brandAccountId &&
      !actor.agentId
    ) {
      throw new Error("Accès refusé");
    }

    if (campaign.status !== "en_pause") {
      throw new Error("Seule une campagne en pause peut être reprise (RG8)");
    }

    const now = new Date().toISOString();
    const updated: Campaign = {
      ...campaign,
      status: "publiee",
      pausedAt: null,
      updatedAt: now,
    };

    this.store.campaigns.set(
      campaignId,
      updated as unknown as Record<string, unknown>,
    );

    this.store.recordAuditEvent(
      "campaign.resumed",
      {
        campaignId,
        resumedByAgent: Boolean(actor.agentId),
        agentId: actor.agentId ?? null,
      },
      campaign.brandAccountId,
    );

    return updated;
  }

  /**
   * Clôture définitive et irréversible d'une campagne (RG9, CA9)
   */
  closeCampaign(
    campaignId: string,
    actor: { brandAccountId?: string; agentId?: string },
  ): Campaign {
    const campaign = this.getCampaignById(campaignId);
    if (!campaign) {
      throw new Error(`Campagne introuvable : ${campaignId}`);
    }

    if (
      actor.brandAccountId &&
      campaign.brandAccountId !== actor.brandAccountId &&
      !actor.agentId
    ) {
      throw new Error("Accès refusé");
    }

    if (campaign.status === "cloturee") {
      return campaign;
    }

    const now = new Date().toISOString();
    const updated: Campaign = {
      ...campaign,
      status: "cloturee",
      closedAt: now,
      updatedAt: now,
    };

    this.store.campaigns.set(
      campaignId,
      updated as unknown as Record<string, unknown>,
    );

    this.store.recordAuditEvent(
      "campaign.closed",
      {
        campaignId,
        closedByAgent: Boolean(actor.agentId),
        agentId: actor.agentId ?? null,
      },
      campaign.brandAccountId,
    );

    return updated;
  }

  /**
   * Duplication d'une campagne clôturée ou existante vers un nouveau brouillon (RG9, CA9)
   */
  duplicateCampaign(campaignId: string, brandAccountId: string): Campaign {
    const existing = this.getCampaignById(campaignId);
    if (!existing) {
      throw new Error(`Campagne introuvable : ${campaignId}`);
    }

    if (existing.brandAccountId !== brandAccountId) {
      throw new Error(
        "Accès refusé : duplication réservée à la marque propriétaire",
      );
    }

    const now = new Date().toISOString();
    const newId = randomUUID();

    const duplicated: Campaign = {
      ...existing,
      id: newId,
      status: "brouillon",
      title: `${existing.title} (copie)`.slice(0, 140),
      internalReference: existing.internalReference
        ? `${existing.internalReference}-COPIE`.slice(0, 40)
        : null,
      validatorAgentId: null,
      secondValidatorAgentId: null,
      rejectionReason: null,
      rejectionComment: null,
      lockedByAgentId: null,
      lockedAt: null,
      lastPublishedSnapshot: null,
      submittedAt: null,
      publishedAt: null,
      pausedAt: null,
      closedAt: null,
      applicationsCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    this.store.campaigns.set(
      newId,
      duplicated as unknown as Record<string, unknown>,
    );

    this.store.recordAuditEvent(
      "campaign.duplicated",
      {
        sourceCampaignId: campaignId,
        newCampaignId: newId,
        brandAccountId,
      },
      brandAccountId,
    );

    return duplicated;
  }

  // ==========================================
  // Gestion Backoffice & Modération Commerciale
  // ==========================================

  /**
   * Pose d'un verrou nominatif de 30 minutes sur une campagne à valider (RG88, CA58)
   */
  claimCampaign(campaignId: string, agentId: string): Campaign {
    const campaign = this.getCampaignById(campaignId);
    if (!campaign) {
      throw new Error(`Campagne introuvable : ${campaignId}`);
    }

    const now = new Date();
    if (campaign.lockedByAgentId && campaign.lockedByAgentId !== agentId) {
      if (campaign.lockedAt) {
        const lockedTime = new Date(campaign.lockedAt).getTime();
        const elapsedMinutes = (now.getTime() - lockedTime) / (1000 * 60);
        if (elapsedMinutes < 30) {
          throw new Error(
            `Cette campagne est déjà prise en charge par un autre agent (RG88, CA58)`,
          );
        }
      }
    }

    const updated: Campaign = {
      ...campaign,
      lockedByAgentId: agentId,
      lockedAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    this.store.campaigns.set(
      campaignId,
      updated as unknown as Record<string, unknown>,
    );

    return updated;
  }

  /**
   * Libération du verrou d'agent
   */
  releaseClaim(campaignId: string, agentId: string): Campaign {
    const campaign = this.getCampaignById(campaignId);
    if (!campaign) {
      throw new Error(`Campagne introuvable : ${campaignId}`);
    }

    if (campaign.lockedByAgentId && campaign.lockedByAgentId !== agentId) {
      throw new Error(
        "Vous ne pouvez pas libérer un verrou posé par un autre agent",
      );
    }

    const now = new Date().toISOString();
    const updated: Campaign = {
      ...campaign,
      lockedByAgentId: null,
      lockedAt: null,
      updatedAt: now,
    };

    this.store.campaigns.set(
      campaignId,
      updated as unknown as Record<string, unknown>,
    );

    return updated;
  }

  /**
   * Publication par décision humaine (RG5, RG85, CA5, CA56, CA57)
   */
  publishCampaign(
    campaignId: string,
    agentId: string,
    options: { secondAgentId?: string; isAdmin?: boolean } = {},
  ): Campaign {
    const campaign = this.getCampaignById(campaignId);
    if (!campaign) {
      throw new Error(`Campagne introuvable : ${campaignId}`);
    }

    if (campaign.status !== "a_valider") {
      throw new Error("Seule une campagne à valider peut être publiée (RG5)");
    }

    // RG85: Revue renforcée en secteur sensible (CA56, CA57)
    const isSensitive = isSensitiveSector(campaign.productCategory);
    if (isSensitive) {
      const hasDualApproval =
        Boolean(options.isAdmin) ||
        (Boolean(options.secondAgentId) && options.secondAgentId !== agentId);

      if (!hasDualApproval) {
        throw new Error(
          "Campagne en secteur sensible : publication refusée sans double validation interne (RG85, CA57).",
        );
      }
    }

    const now = new Date().toISOString();
    const isFirstPublication = !campaign.publishedAt;

    const updated: Campaign = {
      ...campaign,
      status: "publiee",
      validatorAgentId: agentId,
      secondValidatorAgentId: options.secondAgentId ?? null,
      publishedAt: campaign.publishedAt || now,
      lastPublishedSnapshot: null, // Plus de version antérieure
      lockedByAgentId: null,
      lockedAt: null,
      rejectionReason: null,
      rejectionComment: null,
      updatedAt: now,
    };

    this.store.campaigns.set(
      campaignId,
      updated as unknown as Record<string, unknown>,
    );

    // RG103: Émission d'événement outbox pour Brevo / Apollo (CA69, CA70)
    const eventType = isFirstPublication
      ? "campaign.published"
      : "campaign.updated";

    this.store.outboxEvents.push({
      id: randomUUID(),
      eventType,
      payload: {
        campaignId,
        brandAccountId: campaign.brandAccountId,
        productCategory: campaign.productCategory,
        currency: campaign.currency,
        minCompensationMinor: campaign.minCompensationMinor,
        maxCompensationMinor: campaign.maxCompensationMinor,
        targetCountries: campaign.targetCountries,
        targetNetworks: campaign.targetNetworks,
        publishedAt: updated.publishedAt,
      },
      status: "pending",
      attempts: 0,
      createdAt: now,
    });

    this.store.recordAuditEvent(
      eventType,
      {
        campaignId,
        validatorAgentId: agentId,
        secondValidatorAgentId: options.secondAgentId ?? null,
        isSensitive,
      },
      campaign.brandAccountId,
    );

    return updated;
  }

  /**
   * Refus motivé d'une campagne avec motif typé fermé (RG10, RG89, RG90, CA59)
   */
  rejectCampaign(
    campaignId: string,
    agentId: string,
    reason: CampaignRejectionReason,
    comment?: string,
  ): Campaign {
    const campaign = this.getCampaignById(campaignId);
    if (!campaign) {
      throw new Error(`Campagne introuvable : ${campaignId}`);
    }

    if (campaign.status !== "a_valider") {
      throw new Error("Seule une campagne à valider peut être refusée (RG89)");
    }

    const now = new Date().toISOString();
    const updated: Campaign = {
      ...campaign,
      status: "refusee",
      validatorAgentId: agentId,
      rejectionReason: reason,
      rejectionComment: comment ?? null,
      lockedByAgentId: null,
      lockedAt: null,
      updatedAt: now,
    };

    this.store.campaigns.set(
      campaignId,
      updated as unknown as Record<string, unknown>,
    );

    this.store.recordAuditEvent(
      "campaign.rejected",
      {
        campaignId,
        validatorAgentId: agentId,
        reason,
        comment: comment ?? null,
      },
      campaign.brandAccountId,
    );

    return updated;
  }

  /**
   * Enrichit la vue backoffice avec les données de profil marque et les alertes (RG87, RG95)
   */
  enrichBackofficeCampaign(campaign: Campaign): CampaignBackofficeView {
    const base = sanitizeCampaignForBackoffice(campaign);
    const brandProfile = this.brandProfileService.getProfileByAccountId(
      campaign.brandAccountId,
    );

    const publishedCampaignsCount = Array.from(
      this.store.campaigns.values(),
    ).filter((other) => {
      const parsed = this.ensureParsed(other);
      return (
        parsed.brandAccountId === campaign.brandAccountId &&
        parsed.status === "publiee"
      );
    }).length;

    const brandSummary = brandProfile
      ? {
          companyName: brandProfile.companyName || "Marque",
          country: brandProfile.country || "FR",
          website: brandProfile.website || "",
          isVerified: brandProfile.status === "publie",
          publishedCampaignsCount,
        }
      : {
          companyName: "Marque " + campaign.brandAccountId.slice(0, 8),
          country: "FR",
          website: "",
          isVerified: false,
          publishedCampaignsCount,
        };

    const reviewWarnings = [...base.reviewWarnings];

    // RG95: Alerte de doublon si une autre campagne publiée de la même marque a un titre similaire
    const duplicate = Array.from(this.store.campaigns.values()).find((raw) => {
      const other = this.ensureParsed(raw);
      if (
        other.id === campaign.id ||
        other.brandAccountId !== campaign.brandAccountId
      ) {
        return false;
      }
      if (other.status !== "publiee") return false;
      const t1 = campaign.title.toLowerCase().trim();
      const t2 = other.title.toLowerCase().trim();
      return (
        t1 === t2 ||
        (t1.length >= 8 && t2.includes(t1)) ||
        (t2.length >= 8 && t1.includes(t2))
      );
    });

    if (duplicate) {
      const dupParsed = this.ensureParsed(duplicate);
      reviewWarnings.push(
        `La même marque a déjà une campagne au titre proche : "${dupParsed.title}" (${dupParsed.id.slice(0, 8)}). Information informative (RG95), pas un refus automatique.`,
      );
    }

    return {
      ...base,
      reviewWarnings,
      brandSummary,
    };
  }

  /**
   * Consultation Backoffice complète avec métadonnées d'enquête (RG83, RG87)
   */
  getCampaignForBackoffice(
    campaignId: string,
    _agentId: string,
  ): CampaignBackofficeView {
    const campaign = this.getCampaignById(campaignId);
    if (!campaign) {
      throw new Error(`Campagne introuvable : ${campaignId}`);
    }
    return this.enrichBackofficeCampaign(campaign);
  }

  /**
   * Liste des campagnes pour la file backoffice avec filtres
   */
  listCampaignsForBackoffice(
    filters: CampaignListFilters = {},
  ): CampaignBackofficeView[] {
    const results: CampaignBackofficeView[] = [];

    for (const raw of this.store.campaigns.values()) {
      const c = this.ensureParsed(raw);

      if (filters.status && c.status !== filters.status) continue;
      if (
        filters.brandAccountId &&
        c.brandAccountId !== filters.brandAccountId
      ) {
        continue;
      }
      if (filters.agentId && c.responsibleAgentId !== filters.agentId) continue;
      if (filters.sensitiveOnly && !isSensitiveSector(c.productCategory)) {
        continue;
      }

      results.push(this.enrichBackofficeCampaign(c));
    }

    // Tri par ancienneté croissante de soumission pour la file de modération (RG87)
    return results.sort((a, b) => {
      const dateA = a.submittedAt || a.createdAt;
      const dateB = b.submittedAt || b.createdAt;
      return dateA.localeCompare(dateB);
    });
  }

  /**
   * File de modération paginée avec métriques SLA (RG87, RG96, 17b §3.8)
   */
  getBackofficeQueue(
    params: {
      page?: number;
      limit?: number;
      status?: CampaignStatus | "all";
      sensitiveOnly?: boolean;
      brandAccountId?: string;
      search?: string;
    } = {},
  ): CampaignQueueResponse & { campaigns: CampaignBackofficeView[] } {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(50, Math.max(1, params.limit || 20));

    const allCampaigns: CampaignBackofficeView[] = [];
    let totalPending = 0;
    let totalSensitive = 0;
    let totalInReview = 0;
    let oldestPendingTimestamp: number | null = null;
    const now = Date.now();

    for (const raw of this.store.campaigns.values()) {
      const c = this.ensureParsed(raw);
      const isSensitive = isSensitiveSector(c.productCategory);

      if (c.status === "a_valider") {
        totalPending++;
        const submitted = c.submittedAt
          ? new Date(c.submittedAt).getTime()
          : new Date(c.createdAt).getTime();
        if (
          oldestPendingTimestamp === null ||
          submitted < oldestPendingTimestamp
        ) {
          oldestPendingTimestamp = submitted;
        }
      }
      if (isSensitive) {
        totalSensitive++;
      }
      if (c.lockedByAgentId && c.lockedAt) {
        const lockAgeMs = now - new Date(c.lockedAt).getTime();
        if (lockAgeMs < 30 * 60 * 1000) {
          totalInReview++;
        }
      }

      // Filtres
      if (
        params.status &&
        params.status !== "all" &&
        c.status !== params.status
      ) {
        continue;
      }
      if (params.brandAccountId && c.brandAccountId !== params.brandAccountId) {
        continue;
      }
      if (params.sensitiveOnly && !isSensitive) {
        continue;
      }
      if (params.search) {
        const q = params.search.toLowerCase();
        const matches =
          c.title.toLowerCase().includes(q) ||
          c.productCategory.toLowerCase().includes(q) ||
          c.productName.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q);
        if (!matches) continue;
      }

      allCampaigns.push(this.enrichBackofficeCampaign(c));
    }

    // Tri par ancienneté croissante (RG87) : les plus anciennes en premier
    allCampaigns.sort((a, b) => {
      const dateA = a.submittedAt || a.createdAt;
      const dateB = b.submittedAt || b.createdAt;
      return dateA.localeCompare(dateB);
    });

    const total = allCampaigns.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const items = allCampaigns.slice(startIndex, startIndex + limit);

    const oldestPendingHours = oldestPendingTimestamp
      ? Math.round((now - oldestPendingTimestamp) / (1000 * 60 * 60))
      : 0;

    return {
      items,
      campaigns: items,
      total,
      page,
      limit,
      totalPages,
      metrics: {
        totalPending,
        totalSensitive,
        totalInReview,
        oldestPendingHours,
      },
    };
  }
}
