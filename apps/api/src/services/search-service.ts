import { createHash, randomUUID } from "node:crypto";
import {
  type Account,
  type CreatorSearchRequest,
  type CreatorSearchResponse,
  type CreatorSearchFilters,
  type AnonymizedCreatorCard,
  type IdentifiedCreatorCard,
  type ExplanationReason,
  type VigilanceWarningCode,
  type RelationStatus,
  type Shortlist,
  type ShortlistItem,
  type TeamSelectionRequest,
  type AudienceBand,
  type SearchResultCountBand,
  CreatorSearchRequestSchema,
  ShortlistSchema,
  ShortlistItemSchema,
  TeamSelectionRequestSchema,
} from "@influx/contracts";
import { MockStore } from "../mocks/mock-store";

export class SearchService {
  private store: MockStore;

  constructor(store?: MockStore) {
    this.store = store ?? MockStore.getInstance();
  }

  /**
   * Moteur de recherche principal pour les créateurs (10 RG1 à RG89)
   */
  public async searchCreators(
    actorAccount: Account,
    rawRequest: CreatorSearchRequest,
  ): Promise<CreatorSearchResponse> {
    const request = CreatorSearchRequestSchema.parse(rawRequest);

    // 1. Contrôle d'accès et vue (RG1, RG4, RG71)
    if (actorAccount.role === "creator") {
      throw new Error(
        "FORBIDDEN_ROLE: Les créateurs ne peuvent pas rechercher d'autres créateurs.",
      );
    }

    const isAgentOrAdmin =
      actorAccount.role === "agent" || actorAccount.role === "admin";
    const viewMode = isAgentOrAdmin ? request.viewMode : "advertiser_anonymous";

    // RG1 : Un compte marque doit avoir un profil publié pour chercher
    if (actorAccount.role === "advertiser") {
      const brandProfile = this.store.brandProfiles.get(actorAccount.id);
      if (
        !brandProfile ||
        (brandProfile.status && brandProfile.status !== "publie")
      ) {
        throw new Error(
          "BRAND_PROFILE_NOT_PUBLISHED: Votre profil marque doit être validé et publié pour accéder à la recherche.",
        );
      }

      // RG2, RG3, CA59 : Si la recherche est fermée aux marques, aucune liste n'est affichée
      if (!this.store.searchSettings.isOpenToAdvertisers) {
        const queryId = randomUUID();
        this.recordSearchQuery({
          queryId,
          actorAccount,
          viewMode,
          request,
          resultCount: 0,
          isBlockedByKAnonymity: true,
        });
        return {
          isBlockedByKAnonymity: true,
          countBand: "zero",
          broadeningSuggestions: [],
          items: [],
          page: 1,
          limit: request.limit,
          totalPages: 0,
          searchQueryId: queryId,
          activeSort: request.sort,
          isOpenToAdvertisers: false,
        };
      }

      // RG63, RG64, CA44 : Limitation de débit pour les marques (30 req/h, 200 req/j)
      this.checkRateLimits(actorAccount.id);
    }

    // RG63, CA41, CA42 : Garde-fous de pagination (max 12/page, max 5 pages = 60 profils max)
    const limit = Math.min(12, Math.max(1, request.limit));
    const page = request.page;
    if (page > 5) {
      throw new Error(
        "PAGINATION_LIMIT_EXCEEDED: La pagination est limitée à 5 pages maximum (60 résultats).",
      );
    }

    // 2. Récupération et filtrage des candidats
    const allCreators = Array.from(this.store.creatorProfiles.values());
    const eligibleCreators: Record<string, unknown>[] = [];

    // Récupérer le secteur de la marque si applicable (pour exclusion E6)
    let advertiserSector: string | undefined;
    if (actorAccount.role === "advertiser") {
      const bp = this.store.brandProfiles.get(actorAccount.id);
      if (bp && typeof bp.sector === "string") {
        advertiserSector = bp.sector.toLowerCase();
      }
    }

    for (const creator of allCreators) {
      const creatorAccountId = (creator.accountId || creator.id) as string;
      const creatorAccount = this.store.accounts.get(creatorAccountId);

      // --- A. Exclusions E1 à E6 (RG26, RG27) ---
      if (viewMode === "advertiser_anonymous") {
        // E1: Profil créateur publié (RG27)
        const profileStatus =
          creator.profileStatus || creator.status || "publie";
        if (profileStatus !== "publie") continue;

        // E2: Visible dans la recherche (RG27)
        if (
          creator.searchVisibility === false ||
          creator.isSearchable === false
        )
          continue;

        // E3: Compte non suspendu (RG27)
        if (creatorAccount && creatorAccount.status === "suspended") continue;

        // E4: Majeur (RG27, D15)
        if (creator.isMajor === false) continue;

        // E5: Blocage symétrique entre parties (RG27, RG28, CA20)
        if (this.isUserBlocked(actorAccount.id, creatorAccountId)) continue;

        // E6: Secteur refusé par le créateur (RG27, RG31, CA21)
        if (advertiserSector && Array.isArray(creator.refusedSectors)) {
          const isRefused = creator.refusedSectors.some(
            (sec: string) => sec.toLowerCase() === advertiserSector,
          );
          if (isRefused) continue;
        }
      }

      // --- B. Facettes de filtrage (RG12, RG13, RG16, RG17) ---
      if (!this.matchesFilters(creator, request.filters)) {
        continue;
      }

      eligibleCreators.push(creator);
    }

    const filteredCount = eligibleCreators.length;

    // 3. Application du k-anonymat (RG57, RG58, RG59, RG62)
    const kThreshold = this.store.searchSettings.kAnonymityThreshold;
    const isBlockedByKAnonymity =
      viewMode === "advertiser_anonymous" && filteredCount < kThreshold;

    let countBand: SearchResultCountBand;
    if (filteredCount === 0) {
      countBand = "zero";
    } else if (filteredCount < kThreshold) {
      countBand = "under_k";
    } else if (filteredCount < 10) {
      countBand = "5_9";
    } else if (filteredCount < 25) {
      countBand = "10_24";
    } else if (filteredCount < 50) {
      countBand = "25_49";
    } else {
      countBand = "50_plus";
    }

    const broadeningSuggestions = isBlockedByKAnonymity
      ? this.generateBroadeningSuggestions(request.filters)
      : [];

    const searchQueryId = randomUUID();

    // Journalisation de la requête (RG66, RG87, CA47)
    this.recordSearchQuery({
      queryId: searchQueryId,
      actorAccount,
      viewMode,
      request,
      resultCount: filteredCount,
      isBlockedByKAnonymity,
    });

    // Si bloqué par k-anonymat : aucun profil renvoyé (RG57, RG58)
    if (isBlockedByKAnonymity) {
      return {
        isBlockedByKAnonymity: true,
        countBand,
        broadeningSuggestions,
        items: [],
        page,
        limit,
        totalPages: 0,
        searchQueryId,
        activeSort: request.sort,
        isOpenToAdvertisers: true,
      };
    }

    // 4. Tri déterministe (RG35, RG43) et Quota Cas Froid (RG45)
    const sortedCreators = this.sortCreators(
      eligibleCreators,
      request,
      request.sort,
    );

    // Pagination (max 5 pages de 12 = max 60)
    const totalPages = Math.min(5, Math.ceil(sortedCreators.length / limit));
    const startIndex = (page - 1) * limit;
    const pagedSlice = sortedCreators.slice(startIndex, startIndex + limit);

    // 5. Projection des cartes (anonyme vs identifiée) et impressions (RG47, RG48, RG66, RG71)
    const items: (AnonymizedCreatorCard | IdentifiedCreatorCard)[] = [];
    const impressionsToRecord: Record<string, unknown>[] = [];

    for (let i = 0; i < pagedSlice.length; i++) {
      const creator = pagedSlice[i];
      if (!creator) continue;
      const rank = startIndex + i + 1;
      const creatorAccountId = (creator.accountId || creator.id) as string;

      const card = this.buildCreatorCard(
        creator,
        request.filters,
        viewMode,
        actorAccount.id,
      );

      items.push(card);

      impressionsToRecord.push({
        searchQueryId,
        creatorAccountId,
        rank,
        wasOpened: false,
        openedAt: null,
      });
    }

    // Sauvegarde des impressions en mémoire (RG66, CA48)
    const existingImpressions =
      this.store.searchImpressions.get(searchQueryId) || [];
    this.store.searchImpressions.set(searchQueryId, [
      ...existingImpressions,
      ...impressionsToRecord,
    ]);

    const response: CreatorSearchResponse = {
      isBlockedByKAnonymity: false,
      countBand,
      broadeningSuggestions: [],
      items,
      page,
      limit,
      totalPages,
      searchQueryId,
      activeSort: request.sort,
      isOpenToAdvertisers: true,
    };

    if (viewMode === "agent_identified") {
      response.exactTotal = filteredCount;
    }

    return response;
  }

