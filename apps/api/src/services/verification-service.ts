import { randomUUID } from "node:crypto";
import {
  type Account,
  type VerificationRequest,
  type OwnershipCode,
  type Badge,
  type CreateVerificationRequestInput,
  type DecideVerificationRequestInput,
  type RevokeBadgeInput,
  type VerificationStatus,
  type VerificationLevel,
  CreateVerificationRequestSchema,
  DecideVerificationRequestSchema,
  RevokeBadgeSchema,
  generateOwnershipCode,
  calculateBadgeLifecycleState,
  calculateAudienceBand,
  calculateEngagementBand,
  type CreatorProfile,
  type CreatorNetworkInternal,
  type EngagementBand,
  type VerificationQueueItem,
  type VerificationQueueResponse,
} from "@influx/contracts";
import { MockStore } from "../mocks/mock-store";

/**
 * Calcule l'échéance SLA en jours ouvrés (RG65 : 1 jour ouvré)
 */
function calculateSlaDueAt(startDate: Date, businessDays: number = 1): string {
  const result = new Date(startDate);
  let daysAdded = 0;
  while (daysAdded < businessDays) {
    result.setDate(result.getDate() + 1);
    // 0 = Dimanche, 6 = Samedi
    if (result.getDay() !== 0 && result.getDay() !== 6) {
      daysAdded++;
    }
  }
  return result.toISOString();
}

export class VerificationService {
  private store: MockStore;

  constructor(store?: MockStore) {
    this.store = store ?? MockStore.getInstance();
  }

