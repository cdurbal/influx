/**
 * Dictionnaires de labels pour la gestion des campagnes côté Annonceur (FR / EN).
 * Conforme à la règle d'externalisation des chaînes littérales (RG109, CA23).
 */

export interface CampaignLabels {
  common: {
    backToList: string;
    createCampaign: string;
    saveDraft: string;
    savingDraft: string;
    draftSaved: string;
    submitForReview: string;
    submitting: string;
    submittedSuccess: string;
    nextStep: string;
    prevStep: string;
    internalBlockTitle: string;
    internalBlockSubtitle: string;
    previewCreatorButton: string;
    requiredMark: string;
    characters: string;
  };
  steps: {
    step1: string;
    step2: string;
    step3: string;
    step4: string;
    step5: string;
    stepIndicator: string;
  };
  stepTitles: {
    step1: string;
    step2: string;
    step3: string;
    step4: string;
    step5: string;
  };
  step1: {
    titleLabel: string;
    titlePlaceholder: string;
    titleHint: string;
    typeLabel: string;
    summaryLabel: string;
    summaryPlaceholder: string;
    summaryHint: string;
    briefLabel: string;
    briefPlaceholder: string;
    briefHint: string;
    productNameLabel: string;
    productNamePlaceholder: string;
    productCategoryLabel: string;
    keyMessagesLabel: string;
    keyMessagesPlaceholder: string;
    addKeyMessage: string;
    removeKeyMessage: string;
    prohibitionsLabel: string;
    prohibitionsPlaceholder: string;
    prohibitionsHint: string;
    productShippedLabel: string;
    productShippedYes: string;
    productShippedNo: string;
    productValueBandLabel: string;
    productCurrencyLabel: string;
    productKeptLabel: string;
    productKeptYes: string;
    productKeptNo: string;
    productShippingCostLabel: string;
    internalRefLabel: string;
    internalRefPlaceholder: string;
    internalRefHint: string;
  };
  step2: {
    deliverablesTitle: string;
    deliverablesSubtitle: string;
    addDeliverable: string;
    removeDeliverable: string;
    networkLabel: string;
    formatLabel: string;
    quantityLabel: string;
    usageRightsLabel: string;
    usageRightsHint: string;
    usageDurationLabel: string;
    usageTerritoryLabel: string;
    territoryWorldwide: string;
    territorySelected: string;
    exclusivityLabel: string;
    contentDelayLabel: string;
    warningHeavyMediaRights: string;
    warningUgcRequiresRights: string;
  };
  step3: {
    targetCountriesLabel: string;
    targetLanguagesLabel: string;
    targetTopicsLabel: string;
    targetTopicsHint: string;
    targetAudienceBandsLabel: string;
    targetAgeBandsLabel: string;
    targetAgeBandsHint: string;
    targetGenderLabel: string;
    allGenders: string;
    femaleMajority: string;
    maleMajority: string;
  };
  step4: {
    compensationNatureLabel: string;
    minAmountLabel: string;
    maxAmountLabel: string;
    currencyLabel: string;
    budgetTotalInternalLabel: string;
    budgetTotalInternalHint: string;
    creatorsCountLabel: string;
    creatorsCountHint: string;
    creatorViewBoxTitle: string;
    creatorViewBoxTotalNotice: string;
    creatorViewBoxNetNotice: string;
    indicativeRangeNotice: string;
    amountInTextWarning: string;
  };
  step5: {
    applicationDeadlineLabel: string;
    deliveryDeadlineLabel: string;
    deliveryDeadlineHint: string;
    startsOnLabel: string;
    endsOnLabel: string;
    durationMaxHint: string;
    candidateElementsLabel: string;
    applicationCapLabel: string;
    applicationCapPlaceholder: string;
    applicationCapHint: string;
    verifiedOnlyLabel: string;
    verifiedOnlyDescription: string;
    internalNotesLabel: string;
    internalNotesPlaceholder: string;
    sensitiveDeclarationTitle: string;
    sensitiveDeclarationCheckbox: string;
    sensitiveDeclarationRequired: string;
    completenessTitle: string;
    missingFieldsPrefix: string;
    readyToSubmit: string;
  };
  list: {
    pageTitle: string;
    pageSubtitle: string;
    emptyTitle: string;
    emptySubtitle: string;
    createNewButton: string;
    colTitle: string;
    colStatus: string;
    colDates: string;
    colBudget: string;
    colApplications: string;
    colActions: string;
    statusDraft: string;
    statusPendingReview: string;
    statusPublished: string;
    statusPaused: string;
    statusClosed: string;
    statusRejected: string;
    actionEdit: string;
    actionPause: string;
    actionResume: string;
    actionClose: string;
    actionDuplicate: string;
    actionPreview: string;
    confirmCloseTitle: string;
    confirmCloseMessage: string;
    confirmCloseConfirm: string;
    confirmCloseCancel: string;
    activeLimitReached: string;
    rejectionReasonTitle: string;
  };
  previewModal: {
    title: string;
    disclaimer: string;
    close: string;
    perCreatorBudget: string;
    netCreatorEstimated: string;
    deliverables: string;
    rights: string;
    target: string;
    brief: string;
    legalNotice: string;
  };
}