  /**
   * Vérifie les filtres d'une recherche sur un profil créateur
   */
  private matchesFilters(
    creator: Record<string, unknown>,
    filters: CreatorSearchFilters,
  ): boolean {
    // F1 : Thématique principale
    if (filters.primaryTopic) {
      const primary =
        (creator.primaryTopic as string) ||
        (Array.isArray(creator.topics) ? creator.topics[0] : null);
      if (
        primary &&
        primary.toLowerCase() !== filters.primaryTopic.toLowerCase()
      ) {
        return false;
      }
    }

    // F2 : Thématiques secondaires (au moins une en commun, RG17 OU)
    if (filters.secondaryTopics && filters.secondaryTopics.length > 0) {
      const cTopics: string[] = Array.isArray(creator.secondaryTopics)
        ? creator.secondaryTopics
        : Array.isArray(creator.topics)
          ? creator.topics.slice(1)
          : [];
      const hasOverlap = filters.secondaryTopics.some((t) =>
        cTopics.some((ct) => ct.toLowerCase() === t.toLowerCase()),
      );
      if (!hasOverlap) return false;
    }

    // F3 & F4 : Réseaux et Tranche d'audience (RG17 : appliqués à la même ligne réseau !)
    const cNetworks = this.extractCreatorNetworks(creator);
    if (filters.networks && filters.networks.length > 0) {
      if (filters.audienceBand) {
        // Même ligne réseau doit satisfaire le réseau ET la tranche d'audience
        const hasMatchingNetworkRow = cNetworks.some(
          (net) =>
            filters.networks!.some(
              (n) => n.toLowerCase() === net.network.toLowerCase(),
            ) && net.audienceBand === filters.audienceBand,
        );
        if (!hasMatchingNetworkRow) return false;
      } else {
        const hasNetwork = cNetworks.some((net) =>
          filters.networks!.some(
            (n) => n.toLowerCase() === net.network.toLowerCase(),
          ),
        );
        if (!hasNetwork) return false;
      }
    } else if (filters.audienceBand) {
      const hasAudience = cNetworks.some(
        (net) => net.audienceBand === filters.audienceBand,
      );
      if (!hasAudience) return false;
    }

    // F5 : Engagement Band (RG20, CA13 : vérifié uniquement !)
    if (filters.engagementBand) {
      const hasVerifiedEngagement = cNetworks.some(
        (net) =>
          net.hasVerifiedAudienceBadge &&
          net.engagementRateBand === filters.engagementBand,
      );
      if (!hasVerifiedEngagement) return false;
    }

    // F6 : Main Audience Country & Share (RG17)
    const audience = (creator.audience as Record<string, unknown>) || {};
    const primaryCountry =
      (audience.primaryCountry as string) ||
      (creator.primaryCountry as string) ||
      "FR";
    const primaryShareBand =
      (audience.primaryCountryShareBand as string) || "gte_80";

    if (filters.audienceCountry) {
      if (
        primaryCountry.toUpperCase() !== filters.audienceCountry.toUpperCase()
      ) {
        return false;
      }
    }
    if (filters.audienceCountryShareBand) {
      if (primaryShareBand !== filters.audienceCountryShareBand) {
        return false;
      }
    }

    // F8 : Langues
    if (filters.languages && filters.languages.length > 0) {
      const cLangs: string[] = Array.isArray(creator.languages)
        ? creator.languages
        : ["fr"];
      const hasLang = filters.languages.some((lang) =>
        cLangs.some((cl) => cl.toLowerCase() === lang.toLowerCase()),
      );
      if (!hasLang) return false;
    }

    // F11 & F12 : Formats et Fourchette tarifaire (RG17, RG18, RG19 : sur la même ligne offre !)
    const cOffers = this.extractCreatorOffers(creator);
    if (filters.formats && filters.formats.length > 0) {
      if (filters.priceBand) {
        const hasMatchingOffer = cOffers.some((off) => {
          const formatMatch = filters.formats!.some(
            (f) => f.toLowerCase() === off.format.toLowerCase(),
          );
          if (!formatMatch) return false;

          if (off.currency === filters.currency) {
            return off.priceBand === filters.priceBand;
          } else {
            return filters.includeOtherCurrencies; // RG18
          }
        });
        if (!hasMatchingOffer) return false;
      } else {
        const hasFormat = cOffers.some((off) =>
          filters.formats!.some(
            (f) => f.toLowerCase() === off.format.toLowerCase(),
          ),
        );
        if (!hasFormat) return false;
      }
    } else if (filters.priceBand) {
      const hasPrice = cOffers.some((off) => {
        if (off.currency === filters.currency) {
          return off.priceBand === filters.priceBand;
        } else {
          return filters.includeOtherCurrencies;
        }
      });
      if (!hasPrice) return false;
    }

    // F17 : Badges vérifiés (palier 3)
    if (filters.badges && filters.badges.length > 0) {
      if (filters.badges.includes("account_verified")) {
        const hasAccountBadge = cNetworks.some(
          (n) => n.hasVerifiedAccountBadge,
        );
        if (!hasAccountBadge) return false;
      }
      if (filters.badges.includes("audience_verified")) {
        const hasAudienceBadge = cNetworks.some(
          (n) => n.hasVerifiedAudienceBadge,
        );
        if (!hasAudienceBadge) return false;
      }
    }

    // Filtres Vague 2
    if (filters.audienceGender) {
      const g =
        (audience.audienceGender as string) ||
        (creator.audienceGender as string);
      if (g !== filters.audienceGender) return false;
    }

    if (filters.availability) {
      const av = (creator.availability as string) || "lt_2w";
      if (av !== filters.availability) return false;
    }

    if (filters.acceptsNonMonetaryCounterpart !== undefined) {
      if (
        Boolean(creator.acceptsNonMonetaryCounterpart) !==
        filters.acceptsNonMonetaryCounterpart
      ) {
        return false;
      }
    }

    if (filters.travelScope) {
      const ts = (creator.travelScope as string) || "none";
      if (ts !== filters.travelScope) return false;
    }

    if (filters.collaborationExperienceBand) {
      const ce = (creator.collaborationExperienceBand as string) || "none";
      if (ce !== filters.collaborationExperienceBand) return false;
    }

    if (filters.deliveryLeadBand) {
      const hasLead = cOffers.some(
        (off) => off.deliveryLeadBand === filters.deliveryLeadBand,
      );
      if (!hasLead) return false;
    }

    if (filters.editorialTones && filters.editorialTones.length > 0) {
      const cTones: string[] = Array.isArray(creator.editorialTones)
        ? creator.editorialTones
        : [];
      const hasTone = filters.editorialTones.some((t) => cTones.includes(t));
      if (!hasTone) return false;
    }

    return true;
  }

