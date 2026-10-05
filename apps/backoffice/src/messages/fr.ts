// Labels of the backoffice. D36 is open: French only, without next-intl (02 §8, 21 §4 J1-E).
// No literal text in JSX: moving to two languages will only replace this module. Sign-in, TOTP
// activation and recovery codes: 17b §3.14 (keys `bo.auth.*`, same wording).
export const messages = {
  metadata: {
    title: "INFLUX — Backoffice",
  },
  brand: "INFLUX — Espace interne",
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
  home: {
    title: "Espace interne",
    lead: "L’espace se construit : la file de validation, les affaires et les comptes apparaîtront ici.",
    loading: "Chargement…",
    signedInAs: (email: string, role: "agent" | "admin") =>
      `Connecté avec ${email} — ${role === "admin" ? "administrateur" : "commercial"}`,
  },
  logout: {
    action: "Me déconnecter",
    busy: "Déconnexion…",
    done: "Vous êtes déconnecté.",
    signInAgain: "Me reconnecter",
  },
} as const;
