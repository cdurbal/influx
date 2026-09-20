export interface SearchLabels {
  pageTitle: string;
  pageSubtitle: string;
  searchPlaceholder: string;
  resetFilters: string;
  applyFilters: string;
  filterByCampaign: string;
  campaignBridgeApplied: string;
  sortLabel: string;
  sortBy: {
    default: string;
    audience_desc: string;
    price_asc: string;
    verified_first: string;
    new_profiles: string;
  };
  facets: {
    title: string;
    primaryTopic: string;
    allTopics: string;
    topics: Record<string, string>;
    networks: string;
    networkOptions: Record<string, string>;
    audienceBands: string;
    allAudienceBands: string;
    audienceBandOptions: Record<string, string>;
    engagementBands: string;
    allEngagementBands: string;
    engagementBandOptions: Record<string, string>;
    audienceCountry: string;
    allCountries: string;
    countries: Record<string, string>;
    formats: string;
    formatOptions: Record<string, string>;
    priceBands: string;
    allPriceBands: string;
    priceBandOptions: Record<string, string>;
    currency: string;
    badges: string;
    badgeOptions: Record<string, string>;
  };
  kAnonymity: {
    underThresholdTitle: string;
    underThresholdMessage: string;
    broadenSuggestionsTitle: string;
    suggestions: Record<string, string>;
    requestTeamSelectionButton: string;
    rangeCountSuffix: string;
    countBands: {
      zero: string;
      under_k: string;
      "5_9": string;
      "10_24": string;
      "25_49": string;
      "50_plus": string;
    };
  };
  card: {
    verifiedIdentity: string;
    verifiedAudience: string;
    verifiedDate: string;
    primaryAudience: string;
    indicativeCost: string;
    costExplanation: string;
    availability: string;
    availabilityDeclared: string;
    portfolioPreview: string;
    proposedBecause: string;
    vigilancePoint: string;
    alreadyIntroduced: string;
    requestPending: string;
    detailsButton: string;
    shortlistButton: string;
    introduceButton: string;
    introductionRequested: string;
    relationActive: string;
  };
  explanations: Record<string, string>;
  vigilanceWarnings: Record<string, string>;
  detailModal: {
    title: string;
    close: string;
    aliasContext: string;
    shortTitle: string;
    networksAudience: string;
    pricingOffers: string;
    format: string;
    costBand: string;
    usageRights: string;
    exclusivity: string;
    deliveryTime: string;
    portfolioTitle: string;
    noPortfolio: string;
    audienceDemographics: string;
    mainCountry: string;
    ageDistribution: string;
    genderDistribution: string;
    declaredAvailability: string;
    actionsTitle: string;
  };
  shortlistModal: {
    title: string;
    subtitle: string;
    selectExisting: string;
    createNew: string;
    namePlaceholder: string;
    optionalNote: string;
    notePlaceholder: string;
    cancel: string;
    save: string;
    savedSuccess: string;
  };
  teamSelectionModal: {
    title: string;
    subtitle: string;
    slaNotice: string;
    activeFiltersSummary: string;
    briefNotes: string;
    briefPlaceholder: string;
    cancel: string;
    submit: string;
    submittedSuccess: string;
  };
  introductionModal: {
    title: string;
    subtitle: string;
    coachedNotice: string;
    slaNotice: string;
    linkCampaign: string;
    noneCampaign: string;
    messageNote: string;
    messagePlaceholder: string;
    cancel: string;
    sendRequest: string;
    sentSuccess: string;
  };
  warnings: {
    authRequiredTitle: string;
    authRequiredMessage: string;
    loginButton: string;
    demoLoginButton: string;
    profileNotPublishedTitle: string;
    profileNotPublishedMessage: string;
    completeProfileButton: string;
    contactTeamButton: string;
    rateLimitExceeded: string;
    profileOpenLimitExceeded: string;
  };
  pagination: {
    page: string;
    of: string;
    previous: string;
    next: string;
  };
  devTools: {
    title: string;
    seedExtraCreators: string;
    seededSuccess: string;
    currentCount: string;
  };
}

