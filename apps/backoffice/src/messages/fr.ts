// Labels of the backoffice. D36 is open: French only, without next-intl (02 §8, 21 §4 J1-E).
// No literal text in JSX: moving to two languages will only replace this module. Sign-in, TOTP
// activation and recovery codes: 17b §3.14 (keys `bo.auth.*`, same wording).
export const messages = {
  metadata: {
    title: "INFLUX — Backoffice",
  },
  brand: "INFLUX — Espace interne",
  // 18 T13 (J9 commit 7): the 404 and error screens, a fixed text without any detail.
  errorPages: {
    notFoundTitle: "Cette page n’existe pas",
    notFoundBody:
      "L’adresse est peut-être incomplète, ou la page a été déplacée.",
    errorTitle: "Un problème est survenu",
    errorBody: "La page n’a pas pu s’afficher. Réessayez dans un instant.",
    retry: "Réessayer",
    home: "Revenir à l’accueil",
  },
  form: {
    required: "Ce champ est obligatoire.",
  },
  login: {
    title: "Connexion à l’espace interne INFLUX",
    lead: "Réservé à l’équipe INFLUX. Munissez-vous de votre application d’authentification.",
    emailLabel: "Adresse e-mail professionnelle",
    passwordLabel: "Mot de passe",
    totpLabel: "Code de l’application d’authentification (6 chiffres)",
    useRecoveryCode: "Utiliser un code de secours",
    recoveryLabel: "Code de secours (16 caractères)",
    recoveryHelp: "Majuscules, espaces et tirets sont indifférents.",
    useTotp: "Utiliser mon application d’authentification",
    submit: "Se connecter",
    submitBusy: "Connexion…",
    firstTime: "Première connexion ? Activez votre second facteur",
    errorGeneric:
      "Connexion impossible. Vérifiez votre adresse, votre mot de passe et votre code, puis réessayez. Si le problème persiste, contactez un administrateur INFLUX.",
  },
  errors: {
    unavailable:
      "L’espace interne est momentanément indisponible. Réessayez dans quelques minutes.",
    totpFormat: "Le code comporte 6 chiffres.",
    recoveryFormat: "Un code de secours comporte 16 lettres et chiffres.",
  },
  enroll: {
    title: "Activer votre second facteur",
    lead: "L’accès à l’espace interne exige un code à 6 chiffres produit par une application d’authentification installée sur votre téléphone. Cette étape est obligatoire avant tout accès.",
    step: (current: number) => `Étape ${current} sur 3`,
    step1Title: "Confirmez votre identité",
    step1Submit: "Continuer",
    errorGeneric:
      "Activation impossible. Vérifiez votre adresse et votre mot de passe, puis réessayez. Si le problème persiste, contactez un administrateur INFLUX.",
    invitationInvalid:
      "Ce lien d’activation n’est plus valable : il a déjà servi ou date de plus de 72 heures. Demandez une nouvelle invitation à un administrateur INFLUX.",
    step2Title: "Associez votre application",
    step2Scan: "Scannez ce code QR avec votre application d’authentification.",
    step2QrAlt: "Code QR d’activation du second facteur INFLUX",
    step2Manual:
      "Impossible de scanner ? Saisissez cette clé dans l’application :",
    step2CodeLabel: "Code à 6 chiffres affiché par l’application",
    step2PasswordLabel: "Mot de passe",
    step2PasswordWhy:
      "Ressaisissez votre mot de passe : tant que le second facteur n’est pas activé, aucune session n’est ouverte, et votre mot de passe n’est pas conservé d’une étape à l’autre.",
    step2Submit: "Activer et me connecter",
    step2ErrorGeneric:
      "Activation impossible. Vérifiez le code affiché par l’application — il change toutes les 30 secondes — et votre mot de passe, puis réessayez.",
    step2Restarted:
      "Un nouveau code QR a été créé. Supprimez de votre application l’entrée INFLUX ajoutée auparavant, puis scannez celui-ci.",
    restartStep1: "Revenir à l’étape 1 et créer un nouveau code QR",
    busy: "Activation…",
  },
  recoveryCodes: {
    title: "Vos 10 codes de secours",
    lead: "Chaque code permet une seule connexion si vous perdez l’accès à votre application d’authentification. Ils ne seront plus jamais affichés.",
    storage:
      "Conservez-les hors ligne : imprimés et rangés, ou dans un gestionnaire de mots de passe. Jamais dans un e-mail, une messagerie ou une capture d’écran.",
    alert:
      "Chaque utilisation d’un code de secours est signalée à tous les administrateurs.",
    listLabel: "Codes de secours",
    copy: "Copier les codes",
    copied: "Codes copiés.",
    print: "Imprimer",
    confirm: "J’ai conservé mes codes de secours en lieu sûr",
    continue: "Accéder à l’espace interne",
    leaveWarning:
      "Si vous quittez cette page, vos codes de secours ne pourront plus être affichés. Quitter quand même ?",
  },
  recoveryBanner: (remaining: number) =>
    `Vous êtes connecté avec un code de secours. Il vous en reste ${
      remaining === 0 ? "aucun" : String(remaining)
    }. Les actions qui demandent une confirmation d’identité sont indisponibles dans cette session : demandez à un administrateur de réinitialiser votre second facteur.`,
  session: {
    ended: "Votre session a pris fin. Reconnectez-vous.",
  },
  logout: {
    busy: "Déconnexion…",
    done: "Vous êtes déconnecté.",
    signInAgain: "Me reconnecter",
  },
  // ---------------------------------------------------------------------------------------------
  // J8 commit 9: the screens of the backoffice v0 (17b §2, §3.11 to §3.13, §3.14.e; 05 §K)
  // ---------------------------------------------------------------------------------------------
  // DS-10 (D73): the rail of 17b §1.2 and §1.7, its entries, then its sub-entries (D74).
  nav: {
    label: "Navigation principale",
    skip: "Aller au contenu",
    dashboard: "Tableau de bord",
    queues: "Files",
    brandReviewQueue: "Profils marque à valider",
    accounts: "Comptes",
    creatorSearch: "Créateurs",
    deals: "Affaires",
    alerts: "Alertes",
    admin: "Administration",
    home: "Accueil",
    signups: "Inscrits",
    memberInvitations: "Invitations",
    dualControl: "Double validation",
    apollo: "Réglages Apollo",
    internalAccounts: "Comptes internes",
    health: "Santé technique",
  },
  /** Names of the queues, key `queue.<code>` of backoffice.queues (15 RG29); L2C: queue 1. */
  queue: {
    profiles_advertiser: "Profils marque à valider",
    verification_creators: "Vérifications des créateurs",
    verification_brands: "Vérifications des marques",
  },
  /** 17b §1.4 and §1.7: the head band, the rail, and the screen of a window too small. */
  shell: {
    name: "INFLUX",
    product: "Backoffice",
    signOut: "Se déconnecter",
    /** The environment, always written; the colour of the band is never alone (16 RG118). */
    environment: {
      production: "PRODUCTION",
      staging: "RECETTE",
      development: "LOCAL",
    },
    identity: (email: string, role: "agent" | "admin") =>
      `${email} · ${role === "admin" ? "administrateur" : "commercial"}`,
    workstationOnly: {
      title: "Le backoffice se consulte sur un poste de travail",
      body: "Cet écran demande une fenêtre d’au moins 768 px de large et 500 px de haut. Sur téléphone, vos conversations et la file de validation seront disponibles à leur mise en service.",
    },
  },
  /**
   * 16 RG118 (D70): the permanent banner of every non-production backoffice, in words. Staging sends
   * for real, like production; development never does (the double, a redirect or nothing).
   */
  environmentBanner: (
    name: "development" | "staging",
    brevoMode: "disabled" | "redirect" | "live",
  ) =>
    name === "staging"
      ? "staging — envois réels"
      : `development — envois : ${
          brevoMode === "redirect"
            ? "redirigés vers les adresses internes"
            : brevoMode === "disabled"
              ? "désactivés"
              : "réels"
        }`,
  /** 15 RG107, CA71: the permanent banner while there are not two distinct active admins. */
  peerControlBanner:
    "Contrôle par les pairs indisponible — les actions sensibles sont confirmées en mode différé.",
  common: {
    loading: "Chargement…",
    retry: "Réessayer",
    cancel: "Annuler",
    copy: "Copier le lien",
    copied: "Lien copié.",
    none: "—",
    reason: "Motif",
    reasonPlaceholder: "Choisissez un motif",
    note: "Commentaire interne (facultatif, 500 caractères au plus)",
    send: "Enregistrer",
    busy: "Enregistrement…",
    next: "Page suivante",
    first: "Première page",
    adminOnly:
      "Réservé à un administrateur : l’action n’est pas proposée à un commercial, et une tentative par un autre chemin est refusée et enregistrée.",
    keys: "‹j›/‹k› ligne suivante/précédente · ‹Entrée› ouvrir la fiche",
  },
  /** One message per answer of apps/api (02 §9.2): never the technical message. */
  failure: {
    forbidden:
      "Vous n’avez pas le droit d’effectuer cette action. La tentative a été enregistrée. Rôle requis : administrateur.",
    notFound: "Cet élément n’existe pas ou n’est plus disponible.",
    conflict:
      "Cette action n’est plus possible dans l’état actuel de l’élément.",
    rateLimited:
      "Trop de recherches partielles en peu de temps (20 par quart d’heure). Patientez quelques minutes.",
    validation: "Certaines valeurs ont été refusées. Vérifiez la saisie.",
    unavailable:
      "Le service ne répond pas pour le moment. Rien n’a été modifié. Réessayez dans quelques minutes.",
  },
  reauth: {
    title: "Confirmez votre identité",
    lead: "Cette action demande votre mot de passe et un code de votre application d’authentification.",
    passwordLabel: "Mot de passe",
    codeLabel: "Code de l’application d’authentification (6 chiffres)",
    submit: "Confirmer et poursuivre",
    busy: "Confirmation…",
    generic:
      "Confirmation impossible. Vérifiez votre mot de passe et votre code, puis réessayez.",
    recoverySession:
      "Cette action n’est pas disponible dans une session ouverte avec un code de secours. Demandez à un administrateur de réinitialiser votre second facteur.",
    revoked:
      "Votre session a été fermée après plusieurs échecs de confirmation d’identité. Reconnectez-vous.",
  },
  roles: {
    advertiser: "Marque",
    creator: "Créateur",
    agent: "Commercial",
    admin: "Administrateur",
  },
  declaredStatus: { individual: "Particulier", business: "Professionnel" },
  accountStatus: {
    active: "actif",
    suspended: "suspendu",
    deleted: "supprimé",
  },
  languages: { fr: "français", en: "anglais" },
  destinations: { brevo: "Brevo", apollo: "Apollo" },
  syncState: {
    synced: "synchronisé",
    pending: "en attente",
    not_attempted: "non tenté",
    skipped: "cas normal",
    failed: "échec",
  },
  /** 05 RG99: the cause in plain words, never a code. */
  syncCause: {
    synced: "Synchronisé",
    waiting: "En file d’attente",
    retry_scheduled: "Nouvelle tentative prévue",
    not_attempted: "Aucune tentative enregistrée",
    no_consent: "Pas de consentement marketing : non envoyé, c’est normal",
    out_of_apollo_scope_individual: "Particulier hors du périmètre Apollo",
    out_of_apollo_scope: "Hors du périmètre Apollo réglé",
    country_excluded: "Pays exclu de la prospection Apollo",
    country_not_validated:
      "Pays non validé pour Apollo (avant l’exclusion par liste)",
    prospection_opposed: "Opposition à la prospection",
    email_not_verified: "Adresse non vérifiée",
    company_not_identified: "Entreprise non identifiée",
    account_not_active: "Compte inactif",
    non_production: "Environnement de test : aucun envoi réel",
    configuration_missing: "Incident : réglage manquant",
    other_normal_case: "Autre cas normal",
    address_refused: "Adresse refusée par le service",
    quota_exceeded: "Quota journalier dépassé",
    service_unavailable: "Service indisponible",
    data_refused_by_check: "Donnée refusée par un contrôle",
    provider_response_invalid: "Réponse du service illisible",
    other_failure: "Autre échec",
    access_key_refused: "Clé d’accès refusée par le service",
  },
  /** 05 RG160 point 4, RG164: the setting at fault is named, never its value. */
  syncSetting: {
    brevo_list_advertisers: "liste Brevo des annonceurs",
    brevo_list_creators: "liste Brevo des créateurs",
    brevo_template: "modèle d’e-mail Brevo",
    apollo_settings: "réglages Apollo",
    apollo_credentials: "clé d’accès Apollo",
  },
  /** The cause with its setting: « Incident : réglage manquant — liste Brevo des créateurs ». */
  syncCauseWithSetting: (cause: string, setting: string) =>
    `${cause} — ${setting}`,
  consentSource: {
    signup_form: "inscription",
    account_settings: "mon compte",
    brevo_webhook: "désinscription Brevo",
    apollo_optout: "opposition Apollo",
    backoffice: "espace interne",
    data_request: "demande « mes données »",
  },
  heardFrom: {
    online_search: "recherche en ligne",
    social_media: "réseaux sociaux",
    word_of_mouth: "bouche-à-oreille",
    influx_salesperson: "commercial INFLUX",
    event: "événement",
    other: "autre",
  },
  browserFamily: {
    chrome: "Chrome",
    edge: "Edge",
    firefox: "Firefox",
    safari: "Safari",
    samsung_internet: "Samsung Internet",
    opera: "Opera",
    instagram: "le navigateur d’Instagram",
    facebook: "le navigateur de Facebook",
    tiktok: "le navigateur de TikTok",
  } as Readonly<Record<string, string>>,
  browserSystem: {
    windows: "Windows",
    macos: "macOS",
    ios: "iOS",
    android: "Android",
    linux: "Linux",
    chromeos: "ChromeOS",
  } as Readonly<Record<string, string>>,
  browser: (family: string, system: string) => `${family} sur ${system}`,
  browserUnidentified: "un navigateur non identifié",
  home: {
    title: "Espace interne",
    lead: "Inscrits du jour, synchronisation des leads et alertes.",
    loading: "Chargement…",
    countersTitle: (day: string) => `Aujourd’hui (${day}, jour UTC)`,
    signups: (total: number, advertisers: number, creators: number) =>
      `${total} inscrit${total > 1 ? "s" : ""} : ${advertisers} marque${advertisers > 1 ? "s" : ""}, ${creators} créateur${creators > 1 ? "s" : ""}`,
    countries: (list: string, others: number) =>
      `Principaux pays : ${list === "" ? "aucun" : list} · autres pays : ${others}`,
    countryCount: (name: string, count: number) => `${name} ${count}`,
    share: (
      label: string,
      percent: number | null,
      synced: number,
      eligible: number,
    ) =>
      percent === null
        ? `${label} : aucun inscrit concerné`
        : `${label} : ${percent} % (${synced} sur ${eligible})`,
    brevoWithinHour: "Envoyés à Brevo en moins d’une heure",
    apolloWithin24Hours: "Envoyés à Apollo en moins de 24 heures",
    failures: (brevo: number, apollo: number) =>
      `Échecs à traiter : Brevo ${brevo} · Apollo ${apollo} (objectif : zéro)`,
    seeFailures: "Voir les échecs à traiter",
    countersError: "Les compteurs du jour n’ont pas pu être chargés.",
    alertsTitle: "Alertes",
    noAlert: "Aucune alerte ouverte.",
    alertsError: "Les alertes n’ont pas pu être chargées.",
    evaluatedAt: (at: string) => `Évaluées le ${at}`,
    /** PD6 (J8S-1; 03 §1.3, 15 RG9): the weekly review, a team discipline. */
    degraded: {
      title: "Revue hebdomadaire des confirmations en mode différé",
      lead: (weeks: number) =>
        `Actions confirmées seul par la personne qui les avait demandées, semaine par semaine, sur les ${weeks} dernières semaines. Ce contrôle est affaibli : relisez cette liste chaque semaine, en équipe.`,
      empty: (weeks: number) =>
        `Aucune confirmation en mode différé au cours des ${weeks} dernières semaines.`,
      week: (week: string, count: number) => {
        const [year = "", number = ""] = week.split("-W");
        return `Semaine ${Number(number)} de ${year} — ${count} confirmation${count > 1 ? "s" : ""}`;
      },
      line: (
        action: string,
        reason: string,
        name: string,
        requestedAt: string,
        confirmedAt: string,
        executed: boolean,
      ) =>
        `${action} (motif : ${reason}) — demandée par ${name} le ${requestedAt}, confirmée seule le ${confirmedAt}${executed ? ", exécutée" : ", non exécutée"}.`,
      open: "Ouvrir la demande",
      error: "La revue hebdomadaire n’a pas pu être chargée.",
    },
  },
  /** 05 RG104, CA62; 15 §F: an alert says what, how many and since when (never the colour alone). */
  alert: {
    cause: {
      configuration_missing: (
        destination: string,
        count: number,
        setting?: string,
      ) =>
        `Réglage manquant : ${setting ?? "inconnu"}. ${count} envoi${count > 1 ? "s" : ""} ${destination} en échec. Renseignez le réglage : les envois repartent seuls en moins de 15 minutes, ou rejouez-les.`,
      failures_past_delay: (destination: string, count: number) =>
        `${count} échec${count > 1 ? "s" : ""} ${destination} attend${count > 1 ? "ent" : ""} au-delà du délai de la file.`,
      access_key_refused: (destination: string, count: number) =>
        `La clé d’accès ${destination} est refusée. ${count} envoi${count > 1 ? "s" : ""} en attente. Vérifiez la clé dans la configuration.`,
      quota_exceeded: (destination: string, count: number) =>
        `Quota ${destination} dépassé. ${count} envoi${count > 1 ? "s" : ""} en attente.`,
      destination_down: (destination: string, count: number) =>
        `${destination} ne répond plus. ${count} envoi${count > 1 ? "s" : ""} en attente.`,
      queue_late: (destination: string, count: number) =>
        `File ${destination} en retard : ${count} envoi${count > 1 ? "s" : ""} hors délai sur 24 heures.`,
      unsubscribe_gap: (_destination: string, count: number) =>
        `Le dernier rapprochement Brevo a trouvé ${count} désinscription${count > 1 ? "s" : ""} non reçue${count > 1 ? "s" : ""} par le webhook.`,
      reconciliation_failed: () => "Le dernier rapprochement Brevo a échoué.",
    } as Readonly<
      Record<
        string,
        (destination: string, count: number, setting?: string) => string
      >
    >,
    line: (code: string, text: string, since: string | null) =>
      `Alerte ${code} — ${text}${since === null ? "" : ` (depuis le ${since})`}`,
    newBrowser: {
      title: "Connexion au backoffice depuis un nouveau navigateur",
      body: (agentName: string, date: string, time: string, browser: string) =>
        `${agentName} s’est connecté le ${date} à ${time} depuis ${browser}, un navigateur jamais utilisé sur ce compte au cours des 30 derniers jours. Aucune mesure automatique n’a été prise. Vérifiez auprès de la personne ; si ce n’est pas elle, révoquez ses sessions et réinitialisez son second facteur.`,
      unnamed: "Une personne sans prénom enregistré",
    },
    /** J8S-4 (15 RG101): an `admin` role granted, for the admins; the e-mail comes at Lot 5. */
    adminGrant: {
      title: "Rôle administrateur attribué",
      body: (name: string, by: string, date: string, time: string) =>
        `${name} a reçu le rôle administrateur le ${date} à ${time}, attribué par ${by}. Si cette attribution n’était pas attendue, vérifiez-la auprès de ${by} et de la personne concernée.`,
      unknownGranter: "une personne non identifiée",
    },
  },
  accounts: {
    title: "Inscrits",
    lead: "Membres inscrits et état de leur synchronisation. La liste ne montre aucune adresse ; l’ouverture d’une fiche est enregistrée à votre nom.",
    noExport:
      "Aucun export nominatif : la liste des inscrits ne s’exporte pas, quel que soit le rôle.",
    filters: "Filtres",
    role: "Rôle",
    country: "Pays",
    language: "Langue",
    declaredStatus: "Statut déclaré",
    consent: "Consentement",
    consentGranted: "accordé",
    consentWithdrawn: "retiré",
    destination: "Destination",
    all: "Tous",
    view: "Vue",
    viewAll: "Tous les inscrits",
    viewFailed: "À traiter",
    servicesHint:
      "Beaucoup d’échecs d’un coup ? Un fournisseur ou un service peut être en cause :",
    viewNormal: "Cas normaux",
    viewHelp:
      "« À traiter » et « Cas normaux » sont deux vues, jamais un total : un inscrit sans consentement n’est pas un échec.",
    search: "Recherche par adresse",
    searchHelp:
      "Une adresse complète : recherche exacte, non enregistrée. Un fragment de 3 caractères au moins, sans espace : recherche partielle, enregistrée à votre nom (20 par quart d’heure). Le terme n’apparaît jamais dans l’adresse de la page.",
    searchInvalid:
      "Saisissez une adresse complète, ou un fragment de 3 caractères au moins, sans espace.",
    searchSubmit: "Chercher",
    reset: "Réinitialiser les filtres",
    searchJournaled: "Cette recherche a été enregistrée à votre nom.",
    searchExact: "Recherche exacte : elle n’est pas enregistrée.",
    period: "Période d’inscription",
    periodFrom: "Du",
    periodTo: "Au",
    periodHelp: "Bornes incluses, dans votre fuseau horaire.",
    periodInvalid: "La période doit commencer avant de finir.",
    columns: {
      select: "Sélection",
      createdAt: "Inscription",
      role: "Rôle",
      country: "Pays",
      language: "Langue",
      status: "Statut déclaré",
      consent: "Consentement",
      source: "Source",
      brevo: "Brevo",
      apollo: "Apollo",
      owner: "Responsable",
      open: "Fiche",
    },
    sourceInvitation: "invitation",
    sourceDirect: "directe",
    openRecord: "Ouvrir la fiche",
    selectRow: (date: string) =>
      `Sélectionner les échecs de l’inscrit du ${date}`,
    empty: "Aucun inscrit ne correspond à ces filtres.",
    error: "La liste n’a pas pu être chargée.",
    unowned: "aucun",
  },
  replay: {
    selection: (pairs: number, cap: number) =>
      `${pairs} envoi${pairs > 1 ? "s" : ""} en échec sélectionné${pairs > 1 ? "s" : ""} · plafond ${cap} par lot`,
    open: (pairs: number) => `Rejouer la sélection (${pairs})`,
    unit: (destination: string) => `Rejouer l’envoi ${destination}`,
    title: "Rejouer des envois en échec",
    preview: (pairs: number, accounts: number) =>
      `${pairs} envoi${pairs > 1 ? "s" : ""} en échec, pour ${accounts} inscrit${accounts > 1 ? "s" : ""}, ser${pairs > 1 ? "ont" : "a"} remis en file.`,
    overCap: (cap: number) =>
      `Au-delà de ${cap} envois, le surplus est refusé et listé : il se rejoue dans un second lot.`,
    reversibility:
      "Le rejeu est idempotent : il remet en file avec la même clé, sans doublon ni e-mail renvoyé. Il ne s’annule pas, et ne produit rien de plus qu’un envoi réussi.",
    noConsent:
      "Un inscrit sans consentement n’est jamais rejoué : son consentement futur déclenchera l’envoi.",
    confirm: "Confirmer le rejeu",
    busy: "Rejeu…",
    close: "Fermer le compte rendu et actualiser",
    report: (
      requested: number,
      requeued: number,
      ignored: number,
      refused: number,
    ) =>
      `Compte rendu : ${requested} demandé${requested > 1 ? "s" : ""} · ${requeued} remis en file · ${ignored} ignoré${ignored > 1 ? "s" : ""} · ${refused} refusé${refused > 1 ? "s" : ""}.`,
    reasons: {
      provider_recovered: "Le service est rétabli",
      configuration_fixed: "La configuration est corrigée",
      data_corrected: "La donnée est corrigée",
      quota_restored: "Le quota est rétabli",
      transient_failure: "Échec passager",
    },
    outcome: {
      requeued: "remis en file",
      already_in_progress: "déjà en cours de traitement",
      already_synced: "déjà synchronisé",
      no_consent: "sans consentement : non rejoué, c’est normal",
      normal_case: "cas normal : rien à rejouer",
      nothing_to_replay: "aucun échec à rejouer",
      over_cap: "au-delà du plafond : à rejouer dans un autre lot",
    },
    outcomeLine: (destination: string, outcome: string) =>
      `${destination} : ${outcome}`,
  },
  account: {
    title: "Fiche d’inscrit",
    back: "Retour à la liste",
    journaled: "Consultation enregistrée à votre nom.",
    identity: "Identité",
    email: "Adresse e-mail",
    emailStatus: {
      unknown: "délivrabilité inconnue",
      deliverable: "délivrable",
      undeliverable:
        "injoignable : le compte est inaccessible, seul un administrateur peut corriger l’adresse",
    },
    companyName: "Raison sociale",
    role: "Rôle",
    status: "État du compte",
    country: "Pays",
    language: "Langue",
    declaredStatus: "Statut déclaré",
    createdAt: "Inscription",
    lastSeenAt: "Dernière activité",
    consent: "Consentement marketing",
    consentValue: (granted: boolean, at: string, source: string) =>
      `${granted ? "accordé" : "retiré"} le ${at} (${source})`,
    noConsent: "aucun choix enregistré",
    source: "Source d’acquisition",
    sourceInvitation: "invitation d’un commercial",
    sourceDirect: "inscription directe",
    utm: (source: string, medium: string, campaign: string) =>
      `UTM : ${source} / ${medium} / ${campaign}`,
    referrer: (domain: string) => `Site d’origine : ${domain}`,
    heardFrom: (answer: string) => `A connu INFLUX par : ${answer}`,
    sync: "Synchronisation",
    lastAttempt: (at: string) => `Dernière tentative le ${at}`,
    retryAt: (at: string) => `Nouvelle tentative prévue le ${at}`,
    noReplay:
      "Pas de rejeu : ce n’est pas un échec. Un consentement futur déclenchera l’envoi.",
    owner: "Commercial responsable",
    ownerSince: (name: string, from: string, to: string | null) =>
      to === null
        ? `${name}, depuis le ${from}`
        : `${name}, du ${from} au ${to}`,
    unnamed: "sans prénom",
    corrections: "Corriger",
    correctionsLead:
      "Statut, pays ou langue, avec un motif. La correction est enregistrée et transmise à Brevo et Apollo.",
    correctionsReasons: {
      member_request: "Demande du membre",
      signup_error: "Erreur à l’inscription",
      document_check: "Contrôle d’un document",
      data_quality: "Qualité des données",
    },
    unchanged: "inchangé",
    corrected: "Correction enregistrée.",
    nothingChanged: "Aucune valeur n’a changé : rien n’a été enregistré.",
    nothingToCorrect: "Choisissez au moins une valeur à corriger.",
    roleChange: "Changer le rôle : créateur vers marque",
    roleChangeLead:
      "Irréversible. Double validation par un autre administrateur, ou confirmation différée s’il n’y en a pas.",
    legalName: "Raison sociale de la nouvelle marque",
    legalNameInvalid: "2 à 120 caractères.",
    roleChangeReasons: {
      member_request: "Demande du membre",
      signup_error: "Erreur à l’inscription",
    },
    requestDualControl: "Demander la double validation",
    suppression: "Lever une désinscription Brevo",
    suppressionLead:
      "Avec confirmation d’identité. La levée ne réabonne jamais seule : seul un consentement postérieur à la désinscription est renvoyé.",
    suppressionReasons: {
      member_request: "Demande du membre",
      complaint_misattributed: "Plainte attribuée par erreur",
      provider_error: "Erreur du service",
    },
    suppressionSubmit: "Lever la désinscription",
    suppressionDone: (resync: boolean) =>
      resync
        ? "Désinscription levée. Le consentement postérieur est renvoyé à Brevo."
        : "Désinscription levée. Le contact attend un nouveau consentement du membre.",
    suppressionNone: "Aucune désinscription enregistrée à lever.",
    dataRequests: "Demandes « mes données »",
    noDataRequest: "Aucune demande.",
    dataRequestType: { access: "Accès (export)", erasure: "Effacement" },
    dataRequestStatus: {
      received: "reçue",
      in_progress: "en cours",
      closed: "close",
    },
    dataRequestOutcome: {
      satisfaite: "satisfaite",
      satisfaite_partiellement: "satisfaite partiellement",
      refusee: "refusée",
      sans_objet: "sans objet",
      retiree_par_le_demandeur: "retirée par le demandeur",
    },
    dataRequestLine: (
      type: string,
      received: string,
      due: string,
      status: string,
    ) =>
      `${type} · reçue le ${received} · échéance légale le ${due} · ${status}`,
    dataRequestExecuted: (at: string) => `Exécutée le ${at}.`,
    dataRequestApproved: (at: string) =>
      `Exécution approuvée le ${at}, en attente du traitement.`,
    /** D72: an erasure authorised by the member alone, read-only; never an approval button. */
    dataRequestMemberErasure: (
      authorised: string,
      executed: string | null,
      brevo: string,
      apollo: string,
      closed: string | null,
    ) =>
      `Suppression demandée et confirmée par le membre (code frais) le ${authorised} · ${
        executed === null ? "en attente d’exécution" : `exécutée le ${executed}`
      } · Brevo ${brevo} · Apollo ${apollo} · ${
        closed === null ? "non close" : `close le ${closed}`
      }.`,
    dataRequestExport: (expires: string, downloads: number) =>
      `Export publié, disponible jusqu’au ${expires} · ${downloads} téléchargement${downloads > 1 ? "s" : ""}.`,
    dataRequestApprove: "Approuver l’exécution (double validation)",
    dataRequestAgent:
      "L’exécution est réservée à un administrateur, en double validation et avec confirmation d’identité.",
    dataRequestClosing:
      "La demande ne peut être close qu’après la confirmation de Brevo.",
    history: "Historique",
    historyEmpty: "Aucun événement.",
    historyMore: "Événements plus anciens",
    historyLine: (at: string, actor: string, eventType: string) =>
      `${at} · ${actor} · ${eventType}`,
    historyActor: {
      member: "membre",
      agent: "commercial",
      admin: "administrateur",
      system: "système",
      service: "service",
    },
    error: "La fiche n’a pas pu être chargée.",
  },
  /** L2C-18 (15 RG41 blocks 2 and 3, RG123; 17b §3.5): what the record of a brand adds. */
  accountBrand: {
    contactTitle: "Interlocuteur de la marque",
    contactMark: "▮",
    contactMarkLabel: "visible des seuls rôles internes",
    contactLead:
      "Visible des rôles internes seuls. L’e-mail, le téléphone et le lien ne sont jamais montrés à un créateur ni à une marque (D46) : seuls le prénom et la fonction le sont, à l’ouverture d’une mise en relation. L’ouverture de cette fiche est enregistrée.",
    role: "Fonction",
    profileTitle: "Profil de la marque",
    status: "État du profil",
    completeness: "Complétude",
    changed: "Champs modifiés depuis la validation",
    changedNone: "aucun",
    decisionsTitle: "Historique des décisions",
    decisionsEmpty: "Aucune décision n’a été prise sur ce profil.",
    decision: {
      published: (at: string, by: string) => `Publié le ${at} par ${by}`,
      rejected: (at: string, by: string, reason: string) =>
        `Refusé le ${at} par ${by} — motif : ${reason}`,
      late: " (décision après l’échéance)",
      unknownAgent: "un agent",
    },
    more: (count: number) =>
      `Seules les ${count} décisions les plus récentes sont affichées.`,
    masked:
      "Les messages envoyés à la marque et les commentaires internes des décisions ne sont pas repris sur cette fiche.",
  },
  apollo: {
    title: "Réglages Apollo",
    lead: "Chaque changement passe par une double validation, sur un écran distinct. Un changement réévalue les inscrits écartés.",
    scope: "Périmètre",
    scopes: {
      annonceurs_seuls: "Marques seulement",
      annonceurs_et_createurs_pro: "Marques et créateurs professionnels",
      tous_les_inscrits: "Tous les inscrits",
    },
    countries: "Pays exclus de la prospection",
    countriesHelp:
      "Codes pays ISO séparés par des espaces ou des virgules (FR, BE…). Tous les pays sont prospectés sauf ceux de la liste ; une liste vide n’en exclut aucun.",
    countriesInvalid: (codes: string) => `Codes inconnus : ${codes}`,
    countriesEmpty: "Aucun pays exclu : tous les pays sont prospectés.",
    legalBasis: "Base légale",
    legalBasisDefault: "Par défaut",
    legalBases: {
      consentement_requis: "Consentement requis",
      interet_legitime_avec_opposition: "Intérêt légitime, avec opposition",
    },
    byCountry: "Exceptions par pays",
    byCountryHelp:
      "Une ligne par pays : le code ISO, une espace, puis « consentement » ou « interet » (ex. « DE consentement »).",
    byCountryInvalid:
      "Une ligne n’a pas la forme attendue, ou un pays y figure deux fois.",
    byCountryNone: "Aucune exception.",
    settingLine: (label: string, value: string) => `${label} — ${value}`,
    countryBasis: (country: string, basis: string) => `${country} : ${basis}`,
    updated: (at: string) => `Modifié le ${at}`,
    change: "Demander ce changement",
    reasons: {
      founder_decision: "Décision du fondateur",
      legal_validation: "Validation juridique",
      legal_restriction: "Restriction juridique",
      configuration_error: "Erreur de configuration",
    },
    error: "Les réglages n’ont pas pu être chargés.",
  },
  dualControl: {
    title: "Double validation",
    lead: "Actions en attente d’une seconde validation. Une demande expire au bout de 24 heures : rien n’est alors exécuté.",
    empty: "Aucune action en attente de seconde validation.",
    open: "Ouvrir",
    columns: {
      action: "Action",
      requestedBy: "Demandeur",
      expires: "Expire le",
      next: "Votre geste",
    },
    next: {
      confirm_as_peer: "à confirmer",
      confirm_degraded: "confirmation différée",
      await_peer: "attend un autre administrateur",
      none: "aucun",
    },
    requestTitle: "Action en attente de seconde validation",
    requestedBy: (name: string, at: string, expires: string) =>
      `Demandée par ${name} le ${at} · expire le ${expires}`,
    action: "Action",
    reason: "Motif",
    note: "Commentaire",
    consequencesTitle: "Conséquences",
    reversible: (value: boolean) =>
      value
        ? "Réversible : oui."
        : "Réversible : non. Cette action ne s’annule pas.",
    scope: (count: number) =>
      `Portée : ${count} élément${count > 1 ? "s" : ""}`,
    actions: {
      "identity.grant_role": "Attribuer un rôle",
      "identity.change_member_role": "Changer un créateur en marque",
      "identity.invite_admin":
        "Rendre utilisable l’invitation d’un administrateur",
      "leads.change_apollo_setting": "Changer un réglage Apollo",
      "privacy.approve_data_request":
        "Approuver l’exécution d’une demande « mes données »",
    } as Readonly<Record<string, string>>,
    reasons: {
      member_request: "Demande du membre",
      signup_error: "Erreur à l’inscription",
      founder_decision: "Décision du fondateur",
      legal_validation: "Validation juridique",
      legal_restriction: "Restriction juridique",
      configuration_error: "Erreur de configuration",
      new_team_member: "Arrivée dans l’équipe",
      team_replacement: "Remplacement",
      request_instructed: "Demande instruite",
    } as Readonly<Record<string, string>>,
    consequences: {
      role_granted: "le rôle est attribué",
      role_replaced: "le rôle créateur est remplacé par le rôle marque",
      advertiser_profile_created: "un profil de marque est créé",
      sessions_revoked: "les sessions du membre sont fermées",
      declared_status_business: "le statut déclaré devient professionnel",
      lead_updated: "Brevo et Apollo sont mis à jour",
      admin_invitation_usable: "le lien d’invitation devient utilisable",
      setting_changed: "le réglage change",
      skipped_accounts_reevaluated: "les inscrits écartés sont réévalués",
      export_published: "l’export est publié dans l’espace du membre",
      member_notified: "le membre est prévenu",
      request_closed_after_brevo:
        "la demande est close après la confirmation de Brevo",
      account_anonymized: "le compte est anonymisé",
      sessions_closed: "les sessions sont fermées",
      brevo_contact_deleted: "le contact Brevo est supprimé",
      auth_user_deleted: "l’identifiant de connexion est supprimé",
    } as Readonly<Record<string, string>>,
    target: {
      account: "Compte concerné",
      invitation: "Invitation concernée",
      request: "Demande concernée",
      setting: "Nouvelle valeur",
      legalName: "Raison sociale",
      role: "Rôle",
      /** PD1 (J8S-2): a member account by role, country and sign-up, never by its address. */
      member: (role: string, country: string, date: string) =>
        `${role} · ${country} · inscrit le ${date}`,
      internal: (name: string) => `${name}, membre de l’équipe`,
      invited: (email: string, role: string, date: string) =>
        `${email} · rôle proposé : ${role} · invitation du ${date}`,
      newBrand: "Nouvelle raison sociale",
      unreadable:
        "Objet introuvable : il n’existe plus ou n’est plus lisible. Ne confirmez pas sans l’avoir vérifié.",
    },
    openAccount: "Ouvrir la fiche",
    states: {
      pending: "en attente",
      confirmed: "confirmée par un pair",
      degraded: "confirmée en mode différé",
      cancelled: "abandonnée",
      expired: "expirée : rien n’a été exécuté",
    },
    confirmedBy: (name: string, at: string) =>
      `Déjà confirmée le ${at} par ${name}.`,
    awaitPeer:
      "Vous avez demandé cette action : un autre administrateur doit la confirmer.",
    noAction: "Aucune action possible de votre part sur cette demande.",
    /** 17b §3.13.c, 15 RG9: the word "affaibli" is written. */
    degraded:
      "CONTRÔLE AFFAIBLI. Vous confirmez une action que vous avez vous-même demandée. Ce contrôle protège contre l’erreur et la précipitation, pas contre la malveillance. Il redeviendra un vrai contrôle dès la deuxième personne dans l’équipe.",
    countdown: (seconds: number) =>
      seconds > 0
        ? `Confirmation possible dans ${seconds} s.`
        : "Confirmation possible.",
    justification: (min: number, max: number) =>
      `Justification écrite (${min} à ${max} caractères)`,
    justificationInvalid: (min: number) =>
      `Écrivez une justification d’au moins ${min} caractères.`,
    confirm: "Confirmer l’action",
    refuse: "Abandonner la demande",
    done: (degraded: boolean) =>
      degraded
        ? "Action confirmée en mode différé et exécutée. La confirmation est enregistrée à votre nom, avec ses deux horodatages."
        : "Action confirmée par un pair et exécutée.",
    reevaluated: (count: number) =>
      `${count} inscrit${count > 1 ? "s" : ""} réévalué${count > 1 ? "s" : ""}.`,
    cancelled: "Demande abandonnée : rien n’a été exécuté.",
    unknownPerson: "un membre de l’équipe",
    error: "La demande n’a pas pu être chargée.",
  },
  internalAccounts: {
    title: "Comptes internes",
    namedPerson:
      "Un compte interne = une personne nommée. Aucun compte partagé, jamais.",
    byInvitation:
      "Il n’existe aucune inscription : un compte se crée par invitation.",
    breakGlass:
      "Compte de secours. Adresse distincte, TOTP hors ligne, codes de secours imprimés et scellés. Toute connexion alerte immédiatement le fondateur et exige une justification écrite sous 24 heures. Il n’est jamais utilisé pour le travail quotidien.",
    columns: {
      person: "Personne",
      role: "Rôle",
      factor: "Second facteur",
      owned: "Responsable de",
      state: "État",
    },
    factorActive: "actif",
    factorMissing: "non activé",
    owned: (count: number) => `${count} compte${count > 1 ? "s" : ""}`,
    active: "actif",
    inactive: "désactivé",
    breakGlassState: "bris de glace",
    absence: (from: string, to: string) => `absence du ${from} au ${to}`,
    lastSignInLater:
      "La dernière connexion de chacun n’est pas encore affichée : une session n’est lisible que par son titulaire.",
    error: "La liste n’a pas pu être chargée.",
  },
  invitations: {
    internalTitle: "Inviter une personne dans l’équipe",
    internalLead:
      "Lien d’activation valable 72 heures, à usage unique, lié à l’adresse. Une invitation d’administrateur n’est utilisable qu’après sa double validation.",
    memberTitle: "Invitations de membres",
    memberLead:
      "INFLUX n’envoie pas encore l’e-mail d’invitation : copiez le lien et transmettez-le vous-même. Vous serez le commercial responsable du compte créé.",
    email: "Adresse e-mail",
    role: "Rôle",
    proposedRole: "Rôle proposé (la personne choisit à l’inscription)",
    language: "Langue de la page d’inscription",
    reasons: {
      new_team_member: "Arrivée dans l’équipe",
      team_replacement: "Remplacement",
    },
    create: "Créer l’invitation",
    linkOnce:
      "Lien affiché une seule fois. Il n’est conservé nulle part en clair : copiez-le maintenant.",
    linkLabel: "Lien d’invitation",
    expires: (at: string) => `Expire le ${at}.`,
    adminPending:
      "Cette invitation d’administrateur attend sa double validation avant d’être utilisable.",
    openDualControl: "Ouvrir la double validation",
    listTitle: "Invitations récentes",
    empty: "Aucune invitation.",
    columns: {
      email: "Adresse",
      role: "Rôle",
      created: "Créée le",
      expires: "Expire le",
      state: "État",
      action: "Action",
    },
    internalStates: {
      awaiting_dual_control: "attend la double validation",
      pending: "utilisable",
      accepted: "acceptée",
      revoked: "révoquée",
      expired: "expirée",
    },
    memberStates: {
      pending: "utilisable",
      redeemed: "utilisée : compte créé",
      revoked: "révoquée",
      expired: "expirée",
    },
    revoke: "Révoquer",
    revokeReason: (email: string) => `Motif de la révocation de ${email}`,
    revokeReasons: {
      sent_to_wrong_address: "Envoyée à une mauvaise adresse",
      no_longer_needed: "Plus nécessaire",
      suspected_compromise: "Compromission suspectée",
      replaced_by_new_invitation: "Remplacée par une nouvelle invitation",
    },
    revoked: "Invitation révoquée.",
    emailInvalid: "Saisissez une adresse e-mail valide.",
    refusedInternal:
      "Invitation impossible pour cette adresse. Vérifiez qu’elle n’appartient pas déjà à un compte.",
    takenMember: "Cette adresse a déjà un compte ou une invitation en cours.",
    error: "Les invitations n’ont pas pu être chargées.",
  },
  // ---------------------------------------------------------------------------------------------
  // J9 commit 9: the "Santé technique" screen (02 §20.5; 15 RG165), read only, admins only
  // ---------------------------------------------------------------------------------------------
  health: {
    title: "Santé technique",
    lead: "Lecture seule, réservée aux administrateurs. La disponibilité est celle mesurée par la sonde, le reste vient de la base : rien ne se modifie ici.",
    workstation:
      "Cet écran est fait pour un poste de travail. Sur téléphone, l’e-mail d’alerte suffit.",
    refresh: "Actualiser",
    refreshing: "Actualisation…",
    refreshedAt: (time: string) =>
      `Actualisé à ${time}. Mise à jour automatique toutes les minutes.`,
    loading: "Chargement de la section…",
    unavailable: "Cette section n’a pas pu être chargée.",
    forbidden:
      "Cet écran est réservé aux administrateurs. La tentative a été enregistrée.",
    retry: "Réessayer",
    ago: (age: string) => `il y a ${age}`,
    /** "12:07 · il y a 3 min": an instant and how old it is. */
    timeAndAge: (time: string, age: string) => `${time} · il y a ${age}`,
    /** " · il y a 3 min": the age that follows a state. */
    afterState: (age: string) => ` · il y a ${age}`,
    availability: {
      title: "Disponibilité mesurée par la sonde",
      lead: "Le worker appelle chaque cible une fois par minute. L’alerte AL49 part au deuxième échec de suite d’une même cible.",
      columns: {
        target: "Cible",
        state: "Dernier relevé",
        duration: "Durée",
        day: "24 heures",
        week: "7 jours",
        month: "30 jours",
      },
      targets: {
        web_home_fr: "Accueil du site (français)",
        web_home_en: "Accueil du site (anglais)",
        backoffice_sign_in: "Connexion du backoffice",
        api_health: "API — état et base (réseau privé)",
      },
      up: "Disponible",
      down: "Injoignable",
      unknown: "Aucun relevé",
      failures: {
        timeout: "délai dépassé",
        connection: "aucune réponse",
        status: "réponse d’erreur",
        redirect: "redirection inattendue",
        body: "réponse incomplète",
      },
      statusCode: (code: number) => `code ${code}`,
      cause: (words: string) => ` (${words})`,
      stale: "relevé ancien : la sonde s’est peut-être arrêtée",
      window: (share: string, failures: number, checks: number) =>
        `${share} (${failures} échec${failures > 1 ? "s" : ""} sur ${checks})`,
      noMeasure:
        "Pas de relevé : la disponibilité est inconnue, elle n’est pas nulle.",
    },
    alerts: {
      title: "Alertes techniques ouvertes",
      lead: "Les alertes AL48 à AL63 (15 RG165) : chacune s’affiche ici et part par e-mail. Une alerte d’état est rappelée au plus toutes les 30 minutes ; un e-mail « rétabli » clôt l’incident.",
      empty: "Aucune alerte technique ouverte.",
      columns: {
        alert: "Alerte",
        since: "Ouverte depuis",
        notified: "Dernier e-mail",
        value: "Mesure et seuil",
      },
      notified: (time: string, count: number) =>
        `${time} (${count} envoi${count > 1 ? "s" : ""})`,
      notNotified: "pas encore envoyé",
      subject: (subject: string) => `concerne ${subject}`,
      titles: {
        AL48: "Délivrabilité du code de connexion hors seuil",
        AL49: "Site injoignable",
        AL50: "Worker arrêté",
        AL51: "Nouvelle erreur serveur, ou régression",
        AL52: "Taux d’erreurs serveur",
        AL53: "Lenteur de l’API",
        AL54: "Lenteur des pages",
        AL55: "Pic d’appels (information)",
        AL56: "Réponses 429 en hausse",
        AL57: "Service saturé",
        AL58: "Base saturée",
        AL59: "Code de connexion visé",
        AL60: "Purge horaire en défaut",
        AL61: "Webhook Brevo : appels ignorés",
        AL62: "Webhook Brevo hors plages",
        AL63: "Demande de données exécutée, non close",
      } as Readonly<Record<string, string>>,
      untitled: "Alerte technique",
    },
    worker: {
      title: "État du worker",
      lead: "Lu depuis la base, pas depuis le worker : l’état reste juste quand il est arrêté (02 §11.3).",
      state: {
        running: "Actif — le dernier battement est dans le délai.",
        silent: "Silencieux — aucun battement dans le délai de l’alerte AL50.",
        unknown: "Non évalué — le délai de l’alerte AL50 n’est pas renseigné.",
      },
      threshold: (seconds: number) => `Délai d’alerte AL50 : ${seconds} s`,
      noBeat: "Aucun battement n’a jamais été enregistré.",
      columns: {
        instance: "Instance",
        version: "Version",
        started: "Démarré",
        beat: "Dernier battement",
        turn: "Dernier tour de boucle",
        state: "État",
      },
      beating: "bat",
      silent: "silencieux",
      notEvaluated: "non évalué",
      turnHint:
        "Un worker qui bat sans terminer de tour est occupé par une longue tâche ou bloqué : regardez l’âge du dernier tour.",
      tasks: {
        title: "Tâches périodiques",
        empty: "Aucune tâche périodique n’a encore tourné.",
        columns: {
          task: "Tâche",
          period: "Période",
          started: "Début",
          finished: "Fin",
          outcome: "Résultat",
        },
        names: {
          brevo_reconciliation: "Réconciliation Brevo",
          auth_orphan_purge: "Purge des comptes d’authentification orphelins",
          brevo_inbound_purge: "Purge des retours Brevo",
          data_export_purge: "Purge des exports de données",
          ops_retention: "Conservation et purges de la surveillance",
          storage_purge: "Purge des fichiers déposés",
          verification_expiry: "Expiration des codes de vérification",
        },
        outcomes: {
          succeeded: "réussie",
          failed: "en échec",
        } as Readonly<Record<string, string>>,
        running: "en cours",
      },
    },
    errors: {
      title: "Erreurs",
      lead: "Les erreurs sont regroupées par empreinte : type, message nettoyé, route et premières lignes de notre code. Un groupe corrigé qui réapparaît est une régression.",
      filter: "Afficher",
      source: "Origine",
      sources: {
        all: "Serveur et navigateur",
        server: "Serveur",
        browser: "Navigateur",
      },
      filters: {
        open: "Ouvertes",
        regression: "Régressions",
        new: "Nouvelles",
        acknowledged: "Prises en compte",
        fixed: "Corrigées",
        ignored: "Ignorées",
        all: "Toutes",
      },
      chip: (label: string, count: number | null) =>
        count === null ? label : `${label} (${count})`,
      empty: {
        open: "Aucune erreur ouverte.",
        regression: "Aucune régression.",
        other: "Aucun groupe dans cet état.",
      },
      truncated: (cap: number) =>
        `Seuls les ${cap} groupes les plus récents sont affichés.`,
      columns: {
        status: "État",
        error: "Erreur",
        route: "Route",
        service: "Service",
        count: "Occurrences",
        first: "Première",
        last: "Dernière",
        versions: "Versions",
        detail: "Détail",
      },
      statuses: {
        new: "nouvelle",
        acknowledged: "prise en compte",
        fixed: "corrigée",
        ignored: "ignorée",
      },
      regression: (count: number) =>
        count > 1 ? `régression (${count} fois)` : "régression",
      services: {
        api: "API",
        worker: "Worker",
        web: "Site (navigateur)",
        backoffice: "Backoffice (navigateur)",
      },
      versions: (first: string, last: string) =>
        first === last ? first : `${first} → ${last}`,
      noRoute: "hors requête",
      show: "Voir les occurrences",
      hide: "Masquer les occurrences",
      detailTitle: (type: string) => `Occurrences de ${type}`,
      detailLead:
        "Les 50 plus récentes, conservées 30 jours. Le numéro de requête mène aux journaux Railway ; le compte est un identifiant, jamais un nom.",
      detailEmpty:
        "Aucune occurrence conservée (au-delà de 30 jours, ou au-delà du plafond par minute).",
      detailColumns: {
        when: "Date",
        service: "Service",
        version: "Version",
        route: "Route",
        request: "Requête",
        account: "Compte",
        message: "Message",
      },
      stack: "Pile nettoyée",
      noStack: "pas de pile",
      userAgent: (summary: string) => `navigateur : ${summary}`,
      unverified: "source navigateur, texte non vérifié",
    },
    traffic: {
      title: "Appels, durées et erreurs de l’API",
      lead: "Par route (son modèle, jamais l’adresse réelle). Le p95 est calculé à la lecture sur les histogrammes de toutes les instances additionnés : c’est la borne haute de la tranche qui le contient.",
      window: "Période",
      windows: { hour: "1 heure", day: "24 heures", week: "7 jours" },
      sort: "Trier par",
      sorts: { calls: "appels", p95: "p95", errors: "taux d’erreurs" },
      total: "Toutes les routes",
      empty: "Aucun appel mesuré sur cette période.",
      columns: {
        route: "Route",
        calls: "Appels / min",
        p95: "p95",
        errors: "Erreurs 5xx",
        throttled: "429",
        curves: "Courbes : appels, p95, erreurs",
      },
      callsTotal: (count: number) => `${count} appel${count > 1 ? "s" : ""}`,
      errorsCell: (count: number, rate: string) => `${count} (${rate})`,
      curveCalls: "Appels par minute",
      curveP95: "p95",
      curveErrors: "Taux d’erreurs 5xx",
      curveLabel: (name: string, last: string, peak: string) =>
        `${name} : dernier point ${last}, maximum ${peak}`,
      curveEmpty: (name: string) => `${name} : rien de mesuré`,
      bucket: (size: string) => `Un point = ${size}.`,
      totalLine: (calls: string, rate: string, p95: string, errors: string) =>
        `${calls} · ${rate} / min · p95 ${p95} · erreurs 5xx ${errors}`,
      range: (from: string, now: string) => `${from} → ${now}`,
      inProgress: "Le dernier point de chaque courbe est la tranche en cours.",
      read: {
        title: "Comment lire un ralentissement",
        columns: { calls: "Appels", durations: "Durées", reading: "Lecture" },
        rows: [
          [
            "En hausse",
            "Normales",
            "Pic absorbé : rien à faire, noter son origine.",
          ],
          [
            "En hausse",
            "Dégradées",
            "Le pic ralentit le site : augmenter les ressources Railway du service, vérifier la base.",
          ],
          [
            "Normaux",
            "Dégradées",
            "Défaut interne (requête lente, base, fournisseur externe) : ce tableau désigne la route, pg_stat_statements la requête.",
          ],
          [
            "Chute brutale",
            "—",
            "Site injoignable ou panne en amont : voir la sonde, puis l’état de Railway et de Supabase.",
          ],
        ] as ReadonlyArray<readonly [string, string, string]>,
        origin:
          "Le premier suspect d’un pic est INFLUX lui-même : un envoi de masse ou une campagne ramène des milliers de visiteurs en quelques minutes.",
      },
    },
    processes: {
      title: "Processus et base de données",
      lead: "Le retard de la boucle d’événements est le signe de lenteur le plus direct d’un service Node. Les relevés sont à la minute.",
      empty: "Aucun processus n’a écrit de relevé depuis 24 heures.",
      columns: {
        process: "Processus",
        last: "Dernier relevé",
        loop: "Retard de boucle (p99)",
        loopHour: "Sur 1 h : moyenne · maximum",
        memory: "Mémoire (RSS)",
        cpu: "Processeur",
      },
      services: { api: "API", worker: "Worker" },
      stale: "relevé interrompu ?",
      loopHour: (average: string, maximum: string) => `${average} · ${maximum}`,
      peak: (value: string) => `pic ${value} sur 1 h`,
      database: {
        title: "Connexions à la base",
        none: "Aucun relevé de connexions : le worker les relève chaque minute.",
        now: (connections: number, max: number, share: number) =>
          `${connections} connexions sur ${max} (${share} % du maximum de la grappe)`,
        peak: (peak: number) => `Pic des 24 dernières heures : ${peak}`,
        stale: (age: string) =>
          `Dernier relevé il y a ${age} : le relevé est interrompu.`,
        curveLabel: (last: number, peak: number) =>
          `Connexions, dernière heure : dernier point ${last}, maximum ${peak}`,
      },
    },
  },
  /**
   * L2C-16 (17b §2.2, §2.3, §2.8, §4.1, §4.2; 15 RG27, RG28, RG32, RG33, RG34, RG119, RG121): the list
   * template of the queues and queue 1. A state is always a written label, never a colour alone.
   */
  queueList: {
    lead: "Première soumission, ou modification d’un champ d’un profil publié : prenez l’entrée en charge, lisez-la, puis publiez ou refusez.",
    countersTitle: "Compteurs de la file",
    pending: (count: number) =>
      `${count} ${count > 1 ? "entrées" : "entrée"} en attente`,
    oldest: (age: string | null) =>
      `plus ancienne : ${age === null ? "—" : age}`,
    overdue: (count: number) => `hors délai : ${count}`,
    unclaimed: (count: number) => `sans preneur : ${count}`,
    policy: (decision: string, claim: string | null) =>
      `Délai de décision : ${decision}${claim === null ? "" : ` · Objectif de prise en charge : ${claim}`}`,
    businessMinutes: (words: string) => `${words} ouvrées`,
    calendarMinutes: (words: string) => `${words} en continu`,
    filters: "Filtres de la file",
    all: "Tous",
    overdueOnly: "Hors délai seuls",
    holder: "Verrou",
    holderOptions: { free: "Libre", me: "Pris par moi" },
    holderOther: "un autre commercial",
    owner: "Responsable",
    ownerOptions: { none: "Sans responsable" },
    ownerOther: "un commercial précis",
    alert: "Alerte",
    alertOptions: { true: "Avec alerte seulement" },
    kind: "Origine",
    country: "Pays",
    chipRemove: (label: string) => `Retirer le filtre : ${label}`,
    chip: (name: string, value: string) => `${name} : ${value}`,
    chipsLabel: "Filtres actifs",
    reset: "Réinitialiser",
    period: "Période de dépôt",
    periodFrom: "Du",
    periodTo: "Au",
    periodHelp: "Bornes incluses, dans votre fuseau horaire.",
    periodInvalid: "La période doit commencer avant de finir.",
    /** The pages of the list: capped by the server (RG34), one at a time, never an infinite scroll. */
    pagination: "Pages de la file",
    page: (number: number) => `Page ${number}`,
    pagePrevious: "Page précédente",
    pageNext: "Page suivante",
    pageFirst: "Première page",
    pageEmpty: "Cette page ne contient plus d’entrée.",
    tableLabel: "Entrées de la file Profils marque à valider",
    columns: {
      state: "État",
      due: "Échéance",
      kind: "Origine",
      brand: "Marque",
      country: "Pays",
      completeness: "Complétude",
      modified: "Champs modifiés",
      owner: "Responsable",
      holder: "Verrou",
      open: "Entrée",
    },
    resultsSorted: (count: number) =>
      `${count} ${count > 1 ? "résultats" : "résultat"} · triée par échéance croissante`,
    sortMark: " ▲",
    chipMark: "×",
    state: {
      overdue: "Hors délai",
      held: "Verrou tenu",
      free: "Libre",
    },
    dueOverdue: (since: string) => `HORS DÉLAI depuis ${since}`,
    dueIn: (left: string) => `dans ${left}`,
    dueAt: (at: string) => `échéance ${at}`,
    lockFree: "libre",
    lockSince: (name: string, time: string) => `${name} depuis ${time}`,
    lockMe: "Vous",
    lockUnknown: "Un collègue",
    escalated: "Ancienneté au-delà du seuil d’alerte",
    alertLine: (words: string) => `Alerte : ${words}`,
    kinds: { submission: "Première soumission", revision: "Modification" },
    wholeProfile: "Tout le profil",
    unset: "non renseigné",
    completeness: (percent: number | null) =>
      percent === null ? "non renseigné" : `${percent} %`,
    fields: {
      "advertiser.brand_name": "Nom de la marque",
      "advertiser.logo": "Logo",
      "advertiser.presentation": "Présentation",
      "advertiser.website_domain": "Site web",
      "advertiser.contact_role": "Fonction de l’interlocuteur",
      "advertiser.primary_sector": "Secteur principal",
    },
    alerts: {
      direct_contact: "Coordonnée possible dans un champ public",
      duplicate_brand: "Marque semblable déjà publiée",
      duplicate_domain: "Site web déjà utilisé par une marque publiée",
      unusual_website_domain: "Domaine du site inhabituel",
    },
    openEntry: "Ouvrir",
    openEntryOf: (brand: string) => `Ouvrir l’entrée de ${brand}`,
    loading: "Chargement de la file…",
    /** bo.queue.empty (15 RG32): a normal state, in the success tone. */
    empty: "Aucune entrée en attente.",
    emptySince: (age: string) =>
      `Aucune entrée en attente — la dernière a été traitée il y a ${age}.`,
    noMatch: "Aucune entrée ne correspond à ces filtres.",
    error: "La file n’a pas pu être chargée.",
    forbidden:
      "Vous n’avez pas le droit d’effectuer cette action. La tentative a été enregistrée. Rôle requis : commercial ou administrateur.",
    keys: "‹j›/‹k› ligne suivante/précédente · ‹Entrée› ouvrir (prend en charge) · ‹?› raccourcis",
    shortcutsButton: "Raccourcis",
    shortcutsTitle: "Raccourcis clavier de la file",
    shortcuts: {
      next: "ligne suivante",
      previous: "ligne précédente",
      open: "ouvrir l’entrée de la ligne (la prend en charge)",
      help: "afficher ou masquer ce rappel",
    },
  },
  /** L2C-16 (06 RG72, RG7; 15 RG28): the queue counters on the dashboard. */
  queueSummary: {
    title: "Files de validation",
    line: (
      name: string,
      pending: number,
      age: string | null,
      overdue: number,
      unclaimed: number,
    ) =>
      `${name} : ${pending} en attente · plus ancienne : ${age === null ? "—" : age} · hors délai : ${overdue} · sans preneur : ${unclaimed}`,
    open: "Ouvrir la file",
    escalated: (count: number, atLeast: boolean) =>
      `${atLeast ? "Au moins " : ""}${count} ${count > 1 ? "entrées ont" : "entrée a"} dépassé le seuil d’alerte d’ancienneté.`,
    seeEscalated: "Voir les entrées hors délai",
    error: "Les compteurs de la file n’ont pas pu être chargés.",
  },
  /**
   * L2C-17 (17b §2.4 to §2.6, §4.3, §4.8, §4.11; 15 RG27 C1 to C8, RG114 to RG117; 06 RG6, RG9, RG19,
   * RG65, RG66; jalons/l2c/file.md A3, A6, A8, A9): the decision screen of queue 1. The messages to the
   * brand are never written here: they come from apps/api with the reasons (what the agent reads is
   * what the brand receives, RG66).
   */
  queueReview: {
    title: (brand: string) => `Profil marque — ${brand}`,
    markerLabel: "consultation enregistrée",
    mark: "▮",
    separator: " · ",
    keyReleaseHint: "‹l›",
    parenthesized: (words: string) => `(${words})`,
    loggedLine: (name: string, at: string) =>
      `Consultation enregistrée : ${name}, ${at}.`,
    back: "Retour à la file",
    subtitle: (kind: string, createdAt: string) =>
      `${kind} · créée le ${createdAt}`,
    loading: "Ouverture de l’entrée…",
    errors: {
      forbidden:
        "Vous n’avez pas le droit d’ouvrir cette entrée. La tentative a été enregistrée. Rôle requis : commercial ou administrateur.",
      conflictOfInterest:
        "Cette entrée est celle d’une marque dont vous êtes le responsable : vous ne pouvez ni la lire ni la décider. Un autre commercial la traitera.",
      notFound: "Cette entrée n’existe pas ou n’est plus disponible.",
      unavailable:
        "L’entrée n’a pas pu être ouverte. Rien n’a été modifié. Réessayez dans quelques minutes.",
    },
    banner: {
      byMe: (time: string) =>
        `Vous avez pris cette entrée en charge à ${time}.`,
      byOther: (name: string, time: string) =>
        `En cours — ${name}, depuis ${time}.`,
      byOtherUnknown: "En cours — un collègue la traite.",
      readOnly: "Vous pouvez lire, vous ne pouvez pas décider.",
      overdue: (since: string) =>
        `Hors délai depuis ${since}. Une décision reste possible.`,
      overdueRead: (since: string) => `Hors délai depuis ${since}.`,
      expiresSoon: (minutes: number) =>
        `Votre prise en charge expire dans ${minutes} min.`,
      extend: "Prolonger",
      extended: (time: string) => `Prise en charge prolongée jusqu’à ${time}.`,
      expired:
        "Votre prise en charge a expiré : vous ne pouvez plus décider. Reprenez l’entrée.",
      resume: "Reprendre l’entrée",
      forcedRelease: (admin: string, time: string, reason: string) =>
        `Votre prise en charge a été levée par ${admin} à ${time} : ${reason}.`,
      forcedReleaseUnknown: "un administrateur",
    },
    notices: {
      heldByOther:
        "Un collègue vient de prendre cette entrée en charge : elle est maintenant en lecture seule. Votre saisie est conservée.",
      lifted:
        "Votre prise en charge a été levée par un administrateur. L’entrée est rouverte, relisez-la avant de décider. Votre saisie est conservée.",
      notHeld:
        "Votre prise en charge n’était plus valable. L’entrée est rouverte, relisez-la avant de décider. Votre saisie est conservée.",
      stale:
        "Le profil a changé depuis votre lecture : il est relu ci-dessous et rien n’a été enregistré. Relisez-le, puis décidez de nouveau. Votre saisie est conservée.",
      closed:
        "Cette entrée a été clôturée entre-temps : rien n’a été enregistré.",
      profileState:
        "Le profil n’est plus dans un état que cette entrée peut décider : rien n’a été enregistré.",
      lifted_by_you: (holder: string) =>
        `Le verrou de ${holder} est levé et vous avez pris l’entrée en charge.`,
      liftedNoName: "Le verrou est levé et vous avez pris l’entrée en charge.",
    },
    modifiedAfter: "modifié après examen",
    modifiedAfterLine: (fields: string) =>
      `Modifié après votre première lecture : ${fields}.`,
    sections: {
      brand: "La marque",
      written: "Ce qui a été écrit",
      alerts: "Alertes",
      contact: "Interlocuteur de la marque",
      decision: "Décision",
      logos: "Logo",
    },
    facts: {
      brandName: "Nom de la marque",
      country: "Pays",
      language: "Langue du compte",
      owner: "Responsable",
      primarySector: "Secteur principal",
      secondarySectors: "Secteurs secondaires",
      companySize: "Taille de l’entreprise",
      websiteDomain: "Site web",
      presentation: "Présentation",
      targetMarkets: "Marchés visés",
      workingLanguages: "Langues de travail",
      topics: "Thèmes recherchés",
      networks: "Réseaux",
      formats: "Formats",
      audienceCountries: "Pays d’audience visés",
      usageRights: "Droits d’usage",
      exclusivity: "Exclusivité",
      rhythm: "Rythme de collaboration",
      nonMonetary: "Contreparties non monétaires",
      contactRole: "Fonction de l’interlocuteur",
      completeness: "Complétude",
      status: "État du profil",
    },
    companySizes: {
      "1_10": "1 à 10 personnes",
      "11_50": "11 à 50 personnes",
      "51_250": "51 à 250 personnes",
      "251_1000": "251 à 1 000 personnes",
      "1001_plus": "Plus de 1 000 personnes",
    },
    statuses: {
      draft: "Brouillon",
      pending_review: "En attente de validation",
      published: "Publié",
      rejected: "Refusé",
      suspended: "Suspendu",
    },
    yes: "oui",
    no: "non",
    unset: "non renseigné",
    none: "aucun",
    pendingChange: "modification proposée, voir « Ce qui a été écrit »",
    logo: {
      active: "Logo actif",
      inReview: "Logo en examen",
      none: "Aucun logo",
      line: (
        dimensions: string | null,
        size: string | null,
        activatedAt: string | null,
      ) =>
        [
          dimensions,
          size,
          activatedAt === null ? null : `déposé le ${activatedAt}`,
        ]
          .filter((part): part is string => part !== null)
          .join(" · ") || "caractéristiques indisponibles",
      dimensions: (width: number, height: number) => `${width} × ${height} px`,
      kilobytes: (kilobytes: number) => `${kilobytes} Ko`,
      alt: (label: string, brandName: string) =>
        `${label} de la marque ${brandName}`,
      loading: "Chargement de l’image…",
      failed:
        "L’image n’a pas pu être lue pour l’instant : ses caractéristiques restent indiquées et la décision n’en dépend pas. Rechargez la page pour réessayer.",
    },
    written: {
      submission:
        "Première soumission : tout le profil ci-dessus est à examiner, aucune version validée n’existe encore.",
      columns: {
        field: "Champ",
        validated: "Version validée",
        proposed: "Version proposée",
      },
      tableLabel: "Modifications proposées en regard de la version validée",
      emptyValue: "(vide)",
      removed: "(retiré)",
      logoNew: "Nouveau logo (voir « Logo en examen »)",
      logoRemoved: "Retrait du logo",
      logoCurrent: "Logo actif",
      logoNoneYet: "Aucun logo",
      noRevision: "Aucune modification n’est en attente sur cette entrée.",
    },
    alerts: {
      none: "Aucune alerte sur cette entrée.",
      intro: "Les alertes informent : aucune ne bloque la décision.",
      direct_contact: (field: string, signals: string) =>
        `Coordonnée possible dans « ${field} » (${signals}).`,
      unusual_website_domain:
        "Le domaine du site web est inhabituel (caractères non latins ou domaine codé) : vérifiez qu’il s’agit bien de la marque.",
      duplicate_brand: (names: string) =>
        `Une marque publiée porte un nom semblable : ${names}.`,
      duplicate_domain: (names: string) =>
        `Une marque publiée utilise déjà ce site web : ${names}.`,
      signals: {
        email: "adresse e-mail",
        url: "lien",
        domain: "nom de domaine",
        phone: "numéro de téléphone",
        handle: "pseudo",
        messenger: "messagerie",
      },
      fields: {
        "advertiser.brand_name": "Nom de la marque",
        "advertiser.presentation": "Présentation",
        "advertiser.website_domain": "Site web",
      },
    },
    contact: {
      lead: "Visible des agents INFLUX seuls, jamais d’une marque ni d’un créateur (D45, D46) : l’ouverture de cet écran est enregistrée.",
      firstName: "Prénom",
      email: "Adresse e-mail",
      phone: "Téléphone",
      url: "Lien",
    },
    decision: {
      lead: "Deux issues : publier, ou refuser avec un motif. La décision porte sur la version affichée ici.",
      readOnly:
        "Lecture seule : la décision appartient à la personne qui a pris l’entrée en charge.",
      publish: "Valider",
      reject: "Refuser avec motif",
      release: "Je rends la main",
      comment: "Commentaire interne (facultatif, 1 000 caractères au plus)",
      commentHelp:
        "Visible des seuls agents INFLUX : jamais de la marque, ni dans l’e-mail.",
      commentTooLong: "Le commentaire dépasse 1 000 caractères.",
      busy: "Enregistrement…",
      publishTitle: "Publier ce profil ?",
      publishRecap: (brand: string, language: string) =>
        `Le profil de ${brand} sera publié tel qu’affiché ici, et la marque en sera informée par e-mail, en ${language}.`,
      publishRevisions: (count: number) =>
        count === 1
          ? "Une modification en attente sera appliquée."
          : `${count} modifications en attente seront appliquées.`,
      publishConfirm: "Confirmer la publication",
      publishCommentRecap: "Commentaire interne joint :",
      cancel: "Annuler",
      reasonTitle: "Refuser ce profil",
      reasonLegend: "Motif du refus (liste fermée)",
      reasonRequired: "Choisissez un motif avant de refuser.",
      reasonConfirm: "Refuser",
      messageToBrand: "Message envoyé à la marque :",
      nextStep: "Ce que la marque pourra faire :",
      otherMessage:
        "Message à la marque (20 à 500 caractères, sans coordonnée)",
      otherCount: (length: number, max: number, min: number) =>
        `${length} / ${max} caractères (${min} au moins).`,
      otherMessageHelp:
        "Ce texte est envoyé tel quel à la marque, à la suite de la phrase ci-dessus.",
      otherTooShort:
        "Le message à la marque doit compter au moins 20 caractères.",
      otherTooLong: "Le message à la marque dépasse 500 caractères.",
      otherDirectContact:
        "Le message contient une adresse, un numéro ou un lien : retirez-le, les coordonnées ne passent pas par ce message.",
      reasonLabels: {
        contact_in_public_field: "Coordonnée directe dans un champ public",
        presentation_insufficient:
          "Présentation trop courte ou incompréhensible",
        logo_non_compliant: "Logo non conforme",
        misleading_brand_name: "Nom commercial trompeur",
        sector_inconsistent: "Secteur manifestement incohérent",
        illicit_content: "Contenu illicite ou contraire aux CGU",
        duplicate_brand: "Doublon d’une marque déjà inscrite",
        other: "Autre — message rédigé par vous",
      },
      requiredMissing:
        "Un champ obligatoire manque au profil : la publication est impossible. Vous pouvez refuser avec un motif.",
      invalidReason:
        "Le motif choisi n’est pas valide. Choisissez-en un autre.",
      invalidMessage:
        "Le message à la marque est refusé : longueur ou contenu invalide.",
      invalidComment:
        "Le commentaire interne est refusé : 1 000 caractères au plus.",
      rejectedNotice: (brand: string, reason: string) =>
        `Profil de ${brand} refusé — ${reason}. La marque en est informée par e-mail.`,
      publishedNotice: (brand: string) =>
        `Profil de ${brand} publié. La marque en est informée par e-mail.`,
      lateMark:
        "Décision prise après l’échéance : elle est marquée comme telle.",
    },
    chain: {
      seeEntry: "Voir l’entrée",
      cancel: "Annuler l’enchaînement et revenir à la liste",
      close: "Fermer ce message",
      empty:
        "La file est vide : aucune autre entrée ne vous attend pour l’instant.",
      emptyBack: "Revenir à la file",
    },
    force: {
      button: "Lever le verrou",
      title: "Lever le verrou de cette entrée",
      lead: "Réservé aux administrateurs. Le titulaire en est informé à sa prochaine action, et la levée est enregistrée.",
      legend: "Motif de la levée (liste fermée)",
      reasons: {
        holder_absent: "Le titulaire est absent",
        overdue_entry: "L’entrée est hors délai",
        wrong_claim: "Prise en charge par erreur",
      },
      required: "Choisissez un motif avant de lever le verrou.",
      confirm: "Lever le verrou et prendre l’entrée",
    },
    closed: {
      published: "Cette entrée est close : le profil a été publié.",
      rejected: "Cette entrée est close : le profil a été refusé.",
      withdrawn: "Cette entrée est close : elle a été retirée de la file.",
      open: "Cette entrée est close.",
      decidedBy: (name: string, at: string) => `Décidée par ${name}, le ${at}.`,
      decidedAt: (at: string) => `Décidée le ${at}.`,
      late: "Décision prise après l’échéance.",
      reason: (reason: string) => `Motif : ${reason}.`,
      message: "Message reçu par la marque :",
      comment: "Commentaire interne :",
    },
    shortcuts: {
      title: "Raccourcis de l’écran de décision",
      button: "Raccourcis",
      keys: "‹v› valider (récapitulatif) · ‹r› refuser avec motif · ‹l› rendre la main · ‹Échap› fermer sans perdre la saisie · ‹?› raccourcis",
      publish:
        "ouvrir le récapitulatif de la publication (ne publie jamais seul)",
      reject: "ouvrir le choix du motif (ne refuse jamais seul)",
      release: "rendre la main et revenir à la file",
      escape: "fermer le panneau en cours, sans perdre la saisie",
      help: "afficher ou masquer ce rappel",
    },
  },
  /** The link of the queues to the "Santé technique" screen (15 §C, "file bloquée"): admins only. */
  servicesLink: {
    label: "État des services",
    hint: "Réservé aux administrateurs.",
  },
} as const;
