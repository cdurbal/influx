export type BrandProfileLabels = {
  completenessHeading: string;
  completenessMax: string;
  status: {
    published: string;
    pending: string;
    rejected: string;
    draft: string;
  };
  breakdown: {
    publicIdentity: string;
    collaborationExpectations: string;
    trust: string;
    contact: string;
    pts: string;
  };
  missingMessage: {
    prefix: string;
    midfix: string;
    suffix: string;
    allComplete: string;
  };
  tabs: {
    identity: string;
    expectations: string;
    contact: string;
    badge: string;
  };
  identity: {
    title: string;
    subtitle: string;
    companyNameLabel: string;
    companyNameHint: string;
    sectorLabel: string;
    sectorEmptyOption: string;
    companySizeLabel: string;
    companySizeHint: string;
    websiteLabel: string;
    websiteHint: string;
    presentationLabel: string;
    presentationMinHint: string;
    presentationNotice: string;
    placeholders: {
      companyName: string;
      website: string;
      presentation: string;
    };
  };
  expectations: {
    title: string;
    subtitle: string;
    topicsLabel: string;
    networksLabel: string;
    formatsLabel: string;
    budgetLabel: string;
    budgetNotice: string;
    budgetEmptyOption: string;
  };
  contact: {
    title: string;
    subtitle: string;
    d40NoticeTitle: string;
    d40NoticeBody: string;
    roleLabel: string;
    roleHint: string;
    rolePublicBadge: string;
    firstNameLabel: string;
    firstNameHint: string;
    emailLabel: string;
    emailHint: string;
    phoneLabel: string;
    phoneHint: string;
    maskedBadge: string;
    placeholders: {
      firstName: string;
      email: string;
      phone: string;
    };
  };
  badge: {
    title: string;
    subtitle: string;
    pendingTitle: string;
    pendingInstruction: string;
    pendingTimeNotice: string;
    unrequestedBody: string;
    legalNameLabel: string;
    regNumberLabel: string;
    ctaRequest: string;
    placeholders: {
      legalName: string;
      regNumber: string;
    };
  };
  actions: {
    saveDraft: string;
    saving: string;
    submit: string;
    saveSuccess: string;
    submitSuccess: string;
    badgeSuccess: string;
    missingAlert: string;
  };
};