const FR: SearchLabels = {
  pageTitle: "Recherche de créateurs",
  pageSubtitle:
    "Explorez notre catalogue de créateurs anonymisés selon vos critères, thématiques et budgets.",
  searchPlaceholder: "Rechercher par thématique, format ou mot-clé...",
  resetFilters: "Réinitialiser les filtres",
  applyFilters: "Appliquer",
  filterByCampaign: "Campagne associée",
  campaignBridgeApplied: "Filtres pré-remplis d'après la campagne",
  sortLabel: "Trier par",
  sortBy: {
    default: "Pertinence INFLUX (Recommandé)",
    audience_desc: "Audience décroissante",
    price_asc: "Tarif indicatif croissant",
    verified_first: "Profils vérifiés d'abord",
    new_profiles: "Nouveaux profils (< 30j)",
  },
  facets: {
    title: "Filtres & Critères",
    primaryTopic: "Thématique principale",
    allTopics: "Toutes les thématiques",
    topics: {
      beaute: "Beauté & Cosmétiques",
      lifestyle: "Lifestyle & Quotidien",
      tech: "Tech & Hardware",
      gaming: "Gaming & Jeux vidéo",
      food: "Cuisine & Gastronomie",
      travel: "Voyage & Aventure",
      mode: "Mode & Prêt-à-porter",
      fitness: "Sport & Bien-être",
      design: "Design & Décoration",
      sante: "Santé & Nutrition",
    },
    networks: "Réseaux sociaux",
    networkOptions: {
      instagram: "Instagram",
      tiktok: "TikTok",
      youtube: "YouTube",
      linkedin: "LinkedIn",
      pinterest: "Pinterest",
    },
    audienceBands: "Taille d'audience",
    allAudienceBands: "Toutes les tranches",
    audienceBandOptions: {
      nano: "Nano (1k – 10k abonnés)",
      micro: "Micro (10k – 50k abonnés)",
      mid: "Mid (50k – 100k abonnés)",
      macro: "Macro (100k – 500k abonnés)",
      mega: "Mega (500k+ abonnés)",
    },
    engagementBands: "Taux d'engagement",
    allEngagementBands: "Tous les niveaux",
    engagementBandOptions: {
      low: "Modéré (< 1%)",
      standard: "Standard (1% – 3%)",
      high: "Élevé (3% – 5%)",
      very_high: "Très élevé (5%+)",
    },
    audienceCountry: "Pays principal d'audience",
    allCountries: "Tous les pays",
    countries: {
      FR: "France",
      BE: "Belgique",
      CH: "Suisse",
      CA: "Canada",
      US: "États-Unis",
      UK: "Royaume-Uni",
      DE: "Allemagne",
      ES: "Espagne",
    },
    formats: "Formats souhaités",
    formatOptions: {
      post: "Post photo / Carrousel",
      reel: "Reel / Vidéo courte",
      story: "Story (24h)",
      video_dedicated: "Vidéo dédiée longue",
      short_video: "Short / TikTok",
      ugc: "Contenu UGC (sans post)",
    },
    priceBands: "Fourchette budgétaire",
    allPriceBands: "Tous les budgets",
    priceBandOptions: {
      lt_200: "Moins de 200 €",
      "200_500": "200 € – 500 €",
      "500_1000": "500 € – 1 000 €",
      "1000_2500": "1 000 € – 2 500 €",
      "2500_5000": "2 500 € – 5 000 €",
      gte_5000: "5 000 € et plus",
    },
    currency: "Devise",
    badges: "Vérifications certifiées",
    badgeOptions: {
      account_verified: "Identité vérifiée",
      audience_verified: "Audience certifiée (< 90j)",
    },
  },
  kAnonymity: {
    underThresholdTitle: "Résultats protégés par le k-anonymat",
    underThresholdMessage:
      "Votre recherche est trop précise pour être affichée. Élargissez un critère, ou demandez une sélection à l'équipe INFLUX.",
    broadenSuggestionsTitle: "Suggestions d'élargissement recommandées :",
    suggestions: {
      remove_price_filter: "Retirer le filtre de tarif",
      broaden_audience_band: "Élargir la tranche d'audience",
      add_neighbor_country: "Ajouter un pays voisin",
      add_more_formats: "Sélectionner plus de formats",
    },
    requestTeamSelectionButton:
      "Demander une sélection sur mesure à l'équipe INFLUX",
    rangeCountSuffix: "créateurs disponibles",
    countBands: {
      zero: "Aucun résultat",
      under_k: "Moins de 5 créateurs",
      "5_9": "5 à 9 créateurs",
      "10_24": "10 à 24 créateurs",
      "25_49": "25 à 49 créateurs",
      "50_plus": "50 créateurs ou plus",
    },
  },
  card: {
    verifiedIdentity: "Identité vérifiée",
    verifiedAudience: "Audience vérifiée",
    verifiedDate: "Vérifié le",
    primaryAudience: "Audience principale",
    indicativeCost: "Coût indicatif",
    costExplanation: "Coût total annonceur (commission 35% incluse)",
    availability: "Disponibilité déclarée",
    availabilityDeclared: "Déclarée le",
    portfolioPreview: "Extrait de portfolio approuvé",
    proposedBecause: "Proposé car",
    vigilancePoint: "Point de vigilance",
    alreadyIntroduced: "Déjà en relation avec votre marque",
    requestPending: "Demande en cours d'arbitrage",
    detailsButton: "Consulter la fiche",
    shortlistButton: "Sélection",
    introduceButton: "Demander mise en relation",
    introductionRequested: "Demande envoyée",
    relationActive: "Conversation active",
  },
  explanations: {
    topic_match: "Thématique parfaitement alignée",
    audience_country_match: "Forte concentration d'audience cible",
    price_fit: "Budget adapté à vos critères",
    format_match: "Formats de contenu correspondants",
    verified_badge: "Audience certifiée par l'équipe INFLUX",
    availability_match: "Disponibilité immédiate pour votre calendrier",
    campaign_match: "Correspondance forte avec votre brief de campagne",
  },
  vigilanceWarnings: {
    stale_figures:
      "Chiffres d'audience déclarés il y a plus de 90 jours non rafraîchis.",
    recent_profile:
      "Nouveau profil inscrit il y a moins de 30 jours sur INFLUX.",
    expired_audience_badge:
      "Badge d'audience en attente de renouvellement périodique.",
    other_currency: "Tarifs initialement établis dans une devise différente.",
    declared_full: "Créateur se déclarant actuellement complet sur la période.",
  },
  detailModal: {
    title: "Fiche anonymisée du créateur",
    close: "Fermer",
    aliasContext: "Identifiant plateforme et secteur",
    shortTitle: "Présentation modérée",
    networksAudience: "Réseaux et audiences certifiées",
    pricingOffers: "Grille tarifaire et formats disponibles",
    format: "Format",
    costBand: "Fourchette de coût total annonceur",
    usageRights: "Droits d'utilisation",
    exclusivity: "Exclusivité",
    deliveryTime: "Délai de livraison moyen",
    portfolioTitle: "Portfolio de réalisations approuvées",
    noPortfolio: "Aucun visuel public pour le moment.",
    audienceDemographics: "Démographie de l'audience",
    mainCountry: "Concentration géographique",
    ageDistribution: "Répartition par âge",
    genderDistribution: "Répartition par genre",
    declaredAvailability: "Disponibilité",
    actionsTitle: "Actions d'intermédiation",
  },
  shortlistModal: {
    title: "Ajouter à ma sélection",
    subtitle:
      "Conservez ce profil dans une liste privée pour comparer avant de contacter.",
    selectExisting: "Choisir une liste existante :",
    createNew: "Ou créer une nouvelle sélection :",
    namePlaceholder: "Ex. Sélection Campagne Printemps",
    optionalNote: "Note interne personnelle (optionnel) :",
    notePlaceholder: "Ex. Idéal pour le format reel produit...",
    cancel: "Annuler",
    save: "Enregistrer dans la sélection",
    savedSuccess: "Profil ajouté à votre sélection !",
  },
  teamSelectionModal: {
    title: "Demander une sélection à l'équipe INFLUX",
    subtitle:
      "Nos commerciaux sélectionnent pour vous les meilleurs créateurs correspondant à votre brief sous 24h ouvrées.",
    slaNotice: "Engagement de service : Réponse garantie sous 1 jour ouvré.",
    activeFiltersSummary: "Critères actuellement appliqués :",
    briefNotes: "Précisez vos attentes ou votre calendrier (optionnel) :",
    briefPlaceholder:
      "Ex. Nous préparons un lancement produit bio pour mi-novembre, nous recherchons 3 créateurs authentiques...",
    cancel: "Annuler",
    submit: "Transmettre ma demande à l'équipe",
    submittedSuccess:
      "Votre demande a bien été transmise à notre équipe commerciale !",
  },
  introductionModal: {
    title: "Demander une mise en relation",
    subtitle:
      "Un commercial INFLUX prend en charge votre demande, contacte le créateur et anime la conversation à trois.",
    coachedNotice:
      "INFLUX est une marketplace courtée : aucune mise en relation directe n'a lieu sans un commercial dédié qui sécurise les tarifs et livrables.",
    slaNotice: "Délai de traitement commercial : 1 jour ouvré.",
    linkCampaign: "Associer à l'une de vos campagnes (optionnel) :",
    noneCampaign: "Aucune campagne associée (mise en relation libre)",
    messageNote: "Message d'introduction pour le créateur :",
    messagePlaceholder:
      "Présentez brièvement votre marque et votre proposition de collaboration...",
    cancel: "Annuler",
    sendRequest: "Envoyer la demande de mise en relation",
    sentSuccess: "Demande enregistrée ! Un commercial va prendre contact.",
  },
  warnings: {
    authRequiredTitle: "Authentification requise",
    authRequiredMessage:
      "Vous devez être connecté avec un compte annonceur pour rechercher et consulter les créateurs.",
    loginButton: "Se connecter",
    demoLoginButton: "Connexion rapide Démo (Maison Solène)",
    profileNotPublishedTitle: "Profil marque non publié",
    profileNotPublishedMessage:
      "Conformément aux règles de la plateforme (RG1), le catalogue de créateurs est réservé aux marques dont le profil entreprise a été complété et publié.",
    completeProfileButton: "Compléter mon profil marque",
    contactTeamButton: "Contacter l'équipe commerciale",
    rateLimitExceeded:
      "Limite de requêtes de recherche atteinte. Veuillez patienter quelques instants.",
    profileOpenLimitExceeded:
      "Plafond de consultation de profils atteint pour aujourd'hui (60 profils/jour).",
  },
  pagination: {
    page: "Page",
    of: "sur",
    previous: "Précédent",
    next: "Suivant",
  },
  devTools: {
    title: "Outils de démonstration & Dev",
    seedExtraCreators: "Générer 4 créateurs démo (k ≥ 5)",
    seededSuccess: "Créateurs générés ! Rechargez pour voir les cartes.",
    currentCount: "Profils en base :",
  },
};