  /**
   * Tri déterministe à 8 paliers et prise en compte du cas froid (RG35, RG43, RG45)
   */
  private sortCreators(
    creators: Record<string, unknown>[],
    request: CreatorSearchRequest,
    sortCode: string,
  ): Record<string, unknown>[] {
    const todayUtc = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const campaignId = request.filters.campaignId;

    // Calcul des scores par palier pour chaque créateur
    const itemsWithScores = creators.map((creator) => {
      const creatorAccountId = (creator.accountId || creator.id) as string;
      const cNetworks = this.extractCreatorNetworks(creator);
      const cOffers = this.extractCreatorOffers(creator);

      // Palier 1 : Critères secondaires satisfaits
      let tier1Score = 0;
      if (
        request.filters.secondaryTopics &&
        Array.isArray(creator.secondaryTopics)
      ) {
        const overlap = request.filters.secondaryTopics.filter((t) =>
          (creator.secondaryTopics as string[]).includes(t),
        ).length;
        tier1Score += overlap * 10;
      }
      if (request.filters.formats) {
        const formatOverlap = cOffers.filter((o) =>
          request.filters.formats!.includes(o.format),
        ).length;
        tier1Score += formatOverlap * 5;
      }

      // Palier 2 : Adéquation à la campagne (RG37 : neutre si pas de campagne)
      let tier2Score = 0;
      if (campaignId) {
        const campaign = this.store.campaigns.get(campaignId);
        if (campaign) {
          if (campaign.primaryTopic === creator.primaryTopic) tier2Score += 20;
        }
      }

      // Palier 3 : Badges (Audience vérifiée > Compte vérifié > Aucun)
      let tier3Score = 0;
      const hasAudienceBadge = cNetworks.some(
        (n) => n.hasVerifiedAudienceBadge,
      );
      const hasAccountBadge = cNetworks.some((n) => n.hasVerifiedAccountBadge);
      if (hasAudienceBadge) tier3Score = 2;
      else if (hasAccountBadge) tier3Score = 1;

      // Palier 4 : Fraîcheur des chiffres (< 90j avant périmés, RG39)
      const figuresDate = creator.figuresUpdatedAt
        ? new Date(creator.figuresUpdatedAt as string).getTime()
        : 0;
      const isFresh = Date.now() - figuresDate < 90 * 24 * 60 * 60 * 1000;
      const tier4Score = isFresh ? 1 : 0;

      // Palier 5 : Complétude du profil par quartiles (0-24, 25-49, 50-74, 75-100, RG40)
      const completeness =
        typeof creator.completenessPercent === "number"
          ? creator.completenessPercent
          : 75;
      let tier5Score = 0;
      if (completeness >= 75) tier5Score = 3;
      else if (completeness >= 50) tier5Score = 2;
      else if (completeness >= 25) tier5Score = 1;

      // Palier 6 : Disponibilité déclarée (< 2w > < 1m > full)
      const avail = (creator.availability as string) || "lt_2w";
      let tier6Score = 0;
      if (avail === "lt_2w") tier6Score = 2;
      else if (avail === "lt_1m") tier6Score = 1;

      // Palier 7 : Réactivité habituelle (inactif au Lot 3, neutre pour tous, RG38)
      const tier7Score = 0;

      // Palier 8 : Rotation déterministe quotidienne (RG35, RG36)
      const rotationHash = createHash("sha256")
        .update(`${todayUtc}:${creatorAccountId}`)
        .digest("hex");

      // Cas froid (RG45) : publié < 30j ou drapeau isRecent
      const publishedAt = creator.publishedAt
        ? new Date(creator.publishedAt as string).getTime()
        : 0;
      const isPublishedRecent =
        publishedAt > 0 && Date.now() - publishedAt < 30 * 24 * 60 * 60 * 1000;
      const isRecent = Boolean(creator.isRecent || isPublishedRecent);

      // Meilleure tranche d'audience pour tri alternatif
      const highestAudienceValue = Math.max(
        ...cNetworks.map((n) => this.audienceBandToNumeric(n.audienceBand)),
        0,
      );

      // Tarif minimal pour tri alternatif
      const lowestPriceValue = Math.min(
        ...cOffers.map((o) => this.priceBandToNumeric(o.priceBand)),
        999999,
      );

      return {
        creator,
        creatorAccountId,
        isRecent,
        highestAudienceValue,
        lowestPriceValue,
        tier1Score,
        tier2Score,
        tier3Score,
        tier4Score,
        tier5Score,
        tier6Score,
        tier7Score,
        rotationHash,
      };
    });

    // Tri selon le code sélectionné (RG43)
    if (sortCode === "audience_desc") {
      itemsWithScores.sort((a, b) => {
        if (b.highestAudienceValue !== a.highestAudienceValue) {
          return b.highestAudienceValue - a.highestAudienceValue;
        }
        return this.compareTiers3To8(a, b);
      });
    } else if (sortCode === "price_asc") {
      itemsWithScores.sort((a, b) => {
        if (a.lowestPriceValue !== b.lowestPriceValue) {
          return a.lowestPriceValue - b.lowestPriceValue;
        }
        return this.compareTiers3To8(a, b);
      });
    } else if (sortCode === "verified_first") {
      itemsWithScores.sort((a, b) => {
        if (b.tier3Score !== a.tier3Score) {
          return b.tier3Score - a.tier3Score;
        }
        return this.compareAllTiers(a, b);
      });
    } else if (sortCode === "new_profiles") {
      itemsWithScores.sort((a, b) => {
        if (a.isRecent !== b.isRecent) {
          return a.isRecent ? -1 : 1;
        }
        return this.compareAllTiers(a, b);
      });
    } else {
      // Tri par défaut (default) : Paliers 1 à 8 déterministes (RG35)
      itemsWithScores.sort((a, b) => this.compareAllTiers(a, b));
    }

    // Quota Cas Froid (RG45, CA29) : au moins 2 profils récents (< 30j) sur les 12 premiers si existants
    const sorted = itemsWithScores.map((i) => i.creator);
    const coldQuota = this.store.searchSettings.coldProfileQuota; // 2 par défaut

    if (sorted.length > 0 && coldQuota > 0) {
      const top12 = sorted.slice(0, 12);
      const top12RecentCount = top12.filter((c) => {
        const item = itemsWithScores.find((i) => i.creator === c);
        return item?.isRecent;
      }).length;

      const deficit = coldQuota - top12RecentCount;
      if (deficit > 0) {
        // Chercher des profils récents situés au-delà du rang 12
        const remaining = sorted.slice(12);
        const candidatesToPromote: Record<string, unknown>[] = [];
        for (const rem of remaining) {
          const item = itemsWithScores.find((i) => i.creator === rem);
          if (item?.isRecent && candidatesToPromote.length < deficit) {
            candidatesToPromote.push(rem);
          }
        }

        for (const cand of candidatesToPromote) {
          const oldIndex = sorted.indexOf(cand);
          if (oldIndex > 11) {
            sorted.splice(oldIndex, 1);
            // Insérer à la position 11 ou 12
            sorted.splice(Math.min(11, sorted.length), 0, cand);
          }
        }
      }
    }

    return sorted;
  }

