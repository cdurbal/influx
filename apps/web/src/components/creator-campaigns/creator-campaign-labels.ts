export interface CreatorCampaignLabels {
  feed: {
    title: string;
    subtitle: string;
    totalCount: (count: number) => string;
    emptyTitle: string;
    emptyMessage: string;
    clearFilters: string;
    loginNotice: string;
    demoLoginButton: string;
    loadingText: string;
  };
  sort: {
    label: string;
    recent: string;
    deadline: string;
  };
  filters: {
    title: string;
    activeFiltersTitle: string;
    clearAll: string;
    topic: string;
    allTopics: string;
    network: string;
    format: string;
    country: string;
    allCountries: string;
    minCompensation: string;
    currency: string;
    currencyRequiredWarning: string;
    compensationNature: string;
    natureOptions: Record<string, string>;
    onlyEligible: string;
    onlyEligibleHelp: string;
    otherCurrencyBanner: (count: number) => string;
    assistanceTitle: string;
    assistanceText: string;
  };
  card: {
    openApplications: string;
    shortlistButton: string;
    targetAudience: string;
    brandVerified: string;
    brandVerifiedDate: (date: string) => string;
    deliverablesTitle: string;
    topicsTitle: string;
    compensationTitle: string;
    nonMonetaryOnly: string;
    estimatedNetLabel: string;
    estimatedNetNotice: string;
    datesTitle: string;
    deadlineLabel: string;
    periodLabel: string;
    verifiedOnlyBadge: string;
    alreadyApplied: (date: string) => string;
    campaignClosed: string;
    closedSince: (days: number) => string;
    viewBriefButton: string;
    applyButton: string;
    cannotApply: string;
  };
  detail: {
    backToFeed: string;
    summaryTitle: string;
    briefTitle: string;
    productTitle: string;
    productShipped: string;
    productKept: string;
    productShippingCost: string;
    keyMessagesTitle: string;
    prohibitionsTitle: string;
    deliverablesTitle: string;
    usageRightsTitle: string;
    exclusivityTitle: string;
    validationDelayTitle: string;
    audienceTitle: string;
    targetLanguages: string;
    targetAge: string;
    targetGender: string;
    compensationTitle: string;
    compensationNotice: string;
    datesTitle: string;
    applicationDeadline: string;
    deliveryDeadline: string;
    publicationPeriod: string;
    brandInfoTitle: string;
    companySize: string;
    sector: string;
    website: string;
    noticesTitle: string;
    applyCtaTitle: string;
    applyCtaSub: string;
    applyButton: string;
    ineligibleTitle: string;
    editProfileButton: string;
    requestBadgeButton: string;
    closedBanner: string;
    notFoundTitle: string;
    notFoundMessage: string;
  };
}

