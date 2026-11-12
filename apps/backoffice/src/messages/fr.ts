// Labels of the backoffice. D36 is open: French only, without next-intl (02 §8, 21 §4 J1-E).
// No literal text in JSX: moving to two languages will only replace this module. Sign-in, TOTP
// activation and recovery codes: 17b §3.14 (keys `bo.auth.*`, same wording).
// The option of queue 5 that confirms a decision without a new grant, as the agent reads it: the refusals
// that send him to it quote it, so the two never drift apart.
const NEW_REQUEST_NEEDED = "Sans suite en l’état : nouvelle demande à déposer";

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
    creatorReviewQueue: "Profils créateur à valider",
    verificationCreators: "Vérifications créateurs",
    verificationBrands: "Vérifications marques",
    verificationDisputes: "Contestations",
    identifierChanges: "Identifiants modifiés",
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
    registrySources: "Sources de registre",
    internalAccounts: "Comptes internes",
    health: "Santé technique",
  },
  /** Names of the queues, key `queue.<code>` of backoffice.queues (15 RG29); L2C: queue 1. */
  queue: {
    profiles_advertiser: "Profils marque à valider",
    profiles_creator: "Profils créateur à valider",
    verification_creators: "Vérifications des créateurs",
    verification_brands: "Vérifications des marques",
    verification_disputes: "Contestations de badge",
    identity_change_review: "Identifiants modifiés à contrôler",
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
  /** L2F-18 (08 RG70, RG73 to RG77; 06 RG55; 15 RG75): the badges of an account and the ask for a withdrawal. */
  accountBadges: {
    title: "Badges de vérification",
    lead: "Chaque badge du compte, quel que soit son état. Aucun chiffre ni identifiant de réseau n’est affiché ici. Un retrait se demande ici et se confirme, par un administrateur distinct, sur l’écran de double validation.",
    tableLabel: "Badges du compte",
    loading: "Chargement des badges…",
    empty: "Aucun badge n’a été accordé à ce compte.",
    error: "Les badges n’ont pas pu être chargés.",
    columns: {
      badge: "Badge",
      state: "État",
      granted: "Accordé le",
      date: "Échéance",
      action: "Retrait",
    },
    state: {
      active: "actif",
      to_refresh: "à rafraîchir",
      to_reconfirm: "à reconfirmer",
      expired: "expiré",
      revoked: "retiré",
      replaced: "remplacé",
    } as Readonly<Record<string, string>>,
    /** The date of the badge's end or expiry, written; « Compte vérifié » never expires (RG30). */
    date: {
      neverExpires: "sans échéance",
      expires: (at: string) => `expire le ${at}`,
      pastDue: (at: string) => `échéance dépassée le ${at}`,
      dueOn: (at: string) => `échéance le ${at}`,
      expired: (at: string) => `expiré le ${at}`,
      revoked: (at: string) => `retiré le ${at}`,
      replaced: (at: string) => `remplacé le ${at}`,
    },
    /** The reason of a withdrawal already executed, in the agent's words. */
    revokedFor: (reason: string) => `motif : ${reason}`,
    pending: {
      pending:
        "retrait demandé, en attente de la confirmation d’un administrateur",
      confirmed: "retrait confirmé, en cours d’exécution",
      degraded: "retrait confirmé en mode différé, en cours d’exécution",
      cancelled: "dernière demande de retrait abandonnée : aucun effet",
      consumed: "retrait exécuté",
      expired: "dernière demande de retrait expirée : aucun effet",
    } as Readonly<Record<string, string>>,
    openRequest: "Voir la demande",
    dispute: {
      open: "contestation en cours",
      upheld: "contestation tranchée : décision maintenue",
      overturned: "contestation tranchée : décision infirmée",
      withdrawn: "contestation retirée",
    } as Readonly<Record<string, string>>,
    requestWithdrawal: "Demander le retrait",
    requestWithdrawalOf: (badge: string) => `Demander le retrait : ${badge}`,
    formTitle: (badge: string) => `Demander le retrait du badge « ${badge} »`,
    formLead:
      "Aucun badge ne se retire directement : cette demande ouvre une double validation que confirme un administrateur distinct de vous.",
    reason: "Motif du retrait",
    reasonPlaceholder: "Choisissez un motif",
    escalated:
      "Ce motif est réservé à la décision d’un administrateur : lui seul confirme le retrait.",
    memberMessage: (min: number, max: number) =>
      `Message au membre (${min} à ${max} caractères, sans lien, adresse ni numéro)`,
    memberMessageInvalid: (min: number, max: number) =>
      `Écrivez un message de ${min} à ${max} caractères.`,
    memberReceives: "Le membre recevra, par e-mail, cette phrase :",
    recapTitle: "Ce que fera le retrait, une fois confirmé",
    recap: {
      withdrawn:
        "Le badge disparaît aussitôt et la ligne publique du profil est recalculée.",
      cascade:
        "Un « Compte vérifié » retiré emporte avec lui les badges d’audience du même compte de réseau.",
      notified: "Le membre est prévenu par e-mail, avec le motif.",
      appeal:
        "Un créateur peut contester le retrait dans le délai prévu ; une marque corrige et redépose.",
      irreversible:
        "Réversible : non. Ce retrait ne s’annule pas depuis le backoffice.",
    },
    submit: "Envoyer la demande à un administrateur",
    busy: "Envoi…",
    cancel: "Renoncer",
    sentAgent:
      "Demande envoyée. Un administrateur la confirme sur l’écran de double validation ; le badge reste affiché d’ici là.",
    refused:
      "Ce badge ne peut plus faire l’objet d’un retrait, ou un retrait est déjà demandé. La liste est rechargée.",
  },
  /**
   * L2F-20 (D83 A; 06 RG51; jalons/l2f/modele.md §5, §6; l2f/textes.md « Ouverture »): « Lancer la
   * vérification » on the record of a member. The reasons are the closed list of the opening; the comment
   * is internal (never served to the member, never logged). « Audience vérifiée » is never offered.
   */
  accountOpening: {
    title: "Lancer la vérification",
    lead: "Vous connaissez ce membre : lancez vous-même sa vérification. La demande rejoint la file « Vérifications » comme celle d’un membre, et aucun badge n’est accordé sans votre constat. « Audience vérifiée » ne se lance pas d’ici : le créateur dépose lui-même ses pièces.",
    tableLabel: "Vérifications que vous pouvez lancer pour ce compte",
    loading: "Chargement des vérifications possibles…",
    error: "Les vérifications possibles n’ont pas pu être chargées.",
    emptyCreator: "Ce créateur n’a déclaré aucun compte de réseau social.",
    emptyBrand: "Ce compte n’offre aucune vérification à lancer.",
    columns: {
      target: "Vérification",
      request: "Demande en cours",
      action: "Lancer",
    },
    brandName: "Marque vérifiée",
    noRequest: "aucune",
    request: {
      member: {
        draft: "brouillon du membre, pas encore envoyé : lancer la reprend",
        pending: "demande du membre, en file : lancer la reprend",
      },
      agent: {
        draft: "brouillon ouvert par l’équipe",
        pending: "demande ouverte par l’équipe, en file",
      },
    } as Readonly<Record<string, Readonly<Record<string, string>>>>,
    openRequest: "Ouvrir la demande (la prend en charge)",
    launch: "Lancer la vérification",
    launchOf: (target: string) => `Lancer la vérification : ${target}`,
    formTitle: (target: string) => `Lancer la vérification — ${target}`,
    formLead:
      "La demande est prise en charge dans la file ; vous la décidez ensuite vous-même, ou un collègue, après avoir constaté. Rien ne se décide ici.",
    reason: "Pourquoi la lancez-vous ?",
    reasonPlaceholder: "Choisissez un motif",
    reasons: {
      invited_by_agent: "Invité par l’agent (D54)",
      existing_client: "Client existant",
      past_collaboration: "Collaboration antérieure",
      other: "Autre (commentaire exigé)",
    } as Readonly<Record<string, string>>,
    comment: "Commentaire interne",
    commentRequired: "Commentaire interne (exigé pour « Autre »)",
    commentHelp:
      "Visible des seuls agents INFLUX : jamais du membre, ni dans l’e-mail, ni dans les journaux.",
    commentMissing: "Le motif « Autre » exige un commentaire interne.",
    commentTooLong: (max: number) =>
      `Le commentaire interne ne dépasse pas ${max} caractères.`,
    noDomain:
      "La marque n’a pas de domaine sur son profil : sa vérification ne peut pas être lancée. Elle doit d’abord le renseigner.",
    detailsTitle: "Bloc interne de la marque",
    detailsLead:
      "La marque n’en a pas encore : renseignez ses trois champs, tels que vous les connaissez. Ils ne sont jamais montrés à la marque.",
    detailsPresent:
      "Le bloc interne de la marque est déjà renseigné : il est repris tel quel.",
    legalName: "Raison sociale",
    registrationCountry: "Pays d’immatriculation",
    countryPlaceholder: "Choisissez un pays",
    registrationNumber: "Numéro d’immatriculation",
    legalNameInvalid: "Saisissez la raison sociale (160 caractères au plus).",
    countryInvalid: "Choisissez le pays d’immatriculation.",
    numberInvalid:
      "Saisissez le numéro d’immatriculation (40 caractères au plus).",
    recapTitle: "Ce que le membre recevra",
    recapCreator: (network: string) =>
      `Un e-mail l’informe que son commercial INFLUX a lancé la vérification de son compte ${network} et lui indique de retrouver, dans son espace INFLUX, le code à publier.`,
    recapBrand:
      "Un e-mail l’informe que son commercial INFLUX a lancé la vérification de sa marque ; si une action de sa part est nécessaire, elle est indiquée dans son espace INFLUX.",
    recapNoCode:
      "Cet e-mail ne contient ni code, ni lien, ni chiffre, ni identifiant de réseau.",
    recapTakeover:
      "Une demande déjà ouverte par le membre est reprise : elle n’est jamais doublée.",
    recapInternal:
      "Votre motif et votre commentaire restent internes : le membre ne les lit jamais.",
    submit: "Lancer la vérification",
    busy: "Envoi…",
    cancel: "Renoncer",
    created: (target: string) =>
      `Vérification lancée : la demande « ${target} » attend dans la file « Vérifications ». Le membre en est informé par e-mail.`,
    takenOver: (target: string) =>
      `La demande déjà ouverte « ${target} » est reprise, elle n’est pas doublée. Le membre en est informé par e-mail.`,
    refusals: {
      account_unavailable:
        "Le compte n’est plus actif : rien n’a été enregistré.",
      already_verified:
        "Ce badge est déjà accordé à ce compte : rien n’a été lancé.",
      rejection_cap:
        "Plusieurs demandes ont déjà été refusées pour ce compte : rien n’a été lancé.",
      retry_after:
        "Une demande vient d’être refusée pour ce compte : réessayez plus tard, rien n’a été lancé.",
      duplicate_request: "Une demande est déjà en cours pour ce compte.",
      website_domain_required:
        "La marque n’a pas de domaine sur son profil : rien n’a été lancé.",
      internal_details_required:
        "La marque n’a pas de bloc interne : renseignez ses trois champs.",
      internal_details_present:
        "Le bloc interne de la marque existe déjà : laissez ses champs vides.",
      invalid_internal_details:
        "Le bloc interne est refusé : relisez la raison sociale, le pays et le numéro.",
      invalid_reason: "Ce motif n’est pas dans la liste : choisissez-en un.",
      invalid_opening_comment:
        "Le commentaire interne est refusé : 1 à 1 000 caractères, sans caractère de contrôle.",
      invalid_level: "Ce niveau ne peut pas être lancé d’ici.",
    } as Readonly<Record<string, string>>,
    notFound: "Ce compte n’est plus disponible : rien n’a été lancé.",
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
      "verification.revoke_badge": "Retirer un badge de vérification",
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
      /** L2F-18 (08 RG73; 06 RG55): the reasons of a withdrawal of a badge, as the agent chose them. */
      forged_evidence: "Pièce ou information inexacte",
      account_closed: "Compte de réseau supprimé, fermé ou inaccessible",
      owner_changed: "Compte de réseau passé à un autre titulaire",
      terms_breach: "Manquement aux conditions d’utilisation",
      influx_error: "Badge accordé par erreur par INFLUX",
      company_dissolved: "Société radiée du registre public",
      domain_transferred: "Domaine du site passé à un autre titulaire",
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
      /** L2F-18 (08 RG76, RG77; 15 RG75): what a withdrawal does, said before the first gesture. */
      badge_withdrawn: "le badge est retiré aussitôt",
      audience_badge_withdrawn:
        "les badges d’audience du même compte de réseau sont retirés avec lui",
      public_row_recomputed:
        "la ligne publique du profil est recalculée, sans le badge",
      member_may_appeal:
        "le créateur peut contester le retrait dans le délai prévu",
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
      /** L2F-18 (PD1): the badge a withdrawal reaches, by level, network and state, never by an identifier. */
      badge: "Badge concerné",
      badgeLine: (level: string, network: string | null, state: string) =>
        `${level}${network === null ? "" : ` · ${network}`} · état : ${state}`,
      holder: "Titulaire",
      holderLine: (role: string, country: string) => `${role} · ${country}`,
      memberMessage: "Message qui sera envoyé au membre",
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
          badge_lifecycle: "Péremption des badges",
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
    legalNameUnset: "non demandée",
    tableLabel: "Entrées de la file Profils marque à valider",
    columns: {
      state: "État",
      due: "Échéance",
      kind: "Origine",
      brand: "Marque",
      legalName: "Raison sociale",
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
    /** Queue 4 joins the dashboard (L2E-21): each warning names its queue. */
    escalatedOf: (name: string, words: string) => `${name} : ${words}`,
    seeEscalatedOf: (name: string) => `Voir les entrées hors délai — ${name}`,
    openOf: (name: string) => `Ouvrir la file ${name}`,
    error: "Les compteurs de la file n’ont pas pu être chargés.",
  },
  /**
   * L2E-21 (08 RG61 to RG66, RG98, CA42 to CA44; 17b §3.7; l2e-fiche invariant 10): queue 4, one table
   * seen as two lists, creators and brands, never a mixed screen. A state is written, the colour only
   * underlines it. The list carries no handle, no figure, no code (the dossier of the opening has them).
   */
  verificationQueue: {
    creators: {
      lead: "Demandes de badge des créateurs, réseau par réseau : propriété du compte, puis audience. Ouvrir une demande la prend en charge ; vous constatez vous-même, puis vous accordez ou vous refusez avec un motif.",
      tableLabel: "Demandes de la file Vérifications des créateurs",
      overdueTableLabel:
        "Demandes de la file Vérifications des créateurs dont le SLA est dépassé",
      openEntryOf: (name: string) => `Ouvrir la demande de ${name}`,
      unnamed: "Créateur sans alias",
    },
    brands: {
      lead: "Demandes de badge des marques : domaine du site, puis immatriculation au registre public. Ouvrir une demande la prend en charge ; vous constatez vous-même, puis vous accordez ou vous refusez avec un motif.",
      tableLabel: "Demandes de la file Vérifications des marques",
      overdueTableLabel:
        "Demandes de la file Vérifications des marques dont le SLA est dépassé",
      openEntryOf: (name: string) => `Ouvrir la demande de ${name}`,
      unnamed: "Marque sans nom",
    },
    columns: {
      state: "État",
      due: "SLA",
      level: "Niveau",
      network: "Réseau",
      creator: "Créateur",
      brand: "Marque",
      country: "Pays",
      submitted: "Déposée le",
      opened: "Ouverte par",
      age: "Ancienneté",
      owner: "Responsable",
      holder: "Verrou",
    },
    openedBy: {
      member: "le membre",
      agent: "l’équipe",
    },
    levels: {
      account_verified: "Compte vérifié",
      audience_verified: "Audience vérifiée",
      brand_verified: "Marque vérifiée",
    },
    networks: {
      instagram: "Instagram",
      tiktok: "TikTok",
      youtube: "YouTube",
      facebook: "Facebook",
      linkedin: "LinkedIn",
      x: "X",
      snapchat: "Snapchat",
      twitch: "Twitch",
      pinterest: "Pinterest",
      threads: "Threads",
    } as Readonly<Record<string, string>>,
    noNetwork: "—",
    /** The filters of 08 RG62 that the common bar does not carry. */
    filters: {
      sort: "Tri",
      level: "Niveau",
      network: "Réseau",
      reexamine: "À réexaminer",
      reexamineOnly: "À réexaminer seulement",
    },
    sorts: {
      age: "Ancienneté, la plus ancienne d’abord",
      sla: "SLA restant",
      level: "Niveau demandé",
      network: "Réseau",
    },
    /** The reading of the sort in force, over the table (RG62). */
    sortedBy: {
      age: "triée par ancienneté, la plus ancienne d’abord",
      sla: "triée par SLA restant",
      level: "triée par niveau demandé",
      network: "triée par réseau",
    },
    resultsSorted: (count: number, sort: string) =>
      `${count} ${count > 1 ? "demandes" : "demande"} · ${sort}`,
    /** RG63, RG55: informative, never a refusal; the gap between declared and observed exists after the typing only. */
    alerts: {
      prior_rejections: "Refus antérieurs sur ce réseau et ce niveau",
      same_handle_elsewhere: "Un autre compte déclare le même identifiant",
      handle_verified_elsewhere:
        "Cet identifiant porte déjà un badge sur un autre compte",
    },
    reexamine: (reason: string, since: string) =>
      `À réexaminer : ${reason}, depuis ${since}`,
    reexamineReasons: {
      network_unreachable: "réseau injoignable",
      evidence_technical: "pièce inexploitable techniquement",
      registry_unavailable: "registre indisponible",
      storage_unavailable: "stockage indisponible",
    },
    /** RG64: a second agent reads « En cours — {prénom} » and cannot decide; never a technical error. */
    lock: {
      free: "libre",
      held: (name: string) => `En cours — ${name}`,
      heldByMe: "En cours — vous",
      unknown: "En cours — un collègue",
    },
    /** CA42: the entries past their deadline, in a list of their own, still decidable and marked. */
    overdueTitle: "SLA dépassé",
    overdueNote:
      "Ces demandes ont dépassé leur échéance. Elles restent décidables : la décision est alors marquée tardive.",
    otherTitle: "Dans les délais",
    /** CA44: an empty queue says when the last request was handled, and differs from a queue in error. */
    empty: "Aucune demande en attente.",
    emptySince: (age: string) =>
      `Aucune demande en attente — la dernière a été traitée il y a ${age}.`,
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
  /**
   * L2E-22 (08 RG43 to RG55, RG56 to RG59, CA25 to CA33; 17b §3.7; modele §5): the decision screen of a
   * creator's request, queue 4. The sentences sent to the creator are never written here: they come from
   * apps/api with the reasons, from the very files of the e-mail (what the agent reads is what is sent).
   * The labels of the closed lists are the « Motif » column of 08 RG57 and the reasons of modele §5.
   */
  verificationReview: {
    titleCreator: (network: string, level: string) =>
      `Vérification ${network} — ${level}`,
    titleBrand: (name: string) => `Vérification de la marque — ${name}`,
    subtitle: (submittedAt: string) => `Demande déposée le ${submittedAt}`,
    back: "Retour à la file",
    loading: "Ouverture de la demande…",
    errors: {
      forbidden:
        "Vous n’avez pas le droit d’ouvrir cette demande. La tentative a été enregistrée. Rôle requis : commercial ou administrateur.",
      conflictOfInterest:
        "Cette demande est celle d’un compte dont vous êtes le responsable : vous ne pouvez ni la lire ni la décider. Un autre commercial la traitera.",
      notFound: "Cette demande n’existe pas ou n’est plus disponible.",
      unavailable:
        "La demande n’a pas pu être ouverte. Rien n’a été modifié. Réessayez dans quelques minutes.",
    },
    notices: {
      heldByOther:
        "Un collègue vient de prendre cette demande en charge : elle est maintenant en lecture seule. Votre saisie est conservée.",
      lifted:
        "Votre prise en charge a été levée par un administrateur. La demande est rouverte, relisez-la avant de décider. Votre saisie est conservée.",
      notHeld:
        "Votre prise en charge n’était plus valable. La demande est rouverte, relisez-la avant de décider. Votre saisie est conservée.",
      stale:
        "Le dossier a changé depuis votre lecture : il est relu ci-dessous et rien n’a été enregistré. Relisez-le, puis décidez de nouveau. Votre saisie est conservée.",
      closed:
        "Cette demande a été clôturée entre-temps : rien n’a été enregistré.",
      accountUnavailable:
        "Le compte n’est plus actif : rien n’a été enregistré. Refusez avec le motif « Compte suspendu ou en cours de suppression ».",
      lifted_by_you: (holder: string) =>
        `Le verrou de ${holder} est levé et vous avez pris la demande en charge.`,
      liftedNoName:
        "Le verrou est levé et vous avez pris la demande en charge.",
    },
    sections: {
      request: "La demande",
      evidence: "Les pièces",
      procedure: "Ce qu’il faut constater",
      record: "Ce que je constate",
      comparison: "Écarts avec le déclaré",
      decision: "Décision",
    },
    facts: {
      creator: "Créateur",
      country: "Pays",
      language: "Langue du compte",
      owner: "Responsable",
      network: "Réseau",
      level: "Niveau demandé",
      handle: "Identifiant déclaré",
      profile: "Profil public",
      submitted: "Déposée le",
      codeExpiry: "Le code à chercher expire le",
    },
    /** D83 A: who opened the request, and why (agents only; the member read the e-mail that told him). */
    opening: {
      title: "Origine de la demande",
      member: "Ouverte par le membre lui-même.",
      agent: "Ouverte par l’équipe INFLUX, depuis la fiche du compte.",
      reason: (reason: string) => `Motif : ${reason}.`,
      comment: "Commentaire interne :",
    },
    unset: "non renseigné",
    noOwner: "aucun",
    handleHelp:
      "Pour retrouver le compte : jamais une valeur à recopier. Vous tapez ce que vous lisez.",
    profileLink: "Ouvrir le profil public (nouvel onglet, sans être connecté)",
    profileNoLink: "Aucun lien de profil public n’est enregistré.",
    badges: {
      title: "Badges déjà détenus",
      none: "Aucun badge n’a encore été accordé sur ce compte.",
      line: (
        level: string,
        network: string | null,
        state: string,
        at: string,
      ) =>
        `${level}${network === null ? "" : ` — ${network}`} · ${state} · accordé le ${at}`,
      expires: (at: string) => `échéance le ${at}`,
      states: {
        active: "actif",
        to_refresh: "à rafraîchir",
        to_reconfirm: "à reconfirmer",
        expired: "expiré",
        revoked: "retiré",
        replaced: "remplacé",
      },
    },
    history: {
      title: "Historique des demandes et des refus",
      none: "Aucune demande antérieure sur ce compte.",
      tableLabel: "Demandes antérieures de ce compte",
      columns: {
        level: "Niveau",
        status: "État",
        submitted: "Déposée le",
        decided: "Décidée le",
        reason: "Motif",
      },
      statuses: {
        draft: "brouillon",
        pending: "en file",
        approved: "accordée",
        rejected: "refusée",
        cancelled: "annulée",
        expired: "expirée",
        closed: "close",
      },
      noReason: "—",
    },
    alerts: {
      title: "Alertes",
      none: "Aucune alerte sur cette demande.",
      intro: "Les alertes informent : aucune ne bloque la décision.",
      prior_rejections: (count: number) =>
        `${count} ${count > 1 ? "refus antérieurs" : "refus antérieur"} sur ce réseau et ce niveau.`,
      same_handle_elsewhere: (accounts: number) =>
        accounts > 1
          ? `${accounts} autres comptes déclarent le même identifiant.`
          : "Un autre compte déclare le même identifiant.",
      handle_verified_elsewhere:
        "Cet identifiant porte déjà un badge sur un autre compte : un second constat est escaladé à un administrateur, sans badge.",
    },
    reexamineMark: (reason: string, since: string) =>
      `À réexaminer : ${reason}, depuis ${since}.`,
    procedure: {
      admissibility:
        "Avant tout : un compte suspendu ou en cours de suppression se refuse avec le motif « Compte suspendu ou en cours de suppression » ; un élément du dossier qui contredit la majorité arrête tout, avec le motif « Créateur mineur ».",
      ownership: [
        "Ouvrez le profil public du réseau dans un nouvel onglet, sans être connecté au réseau.",
        "Cherchez le code INFLUX- suivi de huit signes dans la présentation du profil, publique et visible.",
        "Tapez ci-dessous l’identifiant que vous voyez et le code que vous lisez : INFLUX compare lui-même le code à celui de la demande, il ne s’affiche jamais ici.",
      ],
      ownershipNever:
        "Vous ne prolongez jamais, ne devinez jamais et ne contactez jamais le créateur hors de la plateforme. Code absent, différent ou profil inaccessible : refusez avec le motif qui correspond.",
      audience: [
        "La pièce montre le tableau de bord natif du réseau, pas un partage ni l’outil d’un tiers.",
        "L’identifiant visible correspond à celui du compte, et la période affichée est lisible et récente.",
        "La pièce ne montre aucune donnée de tiers au-delà des instructions de capture (sinon refus, et la pièce est supprimée) ni signe de retouche (sinon refus et escalade).",
      ],
      audiencePrerequisite:
        "L’audience ne se constate que sur un compte déjà vérifié sur ce réseau : sans badge « Compte vérifié » sur la même ligne, le serveur refuse l’octroi.",
    },
    evidence: {
      lead: "Chaque ouverture d’une pièce est enregistrée individuellement, à votre nom, une ligne par ouverture.",
      none: "Aucune pièce n’a été déposée.",
      noneSuggestion:
        "Motif de refus suggéré : « Pièce absente ». Le refus n’est jamais automatique.",
      pieceTitle: (at: number, total: number) => `Pièce ${at}/${total}`,
      open: (at: number, total: number) =>
        `Ouvrir la pièce ${at}/${total} (journalisée)`,
      openedLine: (at: number, total: number) =>
        `Pièce ${at}/${total} ouverte : cette ouverture est journalisée.`,
      close: "Fermer la pièce",
      loading: "Chargement de la pièce…",
      alt: (at: number, total: number) =>
        `Pièce ${at} sur ${total} déposée par le créateur, en lecture seule`,
      dimensions: (width: number, height: number) => `${width} × ${height} px`,
      readOnly:
        "Image affichée ici seulement : elle n’est ni téléchargeable ni ouverte hors du backoffice.",
      failed:
        "Cette pièce n’a pas pu être lue. L’identifiant de la pièce est inconnu ou son fichier manque : refusez avec le motif « Pièce illisible, rognée ou incomplète » si elle est inutilisable.",
      blocked:
        "Les pièces ne peuvent pas être affichées. Le stockage ne répond pas pour l’instant.",
      blockedGrant:
        "Accorder est bloqué : on ne décide pas d’un badge sans avoir vu la pièce. Réessayez d’ouvrir la pièce, refusez avec un motif, ou marquez la demande « à réexaminer » (stockage indisponible).",
      mustOpen:
        "Ouvrez au moins une pièce avant d’accorder : on ne décide pas d’un badge sans avoir vu la pièce.",
    },
    record: {
      lead: "Saisi par vous, jamais pré-rempli : vous tapez ce que vous lisez. Les chiffres déclarés par le créateur ne s’affichent qu’après votre saisie.",
      handleAccount: "Identifiant constaté sur le profil",
      handleAudience: "Identifiant constaté sur la pièce",
      code: "Code lu sur le profil",
      codeHelp: "INFLUX- suivi de huit signes, tel que vous le lisez.",
      followers: "Abonnés constatés",
      followersHelp: "Lus sur la pièce.",
      periodLegend: "Période affichée sur la pièce",
      periodStart: "Du",
      periodEnd: "Au",
      posts: "Publications des 30 derniers jours",
      postsHelp: "Sur le profil public, ni stories ni directs.",
      comments: "Commentaires moyens par publication",
      commentsHelp: "Sur les 12 dernières publications, hors jeux-concours.",
      engagement: "Engagement constaté (facultatif), en %",
      engagementHelp: "Laissez vide s’il n’est pas lisible.",
      today: "Date du constat : aujourd’hui (automatique).",
      priority: "Les trois chiffres prioritaires, dans cet ordre",
    },
    problems: {
      handle: "Saisissez l’identifiant que vous constatez.",
      code: "Saisissez le code lu sur le profil : INFLUX- suivi de huit signes.",
      codeShape:
        "Ce n’est pas la forme d’un code INFLUX : INFLUX- suivi de huit signes, sans 0, 1, I, L ni O.",
      codeMismatch:
        "Le code saisi ne correspond pas à celui de cette demande. Relisez-le sur le profil ; s’il est absent ou différent, refusez avec le motif « Compte non prouvé ».",
      handleInvalid:
        "L’identifiant constaté est refusé : 100 caractères au plus.",
      followers:
        "Saisissez les abonnés constatés : un nombre entier, zéro admis.",
      posts:
        "Saisissez les publications des 30 derniers jours : un nombre entier, zéro admis.",
      comments:
        "Saisissez les commentaires moyens : un nombre entier, zéro admis.",
      engagement:
        "L’engagement est un pourcentage de 0 à 100, deux décimales au plus.",
      period: "Saisissez les deux dates de la période affichée.",
      periodOrder:
        "La période doit commencer au plus tard le jour où elle finit.",
      periodRefused:
        "La période est refusée : elle ne doit pas finir dans le futur, et sa fin doit être assez récente. Sinon refusez avec le motif « Pièce trop ancienne ».",
      figuresRefused: "Un des chiffres est refusé : relisez-les.",
      prerequisite:
        "Ce compte n’a pas de badge « Compte vérifié » sur ce réseau : l’audience ne peut pas être accordée. Refusez avec le motif « Audience demandée sans propriété établie ».",
      missingEvidence:
        "Aucune pièce active n’est attachée à la demande : refusez avec le motif « Pièce absente ».",
      declaredFigures:
        "Le créateur n’a pas déclaré ses chiffres sur cette ligne : le serveur ne peut rien comparer. Refusez avec un motif, ou marquez la demande « à réexaminer ».",
      blocked:
        "Le stockage des pièces ne répond pas : la décision est bloquée tant qu’une pièce n’a pas pu être vue.",
    },
    comparison: {
      button: "Comparer avec le déclaré",
      stale:
        "Vos chiffres ont changé depuis la dernière comparaison : comparez de nouveau.",
      lead: "Information interne : cet écart n’est jamais publié, jamais envoyé, et ne refuse rien.",
      tableLabel: "Chiffres déclarés, constatés et écart",
      columns: {
        figure: "Chiffre",
        declared: "Déclaré",
        observed: "Constaté",
        gap: "Écart",
      },
      figures: {
        followers: "Abonnés",
        postsLast30Days: "Publications (30 jours)",
        avgComments: "Commentaires moyens",
        engagementBp: "Engagement",
      },
      notDeclared: "non déclaré",
      notTyped: "non saisi",
      noGap: "aucun écart",
      alert: (percent: number) =>
        `Alerte interne : au moins un écart dépasse ${percent} %. Elle informe, elle ne refuse rien.`,
      noAlert: (percent: number) => `Aucun écart ne dépasse ${percent} %.`,
    },
    decision: {
      lead: "Deux issues : accorder, ou refuser avec un motif typé. « À réexaminer » laisse la demande dans la file et son ancienneté court. La décision porte sur le dossier affiché ici.",
      readOnly:
        "Lecture seule : la décision appartient à la personne qui a pris la demande en charge.",
      release: "Je rends la main",
      grantAccount: "Accorder « Compte vérifié »",
      grantAudience: "Accorder « Audience vérifiée »",
      reject: "Refuser avec motif",
      reexamine: "À réexaminer",
      comment: "Commentaire interne (facultatif, 1 000 caractères au plus)",
      commentHelp:
        "Visible des seuls agents INFLUX : jamais du créateur, ni dans l’e-mail.",
      commentTooLong: "Le commentaire dépasse 1 000 caractères.",
      busy: "Enregistrement…",
      cancel: "Annuler",
      expiryAudience:
        "Le badge Audience périme : il est daté de la décision et devra être rafraîchi à son échéance (durée de validité en réglage, 90 jours au départ).",
      expiryAccount: "Le badge « Compte vérifié » n’a pas d’échéance.",
      notAffirm:
        "Ce badge n’affirme ni l’authenticité des abonnés, ni la performance.",
      grantTitle: "Accorder ce badge ?",
      grantRecapAccount: (network: string, handle: string, language: string) =>
        `Le badge « Compte vérifié » sera accordé pour ${network}, sur l’identifiant ${handle} que vous avez constaté, et le créateur en sera informé par e-mail, en ${language}.`,
      grantRecapAudience: (
        network: string,
        handle: string,
        figures: string,
        language: string,
      ) =>
        `Le badge « Audience vérifiée » sera accordé pour ${network}, sur l’identifiant ${handle}, avec les chiffres que vous avez constatés : ${figures}. Le créateur en sera informé par e-mail, en ${language}.`,
      figuresLine: (
        followers: string,
        posts: string,
        comments: string,
        start: string,
        end: string,
      ) =>
        `${followers} abonnés, ${posts} publications sur 30 jours, ${comments} commentaires moyens, période du ${start} au ${end}`,
      commentRecap: "Commentaire interne joint :",
      grantConfirm: "Confirmer l’octroi",
      reasonTitle: "Refuser cette demande",
      reasonLegend: "Motif du refus (liste fermée)",
      reasonRequired: "Choisissez un motif avant de refuser.",
      reasonConfirm: "Refuser",
      messageToCreator: "Message envoyé au créateur :",
      nextStep: "Ce que le créateur pourra faire :",
      nextStepNone: "Rien n’est ajouté.",
      escalates:
        "Ce motif est escaladé à un administrateur en plus du refus : c’est un signal sur le compte.",
      purges: "La pièce est supprimée immédiatement.",
      stop: "Ce motif arrête toute la procédure : aucun badge, aucun recours au MVP, et un administrateur est alerté. Vous ne poursuivez aucun examen.",
      stopConfirm:
        "Je confirme l’arrêt de la procédure pour un créateur mineur.",
      stopRequired: "Confirmez l’arrêt avant de refuser pour ce motif.",
      ownMessage: "Message au créateur (20 à 500 caractères, sans coordonnée)",
      ownMessageHelp:
        "Ce texte est envoyé tel quel au créateur, à la suite de la phrase ci-dessus.",
      ownCount: (length: number, max: number, min: number) =>
        `${length} / ${max} caractères (${min} au moins).`,
      messageTooShort:
        "Le message au créateur doit compter au moins 20 caractères.",
      messageTooLong: "Le message au créateur dépasse 500 caractères.",
      directContact:
        "Le message contient une adresse, un numéro ou un lien : retirez-le, les coordonnées ne passent pas par ce message.",
      invalidReason:
        "Le motif choisi n’est pas valide. Choisissez-en un autre.",
      invalidMessage:
        "Le message au créateur est refusé : longueur ou contenu invalide.",
      invalidComment:
        "Le commentaire interne est refusé : 1 000 caractères au plus.",
      reexamineTitle: "Marquer cette demande « à réexaminer »",
      reexamineLead:
        "Seulement quand l’examen est matériellement impossible du fait d’INFLUX ou d’un tiers. La demande reste dans la file, son ancienneté continue de courir, aucun commentaire n’est joint.",
      reexamineLegend: "Motif interne (liste fermée)",
      reexamineRequired: "Choisissez un motif interne avant de marquer.",
      reexamineConfirm: "Marquer à réexaminer",
      reexamineReasons: {
        network_unreachable: "Réseau injoignable",
        evidence_technical: "Pièce inexploitable techniquement",
        registry_unavailable: "Registre public indisponible",
        storage_unavailable: "Stockage indisponible",
      },
      grantedNotice: (level: string, network: string) =>
        `${level} accordé pour ${network}. Le créateur en est informé par e-mail.`,
      alreadyVerified:
        "Cet identifiant porte déjà un badge sur un autre compte : aucun badge n’est accordé. Les deux demandes sont escaladées à un administrateur.",
      refusedNotice: (network: string, reason: string) =>
        `Demande ${network} refusée — ${reason}. Le créateur en est informé par e-mail.`,
      closedNotice: (network: string, reason: string) =>
        `Demande ${network} close — ${reason}. Le créateur en est informé par e-mail.`,
      escalatedMark: "Elle est escaladée à un administrateur.",
      reexaminedNotice: (network: string) =>
        `Demande ${network} marquée « à réexaminer » : elle reste dans la file.`,
      lateMark:
        "Décision prise après l’échéance : elle est marquée comme telle.",
      reasonLabels: {
        missing_evidence: "Pièce absente",
        evidence_too_old: "Pièce trop ancienne",
        evidence_unreadable: "Pièce illisible, rognée ou incomplète",
        evidence_wrong_source: "Source non acceptée",
        evidence_too_wide: "Pièce non conforme aux instructions de capture",
        ownership_not_proven: "Compte non prouvé",
        account_not_public: "Compte non consultable publiquement",
        ownership_prerequisite: "Audience demandée sans propriété établie",
        evidence_inconsistent: "Incohérence entre les pièces",
        evidence_suspected_forgery: "Soupçon de document modifié",
        shared_account: "Compte partagé entre plusieurs personnes",
        agency_managed: "Compte géré par une agence",
        terms_breach: "Profil non conforme aux CGU",
        minor: "Créateur mineur",
        account_unavailable: "Compte suspendu ou en cours de suppression",
        other: "Autre — message rédigé par vous",
        domain_code_not_found: "Code introuvable sur le domaine",
        registration_not_found: "Immatriculation introuvable",
        registration_unverifiable_country:
          "Immatriculation non vérifiable dans ce pays",
        name_mismatch: "Raison sociale différente du registre",
      } as Readonly<Record<string, string>>,
    },
    /**
     * L2E-23 (06 RG46 to RG52, RG61, CA28, CA29; 17b §3.7; l2e/modele.md §5): the decision screen of a brand's
     * request. Nothing in common with the creator's (no piece, no handle, no figure): a domain and a code to
     * find online, a legal name and a number to find in a public register. The messages to the brand are never
     * written here: they come from apps/api with the reasons (what the agent reads is what is sent).
     */
    brand: {
      facts: {
        brand: "Marque (nom commercial)",
        domain: "Domaine déclaré",
        domainHelp:
          "Pour retrouver le site : jamais une valeur à recopier. Vous tapez ce que vous lisez.",
        legalName: "Raison sociale (bloc interne)",
        registrationCountry: "Pays d’immatriculation",
        registrationNumber: "Numéro d’immatriculation",
        detailsHelp:
          "À chercher dans le registre public : vous constatez vous-même la correspondance, jamais une capture fournie par la marque.",
        detailsMissing: "Le bloc interne n’est pas renseigné.",
        unset: "non renseigné",
      },
      procedure: {
        admissibility:
          "Avant tout : un compte suspendu ou en cours de suppression se refuse avec le motif « Compte suspendu ou en cours de suppression ».",
        steps: [
          "Ouvrez le site de la marque, ou interrogez les enregistrements DNS de son domaine : le code INFLUX- suivi de huit signes se trouve dans un enregistrement TXT du domaine, ou sur une page du domaine ou d’un de ses sous-domaines.",
          "Tapez ci-dessous le domaine où vous l’avez lu, la façon dont il est publié et le code lu : INFLUX compare lui-même le code à celui de la demande, il ne s’affiche jamais ici.",
          "Ouvrez la source du registre public ci-dessous, dans un nouvel onglet, et cherchez la raison sociale et le numéro d’immatriculation affichés plus haut : la raison sociale doit correspondre à celle du registre.",
          "Choisissez la source que vous avez consultée : vous ne la saisissez jamais librement.",
        ],
        never:
          "Vous ne demandez jamais de capture d’écran à la marque et ne la contactez jamais hors de la plateforme : une capture se fabrique. Code absent ou registre sans l’immatriculation : refusez avec le motif qui correspond ; il n’existe aucun badge dégradé.",
        sourcesLink: "Voir toutes les sources de registre (lecture seule)",
      },
      source: {
        title: "Registre public à consulter",
        none: "Aucune source de registre n’est active pour ce pays.",
        noneAction:
          "Refusez avec le motif « Immatriculation non vérifiable dans ce pays » : il n’y a pas de badge dégradé, et une nouvelle demande reste possible dès qu’une source est ajoutée par un administrateur.",
        open: (name: string) => `Ouvrir ${name} (nouvel onglet)`,
        noLink: "adresse non ouvrable depuis cet écran",
        line: (name: string, type: string, checkedOn: string) =>
          `${name} — ${type}, page contrôlée le ${checkedOn}`,
        /** L2F-21: the register of a State of the country, named after its code (ISO 3166-2). */
        state: (code: string) => `État ${code}`,
        types: {
          national: "registre national",
          e_justice: "portail européen e-Justice",
          gleif: "base mondiale des identifiants LEI (GLEIF)",
        },
      },
      record: {
        proofLegend: "Comment la maîtrise du domaine est-elle prouvée ?",
        proofLogin:
          "Par l’adresse de connexion du compte, sur le domaine de la marque (rien à saisir)",
        proofLoginHelp:
          "INFLUX lit lui-même l’adresse de connexion vérifiée du compte et contrôle qu’elle est sur le domaine déclaré, hors messagerie grand public. Elle ne s’affiche jamais ici. L’immatriculation reste à constater par vous.",
        proofCode:
          "Par un code publié sur le domaine (enregistrement DNS TXT ou page du site)",
        lead: "Saisi par vous, jamais pré-rempli : vous tapez ce que vous lisez. Le domaine déclaré ne sert qu’à retrouver le site.",
        domain: "Domaine où le code a été lu",
        domainHelp:
          "Le domaine de la marque ou un de ses sous-domaines, sans https:// ni chemin (ex. maison.example).",
        channelLegend: "Comment le code est publié",
        channels: {
          dns_txt: "Enregistrement DNS TXT du domaine",
          web_page: "Page du site de la marque",
        },
        code: "Code lu sur le domaine",
        codeHelp: "INFLUX- suivi de huit signes, tel que vous le lisez.",
        registryLegend: "Source du registre que vous avez consultée",
        registryHelp:
          "Parmi les sources de ce pays, et la base mondiale LEI en repli.",
      },
      problems: {
        proof: "Choisissez comment la maîtrise du domaine est prouvée.",
        loginIneligible: {
          unverified:
            "L’adresse de connexion du compte n’est pas vérifiée : elle ne prouve pas le domaine. Rien n’a été enregistré. Choisissez le code publié sur le domaine.",
          consumer_domain:
            "L’adresse de connexion du compte est une messagerie grand public : elle ne prouve pas le domaine. Rien n’a été enregistré. Choisissez le code publié sur le domaine.",
          other_domain:
            "L’adresse de connexion du compte n’est pas sur le domaine de la marque : elle ne le prouve pas. Rien n’a été enregistré. Choisissez le code publié sur le domaine.",
        } as Readonly<Record<string, string>>,
        domain: "Saisissez le domaine où vous avez lu le code.",
        domainShape:
          "Le domaine s’écrit en minuscules, sans https:// ni chemin : lettres, chiffres, points et tirets (3 à 100 signes).",
        domainRefused:
          "Ce domaine n’est ni celui de la marque ni un de ses sous-domaines. Relisez-le ; si le code n’est pas sur son domaine, refusez avec le motif « Code introuvable sur le domaine ».",
        channel:
          "Choisissez comment le code est publié : enregistrement DNS TXT ou page du site.",
        code: "Saisissez le code lu sur le domaine : INFLUX- suivi de huit signes.",
        codeMismatch:
          "Le code saisi ne correspond pas à celui de cette demande. Relisez-le sur le domaine ; s’il est absent ou différent, refusez avec le motif « Code introuvable sur le domaine ».",
        registry: "Choisissez la source du registre que vous avez consultée.",
        noSource:
          "Aucune source de registre n’est active pour ce pays : accorder est impossible. Refusez avec le motif « Immatriculation non vérifiable dans ce pays ».",
        noSourceRefused:
          "Cette source n’est plus active, ou le pays n’en a aucune : rien n’a été enregistré. Relisez le dossier ; sans source active, refusez avec le motif « Immatriculation non vérifiable dans ce pays ».",
        domainRequired:
          "La marque n’a pas de domaine sur son profil : rien n’a été enregistré. Refusez avec un motif, ou marquez la demande « à réexaminer ».",
        detailsRequired:
          "Le bloc interne de la marque est incomplet : rien n’a été enregistré. Refusez avec un motif, ou marquez la demande « à réexaminer ».",
      },
      decision: {
        grant: "Accorder « Marque vérifiée »",
        expiry:
          "Le badge « Marque vérifiée » est daté de la décision et périme : à renouveler à son échéance (durée de validité en réglage, 12 mois au départ).",
        notAffirm:
          "Ce badge n’affirme ni la solvabilité, ni le sérieux de la marque, ni la qualité de ses campagnes.",
        grantRecap: (
          domain: string,
          channel: string,
          source: string,
          language: string,
        ) =>
          `Le badge « Marque vérifiée » sera accordé : le code a été constaté sur ${domain} (${channel}), et l’immatriculation contrôlée dans la source « ${source} ». La marque en sera informée par e-mail, en ${language}.`,
        grantRecapByLogin: (source: string, language: string) =>
          `Le badge « Marque vérifiée » sera accordé : le domaine est prouvé par l’adresse de connexion vérifiée du compte (contrôlée par INFLUX, jamais affichée), et l’immatriculation contrôlée dans la source « ${source} ». La marque en sera informée par e-mail, en ${language}.`,
        messageToBrand: "Message envoyé à la marque :",
        nextStep: "Ce que la marque pourra faire :",
        ownMessage:
          "Message à la marque (20 à 500 caractères, sans coordonnée)",
        ownMessageHelp:
          "Ce texte est envoyé tel quel à la marque, à la suite de la phrase ci-dessus.",
        messageTooShort:
          "Le message à la marque doit compter au moins 20 caractères.",
        messageTooLong: "Le message à la marque dépasse 500 caractères.",
        invalidMessage:
          "Le message à la marque est refusé : longueur ou contenu invalide.",
        commentHelp:
          "Visible des seuls agents INFLUX : jamais de la marque, ni dans l’e-mail.",
        reexamineReasons: {
          registry_unavailable: "Registre public indisponible",
          network_unreachable: "Site de la marque injoignable",
        } as Readonly<Record<string, string>>,
        grantedNotice: (brand: string) =>
          `Marque vérifiée accordée à ${brand}. La marque en est informée par e-mail.`,
        refusedNotice: (brand: string, reason: string) =>
          `Demande de ${brand} refusée — ${reason}. La marque en est informée par e-mail.`,
        closedNotice: (brand: string, reason: string) =>
          `Demande de ${brand} close — ${reason}. La marque en est informée par e-mail.`,
        reexaminedNotice: (brand: string) =>
          `Demande de ${brand} marquée « à réexaminer » : elle reste dans la file.`,
      },
      closedMessage: "Texte de l’agent ajouté au message à la marque :",
    },
    closed: {
      approved: "Cette demande est close : le badge a été accordé.",
      rejected: "Cette demande est close : elle a été refusée.",
      closed: "Cette demande est close sans examen : compte indisponible.",
      other: "Cette demande n’est plus en file.",
      decidedBy: (name: string, at: string) => `Décidée par ${name}, le ${at}.`,
      decidedAt: (at: string) => `Décidée le ${at}.`,
      late: "Décision prise après l’échéance.",
      reason: (reason: string) => `Motif : ${reason}.`,
      message: "Texte du créateur ajouté au message :",
      comment: "Commentaire interne :",
    },
    shortcuts: {
      title: "Raccourcis de l’écran de décision",
      button: "Raccourcis",
      keys: "‹v› accorder (récapitulatif) · ‹r› refuser avec motif · ‹l› rendre la main · ‹Échap› fermer sans perdre la saisie · ‹?› raccourcis",
      grant: "ouvrir le récapitulatif de l’octroi (n’accorde jamais seul)",
      reject: "ouvrir le choix du motif (ne refuse jamais seul)",
      release:
        "rendre la main et revenir à la file (une confirmation d’abord si une saisie est en cours)",
      escape: "fermer le panneau en cours, sans perdre la saisie",
      help: "afficher ou masquer ce rappel",
    },
    release: {
      title: "Rendre la main ?",
      lead: "Ce que vous avez saisi sur cet écran (identifiant, chiffres, période, code, commentaire) sera perdu : rien n’en est gardé. La demande revient à la file.",
      confirm: "Rendre la main et perdre la saisie",
      keep: "Garder la demande",
    },
  },
  /**
   * L2F-19 (08 RG77, RG78, CA52 to CA54; 15 RG27 C1 to C8, RG29; 17b §2.7; jalons/l2f/modele.md §5):
   * queues 5 and 6 as lists, each its own sub-entry of the rail. A state is written, the colour only
   * underlines it. The lists carry no handle, no text of the creator, no figure (the dossier of the opening
   * has them, and its reading is journaled by apps/api).
   */
  disputeQueue: {
    lead: "Contestations d’un refus ou d’un retrait de badge, déposées par les créateurs dans leur fenêtre de recours. Ouvrir une contestation la prend en charge ; elle est tranchée par une autre personne que celle qui a décidé, ou, si l’équipe n’en compte qu’une, après un délai de réflexion.",
    tableLabel: "Contestations de la file Contestations de badge",
    overdueTableLabel:
      "Contestations de la file Contestations de badge dont le SLA est dépassé",
    openEntryOf: (name: string) => `Ouvrir la contestation de ${name}`,
    unnamed: "Créateur sans alias",
    columns: {
      state: "État",
      due: "SLA",
      kind: "Décision contestée",
      level: "Niveau",
      network: "Réseau",
      creator: "Créateur",
      country: "Pays",
      reason: "Motif du membre",
      submitted: "Déposée le",
      age: "Ancienneté",
      owner: "Responsable",
      holder: "Verrou",
    },
    kinds: { refusal: "Refus", revocation: "Retrait" },
    reasons: {
      misread: "Pièce ou profil mal lu",
      evidence_valid: "Pièce conforme aux consignes",
      reason_wrong: "Motif inadapté à la situation",
      other: "Autre raison",
    } as Readonly<Record<string, string>>,
    filters: {
      sort: "Tri",
      level: "Niveau",
      network: "Réseau",
      kind: "Décision contestée",
    },
    resultsSorted: (count: number, sort: string) =>
      `${count} ${count > 1 ? "contestations" : "contestation"} · ${sort}`,
    empty: "Aucune contestation en attente.",
    emptySince: (age: string) =>
      `Aucune contestation en attente — la dernière a été traitée il y a ${age}.`,
  },
  identifierQueue: {
    lead: "Identifiants de réseau modifiés par un créateur après la vérification de son compte. Le badge reste ; ouvrir l’entrée la prend en charge, puis vous constatez que c’est le même compte ou vous exigez une nouvelle preuve.",
    tableLabel: "Entrées de la file Identifiants modifiés à contrôler",
    overdueTableLabel:
      "Entrées de la file Identifiants modifiés à contrôler dont le SLA est dépassé",
    openEntryOf: (name: string) => `Ouvrir l’entrée de ${name}`,
    unnamed: "Créateur sans alias",
    columns: {
      state: "État",
      due: "SLA",
      network: "Réseau",
      creator: "Créateur",
      country: "Pays",
      changes: "Modifications",
      opened: "Ouverte le",
      lastChanged: "Dernière modification",
      age: "Ancienneté",
      owner: "Responsable",
      holder: "Verrou",
    },
    filters: { sort: "Tri", network: "Réseau" },
    changes: (count: number) =>
      `${count} ${count > 1 ? "modifications" : "modification"}`,
    resultsSorted: (count: number, sort: string) =>
      `${count} ${count > 1 ? "entrées" : "entrée"} · ${sort}`,
    empty: "Aucune entrée à contrôler.",
    emptySince: (age: string) =>
      `Aucune entrée à contrôler — la dernière a été traitée il y a ${age}.`,
  },
  /**
   * L2F-19 (08 RG77, RG78, RG98; 15 RG27 C1 to C8; 17b §2.4 to §2.6): what queues 5 and 6 share on their
   * decision screens (the banners, the refusals, the notices over the next entry). The sentences sent to the
   * creator are never written here: they come from apps/api, from the very files of the e-mail.
   */
  claimedReview: {
    back: "Retour à la file",
    loading: "Ouverture du dossier…",
    decider:
      "Vous avez pris la décision contestée : une autre personne la tranchera. Vous pouvez seulement lire cette contestation.",
    readOnly:
      "Lecture seule : la décision appartient à la personne qui a pris le dossier en charge.",
    release: "Je rends la main",
    comment: "Commentaire interne (facultatif, 1 000 caractères au plus)",
    commentHelp:
      "Visible des seuls agents INFLUX : jamais du créateur, ni dans l’e-mail.",
    busy: "Enregistrement…",
    cancel: "Annuler",
    notices: {
      heldByOther:
        "Un collègue vient de prendre ce dossier en charge : il est maintenant en lecture seule. Votre saisie est conservée.",
      lifted:
        "Votre prise en charge a été levée par un administrateur. Le dossier est rouvert, relisez-le avant de décider. Votre saisie est conservée.",
      notHeld:
        "Votre prise en charge n’était plus valable. Le dossier est rouvert, relisez-le avant de décider. Votre saisie est conservée.",
      stale:
        "Le dossier a changé depuis votre lecture : il est relu ci-dessous et rien n’a été enregistré. Relisez-le, puis décidez de nouveau. Votre saisie est conservée.",
      closed: "Ce dossier a été clos entre-temps : rien n’a été enregistré.",
    },
    errors: {
      forbidden:
        "Vous n’avez pas le droit d’ouvrir ce dossier. La tentative a été enregistrée. Rôle requis : commercial ou administrateur.",
      conflictOfInterest:
        "Ce dossier est celui d’un compte dont vous êtes le responsable : vous ne pouvez ni le lire ni le décider. Un autre commercial le traitera.",
      notFound: "Ce dossier n’existe pas ou n’est plus disponible.",
      unavailable:
        "Le dossier n’a pas pu être ouvert. Rien n’a été modifié. Réessayez dans quelques minutes.",
    },
    refusals: {
      reviewerIsDecider:
        "Vous avez pris la décision contestée : une autre personne doit trancher. Rien n’a été enregistré.",
      reflectionDelay:
        "Le délai de réflexion n’est pas écoulé : le décideur d’origine ne peut trancher seul qu’à l’issue de ce délai. Rien n’a été enregistré.",
      restoreExpired: `Le badge ne peut pas être rendu : son échéance d’origine est passée. Confirmez la décision avec le motif « ${NEW_REQUEST_NEEDED} ».`,
      lineDeleted:
        "Le créateur a supprimé cette ligne de réseau : le dossier est clos, rien n’a été enregistré.",
      handleAlreadyVerified:
        "Cet identifiant porte déjà un badge sur un autre compte : rien n’a été enregistré.",
      badgeNotHolding:
        "Le badge concerné n’est plus tenu : le dossier a changé, relisez-le. Rien n’a été enregistré.",
      ownershipPrerequisite: `Le compte n’a pas de badge « Compte vérifié » actif sur ce réseau : l’audience ne peut pas être rendue. Confirmez la décision avec le motif « ${NEW_REQUEST_NEEDED} ».`,
      missingEvidence: `La pièce du refus n’est plus conservée : confirmez la décision avec le motif « ${NEW_REQUEST_NEEDED} ».`,
      // queue 6 (identifier changed): the proof is demanded there
      handleMismatch:
        "L’identifiant constaté ne correspond pas à l’identifiant que le créateur déclare. Relisez-le sur le profil ; s’il diffère, exigez une nouvelle preuve.",
      // queue 5 (dispute): no proof can be demanded, the decision is confirmed with the option below
      handleMismatchDispute: `L’identifiant constaté ne correspond pas à l’identifiant que le créateur déclare. Relisez-le sur le profil ; s’il diffère, confirmez la décision avec le motif « ${NEW_REQUEST_NEEDED} ».`,
      accountUnavailable:
        "Le compte n’est plus actif : rien n’a été enregistré.",
      // queue 2 (creator profiles)
      profileState:
        "Le profil n’est plus dans un état que cette entrée peut décider : rien n’a été enregistré. Relisez l’entrée ou rendez la main.",
      requiredFieldMissing:
        "Un champ obligatoire manque au profil, ou le portfolio est tombé sous trois visuels : la publication est impossible. Vous pouvez refuser avec un motif.",
      verifiedHandle:
        "Le pseudo d’une ligne porteuse d’un badge « Compte vérifié » actif se contrôle dans la file Identifiants modifiés : rien n’a été enregistré.",
      notReplaceable:
        "Un visuel de remplacement ne peut plus prendre la place de l’original : rien n’a été enregistré.",
    },
    shortcuts: {
      title: "Raccourcis de l’écran de décision",
      button: "Raccourcis",
      release:
        "rendre la main et revenir à la file (une confirmation d’abord si une saisie est en cours)",
      escape: "fermer le panneau en cours, sans perdre la saisie",
      help: "afficher ou masquer ce rappel",
    },
    late: "La décision est marquée tardive : le délai était dépassé.",
  },
  disputeReview: {
    title: (kind: string, network: string, level: string) =>
      `Contestation — ${kind} · ${network} — ${level}`,
    subtitle: (submittedAt: string) => `Contestation déposée le ${submittedAt}`,
    sections: {
      contest: "La contestation",
      decision: "La décision contestée",
      evidence: "Les pièces du refus",
      outcome: "Décision",
    },
    facts: {
      country: "Pays",
      language: "Langue du compte",
      owner: "Responsable",
      network: "Réseau",
      level: "Niveau",
      kind: "Décision contestée",
      reason: "Motif du membre",
      text: "Texte du membre",
      submitted: "Déposée le",
      deciders: "Décideur d’origine",
      creator: "Créateur",
      handle: "Identifiant déclaré",
      profile: "Profil public",
    },
    noText: "Le membre n’a pas écrit de texte.",
    noOwner: "aucun",
    unset: "non renseigné",
    handleHelp:
      "Pour retrouver le compte : jamais une valeur à recopier. Vous tapez ce que vous lisez.",
    profileLink: "Ouvrir le profil public (nouvel onglet, sans être connecté)",
    profileNoLink: "Aucun lien de profil public n’est enregistré.",
    mode: {
      independent:
        "Examen par une autre personne que celle qui a décidé : vous pouvez trancher.",
      delayed: (until: string) =>
        `L’équipe n’a pas d’autre personne : le décideur d’origine tranche seul, à partir du ${until}.`,
      delayedElapsed:
        "L’équipe n’a pas d’autre personne : le décideur d’origine tranche seul, le délai de réflexion est écoulé.",
    },
    refusal: {
      line: (reason: string, decidedAt: string) =>
        `Refus du ${decidedAt} : ${reason}.`,
      message: (text: string) => `Message envoyé au créateur : ${text}`,
      codeExpires: (at: string) =>
        `Le code de cette demande expirait le ${at} ; il n’est jamais montré.`,
    },
    revocation: {
      line: (reason: string, revokedAt: string) =>
        `Retrait du ${revokedAt} : ${reason}.`,
      granted: (grantedAt: string) => `Badge accordé le ${grantedAt}.`,
      expires: (expiresAt: string) => `Échéance d’origine : ${expiresAt}.`,
      noExpiry: "Ce badge n’a pas d’échéance.",
      message: (text: string) => `Message envoyé au créateur : ${text}`,
      cascade: (count: number) =>
        `${count} ${count > 1 ? "badges ont été retirés" : "badge a été retiré"} avec lui (l’audience tenue de la ligne).`,
    },
    decision: {
      lead: "Deux issues : confirmer la décision avec un motif, ou l’infirmer. L’infirmation donne une nouvelle date au badge et vous retapez ce que vous constatez : rien n’est pré-rempli.",
      uphold: "Confirmer la décision",
      overturn: "Infirmer",
      upholdTitle: "Confirmer la décision contestée",
      upholdLegend: "Motif de l’issue (liste fermée)",
      upholdRequired: "Choisissez un motif avant de confirmer.",
      upholdConfirm: "Confirmer la décision",
      messageToCreator: "Message envoyé au créateur :",
      ownMessage: "Message au créateur (20 à 500 caractères, sans coordonnée)",
      ownMessageHelp:
        "Ce texte est envoyé tel quel au créateur, à la suite de la phrase ci-dessus.",
      messageTooShort:
        "Le message au créateur doit compter au moins 20 caractères.",
      messageTooLong: "Le message au créateur dépasse 500 caractères.",
      directContact:
        "Le message contient une adresse, un numéro ou un lien : retirez-le, les coordonnées ne passent pas par ce message.",
      invalidMessage:
        "Le message au créateur est refusé : longueur ou contenu invalide.",
      invalidReason:
        "Le motif choisi n’est pas valide. Choisissez-en un autre.",
      invalidComment:
        "Le commentaire interne est refusé : 1 000 caractères au plus.",
      overturnTitle: "Infirmer la décision contestée",
      overturnLeadRefusalAccount:
        "Vous retrouvez le code sur le profil public et le tapez avec l’identifiant que vous lisez : le badge « Compte vérifié » est accordé à la date du jour.",
      overturnLeadRefusalAudience:
        "Vous tapez ce que vous lisez sur la pièce du refus : identifiant, chiffres et période. Le badge « Audience vérifiée » est accordé, sa validité comptée depuis le jour du refus.",
      overturnLeadRevocation:
        "Vous tapez l’identifiant que vous lisez sur le profil : le badge retiré est rendu avec son échéance d’origine, et l’audience qu’il emportait avec lui.",
      overturnConfirm: "Infirmer la décision",
      handle: "Identifiant constaté sur le profil",
      code: "Code lu sur le profil",
      codeHelp: "INFLUX- suivi de huit signes, tel que vous le lisez.",
      followers: "Abonnés constatés",
      posts: "Publications des 30 derniers jours",
      comments: "Commentaires moyens par publication",
      engagement: "Engagement constaté (facultatif), en %",
      engagementHelp: "Laissez vide s’il n’est pas lisible.",
      noOutcomeReason:
        "Aucun motif d’issue n’est servi : le dossier ne peut pas être confirmé ici.",
      outcomeLabels: {
        decision_confirmed: "Décision maintenue pour son motif initial",
        new_request_needed: NEW_REQUEST_NEEDED,
        other: "Décision maintenue, avec un message de l’équipe",
        decision_overturned: "Décision infirmée",
      } as Readonly<Record<string, string>>,
    },
    closed: {
      upheld: "Contestation tranchée : la décision est confirmée.",
      overturned: "Contestation tranchée : la décision est infirmée.",
      withdrawn: (cause: string) =>
        `Contestation close sans décision : ${cause}.`,
      causes: {
        superseded: "un badge du même niveau a été accordé entre-temps",
        line_deleted: "le créateur a supprimé la ligne de réseau",
        account_erased: "le compte a été effacé",
      } as Readonly<Record<string, string>>,
      decidedBy: (name: string, at: string) => `Décidée par ${name}, le ${at}.`,
      decidedAt: (at: string) => `Décidée le ${at}.`,
      modes: {
        independent:
          "Examinée par une autre personne que le décideur d’origine.",
        delayed:
          "Examinée par le décideur d’origine, après le délai de réflexion.",
      },
      reason: (label: string) => `Motif : ${label}.`,
      message: "Message envoyé au créateur :",
      comment: "Commentaire interne :",
    },
    evidence: {
      lead: "Les pièces du refus d’origine, tant qu’elles sont conservées. Chaque ouverture est une ligne nominative du registre.",
      none: "Aucune pièce n’est conservée pour ce refus.",
    },
    notices: {
      upheld: (kind: string, network: string) =>
        `Contestation du ${kind.toLowerCase()} (${network}) : décision confirmée, le créateur est informé.`,
      overturnedRefusal: (network: string) =>
        `Refus infirmé (${network}) : le badge est accordé à la date du jour, le créateur est informé.`,
      overturnedRevocation: (network: string) =>
        `Retrait infirmé (${network}) : le badge est rendu, le créateur est informé.`,
    },
    shortcuts: {
      keys: "‹v› infirmer (panneau) · ‹r› confirmer la décision (panneau) · ‹l› rendre la main · ‹Échap› fermer sans perdre la saisie · ‹?› raccourcis",
      overturn: "ouvrir le panneau d’infirmation (n’infirme jamais seul)",
      uphold: "ouvrir le choix du motif (ne confirme jamais seul)",
    },
  },
  identifierReview: {
    title: (network: string) => `Identifiant modifié — ${network}`,
    subtitle: (openedAt: string) => `Entrée ouverte le ${openedAt}`,
    sections: {
      change: "Le changement",
      badges: "Badges en cours",
      outcome: "Décision",
    },
    facts: {
      country: "Pays",
      language: "Langue du compte",
      owner: "Responsable",
      network: "Réseau",
      previous: "Ancien identifiant",
      current: "Nouvel identifiant",
      changes: "Modifications depuis l’ouverture",
      lastChanged: "Dernière modification",
      creator: "Créateur",
      profile: "Profil public",
    },
    internalOnly:
      "Ces identifiants sont internes : jamais affichés au public, jamais dans une liste ni dans le registre.",
    unknownPrevious: "inconnu",
    noOwner: "aucun",
    unset: "non renseigné",
    profileLink: "Ouvrir le profil public (nouvel onglet, sans être connecté)",
    profileNoLink: "Aucun lien de profil public n’est enregistré.",
    badges: {
      account: (state: string, grantedAt: string) =>
        `« Compte vérifié » : ${state}, accordé le ${grantedAt}.`,
      audience: (state: string, expires: string) =>
        `« Audience vérifiée » : ${state}, ${expires}.`,
      none: "Aucun badge n’est tenu sur cette ligne.",
      expires: (at: string) => `échéance le ${at}`,
      noExpiry: "sans échéance",
    },
    decision: {
      lead: "Deux issues : constater que c’est le même compte (le badge reste), ou exiger une nouvelle preuve (le badge passe à « à reconfirmer » jusqu’à la reconfirmation).",
      confirm: "Constater : même compte",
      requireProof: "Exiger une nouvelle preuve",
      confirmTitle: "Constater que c’est le même compte",
      confirmLead:
        "Vous tapez l’identifiant que vous lisez sur le profil public : il doit être celui que le créateur déclare. Le badge n’est pas réécrit et rien n’est envoyé au créateur.",
      confirmConfirm: "Constater le même compte",
      handle: "Identifiant constaté sur le profil",
      proofTitle: "Exiger une nouvelle preuve",
      proofLead:
        "Le badge « Compte vérifié » et l’audience tenue de cette ligne passent à « à reconfirmer » : ils cessent d’être affichés, et le créateur est invité par e-mail à refaire la preuve depuis son espace.",
      proofConfirm: "Exiger la preuve",
    },
    closed: {
      confirmed: "Entrée traitée : même compte constaté, le badge reste.",
      proof_required:
        "Entrée traitée : nouvelle preuve exigée, le badge est à reconfirmer.",
      withdrawn: (cause: string) => `Entrée close sans décision : ${cause}.`,
      causes: {
        reverted: "le créateur a repris l’ancien identifiant",
        line_deleted: "le créateur a supprimé la ligne de réseau",
        badge_ended: "le badge a pris fin",
        account_erased: "le compte a été effacé",
      } as Readonly<Record<string, string>>,
      decidedBy: (name: string, at: string) => `Décidée par ${name}, le ${at}.`,
      decidedAt: (at: string) => `Décidée le ${at}.`,
      comment: "Commentaire interne :",
    },
    notices: {
      confirmed: (network: string) =>
        `Identifiant constaté (${network}) : même compte, le badge reste.`,
      proof: (network: string) =>
        `Nouvelle preuve exigée (${network}) : le badge passe à « à reconfirmer », le créateur est informé.`,
    },
    shortcuts: {
      keys: "‹v› constater le même compte (panneau) · ‹r› exiger une nouvelle preuve (panneau) · ‹l› rendre la main · ‹Échap› fermer sans perdre la saisie · ‹?› raccourcis",
      confirm: "ouvrir le panneau du constat (ne constate jamais seul)",
      proof: "ouvrir la demande de preuve (n’exige jamais seule)",
    },
  },
  /**
   * L2G-15 (07 RG4 to RG10, RG93 to RG99; 17b §2.7 line 2; l2g/modele.md §6, textes.md §4): queue 2, the
   * creator profiles to validate, as a list. The list carries an alias, a country, network codes, a score and
   * the badges in force: never a handle, a link, a figure or a text of the creator (the decision screen holds
   * them, behind a logged opening). A state is written, the colour only underlines it.
   */
  creatorQueue: {
    lead: "Première soumission d’un profil créateur, ou modification d’un champ d’un profil publié : prenez l’entrée en charge, lisez-la, puis publiez ou refusez. La liste ne montre ni pseudo, ni lien, ni chiffre exact : l’écran de décision les montre à la personne qui a pris l’entrée en charge.",
    tableLabel: "Entrées de la file Profils créateur à valider",
    overdueTableLabel:
      "Entrées de la file Profils créateur à valider dont le délai est dépassé",
    columns: {
      state: "État",
      due: "Échéance",
      kind: "Origine",
      alias: "Alias",
      country: "Pays",
      networks: "Réseaux déclarés",
      completeness: "Complétude",
      badges: "Badges",
      modified: "Champs modifiés",
      owner: "Responsable",
      holder: "Verrou",
    },
    filters: {
      network: "Réseau",
      badge: "Badge",
      badgeOptions: { with: "Avec badge", without: "Sans badge" },
    },
    wholeProfile: "Tout le profil",
    none: "aucun",
    badgeOf: (level: string, network: string) => `${level} (${network})`,
    fields: {
      headline: "Titre court",
      bio: "Bio",
      portfolio_caption: "Légende d’un visuel",
      network_line: "Réseau ajouté",
      network_handle: "Pseudo",
      network_url: "Lien du profil",
    },
    alerts: {
      direct_contact: "Coordonnée possible dans un texte public",
    },
    openEntryOf: (alias: string) => `Ouvrir l’entrée de ${alias}`,
  },
  /**
   * L2G-15 (07 RG4 to RG10, RG16, RG84, RG93 to RG99; 15 RG27 C1 to C8, RG114 to RG117; 17b §2.4 to §2.6;
   * l2g/modele.md §1 points 6, 10, 12, §3 « 0244 », textes.md §4): the decision screen of a creator profile.
   * The sentences sent to the creator are never written here: they come from apps/api with the reasons, from
   * the very files of the e-mail (what the agent reads is what is sent). The labels of the closed list are the
   * « Motif » column of 07 RG96. The screen shows layer I (handle, link, exact figures) to the holder of the
   * entry only, behind a logged opening: it is marked, as the contact person of a brand is.
   */
  creatorReview: {
    title: (alias: string) => `Profil créateur — ${alias}`,
    subtitle: (kind: string, createdAt: string) =>
      `${kind} · créée le ${createdAt}`,
    mark: "▮",
    markerLabel: "vue identifiée, consultation enregistrée",
    parenthesized: (words: string) => `(${words})`,
    sections: {
      profile: "Le profil validé",
      lines: "Réseaux et chiffres exacts",
      written: "Ce qui a changé depuis la dernière validation",
      visuals: "Portfolio",
      alerts: "Alertes",
      decision: "Décision",
    },
    facts: {
      alias: "Alias public",
      status: "État du profil",
      firstPublished: "Première publication",
      completeness: "Complétude",
      country: "Pays",
      language: "Langue du compte",
      owner: "Responsable",
      headline: "Titre court",
      bio: "Bio",
      primaryTopic: "Thématique principale",
      secondaryTopics: "Thématiques secondaires",
      tones: "Tons",
      publicationLanguages: "Langues de publication",
      formats: "Formats",
      usageRights: "Droits d’usage acceptés",
      refusedSectors: "Secteurs refusés",
      residenceRegion: "Région de résidence",
      travelScope: "Déplacements",
      collaborationExperience: "Expérience de collaboration",
      deliveryLead: "Délai de livraison",
      maxExclusivity: "Exclusivité maximale",
      acceptsNonMonetary: "Contreparties non monétaires",
      availability: "Disponibilité",
    },
    statuses: {
      draft: "En cours de saisie",
      pending_review: "En attente de validation",
      published: "Publié",
      rejected: "Refusé",
      suspended: "Suspendu",
    } as Readonly<Record<string, string>>,
    inclusions: {
      included: "inclus",
      optional: "en option",
    } as Readonly<Record<string, string>>,
    /** The bands of the form (07 RG32, RG39, RG74, block 5), in the words the creator reads. */
    bands: {
      travelScope: {
        none: "Non",
        domestic: "Dans son pays",
        international: "À l’international",
      },
      collaborationExperience: {
        none: "Aucune",
        "1_5": "De 1 à 5",
        "6_20": "De 6 à 20",
        gt_20: "Plus de 20",
      },
      deliveryLead: {
        lt_7d: "Moins de 7 jours",
        "7_14d": "De 7 à 14 jours",
        "15_30d": "De 15 à 30 jours",
        gt_30d: "Plus de 30 jours",
      },
      maxExclusivity: {
        none: "Aucune",
        le_1m: "Jusqu’à 1 mois",
        le_3m: "Jusqu’à 3 mois",
        negotiable: "À discuter",
      },
      availability: {
        lt_2w: "Disponible sous moins de 2 semaines",
        lt_1m: "Disponible sous moins d’un mois",
        full: "Agenda plein",
      },
    } as Readonly<Record<string, Readonly<Record<string, string>>>>,
    yes: "oui",
    no: "non",
    unset: "non renseigné",
    none: "aucun",
    pendingChange:
      "modification proposée, voir « Ce qui a changé depuis la dernière validation »",
    lines: {
      lead: "Vue identifiée, réservée aux agents INFLUX : jamais d’une marque avant la mise en relation. L’ouverture de cet écran est enregistrée.",
      none: "Aucun réseau déclaré.",
      primary: "Réseau principal",
      listed: "Visible des marques",
      unlisted: "En attente de validation : pas encore visible des marques",
      facts: {
        status: "Statut",
        handle: "Pseudo",
        pseudonym: "Nom affiché",
        url: "Lien du profil",
        followers: "Abonnés",
        posts: "Publications sur 30 jours",
        comments: "Commentaires moyens par publication",
        reach: "Portée moyenne",
        engagement: "Taux d’engagement",
        source: "Source des chiffres",
        measuredAt: "Chiffres du",
        badge: "Badge",
      },
      sources: {
        declared: "déclarés par le créateur",
        agent_observed: "constatés par un agent INFLUX",
      } as Readonly<Record<string, string>>,
      engagement: (percent: string) => `${percent} %`,
      noBadge: "aucun",
    },
    written: {
      submission:
        "Première soumission : tout le profil est à examiner, aucune version validée n’existe encore.",
      none: "Aucune modification n’est en attente sur cette entrée.",
      columns: {
        field: "Champ",
        validated: "Version validée",
        proposed: "Version proposée",
      },
      tableLabel: "Modifications proposées en regard de la version validée",
      emptyValue: "(vide)",
      newLine: (network: string) => `Réseau ajouté : ${network}`,
      declared: "autorisation de citer une marque déclarée",
      notDeclared: "aucune marque citée",
      noneListed: "(pas encore visible des marques)",
      summary: (fields: string) =>
        `Champs modifiés depuis la dernière validation : ${fields}.`,
    },
    visuals: {
      lead: "Les visuels ne se modèrent pas ici : chacun a sa décision dans la file « Visuels de portfolio à modérer ». Un profil se publie sans visuel approuvé (carte sans image).",
      none: "Aucun visuel déposé.",
      states: {
        pending: "En attente de modération",
        approved: "Approuvé",
      } as Readonly<Record<string, string>>,
      order: (position: number) => `Visuel ${position}`,
      unordered: "Visuel en attente",
      captionLabel: "Légende :",
      separator: " · ",
      noCaption: "aucune légende",
      declared: "marque citée : autorisation déclarée",
      replacement: "remplace un visuel approuvé",
      dimensions: (width: number, height: number) => `${width} × ${height} px`,
      kilobytes: (kilobytes: number) => `${kilobytes} Ko`,
      deposited: (date: string) => `déposé le ${date}`,
      show: "Afficher le visuel",
      showHelp:
        "La lecture d’un visuel est enregistrée : n’affichez que ceux dont vous avez besoin.",
      alt: (position: string, alias: string) =>
        `${position} du portfolio de ${alias}`,
      loading: "Chargement du visuel…",
      failed:
        "Le visuel n’a pas pu être lu pour l’instant. La décision n’en dépend pas : réessayez avec le bouton.",
      holderOnly:
        "Les visuels ne sont lisibles que par la personne qui a pris l’entrée en charge.",
    },
    alerts: {
      none: "Aucune alerte sur cette entrée.",
      intro: "Les alertes informent : aucune ne bloque la décision.",
      direct_contact: (field: string, signals: string) =>
        `Coordonnée possible dans « ${field} » (${signals}).`,
      captionOf: (position: string) => `légende du ${position.toLowerCase()}`,
      fields: {
        headline: "Titre court",
        bio: "Bio",
        portfolio_caption: "Légende d’un visuel",
      } as Readonly<Record<string, string>>,
      signals: {
        email: "adresse e-mail",
        url: "lien",
        domain: "nom de domaine",
        phone: "numéro de téléphone",
        handle: "pseudo",
        messenger: "messagerie",
      } as Readonly<Record<string, string>>,
    },
    decision: {
      lead: "Deux issues : publier, ou refuser avec un motif. La décision porte sur la version affichée ici.",
      publish: "Publier",
      reject: "Refuser avec motif",
      busy: "Enregistrement…",
      publishTitle: "Publier ce profil ?",
      publishLead:
        "Le profil est publié tel qu’affiché ici ; les modifications en attente sont appliquées.",
      publishRecap: (alias: string, language: string) =>
        `Le profil de ${alias} sera publié, et le créateur en sera informé par e-mail, en ${language}.`,
      publishRevisions: (count: number) =>
        count === 1
          ? "Une modification en attente sera appliquée."
          : `${count} modifications en attente seront appliquées.`,
      publishConfirm: "Confirmer la publication",
      publishCommentRecap: "Commentaire interne joint :",
      publishFirst:
        "C’est la première publication de ce profil : il devient visible des marques sous son alias.",
      rejectTitle: "Refuser ce profil",
      rejectLead:
        "Le créateur reçoit par e-mail le motif et ce qu’il peut faire ensuite ; son profil reste modifiable et se soumet de nouveau sans délai.",
      reasonLegend: "Motif du refus (liste fermée)",
      reasonRequired: "Choisissez un motif avant de refuser.",
      reasonConfirm: "Refuser",
      messageToCreator: "Message envoyé au créateur :",
      nextStep: "Ce que le créateur pourra faire :",
      otherMessage:
        "Message au créateur (20 à 500 caractères, sans coordonnée)",
      otherMessageHelp:
        "Ce texte est envoyé tel quel au créateur, à la suite de la phrase ci-dessus.",
      otherCount: (length: number, max: number, min: number) =>
        `${length} / ${max} caractères (${min} au moins).`,
      otherTooShort:
        "Le message au créateur doit compter au moins 20 caractères.",
      otherTooLong: "Le message au créateur dépasse 500 caractères.",
      commentTooLong: "Le commentaire dépasse 1 000 caractères.",
      reasonLabels: {
        identifier_in_text: "Élément identifiant dans un texte",
        bio_insufficient: "Bio trop courte ou incompréhensible",
        portfolio_insufficient: "Portfolio insuffisant",
        portfolio_non_compliant: "Portfolio non conforme",
        network_link_inconsistent: "Handle ou lien incohérent",
        figures_inconsistent: "Chiffres manifestement incohérents",
        topic_inconsistent: "Thématique manifestement incohérente",
        illicit_content: "Contenu illicite ou contraire aux CGU",
        age_doubt: "Doute sur la majorité",
        other: "Autre — message rédigé par vous",
      } as Readonly<Record<string, string>>,
      publishedNotice: (alias: string) =>
        `Profil de ${alias} publié. Le créateur en est informé par e-mail.`,
      rejectedNotice: (alias: string, reason: string) =>
        `Profil de ${alias} refusé — ${reason}. Le créateur en est informé par e-mail.`,
      lateMark:
        "Décision prise après l’échéance : elle est marquée comme telle.",
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
      message: "Message reçu par le créateur :",
      comment: "Commentaire interne :",
    },
    shortcuts: {
      keys: "‹v› publier (récapitulatif) · ‹r› refuser avec motif · ‹l› rendre la main · ‹Échap› fermer sans perdre la saisie · ‹?› raccourcis",
      publish:
        "ouvrir le récapitulatif de la publication (ne publie jamais seul)",
      reject: "ouvrir le choix du motif (ne refuse jamais seul)",
    },
  },
  /**
   * L2E-23 (06 RG52, RG101; D79 (12); l2e/registres.md; 17b §3.11): the registry sources of the brand's
   * registration. Read by an agent, written by an administrator only; the former and the new value of every
   * change are in the register of the database, and shown here before the change is confirmed.
   */
  registrySources: {
    title: "Sources de registre",
    lead: "Les registres publics gratuits que l’agent consulte à la main pour contrôler l’immatriculation d’une marque : une source active par pays, la base mondiale LEI en repli. INFLUX n’interroge jamais ces pages.",
    leadAdmin:
      "Vous activez une source « à confirmer » après avoir contrôlé à la main que sa recherche est gratuite, et vous corrigez son nom, sa page ou son jour de contrôle. Chaque changement est journalisé avec l’ancienne et la nouvelle valeur.",
    leadAgent:
      "Lecture seule : seul un administrateur modifie une source. Une source manquante pour un pays se signale à un administrateur.",
    leadAddAdmin:
      "Vous ajoutez le registre d’un pays qui n’en a pas encore, ou celui d’un État (le code de l’État, par exemple US-CA, ou sa seule fin, CA) à côté du registre national du pays. Une seule source active par pays et par État.",
    error: "Les sources n’ont pas pu être chargées.",
    retry: "Réessayer",
    inactiveTitle: "À confirmer ou désactivées",
    inactiveNote:
      "Ces sources ne sont pas consultées par les agents : une marque de ce pays est refusée avec le motif « Immatriculation non vérifiable dans ce pays ». Un administrateur l’active après avoir contrôlé la gratuité à la main.",
    inactiveNone: "Aucune source inactive.",
    activeTitle: "Sources actives",
    activeNone: "Aucune source active.",
    tableLabel: (title: string) => `Registres : ${title}`,
    columns: {
      country: "Pays",
      name: "Source",
      type: "Type",
      checked: "Contrôlée le",
      updated: "Modifiée le",
      subdivision: "État",
      state: "Statut",
      action: "Action",
    },
    noSubdivision: "Tout le pays",
    allCountries: "Tous les pays (repli)",
    types: {
      national: "Registre national",
      e_justice: "Portail e-Justice",
      gleif: "Base LEI (GLEIF)",
    },
    state: { active: "Active", inactive: "Inactive" },
    open: (name: string) => `Ouvrir ${name} (nouvel onglet)`,
    noLink: "adresse non ouvrable",
    edit: (name: string) => `Modifier ${name}`,
    editorTitle: (name: string) => `Modifier la source — ${name}`,
    countryLine: (country: string, subdivision: string | null) =>
      subdivision === null
        ? `Pays : ${country}`
        : `Pays : ${country} ; État : ${subdivision}`,
    add: {
      open: "Ajouter une source",
      title: "Ajouter une source de registre",
      lead: "Registre de type national, ajouté après avoir contrôlé à la main que sa recherche est gratuite. Rien n’est enregistré tant que vous n’avez pas confirmé.",
      country: "Pays",
      countryPlaceholder: "Choisir un pays",
      subdivision: "État (facultatif)",
      subdivisionHelp:
        "Laissez vide pour le registre de tout le pays. Pour un État : son code ISO 3166-2, par exemple US-CA, ou seulement sa fin, CA. Le code doit être celui d’un État du pays choisi.",
      review: "Voir la source à ajouter",
      reviewTitle: "Confirmer l’ajout de cette source ?",
      reviewLead:
        "Valeurs telles qu’elles seront journalisées. La source est de type « registre national ».",
      reviewTable: "Valeurs de la source à ajouter",
      reviewColumns: { field: "Champ", value: "Valeur" },
      confirm: "Confirmer l’ajout",
      added: (name: string, where: string) =>
        `Source « ${name} » ajoutée (${where}) : sa valeur est au journal.`,
      problems: {
        country: "Choisissez le pays de la source.",
        subdivision:
          "Le code de l’État doit être celui d’un État du pays choisi, par exemple US-CA, ou seulement sa fin, CA.",
        unknownCountry: "Ce pays n’est pas connu de la base.",
        unknownSubdivision:
          "Cet État n’est pas connu de la base pour ce pays : relisez son code.",
        activeExists:
          "Une autre source est déjà active pour ce pays et cet État : désactivez-la d’abord, ou ajoutez celle-ci inactive.",
      },
    },
    fields: {
      name: "Nom de la source",
      url: "Page de recherche (https)",
      urlHelp:
        "Une adresse https:// seulement, ouverte à la main par les agents : jamais un agrégateur privé ni une page payante à l’acte.",
      checkedOn: "Jour du contrôle à la main",
      checkedOnHelp:
        "Le jour où vous avez ouvert la page et lu que la recherche est gratuite : pas dans le futur.",
      active: "Source active : les agents la consultent",
      activeHelp:
        "Une seule source active par pays et par État : désactivez d’abord l’autre.",
    },
    review: "Voir le changement",
    reviewTitle: "Confirmer ce changement ?",
    reviewLead:
      "Ancienne et nouvelle valeur, telles qu’elles seront journalisées. Rien n’est enregistré tant que vous n’avez pas confirmé.",
    reviewTable: "Ancienne et nouvelle valeur de la source",
    reviewColumns: { field: "Champ", before: "Avant", after: "Après" },
    reviewNoChange: "Aucun champ n’a changé : il n’y a rien à enregistrer.",
    confirm: "Confirmer le changement",
    back: "Corriger",
    cancel: "Annuler",
    busy: "Enregistrement…",
    activeWords: { yes: "active", no: "inactive" },
    saved: (name: string) =>
      `Source « ${name} » enregistrée : l’ancienne et la nouvelle valeur sont au journal.`,
    problems: {
      name: "Le nom compte de 2 à 160 caractères, sans caractère de contrôle.",
      url: "L’adresse doit commencer par https:// et ne contenir ni espace ni caractère de contrôle (500 caractères au plus).",
      checkedOn: "Saisissez le jour du contrôle.",
      checkedOnFuture: "Le jour du contrôle ne peut pas être dans le futur.",
      checkedOnRefused:
        "Le jour du contrôle est refusé : il ne peut pas être dans le futur.",
      fieldRefused:
        "Un champ est refusé : relisez le nom, l’adresse (https, sans espace) et le jour du contrôle, qui ne peut pas être dans le futur.",
      activeExists:
        "Une autre source est déjà active pour ce pays : désactivez-la d’abord, puis activez celle-ci.",
    },
  },
  /** The link of the queues to the "Santé technique" screen (15 §C, "file bloquée"): admins only. */
  servicesLink: {
    label: "État des services",
    hint: "Réservé aux administrateurs.",
  },
} as const;
