import { randomUUID } from "node:crypto";
import {
  type Account,
  type CountryCode,
  type BrandProfile,
  type BrandProfilePublicView,
  type BrandProfileRevealedView,
  type UpdateBrandProfileRequest,
  type BrandRejectionReason,
  BrandProfileSchema,
  BrandProfilePublicViewSchema,
  BrandProfileRevealedViewSchema,
  calculateBrandProfileCompleteness,
  normalizeWebsiteDomain,
  detectDirectContactInText,
} from "@influx/contracts";
import { MockStore } from "../mocks/mock-store";

export class BrandProfileService {
  private store: MockStore;

  constructor(store?: MockStore) {
    this.store = store ?? MockStore.getInstance();
  }

  /**
   * Récupère le profil marque par son accountId
   */
  getProfileByAccountId(accountId: string): BrandProfile | undefined {
    const raw = this.store.brandProfiles.get(accountId);
    if (!raw) return undefined;
    return this.ensureParsed(raw);
  }

  /**
   * Récupère le profil marque par son ID unique ou son accountId
   */
  getProfileById(profileId: string): BrandProfile | undefined {
    for (const raw of this.store.brandProfiles.values()) {
      if (raw.id === profileId || raw.accountId === profileId) {
        return this.ensureParsed(raw);
      }
    }
    return undefined;
  }

