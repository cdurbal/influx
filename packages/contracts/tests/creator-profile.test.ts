import { describe, it, expect } from "vitest";
import {
  generateCreatorAlias,
  calculateAudienceBand,
  calculateEngagementBand,
  calculateCountryShareBand,
  getEstimatedNetForPriceBand,
  calculateCreatorProfileCompleteness,
  sanitizeCreatorProfileToPublic,
  sanitizeCreatorProfileToRevealed,
  CreatorProfileSchema,
  type CreatorProfile,
} from "../src/creator-profile";

describe("Creator Profile Contracts & Business Rules (Lot 2 - Mission 2.3)", () => {
  describe("RG23 : Alias public de plateforme", () => {
    it("génère un alias stable de forme 'Profil XXXX' avec 4 caractères non ambigus", () => {
      const alias = generateCreatorAlias();
      expect(alias).toMatch(/^Profil [2-9A-HJ-NP-Z]{4}$/);
      // Ne contient jamais les caractères ambigus 0, O, 1, I
      expect(alias).not.toMatch(/[0O1I]/);
    });
  });

  describe("RG45, RG48, RG58 : Dérivation des tranches", () => {
    it("dérive correctement la tranche d'abonnés", () => {
      expect(calculateAudienceBand(5000)).toBe("nano");
      expect(calculateAudienceBand(25000)).toBe("micro");
      expect(calculateAudienceBand(75000)).toBe("mid");
      expect(calculateAudienceBand(250000)).toBe("macro");
      expect(calculateAudienceBand(1200000)).toBe("mega");
    });

    it("dérive correctement la tranche de taux d'engagement", () => {
      expect(calculateEngagementBand(0.6)).toBe("lt_1");
      expect(calculateEngagementBand(2.1)).toBe("1_3");
      expect(calculateEngagementBand(4.8)).toBe("3_6");
      expect(calculateEngagementBand(8.2)).toBe("gt_6");
    });

    it("dérive correctement la tranche de part du pays principal d'audience", () => {
      expect(calculateCountryShareBand(85)).toBe("gte_80");
      expect(calculateCountryShareBand(65)).toBe("50_80");
      expect(calculateCountryShareBand(35)).toBe("lt_50");
    });
  });

  describe("RG68, RG72 : Référentiel des tranches et net créateur estimé (65%)", () => {
    it("fournit les bornes nettes à 65% depuis la table sans multiplication dans le code applicatif", () => {
      const net1000 = getEstimatedNetForPriceBand("1000_2000", "EUR");
      expect(net1000.minNetMinor).toBe(65000); // 650 EUR
      expect(net1000.maxNetMinor).toBe(130000); // 1300 EUR
      expect(net1000.label).toContain("35 %");

      const net500 = getEstimatedNetForPriceBand("500_1000", "EUR");
      expect(net500.minNetMinor).toBe(32500); // 325 EUR
      expect(net500.maxNetMinor).toBe(65000); // 650 EUR
    });
  });

  describe("RG87 : Calcul de complétude du profil créateur (0-100)", () => {
    it("calcule 0 pour un profil vide et liste les champs obligatoires manquants", () => {
      const result = calculateCreatorProfileCompleteness({});
      expect(result.score).toBe(0);
      expect(result.missingRequiredForPublish).toContain("shortTitle");
      expect(result.missingRequiredForPublish).toContain("bio");
      expect(result.missingRequiredForPublish).toContain("primaryTopic");
      expect(result.missingRequiredForPublish).toContain("languages");
      expect(result.missingRequiredForPublish).toContain("country");
      expect(result.missingRequiredForPublish).toContain("primaryNetwork");
      expect(result.missingRequiredForPublish).toContain("offers");
      expect(result.missingRequiredForPublish).toContain("portfolio");
    });

    it("calcule 100 points pour un profil complet avec badges et portfolio", () => {
      const fullProfile: Partial<CreatorProfile> = {
        shortTitle: "Créateur Tech & Hardware spécialisé tests PC",
        bio: "Passionné par l'univers des composants informatiques et de la tech grand public, je produis des vidéos de vulgarisation et des tests complets depuis 5 ans avec une communauté engagée.",
        primaryTopic: "tech",
        secondaryTopics: ["gaming"],
        editorialTone: ["pedagogique", "expert_technique"],
        languages: ["fr"],
        country: "FR",
        travelScope: "country",
        networks: [
          {
            network: "youtube",
            isPrimary: true,
            handle: "@lucastech",
            profileUrl: "https://youtube.com/@lucastech",
            followersCount: 85000,
            audienceBand: "mid",
            engagementRate: 4.2,
            engagementRateBand: "3_6",
            avgReachPerPost: 40000,
            averageReachBand: "micro",
            publicationFrequency: "weekly",
            figuresSource: "declared",
            figuresUpdatedAt: new Date().toISOString(),
            hasVerifiedAccountBadge: true,
            hasVerifiedAudienceBadge: false,
          },
          {
            network: "instagram",
            isPrimary: false,
            handle: "@lucas_hardware",
            profileUrl: "https://instagram.com/lucas_hardware",
            followersCount: 22000,
            audienceBand: "micro",
            figuresSource: "declared",
            figuresUpdatedAt: new Date().toISOString(),
            hasVerifiedAccountBadge: false,
            hasVerifiedAudienceBadge: false,
          },
        ],
        audience: {
          primaryCountry: "FR",
          primaryCountryShareBand: "gte_80",
          primaryCountrySharePercent: 82,
          otherCountries: [{ country: "BE", shareBand: "10_25" }],
          ageBands: { "18_24": 30, "25_34": 50, "35_44": 15, "45_plus": 5 },
          genderBand: "majority_male",
          figuresSource: "declared",
          figuresUpdatedAt: new Date().toISOString(),
        },
        offers: [
          {
            format: "video_dediee",
            network: "youtube",
            priceBand: "1000_2000",
            currency: "EUR",
            deliveryLeadBand: "15_30d",
            includedUsageRights: ["digital_30d"],
            optionalUsageRights: ["tv_commercial"],
            exclusivity: "1_month",
          },
          {
            format: "story",
            network: "instagram",
            priceBand: "250_500",
            currency: "EUR",
            deliveryLeadBand: "7_14d",
            includedUsageRights: [],
            optionalUsageRights: [],
            exclusivity: "none",
          },
        ],
        availability: "lt_2w",
        availabilityDeclaredAt: new Date().toISOString(),
        portfolio: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            imageUrl: "https://storage.influx.dev/portfolio/test1.png",
            caption: "Configuration PC Watercooling",
            brandConsentConfirmed: false,
            displayOrder: 1,
            status: "approved",
            uploadedAt: new Date().toISOString(),
            exifStripped: true,
          },
          {
            id: "22222222-2222-4222-8222-222222222222",
            imageUrl: "https://storage.influx.dev/portfolio/test2.png",
            caption: "Setup de stream minimaliste",
            brandConsentConfirmed: false,
            displayOrder: 2,
            status: "approved",
            uploadedAt: new Date().toISOString(),
            exifStripped: true,
          },
          {
            id: "33333333-3333-4333-8333-333333333333",
            imageUrl: "https://storage.influx.dev/portfolio/test3.png",
            caption: "Test du nouveau processeur",
            brandConsentConfirmed: false,
            displayOrder: 3,
            status: "approved",
            uploadedAt: new Date().toISOString(),
            exifStripped: true,
          },
          {
            id: "44444444-4444-4444-8444-444444444444",
            imageUrl: "https://storage.influx.dev/portfolio/test4.png",
            caption: "Unboxing matériel",
            brandConsentConfirmed: false,
            displayOrder: 4,
            status: "approved",
            uploadedAt: new Date().toISOString(),
            exifStripped: true,
          },
          {
            id: "55555555-5555-4555-8555-555555555555",
            imageUrl: "https://storage.influx.dev/portfolio/test5.png",
            caption: "Dossier optimisation GPU",
            brandConsentConfirmed: false,
            displayOrder: 5,
            status: "approved",
            uploadedAt: new Date().toISOString(),
            exifStripped: true,
          },
        ],
      };

      const result = calculateCreatorProfileCompleteness(fullProfile);
      expect(result.score).toBe(100);
      expect(result.missingRequiredForPublish).toEqual([]);
      expect(result.breakdown).toEqual({
        presentation: 15,
        editorial: 14,
        networks: 22,
        audience: 20,
        offers: 19,
        portfolio: 8,
        trust: 2,
      });
    });
  });

  describe("RG16, RG18, RG19, RG102 : Filtrage des couches (Anonyme vs Révélée vs Interne)", () => {
    const fullMockCreator: CreatorProfile = {
      id: "a0000000-0000-4000-8000-000000000001",
      accountId: "b0000000-0000-4000-8000-000000000002",
      status: "publie",
      alias: "Profil 7K3M",
      shortTitle: "Créateur Hardware & High-Tech",
      bio: "Présentation détaillée sans aucun contact direct pour les tests.",
      primaryTopic: "tech",
      secondaryTopics: ["gaming"],
      editorialTone: ["pedagogique"],
      languages: ["fr"],
      country: "FR",
      region: "IDF",
      city: "Paris",
      travelScope: "country",
      collaborationExperienceBand: "6_20",
      networks: [
        {
          network: "youtube",
          isPrimary: true,
          handle: "@lucastech",
          profileUrl: "https://youtube.com/@lucastech",
          followersCount: 85000,
          audienceBand: "mid",
          engagementRate: 4.2,
          engagementRateBand: "3_6",
          avgReachPerPost: 40000,
          averageReachBand: "micro",
          publicationFrequency: "weekly",
          figuresSource: "agent_observed",
          figuresUpdatedAt: "2026-09-18T10:00:00Z",
          hasVerifiedAccountBadge: true,
          accountBadgeVerifiedAt: "2026-09-18T10:00:00Z",
          hasVerifiedAudienceBadge: true, // Avec badge vérifié, le band sort en couche A (RG48)
          audienceBadgeVerifiedAt: "2026-09-18T10:00:00Z",
        },
        {
          network: "instagram",
          isPrimary: false,
          handle: "@lucas_insta",
          profileUrl: "https://instagram.com/lucas_insta",
          followersCount: 15000,
          audienceBand: "micro",
          engagementRate: 5.5,
          engagementRateBand: "3_6",
          avgReachPerPost: 8000,
          averageReachBand: "nano",
          publicationFrequency: "several_per_week",
          figuresSource: "declared",
          figuresUpdatedAt: "2026-09-18T10:00:00Z",
          hasVerifiedAccountBadge: false,
          hasVerifiedAudienceBadge: false, // NON vérifié -> STRICTEMENT AUCUN engagement en couche A (RG48)
        },
      ],
      audience: {
        primaryCountry: "FR",
        primaryCountryShareBand: "gte_80",
        primaryCountrySharePercent: 84,
        otherCountries: [{ country: "BE", shareBand: "10_25" }],
        otherCountriesExact: [{ country: "BE", percent: 12 }],
        ageBands: { "18_24": 35, "25_34": 45 },
        genderBand: "majority_male",
        figuresSource: "agent_observed",
        figuresUpdatedAt: "2026-09-18T10:00:00Z",
      },
      offers: [
        {
          format: "video_dediee",
          network: "youtube",
          priceBand: "1000_2000",
          currency: "EUR",
          deliveryLeadBand: "15_30d",
          includedUsageRights: ["digital_30d"],
          optionalUsageRights: [],
          exclusivity: "none",
          exactAmountMinor: 150000, // 1500€
          estimatedNetMinMinor: 65000,
          estimatedNetMaxMinor: 130000,
        },
      ],
      availability: "lt_2w",
      availabilityDeclaredAt: "2026-09-18T10:00:00Z",
      acceptsNonMonetaryCounterpart: false,
      portfolio: [
        {
          id: "c0000000-0000-4000-8000-000000000003",
          imageUrl: "https://storage.influx.dev/portfolio/approved.png",
          caption: "Visuel validé",
          brandConsentConfirmed: false,
          displayOrder: 1,
          status: "approved",
          uploadedAt: "2026-09-18T10:00:00Z",
          exifStripped: true,
        },
        {
          id: "d0000000-0000-4000-8000-000000000004",
          imageUrl: "https://storage.influx.dev/portfolio/pending.png",
          caption: "Visuel en attente",
          brandConsentConfirmed: false,
          displayOrder: 2,
          status: "pending",
          uploadedAt: "2026-09-18T10:00:00Z",
          exifStripped: true,
        },
      ],
      searchVisibility: true,
      completenessScore: 100,
      pseudonym: "Lucas Tech",
      legalFirstName: "Lucas",
      legalLastName: "Martinez",
      birthDate: "1995-04-12",
      phone: "+33612345678",
      email: "lucas@example.com",
      postalAddress: "12 rue de la Paix, 75001 Paris",
      declaredStatus: "individual",
      refusedSectors: ["gambling", "adult"],
      internalNotes: "Excellent profil, créateur sérieux",
      rejectionReason: null,
      rejectionMessage: null,
      publishedAt: "2026-09-18T10:00:00Z",
      createdAt: "2026-09-18T08:00:00Z",
      updatedAt: "2026-09-18T10:00:00Z",
    };

    it("Couche A (Anonyme) : masque rigoureusement tout champ identifiant et chiffres exacts (CA4, CA13, CA15)", () => {
      const publicView = sanitizeCreatorProfileToPublic(fullMockCreator);

      // 1. Identité et textes
      expect(publicView.alias).toBe("Profil 7K3M");
      expect((publicView as any).pseudonym).toBeUndefined();
      expect((publicView as any).city).toBeUndefined();
      expect((publicView as any).legalFirstName).toBeUndefined();
      expect((publicView as any).legalLastName).toBeUndefined();
      expect((publicView as any).phone).toBeUndefined();
      expect((publicView as any).email).toBeUndefined();
      expect((publicView as any).postalAddress).toBeUndefined();
      expect((publicView as any).internalNotes).toBeUndefined();
      expect((publicView as any).refusedSectors).toBeUndefined();

      // 2. Réseaux
      const yt = publicView.networks.find((n) => n.network === "youtube")!;
      expect((yt as any).handle).toBeUndefined();
      expect((yt as any).profileUrl).toBeUndefined();
      expect((yt as any).followersCount).toBeUndefined();
      expect(yt.audienceBand).toBe("mid");
      // YouTube est vérifié -> engagementRateBand est présent
      expect(yt.engagementRateBand).toBe("3_6");

      const insta = publicView.networks.find((n) => n.network === "instagram")!;
      // Instagram n'est PAS vérifié -> engagementRateBand doit être STRICTEMENT NULL (RG48)
      expect(insta.engagementRateBand).toBeNull();
      expect((insta as any).followersCount).toBeUndefined();

      // 3. Tarifs et offres
      const offer = publicView.offers[0]!;
      expect(offer).toBeDefined();
      expect(offer.priceBand).toBe("1000_2000");
      expect((offer as any).exactAmountMinor).toBeUndefined();
      expect((offer as any).estimatedNetMinMinor).toBeUndefined(); // RG70 : JAMAIS à la marque

      // 4. Portfolio (uniquement les items approuvés)
      expect(publicView.portfolio).toHaveLength(1);
      expect(publicView.portfolio[0]!.id).toBe(
        "c0000000-0000-4000-8000-000000000003",
      );
    });

    it("Couche I (Révélée) : révèle pseudo, handles, URLs et chiffres exacts SANS exposer la couche N (CA14, CA25, CA56)", () => {
      const revealedView = sanitizeCreatorProfileToRevealed(fullMockCreator);

      // Révélés
      expect(revealedView.pseudonym).toBe("Lucas Tech");
      expect(revealedView.city).toBe("Paris");
      const yt = revealedView.networks.find((n) => n.network === "youtube")!;
      expect(yt.handle).toBe("@lucastech");
      expect(yt.profileUrl).toBe("https://youtube.com/@lucastech");
      expect(yt.followersCount).toBe(85000);
      expect(yt.engagementRate).toBe(4.2);

      // Audience exacte
      expect(revealedView.audience?.primaryCountrySharePercent).toBe(84);

      // STRICTEMENT TOUJOURS MASQUÉS (Couche N - RG20, RG103)
      expect((revealedView as any).legalFirstName).toBeUndefined();
      expect((revealedView as any).phone).toBeUndefined();
      expect((revealedView as any).email).toBeUndefined();
      expect((revealedView as any).postalAddress).toBeUndefined();
      expect((revealedView as any).refusedSectors).toBeUndefined();
      expect((revealedView.offers[0] as any).exactAmountMinor).toBeUndefined(); // RG103
      expect(
        (revealedView.offers[0] as any).estimatedNetMinMinor,
      ).toBeUndefined(); // RG70
    });
  });
});