  private compareAllTiers(
    a: {
      tier1Score: number;
      tier2Score: number;
      tier3Score: number;
      tier4Score: number;
      tier5Score: number;
      tier6Score: number;
      rotationHash: string;
    },
    b: {
      tier1Score: number;
      tier2Score: number;
      tier3Score: number;
      tier4Score: number;
      tier5Score: number;
      tier6Score: number;
      rotationHash: string;
    },
  ): number {
    if (b.tier1Score !== a.tier1Score) return b.tier1Score - a.tier1Score;
    if (b.tier2Score !== a.tier2Score) return b.tier2Score - a.tier2Score;
    if (b.tier3Score !== a.tier3Score) return b.tier3Score - a.tier3Score;
    if (b.tier4Score !== a.tier4Score) return b.tier4Score - a.tier4Score;
    if (b.tier5Score !== a.tier5Score) return b.tier5Score - a.tier5Score;
    if (b.tier6Score !== a.tier6Score) return b.tier6Score - a.tier6Score;
    return a.rotationHash.localeCompare(b.rotationHash);
  }

  private compareTiers3To8(
    a: {
      tier3Score: number;
      tier4Score: number;
      tier5Score: number;
      tier6Score: number;
      rotationHash: string;
    },
    b: {
      tier3Score: number;
      tier4Score: number;
      tier5Score: number;
      tier6Score: number;
      rotationHash: string;
    },
  ): number {
    if (b.tier3Score !== a.tier3Score) return b.tier3Score - a.tier3Score;
    if (b.tier4Score !== a.tier4Score) return b.tier4Score - a.tier4Score;
    if (b.tier5Score !== a.tier5Score) return b.tier5Score - a.tier5Score;
    if (b.tier6Score !== a.tier6Score) return b.tier6Score - a.tier6Score;
    return a.rotationHash.localeCompare(b.rotationHash);
  }

  private audienceBandToNumeric(band: AudienceBand): number {
    switch (band) {
      case "nano":
        return 1;
      case "micro":
        return 2;
      case "mid":
        return 3;
      case "macro":
        return 4;
      case "mega":
        return 5;
      default:
        return 0;
    }
  }

