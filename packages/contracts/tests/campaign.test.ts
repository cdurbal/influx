import { describe, it, expect } from "vitest";
import {
  CampaignSchema,
  CreateCampaignDraftSchema,
  calculateCampaignCompleteness,
  deriveCampaignPriceBands,
  getEstimatedNetForDerivedBands,
  validateCampaignDates,
  detectForbiddenPatternsInText,
  sanitizeCampaignForBrand,
  sanitizeCampaignForCreator,
  sanitizeCampaignForFeedCard,
  sanitizeCampaignForBackoffice,
  isSensitiveSector,
  isDeliverableFormatValid,
  type Campaign,
} from "../src/campaign";
import { type BrandProfilePublicView } from "../src/brand-profile";

describe("Contracts & Services - Campagnes (Mission 3.1)", () => {
  const dummyBrandProfile: BrandProfilePublicView = {
    id: "b1111111-1111-4111-8111-111111111111",
    companyName: "Maison Solène",
    logoUrl: null,
    sector: "beaute_cosmetiques",
    secondarySectors: [],
    companySize: "11-50",
    country: "FR",
    targetMarkets: ["FR"],
    languages: ["fr"],
    website: "maisonsolene.fr",
    presentation: "Une marque éthique et responsable.",
    targetAudienceCountries: ["FR"],
    topics: ["beaute", "mode"],
    targetNetworks: ["instagram"],
    expectedFormats: ["reel", "story"],
    indicativeBudgetBand: "1000_2000",
    currency: "EUR",
    usageRights: ["repost_organique"],
    exclusivity: "none",
    nonMonetaryCounterpart: false,
    badgeStatus: "verified",
    badgeVerifiedAt: new Date().toISOString(),
    contactRole: "marketing",
  };

  const validCampaignData: Campaign = {
    id: "c1111111-1111-4111-8111-111111111111",
    brandAccountId: "11111111-1111-4111-8111-111111111111",
    status: "brouillon",
    title: "Lancement Nouveau Sérum Visage Printemps 2026",
    campaignType: "placement_produit",
    publicSummary:
      "Nous recherchons des créatrices et créateurs engagés pour présenter notre tout nouveau sérum visage bio à leur communauté avec authenticité.",
    detailedBrief:
      "Le brief complet consiste à intégrer notre soin dans votre routine matinale habituelle. Vous mettrez en avant la texture légère, le parfum discret et la certification cosmétique biologique. Deux formats sont demandés : un reel explicatif et deux stories de suivi à J+7. Nous souhaitons des contenus vivants, sincères et soignés qui résonnent auprès d'une communauté sensible au bien-être au quotidien.",
    internalReference: "SERUM-2026-PRINTEMPS",
    productName: "Sérum Botanique Éclat 50ml",
    productCategory: "beaute_cosmetiques",
    keyMessages: [
      "100% d'ingrédients d'origine naturelle",
      "Fabrication française en circuit court",
      "Résultats visibles dès 14 jours",
    ],
    prohibitions: "Ne pas dénigrer d'autres marques concurrentes.",
    productShipped: true,
    productValueBand: "lt_250",
    productCurrency: "EUR",
    productKept: true,
    productShippingCost: "marque",
    deliverables: [
      { network: "instagram", format: "reel", quantity: 1 },
      { network: "instagram", format: "story", quantity: 2 },
    ],
    targetNetworks: ["instagram"],
    usageRights: "repost_organique",
    usageDuration: "3_mois",
    usageTerritory: ["FR"],
    exclusivity: "none",
    contentValidationDelay: "48h",
    targetCountries: ["FR"],
    targetLanguages: ["fr"],
    targetTopics: ["beaute", "bien_etre"],
    targetAudienceBands: ["micro", "mid"],
    targetAgeBands: ["25-34", "35-44"],
    targetGender: "majority_female",
    minCompensationMinor: 100000, // 1 000 EUR
    maxCompensationMinor: 200000, // 2 000 EUR
    currency: "EUR",
    compensationNature: "numeraire_et_dotation",
    creatorsCount: 5,
    totalBudgetMinor: 1000000, // 10 000 EUR
    derivedPriceBands: ["1000_2000"],
    applicationDeadline: "2026-10-15",
    deliveryDeadline: "2026-10-30",
    startsOn: "2026-11-01",
    endsOn: "2026-11-30",
    requestedCandidateElements: ["message_motivation", "exemples_contenus"],
    applicationCap: 25,
    verifiedOnly: false,
    internalNotes:
      "Prioriser les profils avec bonne audience en Île-de-France.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    applicationsCount: 0,
  };

  it("valide une campagne complète avec le schéma Zod", () => {
    const parsed = CampaignSchema.safeParse(validCampaignData);
    expect(parsed.success).toBe(true);
  });

  it("contrôle les compatibilités réseau et format (RG36, CA23)", () => {
    expect(isDeliverableFormatValid("instagram", "reel")).toBe(true);
    expect(isDeliverableFormatValid("instagram", "video_tiktok")).toBe(false);
    expect(isDeliverableFormatValid("tiktok", "video_tiktok")).toBe(true);
    expect(isDeliverableFormatValid("youtube", "video_dedicated")).toBe(true);
  });

  it("contrôle l'ordre strict des dates et la durée maximale de 12 mois (RG70, RG74, CA47, CA50)", () => {
    // Valide
    expect(
      validateCampaignDates({
        applicationDeadline: "2026-10-01",
        deliveryDeadline: "2026-10-15",
        startsOn: "2026-10-20",
        endsOn: "2026-11-20",
      }).valid,
    ).toBe(true);

    // Invalide : applicationDeadline après startsOn
    const invalidOrder = validateCampaignDates({
      applicationDeadline: "2026-10-25",
      startsOn: "2026-10-20",
      endsOn: "2026-11-20",
    });
    expect(invalidOrder.valid).toBe(false);
    expect(invalidOrder.error).toContain("précéder le début");

    // Invalide : durée > 12 mois
    const tooLong = validateCampaignDates({
      applicationDeadline: "2026-10-01",
      startsOn: "2026-10-10",
      endsOn: "2027-11-15",
    });
    expect(tooLong.valid).toBe(false);
    expect(tooLong.error).toContain("12 mois");
  });

  it("détecte les coordonnées, liens, montants et critères sur le créateur dans les textes (RG21, RG22, RG23, RG48, CA12, CA13, CA14, CA31)", () => {
    // Coordonnées directes (RG21)
    expect(
      detectForbiddenPatternsInText(
        "Envoyez vos propositions à contact@marque.com",
      ).hasContact,
    ).toBe(true);
    expect(
      detectForbiddenPatternsInText("Appelez-nous au 06 12 34 56 78")
        .hasContact,
    ).toBe(true);

    // Liens web (RG22)
    expect(
      detectForbiddenPatternsInText(
        "Brief disponible sur https://monsite.fr/brief.pdf",
      ).hasUrl,
    ).toBe(true);

    // Montants chiffrés (RG23)
    expect(
      detectForbiddenPatternsInText("Rémunération prévue de 500 € par post")
        .hasAmount,
    ).toBe(true);
    expect(
      detectForbiddenPatternsInText("Budget net de 1200 EUR pour vous")
        .hasAmount,
    ).toBe(true);

    // Critère portant sur la personne du créateur (RG48)
    expect(
      detectForbiddenPatternsInText(
        "Nous cherchons des créatrices de 18 à 25 ans",
      ).hasPersonCriterion,
    ).toBe(true);
    expect(
      detectForbiddenPatternsInText("Candidats hommes uniquement")
        .hasPersonCriterion,
    ).toBe(true);

    // Texte conforme
    const clean = detectForbiddenPatternsInText(
      "Recherche créateurs passionnés par l'univers culinaire.",
    );
    expect(clean.hasContact).toBe(false);
    expect(clean.hasUrl).toBe(false);
    expect(clean.hasAmount).toBe(false);
    expect(clean.hasPersonCriterion).toBe(false);
  });

  it("dérive les tranches de prix et le net créateur estimé SANS AUCUN CALCUL applicatif (RG59, RG60, Invariant T16, CA38, CA40)", () => {
    // Fourchette 1 000 – 2 000 EUR
    const bands = deriveCampaignPriceBands(100000, 200000, "EUR");
    expect(bands).toContain("1000_2000");

    const net = getEstimatedNetForDerivedBands(bands, "EUR");
    expect(net).not.toBeNull();
    // 65% de 100 000 = 65 000 ; 65% de 200 000 = 130 000 (lus dans le référentiel)
    expect(net?.minNetMinor).toBe(65000);
    expect(net?.maxNetMinor).toBe(130000);
    expect(net?.formattedLabel).toContain("environ 650 – 1 300 EUR");
  });

  it("calcule la complétude et bloque la soumission si profil marque non publié ou champs obligatoires manquants (RG4, CA2, CA3)", () => {
    // Profil marque non publié
    const checkUnpublishedBrand = calculateCampaignCompleteness(
      validCampaignData,
      false,
    );
    expect(checkUnpublishedBrand.isSubmittable).toBe(false);
    expect(checkUnpublishedBrand.missingFields).toContain(
      "brandProfilePublished",
    );

    // Profil marque publié mais manque livrables et dates
    const incompleteCampaign: Partial<Campaign> = {
      ...validCampaignData,
      deliverables: [],
      applicationDeadline: "",
    };
    const checkIncomplete = calculateCampaignCompleteness(
      incompleteCampaign,
      true,
    );
    expect(checkIncomplete.isSubmittable).toBe(false);
    expect(checkIncomplete.missingFields).toContain("deliverables");
    expect(checkIncomplete.missingFields).toContain("applicationDeadline");

    // Campagne complète et marque publiée
    const checkComplete = calculateCampaignCompleteness(
      validCampaignData,
      true,
    );
    expect(checkComplete.isSubmittable).toBe(true);
    expect(checkComplete.missingFields).toHaveLength(0);
    expect(checkComplete.score).toBe(100);
  });

  it("identifie les secteurs sensibles et exige la déclaration légale (RG84, RG85, CA56)", () => {
    expect(isSensitiveSector("alcool")).toBe(true);
    expect(isSensitiveSector("jeux_argent")).toBe(true);
    expect(isSensitiveSector("crypto")).toBe(true);
    expect(isSensitiveSector("beaute_cosmetiques")).toBe(false);

    const sensitiveCampaign: Partial<Campaign> = {
      ...validCampaignData,
      productCategory: "alcool",
      sensitiveDeclarationAcceptedAt: undefined,
    };
    const checkSensitive = calculateCampaignCompleteness(
      sensitiveCampaign,
      true,
    );
    expect(checkSensitive.isSubmittable).toBe(false);
    expect(checkSensitive.missingFields).toContain(
      "sensitiveDeclarationAccepted",
    );
  });

  it("sanitise strictement la vue Créateur : JAMAIS de budget total, ni de notes, ni de contacts (RG65, RG98, CA41)", () => {
    const creatorView = sanitizeCampaignForCreator(
      validCampaignData,
      dummyBrandProfile,
    );

    // Vérification de la purge étanche
    expect((creatorView as any).totalBudgetMinor).toBeUndefined();
    expect((creatorView as any).internalNotes).toBeUndefined();
    expect((creatorView as any).internalReference).toBeUndefined();
    expect((creatorView as any).responsibleAgentId).toBeUndefined();
    expect((creatorView as any).validatorAgentId).toBeUndefined();

    // Vérification des données créateur visibles
    expect(creatorView.title).toBe(validCampaignData.title);
    expect(creatorView.estimatedNet).not.toBeNull();
    expect(creatorView.estimatedNet?.formattedLabel).toContain(
      "environ 650 – 1 300 EUR",
    );
    expect(creatorView.brandProfile.companyName).toBe("Maison Solène");
    expect((creatorView.brandProfile as any).contactEmail).toBeUndefined();
    expect((creatorView.brandProfile as any).contactPhone).toBeUndefined();
  });

  it("sanitise la vue Marque : contient le budget total mais JAMAIS le net créateur (RG61, CA39)", () => {
    const brandView = sanitizeCampaignForBrand(validCampaignData);

    expect(brandView.totalBudgetMinor).toBe(1000000);
    expect(brandView.internalReference).toBe("SERUM-2026-PRINTEMPS");
    expect((brandView as any).estimatedNet).toBeUndefined();
  });

  it("sanitise la vue Backoffice : alertes de revue, avertissements ratio > 10 et secteur sensible (RG85, RG87)", () => {
    const wideRangeCampaign: Campaign = {
      ...validCampaignData,
      minCompensationMinor: 10000, // 100 EUR
      maxCompensationMinor: 200000, // 2 000 EUR (ratio 20 > 10)
      productCategory: "cbd",
    };

    const boView = sanitizeCampaignForBackoffice(wideRangeCampaign);
    expect(boView.isSensitive).toBe(true);
    expect(boView.needsDualValidation).toBe(true);
    expect(boView.reviewWarnings.some((w) => w.includes("10 fois"))).toBe(true);
    expect(
      boView.reviewWarnings.some((w) => w.includes("secteur sensible")),
    ).toBe(true);
  });

  it("sanitise la carte de fil Créateur (C5, RG15) : zéro budget total, zéro contact direct, calcul éligibilité", () => {
    const feedCard = sanitizeCampaignForFeedCard(
      validCampaignData,
      dummyBrandProfile,
      {
        isProfilePublished: true,
        hasAudienceVerifiedBadge: false,
        creatorNetworksAndFormats: [{ network: "instagram", format: "reel" }],
        hasApplied: false,
        appliedAt: null,
      },
    );

    expect(feedCard.id).toBe(validCampaignData.id);
    expect(feedCard.title).toBe(validCampaignData.title);
    expect(feedCard.brandName).toBe("Maison Solène");
    expect(feedCard.brandVerified).toBe(true);
    expect(feedCard.canApply).toBe(true);
    expect(feedCard.hasApplied).toBe(false);
    expect(feedCard.estimatedNet?.formattedLabel).toContain("650 – 1 300 EUR");
    expect((feedCard as any).totalBudgetMinor).toBeUndefined();
    expect((feedCard as any).contactEmail).toBeUndefined();
  });

  it("détecte les inéligibilités créateur (profil non publié, formats incompatibles, audience non vérifiée)", () => {
    const verifiedOnlyCampaign: Campaign = {
      ...validCampaignData,
      verifiedOnly: true,
    };

    const ineligCard = sanitizeCampaignForFeedCard(
      verifiedOnlyCampaign,
      dummyBrandProfile,
      {
        isProfilePublished: false,
        hasAudienceVerifiedBadge: false,
        creatorNetworksAndFormats: [
          { network: "youtube", format: "video_longue" },
        ],
        hasApplied: false,
        appliedAt: null,
      },
    );

    expect(ineligCard.canApply).toBe(false);
    expect(
      ineligCard.ineligibilityReasons.some((r) =>
        r.includes("doit être publié"),
      ),
    ).toBe(true);
    expect(
      ineligCard.ineligibilityReasons.some((r) =>
        r.includes("audience est vérifiée"),
      ),
    ).toBe(true);
    expect(
      ineligCard.ineligibilityReasons.some((r) =>
        r.includes("compatible avec vos réseaux"),
      ),
    ).toBe(true);
  });
});
