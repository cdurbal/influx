import { randomUUID } from "node:crypto";
import {
  type Account,
  type CreatorProfile,
  type CreatorPublicProfile,
  type CreatorRevealedProfile,
  type UpdateCreatorProfileRequest,
  type CreatorRejectionReason,
  type CreatorNetworkInternal,
  type CreatorOfferInternal,
  type PortfolioItemInternal,
  type PriceBand,
  type AudienceBand,
  type EngagementBand,
  CreatorProfileSchema,
  generateCreatorAlias,
  calculateAudienceBand,
  calculateEngagementBand,
  getEstimatedNetForPriceBand,
  calculateCreatorProfileCompleteness,
  sanitizeCreatorProfileToPublic,
  sanitizeCreatorProfileToRevealed,
  detectDirectContactInText,
} from "@influx/contracts";
import { MockStore } from "../mocks/mock-store";

function normalizePriceBand(rawBand: unknown): PriceBand {
  if (typeof rawBand !== "string") return "500_1000";
  const normalized = rawBand.replace(/-/g, "_");
  if (normalized === "200_500" || normalized === "250_500") return "250_500";
  if (normalized === "500_1000") return "500_1000";
  if (normalized === "1000_2000" || normalized === "1000_2500")
    return "1000_2000";
  if (normalized === "2000_5000") return "2000_5000";
  if (normalized === "5000_10000") return "5000_10000";
  if (normalized === "plus_10000" || normalized === "gt_10000")
    return "plus_10000";
  if (normalized === "lt_250") return "lt_250";
  return "500_1000";
}

function normalizeAudienceBand(rawBand: unknown): AudienceBand {
  if (typeof rawBand !== "string") return "mid";
  if (rawBand === "nano" || rawBand === "lt_10k" || rawBand === "<10k")
    return "nano";
  if (rawBand === "micro" || rawBand === "10k-50k" || rawBand === "10k_50k")
    return "micro";
  if (rawBand === "mid" || rawBand === "50k-100k" || rawBand === "50k_100k")
    return "mid";
  if (
    rawBand === "macro" ||
    rawBand === "100k-250k" ||
    rawBand === "100k-500k" ||
    rawBand === "100k_500k"
  )
    return "macro";
  if (rawBand === "mega" || rawBand === ">500k" || rawBand === "plus_500k")
    return "mega";
  return "mid";
}

function normalizeEngagementBand(rawBand: unknown): EngagementBand {
  if (typeof rawBand !== "string") return "3_6";
  if (rawBand.includes("<") || rawBand === "lt_1") return "lt_1";
  if (rawBand.includes("1-3") || rawBand.includes("1_3")) return "1_3";
  if (
    rawBand.includes("3-5") ||
    rawBand.includes("3-6") ||
    rawBand.includes("3_6")
  )
    return "3_6";
  if (
    rawBand.includes("5-8") ||
    rawBand.includes(">") ||
    rawBand.includes("gt_6")
  )
    return "gt_6";
  return "3_6";
}

export class CreatorProfileService {
  private store: MockStore;

  constructor(store?: MockStore) {
    this.store = store ?? MockStore.getInstance();
  }

  /**
   * Récupère le profil créateur par son accountId
   */
  getProfileByAccountId(accountId: string): CreatorProfile | undefined {
    const raw = this.store.creatorProfiles.get(accountId);
    if (!raw) return undefined;
    return this.ensureParsed(raw);
  }

  /**
   * Récupère le profil créateur par son ID unique ou son accountId
   */
  getProfileById(profileId: string): CreatorProfile | undefined {
    const direct = this.store.creatorProfiles.get(profileId);
    if (direct) {
      return this.ensureParsed(direct);
    }
    for (const raw of this.store.creatorProfiles.values()) {
      if (raw.id === profileId || raw.accountId === profileId) {
        return this.ensureParsed(raw);
      }
    }
    return undefined;
  }