  private priceBandToNumeric(band: string): number {
    switch (band) {
      case "lt_250":
        return 1;
      case "250_500":
        return 2;
      case "500_1000":
        return 3;
      case "1000_2000":
        return 4;
      case "2000_5000":
        return 5;
      case "5000_10000":
        return 6;
      case "plus_10000":
        return 7;
      default:
        return 999;
    }
  }

  /**
   * Construction de la carte de profil (anonyme vs identifiée) (RG41, RG42, RG47, RG48, RG71)
   */
  private buildCreatorCard(
    creator: Record<string, unknown>,
    filters: CreatorSearchFilters,
    viewMode: "advertiser_anonymous" | "agent_identified",
    advertiserAccountId?: string,
  ): AnonymizedCreatorCard | IdentifiedCreatorCard {
    const creatorAccountId = (creator.accountId || creator.id) as string;
    const profileId = (creator.id || creatorAccountId) as string;
    const alias =
      (creator.alias as string) ||
      `Profil ${creatorAccountId.slice(0, 4).toUpperCase()}`;
    const primaryTopic =
      (creator.primaryTopic as string) ||
      (Array.isArray(creator.topics) ? creator.topics[0] : "Lifestyle");
    const country = (creator.country as string) || "FR";
    const contextLabel = `${primaryTopic.charAt(0).toUpperCase() + primaryTopic.slice(1)} · ${country}`;
    const shortTitle = (creator.shortTitle ||
      creator.anonymousTitle ||
      "Créateur de contenu vérifié") as string;

    const cNetworks = this.extractCreatorNetworks(creator);
    const cOffers = this.extractCreatorOffers(creator);

    // Date de fraîcheur
    const figuresUpdatedAt =
      (creator.figuresUpdatedAt as string) || new Date().toISOString();
    const isStale =
      Date.now() - new Date(figuresUpdatedAt).getTime() >=
      90 * 24 * 60 * 60 * 1000;

    // Profil récent < 30j
    const publishedAt =
      (creator.publishedAt as string) || new Date().toISOString();
    const isRecent = Boolean(
      creator.isRecent ||
      Date.now() - new Date(publishedAt).getTime() < 30 * 24 * 60 * 60 * 1000,
    );

    // Explications factuelles (2 à 4 raisons) (RG41, CA27, CA28)
    const reasons: ExplanationReason[] = [];

    // Raison 1: Thématique
    reasons.push({
      code: "topic_match",
      tier: 1,
      labelKey: "search.reason.topic_match",
      params: { topic: primaryTopic },
    });

    // Raison 2: Pays d'audience (sans aucun pourcentage exact ! RG41, CA4)
    const audience = (creator.audience as Record<string, unknown>) || {};
    const audCountry =
      (audience.primaryCountry as string) ||
      (creator.primaryCountry as string) ||
      "FR";
    const shareBand = (audience.primaryCountryShareBand as string) || "gte_80";
    const shareText =
      shareBand === "gte_80"
        ? "plus de 80 %"
        : shareBand === "50_80"
          ? "plus de 50 %"
          : "audience notable";
    reasons.push({
      code: "audience_country_match",
      tier: 1,
      labelKey: "search.reason.audience_country_match",
      params: { country: audCountry, shareBandText: shareText },
    });

    // Raison 3: Badge vérifié si présent, sinon budget/tarif
    const hasAudienceBadge = cNetworks.some((n) => n.hasVerifiedAudienceBadge);
    const hasAccountBadge = cNetworks.some((n) => n.hasVerifiedAccountBadge);
    if (hasAudienceBadge || hasAccountBadge) {
      reasons.push({
        code: "verified_badge",
        tier: 3,
        labelKey: "search.reason.verified_badge",
        params: {
          badgeType: hasAudienceBadge ? "Audience vérifiée" : "Compte vérifié",
        },
      });
    } else if (cOffers.length > 0 && cOffers[0]) {
      reasons.push({
        code: "price_fit",
        tier: 1,
        labelKey: "search.reason.price_fit",
        params: { priceBand: cOffers[0].priceBand },
      });
    }

    // Raison 4 (optionnelle si < 4) : Disponibilité ou format
    if (reasons.length < 4 && cOffers.length > 0 && cOffers[0]) {
      reasons.push({
        code: "format_match",
        tier: 1,
        labelKey: "search.reason.format_match",
        params: { format: cOffers[0].format },
      });
    }

    // Point de vigilance (RG42, CA23, CA30)
    let vigilanceWarning: VigilanceWarningCode | null = null;
    if (isStale) {
      vigilanceWarning = "stale_figures";
    } else if (isRecent) {
      vigilanceWarning = "recent_profile";
    } else if (cOffers.some((o) => o.currency !== filters.currency)) {
      vigilanceWarning = "other_currency";
    } else if (creator.availability === "full") {
      vigilanceWarning = "declared_full";
    }

    // État de relation avec la marque (RG32, RG53, CA22, CA54)
    let relationStatus: RelationStatus = "none";
    let relationIntroducedAt: string | null = null;
    let relationRequestPendingAt: string | null = null;

    if (advertiserAccountId) {
      // Vérifier les mises en relation existantes
      for (const intro of this.store.introductions.values()) {
        if (
          intro.advertiserAccountId === advertiserAccountId &&
          intro.creatorAccountId === creatorAccountId
        ) {
          if (intro.identityRevealedAt) {
            relationStatus = "already_introduced";
            relationIntroducedAt = intro.identityRevealedAt as string;
            break;
          } else if (
            ["pending_review", "in_review", "approved"].includes(
              intro.status as string,
            )
          ) {
            relationStatus = "request_pending";
            relationRequestPendingAt =
              (intro.createdAt as string) || new Date().toISOString();
            break;
          }
        }
      }

      // Vérifier si en shortlist
      if (relationStatus === "none") {
        for (const sList of this.store.shortlists.values()) {
          if (sList.advertiserAccountId === advertiserAccountId) {
            const items =
              this.store.shortlistItems.get(sList.id as string) || [];
            if (items.some((it) => it.creatorAccountId === creatorAccountId)) {
              relationStatus = "shortlisted";
              break;
            }
          }
        }
      }
    }

    // Audience formatée
    const audData = {
      primaryCountry: audCountry,
      primaryCountryShareBand:
        (audience.primaryCountryShareBand as any) || "gte_80",
      otherCountries: (Array.isArray(audience.otherCountries)
        ? audience.otherCountries
        : []
      ).map((oc: any) => ({
        country: oc.country || "BE",
        shareBand: oc.shareBand || "10_25",
      })),
    };

    // Portfolio modéré (RG47, RG69, CA50 : max 3 visuels modérés)
    const rawPortfolio = Array.isArray(creator.portfolio)
      ? creator.portfolio
      : [];
    const portfolio = rawPortfolio
      .filter((img: any) => img.isModerated !== false && !img.hasWatermark)
      .slice(0, 3)
      .map((img: any, idx: number) => ({
        id: img.id || `port-${idx + 1}`,
        imageUrl:
          img.imageUrl ||
          "https://images.unsplash.com/photo-1534528741775-53994a69daeb",
        caption: img.caption || null,
        brandNamed: img.brandNamed || null,
      }));

    // Base de la carte anonyme (STRICTEMENT ZÉRO DONNÉE IDENTIFIANTE RG48)
    const anonymizedCard: AnonymizedCreatorCard = {
      creatorAccountId,
      profileId,
      alias,
      contextLabel,
      shortTitle,
      primaryTopic,
      secondaryTopics: Array.isArray(creator.secondaryTopics)
        ? creator.secondaryTopics
        : Array.isArray(creator.topics)
          ? creator.topics.slice(1)
          : [],
      editorialTones: (creator.editorialTones as any) || [],
      country,
      region:
        (creator.regionPublishedCount as number) >= 5
          ? (creator.region as string)
          : null, // RG15
      travelScope: (creator.travelScope as any) || "none",
      collaborationExperienceBand:
        (creator.collaborationExperienceBand as any) || "none",
      networks: cNetworks.map((n) => ({
        network: n.network,
        isPrimary: n.isPrimary,
        audienceBand: n.audienceBand,
        engagementRateBand: n.hasVerifiedAudienceBadge
          ? n.engagementRateBand
          : null, // RG20
        averageReachBand: n.audienceBand,
        publicationFrequency: n.publicationFrequency || null,
        hasVerifiedAccountBadge: n.hasVerifiedAccountBadge,
        accountBadgeVerifiedAt: n.accountBadgeVerifiedAt || null,
        hasVerifiedAudienceBadge: n.hasVerifiedAudienceBadge,
        audienceBadgeVerifiedAt: n.audienceBadgeVerifiedAt || null,
      })),
      audience: audData,
      languages: (creator.languages as any) || ["fr"],
      audienceGender:
        (audience.audienceGender as any) ||
        (creator.audienceGender as any) ||
        null,
      audienceAgeBands: (audience.audienceAgeBands as any) || [],
      offers: cOffers.map((o) => ({
        network: o.network,
        format: o.format,
        priceBand: o.priceBand as any,
        currency: (o.currency as any) || "EUR",
        deliveryLeadBand: (o.deliveryLeadBand as any) || null,
        includedUsageRights: o.includedUsageRights || [],
        optionalUsageRights: o.optionalUsageRights || [],
        exclusivity: (o.exclusivity as any) || null,
      })),
      availability: (creator.availability as any) || "lt_2w",
      availabilityDeclaredAt:
        (creator.availabilityDeclaredAt as string) || new Date().toISOString(),
      acceptsNonMonetaryCounterpart: Boolean(
        creator.acceptsNonMonetaryCounterpart,
      ),
      portfolio,
      figuresUpdatedAt,
      publishedAt,
      isRecent,
      reasons,
      vigilanceWarning,
      relationStatus,
      relationIntroducedAt,
      relationRequestPendingAt,
    };

    if (viewMode === "agent_identified") {
      // Carte identifiée pour le commercial (RG71)
      const creatorAccount = this.store.accounts.get(creatorAccountId);
      const exactNetworks = cNetworks.map((n) => ({
        network: n.network,
        handle: n.handle || `@${n.network}_creator`,
        profileUrl: n.profileUrl || `https://${n.network}.com`,
        followersCount: n.followersCount ?? 25000,
        engagementRate: n.engagementRate ?? 3.5,
      }));

      const identifiedCard: IdentifiedCreatorCard = {
        ...anonymizedCard,
        legalFirstName: (creator.legalFirstName as string) || null,
        legalLastName: (creator.legalLastName as string) || null,
        pseudonym: (creator.pseudonym as string) || null,
        email: (creatorAccount?.email ||
          creator.email ||
          "creator@influx.io") as string,
        phone: (creator.phone as string) || null,
        city: (creator.city as string) || null,
        profileStatus: (creator.profileStatus ||
          creator.status ||
          "publie") as any,
        declaredStatus: (creatorAccount?.declaredStatus === "company"
          ? "professional"
          : "individual") as any,
        refusedSectors: (creator.refusedSectors as string[]) || [],
        internalNotes: (creator.internalNotes as string) || null,
        exactNetworks,
      };
      return identifiedCard;
    }

    return anonymizedCard;
  }