export const LABELS_FR: CreatorCampaignLabels = {
  feed: {
    title: "Fil des Campagnes Ouvertes",
    subtitle:
      "Explorez les briefs des marques en recherche active de créateurs. Consultez les attentes, les formats demandés et la rémunération prévue.",
    totalCount: (count) =>
      count === 1 ? "1 campagne disponible" : `${count} campagnes disponibles`,
    emptyTitle: "Aucune campagne trouvée",
    emptyMessage:
      "Aucune campagne ne correspond à vos critères actuels. Essayez de relâcher un filtre pour élargir votre recherche.",
    clearFilters: "Réinitialiser les filtres",
    loginNotice:
      "Connectez-vous en tant que créateur pour accéder aux briefs et postuler.",
    demoLoginButton: "Connexion Démo Créateur (Lucas Tech)",
    loadingText: "Chargement des campagnes en cours...",
  },
  sort: {
    label: "Trier par :",
    recent: "Plus récentes d'abord",
    deadline: "Date limite la plus proche",
  },
  filters: {
    title: "Filtres de recherche",
    activeFiltersTitle: "Filtres actifs :",
    clearAll: "Tout effacer",
    topic: "Thématique",
    allTopics: "Toutes les thématiques",
    network: "Réseau social",
    format: "Format de contenu",
    country: "Pays d'audience visé",
    allCountries: "Tous les pays",
    minCompensation: "Rémunération minimum (€ / dev)",
    currency: "Devise",
    currencyRequiredWarning:
      "Sélectionnez une devise pour filtrer par rémunération.",
    compensationNature: "Nature de rémunération",
    natureOptions: {
      numeraire: "Rémunération monétaire",
      numeraire_et_dotation: "Rémunération + Produit offert",
      dotation_seule: "Contrepartie seule (produit offert)",
      affiliation: "Affiliation",
    },
    onlyEligible: "Campagnes auxquelles je peux candidater",
    onlyEligibleHelp:
      "Masque les campagnes closes, hors de vos réseaux ou réservées aux profils vérifiés.",
    otherCurrencyBanner: (count) =>
      count === 1
        ? "1 campagne existe dans une autre devise (non convertie)."
        : `${count} campagnes existent dans une autre devise (non converties).`,
    assistanceTitle: "Besoin d'aide pour candidater ?",
    assistanceText:
      "Nos agents commerciaux vous accompagnent pour peaufiner votre pitch et calibrer vos prétentions tarifaires.",
  },
  card: {
    openApplications: "Candidatures ouvertes",
    shortlistButton: "Ajouter aux favoris",
    targetAudience: "Audience :",
    brandVerified: "Marque vérifiée",
    brandVerifiedDate: (date) => `Vérifiée le ${date}`,
    deliverablesTitle: "Livrables attendus :",
    topicsTitle: "Thématiques :",
    compensationTitle: "Rémunération par créateur :",
    nonMonetaryOnly: "Contrepartie non monétaire (produit offert)",
    estimatedNetLabel: "Net créateur estimé :",
    estimatedNetNotice:
      "Estimation indicative issue du barème de la plateforme, ne vaut pas engagement.",
    datesTitle: "Calendrier :",
    deadlineLabel: "Candidature avant le :",
    periodLabel: "Période de publication :",
    verifiedOnlyBadge: "Audience vérifiée requise",
    alreadyApplied: (date) => `Candidaté le ${date}`,
    campaignClosed: "Candidatures closes",
    closedSince: (days) => `Close depuis ${days}j`,
    viewBriefButton: "Consulter le brief",
    applyButton: "Candidater",
    cannotApply: "Non éligible",
  },
  detail: {
    backToFeed: "← Retour au fil des campagnes",
    summaryTitle: "Résumé de la campagne",
    briefTitle: "Brief détaillé & Attentes",
    productTitle: "Produit ou Service",
    productShipped: "Produit envoyé par la marque :",
    productKept: "Produit conservé par le créateur :",
    productShippingCost: "Prise en charge des frais de port :",
    keyMessagesTitle: "Messages clés attendus :",
    prohibitionsTitle: "Contraintes & Interdictions :",
    deliverablesTitle: "Livrables demandés",
    usageRightsTitle: "Droits d'usage & Cession",
    exclusivityTitle: "Exclusivité demandée",
    validationDelayTitle: "Délai de validation des contenus",
    audienceTitle: "Audience ciblée",
    targetLanguages: "Langues de publication :",
    targetAge: "Tranches d'âge prioritaires :",
    targetGender: "Répartition de genre :",
    compensationTitle: "Rémunération & Transparence financière",
    compensationNotice:
      "Rémunération prévue par créateur (coût total marque). Elle ne vaut pas engagement : le montant exact se discute dans la conversation.",
    datesTitle: "Calendrier de collaboration",
    applicationDeadline: "Date limite de candidature :",
    deliveryDeadline: "Remise des livrables :",
    publicationPeriod: "Période de diffusion :",
    brandInfoTitle: "À propos de la marque",
    companySize: "Effectif de l'entreprise :",
    sector: "Secteur d'activité :",
    website: "Site officiel :",
    noticesTitle: "Avertissements & Mentions légales",
    applyCtaTitle: "Intéressé par ce brief ?",
    applyCtaSub:
      "Votre candidature sera étudiée par un commercial INFLUX sous 1 jour ouvré avant transmission à la marque.",
    applyButton: "Rédiger ma candidature",
    ineligibleTitle: "Candidature indisponible pour ce profil",
    editProfileButton: "Compléter mon profil créateur",
    requestBadgeButton: "Demander le badge Audience vérifiée",
    closedBanner:
      "Cette campagne a atteint sa date limite ou son plafond de candidatures. Les candidatures sont closes.",
    notFoundTitle: "Campagne introuvable",
    notFoundMessage:
      "Cette campagne n'est plus ouverte ou n'est pas accessible avec votre profil.",
  },
};