  /**
   * Récupère le profil marque ou en initialise un à l'état brouillon
   * pré-rempli avec les données du compte (RG1, RG2, CA1)
   */
  getOrCreateProfile(account: Account): BrandProfile {
    const existing = this.getProfileByAccountId(account.id);
    if (existing) {
      return existing;
    }

    const now = new Date().toISOString();
    const emailPrefix = account.email.split("@")[0] ?? "marque";
    const defaultCompanyName =
      emailPrefix.replace(/[._-]/g, " ") || "Nouvelle Marque";

    const draft: BrandProfile = {
      id: randomUUID(),
      accountId: account.id,
      status: "brouillon",
      companyName:
        defaultCompanyName.charAt(0).toUpperCase() +
        defaultCompanyName.slice(1),
      logoUrl: null,
      sector: "",
      secondarySectors: [],
      companySize: "1-10",
      country: account.countryCode || "FR",
      targetMarkets: [account.countryCode || "FR"],
      languages: [account.preferredLanguage || "fr"],
      website: null,
      presentation: "",
      topics: [],
      targetNetworks: [],
      expectedFormats: [],
      indicativeBudgetBand: null,
      currency: "EUR",
      usageRights: [],
      exclusivity: "none",
      nonMonetaryCounterpart: false,
      targetAudienceCountries: [account.countryCode || "FR"],
      collaborationRhythm: "one_off",
      contactRole: "marketing",
      contactFirstName: null,
      contactEmail: account.email,
      contactPhone: null,
      contactPageUrl: null,
      legalName: null,
      registrationCountry: account.countryCode || "FR",
      registrationNumber: null,
      internalNotes: null,
      badgeStatus: "none",
      badgeVerifiedAt: null,
      badgeExpiresAt: null,
      badgeDomainProofCode: null,
      completenessScore: 0,
      rejectionReason: null,
      rejectionMessage: null,
      publishedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    const completeness = calculateBrandProfileCompleteness(draft);
    draft.completenessScore = completeness.score;

    this.store.brandProfiles.set(account.id, draft as any);
    this.store.recordAuditEvent(
      "brand_profile.created",
      {
        profileId: draft.id,
        accountId: account.id,
        initialStatus: "brouillon",
      },
      account.id,
    );

    return draft;
  }

  /**
   * Met à jour le profil de la marque (RG17, RG19, RG57, RG58)
   */
  updateProfile(
    accountId: string,
    input: UpdateBrandProfileRequest,
  ): BrandProfile {
    let profile = this.getProfileByAccountId(accountId);
    if (!profile) {
      const account = this.store.getAccountById(accountId);
      if (!account) {
        throw new Error("Compte annonceur introuvable");
      }
      profile = this.getOrCreateProfile(account);
    }

    const previousStatus = profile.status;
    const now = new Date().toISOString();

    // 1. Normalisation du domaine de site web si fourni (RG17, CA4)
    let normalizedWebsite = profile.website;
    if (input.website !== undefined) {
      normalizedWebsite = input.website
        ? normalizeWebsiteDomain(input.website)
        : null;
    }

    // 2. Détection de coordonnées directes dans la présentation (RG19)
    if (input.presentation && detectDirectContactInText(input.presentation)) {
      this.store.recordAuditEvent(
        "brand_profile.direct_contact_detected",
        {
          profileId: profile.id,
          accountId,
          field: "presentation",
        },
        accountId,
      );
    }

    // 3. Détection des champs modifiés qui imposent une re-validation si le profil était publié (RG9)
    const requiresRevalidation =
      previousStatus === "publie" &&
      ((input.companyName && input.companyName !== profile.companyName) ||
        (input.logoUrl !== undefined && input.logoUrl !== profile.logoUrl) ||
        (input.sector && input.sector !== profile.sector) ||
        (input.presentation && input.presentation !== profile.presentation) ||
        (input.website !== undefined &&
          normalizedWebsite !== profile.website) ||
        (input.contactRole && input.contactRole !== profile.contactRole));

    const newStatus = requiresRevalidation ? "en_attente" : profile.status;

    // 4. Fusion des champs
    const updated: BrandProfile = {
      ...profile,
      ...input,
      website: normalizedWebsite,
      status: newStatus,
      updatedAt: now,
    };

    // 5. Recalcul automatique de la complétude (RG57, RG58)
    const completeness = calculateBrandProfileCompleteness(updated);
    updated.completenessScore = completeness.score;

    this.store.brandProfiles.set(accountId, updated as any);

    this.store.recordAuditEvent(
      "brand_profile.updated",
      {
        profileId: profile.id,
        accountId,
        completenessScore: updated.completenessScore,
        requiresRevalidation,
        newStatus,
      },
      accountId,
    );

    return updated;
  }

  /**
   * Soumission du profil pour validation humaine (RG5, RG61, CA6, CA7)
   */
  submitForValidation(accountId: string): {
    success: boolean;
    profile: BrandProfile;
    missingFields?: string[];
  } {
    const profile = this.getProfileByAccountId(accountId);
    if (!profile) {
      throw new Error("Profil marque introuvable");
    }

    const { score, missingRequiredForPublish } =
      calculateBrandProfileCompleteness(profile);

    // Vérification des champs obligatoires (RG5, CA7)
    if (missingRequiredForPublish.length > 0) {
      return {
        success: false,
        profile,
        missingFields: missingRequiredForPublish,
      };
    }

    // Passage à l'état 'en_attente' (RG3, CA6)
    const now = new Date().toISOString();
    const updated: BrandProfile = {
      ...profile,
      status: "en_attente",
      completenessScore: score,
      rejectionReason: null,
      rejectionMessage: null,
      updatedAt: now,
    };

    this.store.brandProfiles.set(accountId, updated as any);
    this.store.recordAuditEvent(
      "brand_profile.submitted",
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
   * Vue adaptée selon l'acteur (D40 : Masquage symétrique, RG73, RG74)
   */
  getProfileView(
    profileIdOrAccountId: string,
    viewer?: { id: string; role: string } | null,
    options?: { isRevealed?: boolean },
  ): BrandProfile | BrandProfilePublicView | BrandProfileRevealedView {
    let profile = this.getProfileByAccountId(profileIdOrAccountId);
    if (!profile) {
      profile = this.getProfileById(profileIdOrAccountId);
    }
    if (!profile) {
      throw new Error("Profil marque introuvable");
    }

    // 1. Rôle interne (agent/admin) ou propriétaire (annonceur) : profil complet
    if (
      viewer &&
      (viewer.role === "agent" ||
        viewer.role === "admin" ||
        viewer.id === profile.accountId)
    ) {
      return profile;
    }

    // 2. Rôle créateur : masquage symétrique D40 (RG74)
    if (options?.isRevealed) {
      return BrandProfileRevealedViewSchema.parse(profile);
    }

    return BrandProfilePublicViewSchema.parse(profile);
  }

  /**
   * Action Backoffice : Validation et publication par un commercial (RG6, RG78)
   */
  publishProfile(profileId: string, agentId: string): BrandProfile {
    const profile = this.getProfileById(profileId);
    if (!profile) {
      throw new Error("Profil introuvable");
    }

    const now = new Date().toISOString();
    const isFirstPublication = !profile.publishedAt;

    const updated: BrandProfile = {
      ...profile,
      status: "publie",
      publishedAt: profile.publishedAt || now,
      rejectionReason: null,
      rejectionMessage: null,
      updatedAt: now,
    };

    this.store.brandProfiles.set(profile.accountId, updated as any);
    this.store.recordAuditEvent(
      "brand_profile.published",
      {
        profileId: profile.id,
        accountId: profile.accountId,
        agentId,
        isFirstPublication,
      },
      profile.accountId,
    );

    if (isFirstPublication) {
      // Émission d'événement outbox profile.completed (RG78)
      this.store.outboxEvents.push({
        id: `outbox-${randomUUID()}`,
        eventType: "profile.completed",
        payload: {
          accountId: profile.accountId,
          profileId: profile.id,
          companyName: profile.companyName,
          sector: profile.sector,
          country: profile.country,
        },
        status: "pending",
        attempts: 0,
        createdAt: now,
      });
    }

    return updated;
  }

  /**
   * Action Backoffice : Refus motivé par un commercial (RG10, RG66)
   */
  rejectProfile(
    profileId: string,
    agentId: string,
    reason: BrandRejectionReason,
    customMessage?: string,
  ): BrandProfile {
    const profile = this.getProfileById(profileId);
    if (!profile) {
      throw new Error("Profil introuvable");
    }

    const now = new Date().toISOString();
    const updated: BrandProfile = {
      ...profile,
      status: "refuse",
      rejectionReason: reason,
      rejectionMessage: customMessage || null,
      updatedAt: now,
    };

    this.store.brandProfiles.set(profile.accountId, updated as any);
    this.store.recordAuditEvent(
      "brand_profile.rejected",
      {
        profileId: profile.id,
        accountId: profile.accountId,
        agentId,
        reason,
        customMessage,
      },
      profile.accountId,
    );

    return updated;
  }

  /**
   * Demande de badge Marque vérifiée (RG46, RG47, RG51)
   */
  requestBadge(
    accountId: string,
    data: {
      legalName: string;
      registrationCountry: CountryCode;
      registrationNumber: string;
    },
  ): BrandProfile {
    const profile = this.getProfileByAccountId(accountId);
    if (!profile) {
      throw new Error("Profil introuvable");
    }

    if (!profile.website) {
      throw new Error("Un domaine web est obligatoire pour demander le badge");
    }

    const now = new Date().toISOString();
    const proofCode = `INFLUX-VERIF-${randomUUID().slice(0, 8).toUpperCase()}`;

    const updated: BrandProfile = {
      ...profile,
      legalName: data.legalName,
      registrationCountry: data.registrationCountry,
      registrationNumber: data.registrationNumber,
      badgeStatus: "pending",
      badgeDomainProofCode: proofCode,
      updatedAt: now,
    };

    const completeness = calculateBrandProfileCompleteness(updated);
    updated.completenessScore = completeness.score;

    this.store.brandProfiles.set(accountId, updated as any);
    this.store.recordAuditEvent(
      "brand_profile.badge_requested",
      {
        profileId: profile.id,
        accountId,
        proofCode,
      },
      accountId,
    );

    return updated;
  }

  private ensureParsed(raw: Record<string, unknown>): BrandProfile {
    if (!raw.id) {
      raw.id = randomUUID();
    }
    return BrandProfileSchema.parse({
      id: raw.id,
      accountId: raw.accountId,
      status: raw.status || "brouillon",
      companyName: raw.companyName || "Marque sans nom",
      logoUrl: raw.logoUrl ?? null,
      sector: raw.sector || "",
      secondarySectors: raw.secondarySectors || [],
      companySize: raw.companySize || "1-10",
      country: raw.country || "FR",
      targetMarkets: raw.targetMarkets || ["FR"],
      languages: raw.languages || ["fr"],
      website:
        raw.website ||
        (raw.websiteUrl
          ? normalizeWebsiteDomain(raw.websiteUrl as string)
          : null),
      presentation: raw.presentation || "",
      topics: raw.topics || [],
      targetNetworks: raw.targetNetworks || [],
      expectedFormats: raw.expectedFormats || [],
      indicativeBudgetBand: raw.indicativeBudgetBand || null,
      currency: raw.currency || "EUR",
      usageRights: raw.usageRights || [],
      exclusivity: raw.exclusivity || "none",
      nonMonetaryCounterpart: raw.nonMonetaryCounterpart || false,
      targetAudienceCountries: raw.targetAudienceCountries || ["FR"],
      collaborationRhythm: raw.collaborationRhythm || "one_off",
      contactRole: raw.contactRole || "marketing",
      contactFirstName:
        raw.contactFirstName ||
        (raw.contactPerson as string)?.split(" ")[0] ||
        null,
      contactEmail: raw.contactEmail || null,
      contactPhone: raw.contactPhone || null,
      contactPageUrl: raw.contactPageUrl || null,
      legalName: raw.legalName || null,
      registrationCountry: raw.registrationCountry || "FR",
      registrationNumber: raw.registrationNumber || null,
      internalNotes: raw.internalNotes || null,
      badgeStatus: raw.badgeStatus || "none",
      badgeVerifiedAt: raw.badgeVerifiedAt || null,
      badgeExpiresAt: raw.badgeExpiresAt || null,
      badgeDomainProofCode: raw.badgeDomainProofCode || null,
      completenessScore:
        typeof raw.completenessScore === "number"
          ? raw.completenessScore
          : (raw.completenessPercent as number) || 0,
      rejectionReason: raw.rejectionReason || null,
      rejectionMessage: raw.rejectionMessage || null,
      publishedAt: raw.publishedAt || null,
      createdAt: raw.createdAt || new Date().toISOString(),
      updatedAt: raw.updatedAt || new Date().toISOString(),
    });
  }
}

export const brandProfileService = new BrandProfileService();