  /**
   * Helper pour extraire les réseaux normalisés d'un profil
   */
  private extractCreatorNetworks(creator: Record<string, unknown>): Array<{
    network: string;
    isPrimary: boolean;
    audienceBand: AudienceBand;
    engagementRateBand?: any;
    engagementRate?: number;
    followersCount?: number;
    handle?: string;
    profileUrl?: string;
    publicationFrequency?: string;
    hasVerifiedAccountBadge: boolean;
    hasVerifiedAudienceBadge: boolean;
    accountBadgeVerifiedAt?: string;
    audienceBadgeVerifiedAt?: string;
  }> {
    if (Array.isArray(creator.networks)) {
      return creator.networks.map((n: any, idx: number) => ({
        network: n.network || "instagram",
        isPrimary: n.isPrimary ?? idx === 0,
        audienceBand: n.audienceBand || "mid",
        engagementRateBand: n.engagementRateBand || "3_6",
        engagementRate: n.engagementRate,
        followersCount: n.followersCount,
        handle: n.handle,
        profileUrl: n.profileUrl,
        publicationFrequency: n.publicationFrequency,
        hasVerifiedAccountBadge: Boolean(
          n.hasVerifiedAccountBadge || n.hasVerifiedBadge,
        ),
        hasVerifiedAudienceBadge: Boolean(
          n.hasVerifiedAudienceBadge ||
          (creator.badge && (creator.badge as any).level >= 1),
        ),
        accountBadgeVerifiedAt: n.accountBadgeVerifiedAt,
        audienceBadgeVerifiedAt: n.audienceBadgeVerifiedAt,
      }));
    }

    // Réseaux par défaut si format graine simplifié
    return [
      {
        network: "instagram",
        isPrimary: true,
        audienceBand: (creator.audienceBand as any) || "mid",
        engagementRateBand: "3_6",
        hasVerifiedAccountBadge: false,
        hasVerifiedAudienceBadge: Boolean(creator.badge),
      },
    ];
  }

