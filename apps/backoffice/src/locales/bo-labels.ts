/**
 * Libellés externalisés du backoffice INFLUX (D28, D36, 15 §L, 17b §0)
 * Valeur d'attente : français (FR) avec support préparé pour l'anglais (EN).
 */

export interface BackofficeLabels {
  nav: {
    dashboard: string;
    queues: string;
    accounts: string;
    creatorSearch: string;
    deals: string;
    alerts: string;
    admin: string;
  };
  env: {
    nonProdBanner: string;
  };
  verificationQueue: {
    title: string;
    subtitle: string;
    refresh: string;
    refreshing: string;
    tabCreators: string;
    tabBrands: string;
    metrics: {
      pending: string;
      inReview: string;
      slaBreached: string;
      oldestPending: string;
      oldestNone: string;
    };
    filters: {
      status: string;
      allStatuses: string;
      pending: string;
      inReview: string;
      approved: string;
      rejected: string;
      level: string;
      allLevels: string;
      ownership: string;
      audience: string;
      network: string;
      allNetworks: string;
      displayedCount: string;
    };
    table: {
      colSubmission: string;
      colNetwork: string;
      colLevel: string;
      colCreator: string;
      colStatus: string;
      colSla: string;
      colActions: string;
      actionInspect: string;
    };
    sla: {
      overdue: string;
      onTime: string;
    };
    empty: {
      emptyQueue: string;
      emptyFiltered: string;
      loading: string;
      error: string;
    };
    pagination: {
      prev: string;
      next: string;
      pageInfo: string;
    };
  };
  decisionDrawer: {
    ownershipTitle: string;
    audienceTitle: string;
    close: string;
    releaseLock: string;
    lockClaimedByMe: string;
    lockClaimedByOther: string;
    lockUnclaimed: string;
    lockHelpClaimedByMe: string;
    lockHelpClaimedByOther: string;
    evidenceSectionTitle: string;
    creatorAccount: string;
    targetNetwork: string;
    submissionDate: string;
    slaDeadline: string;
    ownershipInstructionsTitle: string;
    ownershipInstruction1: string;
    ownershipInstruction2: string;
    ownershipInstruction3: string;
    evidenceScreenshotsTitle: string;
    noEvidenceAttached: string;
    openEvidence: string;
    openEvidenceLogged: string;
    decisionSectionTitle: string;
    tabApprove: string;
    tabReject: string;
    observedHandleLabel: string;
    observedHandlePlaceholder: string;
    observedRefLabel: string;
    observedRefPlaceholder: string;
    observedFollowersLabel: string;
    observedFollowersPlaceholder: string;
    observedPeriodStartLabel: string;
    observedPeriodEndLabel: string;
    observedEngagementLabel: string;
    rejectionReasonLabel: string;
    rejectionMessageToCreator: string;
    agentCommentLabel: string;
    agentCommentPlaceholder: string;
    btnApproveOwnership: string;
    btnApproveAudience: string;
    btnReject: string;
    btnSaving: string;
    audienceDisclaimer1: string;
    audienceDisclaimer2: string;
  };
  identifiedSearch: {
    title: string;
    subtitle: string;
    bannerWarning: string;
    bannerDetail: string;
    campaignBridgeBadge: string;
    clearBridge: string;
    selectionCounter: string;
    maxSelection: string;
    table: {
      colSelect: string;
      colCreator: string;
      colTopicNetwork: string;
      colAudience: string;
      colPrice: string;
      colBadges: string;
      colStatus: string;
      colActions: string;
      actionInspect: string;
      actionAccount: string;
      blockedWarning: string;
    };
    filters: {
      allTopics: string;
      allNetworks: string;
      allStatuses: string;
      statusPublished: string;
      statusDraft: string;
      statusPending: string;
      statusRejected: string;
      statusSuspended: string;
      reset: string;
    };
    proposalModal: {
      title: string;
      subtitle: string;
      selectedCount: string;
      campaignLabel: string;
      selectCampaignPlaceholder: string;
      reasonLabel: string;
      reasonPlaceholder: string;
      reasonHelp: string;
      btnCancel: string;
      btnSubmit: string;
      submitting: string;
      successMessage: string;
    };
    empty: {
      noResults: string;
      noResultsFilters: string;
      loading: string;
      error: string;
    };
  };
  campaignQueue: {
    title: string;
    subtitle: string;
    refresh: string;
    refreshing: string;
    metrics: {
      pending: string;
      sensitive: string;
      inReview: string;
      oldestPending: string;
      oldestNone: string;
    };
    filters: {
      status: string;
      allStatuses: string;
      pending: string;
      published: string;
      rejected: string;
      sensitive: string;
      allSectors: string;
      sensitiveOnly: string;
      searchPlaceholder: string;
      displayedCount: string;
    };
    table: {
      colAge: string;
      colBrand: string;
      colTitle: string;
      colCategory: string;
      colBudget: string;
      colStatus: string;
      colActions: string;
      actionInspect: string;
    };
    empty: {
      emptyQueue: string;
      emptyFiltered: string;
      loading: string;
      error: string;
    };
  };
  campaignDecisionDrawer: {
    title: string;
    sensitiveBadge: string;
    sensitiveNotice: string;
    duplicateNotice: string;
    brandSectionTitle: string;
    campaignSectionTitle: string;
    briefSectionTitle: string;
    controlsSectionTitle: string;
    decisionSectionTitle: string;
    responsibleAgentLabel: string;
    responsibleAgentHelp: string;
    dualReviewHelp: string;
    btnTransmitSecond: string;
    btnPublish: string;
    btnReject: string;
    btnConfirmReject: string;
    rejectionReasonLabel: string;
    agentCommentLabel: string;
    agentCommentPlaceholder: string;
    close: string;
    releaseLock: string;
    btnSaving: string;
  };
}

