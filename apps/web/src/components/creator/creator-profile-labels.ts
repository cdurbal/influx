export type CreatorProfileLabels = {
  statusBanner: {
    title: {
      brouillon: string;
      en_attente: string;
      publie: string;
      refuse: string;
      suspendu: string;
    };
    description: {
      brouillon: string;
      en_attente: string;
      publie: string;
      refuse: string;
      suspendu: string;
    };
    rejectionReasonLabel: string;
    ariaLabel: string;
  };
  rejectionReasons: Record<string, string>;
  layers: {
    publicBadge: string;
    publicDesc: string;
    revealedBadge: string;
    revealedDesc: string;
    internalBadge: string;
    internalDesc: string;
  };
  completeness: {
    heading: string;
    maxScore: string;
    scoreSummary: string;
    missingNotice: string;
    blocks: {
      presentation: string;
      editorial: string;
      networks: string;
      audience: string;
      offers: string;
      portfolio: string;
      trust: string;
      pts: string;
    };
    messages: {
      readyToPublish: string;
      missingPrefix: string;
      missingSuffix: string;
      staleFiguresWarning: string;
      unverifiedEngagementWarning: string;
      noAudienceWarning: string;
    };
  };
  tabs: {
    publicView: string;
    privateCoordinates: string;
    anonymousCardPreview: string;
    ariaLabel: string;
  };
  aliasNotice: {
    title: string;
    body: string;
    contextBadge: string;
  };
  presentation: {
    title: string;
    subtitle: string;
    aliasLabel: string;
    shortTitleLabel: string;
    shortTitleHint: string;
    bioLabel: string;
    bioHint: string;
    moderationWarning: string;
    identifierWarning: string;
    placeholders: {
      shortTitle: string;
      bio: string;
    };
  };
  editorial: {
    title: string;
    subtitle: string;
    primaryTopicLabel: string;
    primaryTopicEmpty: string;
    secondaryTopicsLabel: string;
    secondaryTopicsHint: string;
    toneLabel: string;
    toneHint: string;
    languagesLabel: string;
    countryLabel: string;
    travelScopeLabel: string;
    experienceLabel: string;
    experienceEmpty: string;
  };
  networks: {
    title: string;
    subtitle: string;
    addNetworkBtn: string;
    networkCol: string;
    handleCol: string;
    profileUrlCol: string;
    followersCol: string;
    reachCol: string;
    frequencyCol: string;
    figuresDateCol: string;
    badgeCol: string;
    actionsCol: string;
    unverifiedEngagementNotice: string;
    staleFiguresNotice: string;
    removeNetworkBtn: string;
    primaryBadge: string;
    verifiedAccountBadge: string;
    verifiedAudienceBadge: string;
    placeholders: {
      handle: string;
      profileUrl: string;
      followers: string;
    };
  };
  audience: {
    title: string;
    subtitle: string;
    primaryCountryLabel: string;
    primaryCountryShareLabel: string;
    genderBreakdownLabel: string;
    ageBandsLabel: string;
  };
  rates: {
    title: string;
    subtitle: string;
    rateHintNotice: string;
    notions: {
      totalCostLabel: string;
      totalCostDesc: string;
      influxCommissionLabel: string;
      influxCommissionDesc: string;
      netEstimatedLabel: string;
      netEstimatedDesc: string;
    };
    legalNotice: string;
    addOfferBtn: string;
    removeOfferBtn: string;
    formatLabel: string;
    networkLabel: string;
    priceBandLabel: string;
    deliveryLeadLabel: string;
    exclusivityLabel: string;
    usageRightsTitle: string;
    includedRightsLabel: string;
    optionalRightsLabel: string;
    availabilityLabel: string;
    acceptsGiftsLabel: string;
  };
  portfolio: {
    title: string;
    subtitle: string;
    publicNotice: string;
    uploadBtn: string;
    pendingBadge: string;
    approvedBadge: string;
    rejectedBadge: string;
    captionLabel: string;
    brandNamedLabel: string;
    brandConsentConfirm: string;
    removeVisualBtn: string;
  };
  searchVisibility: {
    title: string;
    description: string;
    toggleLabel: string;
    offWarning: string;
  };
  privateCoords: {
    title: string;
    subtitle: string;
    d40NoticeTitle: string;
    d40NoticeBody: string;
    pseudonymLabel: string;
    pseudonymHint: string;
    cityLabel: string;
    cityHint: string;
    legalFirstNameLabel: string;
    legalLastNameLabel: string;
    emailLabel: string;
    phoneLabel: string;
    postalAddressLabel: string;
    statusLabel: string;
    statusIndividual: string;
    statusPro: string;
    refusedSectorsLabel: string;
    refusedSectorsHint: string;
    placeholders: {
      pseudonym: string;
      city: string;
      legalFirstName: string;
      legalLastName: string;
      email: string;
      phone: string;
      postalAddress: string;
      refusedSectors: string;
    };
  };
  preview: {
    title: string;
    subtitle: string;
    cardBadge: string;
    verifiedAudienceTag: string;
    networksHeading: string;
    ratesSummaryHeading: string;
    portfolioHeading: string;
    reachLabel: string;
    audienceLabel: string;
    noVisuals: string;
  };
  actions: {
    saveDraft: string;
    saving: string;
    savedSuccess: string;
    submitForValidation: string;
    submitting: string;
    submittedSuccess: string;
    fixErrors: string;
    autoSaved: string;
  };
};