  /**
   * Helper pour extraire les offres tarifaires d'un créateur
   */
  private extractCreatorOffers(creator: Record<string, unknown>): Array<{
    network: string;
    format: string;
    priceBand: string;
    currency: string;
    deliveryLeadBand?: string;
    includedUsageRights?: string[];
    optionalUsageRights?: string[];
    exclusivity?: string;
  }> {
    if (Array.isArray(creator.offers)) {
      return creator.offers;
    }

    // Extraction depuis les formats graines simples
    const formats = Array.isArray(creator.formats)
      ? creator.formats
      : ["story", "post"];
    const priceBand = (creator.priceBand as string) || "500_1000";
    return formats.map((fmt: string) => ({
      network: "instagram",
      format: fmt,
      priceBand,
      currency: "EUR",
      deliveryLeadBand: "7_14d",
      includedUsageRights: ["digital_30d"],
      optionalUsageRights: [],
      exclusivity: "none",
    }));
  }

  /**
   * Suggestions statiques d'élargissement selon l'ordre de priorité écrit (RG60, CA37)
   */
  private generateBroadeningSuggestions(
    filters: CreatorSearchFilters,
  ): string[] {
    const suggestions: string[] = [];

    if (filters.priceBand) {
      suggestions.push("retirer le filtre de tarif");
    }
    if (filters.audienceBand) {
      suggestions.push("élargir la tranche d'audience");
    }
    if (filters.audienceCountry) {
      suggestions.push("ajouter un pays voisin");
    }
    if (filters.networks && filters.networks.length > 0) {
      suggestions.push("ajouter d'autres réseaux");
    }
    if (filters.formats && filters.formats.length > 0) {
      suggestions.push("sélectionner des formats complémentaires");
    }

    if (suggestions.length === 0) {
      suggestions.push("élargir les critères géographiques");
      suggestions.push("retirer un critère secondaire");
    }

    return suggestions.slice(0, 3);
  }

  /**
   * Contrôle de limitation de débit (RG63, CA44)
   */
  private checkRateLimits(accountId: string): void {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    let hourCount = 0;
    let dayCount = 0;

    for (const q of this.store.searchQueries.values()) {
      if (q.accountId === accountId) {
        const qTime = new Date(q.createdAt as string).getTime();
        if (qTime >= oneHourAgo) hourCount++;
        if (qTime >= oneDayAgo) dayCount++;
      }
    }

    // Alerte interne à 80% du plafond (RG63, RG68)
    if (hourCount >= 24 || dayCount >= 160) {
      this.store.recordAuditEvent("search.rate_limit_warning", {
        accountId,
        hourCount,
        dayCount,
      });
    }

    if (hourCount >= 30) {
      throw new Error(
        "RATE_LIMIT_EXCEEDED: Vous avez atteint la limite de 30 recherches par heure.",
      );
    }
    if (dayCount >= 200) {
      throw new Error(
        "RATE_LIMIT_EXCEEDED: Vous avez atteint la limite de recherches pour aujourd'hui, revenez demain ou demandez une sélection à l'équipe.",
      );
    }
  }