  /**
   * Crée une nouvelle demande de vérification (RG11, RG14, RG21, RG31)
   */
  public async requestVerification(
    creatorAccount: Account,
    input: CreateVerificationRequestInput,
  ): Promise<{ request: VerificationRequest; ownershipCode?: OwnershipCode }> {
    const validated = CreateVerificationRequestSchema.parse(input);

    // Contrôle d'éligibilité : le demandeur doit être un compte créateur actif
    if (creatorAccount.status !== "active") {
      throw new Error(
        "Votre compte n'est pas actif pour demander une vérification",
      );
    }

    // RG44 / RG54 / D15 : Attestation de majorité obligatoire
    if (creatorAccount.isAdultAttested === false) {
      throw new Error(
        "L'attestation de majorité est requise pour demander une vérification (D15)",
      );
    }

    // Récupération du profil créateur
    const profile = this.store.creatorProfiles.get(creatorAccount.id) as
      CreatorProfile | undefined;
    if (!profile) {
      throw new Error("Profil créateur introuvable");
    }

    const networkObj = (profile.networks || []).find(
      (n) => n.network === validated.network,
    );
    if (!networkObj) {
      throw new Error(
        `Le réseau ${validated.network} n'est pas configuré dans votre profil`,
      );
    }

    // RG14 : Unicité de la demande active sur le triplet (compte, réseau, niveau)
    const existingActive = Array.from(
      this.store.verificationRequests.values(),
    ).find(
      (r) =>
        r.accountId === creatorAccount.id &&
        r.network === validated.network &&
        r.requestedLevel === validated.requestedLevel &&
        (r.status === "pending" || r.status === "in_review"),
    );

    if (existingActive) {
      throw new Error(
        `Une demande de vérification est déjà en cours pour ${validated.network} (${validated.requestedLevel})`,
      );
    }

    const now = new Date();
    const requestId = randomUUID();
    let ownershipCode: OwnershipCode | undefined;

    // Prise en charge selon le niveau demandé
    if (validated.requestedLevel === "account_ownership") {
      // RG21, RG22, RG23 : Génération d'un code unique valable 7 jours
      const codeStr = generateOwnershipCode();
      const codeId = randomUUID();
      const expiresAt = new Date(
        now.getTime() + 7 * 24 * 60 * 60 * 1000,
      ).toISOString();

      // Invalidation de tout code précédent pour ce triplet (RG23)
      for (const [cId, codeRec] of this.store.ownershipCodes.entries()) {
        if (
          codeRec.accountId === creatorAccount.id &&
          codeRec.network === validated.network &&
          !codeRec.revokedAt
        ) {
          this.store.ownershipCodes.set(cId, {
            ...codeRec,
            revokedAt: now.toISOString(),
          });
        }
      }

      ownershipCode = {
        id: codeId,
        accountId: creatorAccount.id,
        network: validated.network,
        code: codeStr,
        expiresAt,
        createdAt: now.toISOString(),
      };

      this.store.ownershipCodes.set(codeId, ownershipCode as any);
    } else if (validated.requestedLevel === "audience") {
      // RG12 : "Audience vérifiée" suppose "Compte vérifié" sur le même réseau
      if (!networkObj.hasVerifiedAccountBadge) {
        throw new Error(
          "Vous devez d'abord obtenir le niveau 'Compte vérifié' sur ce réseau avant de demander une vérification d'audience (RG12)",
        );
      }

      // RG31, RG33, RG57 : Preuves d'audience obligatoires
      if (
        !validated.evidenceFileIds ||
        validated.evidenceFileIds.length === 0
      ) {
        throw new Error(
          "Au moins une capture d'écran du tableau de bord officiel est requise pour vérifier l'audience (RG31)",
        );
      }
    }

    const request: VerificationRequest = {
      id: requestId,
      accountId: creatorAccount.id,
      network: validated.network,
      requestedLevel: validated.requestedLevel,
      status: "pending",
      slaDueAt: calculateSlaDueAt(now, 1),
      evidenceFileIds: validated.evidenceFileIds || [],
      ownershipCodeId: ownershipCode?.id ?? null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    this.store.verificationRequests.set(requestId, request as any);

    // Journalisation d'audit
    this.store.recordAuditEvent(
      "verification.request_created",
      {
        requestId,
        accountId: creatorAccount.id,
        network: validated.network,
        requestedLevel: validated.requestedLevel,
      },
      creatorAccount.id,
    );

    return { request, ownershipCode };
  }

  /**
   * Consultation de la file de vérification par un agent (RG61, RG62, RG64, B-E6, B-E9)
   */
  public getVerificationQueue(
    agentAccount: Account,
    filter?: {
      status?: VerificationStatus;
      network?: string;
      requestedLevel?: VerificationLevel;
      population?: "creators" | "brands";
      page?: number;
      limit?: number;
    },
  ): VerificationQueueResponse {
    if (agentAccount.role !== "agent" && agentAccount.role !== "admin") {
      throw new Error("Accès réservé aux agents et administrateurs");
    }

    const now = new Date();
    const requests = Array.from(
      this.store.verificationRequests.values(),
    ) as unknown as VerificationRequest[];

    // Expiration automatique des verrous orphelins (> 30 min, RG64)
    for (const req of requests) {
      if (
        req.status === "in_review" &&
        req.claimExpiresAt &&
        new Date(req.claimExpiresAt) < now
      ) {
        req.status = "pending";
        req.claimedByAgentId = null;
        req.claimedAt = null;
        req.claimExpiresAt = null;
        req.updatedAt = now.toISOString();
        this.store.verificationRequests.set(req.id, req as any);
      }
    }

    // Filtrage des requêtes par population pour les métriques globales de l'onglet
    const populationRequests = requests.filter((req) => {
      if (filter?.population === "brands")
        return req.requestedLevel === "brand";
      if (filter?.population === "creators")
        return req.requestedLevel !== "brand";
      return true;
    });

    // Calcul des métriques globales sur la population sélectionnée
    let totalPending = 0;
    let totalInReview = 0;
    let totalBreached = 0;
    let oldestPendingTime: number | null = null;

    for (const req of populationRequests) {
      if (req.status === "pending") totalPending++;
      if (req.status === "in_review") totalInReview++;

      const isBreached = now > new Date(req.slaDueAt);
      if (
        isBreached &&
        (req.status === "pending" || req.status === "in_review")
      ) {
        totalBreached++;
      }

      if (req.status === "pending" || req.status === "in_review") {
        const createdMs = new Date(req.createdAt).getTime();
        if (oldestPendingTime === null || createdMs < oldestPendingTime) {
          oldestPendingTime = createdMs;
        }
      }
    }

    const oldestPendingHours = oldestPendingTime
      ? Math.max(
          0,
          Math.round((now.getTime() - oldestPendingTime) / (1000 * 3600)),
        )
      : 0;

    // Enrichissement des items (creatorAlias, brandName, claimedByAgentName, SLA status)
    const enrichedItems: VerificationQueueItem[] = requests.map((req) => {
      const accId = req.accountId || (req as any).creatorAccountId || "";
      const slaDueAtStr =
        req.slaDueAt ||
        req.createdAt ||
        (req as any).submittedAt ||
        now.toISOString();
      const isBreached = now > new Date(slaDueAtStr);
      const overdueHours = isBreached
        ? Math.max(
            1,
            Math.round(
              (now.getTime() - new Date(slaDueAtStr).getTime()) / (1000 * 3600),
            ),
          )
        : 0;

      // Résolution de l'entité (créateur ou marque)
      const isBrand = req.requestedLevel === "brand";
      let creatorAlias: string | undefined;
      let brandName: string | undefined;

      if (isBrand) {
        const brandProfile = accId
          ? (this.store.brandProfiles.get(accId) as any)
          : undefined;
        brandName =
          brandProfile?.companyName ||
          brandProfile?.legalName ||
          (accId ? `Marque #${accId.slice(0, 4)}` : "Marque");
        creatorAlias = brandName;
      } else {
        const creatorProfile = accId
          ? (this.store.creatorProfiles.get(accId) as
              CreatorProfile | undefined)
          : undefined;
        creatorAlias =
          creatorProfile?.alias ||
          (accId ? `Créateur #${accId.slice(0, 4)}` : "Créateur inconnu");
      }

      // Résolution du nom de l'agent tenant le verrou
      let claimedByAgentName: string | null = null;
      if (req.claimedByAgentId) {
        const agent = this.store.accounts.get(req.claimedByAgentId);
        if (agent) {
          claimedByAgentName =
            agent.id === "88888888-8888-4888-8888-888888888888"
              ? "Alexandre INFLUX"
              : (agent.email.split("@")[0] ?? "Agent");
        }
      }

      return {
        ...req,
        accountId: accId,
        slaDueAt: slaDueAtStr,
        creatorAlias,
        brandName,
        claimedByAgentName,
        slaBreached: isBreached,
        slaOverdueHours: overdueHours,
      };
    });

    // Filtrage
    const filtered = enrichedItems.filter((req) => {
      if (filter?.population === "brands" && req.requestedLevel !== "brand") {
        return false;
      }
      if (filter?.population === "creators" && req.requestedLevel === "brand") {
        return false;
      }
      if (filter?.status && req.status !== filter.status) return false;
      if (filter?.network && req.network !== filter.network) return false;
      if (
        filter?.requestedLevel &&
        req.requestedLevel !== filter.requestedLevel
      )
        return false;
      return true;
    });

    // B-E6 : Tri par échéance croissante, HORS DÉLAI EN TÊTE
    filtered.sort((a, b) => {
      // 1. Les entrées hors délai en tête absolue
      if (a.slaBreached && !b.slaBreached) return -1;
      if (!a.slaBreached && b.slaBreached) return 1;
      // 2. Tri par date d'échéance SLA croissante
      return new Date(a.slaDueAt).getTime() - new Date(b.slaDueAt).getTime();
    });

    // B-E9 : Pagination côté serveur plafonnée
    const page = Math.max(1, Number(filter?.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(filter?.limit) || 20));
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const paginated = filtered.slice((page - 1) * limit, page * limit);

    return {
      items: paginated,
      queue: paginated,
      total,
      page,
      limit,
      totalPages,
      metrics: {
        totalPending,
        totalInReview,
        totalBreached,
        oldestPendingHours,
      },
    };
  }

  /**
   * Prise en charge d'une demande par un agent avec verrou 30 min (RG43, RG64)
   */
  public claimVerificationRequest(
    agentAccount: Account,
    requestId: string,
  ): VerificationRequest {
    if (agentAccount.role !== "agent" && agentAccount.role !== "admin") {
      throw new Error("Accès réservé aux agents et administrateurs");
    }

    const req = this.store.verificationRequests.get(requestId) as
      VerificationRequest | undefined;
    if (!req) {
      throw new Error("Demande de vérification introuvable");
    }

    // RG53 : Un agent ne traite jamais sa propre demande
    if (req.accountId === agentAccount.id) {
      throw new Error(
        "Un agent ne peut pas traiter sa propre demande de vérification (RG53)",
      );
    }

    const now = new Date();

    // RG64 : Contrôle du verrou anti-double-traitement
    if (
      req.status === "in_review" &&
      req.claimedByAgentId &&
      req.claimedByAgentId !== agentAccount.id &&
      req.claimExpiresAt &&
      new Date(req.claimExpiresAt) > now
    ) {
      throw new Error(
        "Cette demande est déjà en cours de traitement par un autre agent",
      );
    }

    const claimExpiresAt = new Date(
      now.getTime() + 30 * 60 * 1000,
    ).toISOString(); // 30 minutes

    req.status = "in_review";
    req.claimedByAgentId = agentAccount.id;
    req.claimedAt = now.toISOString();
    req.claimExpiresAt = claimExpiresAt;
    req.updatedAt = now.toISOString();

    this.store.verificationRequests.set(requestId, req as any);

    this.store.recordAuditEvent(
      "verification.request_claimed",
      {
        requestId,
        agentId: agentAccount.id,
        claimExpiresAt,
      },
      agentAccount.id,
    );

    return req;
  }

  /**
   * Décision de l'agent sur la demande (RG47, RG49, RG50, RG51, RG56)
   */
  public decideVerificationRequest(
    agentAccount: Account,
    requestId: string,
    input: DecideVerificationRequestInput,
  ): { request: VerificationRequest; badge?: Badge } {
    if (agentAccount.role !== "agent" && agentAccount.role !== "admin") {
      throw new Error("Accès réservé aux agents et administrateurs");
    }

    const validated = DecideVerificationRequestSchema.parse(input);

    const req = this.store.verificationRequests.get(requestId) as
      VerificationRequest | undefined;
    if (!req) {
      throw new Error("Demande de vérification introuvable");
    }

    // RG53 : Interdiction d'auto-traitement
    if (req.accountId === agentAccount.id) {
      throw new Error("Auto-traitement interdit (RG53)");
    }

    const now = new Date();
    const decidedAt = now.toISOString();

    // 1. Réexamen (RG50) : Matériellement impossible du fait d'INFLUX ou du réseau
    if (validated.decision === "reexamine") {
      req.status = "pending";
      req.claimedByAgentId = null;
      req.claimedAt = null;
      req.claimExpiresAt = null;
      req.agentComment = validated.reexamineReason || "À réexaminer";
      req.updatedAt = decidedAt;

      this.store.verificationRequests.set(requestId, req as any);

      this.store.recordAuditEvent(
        "verification.request_reexamined",
        {
          requestId,
          agentId: agentAccount.id,
          reason: validated.reexamineReason,
        },
        agentAccount.id,
      );

      return { request: req };
    }

    // 2. Refus avec motif typé obligatoire (RG56, RG57)
    if (validated.decision === "reject") {
      const reasonCode = validated.rejectionReasonCode!;

      // RG54 : Créateur mineur -> arrêt immédiat et escalade admin
      if (reasonCode === "minor") {
        this.store.recordAuditEvent(
          "verification.minor_detected_alert",
          {
            requestId,
            accountId: req.accountId,
            agentId: agentAccount.id,
          },
          agentAccount.id,
        );
      }

      req.status = "rejected";
      req.decidedByAgentId = agentAccount.id;
      req.decidedAt = decidedAt;
      req.rejectionReasonCode = reasonCode;
      req.agentComment = validated.agentComment || null;
      req.updatedAt = decidedAt;

      this.store.verificationRequests.set(requestId, req as any);

      this.store.recordAuditEvent(
        "verification.request_rejected",
        {
          requestId,
          accountId: req.accountId,
          agentId: agentAccount.id,
          rejectionReasonCode: reasonCode,
        },
        agentAccount.id,
      );

      // Événement outbox pour notification créateur (RG52, RG94)
      this.store.outboxEvents.push({
        id: randomUUID(),
        eventType: "verification.decision_rejected",
        payload: {
          requestId,
          accountId: req.accountId,
          network: req.network,
          rejectionReasonCode: reasonCode,
          comment: validated.agentComment,
        },
        status: "pending",
        attempts: 0,
        createdAt: decidedAt,
      });

      return { request: req };
    }

    // 3. Approbation (RG45, RG47, RG69)
    req.status = "approved";
    req.decidedByAgentId = agentAccount.id;
    req.decidedAt = decidedAt;
    req.updatedAt = decidedAt;

    let createdBadge: Badge;

    if (req.requestedLevel === "brand") {
      const brandProfile = (this.store.brandProfiles.get(req.accountId) ||
        Array.from(this.store.brandProfiles.values()).find(
          (bp: any) => bp.accountId === req.accountId,
        )) as any;

      if (brandProfile) {
        brandProfile.badgeStatus = "verified";
        brandProfile.badgeVerifiedAt = decidedAt;
        brandProfile.updatedAt = decidedAt;
        this.store.brandProfiles.set(
          brandProfile.accountId || req.accountId,
          brandProfile,
        );
      }

      createdBadge = {
        id: randomUUID(),
        accountId: req.accountId,
        socialAccountId: null,
        network: req.network,
        level: "brand_verified",
        grantedByAgentId: agentAccount.id,
        grantedAt: decidedAt,
        evidenceSource:
          req.network === "domain_dns" ? "domain_control" : "registry",
        expiresAt: null,
        state: "active",
        createdAt: decidedAt,
        updatedAt: decidedAt,
      };
    } else {
      const profile = this.store.creatorProfiles.get(req.accountId) as
        CreatorProfile | undefined;
      if (!profile) {
        throw new Error("Profil créateur introuvable pour validation");
      }

      if (req.requestedLevel === "account_ownership") {
        // RG45 : Constat de propriété du compte
        if (!validated.observedHandle) {
          throw new Error(
            "L'identifiant du compte observé en ligne est obligatoire pour valider la propriété (RG45)",
          );
        }

        // Clôture du code de propriété associé
        if (req.ownershipCodeId) {
          const codeRec = this.store.ownershipCodes.get(req.ownershipCodeId);
          if (codeRec) {
            this.store.ownershipCodes.set(req.ownershipCodeId, {
              ...codeRec,
              observedByAgentId: agentAccount.id,
              observedAt: decidedAt,
              observedHandle: validated.observedHandle,
              observedPlatformAccountRef:
                validated.observedPlatformAccountRef || null,
            });
          }
        }

        createdBadge = {
          id: randomUUID(),
          accountId: req.accountId,
          socialAccountId: req.network,
          network: req.network,
          level: "account_verified",
          grantedByAgentId: agentAccount.id,
          grantedAt: decidedAt,
          evidenceSource: "native_dashboard",
          expiresAt: null, // RG30 : Pas de péremption calendrier
          state: "active",
          observedHandleAtDecision: validated.observedHandle,
          observedPlatformAccountRef:
            validated.observedPlatformAccountRef || null,
          createdAt: decidedAt,
          updatedAt: decidedAt,
        };

        // Mise à jour du profil créateur
        const updatedNetworks = (profile.networks || []).map((net) => {
          if (net.network === req.network) {
            return {
              ...net,
              hasVerifiedAccountBadge: true,
              accountBadgeVerifiedAt: decidedAt,
              handle: validated.observedHandle || net.handle,
            } as CreatorNetworkInternal;
          }
          return net;
        });

        profile.networks = updatedNetworks;
        profile.updatedAt = decidedAt;
        this.store.creatorProfiles.set(req.accountId, profile as any);
      } else {
        // Audience vérifiée (RG31, RG38, RG47, RG69)
        if (validated.observedFollowers === undefined) {
          throw new Error(
            "Le nombre d'abonnés constaté est obligatoire pour accorder le badge Audience (RG38)",
          );
        }
        if (!validated.observedPeriodStart || !validated.observedPeriodEnd) {
          throw new Error(
            "La période couverte par la capture (début et fin) est obligatoire (RG37)",
          );
        }

        // RG31 / RG36 : Vérification de la fraîcheur (période close il y a <= 30 jours)
        const periodEndDate = new Date(validated.observedPeriodEnd);
        const thirtyDaysAgo = new Date(
          now.getTime() - 30 * 24 * 60 * 60 * 1000,
        );
        if (periodEndDate < thirtyDaysAgo) {
          throw new Error(
            "La période de capture se termine il y a plus de 30 jours (RG31, RG36)",
          );
        }

        // RG69 : Péremption stricte à 90 jours
        const expiresAt = new Date(
          now.getTime() + 90 * 24 * 60 * 60 * 1000,
        ).toISOString();

        const existingNetwork = (profile.networks || []).find(
          (n) => n.network === req.network,
        );
        const declaredFollowers = existingNetwork?.followersCount;

        // RG41, RG42 : Détection d'écart > 30% entre déclaré et constaté
        if (declaredFollowers !== undefined && declaredFollowers > 0) {
          const diff = Math.abs(
            declaredFollowers - validated.observedFollowers,
          );
          const gapRatio = diff / declaredFollowers;
          if (gapRatio > 0.3) {
            this.store.recordAuditEvent(
              "verification.gap_alert",
              {
                requestId,
                accountId: req.accountId,
                declaredFollowers,
                observedFollowers: validated.observedFollowers,
                gapPercentage: Math.round(gapRatio * 100),
              },
              agentAccount.id,
            );
          }
        }

        // RG20 : Calcul par le système de la tranche d'audience
        const newAudienceBand = calculateAudienceBand(
          validated.observedFollowers,
        );

        // Calcul de la tranche d'engagement si constatée (RG15)
        const newEngagementBand =
          validated.observedEngagement !== undefined
            ? calculateEngagementBand(validated.observedEngagement)
            : existingNetwork?.engagementRateBand;

        createdBadge = {
          id: randomUUID(),
          accountId: req.accountId,
          socialAccountId: req.network,
          network: req.network,
          level: "audience_verified",
          grantedByAgentId: agentAccount.id,
          grantedAt: decidedAt,
          evidenceSource: "native_dashboard",
          observedFollowers: validated.observedFollowers,
          observedEngagement: validated.observedEngagement,
          observedPeriodStart: validated.observedPeriodStart,
          observedPeriodEnd: validated.observedPeriodEnd,
          declaredFollowersAtDecision: declaredFollowers,
          expiresAt,
          state: "active",
          observedHandleAtDecision: existingNetwork?.handle,
          createdAt: decidedAt,
          updatedAt: decidedAt,
        };

        // Mise à jour du profil créateur
        const updatedNetworks = (profile.networks || []).map((net) => {
          if (net.network === req.network) {
            return {
              ...net,
              hasVerifiedAudienceBadge: true,
              audienceBadgeVerifiedAt: decidedAt,
              figuresSource: "agent_observed",
              figuresUpdatedAt: decidedAt,
              audienceBand: newAudienceBand,
              followersCount: validated.observedFollowers!,
              engagementRateBand: newEngagementBand,
            } as CreatorNetworkInternal;
          }
          return net;
        });

        profile.networks = updatedNetworks;
        profile.updatedAt = decidedAt;
        this.store.creatorProfiles.set(req.accountId, profile as any);
      }
    }

    this.store.badges.set(createdBadge.id, createdBadge as any);
    this.store.verificationRequests.set(requestId, req as any);

    // Journalisation d'audit nominative (RG51)
    this.store.recordAuditEvent(
      "verification.badge_granted",
      {
        requestId,
        badgeId: createdBadge.id,
        accountId: req.accountId,
        level: createdBadge.level,
        agentId: agentAccount.id,
        expiresAt: createdBadge.expiresAt,
      },
      agentAccount.id,
    );

    // Événement outbox pour notification créateur (RG94)
    this.store.outboxEvents.push({
      id: randomUUID(),
      eventType: "verification.badge_granted",
      payload: {
        badgeId: createdBadge.id,
        accountId: req.accountId,
        network: req.network,
        level: createdBadge.level,
        grantedAt: decidedAt,
        expiresAt: createdBadge.expiresAt,
      },
      status: "pending",
      attempts: 0,
      createdAt: decidedAt,
    });

    return { request: req, badge: createdBadge };
  }

  /**
   * Retrait immédiat d'un badge avec motif typé fermé (RG73, RG75, RG76)
   */
  public revokeBadge(
    agentAccount: Account,
    badgeId: string,
    input: RevokeBadgeInput,
  ): Badge {
    if (agentAccount.role !== "agent" && agentAccount.role !== "admin") {
      throw new Error("Accès réservé aux agents et administrateurs");
    }

    const validated = RevokeBadgeSchema.parse(input);

    const badge = this.store.badges.get(badgeId) as Badge | undefined;
    if (!badge) {
      throw new Error("Badge introuvable");
    }

    const now = new Date().toISOString();
    badge.state = "revoked";
    badge.revokedAt = now;
    badge.revocationReasonCode = validated.revocationReasonCode;
    badge.revocationComment = validated.comment || null;
    badge.updatedAt = now;

    this.store.badges.set(badgeId, badge as any);

    // Mise à jour immédiate du profil créateur (RG76 : disparition immédiate)
    const profile = this.store.creatorProfiles.get(badge.accountId) as
      CreatorProfile | undefined;
    if (profile) {
      profile.networks = (profile.networks || []).map((net) => {
        if (net.network === badge.network) {
          if (badge.level === "account_verified") {
            return {
              ...net,
              hasVerifiedAccountBadge: false,
              accountBadgeVerifiedAt: null,
            } as CreatorNetworkInternal;
          }
          if (badge.level === "audience_verified") {
            return {
              ...net,
              hasVerifiedAudienceBadge: false,
              audienceBadgeVerifiedAt: null,
              figuresSource: "declared",
            } as CreatorNetworkInternal;
          }
        }
        return net;
      });
      profile.updatedAt = now;
      this.store.creatorProfiles.set(badge.accountId, profile as any);
    }

    if (badge.level === "brand_verified") {
      const brandProfile = (this.store.brandProfiles.get(badge.accountId) ||
        Array.from(this.store.brandProfiles.values()).find(
          (bp: any) => bp.accountId === badge.accountId,
        )) as any;
      if (brandProfile) {
        brandProfile.badgeStatus = "none";
        brandProfile.badgeVerifiedAt = null;
        brandProfile.updatedAt = now;
        this.store.brandProfiles.set(
          brandProfile.accountId || badge.accountId,
          brandProfile,
        );
      }
    }

    // Journalisation d'audit
    this.store.recordAuditEvent(
      "verification.badge_revoked",
      {
        badgeId,
        accountId: badge.accountId,
        agentId: agentAccount.id,
        revocationReasonCode: validated.revocationReasonCode,
        comment: validated.comment,
      },
      agentAccount.id,
    );

    // Événement outbox
    this.store.outboxEvents.push({
      id: randomUUID(),
      eventType: "verification.badge_revoked",
      payload: {
        badgeId,
        accountId: badge.accountId,
        network: badge.network,
        revocationReasonCode: validated.revocationReasonCode,
      },
      status: "pending",
      attempts: 0,
      createdAt: now,
    });

    return badge;
  }

  /**
   * Cycle de vie dynamique : actualise les badges expirés ou à rafraîchir (RG70)
   */
  public refreshBadgeLifecycle(nowIso: string = new Date().toISOString()): {
    toRefreshCount: number;
    expiredCount: number;
  } {
    let toRefreshCount = 0;
    let expiredCount = 0;

    for (const [id, badgeRec] of this.store.badges.entries()) {
      const badge = badgeRec as unknown as Badge;
      if (badge.state === "revoked" || badge.state === "to_reconfirm") {
        continue;
      }

      const calculatedState = calculateBadgeLifecycleState(badge, nowIso);
      if (calculatedState !== badge.state) {
        const previousState = badge.state;
        badge.state = calculatedState;
        badge.updatedAt = nowIso;
        this.store.badges.set(id, badge as any);

        if (calculatedState === "to_refresh") {
          toRefreshCount++;
          this.store.recordAuditEvent(
            "verification.badge_to_refresh",
            { badgeId: id, accountId: badge.accountId },
            null,
          );
        } else if (calculatedState === "expired") {
          expiredCount++;
          // Retrait du badge d'audience sur le profil créateur
          const profile = this.store.creatorProfiles.get(badge.accountId) as
            CreatorProfile | undefined;
          if (profile) {
            profile.networks = (profile.networks || []).map((net) => {
              if (net.network === badge.network) {
                return {
                  ...net,
                  hasVerifiedAudienceBadge: false,
                  figuresSource: "declared",
                } as CreatorNetworkInternal;
              }
              return net;
            });
            this.store.creatorProfiles.set(badge.accountId, profile as any);
          }

          this.store.recordAuditEvent(
            "verification.badge_expired",
            { badgeId: id, accountId: badge.accountId },
            null,
          );
        }
      }
    }

    return { toRefreshCount, expiredCount };
  }

  /**
   * Retourne tous les badges d'un compte avec état dynamique recalculé (RG70)
   */
  public getBadgesForAccount(
    accountId: string,
    nowIso: string = new Date().toISOString(),
  ): Badge[] {
    const list = Array.from(this.store.badges.values()) as unknown as Badge[];
    return list
      .filter((b) => b.accountId === accountId)
      .map((b) => ({
        ...b,
        state: calculateBadgeLifecycleState(b, nowIso),
      }));
  }

  /**
   * Retourne l'historique des demandes de vérification d'un créateur
   */
  public getCreatorRequests(creatorAccount: Account): VerificationRequest[] {
    const list = Array.from(
      this.store.verificationRequests.values(),
    ) as unknown as VerificationRequest[];
    return list
      .filter((r) => r.accountId === creatorAccount.id)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }
}