export const FR_CAMPAIGN_LABELS: CampaignLabels = {
  common: {
    backToList: "← Retour à mes campagnes",
    createCampaign: "Nouvelle campagne",
    saveDraft: "Enregistrer le brouillon",
    savingDraft: "Sauvegarde en cours...",
    draftSaved: "Brouillon sauvegardé automatiquement",
    submitForReview: "Soumettre pour validation commerciale",
    submitting: "Soumission en cours...",
    submittedSuccess: "Campagne soumise avec succès !",
    nextStep: "Continuer →",
    prevStep: "← Étape précédente",
    internalBlockTitle: "Interne — Jamais publié aux créateurs",
    internalBlockSubtitle:
      "Ces informations restent strictement confidentielles au sein d'INFLUX.",
    previewCreatorButton: "Aperçu « Ce que voit un créateur »",
    requiredMark: "*",
    characters: "caractères",
  },
  steps: {
    step1: "1. L'offre",
    step2: "2. Livrables",
    step3: "3. Audience",
    step4: "4. Budget",
    step5: "5. Calendrier",
    stepIndicator: "Étape {current} sur {total}",
  },
  stepTitles: {
    step1: "Présentation de l'offre et du produit",
    step2: "Livrables, droits d'usage et exclusivité",
    step3: "Audience ciblée et critères de profil",
    step4: "Rémunération par créateur et budget",
    step5: "Calendrier, modalités et soumission",
  },
  step1: {
    titleLabel: "Titre public de la campagne *",
    titlePlaceholder: "ex. Lancement Gamme Sérum Éclat Automne 2026",
    titleHint: "10 à 140 caractères. Visible de tous les créateurs.",
    typeLabel: "Type d'opération *",
    summaryLabel: "Résumé public *",
    summaryPlaceholder:
      "Décrivez en 2 à 3 phrases l'essence de l'opération, la promesse produit et ce qui donnera envie aux créateurs de candidater...",
    summaryHint:
      "120 à 400 caractères. Visible dès les résultats de recherche.",
    briefLabel: "Brief détaillé *",
    briefPlaceholder:
      "Précisez les attentes, l'histoire de la marque, le ton souhaité, les consignes de tournage, les messages à faire passer...",
    briefHint:
      "300 à 4 000 caractères. Texte brut, aucun lien ni coordonnée directe.",
    productNameLabel: "Produit ou service concerné *",
    productNamePlaceholder: "ex. Sérum Vitamine C Pure & Booster Antioxydant",
    productCategoryLabel: "Catégorie de produit *",
    keyMessagesLabel: "Messages clés (1 à 5 puces)",
    keyMessagesPlaceholder: "ex. Formule 100% naturelle certifiée Bio...",
    addKeyMessage: "+ Ajouter un message clé",
    removeKeyMessage: "Supprimer",
    prohibitionsLabel: "Interdits et points de vigilance",
    prohibitionsPlaceholder:
      "ex. Ne pas citer de marques concurrentes, ne pas faire d'allégations médicales non vérifiées...",
    prohibitionsHint:
      "Ce que vous refusez de voir ou d'entendre. Ne peut pas porter sur la personne du créateur.",
    productShippedLabel: "Un produit physique est-il envoyé au créateur ? *",
    productShippedYes: "Oui, un produit est expédié",
    productShippedNo: "Non, aucun envoi de produit",
    productValueBandLabel: "Tranche de valeur indicative du produit envoyé *",
    productCurrencyLabel: "Devise du produit *",
    productKeptLabel: "Le créateur conserve-t-il le produit ? *",
    productKeptYes: "Oui, le créateur conserve le produit (dotation)",
    productKeptNo: "Non, produit à retourner après réalisation",
    productShippingCostLabel: "Frais d'envoi et de retour éventuel *",
    internalRefLabel: "Référence interne du dossier (optionnelle)",
    internalRefPlaceholder: "ex. MKT-2026-CMP-04",
    internalRefHint: "Strictement interne, invisible des créateurs.",
  },
  step2: {
    deliverablesTitle: "Livrables commandés *",
    deliverablesSubtitle:
      "Définissez précisément les formats et quantités attendus (max 10 lignes distinctes).",
    addDeliverable: "+ Ajouter un livrable",
    removeDeliverable: "Supprimer",
    networkLabel: "Réseau social",
    formatLabel: "Format de contenu",
    quantityLabel: "Quantité (1 à 20)",
    usageRightsLabel: "Droits d'usage demandés *",
    usageRightsHint:
      "Détermine comment votre marque pourra exploiter les contenus créés.",
    usageDurationLabel: "Durée des droits d'usage *",
    usageTerritoryLabel: "Territoire d'exploitation *",
    territoryWorldwide: "Monde entier (mondial)",
    territorySelected: "Pays ciblés uniquement",
    exclusivityLabel: "Exclusivité sectorielle demandée *",
    contentDelayLabel: "Délai de validation des contenus par votre marque *",
    warningHeavyMediaRights:
      "⚠ Achat média illimité et mondial : il s'agit de la condition la plus lourde du marché, qui sera mise en évidence auprès des créateurs.",
    warningUgcRequiresRights:
      "⚠ Pour une campagne UGC (contenu livré à la marque), les droits d'usage ne peuvent pas être « Aucun ».",
  },
  step3: {
    targetCountriesLabel: "Pays visés (max 5) *",
    targetLanguagesLabel: "Langues de diffusion (min 1) *",
    targetTopicsLabel: "Thématiques principales (1 à 3) *",
    targetTopicsHint:
      "Sélectionnez les domaines d'affinité avec votre produit.",
    targetAudienceBandsLabel: "Tranches d'audience recherchées (recommandé)",
    targetAgeBandsLabel: "Tranches d'âge de l'audience visée",
    targetAgeBandsHint:
      "Ciblage d'audience uniquement (18 ans et plus). Aucun mineur.",
    targetGenderLabel: "Genre d'audience ciblé (optionnel)",
    allGenders: "Tous genres confondus",
    femaleMajority: "Majoritairement féminine (> 60%)",
    maleMajority: "Majoritairement masculine (> 60%)",
  },
  step4: {
    compensationNatureLabel: "Nature de la rémunération *",
    minAmountLabel: "Rémunération minimum par créateur *",
    maxAmountLabel: "Rémunération maximum par créateur *",
    currencyLabel: "Devise *",
    budgetTotalInternalLabel:
      "Budget total alloué à cette campagne (optionnel)",
    budgetTotalInternalHint:
      "Votre budget total n'est jamais publié. Seule la fourchette par créateur est visible.",
    creatorsCountLabel: "Nombre de créateurs recherchés *",
    creatorsCountHint: "Entier de 1 à 50 créateurs.",
    creatorViewBoxTitle: "Ce que voit un créateur sur cette campagne :",
    creatorViewBoxTotalNotice:
      "« Ce que la marque paie au total : {min} – {max} {currency} »",
    creatorViewBoxNetNotice:
      "+ sa propre estimation de ce qu'il perçoit, que vous ne voyez pas.",
    indicativeRangeNotice:
      "Fourchette indicative pour cette campagne. Elle ne vaut pas engagement : le montant se négocie dans la conversation.",
    amountInTextWarning:
      "Important : Déclarez tous vos montants dans cette section. Aucun montant ne doit figurer dans le brief texte.",
  },
  step5: {
    applicationDeadlineLabel: "Date limite de candidature des créateurs *",
    deliveryDeadlineLabel:
      "Date limite souhaitée pour la livraison des contenus",
    deliveryDeadlineHint: "Optionnel. À convenir si laissé vide.",
    startsOnLabel: "Date de début de diffusion de la campagne *",
    endsOnLabel: "Date de fin de diffusion de la campagne *",
    durationMaxHint:
      "La durée totale de la campagne ne peut pas dépasser 12 mois.",
    candidateElementsLabel: "Éléments demandés lors de la candidature",
    applicationCapLabel: "Plafond maximum de candidatures (optionnel)",
    applicationCapPlaceholder: "ex. 50",
    applicationCapHint:
      "La campagne se fermera automatiquement une fois ce nombre atteint.",
    verifiedOnlyLabel: "Réservé aux créateurs vérifiés",
    verifiedOnlyDescription:
      "Limiter les candidatures aux créateurs titulaires d'un badge de vérification INFLUX actif.",
    internalNotesLabel: "Notes internes de la marque (optionnel)",
    internalNotesPlaceholder: "Notes de suivi, objectifs internes...",
    sensitiveDeclarationTitle:
      "Attestation légale obligatoire — Secteur sensible :",
    sensitiveDeclarationCheckbox:
      "Je déclare détenir les autorisations nécessaires pour promouvoir ce produit dans les pays visés et respecter les règles de publicité qui s'y appliquent.",
    sensitiveDeclarationRequired:
      "Cette case doit être cochée pour soumettre une campagne dans ce secteur.",
    completenessTitle: "Complétude de la campagne",
    missingFieldsPrefix:
      "Informations obligatoires manquantes avant soumission :",
    readyToSubmit:
      "Votre campagne est complète et prête à être soumise pour validation commerciale.",
  },
  list: {
    pageTitle: "Mes Campagnes",
    pageSubtitle:
      "Gérez vos briefs, suivez l'avancement de la modération et consultez les candidatures reçues.",
    emptyTitle: "Aucune campagne créée pour le moment",
    emptySubtitle:
      "Créez votre premier brief pour démarrer votre recherche de créateurs qualifiés.",
    createNewButton: "+ Créer une campagne",
    colTitle: "Campagne",
    colStatus: "Statut",
    colDates: "Dates & Candidatures",
    colBudget: "Rémunération / créateur",
    colApplications: "Candidatures",
    colActions: "Actions",
    statusDraft: "Brouillon",
    statusPendingReview: "En attente de validation commerciale",
    statusPublished: "Publiée",
    statusPaused: "En pause",
    statusClosed: "Clôturée",
    statusRejected: "Refusée",
    actionEdit: "Modifier",
    actionPause: "Mettre en pause",
    actionResume: "Reprendre",
    actionClose: "Clôturer définitivement",
    actionDuplicate: "Dupliquer",
    actionPreview: "Aperçu créateur",
    confirmCloseTitle: "Clôturer définitivement cette campagne ?",
    confirmCloseMessage:
      "Attention : la clôture est irréversible. La campagne ne sera plus visible et n'acceptera plus aucune candidature. Les mises en relation déjà ouvertes subsisteront.",
    confirmCloseConfirm: "Confirmer la clôture",
    confirmCloseCancel: "Annuler",
    activeLimitReached:
      "Plafond atteint : vous avez déjà 10 campagnes actives. Clôturez une campagne avant d'en créer une nouvelle.",
    rejectionReasonTitle: "Motif de refus par l'équipe INFLUX :",
  },
  previewModal: {
    title: "Aperçu de votre campagne (Vue Créateur)",
    disclaimer:
      "Voici exactement ce que voit un créateur éligible. Vos coordonnées directes et votre budget total interne ne sont jamais communiqués.",
    close: "Fermer l'aperçu",
    perCreatorBudget: "Rémunération proposée par la marque",
    netCreatorEstimated: "Net créateur estimé",
    deliverables: "Livrables attendus",
    rights: "Droits d'usage & Exclusivité",
    target: "Audience & Pays ciblés",
    brief: "Brief de la campagne",
    legalNotice:
      "Cette collaboration est rémunérée ou comporte un produit offert : la publication devra en indiquer le caractère commercial selon les règles du pays.",
  },
};