export const FR_CREATOR_PROFILE_LABELS: CreatorProfileLabels = {
  statusBanner: {
    title: {
      brouillon: "Profil en cours de rédaction",
      en_attente: "Profil en cours de validation par INFLUX",
      publie: "Profil validé et publié",
      refuse: "Profil refusé — modifications requises",
      suspendu: "Profil temporairement suspendu",
    },
    description: {
      brouillon:
        "Complétez les informations requises pour soumettre votre profil à la validation de notre équipe commerciale.",
      en_attente:
        "Votre profil a été soumis. Notre équipe vérifie vos données sous 1 jour ouvré. Vous recevrez une notification par e-mail.",
      publie:
        "Votre profil est en ligne et consultable de manière anonymisée par les marques qualifiées.",
      refuse:
        "Votre profil n'a pas pu être validé en l'état. Veuillez corriger les éléments signalés ci-dessous puis soumettre à nouveau.",
      suspendu:
        "Votre profil a été temporairement masqué de la recherche. Contactez votre commercial INFLUX pour plus d'informations.",
    },
    rejectionReasonLabel: "Motif du refus :",
    ariaLabel: "Statut du profil",
  },
  rejectionReasons: {
    identifier_in_text:
      "Votre titre ou votre bio contient un identifiant, pseudo ou lien interdit en couche anonyme (RG27).",
    bio_too_short_or_unclear:
      "La bio est trop courte (minimum 150 caractères) ou ne décrit pas assez clairement votre ligne éditoriale.",
    insufficient_portfolio:
      "Le portfolio doit comporter au moins 3 visuels pertinents pour être validé.",
    non_compliant_portfolio:
      "Un ou plusieurs visuels ne respectent pas les consignes d'anonymisation ou de droits de diffusion.",
    inconsistent_handle_or_link:
      "Le compte réseau ou l'URL renseignée est inaccessible ou ne correspond pas au profil déclaré.",
    inconsistent_figures:
      "Les chiffres d'abonnés ou de portée déclarés ne correspondent pas aux métriques constatées.",
    inconsistent_topic:
      "La thématique principale déclarée n'est pas représentative des publications constatées.",
    illicit_or_cgu_violation:
      "Le profil enfreint les Conditions Générales d'Utilisation ou la charte éthique d'INFLUX.",
    age_verification_doubt:
      "Une vérification complémentaire de majorité est requise avant publication.",
    other: "Des ajustements complémentaires sont requis avant publication.",
  },
  layers: {
    publicBadge: "Couche A · Public Anonyme",
    publicDesc: "Visible de toutes les marques inscrites.",
    revealedBadge: "Couche I · Révélé sur accord",
    revealedDesc:
      "Visible uniquement après l'ouverture simultanée d'une mise en relation.",
    internalBadge: "Couche N · Interne INFLUX",
    internalDesc:
      "Strictement confidentiel. Visible uniquement par vous et l'équipe INFLUX.",
  },
  completeness: {
    heading: "Complétude du profil créateur",
    maxScore: "/ 100 pts",
    scoreSummary: "Niveau de complétude factuel basé sur vos saisies réelles.",
    missingNotice: "Informations requises manquantes pour soumettre :",
    blocks: {
      presentation: "Présentation (Titre & Bio)",
      editorial: "Ligne éditoriale & Déplacements",
      networks: "Réseaux sociaux déclarés",
      audience: "Répartition d'audience",
      offers: "Offres & Barème de tarifs",
      portfolio: "Portfolio de visuels",
      trust: "Demande de badge de confiance",
      pts: "pts",
    },
    messages: {
      readyToPublish:
        "Toutes les informations obligatoires sont renseignées. Vous pouvez soumettre votre profil.",
      missingPrefix: "Il manque ",
      missingSuffix: " pour publier votre profil.",
      staleFiguresWarning:
        "Vos chiffres datent de plus de 90 jours : votre profil est positionné plus bas dans les résultats.",
      unverifiedEngagementWarning:
        "Sans taux d'engagement vérifié, ce chiffre n'est pas affiché aux marques (RG48).",
      noAudienceWarning:
        "Sans répartition d'audience par pays, vous n'apparaissez pas quand une marque filtre par pays.",
    },
  },
  tabs: {
    publicView: "Vue Publique Anonyme",
    privateCoordinates: "Coordonnées Privées",
    anonymousCardPreview: "Aperçu Carte Anonyme",
    ariaLabel: "Sections du profil",
  },
  aliasNotice: {
    title: "Votre alias anonyme sécurisé",
    body: "Les marques vous voient sous cet alias tant qu'aucune mise en relation n'est acceptée de part et d'autre. Votre anonymat protège votre négociation.",
    contextBadge: "Libellé de contexte :",
  },
  presentation: {
    title: "1. Présentation publique",
    subtitle:
      "Votre titre et votre bio sont modérés avant publication pour garantir qu'aucun contact direct n'est divulgué.",
    aliasLabel: "Alias de plateforme (attribué à vie)",
    shortTitleLabel: "Titre court descriptif (20 à 120 car.)",
    shortTitleHint:
      "Une phrase percutante décrivant votre niche ou votre style créatif.",
    bioLabel: "Biographie éditoriale (150 à 800 car.)",
    bioHint:
      "Présentez votre univers, vos sujets de prédilection et la valeur apportée à une collaboration.",
    moderationWarning:
      "Important : Ne mentionnez aucun pseudo, @, URL, nom de marque ou coordonnée personnelle (RG27).",
    identifierWarning:
      "Attention : un élément identifiant ou une URL a été détecté dans votre texte. Retirez-le avant soumission.",
    placeholders: {
      shortTitle:
        "ex. Créateur Tech & IA : vulgarisation et tests d'outils productivité",
      bio: "Passionné par l'écosystème technologique, je crée des formats dynamiques et pédagogiques pour décrypter les nouveautés du web, du matériel informatique et de l'intelligence artificielle...",
    },
  },
  editorial: {
    title: "2. Ligne éditoriale & Localisation",
    subtitle:
      "Ces critères permettent aux marques de trouver votre profil via le moteur de recherche à facettes.",
    primaryTopicLabel: "Thématique principale",
    primaryTopicEmpty: "Sélectionnez une thématique",
    secondaryTopicsLabel: "Thématiques secondaires (max. 3)",
    secondaryTopicsHint: "Sélectionnez jusqu'à 3 thématiques complémentaires",
    toneLabel: "Tonalités éditoriales (max. 2)",
    toneHint: "Le style narratif de vos contenus",
    languagesLabel: "Langues de publication",
    countryLabel: "Pays de résidence principal",
    travelScopeLabel: "Disponibilité pour déplacements",
    experienceLabel: "Expérience de partenariats commerciaux",
    experienceEmpty: "Sélectionnez votre niveau d'expérience",
  },
  networks: {
    title: "3. Réseaux sociaux & Métriques",
    subtitle:
      "Indiquez vos comptes officiels. Les poignées (@) et liens ne seront visibles qu'après révélation.",
    addNetworkBtn: "Ajouter un réseau",
    networkCol: "Réseau",
    handleCol: "Handle & URL (Couche I)",
    profileUrlCol: "URL publique",
    followersCol: "Abonnés",
    reachCol: "Portée moyenne",
    frequencyCol: "Fréquence",
    figuresDateCol: "Date métriques",
    badgeCol: "Badges",
    actionsCol: "Actions",
    unverifiedEngagementNotice:
      "Votre taux d'engagement n'est pas affiché aux marques tant qu'il n'a pas été audité par INFLUX (RG48).",
    staleFiguresNotice:
      "Pensez à actualiser vos chiffres au moins tous les 90 jours pour conserver un bon référencement.",
    removeNetworkBtn: "Supprimer",
    primaryBadge: "Principal",
    verifiedAccountBadge: "Compte vérifié",
    verifiedAudienceBadge: "Audience certifiée",
    placeholders: {
      handle: "@moncompte",
      profileUrl: "https://instagram.com/moncompte",
      followers: "ex. 25000",
    },
  },
  audience: {
    title: "4. Répartition de l'audience",
    subtitle:
      "Données issues de vos statistiques officielles (Instagram Insights, YouTube Analytics, etc.).",
    primaryCountryLabel: "Pays où se situe la majorité de votre audience",
    primaryCountryShareLabel: "Part de l'audience dans ce pays",
    genderBreakdownLabel: "Répartition par genre",
    ageBandsLabel: "Tranches d'âge principales",
  },
  rates: {
    title: "5. Barème d'offres & Tarifs indicatifs",
    subtitle:
      "Définissez vos formats et vos tarifs par tranche. Conforme à la règle d'intermédiation INFLUX.",
    rateHintNotice:
      "Indiquez ce que la marque paie au total. Ce que vous percevez s'affiche juste en dessous (RG65).",
    notions: {
      totalCostLabel: "Tarif indicatif",
      totalCostDesc: "Ce que la marque paie au total",
      influxCommissionLabel: "Commission INFLUX (35 %)",
      influxCommissionDesc:
        "20 % à la charge de la marque, 15 % à votre charge",
      netEstimatedLabel: "Net créateur estimé",
      netEstimatedDesc: "Ce que vous percevez, estimation",
    },
    legalNotice:
      "Estimation indicative, calculée sur votre tarif déclaré, aux taux par défaut de la plateforme. Elle ne vaut pas engagement : les taux applicables sont figés au moment de la signature du contrat (RG71).",
    addOfferBtn: "Ajouter un format / tarif",
    removeOfferBtn: "Supprimer cette offre",
    formatLabel: "Format de contenu",
    networkLabel: "Réseau concerné",
    priceBandLabel: "Tranche tarifaire (Coût marque)",
    deliveryLeadLabel: "Délai moyen de livraison",
    exclusivityLabel: "Option d'exclusivité sectorielle",
    usageRightsTitle: "Droits d'usage de la création :",
    includedRightsLabel: "Droits inclus dans le tarif",
    optionalRightsLabel: "Droits en supplément négociable",
    availabilityLabel: "Disponibilité opérationnelle",
    acceptsGiftsLabel:
      "Ouvert aux dotations produits ou contreparties non monétaires",
  },
  portfolio: {
    title: "6. Portfolio de créations",
    subtitle:
      "Déposez 3 à 8 réalisations exemplaires. Les métadonnées EXIF sont automatiquement supprimées (RG80).",
    publicNotice:
      "Vos visuels approuvés sont visibles de toutes les marques inscrites en couche anonyme, avant toute mise en relation (RG85).",
    uploadBtn: "Téléverser une image (PNG / JPEG / WebP, max 5 Mo)",
    pendingBadge: "En cours de modération",
    approvedBadge: "Visuel validé",
    rejectedBadge: "Refusé par modération",
    captionLabel: "Description du travail réalisé",
    brandNamedLabel: "Marque partenaire citée (optionnel)",
    brandConsentConfirm:
      "Je confirme être autorisé à citer cette marque et à publier ce visuel (RG84).",
    removeVisualBtn: "Retirer",
  },
  searchVisibility: {
    title: "7. Paramètres de recherche",
    description:
      "Contrôlez si votre profil anonymisé apparaît dans l'annuaire de recherche des marques.",
    toggleLabel: "Activer la visibilité dans le catalogue public INFLUX",
    offWarning:
      "Vous êtes retiré de la recherche : vous ne recevrez plus de demandes de mise en relation de la part des marques (RG877).",
  },
  privateCoords: {
    title: "Coordonnées Privées & Données Protégées",
    subtitle:
      "Ces informations ne sont jamais publiques. La couche I est révélée à la marque après accord réciproque. La couche N reste strictement interne.",
    d40NoticeTitle: "Protection réciproque des identités (Règle D40 & RG19)",
    d40NoticeBody:
      "Vos coordonnées ne sont débloquées qu'à l'ouverture formelle d'une mise en relation validée par un commercial INFLUX. Les marques respectent la même obligation.",
    pseudonymLabel: "Pseudonyme public (Couche I)",
    pseudonymHint:
      "Nom public d'artiste ou nom de chaîne révélé après mise en relation.",
    cityLabel: "Ville de résidence (Couche I)",
    cityHint: "Révélée à la marque après mise en relation.",
    legalFirstNameLabel: "Prénom légal (Couche N - Interne)",
    legalLastNameLabel: "Nom légal (Couche N - Interne)",
    emailLabel: "Adresse e-mail de contact direct (Couche N)",
    phoneLabel: "Numéro de téléphone mobile (Couche N)",
    postalAddressLabel: "Adresse postale / Siège légal (Couche N)",
    statusLabel: "Statut juridique déclaré",
    statusIndividual: "Particulier / Créateur indépendant",
    statusPro: "Société / Micro-entreprise immatriculée",
    refusedSectorsLabel: "Secteurs d'activité formellement refusés (Couche N)",
    refusedSectorsHint:
      "Les marques de ces secteurs seront silencieusement exclues de vos propositions (RG75).",
    placeholders: {
      pseudonym: "ex. Alex Tech",
      city: "Lyon",
      legalFirstName: "Alexandre",
      legalLastName: "Dupont",
      email: "alexandre.dupont@email.com",
      phone: "+33 6 12 34 56 78",
      postalAddress: "12 rue des Créateurs, 69001 Lyon",
      refusedSectors: "ex. jeux_argent, tabac_vape, alcool",
    },
  },
  preview: {
    title: "Aperçu de votre Carte Anonyme",
    subtitle:
      "Voici très exactement ce qu'une marque inscrite découvre lors de ses recherches dans l'annuaire INFLUX.",
    cardBadge: "Aperçu en conditions réelles",
    verifiedAudienceTag: "Audience Certifiée INFLUX",
    networksHeading: "Présence réseaux & Tranches d'audience",
    ratesSummaryHeading: "Tarifs indicatifs déclarés",
    portfolioHeading: "Réalisations modérées",
    reachLabel: "Abonnés :",
    audienceLabel: "Cible :",
    noVisuals: "Aucun visuel approuvé pour l'instant.",
  },
  actions: {
    saveDraft: "Sauvegarder le brouillon",
    saving: "Sauvegarde en cours...",
    savedSuccess: "Brouillon sauvegardé avec succès.",
    submitForValidation: "Soumettre pour validation",
    submitting: "Soumission en cours...",
    submittedSuccess:
      "Votre profil a été transmis à l'équipe INFLUX. Un commercial examine votre dossier sous 1 jour ouvré.",
    fixErrors:
      "Veuillez corriger les champs requis manquants avant de soumettre.",
    autoSaved: "Enregistrement automatique activé.",
  },
};