  /**
   * Vérifie le blocage symétrique entre parties (RG27 E5, RG28, CA20)
   */
  private isUserBlocked(userAId: string, userBId: string): boolean {
    for (const block of this.store.userBlocks.values()) {
      const blocker = block.blockerAccountId as string;
      const blocked = block.blockedAccountId as string;
      if (
        (blocker === userAId && blocked === userBId) ||
        (blocker === userBId && blocked === userAId)
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Journalisation d'une requête de recherche (RG66, RG87, CA47)
   */
  private recordSearchQuery(params: {
    queryId: string;
    actorAccount: Account;
    viewMode: string;
    request: CreatorSearchRequest;
    resultCount: number;
    isBlockedByKAnonymity: boolean;
  }): void {
    const record = {
      id: params.queryId,
      accountId: params.actorAccount.id,
      actorRole: params.actorAccount.role,
      viewMode: params.viewMode,
      campaignId: params.request.filters.campaignId || null,
      filters: params.request.filters,
      sortCode: params.request.sort,
      resultCount: params.resultCount,
      pageReached: params.request.page,
      blockedByKAnonymity: params.isBlockedByKAnonymity,
      createdAt: new Date().toISOString(),
    };

    this.store.searchQueries.set(params.queryId, record);
    this.store.recordAuditEvent(
      "search.query_executed",
      record,
      params.actorAccount.id,
    );
  }

  /**
   * Enregistre l'ouverture d'un profil depuis une carte de recherche (RG63, RG66, CA46, CA48)
   */
  public async recordProfileOpen(
    searchQueryId: string,
    creatorAccountId: string,
    actorAccountId: string,
  ): Promise<{ success: boolean }> {
    // Vérification du plafond de 60 profils ouverts par jour (RG63)
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    let openedToday = 0;

    for (const list of this.store.searchImpressions.values()) {
      for (const imp of list) {
        if (imp.wasOpened && imp.openedAt) {
          const t = new Date(imp.openedAt as string).getTime();
          if (t >= oneDayAgo) openedToday++;
        }
      }
    }

    if (openedToday >= 60) {
      throw new Error(
        "PROFILE_OPEN_LIMIT_EXCEEDED: Vous avez atteint le plafond de consultation de 60 profils par jour.",
      );
    }

    const impressions = this.store.searchImpressions.get(searchQueryId);
    if (impressions) {
      const imp = impressions.find(
        (i) => i.creatorAccountId === creatorAccountId,
      );
      if (imp) {
        imp.wasOpened = true;
        imp.openedAt = new Date().toISOString();
      }
    }

    this.store.recordAuditEvent(
      "search.profile_opened",
      { searchQueryId, creatorAccountId },
      actorAccountId,
    );

    return { success: true };
  }

  /**
   * Pont Campagne ↔ Recherche : pré-remplissage des facettes depuis le brief (RG73, RG75, CA56)
   */
  public async getCampaignBridgeFilters(
    campaignId: string,
  ): Promise<CreatorSearchFilters> {
    const campaign = this.store.campaigns.get(campaignId);
    if (!campaign) {
      throw new Error("CAMPAIGN_NOT_FOUND: Campagne introuvable.");
    }

    const filters: CreatorSearchFilters = {
      campaignId,
      primaryTopic:
        (campaign.primaryTopic as string) ||
        (campaign.productCategory as string) ||
        undefined,
      currency: (campaign.productCurrency as any) || "EUR",
      includeOtherCurrencies: false,
    };

    if (
      Array.isArray(campaign.deliverables) &&
      campaign.deliverables.length > 0
    ) {
      filters.networks = Array.from(
        new Set(campaign.deliverables.map((d: any) => d.network)),
      );
      filters.formats = Array.from(
        new Set(campaign.deliverables.map((d: any) => d.format)),
      );
    }

    if (campaign.targetAudienceCountry) {
      filters.audienceCountry = campaign.targetAudienceCountry as any;
    }

    if (campaign.productValueBand) {
      filters.priceBand = campaign.productValueBand as any;
    }

    return filters;
  }

  /**
   * Demande « Sélection par l'équipe INFLUX » (RG61, CA39)
   */
  public async createTeamSelectionRequest(
    advertiserAccountId: string,
    payload: {
      campaignId?: string | null;
      filters: CreatorSearchFilters;
      notes?: string;
      locale?: string;
    },
  ): Promise<TeamSelectionRequest> {
    const id = randomUUID();
    const record: TeamSelectionRequest = {
      id,
      advertiserAccountId,
      campaignId: payload.campaignId || null,
      filters: payload.filters,
      notes: payload.notes || "",
      locale: payload.locale || "fr",
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    this.store.teamSelectionRequests.set(id, record);
    this.store.recordAuditEvent(
      "search.team_selection_requested",
      record,
      advertiserAccountId,
    );

    return TeamSelectionRequestSchema.parse(record);
  }

  /**
   * Gestion des Shortlists privées de la marque (RG51, RG52, CA51, CA52)
   */
  public async getShortlists(
    advertiserAccountId: string,
  ): Promise<Shortlist[]> {
    const result: Shortlist[] = [];
    for (const s of this.store.shortlists.values()) {
      if (s.advertiserAccountId === advertiserAccountId) {
        const items = this.store.shortlistItems.get(s.id as string) || [];
        result.push(
          ShortlistSchema.parse({
            ...s,
            itemsCount: items.length,
          }),
        );
      }
    }
    return result;
  }

  public async createShortlist(
    advertiserAccountId: string,
    data: { name: string; campaignId?: string | null },
  ): Promise<Shortlist> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const record = {
      id,
      advertiserAccountId,
      name: data.name,
      campaignId: data.campaignId || null,
      itemsCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    this.store.shortlists.set(id, record);
    this.store.recordAuditEvent(
      "shortlist.created",
      record,
      advertiserAccountId,
    );

    return ShortlistSchema.parse(record);
  }

  public async getShortlistItems(
    shortlistId: string,
    advertiserAccountId: string,
  ): Promise<ShortlistItem[]> {
    const shortlist = this.store.shortlists.get(shortlistId);
    if (!shortlist || shortlist.advertiserAccountId !== advertiserAccountId) {
      throw new Error(
        "SHORTLIST_NOT_FOUND: Shortlist introuvable ou accès refusé.",
      );
    }

    const items = this.store.shortlistItems.get(shortlistId) || [];
    return items.map((it) => ShortlistItemSchema.parse(it));
  }

  public async addShortlistItem(
    shortlistId: string,
    advertiserAccountId: string,
    creatorAccountId: string,
    note?: string | null,
  ): Promise<ShortlistItem> {
    const shortlist = this.store.shortlists.get(shortlistId);
    if (!shortlist || shortlist.advertiserAccountId !== advertiserAccountId) {
      throw new Error(
        "SHORTLIST_NOT_FOUND: Shortlist introuvable ou accès refusé.",
      );
    }

    const items = this.store.shortlistItems.get(shortlistId) || [];
    const existing = items.find((i) => i.creatorAccountId === creatorAccountId);
    if (existing) {
      return ShortlistItemSchema.parse(existing);
    }

    const id = randomUUID();
    const item: ShortlistItem = {
      id,
      shortlistId,
      creatorAccountId,
      note: note || null,
      addedAt: new Date().toISOString(),
    };

    items.push(item);
    this.store.shortlistItems.set(shortlistId, items);

    // Mettre à jour shortlist updatedAt
    shortlist.updatedAt = new Date().toISOString();

    this.store.recordAuditEvent(
      "shortlist.item_added",
      item,
      advertiserAccountId,
    );

    return ShortlistItemSchema.parse(item);
  }

  public async removeShortlistItem(
    shortlistId: string,
    advertiserAccountId: string,
    creatorAccountId: string,
  ): Promise<{ success: boolean }> {
    const shortlist = this.store.shortlists.get(shortlistId);
    if (!shortlist || shortlist.advertiserAccountId !== advertiserAccountId) {
      throw new Error(
        "SHORTLIST_NOT_FOUND: Shortlist introuvable ou accès refusé.",
      );
    }

    const items = this.store.shortlistItems.get(shortlistId) || [];
    const filtered = items.filter(
      (i) => i.creatorAccountId !== creatorAccountId,
    );
    this.store.shortlistItems.set(shortlistId, filtered);

    shortlist.updatedAt = new Date().toISOString();

    this.store.recordAuditEvent(
      "shortlist.item_removed",
      { shortlistId, creatorAccountId },
      advertiserAccountId,
    );

    return { success: true };
  }
}