export const FR_BRAND_PROFILE_LABELS: BrandProfileLabels = {
  completenessHeading: "Complétude du profil",
  completenessMax: "/ 100",
  status: {
    published: "✓ Publié",
    pending: "⏳ En attente de validation",
    rejected: "✕ Refusé",
    draft: "● Brouillon",
  },
  breakdown: {
    publicIdentity: "Identité publique",
    collaborationExpectations: "Attentes collaboration",
    trust: "Confiance & Domaine",
    contact: "Interlocuteur",
    pts: "pts",
  },
  missingMessage: {
    prefix: "Il manque",
    midfix: "information(s) obligatoire(s) pour soumettre votre profil :",
    suffix: ".",
    allComplete:
      "Tous les critères obligatoires sont renseignés. Votre profil peut être soumis à validation !",
  },
  tabs: {
    identity: "1. Identité publique",
    expectations: "2. Ce que vous cherchez",
    contact: "3. Votre interlocuteur (Masqué D40)",
    badge: "4. Badge « Marque vérifiée »",
  },
  identity: {
    title: "1. Identité publique de la marque",
    subtitle:
      "Ces informations sont visibles des créateurs lorsqu'ils consultent une campagne ou une proposition INFLUX.",
    companyNameLabel: "Nom commercial de la marque",
    companyNameHint: "Pré-rempli depuis l'inscription (RG2).",
    sectorLabel: "Secteur d'activité principal",
    sectorEmptyOption: "Sélectionnez votre secteur",
    companySizeLabel: "Taille de l'entreprise (tranche)",
    companySizeHint:
      "Seules des tranches sont collectées. Aucun effectif exact n'est demandé (RG22).",
    websiteLabel: "Site web (domaine)",
    websiteHint:
      "Les adresses complètes sont automatiquement réduites au nom de domaine seul (RG17, CA4).",
    presentationLabel: "Présentation de la marque",
    presentationMinHint: "/ 1 000 caractères (min. 120 pour publier)",
    presentationNotice:
      "Note RG19 : les coordonnées directes sont strictement interdites dans la présentation.",
    placeholders: {
      companyName: "Maison Solène",
      website: "maisonsolene.fr",
      presentation:
        "Décrivez votre histoire, votre positionnement, vos engagements et vos produits phares...",
    },
  },
  expectations: {
    title: "2. Attentes de collaboration",
    subtitle:
      "Définissez les créateurs et les formats que vous recherchez pour faciliter le ciblage.",
    topicsLabel: "Thématiques recherchées (1 à 3 choix)",
    networksLabel: "Réseaux sociaux cibles",
    formatsLabel: "Formats de contenu attendus",
    budgetLabel: "Budget indicatif par collaboration",
    budgetNotice:
      "Budget indicatif par collaboration, à titre d'information — il ne vaut pas engagement.",
    budgetEmptyOption: "Sélectionnez une tranche de budget",
  },
  contact: {
    title: "3. Votre interlocuteur (Masquage symétrique D40)",
    subtitle:
      "INFLUX applique un masquage symétrique strict pour protéger les deux parties avant accord.",
    d40NoticeTitle: "Protection et confidentialité INFLUX (D40)",
    d40NoticeBody:
      "Ces coordonnées resteront masquées jusqu'à la mise en relation validée par un commercial. Seule la fonction de votre interlocuteur est visible publiquement pour permettre aux créateurs d'identifier à quel profil ils s'adressent.",
    roleLabel: "Fonction de l'interlocuteur",
    roleHint:
      "Visible par les créateurs pour savoir à qui ils ont affaire (RG36).",
    rolePublicBadge: "Couche Publique",
    firstNameLabel: "Prénom de l'interlocuteur",
    firstNameHint: "Révélé uniquement après ouverture de la mise en relation.",
    emailLabel: "E-mail professionnel de contact",
    emailHint: "Masqué aux créateurs avant mise en relation.",
    phoneLabel: "Numéro de téléphone",
    phoneHint: "Masqué aux créateurs avant mise en relation.",
    maskedBadge: "Couche Masquée",
    placeholders: {
      firstName: "Solène",
      email: "contact@maisonsolene.fr",
      phone: "+33 6 12 34 56 78",
    },
  },
  badge: {
    title: "4. Badge « Marque vérifiée »",
    subtitle:
      "Le badge atteste auprès des créateurs du contrôle réel du nom de domaine et de l'immatriculation légale de votre société.",
    pendingTitle: "Demande de vérification en cours d'examen",
    pendingInstruction:
      "Pour prouver la propriété de votre domaine, ajoutez l'enregistrement DNS TXT suivant ou publiez une page contenant ce code :",
    pendingTimeNotice:
      "Notre équipe commerciale contrôlera cet enregistrement sous 1 à 3 jours ouvrés.",
    unrequestedBody:
      "Pour obtenir le badge « Marque vérifiée », renseignez vos informations d'immatriculation. Ces données restent strictement internes à l'équipe INFLUX (RG46).",
    legalNameLabel: "Raison sociale légale",
    regNumberLabel: "Numéro d'immatriculation (SIREN / TVA)",
    ctaRequest: "Demander le badge « Marque vérifiée »",
    placeholders: {
      legalName: "Maison Solène SAS",
      regNumber: "891 234 567 00012",
    },
  },
  actions: {
    saveDraft: "Enregistrer le brouillon",
    saving: "Enregistrement...",
    submit: "Soumettre pour validation",
    saveSuccess: "Modifications enregistrées en brouillon avec succès.",
    submitSuccess:
      "Votre profil a été soumis avec succès pour examen par un commercial INFLUX (délai médian : 1 jour ouvré).",
    badgeSuccess:
      "Demande de badge « Marque vérifiée » enregistrée ! Votre code de contrôle DNS a été généré.",
    missingAlert: "champs obligatoires manquants.",
  },
};