export const EN_CREATOR_PROFILE_LABELS: CreatorProfileLabels = {
  statusBanner: {
    title: {
      brouillon: "Draft profile in progress",
      en_attente: "Profile under review by INFLUX",
      publie: "Profile approved and published",
      refuse: "Profile rejected — updates required",
      suspendu: "Profile temporarily suspended",
    },
    description: {
      brouillon:
        "Fill in the required information to submit your profile for review by our commercial team.",
      en_attente:
        "Your profile has been submitted. Our team validates your data within 1 business day. You will receive an email update.",
      publie:
        "Your profile is active and browsable anonymously by vetted brands.",
      refuse:
        "Your profile could not be approved as is. Please fix the highlighted issues below and resubmit.",
      suspendu:
        "Your profile is temporarily hidden from search. Reach out to your INFLUX account manager for assistance.",
    },
    rejectionReasonLabel: "Rejection reason:",
    ariaLabel: "Profile status",
  },
  rejectionReasons: {
    identifier_in_text:
      "Your title or bio contains a handle, username or link forbidden in anonymous layer (RG27).",
    bio_too_short_or_unclear:
      "The bio is too short (min 150 characters) or does not clearly describe your editorial angle.",
    insufficient_portfolio:
      "The portfolio must include at least 3 relevant visuals to be approved.",
    non_compliant_portfolio:
      "One or more visuals do not meet anonymization or copyright guidelines.",
    inconsistent_handle_or_link:
      "The provided social account or URL is inaccessible or doesn't match the profile.",
    inconsistent_figures:
      "Declared follower count or reach numbers do not match observed analytics.",
    inconsistent_topic:
      "The primary topic does not align with your published content.",
    illicit_or_cgu_violation:
      "The profile violates INFLUX Terms of Service or ethical charter.",
    age_verification_doubt:
      "Additional age verification is required before publication.",
    other: "Adjustments are required prior to approval.",
  },
  layers: {
    publicBadge: "Layer A · Anonymous Public",
    publicDesc: "Visible to every registered brand.",
    revealedBadge: "Layer I · Revealed on agreement",
    revealedDesc: "Visible only after a mutual introduction is opened.",
    internalBadge: "Layer N · INFLUX Internal",
    internalDesc:
      "Strictly confidential. Visible only to you and the INFLUX team.",
  },
  completeness: {
    heading: "Creator profile completeness",
    maxScore: "/ 100 pts",
    scoreSummary: "Fact-based completeness score based on actual inputs.",
    missingNotice: "Required information missing before submission:",
    blocks: {
      presentation: "Presentation (Title & Bio)",
      editorial: "Editorial line & Travel",
      networks: "Declared social accounts",
      audience: "Audience distribution",
      offers: "Offers & Rate card",
      portfolio: "Visual portfolio",
      trust: "Trust badge request",
      pts: "pts",
    },
    messages: {
      readyToPublish:
        "All required fields are completed. You can now submit your profile.",
      missingPrefix: "Missing ",
      missingSuffix: " to publish your profile.",
      staleFiguresWarning:
        "Your metrics are older than 90 days: your profile is ranked lower in search results.",
      unverifiedEngagementWarning:
        "Without verified engagement rate, this metric is hidden from brands (RG48).",
      noAudienceWarning:
        "Without audience breakdown by country, you won't appear when brands filter by country.",
    },
  },
  tabs: {
    publicView: "Anonymous Public View",
    privateCoordinates: "Private Coordinates",
    anonymousCardPreview: "Anonymous Card Preview",
    ariaLabel: "Profile sections",
  },
  aliasNotice: {
    title: "Your secure anonymous alias",
    body: "Brands see you under this alias until a mutual introduction is accepted. Your anonymity protects your negotiations.",
    contextBadge: "Context tag:",
  },
  presentation: {
    title: "1. Public Presentation",
    subtitle:
      "Your title and bio are reviewed before publication to ensure no direct contact information is leaked.",
    aliasLabel: "Platform alias (assigned for life)",
    shortTitleLabel: "Short descriptive title (20 to 120 chars)",
    shortTitleHint:
      "A punchy sentence describing your niche or creative style.",
    bioLabel: "Editorial biography (150 to 800 chars)",
    bioHint:
      "Introduce your creative universe, favorite topics, and the value brought to brand partnerships.",
    moderationWarning:
      "Important: Do not include handles, @, URLs, brand names, or personal contact info (RG27).",
    identifierWarning:
      "Warning: an identifier, handle, or URL was detected in your text. Remove it before submission.",
    placeholders: {
      shortTitle:
        "e.g. Tech & AI Creator: product reviews and productivity workflows",
      bio: "Passionate about the digital landscape, I produce engaging and educational content breaking down web trends, hardware, and AI innovations...",
    },
  },
  editorial: {
    title: "2. Editorial Line & Location",
    subtitle:
      "These criteria allow brands to discover your profile through the faceted search engine.",
    primaryTopicLabel: "Primary topic",
    primaryTopicEmpty: "Select a topic",
    secondaryTopicsLabel: "Secondary topics (up to 3)",
    secondaryTopicsHint: "Select up to 3 complementary topics",
    toneLabel: "Editorial tones (up to 2)",
    toneHint: "The storytelling tone of your posts",
    languagesLabel: "Content languages",
    countryLabel: "Primary country of residence",
    travelScopeLabel: "Willingness to travel",
    experienceLabel: "Brand partnership experience",
    experienceEmpty: "Select your experience level",
  },
  networks: {
    title: "3. Social Accounts & Metrics",
    subtitle:
      "Add your official accounts. Handles (@) and profile URLs will only be shared after revelation.",
    addNetworkBtn: "Add social account",
    networkCol: "Platform",
    handleCol: "Handle & URL (Layer I)",
    profileUrlCol: "Public URL",
    followersCol: "Followers",
    reachCol: "Average reach",
    frequencyCol: "Frequency",
    figuresDateCol: "Metrics date",
    badgeCol: "Badges",
    actionsCol: "Actions",
    unverifiedEngagementNotice:
      "Your engagement rate is not displayed to brands until audited by INFLUX (RG48).",
    staleFiguresNotice:
      "Remember to refresh your metrics at least every 90 days to maintain high visibility.",
    removeNetworkBtn: "Remove",
    primaryBadge: "Primary",
    verifiedAccountBadge: "Verified account",
    verifiedAudienceBadge: "Certified audience",
    placeholders: {
      handle: "@myaccount",
      profileUrl: "https://instagram.com/myaccount",
      followers: "e.g. 25000",
    },
  },
  audience: {
    title: "4. Audience Distribution",
    subtitle:
      "Data sourced from your official insights (Instagram Insights, YouTube Studio, etc.).",
    primaryCountryLabel: "Primary country of your audience",
    primaryCountryShareLabel: "Audience share in this country",
    genderBreakdownLabel: "Gender distribution",
    ageBandsLabel: "Top age groups",
  },
  rates: {
    title: "5. Offer Catalog & Indicative Rates",
    subtitle:
      "Define your formats and rates by band. Strictly adheres to the INFLUX intermediation model.",
    rateHintNotice:
      "Enter the total amount the brand pays. What you receive is shown right below (RG65).",
    notions: {
      totalCostLabel: "Indicative rate",
      totalCostDesc: "Total amount paid by the brand",
      influxCommissionLabel: "INFLUX Commission (35%)",
      influxCommissionDesc: "20% paid by the brand, 15% paid by you",
      netEstimatedLabel: "Estimated creator net",
      netEstimatedDesc: "What you receive, estimated",
    },
    legalNotice:
      "Indicative estimate, calculated on your declared rate using default platform tiers. It does not constitute a commitment: actual rates are locked upon contract signature (RG71).",
    addOfferBtn: "Add format / rate",
    removeOfferBtn: "Remove this offer",
    formatLabel: "Content format",
    networkLabel: "Applicable platform",
    priceBandLabel: "Pricing band (Brand cost)",
    deliveryLeadLabel: "Average delivery turnaround",
    exclusivityLabel: "Category exclusivity option",
    usageRightsTitle: "Usage rights for the deliverable:",
    includedRightsLabel: "Rights included in rate",
    optionalRightsLabel: "Rights available as add-on",
    availabilityLabel: "Operational availability",
    acceptsGiftsLabel: "Open to product gifting or non-monetary partnerships",
  },
  portfolio: {
    title: "6. Creative Portfolio",
    subtitle:
      "Upload 3 to 8 portfolio pieces. EXIF metadata is automatically stripped (RG80).",
    publicNotice:
      "Your approved visuals are visible to every registered brand in the anonymous layer, prior to any introduction (RG85).",
    uploadBtn: "Upload an image (PNG / JPEG / WebP, max 5 MB)",
    pendingBadge: "Pending moderation",
    approvedBadge: "Visual approved",
    rejectedBadge: "Rejected by moderation",
    captionLabel: "Description of work done",
    brandNamedLabel: "Brand partner tagged (optional)",
    brandConsentConfirm:
      "I confirm I am authorized to name this brand and share this work (RG84).",
    removeVisualBtn: "Remove",
  },
  searchVisibility: {
    title: "7. Search Preferences",
    description:
      "Control whether your anonymous profile appears in brand discovery searches.",
    toggleLabel: "Enable visibility in INFLUX public directory",
    offWarning:
      "You are hidden from search: you will no longer receive introduction requests from brands (RG877).",
  },
  privateCoords: {
    title: "Private Coordinates & Protected Data",
    subtitle:
      "This information is never public. Layer I is revealed only after mutual introduction. Layer N remains strictly internal.",
    d40NoticeTitle: "Mutual identity protection (Rule D40 & RG19)",
    d40NoticeBody:
      "Your contact details are only unlocked upon formal mutual agreement facilitated by an INFLUX account manager. Brands follow the exact same rule.",
    pseudonymLabel: "Public pseudonym (Layer I)",
    pseudonymHint: "Public artist or channel handle disclosed after matching.",
    cityLabel: "City of residence (Layer I)",
    cityHint: "Disclosed to brand after introduction.",
    legalFirstNameLabel: "Legal first name (Layer N - Internal)",
    legalLastNameLabel: "Legal last name (Layer N - Internal)",
    emailLabel: "Direct contact email (Layer N)",
    phoneLabel: "Mobile phone number (Layer N)",
    postalAddressLabel: "Postal / billing address (Layer N)",
    statusLabel: "Declared legal status",
    statusIndividual: "Individual / Freelance creator",
    statusPro: "Registered company / Agency",
    refusedSectorsLabel: "Formally refused industry sectors (Layer N)",
    refusedSectorsHint:
      "Brands in these sectors will be silently excluded from your opportunities (RG75).",
    placeholders: {
      pseudonym: "e.g. Alex Tech",
      city: "Lyon",
      legalFirstName: "Alexandre",
      legalLastName: "Dupont",
      email: "alexandre.dupont@email.com",
      phone: "+33 6 12 34 56 78",
      postalAddress: "12 rue des Créateurs, 69001 Lyon",
      refusedSectors: "e.g. gambling, tobacco, alcohol",
    },
  },
  preview: {
    title: "Anonymous Card Preview",
    subtitle:
      "This is exactly what a registered brand sees when discovering creators in the INFLUX directory.",
    cardBadge: "Live search preview",
    verifiedAudienceTag: "Certified Audience",
    networksHeading: "Social channels & Audience bands",
    ratesSummaryHeading: "Declared indicative rates",
    portfolioHeading: "Approved portfolio works",
    reachLabel: "Audience:",
    audienceLabel: "Target:",
    noVisuals: "No approved visuals yet.",
  },
  actions: {
    saveDraft: "Save draft",
    saving: "Saving draft...",
    savedSuccess: "Draft saved successfully.",
    submitForValidation: "Submit for review",
    submitting: "Submitting...",
    submittedSuccess:
      "Your profile has been submitted to the INFLUX team. An account manager will review it within 1 business day.",
    fixErrors: "Please fill in all missing required fields before submitting.",
    autoSaved: "Auto-save active.",
  },
};