const EN: SearchLabels = {
  pageTitle: "Creator Search",
  pageSubtitle:
    "Explore our directory of anonymized creators based on your criteria, themes, and budgets.",
  searchPlaceholder: "Search by topic, format or keyword...",
  resetFilters: "Reset filters",
  applyFilters: "Apply",
  filterByCampaign: "Associated campaign",
  campaignBridgeApplied: "Filters pre-filled from campaign brief",
  sortLabel: "Sort by",
  sortBy: {
    default: "INFLUX Relevance (Recommended)",
    audience_desc: "Largest audience",
    price_asc: "Lowest indicative price",
    verified_first: "Verified profiles first",
    new_profiles: "New profiles (< 30d)",
  },
  facets: {
    title: "Filters & Criteria",
    primaryTopic: "Primary topic",
    allTopics: "All topics",
    topics: {
      beaute: "Beauty & Cosmetics",
      lifestyle: "Lifestyle & Daily life",
      tech: "Tech & Hardware",
      gaming: "Gaming & Video games",
      food: "Food & Cooking",
      travel: "Travel & Adventure",
      mode: "Fashion & Apparel",
      fitness: "Fitness & Wellness",
      design: "Design & Interior",
      sante: "Health & Nutrition",
    },
    networks: "Social networks",
    networkOptions: {
      instagram: "Instagram",
      tiktok: "TikTok",
      youtube: "YouTube",
      linkedin: "LinkedIn",
      pinterest: "Pinterest",
    },
    audienceBands: "Audience size",
    allAudienceBands: "All sizes",
    audienceBandOptions: {
      nano: "Nano (1k – 10k followers)",
      micro: "Micro (10k – 50k followers)",
      mid: "Mid (50k – 100k followers)",
      macro: "Macro (100k – 500k followers)",
      mega: "Mega (500k+ followers)",
    },
    engagementBands: "Engagement rate",
    allEngagementBands: "All levels",
    engagementBandOptions: {
      low: "Moderate (< 1%)",
      standard: "Standard (1% – 3%)",
      high: "High (3% – 5%)",
      very_high: "Very high (5%+)",
    },
    audienceCountry: "Primary audience country",
    allCountries: "All countries",
    countries: {
      FR: "France",
      BE: "Belgium",
      CH: "Switzerland",
      CA: "Canada",
      US: "United States",
      UK: "United Kingdom",
      DE: "Germany",
      ES: "Spain",
    },
    formats: "Desired formats",
    formatOptions: {
      post: "Photo post / Carousel",
      reel: "Reel / Short video",
      story: "Story (24h)",
      video_dedicated: "Long dedicated video",
      short_video: "Short / TikTok",
      ugc: "UGC content (no posting)",
    },
    priceBands: "Indicative budget",
    allPriceBands: "All budgets",
    priceBandOptions: {
      lt_200: "Under 200 €",
      "200_500": "200 € – 500 €",
      "500_1000": "500 € – 1,000 €",
      "1000_2500": "1,000 € – 2,500 €",
      "2500_5000": "2,500 € – 5,000 €",
      gte_5000: "5,000 € and more",
    },
    currency: "Currency",
    badges: "Certified verifications",
    badgeOptions: {
      account_verified: "Identity verified",
      audience_verified: "Audience verified (< 90d)",
    },
  },
  kAnonymity: {
    underThresholdTitle: "Results protected by k-anonymity",
    underThresholdMessage:
      "Your search is too specific to be displayed. Broaden a criterion, or request a curated selection from the INFLUX team.",
    broadenSuggestionsTitle: "Suggested filter adjustments:",
    suggestions: {
      remove_price_filter: "Remove price filter",
      broaden_audience_band: "Broaden audience range",
      add_neighbor_country: "Add a neighboring country",
      add_more_formats: "Select more formats",
    },
    requestTeamSelectionButton:
      "Request a bespoke selection from the INFLUX team",
    rangeCountSuffix: "available creators",
    countBands: {
      zero: "No results",
      under_k: "Less than 5 creators",
      "5_9": "5 to 9 creators",
      "10_24": "10 to 24 creators",
      "25_49": "25 to 49 creators",
      "50_plus": "50+ creators",
    },
  },
  card: {
    verifiedIdentity: "Identity verified",
    verifiedAudience: "Audience verified",
    verifiedDate: "Verified on",
    primaryAudience: "Primary audience",
    indicativeCost: "Indicative cost",
    costExplanation: "Total advertiser cost (includes 35% commission)",
    availability: "Declared availability",
    availabilityDeclared: "Declared on",
    portfolioPreview: "Approved portfolio sample",
    proposedBecause: "Suggested because",
    vigilancePoint: "Attention point",
    alreadyIntroduced: "Already in contact with your brand",
    requestPending: "Request pending agent review",
    detailsButton: "View profile",
    shortlistButton: "Shortlist",
    introduceButton: "Request introduction",
    introductionRequested: "Request sent",
    relationActive: "Active conversation",
  },
  explanations: {
    topic_match: "Topic closely aligned with your brief",
    audience_country_match: "High density of target country audience",
    price_fit: "Budget matches your criteria",
    format_match: "Requested content formats offered",
    verified_badge: "Audience audited and certified by INFLUX",
    availability_match: "Immediate availability for your timeline",
    campaign_match: "Strong match with campaign brief",
  },
  vigilanceWarnings: {
    stale_figures:
      "Audience figures declared over 90 days ago without refresh.",
    recent_profile: "New profile registered less than 30 days ago on INFLUX.",
    expired_audience_badge:
      "Audience certification badge awaiting scheduled renewal.",
    other_currency: "Rates originally established in a different currency.",
    declared_full: "Creator currently reports being fully booked.",
  },
  detailModal: {
    title: "Anonymized Creator Profile",
    close: "Close",
    aliasContext: "Platform ID & Industry",
    shortTitle: "Moderated presentation",
    networksAudience: "Networks and audited audiences",
    pricingOffers: "Rate card and available formats",
    format: "Format",
    costBand: "Total advertiser cost band",
    usageRights: "Usage rights",
    exclusivity: "Exclusivity",
    deliveryTime: "Average delivery turnaround",
    portfolioTitle: "Approved portfolio creations",
    noPortfolio: "No public visuals approved yet.",
    audienceDemographics: "Audience demographics",
    mainCountry: "Geographical breakdown",
    ageDistribution: "Age distribution",
    genderDistribution: "Gender distribution",
    declaredAvailability: "Availability",
    actionsTitle: "Intermediation actions",
  },
  shortlistModal: {
    title: "Add to shortlist",
    subtitle:
      "Save this creator in a private list to compare before reaching out.",
    selectExisting: "Select an existing shortlist:",
    createNew: "Or create a new shortlist:",
    namePlaceholder: "e.g. Spring Launch Selection",
    optionalNote: "Internal personal note (optional):",
    notePlaceholder: "e.g. Great fit for organic product reel...",
    cancel: "Cancel",
    save: "Save to shortlist",
    savedSuccess: "Creator added to your shortlist!",
  },
  teamSelectionModal: {
    title: "Request a selection from INFLUX team",
    subtitle:
      "Our commercial agents will curate the best creators matching your brief within 24 business hours.",
    slaNotice: "Service commitment: Guaranteed response within 1 business day.",
    activeFiltersSummary: "Currently applied criteria:",
    briefNotes: "Specific expectations or timeline (optional):",
    briefPlaceholder:
      "e.g. We are preparing an organic beauty launch for mid-November, looking for 3 authentic creators...",
    cancel: "Cancel",
    submit: "Send request to INFLUX team",
    submittedSuccess:
      "Your request has been successfully submitted to our commercial team!",
  },
  introductionModal: {
    title: "Request an introduction",
    subtitle:
      "An INFLUX commercial agent will handle your request, reach out to the creator and facilitate the 3-way conversation.",
    coachedNotice:
      "INFLUX is a coached marketplace: all negotiations include a dedicated agent who secures rates, deliverables and contracts.",
    slaNotice: "Turnaround SLA: 1 business day.",
    linkCampaign: "Link to one of your campaigns (optional):",
    noneCampaign: "No campaign linked (open collaboration)",
    messageNote: "Introduction note for the creator:",
    messagePlaceholder:
      "Briefly introduce your brand and collaboration goals...",
    cancel: "Cancel",
    sendRequest: "Send introduction request",
    sentSuccess: "Request recorded! An agent will be in touch shortly.",
  },
  warnings: {
    authRequiredTitle: "Authentication required",
    authRequiredMessage:
      "You must be signed in with an advertiser account to search and explore creators.",
    loginButton: "Sign in",
    demoLoginButton: "Quick Demo Sign-in (Maison Solène)",
    profileNotPublishedTitle: "Brand profile not published",
    profileNotPublishedMessage:
      "According to platform rules (RG1), creator search is reserved for brands whose company profile is complete and published.",
    completeProfileButton: "Complete brand profile",
    contactTeamButton: "Contact commercial team",
    rateLimitExceeded:
      "Search rate limit reached. Please wait a moment before trying again.",
    profileOpenLimitExceeded:
      "Daily profile view limit reached (60 profiles/day).",
  },
  pagination: {
    page: "Page",
    of: "of",
    previous: "Previous",
    next: "Next",
  },
  devTools: {
    title: "Demonstration & Dev Tools",
    seedExtraCreators: "Generate 4 demo creators (k ≥ 5)",
    seededSuccess: "Creators generated! Refresh to view the cards.",
    currentCount: "Creators in store:",
  },
};

export function getSearchLabels(locale: string = "fr"): SearchLabels {
  return locale.toLowerCase().startsWith("en") ? EN : FR;
}