export const EN_BRAND_PROFILE_LABELS: BrandProfileLabels = {
  completenessHeading: "Profile Completeness",
  completenessMax: "/ 100",
  status: {
    published: "✓ Published",
    pending: "⏳ Pending review",
    rejected: "✕ Rejected",
    draft: "● Draft",
  },
  breakdown: {
    publicIdentity: "Public identity",
    collaborationExpectations: "Collaboration expectations",
    trust: "Trust & Domain",
    contact: "Contact person",
    pts: "pts",
  },
  missingMessage: {
    prefix: "Missing",
    midfix: "required piece(s) of information to publish your profile:",
    suffix: ".",
    allComplete:
      "All required criteria are completed. Your profile can be submitted for review!",
  },
  tabs: {
    identity: "1. Public identity",
    expectations: "2. What you are looking for",
    contact: "3. Your contact person (Masked D40)",
    badge: "4. Verified Brand Badge",
  },
  identity: {
    title: "1. Brand Public Identity",
    subtitle:
      "This information is visible to creators when viewing a campaign or an INFLUX proposal.",
    companyNameLabel: "Brand commercial name",
    companyNameHint: "Pre-filled from registration (RG2).",
    sectorLabel: "Primary business sector",
    sectorEmptyOption: "Select your sector",
    companySizeLabel: "Company size band",
    companySizeHint:
      "Only bands are collected. No exact headcounts are requested (RG22).",
    websiteLabel: "Website (domain)",
    websiteHint:
      "Full URLs are automatically reduced to the domain name only (RG17, CA4).",
    presentationLabel: "Brand presentation",
    presentationMinHint: "/ 1,000 characters (min. 120 to publish)",
    presentationNotice:
      "Note RG19: direct contact details are strictly forbidden in public presentation.",
    placeholders: {
      companyName: "Maison Solene",
      website: "maisonsolene.fr",
      presentation:
        "Describe your brand story, positioning, values, and flagship products...",
    },
  },
  expectations: {
    title: "2. Collaboration Expectations",
    subtitle:
      "Specify creators and formats you are looking for to improve targeting.",
    topicsLabel: "Target topics (1 to 3 choices)",
    networksLabel: "Target social networks",
    formatsLabel: "Expected content formats",
    budgetLabel: "Indicative budget per collaboration",
    budgetNotice:
      "Indicative budget per collaboration, for information only — it is not a commitment.",
    budgetEmptyOption: "Select a budget band",
  },
  contact: {
    title: "3. Your Contact Person (Symmetric Masking D40)",
    subtitle:
      "INFLUX applies strict symmetric masking to protect both parties prior to agreement.",
    d40NoticeTitle: "INFLUX Privacy and Protection (D40)",
    d40NoticeBody:
      "These contact details remain masked until an introduction is validated by an INFLUX agent. Only your contact's job role is public so creators know who they are speaking with.",
    roleLabel: "Job role / function",
    roleHint:
      "Visible to creators so they know who they are speaking with (RG36).",
    rolePublicBadge: "Public Layer",
    firstNameLabel: "First name",
    firstNameHint: "Revealed only after introduction approval.",
    emailLabel: "Professional contact email",
    emailHint: "Masked to creators prior to introduction.",
    phoneLabel: "Phone number",
    phoneHint: "Masked to creators prior to introduction.",
    maskedBadge: "Masked Layer",
    placeholders: {
      firstName: "Solene",
      email: "contact@maisonsolene.fr",
      phone: "+33 6 12 34 56 78",
    },
  },
  badge: {
    title: "4. Verified Brand Badge",
    subtitle:
      "The badge confirms domain control and official company registration to creators.",
    pendingTitle: "Verification request under review",
    pendingInstruction:
      "To prove domain ownership, add the following DNS TXT record or publish a web page containing this code:",
    pendingTimeNotice:
      "Our team will verify this record within 1 to 3 business days.",
    unrequestedBody:
      "To obtain the Verified Brand badge, provide company registration details. These remain strictly internal to INFLUX (RG46).",
    legalNameLabel: "Official company legal name",
    regNumberLabel: "Company registration number",
    ctaRequest: "Request Verified Brand Badge",
    placeholders: {
      legalName: "Maison Solene SAS",
      regNumber: "891 234 567 00012",
    },
  },
  actions: {
    saveDraft: "Save draft",
    saving: "Saving...",
    submit: "Submit for validation",
    saveSuccess: "Draft saved successfully.",
    submitSuccess:
      "Your profile has been submitted for validation (median turnaround: 1 business day).",
    badgeSuccess:
      "Verified brand badge request saved! Domain proof code generated.",
    missingAlert: "required fields missing.",
  },
};