export const LABELS_EN: CreatorCampaignLabels = {
  feed: {
    title: "Open Campaigns Feed",
    subtitle:
      "Explore briefs from brands actively seeking creators. Check expectations, requested formats, and planned compensation.",
    totalCount: (count) =>
      count === 1 ? "1 campaign available" : `${count} campaigns available`,
    emptyTitle: "No campaigns found",
    emptyMessage:
      "No campaign matches your current search criteria. Try removing a filter to broaden your search.",
    clearFilters: "Reset filters",
    loginNotice: "Log in as a creator to browse briefs and apply.",
    demoLoginButton: "Demo Creator Login (Lucas Tech)",
    loadingText: "Loading campaigns...",
  },
  sort: {
    label: "Sort by:",
    recent: "Most recent first",
    deadline: "Closest deadline first",
  },
  filters: {
    title: "Search filters",
    activeFiltersTitle: "Active filters:",
    clearAll: "Clear all",
    topic: "Topic",
    allTopics: "All topics",
    network: "Social network",
    format: "Content format",
    country: "Target audience country",
    allCountries: "All countries",
    minCompensation: "Min compensation (€ / cur)",
    currency: "Currency",
    currencyRequiredWarning: "Select a currency to filter by compensation.",
    compensationNature: "Compensation nature",
    natureOptions: {
      numeraire: "Monetary compensation",
      numeraire_et_dotation: "Compensation + Gifted product",
      dotation_seule: "Gifted product only",
      affiliation: "Affiliation",
    },
    onlyEligible: "Campaigns I can apply to",
    onlyEligibleHelp:
      "Hides closed campaigns, networks you don't use, or verified-only restrictions.",
    otherCurrencyBanner: (count) =>
      count === 1
        ? "1 campaign exists in another currency (not converted)."
        : `${count} campaigns exist in another currency (not converted).`,
    assistanceTitle: "Need help applying?",
    assistanceText:
      "Our sales agents help you refine your pitch and align your rate expectations.",
  },
  card: {
    openApplications: "Open applications",
    shortlistButton: "Add to favorites",
    targetAudience: "Audience:",
    brandVerified: "Verified Brand",
    brandVerifiedDate: (date) => `Verified on ${date}`,
    deliverablesTitle: "Requested deliverables:",
    topicsTitle: "Topics:",
    compensationTitle: "Compensation per creator:",
    nonMonetaryOnly: "Non-monetary counterpart (gifted product)",
    estimatedNetLabel: "Estimated creator net:",
    estimatedNetNotice:
      "Indicative estimate from the platform benchmark, does not constitute a commitment.",
    datesTitle: "Timeline:",
    deadlineLabel: "Apply before:",
    periodLabel: "Publishing period:",
    verifiedOnlyBadge: "Verified Audience Required",
    alreadyApplied: (date) => `Applied on ${date}`,
    campaignClosed: "Applications closed",
    closedSince: (days) => `Closed for ${days}d`,
    viewBriefButton: "View brief",
    applyButton: "Apply",
    cannotApply: "Ineligible",
  },
  detail: {
    backToFeed: "← Back to campaigns feed",
    summaryTitle: "Campaign Summary",
    briefTitle: "Detailed Brief & Expectations",
    productTitle: "Product or Service",
    productShipped: "Product shipped by the brand:",
    productKept: "Product kept by the creator:",
    productShippingCost: "Shipping cost coverage:",
    keyMessagesTitle: "Key expected messages:",
    prohibitionsTitle: "Constraints & Prohibitions:",
    deliverablesTitle: "Requested deliverables",
    usageRightsTitle: "Usage rights & Licensing",
    exclusivityTitle: "Exclusivity requested",
    validationDelayTitle: "Content review turnaround",
    audienceTitle: "Target Audience",
    targetLanguages: "Publishing languages:",
    targetAge: "Target age brackets:",
    targetGender: "Gender distribution:",
    compensationTitle: "Compensation & Financial transparency",
    compensationNotice:
      "Estimated compensation per creator (total advertiser cost). It is not binding: exact amounts are negotiated in conversation.",
    datesTitle: "Collaboration timeline",
    applicationDeadline: "Application deadline:",
    deliveryDeadline: "Deliverables due:",
    publicationPeriod: "Publishing period:",
    brandInfoTitle: "About the brand",
    companySize: "Company size:",
    sector: "Industry:",
    website: "Official website:",
    noticesTitle: "Legal notices & Disclosures",
    applyCtaTitle: "Interested in this brief?",
    applyCtaSub:
      "Your application will be reviewed by an INFLUX agent within 1 business day before being forwarded to the brand.",
    applyButton: "Draft my application",
    ineligibleTitle: "Application unavailable for this profile",
    editProfileButton: "Complete my creator profile",
    requestBadgeButton: "Request Verified Audience badge",
    closedBanner:
      "This campaign has reached its deadline or application cap. Applications are now closed.",
    notFoundTitle: "Campaign not found",
    notFoundMessage:
      "This campaign is no longer open or is not accessible with your profile.",
  },
};

export function getCreatorCampaignLabels(
  locale: string = "fr",
): CreatorCampaignLabels {
  return locale === "en" ? LABELS_EN : LABELS_FR;
}