export const EN_CAMPAIGN_LABELS: CampaignLabels = {
  common: {
    backToList: "← Back to my campaigns",
    createCampaign: "New campaign",
    saveDraft: "Save draft",
    savingDraft: "Saving draft...",
    draftSaved: "Draft automatically saved",
    submitForReview: "Submit for commercial review",
    submitting: "Submitting...",
    submittedSuccess: "Campaign successfully submitted!",
    nextStep: "Continue →",
    prevStep: "← Previous step",
    internalBlockTitle: "Internal — Never published to creators",
    internalBlockSubtitle:
      "This information remains strictly confidential within INFLUX.",
    previewCreatorButton: "Preview 'What a creator sees'",
    requiredMark: "*",
    characters: "characters",
  },
  steps: {
    step1: "1. The Offer",
    step2: "2. Deliverables",
    step3: "3. Audience",
    step4: "4. Budget",
    step5: "5. Timeline",
    stepIndicator: "Step {current} of {total}",
  },
  stepTitles: {
    step1: "Offer and product presentation",
    step2: "Deliverables, usage rights and exclusivity",
    step3: "Target audience and creator criteria",
    step4: "Creator compensation and campaign budget",
    step5: "Timeline, requirements and submission",
  },
  step1: {
    titleLabel: "Campaign public title *",
    titlePlaceholder: "e.g. Pure Glow Serum Autumn 2026 Launch",
    titleHint: "10 to 140 characters. Visible to all creators.",
    typeLabel: "Campaign type *",
    summaryLabel: "Public summary *",
    summaryPlaceholder:
      "Describe in 2-3 sentences the core concept, product promise, and why creators will want to participate...",
    summaryHint: "120 to 400 characters. Shown directly in search results.",
    briefLabel: "Detailed brief *",
    briefPlaceholder:
      "Specify guidelines, brand story, desired tone, filming instructions, key messages...",
    briefHint:
      "300 to 4,000 characters. Plain text, no links or direct contact details.",
    productNameLabel: "Product or service promoted *",
    productNamePlaceholder: "e.g. Pure Vitamin C Serum & Antioxidant Booster",
    productCategoryLabel: "Product category *",
    keyMessagesLabel: "Key messages (1 to 5 bullet points)",
    keyMessagesPlaceholder: "e.g. 100% natural certified organic formula...",
    addKeyMessage: "+ Add key message",
    removeKeyMessage: "Remove",
    prohibitionsLabel: "Dos and Don'ts / Prohibitions",
    prohibitionsPlaceholder:
      "e.g. Do not mention competitor brands, no unverified medical claims...",
    prohibitionsHint:
      "What you refuse to see or hear. Cannot target creator person attributes.",
    productShippedLabel: "Is a physical product shipped to the creator? *",
    productShippedYes: "Yes, product is shipped",
    productShippedNo: "No, no physical product shipped",
    productValueBandLabel: "Indicative product value band *",
    productCurrencyLabel: "Product currency *",
    productKeptLabel: "Does the creator keep the product? *",
    productKeptYes: "Yes, creator keeps the product (gifted)",
    productKeptNo: "No, product must be returned after campaign",
    productShippingCostLabel: "Shipping and return costs *",
    internalRefLabel: "Internal reference ID (optional)",
    internalRefPlaceholder: "e.g. MKT-2026-CMP-04",
    internalRefHint: "Strictly internal, invisible to creators.",
  },
  step2: {
    deliverablesTitle: "Requested deliverables *",
    deliverablesSubtitle:
      "Define exactly the formats and quantities requested (max 10 distinct lines).",
    addDeliverable: "+ Add deliverable",
    removeDeliverable: "Remove",
    networkLabel: "Social network",
    formatLabel: "Content format",
    quantityLabel: "Quantity (1 to 20)",
    usageRightsLabel: "Requested usage rights *",
    usageRightsHint:
      "Determines how your brand can utilize the produced content.",
    usageDurationLabel: "Usage rights duration *",
    usageTerritoryLabel: "Territory *",
    territoryWorldwide: "Worldwide",
    territorySelected: "Targeted countries only",
    exclusivityLabel: "Category exclusivity *",
    contentDelayLabel: "Brand review & validation window *",
    warningHeavyMediaRights:
      "⚠ Unlimited worldwide paid media rights: this is the heaviest condition on the market and will be highlighted to creators.",
    warningUgcRequiresRights:
      "⚠ For UGC campaigns (content delivered to brand), usage rights cannot be 'None'.",
  },
  step3: {
    targetCountriesLabel: "Target countries (max 5) *",
    targetLanguagesLabel: "Content languages (min 1) *",
    targetTopicsLabel: "Main topics (1 to 3) *",
    targetTopicsHint: "Select thematic affinities matching your product.",
    targetAudienceBandsLabel: "Target audience size bands (recommended)",
    targetAgeBandsLabel: "Target audience age bands",
    targetAgeBandsHint: "Audience targeting only (18+). No minor audiences.",
    targetGenderLabel: "Target audience gender (optional)",
    allGenders: "All genders",
    femaleMajority: "Predominantly female (> 60%)",
    maleMajority: "Predominantly male (> 60%)",
  },
  step4: {
    compensationNatureLabel: "Compensation type *",
    minAmountLabel: "Minimum fee per creator *",
    maxAmountLabel: "Maximum fee per creator *",
    currencyLabel: "Currency *",
    budgetTotalInternalLabel: "Total campaign budget (optional)",
    budgetTotalInternalHint:
      "Your total budget is never published. Only the per-creator range is visible.",
    creatorsCountLabel: "Number of creators sought *",
    creatorsCountHint: "Integer between 1 and 50 creators.",
    creatorViewBoxTitle: "What a creator sees on this campaign:",
    creatorViewBoxTotalNotice:
      "“Total amount paid by brand: {min} – {max} {currency}”",
    creatorViewBoxNetNotice:
      "+ their own estimated net earnings, which you do not see.",
    indicativeRangeNotice:
      "Indicative range for this campaign. It is not a commitment: amounts are negotiated in conversation.",
    amountInTextWarning:
      "Important: Declare all amounts here. No amounts should be written in the brief text.",
  },
  step5: {
    applicationDeadlineLabel: "Creator application deadline *",
    deliveryDeadlineLabel: "Target content delivery date",
    deliveryDeadlineHint: "Optional. To be agreed if left empty.",
    startsOnLabel: "Campaign publication start date *",
    endsOnLabel: "Campaign publication end date *",
    durationMaxHint: "Total campaign duration cannot exceed 12 months.",
    candidateElementsLabel: "Requested application elements",
    applicationCapLabel: "Maximum applications cap (optional)",
    applicationCapPlaceholder: "e.g. 50",
    applicationCapHint:
      "The campaign will automatically close once this cap is reached.",
    verifiedOnlyLabel: "Verified creators only",
    verifiedOnlyDescription:
      "Limit applications to creators holding an active verified INFLUX badge.",
    internalNotesLabel: "Brand internal notes (optional)",
    internalNotesPlaceholder: "Follow-up notes, campaign objectives...",
    sensitiveDeclarationTitle:
      "Mandatory legal declaration — Sensitive sector:",
    sensitiveDeclarationCheckbox:
      "I declare that I hold the authorizations required to promote this product in targeted countries and comply with applicable advertising regulations.",
    sensitiveDeclarationRequired:
      "This box must be checked to submit a campaign in this sector.",
    completenessTitle: "Campaign Completeness",
    missingFieldsPrefix: "Mandatory fields missing before submission:",
    readyToSubmit:
      "Your campaign is complete and ready to be submitted for commercial review.",
  },
  list: {
    pageTitle: "My Campaigns",
    pageSubtitle:
      "Manage your briefs, track review progress, and review received applications.",
    emptyTitle: "No campaigns created yet",
    emptySubtitle:
      "Create your first brief to begin connecting with vetted creators.",
    createNewButton: "+ Create a campaign",
    colTitle: "Campaign",
    colStatus: "Status",
    colDates: "Dates & Applications",
    colBudget: "Fee / creator",
    colApplications: "Applications",
    colActions: "Actions",
    statusDraft: "Draft",
    statusPendingReview: "Pending commercial review",
    statusPublished: "Published",
    statusPaused: "Paused",
    statusClosed: "Closed",
    statusRejected: "Rejected",
    actionEdit: "Edit",
    actionPause: "Pause",
    actionResume: "Resume",
    actionClose: "Close permanently",
    actionDuplicate: "Duplicate",
    actionPreview: "Creator preview",
    confirmCloseTitle: "Close this campaign permanently?",
    confirmCloseMessage:
      "Warning: closing is irreversible. The campaign will no longer be visible or accept applications. Already opened conversations remain active.",
    confirmCloseConfirm: "Confirm closure",
    confirmCloseCancel: "Cancel",
    activeLimitReached:
      "Limit reached: you already have 10 active campaigns. Close an active campaign before creating a new one.",
    rejectionReasonTitle: "Rejection reason from INFLUX team:",
  },
  previewModal: {
    title: "Campaign Preview (Creator View)",
    disclaimer:
      "This is exactly what an eligible creator sees. Your direct contact details and total budget are never displayed.",
    close: "Close preview",
    perCreatorBudget: "Brand Total Budget per Creator",
    netCreatorEstimated: "Estimated Creator Net",
    deliverables: "Expected Deliverables",
    rights: "Usage Rights & Exclusivity",
    target: "Target Audience & Countries",
    brief: "Campaign Brief",
    legalNotice:
      "This collaboration is paid or includes a gifted product: posts must disclose commercial nature according to local regulations.",
  },
};

export function getCampaignLabels(locale?: string): CampaignLabels {
  return locale === "en" ? EN_CAMPAIGN_LABELS : FR_CAMPAIGN_LABELS;
}