export const BO_LABELS_FR: BackofficeLabels = {
  nav: {
    dashboard: "Tableau de bord",
    queues: "Files",
    accounts: "Comptes",
    creatorSearch: "Créateurs",
    deals: "Affaires",
    alerts: "Alertes",
    admin: "Administration",
  },
  env: {
    nonProdBanner: "ENVIRONNEMENT : DÉVELOPPEMENT LOCAL (SIMULATION)",
  },
  verificationQueue: {
    title: "File d'attribution des badges & vérifications",
    subtitle:
      "Validation des preuves de propriété de compte (Niveau 1) et d'audience (Niveau 2) · SLA 1 jour ouvré",
    refresh: "Rafraîchir",
    refreshing: "Actualisation...",
    tabCreators: "Créateurs",
    tabBrands: "Marques",
    metrics: {
      pending: "En Attente",
      inReview: "En Cours (Verrou 30 min)",
      slaBreached: "Hors Délai SLA (> 1j ouvré)",
      oldestPending: "Plus Ancienne en Attente",
      oldestNone: "—",
    },
    filters: {
      status: "Statut :",
      allStatuses: "Tous les statuts",
      pending: "En attente",
      inReview: "En cours",
      approved: "Approuvées",
      rejected: "Refusées",
      level: "Niveau :",
      allLevels: "Tous les niveaux",
      ownership: "Niveau 1 (Propriété)",
      audience: "Niveau 2 (Audience)",
      network: "Réseau :",
      allNetworks: "Tous les réseaux",
      displayedCount: "demande(s) affichée(s)",
    },
    table: {
      colSubmission: "Soumission / Ancienneté",
      colNetwork: "Réseau",
      colLevel: "Niveau Demandé",
      colCreator: "Créateur",
      colStatus: "Statut / Verrou",
      colSla: "Échéance SLA",
      colActions: "Actions",
      actionInspect: "Examiner ▮",
    },
    sla: {
      overdue: "HORS DÉLAI (en retard de {hours} h)",
      onTime: "À l'heure",
    },
    empty: {
      emptyQueue: "Aucune demande de vérification en attente.",
      emptyFiltered:
        "Aucune demande ne correspond aux critères de filtre sélectionnés.",
      loading: "Chargement de la file...",
      error:
        "La file n'a pas pu être chargée. Erreur de communication serveur.",
    },
    pagination: {
      prev: "← Précédent",
      next: "Suivant →",
      pageInfo: "Page {page} sur {totalPages} ({total} au total)",
    },
  },
  decisionDrawer: {
    ownershipTitle: "Niveau 1 : Propriété Compte",
    audienceTitle: "Niveau 2 : Audience Vérifiée",
    close: "Fermer",
    releaseLock: "Relâcher le verrou (retour en file) ‹l›",
    lockClaimedByMe: "✓ Verrou actif posé par vous (30 min)",
    lockClaimedByOther: "🔒 En cours de traitement par {agentName}",
    lockUnclaimed:
      "○ Demande libre — prise en charge automatique à l'ouverture",
    lockHelpClaimedByMe:
      "Vous disposez de l'exclusivité sur cette entrée pour enregistrer la décision.",
    lockHelpClaimedByOther:
      "Les actions sont bloquées pour éviter tout double traitement.",
    evidenceSectionTitle: "1. Données de la demande & Preuves",
    creatorAccount: "Compte créateur :",
    targetNetwork: "Réseau cible :",
    submissionDate: "Date de soumission :",
    slaDeadline: "Échéance SLA (1j ouvré) :",
    ownershipInstructionsTitle: "Procédure de constat en ligne :",
    ownershipInstruction1:
      "1. Ouvrez le profil public du réseau sans être connecté.",
    ownershipInstruction2:
      "2. Constatez la présence du code de vérification dans la biographie.",
    ownershipInstruction3:
      "3. Saisissez ci-dessous l'identifiant exact du compte observé en ligne.",
    evidenceScreenshotsTitle:
      "Captures d'écran du tableau de bord ({count} fichier(s)) :",
    noEvidenceAttached: "Aucune pièce jointe transmise.",
    openEvidence: "Ouvrir ▮",
    openEvidenceLogged: "consultation journalisée",
    decisionSectionTitle: "2. Décision de l'agent",
    tabApprove: "✓ Accorder le badge ‹v›",
    tabReject: "⚠ Refuser la demande ‹r›",
    observedHandleLabel: "Identifiant @ constaté en ligne *",
    observedHandlePlaceholder: "ex. @LucasTechFR",
    observedRefLabel: "Identifiant interne de plateforme (optionnel)",
    observedRefPlaceholder: "ex. UC123456789",
    observedFollowersLabel: "Nombre d'abonnés constaté sur la pièce *",
    observedFollowersPlaceholder: "ex. 85000",
    observedPeriodStartLabel: "Début de période affichée (YYYY-MM-DD) *",
    observedPeriodEndLabel: "Fin de période affichée (≤ 30 jours) *",
    observedEngagementLabel: "Taux d'engagement constaté en % (optionnel)",
    rejectionReasonLabel: "Motif de refus typé (liste fermée) *",
    rejectionMessageToCreator: "Message transmis au créateur :",
    agentCommentLabel:
      "Commentaire complémentaire de l'agent (obligatoire si motif Autre)",
    agentCommentPlaceholder: "Précisions internes ou motifs...",
    btnApproveOwnership: "Valider Badge Niveau 1 (Propriété)",
    btnApproveAudience: "Valider Badge Niveau 2 (Audience 90 jours)",
    btnReject: "Confirmer le Refus",
    btnSaving: "Enregistrement...",
    audienceDisclaimer1:
      "Le badge Audience expire 90 jours après la date de fin de la période observée. Le créateur sera prévenu à J-15.",
    audienceDisclaimer2:
      "Ce badge n'affirme ni l'authenticité des abonnés, ni la performance.",
  },
  identifiedSearch: {
    title: "Recherche de créateurs en vue identifiée",
    subtitle:
      "Annuaire complet avec données réelles pour préparer les propositions commerciales INFLUX et qualifier les opportunités.",
    bannerWarning: "VUE IDENTIFIÉE",
    bannerDetail:
      "Vous voyez les vrais noms, pseudos, @handles, liens et chiffres exacts. La marque ne voit rien de tout cela. Vos recherches et consultations sont journalisées nominativement.",
    campaignBridgeBadge: "Pré-rempli depuis la campagne",
    clearBridge: "Vider le pré-remplissage",
    selectionCounter: "{count} sélectionné(s) / 20 max",
    maxSelection: "Plafond atteint (20 créateurs max)",
    table: {
      colSelect: "Sélection",
      colCreator: "Créateur & Identité réelle",
      colTopicNetwork: "Thématique & Réseau",
      colAudience: "Audience exacte",
      colPrice: "Tarif",
      colBadges: "Badges",
      colStatus: "Statut profil",
      colActions: "Actions",
      actionInspect: "Inspecter ▮",
      actionAccount: "Fiche compte ↗",
      blockedWarning: "Vous ne pouvez pas proposer ce créateur à cette marque.",
    },
    filters: {
      allTopics: "Toutes les thématiques",
      allNetworks: "Tous les réseaux",
      allStatuses: "Tous les statuts de profil",
      statusPublished: "Publié",
      statusDraft: "Brouillon",
      statusPending: "En attente",
      statusRejected: "Refusé",
      statusSuspended: "Suspendu",
      reset: "Réinitialiser",
    },
    proposalModal: {
      title: "Faire une Proposition INFLUX",
      subtitle:
        "Initier directement une opportunité de mise en relation entre la marque et les créateurs sélectionnés.",
      selectedCount: "Créateur(s) sélectionné(s) : {count}",
      campaignLabel: "Campagne cible *",
      selectCampaignPlaceholder: "Sélectionnez une campagne active...",
      reasonLabel: "Motif d'accompagnement commercial (origin_reason) *",
      reasonPlaceholder:
        "Expliquez pourquoi ces créateurs correspondent au brief de la marque (10 caractères minimum)...",
      reasonHelp:
        "Ce motif sera consigné dans l'historique d'intermédiation et visible dans la conversation à trois.",
      btnCancel: "Annuler",
      btnSubmit: "Créer les propositions INFLUX",
      submitting: "Création des mises en relation...",
      successMessage:
        "Proposition INFLUX enregistrée ! Les opportunités de mise en relation sont créées.",
    },
    empty: {
      noResults: "Aucun créateur trouvé dans l'annuaire.",
      noResultsFilters: "Aucun créateur ne correspond à ces critères.",
      loading: "Chargement de la recherche identifiée...",
      error: "Erreur lors du chargement des créateurs.",
    },
  },
  campaignQueue: {
    title: "File de modération commerciale des campagnes (File 7)",
    subtitle:
      "Validation préalable des briefs, dotations et contrôles des secteurs sensibles · SLA 1 jour ouvré (2 jours en revue renforcée)",
    refresh: "Rafraîchir",
    refreshing: "Actualisation...",
    metrics: {
      pending: "En Attente de Validation",
      sensitive: "Revue Renforcée (Sensibles)",
      inReview: "En Cours (Verrou 30 min)",
      oldestPending: "Plus Ancienne en Attente",
      oldestNone: "—",
    },
    filters: {
      status: "Statut :",
      allStatuses: "Tous les statuts",
      pending: "À valider",
      published: "Publiée",
      rejected: "Refusée",
      sensitive: "Sensibilité :",
      allSectors: "Tous les secteurs",
      sensitiveOnly: "Secteurs sensibles uniquement",
      searchPlaceholder: "Rechercher par titre, catégorie ou marque...",
      displayedCount: "{count} campagne(s) affichée(s)",
    },
    table: {
      colAge: "Ancienneté / Soumission",
      colBrand: "Marque",
      colTitle: "Campagne & Type",
      colCategory: "Catégorie & Secteur",
      colBudget: "Budget par créateur",
      colStatus: "Statut & Verrou",
      colActions: "Actions",
      actionInspect: "Examiner",
    },
    empty: {
      emptyQueue: "Aucune campagne en attente de validation commerciale.",
      emptyFiltered: "Aucune campagne ne correspond aux critères filtrés.",
      loading: "Chargement de la file des campagnes...",
      error: "Erreur lors du chargement des campagnes.",
    },
  },
  campaignDecisionDrawer: {
    title: "Examen & Modération Commerciale de la Campagne",
    sensitiveBadge: "⚠ REVUE RENFORCÉE — Secteur sensible",
    sensitiveNotice:
      "Catégorie de produit sensible : Deux examens distincts sont requis (Admin ou 2 agents distincts - RG85, CA56, CA57).",
    duplicateNotice:
      "Alerte doublon potentiel : la même marque a déjà une campagne au titre similaire (RG95).",
    brandSectionTitle: "La Marque",
    campaignSectionTitle: "La Campagne",
    briefSectionTitle: "Le Brief Détaillé (Texte brut non tronqué)",
    controlsSectionTitle: "Contrôles & Détections Automatiques",
    decisionSectionTitle: "Décision de Modération",
    responsibleAgentLabel: "Commercial responsable *",
    responsibleAgentHelp:
      "Une campagne sans responsable est une campagne que personne ne vendra (AL20, RG97).",
    dualReviewHelp:
      "En tant que 1er examinateur, vous transmettez votre avis motivé au 2nd examinateur.",
    btnTransmitSecond: "Transmettre au 2nd examinateur",
    btnPublish: "Publier la campagne ‹v›",
    btnReject: "Refuser avec motif ‹r›",
    btnConfirmReject: "Confirmer le Refus",
    rejectionReasonLabel: "Motif de refus typé obligatoire (RG90) *",
    agentCommentLabel: "Commentaire d'explication interne ou complémentaire",
    agentCommentPlaceholder: "Précisions ou consignes pour la marque...",
    close: "Fermer ‹Échap›",
    releaseLock: "Relâcher le verrou (retour en file)",
    btnSaving: "Enregistrement de la décision...",
  },
};

export const bo = BO_LABELS_FR;
