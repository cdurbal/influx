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
};

export const bo = BO_LABELS_FR;