  /**
   * Récupère le profil créateur ou en initialise un à l'état brouillon
   * pré-rempli avec les données du compte (RG1, RG2, CA1)
   */
  getOrCreateProfile(account: Account): CreatorProfile {
    const existing = this.getProfileByAccountId(account.id);
    if (existing) {
      return existing;
    }

    const now = new Date().toISOString();
    const alias = generateCreatorAlias();

    const draft: CreatorProfile = {
      id: randomUUID(),
      accountId: account.id,
      status: "brouillon",
      alias,
      shortTitle: "",
      bio: "",
      primaryTopic: "",
      secondaryTopics: [],
      editorialTone: [],
      languages: [account.preferredLanguage || "fr"],
      country: account.countryCode || "FR",
      region: null,
      city: null,
      travelScope: "none",
      collaborationExperienceBand: "none",
      networks: [],
      audience: {
        primaryCountry: account.countryCode || "FR",
        primaryCountryShareBand: "gte_80",
        otherCountries: [],
        figuresSource: "declared",
        figuresUpdatedAt: now,
      },
      offers: [],
      availability: "lt_2w",
      availabilityDeclaredAt: now,
      acceptsNonMonetaryCounterpart: false,
      portfolio: [],
      searchVisibility: true,
      completenessScore: 0,
      pseudonym: null,
      legalFirstName: null,
      legalLastName: null,
      birthDate: null,
      phone: null,
      email: account.email,
      postalAddress: null,
      declaredStatus:
        account.role === "creator" ? "individual" : "professional",
      refusedSectors: [],
      internalNotes: null,
      rejectionReason: null,
      rejectionMessage: null,
      publishedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    const validated = CreatorProfileSchema.parse(draft);
    this.store.creatorProfiles.set(account.id, validated as any);

    this.store.recordAuditEvent(
      "creator_profile.initialized",
      {
        profileId: validated.id,
        accountId: account.id,
        alias: validated.alias,
      },
      account.id,
    );

    return validated;
  }

  /**
   * Mise à jour des informations du profil créateur (RG9, RG14, RG87)
   */
  updateProfile(
    accountId: string,
    input: UpdateCreatorProfileRequest,
  ): CreatorProfile {
    let profile = this.getProfileByAccountId(accountId);
    if (!profile) {
      const account = this.store.accounts.get(accountId);
      profile = this.getOrCreateProfile(
        account ||
          ({
            id: accountId,
            email: "creator@influx.dev",
            role: "creator",
            preferredLanguage: "fr",
            countryCode: "FR",
          } as any),
      );
    }

    const now = new Date().toISOString();

    // Détection de coordonnées dans les champs publics texte (RG27, RG82, CA7)
    if (input.shortTitle && detectDirectContactInText(input.shortTitle)) {
      throw new Error(
        "Le titre court contient des coordonnées ou un identifiant interdit en couche publique",
      );
    }
    if (input.bio && detectDirectContactInText(input.bio)) {
      throw new Error(
        "La bio contient des coordonnées ou un identifiant interdit en couche publique",
      );
    }

    // Traitement des réseaux et dérivation automatique des tranches
    let updatedNetworks = profile.networks;
    if (input.networks) {
      updatedNetworks = input.networks.map((net) => {
        const followers = net.followersCount ?? 0;
        const audienceBand =
          net.audienceBand || calculateAudienceBand(followers);
        const engagementRate = net.engagementRate;
        const engagementRateBand =
          net.engagementRateBand ||
          (typeof engagementRate === "number"
            ? calculateEngagementBand(engagementRate)
            : null);

        return {
          ...net,
          audienceBand,
          engagementRateBand,
          figuresUpdatedAt: net.figuresUpdatedAt || now,
        };
      });
    }

    // Traitement des offres et calcul du net estimé depuis le barème (RG68, RG72)
    let updatedOffers = profile.offers;
    if (input.offers) {
      updatedOffers = input.offers.map((off) => {
        const pBand = normalizePriceBand(off.priceBand);
        const netRef = getEstimatedNetForPriceBand(pBand, off.currency);
        return {
          ...off,
          priceBand: pBand,
          estimatedNetMinMinor: netRef.minNetMinor,
          estimatedNetMaxMinor: netRef.maxNetMinor,
        };
      });
    }

    // Gestion du régime de re-validation (RG9, CA48, CA49)
    let newStatus = profile.status;
    let requiresRevalidation = false;

    if (profile.status === "publie") {
      const isSensitiveModified =
        (input.shortTitle !== undefined &&
          input.shortTitle !== profile.shortTitle) ||
        (input.bio !== undefined && input.bio !== profile.bio) ||
        input.networks !== undefined;

      if (isSensitiveModified) {
        newStatus = "en_attente";
        requiresRevalidation = true;
      }
    }

    const updatedData: CreatorProfile = {
      ...profile,
      shortTitle: input.shortTitle ?? profile.shortTitle,
      bio: input.bio ?? profile.bio,
      primaryTopic: input.primaryTopic ?? profile.primaryTopic,
      secondaryTopics: input.secondaryTopics ?? profile.secondaryTopics,
      editorialTone: input.editorialTone ?? profile.editorialTone,
      languages: input.languages ?? profile.languages,
      country: input.country ?? profile.country,
      region: input.region !== undefined ? input.region : profile.region,
      city: input.city !== undefined ? input.city : profile.city,
      travelScope: input.travelScope ?? profile.travelScope,
      collaborationExperienceBand:
        input.collaborationExperienceBand ??
        profile.collaborationExperienceBand,
      networks: updatedNetworks,
      audience:
        input.audience !== undefined ? input.audience : profile.audience,
      offers: updatedOffers,
      availability: input.availability ?? profile.availability,
      acceptsNonMonetaryCounterpart:
        input.acceptsNonMonetaryCounterpart ??
        profile.acceptsNonMonetaryCounterpart,
      searchVisibility:
        input.searchVisibility !== undefined
          ? input.searchVisibility
          : profile.searchVisibility,
      pseudonym:
        input.pseudonym !== undefined ? input.pseudonym : profile.pseudonym,
      legalFirstName:
        input.legalFirstName !== undefined
          ? input.legalFirstName
          : profile.legalFirstName,
      legalLastName:
        input.legalLastName !== undefined
          ? input.legalLastName
          : profile.legalLastName,
      birthDate:
        input.birthDate !== undefined ? input.birthDate : profile.birthDate,
      phone: input.phone !== undefined ? input.phone : profile.phone,
      email: input.email !== undefined ? input.email : profile.email,
      postalAddress:
        input.postalAddress !== undefined
          ? input.postalAddress
          : profile.postalAddress,
      refusedSectors: input.refusedSectors ?? profile.refusedSectors,
      status: newStatus,
      updatedAt: now,
    };

    // Recalcul du score de complétude (RG86, RG87)
    const { score } = calculateCreatorProfileCompleteness(updatedData);
    updatedData.completenessScore = score;

    const validated = CreatorProfileSchema.parse(updatedData);
    this.store.creatorProfiles.set(accountId, validated as any);

    this.store.recordAuditEvent(
      "creator_profile.updated",
      {
        profileId: validated.id,
        accountId,
        completenessScore: score,
        requiresRevalidation,
        newStatus,
      },
      accountId,
    );

    return validated;
  }

  /**
   * Soumission du profil pour validation humaine par un agent (RG4, RG5, CA8)
   */
  submitForValidation(accountId: string): {
    success: boolean;
    profile: CreatorProfile;
    missingFields?: string[];
  } {
    let profile = this.getProfileByAccountId(accountId);
    if (!profile) {
      const account = this.store.accounts.get(accountId);
      profile = this.getOrCreateProfile(
        account ||
          ({
            id: accountId,
            email: "creator@influx.dev",
            role: "creator",
            preferredLanguage: "fr",
            countryCode: "FR",
          } as any),
      );
    }

    const { score, missingRequiredForPublish } =
      calculateCreatorProfileCompleteness(profile);

    // Vérification de tous les champs obligatoires (RG4, RG16)
    if (missingRequiredForPublish.length > 0) {
      return {
        success: false,
        profile,
        missingFields: missingRequiredForPublish,
      };
    }

    // Passage à l'état 'en_attente'
    const now = new Date().toISOString();
    const updated: CreatorProfile = {
      ...profile,
      status: "en_attente",
      completenessScore: score,
      rejectionReason: null,
      rejectionMessage: null,
      updatedAt: now,
    };

    this.store.creatorProfiles.set(accountId, updated as any);
    this.store.recordAuditEvent(
      "creator_profile.submitted",
      {
        profileId: profile.id,
        accountId,
        completenessScore: score,
      },
      accountId,
    );

    return {
      success: true,
      profile: updated,
    };
  }

  /**
   * Validation commerciale et publication du profil créateur (RG3, RG5, RG106)
   */
  publishProfile(
    profileIdOrAccountId: string,
    agentId: string,
  ): CreatorProfile {
    const profile = this.getProfileById(profileIdOrAccountId);
    if (!profile) {
      throw new Error("Profil créateur introuvable");
    }

    const now = new Date().toISOString();
    const isFirstPublication = !profile.publishedAt;

    const updated: CreatorProfile = {
      ...profile,
      status: "publie",
      publishedAt: profile.publishedAt || now,
      rejectionReason: null,
      rejectionMessage: null,
      updatedAt: now,
    };

    this.store.creatorProfiles.set(profile.accountId, updated as any);

    this.store.recordAuditEvent(
      "creator_profile.published",
      {
        profileId: profile.id,
        accountId: profile.accountId,
        agentId,
        isFirstPublication,
      },
      agentId,
    );

    // Événement outbox pour la synchronisation CRM (RG106)
    this.store.outboxEvents.push({
      id: randomUUID(),
      eventType: isFirstPublication ? "profile.completed" : "lead.updated",
      payload: {
        accountId: profile.accountId,
        role: "creator",
        profileId: profile.id,
        primaryTopic: profile.primaryTopic,
        country: profile.country,
        completenessScore: profile.completenessScore,
        publishedAt: updated.publishedAt,
      },
      status: "pending",
      attempts: 0,
      createdAt: now,
    });

    return updated;
  }

  /**
   * Refus motivé d'un profil créateur par un agent (RG10, RG95, RG96, CA51)
   */
  rejectProfile(
    profileIdOrAccountId: string,
    agentId: string,
    reason: CreatorRejectionReason,
    customMessage?: string,
  ): CreatorProfile {
    const profile = this.getProfileById(profileIdOrAccountId);
    if (!profile) {
      throw new Error("Profil créateur introuvable");
    }

    const now = new Date().toISOString();
    const updated: CreatorProfile = {
      ...profile,
      status: "refuse",
      rejectionReason: reason,
      rejectionMessage: customMessage || null,
      updatedAt: now,
    };

    this.store.creatorProfiles.set(profile.accountId, updated as any);

    this.store.recordAuditEvent(
      "creator_profile.rejected",
      {
        profileId: profile.id,
        accountId: profile.accountId,
        agentId,
        reason,
        customMessage,
      },
      agentId,
    );

    return updated;
  }

  /**
   * Récupère la Vue Publique Anonyme d'un créateur (Couche A)
   * Servie aux marques avant ouverture d'une mise en relation (RG18, RG102, CA4)
   */
  getAnonymousView(creatorIdOrAccountId: string): CreatorPublicProfile {
    const profile = this.getProfileById(creatorIdOrAccountId);
    if (!profile) {
      throw new Error("Profil créateur introuvable");
    }

    return sanitizeCreatorProfileToPublic(profile);
  }

  /**
   * Récupère la Vue Révélée d'un créateur (Couche A + Couche I)
   * Servie aux marques APRÈS ouverture d'une mise en relation (RG19, RG102, CA14, CA56)
   */
  getRevealedView(
    creatorIdOrAccountId: string,
    _viewerRole?: string,
  ): CreatorRevealedProfile {
    const profile = this.getProfileById(creatorIdOrAccountId);
    if (!profile) {
      throw new Error("Profil créateur introuvable");
    }

    return sanitizeCreatorProfileToRevealed(profile);
  }

  /**
   * Assure la conformité du profil avec le schéma Zod et adapte les données mock
   */
  private ensureParsed(raw: Record<string, unknown>): CreatorProfile {
    if (!raw.id) {
      raw.id = randomUUID();
    }

    // Adaptation des réseaux du seed si au format simplifié
    let networks: CreatorNetworkInternal[] = [];
    if (Array.isArray(raw.networks) && raw.networks.length > 0) {
      if (typeof raw.networks[0] === "string") {
        const rawList = raw.networks as string[];
        const audBand = normalizeAudienceBand(raw.audienceBand);
        const engBand = normalizeEngagementBand(raw.engagementBand);
        networks = rawList.map((net, idx) => ({
          network: net,
          isPrimary: idx === 0,
          handle: (raw.publicHandle as string) || `@${net}_creator`,
          profileUrl:
            (raw.channelUrl as string) || `https://${net}.com/@creator`,
          followersCount: 50000,
          audienceBand: audBand,
          engagementRate: 3.5,
          engagementRateBand: engBand,
          avgReachPerPost: 25000,
          averageReachBand: "micro",
          publicationFrequency: "weekly",
          figuresSource: raw.badge ? "agent_observed" : "declared",
          figuresUpdatedAt: new Date().toISOString(),
          hasVerifiedAccountBadge: !!raw.badge,
          hasVerifiedAudienceBadge: !!raw.badge,
          accountBadgeVerifiedAt: raw.badge ? new Date().toISOString() : null,
          audienceBadgeVerifiedAt: raw.badge ? new Date().toISOString() : null,
        }));
      } else {
        networks = (raw.networks as any[]).map((n) => ({
          ...n,
          audienceBand: normalizeAudienceBand(n.audienceBand),
          engagementRateBand: n.engagementRateBand
            ? normalizeEngagementBand(n.engagementRateBand)
            : null,
        }));
      }
    }

    // Adaptation des offres du seed
    let offers: CreatorOfferInternal[] = [];
    if (Array.isArray(raw.offers) && raw.offers.length > 0) {
      offers = (raw.offers as any[]).map((off) => {
        const pBand = normalizePriceBand(off.priceBand);
        const netRef = getEstimatedNetForPriceBand(
          pBand,
          off.currency || "EUR",
        );
        return {
          ...off,
          priceBand: pBand,
          currency: off.currency || "EUR",
          estimatedNetMinMinor: off.estimatedNetMinMinor ?? netRef.minNetMinor,
          estimatedNetMaxMinor: off.estimatedNetMaxMinor ?? netRef.maxNetMinor,
        };
      });
    } else if (Array.isArray(raw.formats) && raw.formats.length > 0) {
      const net = networks[0]?.network || "instagram";
      const priceBand = normalizePriceBand(raw.priceBand);
      const netRef = getEstimatedNetForPriceBand(priceBand, "EUR");
      offers = (raw.formats as string[]).map((fmt) => ({
        format: fmt,
        network: net,
        priceBand,
        currency: "EUR",
        deliveryLeadBand: "7_14d",
        includedUsageRights: [],
        optionalUsageRights: [],
        exclusivity: "none",
        exactAmountMinor: 75000,
        estimatedNetMinMinor: netRef.minNetMinor,
        estimatedNetMaxMinor: netRef.maxNetMinor,
      }));
    }

    // Adaptation du portfolio du seed
    let portfolio: PortfolioItemInternal[] = [];
    if (Array.isArray(raw.portfolio) && raw.portfolio.length > 0) {
      portfolio = raw.portfolio as PortfolioItemInternal[];
    } else {
      // 3 items par défaut pour le seed afin de satisfaire le minimum RG4/RG77
      portfolio = [
        {
          id: randomUUID(),
          imageUrl: "https://storage.influx.dev/portfolio/seed1.png",
          caption: "Exemple de publication validée",
          brandConsentConfirmed: false,
          displayOrder: 1,
          status: "approved",
          uploadedAt: new Date().toISOString(),
          exifStripped: true,
        },
        {
          id: randomUUID(),
          imageUrl: "https://storage.influx.dev/portfolio/seed2.png",
          caption: "Deuxième visuel approuvé",
          brandConsentConfirmed: false,
          displayOrder: 2,
          status: "approved",
          uploadedAt: new Date().toISOString(),
          exifStripped: true,
        },
        {
          id: randomUUID(),
          imageUrl: "https://storage.influx.dev/portfolio/seed3.png",
          caption: "Troisième visuel approuvé",
          brandConsentConfirmed: false,
          displayOrder: 3,
          status: "approved",
          uploadedAt: new Date().toISOString(),
          exifStripped: true,
        },
      ];
    }

    const primaryTopic =
      (raw.primaryTopic as string) ||
      (Array.isArray(raw.topics) ? (raw.topics[0] as string) : "tech");
    const secondaryTopics =
      (raw.secondaryTopics as string[]) ||
      (Array.isArray(raw.topics) ? (raw.topics.slice(1) as string[]) : []);

    const shortTitle =
      (raw.shortTitle as string) ||
      (raw.anonymousTitle as string) ||
      "Créateur professionnel partenaire INFLUX";

    const bio =
      (raw.bio as string) ||
      "Créateur de contenu vérifié réalisant des collaborations de qualité dans sa thématique de prédilection avec une communauté engagée et fidèle sur tous ses réseaux partenaires.";

    return CreatorProfileSchema.parse({
      id: raw.id,
      accountId: raw.accountId,
      status: raw.status || "publie",
      alias: raw.alias || generateCreatorAlias(),
      shortTitle,
      bio,
      primaryTopic,
      secondaryTopics,
      editorialTone: raw.editorialTone || ["pedagogique"],
      languages: raw.languages || ["fr"],
      country: raw.country || raw.primaryCountry || "FR",
      region: raw.region || null,
      city: raw.city || null,
      travelScope: raw.travelScope || "none",
      collaborationExperienceBand: raw.collaborationExperienceBand || "1_5",
      networks,
      audience: raw.audience || {
        primaryCountry: raw.primaryCountry || "FR",
        primaryCountryShareBand: "gte_80",
        primaryCountrySharePercent: 85,
        otherCountries: [],
        figuresSource: "declared",
        figuresUpdatedAt: new Date().toISOString(),
      },
      offers,
      availability: raw.availability || "lt_2w",
      availabilityDeclaredAt:
        raw.availabilityDeclaredAt || new Date().toISOString(),
      acceptsNonMonetaryCounterpart: raw.acceptsNonMonetaryCounterpart || false,
      portfolio,
      searchVisibility: raw.searchVisibility !== false,
      completenessScore:
        typeof raw.completenessScore === "number" ? raw.completenessScore : 100,
      pseudonym: raw.pseudonym || raw.publicHandle || null,
      legalFirstName:
        raw.legalFirstName || (raw.legalName as string)?.split(" ")[0] || null,
      legalLastName:
        raw.legalLastName || (raw.legalName as string)?.split(" ")[1] || null,
      birthDate: raw.birthDate || null,
      phone: raw.phone || null,
      email: raw.email || null,
      postalAddress: raw.postalAddress || null,
      declaredStatus: raw.declaredStatus || "individual",
      refusedSectors: raw.refusedSectors || [],
      internalNotes: raw.internalNotes || null,
      rejectionReason: raw.rejectionReason || null,
      rejectionMessage: raw.rejectionMessage || null,
      publishedAt: raw.publishedAt || new Date().toISOString(),
      createdAt: raw.createdAt || new Date().toISOString(),
      updatedAt: raw.updatedAt || new Date().toISOString(),
    });
  }
}

export const creatorProfileService = new CreatorProfileService();
