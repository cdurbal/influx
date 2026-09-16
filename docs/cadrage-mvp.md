# Cadrage du MVP INFLUX

> **Statut :** validé par le fondateur le 2026-09-16 (décision D13).
> **Préparé par :** agent `chef-de-projet`, complété des arbitrages du fondateur.
> **Référence :** `CLAUDE.md` reste la source de vérité. Ce document détaille le périmètre et
> l'ordre de livraison du MVP. En cas d'écart, `CLAUDE.md` prime et ce document est corrigé.

**Le besoin en une phrase :** la plus petite version d'INFLUX qui capte des leads partout, fait
signer et encaisser de vrais contrats commissionnés dans une première liste de pays, sans risque
juridique bloquant.

---

## 1. Arbitrages du fondateur

| Sujet | Décision |
|---|---|
| **Commission** | **35 % au total, répartis en 20 % facturés à l'annonceur et 15 % facturés au créateur, tout inclus dans le montant du contrat.** Le montant du contrat est le coût total pour l'annonceur ; le net créateur est de 65 %. Les deux taux sont stockés en base, modifiables et figés sur le contrat à la signature. |
| **Circuit de l'argent (D8)** | **INFLUX encaisse et reverse via un prestataire de paiement agréé.** Le prestataire retient les 35 % et reverse le net créateur une fois la publication validée. |
| **Zones visées** | France et francophonie, reste de l'Europe, Amérique du Nord, Brésil. |
| **Ouverture** | **Inscriptions ouvertes dans le monde entier** (chaque inscrit devient un lead Brevo / Apollo.io). **Contrats possibles uniquement entre parties situées dans des pays ouverts** : liste stockée en base, élargie pays par pays après validation juridique, fiscale et paiement. |
| **Langues** | Français et anglais au lancement. |
| **Société** | Pas encore créée ; pays d'établissement à choisir, potentiellement hors UE et hors États-Unis (D25, bloquante). |
| Qui peut signer (D17) | Tout créateur majeur (selon l'âge de la majorité de son pays), particuliers compris. |
| Influenceurs mineurs (D15) | Exclus au MVP. |
| Pseudos avant signature (D16) | Masqués jusqu'à la signature (statistiques vérifiées, portfolio, badge « vérifié »). |
| Temps de l'équipe | Au moins une personne à plein temps sur le backoffice. |
| Taux de lancement | Pas de remise générale ; taux spéciaux au cas par cas. |
| Campagnes Brevo depuis le backoffice | Juste après le MVP. En attendant, l'équipe envoie depuis Brevo sur des segments remplis automatiquement par INFLUX. |

### Exemple de référence

| Élément | Valeur |
|---|---|
| Montant du contrat (coût total pour l'annonceur, dans la devise du contrat) | 2 000,00 |
| Part annonceur INFLUX (20 %) | 400,00 |
| Part créateur INFLUX (15 %) | 300,00 |
| Commission INFLUX totale (35 %) | 700,00 |
| Net créateur reversé | 1 300,00 |
| Vérification | 400 + 300 + 1 300 = 2 000 ✅ |

> **Point d'attention.** Le Brésil est visé, mais le portugais ne fait pas partie des langues du
> lancement : les inscrits brésiliens reçoivent l'anglais. Le portugais (brésilien) est recommandé
> avant d'ouvrir les contrats au Brésil.

---

## 2. Objectif et indicateurs

**Objectif :** capter des leads dans toutes les zones visées et faire signer et encaisser les
premiers contrats commissionnés dans les pays de la première vague.

**Hypothèse à valider :** des annonceurs signent avec des créateurs proposés par INFLUX, des
créateurs acceptent un net de 65 %, et les deux restent dans la plateforme jusqu'au paiement.

| # | Indicateur | Cible (à recaler après 4 semaines) |
|---|---|---|
| 1 | Contrats signés et encaissés, chiffre d'affaires commissionné (par pays et par devise) | Au moins 10 contrats en 8 à 12 semaines de pilote |
| 2 | Mises en relation acceptées des deux côtés qui aboutissent à un contrat | Au moins 20 % |
| 3 | Campagnes validées qui reçoivent au moins 3 profils sous 72 h | Au moins 80 % |
| 4 | Inscrits consentants arrivés dans Brevo sous 1 h, annonceurs qualifiés dans Apollo sous 24 h | Au moins 99 %, aucun échec laissé sans traitement |
| 5 | Inscriptions par pays hors première vague (pour choisir les pays à ouvrir ensuite) | Suivi dès le Lot 1 |
| 6 | Mises en relation acceptées sans contrat ni motif après 30 jours (signal de contournement) | Suivi dès le départ |

---

## 3. Principe : un MVP « opéré par l'équipe »

On n'automatise que ce qui doit l'être. Le reste est fait à la main, **toujours depuis le
backoffice**, pour que chaque action reste tracée dans INFLUX.

| Fonction | Au MVP | Plus tard |
|---|---|---|
| Mise en relation | Les agents INFLUX proposent des créateurs avec des filtres et un motif écrit | Algorithme (D11) |
| Vérification des créateurs | Contrôle manuel des statistiques et preuve de propriété du compte (code dans la bio) | API des réseaux sociaux |
| Contrat | Modèle unique en français et en anglais, acceptation en ligne horodatée, taux figés en base | Signature électronique externe si les juristes l'exigent |
| Paiement | **Automatisé via le prestataire** : paiement de l'annonceur, fonds conservés, reversement à la validation | — |
| Ouverture d'un pays aux contrats | Un administrateur l'active dans le backoffice après validation juridique, fiscale et paiement | — |
| Campagnes e-mail | Envoyées depuis Brevo, sur des segments remplis automatiquement | Pilotage depuis le backoffice |
| Droits des personnes | Retrait du consentement en libre-service ; export et suppression traités par un agent, avec transmission automatique à Brevo et Apollo | Libre-service complet |

**Jamais fait à la main :** synchronisation des leads, calcul des deux parts de commission (un
seul endroit, côté serveur, journalisé), encaissement et reversement, blocage des contrats hors des
pays ouverts, vérification du consentement, transmission des désinscriptions et suppressions,
journaux de traçabilité.

**Principe de conformité proposé** (à valider par `expert-conformite-rgpd`) : appliquer **le niveau
du RGPD à tous les utilisateurs**, puis ajouter les exigences propres à chaque pays (LGPD au Brésil,
Loi 25 au Québec, lois des États américains, loi anti-spam CASL au Canada pour la prospection).

---

## 4. Périmètre par persona

### 4.1 Annonceur

**IN**
- Pages publiques en français et en anglais, à deux entrées, avec la tarification expliquée.
- Inscription courte : e-mail, mot de passe, entreprise, pays, langue, consentement non pré-coché, CGU.
- Profil entreprise progressif, avec indicateur de complétude.
- Création de campagne, publiée après validation par un agent.
- Profils proposés avec leur motif (pseudos masqués) ; acceptation ou refus avec motif.
- Messagerie liée à chaque mise en relation.
- Contrat : coût total et part INFLUX dans la devise du contrat, acceptation horodatée.
  **Proposé uniquement si l'annonceur et le créateur sont dans des pays ouverts.**
- Paiement en ligne ; validation de la publication.
- Espace « mes données ».

**OUT**

| Exclu | Pourquoi |
|---|---|
| Recherche libre dans l'annuaire des créateurs | Favorise le contournement ; trop peu de profils au lancement. La sélection par l'équipe est la valeur du pilote. |
| Plusieurs utilisateurs par entreprise | Confort ; un compte par annonceur suffit au pilote. |
| Statistiques automatiques des publications | API des réseaux sociaux aux agréments longs ; bilan déclaratif au MVP. |
| Avis et notation | Il faut d'abord un historique. |

### 4.2 Influenceur (majeur, particulier ou professionnel)

**IN**
- Page créateurs en français et en anglais, avec un exemple de net (contrat de 2 000 → 1 300).
- Inscription : pays, langue, attestation de majorité, consentement non pré-coché.
- Profil progressif : réseaux, thématiques, audience avec pays et captures de statistiques, formats,
  tarifs indicatifs dans une devise, portfolio, statut (particulier ou professionnel).
- Preuve de propriété du compte, contrôlée par un agent.
- Liste des campagnes ouvertes et bouton « je suis intéressé » (traité par un agent).
- Propositions reçues : acceptation ou refus avec motif.
- Messagerie.
- Contrat avec le net affiché **avant** d'accepter.
- Vérification d'identité et coordonnées bancaires auprès du prestataire, au premier contrat.
- Dépôt de la preuve de publication ; suivi du reversement.
- Espace « mes données ».
- Un créateur situé dans un pays non ouvert est informé qu'il sera prévenu à l'ouverture de son pays
  (le lead est conservé).

**OUT**

| Exclu | Pourquoi |
|---|---|
| Connexion automatique à Instagram, TikTok, YouTube | Agréments longs et incertains ; vérification manuelle suffisante au pilote. |
| Mineurs | Régimes légaux spécifiques impossibles à outiller sans risque au MVP (D15). |
| Agences et managers gérant plusieurs créateurs | Parcours et contrats différents. |
| Langues autres que le français et l'anglais | Ajoutées pays par pays (portugais en premier candidat). |

### 4.3 Agent INFLUX (backoffice)

**IN**
- Accès séparé, rôles agent et administrateur (authentification renforcée à confirmer par
  `expert-cybersecurite`).
- Fiches de compte : qualification, badge « vérifié », suspension, notes internes.
- Validation des campagnes avant publication, y compris les secteurs interdits selon les pays.
- Mise en relation manuelle outillée : filtres (thématique, pays, formats, tarifs, audience),
  proposition avec motif, suivi, annotations, traitement des « je suis intéressé ».
- Alertes : coordonnées détectées dans un message, mise en relation inactive, campagne sans proposition.
- **Suivi de la synchronisation Brevo / Apollo** : cause des échecs en clair, relance unitaire ou en lot.
- **Liste des pays ouverts aux contrats.**
- Taux par défaut et taux spéciaux (part annonceur, part créateur).
- Contrats et statuts financiers par devise (signé, payé, fonds conservés, reversé, litige, annulé,
  remboursé) ; export comptable.
- Traitement des demandes relatives aux données personnelles.
- Tableau de bord par pays.

**OUT**

| Exclu | Pourquoi |
|---|---|
| Envoi des campagnes Brevo depuis le backoffice | Segments déjà synchronisés ; l'équipe envoie depuis Brevo. Libère 2 à 3 semaines. Premier ajout après le MVP. |
| Algorithme de mise en relation | Aucune donnée pour le régler ; les propositions manuelles enregistrées serviront à le construire (D11). |
| Statistiques avancées, droits fins par agent | Confort. |
| Backoffice en anglais | L'équipe travaille en français (à confirmer). |

---

## 5. Découpage en lots

**Durée de développement : 16 à 24 semaines.** Hypothèses : l'équivalent d'un développeur à plein
temps, validations du fondateur sous 48 h.

> **Le calendrier réel dépend d'abord de la création de la société (D25) et des validations
> juridiques par pays, plus que du développement.** Le Lot 1 ne peut pas être mis en ligne sans
> société (mentions légales, CGU, contrats avec Brevo et Apollo). Le Lot 4 ne peut pas être livré
> sans compte chez le prestataire de paiement.

Chaque lot passe la définition du « prêt à livrer » (skill `test-strategy`).
`expert-cybersecurite` et `expert-conformite-rgpd` disposent d'un veto bloquant.

### Lot 0 : socle technique (1 à 2 semaines)

- **Contenu :** trancher D1–D5, D12 et D18 ; dépôt GitHub privé, branche `main` protégée,
  vérifications automatiques ; environnements `staging` et `production` (Railway, Supabase) ;
  gestion des secrets ; premiers tokens du design system ; **français et anglais branchés dès le
  départ** ; **pays, langue, devise et fuseau horaire présents dans le modèle de données** ; comptes
  et rôles ; RLS.
- **Valeur :** une page de test bilingue déployée automatiquement, un compte de démonstration par rôle.
- **Agents :** `architecte` → `expert-database` → `integrateur` → `expert-ux` → `expert-cybersecurite` → `testeur`.
- **Skills :** `railway-deploy`, `env-secrets`, `supabase-schema`, `design-system-influx`, `test-strategy`.
- **Dépendances :** accord du fondateur pour créer le dépôt distant et les comptes. Peut démarrer
  **sans société** (comptes transférables ensuite). D6 peut arriver en fin de lot.

### Lot 1 : capter et synchroniser les leads (3 à 4 semaines), première mise en ligne publique

- **Contenu :** pages publiques en français et en anglais (page d'accueil à deux entrées, pages
  annonceurs et créateurs, commission et net expliqués) ; inscription (pays, langue, consentement et
  CGU séparés, attestation de majorité) ; e-mail de confirmation ; pipeline de synchronisation
  (inscriptions, retraits de consentement, suppressions) avec nouvelles tentatives et relance ;
  Brevo (contact, attributs, listes par profil, langue et pays, e-mail de bienvenue par profil et par
  langue) ; Apollo (annonceurs qualifiés, règles de prospection par pays) ; désinscriptions
  synchronisées dans les deux sens ; premier backoffice (inscrits et suivi de synchronisation) ;
  CGU, politique de confidentialité, mentions légales, politique cookies en français et en anglais.
- **Valeur :** chaque inscription, partout dans le monde, devient un lead.
- **Agents :** `product-owner` → `expert-marketing` → `expert-conformite-rgpd` → `expert-ux` →
  `architecte` + `expert-integrations-api` → `expert-database` → `dev-react-node` →
  `expert-cybersecurite` → `testeur` → `integrateur`.
- **Skills :** `feature-spec`, `design-system-influx`, `lead-pipeline`, `brevo-campaign`,
  `apollo-lead-sync`, `supabase-schema`, `env-secrets`, `security-rgpd-audit`, `test-strategy`.
- **Dépendances :** Lot 0 ; **D25 (société créée)** ; D6 ; D21 (niveau de base) ; comptes Brevo et
  Apollo ; domaine authentifié (SPF, DKIM, DMARC) ; documents légaux validés par un juriste.

### Lot 2 : profils vérifiés et campagnes publiées (2 à 3 semaines)

- **Contenu :** profils complets (pays, devise des tarifs) avec indicateur de complétude ; fichiers
  privés ; preuve de propriété du compte ; création de campagne ; backoffice (fiches, vérification,
  suspension, notes, validation des campagnes) ; signaux « profil complété » et « campagne publiée »
  vers Brevo et Apollo.
- **Valeur :** offre et demande structurées et vérifiées.
- **Agents :** `expert-matching` (données à collecter pour le futur algorithme) → `product-owner` →
  `expert-ux` → `expert-conformite-rgpd` → `expert-database` → `dev-react-node` →
  `expert-cybersecurite` → `testeur`.
- **Skills :** `matching-spec`, `feature-spec`, `supabase-schema`, `design-system-influx`, `test-strategy`.
- **Dépendances :** Lot 1 ; D27 tranchée ; D9, D24 et D26 étudiées ; ouverture du compte prestataire lancée.

### Lot 3 : mise en relation par l'équipe et messagerie traçable (3 à 4 semaines)

- **Contenu :** mise en relation manuelle outillée ; propositions et réponses des deux côtés ;
  « je suis intéressé » ; messagerie liée à chaque mise en relation, notifications sans le texte des
  messages ; détection des coordonnées (formats internationaux) et alertes ; relances automatiques ;
  signal « mise en relation proposée » vers Brevo.
- **Valeur :** premières mises en relation réelles, entièrement tracées : preuve de l'intermédiation.
- **Agents :** `expert-matching` → `product-owner` → `expert-ux` → `expert-conformite-rgpd` →
  `expert-database` → `dev-react-node` → `expert-cybersecurite` → `testeur` ; `expert-marketing`
  pour les relances.
- **Skills :** `matching-spec`, `feature-spec`, `supabase-schema`, `design-system-influx`,
  `security-rgpd-audit`, `test-strategy`.
- **Dépendances :** Lot 2 ; D9 tranchée ; compte prestataire ouvert.

### Lot 4 : contrat, paiement, commission (6 à 9 semaines)

- **Contenu :** contrat bilingue depuis la mise en relation, renégociation avec recalcul complet ;
  récapitulatif (montant du contrat, parts INFLUX, net créateur, devise) ; acceptation horodatée ;
  taux 20 % / 15 % lus en base, figés et calculés à un seul endroit, avec journalisation ; **blocage
  des contrats hors des pays ouverts** ; intégration du prestataire (paiement de l'annonceur,
  vérification d'identité des créateurs, fonds conservés, reversement international, remboursement) ;
  factures des deux parts selon les règles fiscales applicables ; statuts financiers ; export
  comptable ; contact passé en client dans Brevo et sorti des séquences Apollo.
- **Valeur :** **premier euro encaissé** ; l'hypothèse principale devient mesurable.
- **Agents :** `expert-paiement-facturation` → `expert-conformite-rgpd` → `product-owner` →
  `expert-ux` → `expert-integrations-api` (prestataire) → `expert-database` → `dev-react-node` →
  `expert-cybersecurite` → `testeur`.
- **Skills :** `contract-commission`, `feature-spec`, `supabase-schema`, `design-system-influx`,
  `security-rgpd-audit`, `test-strategy`.
- **Dépendances :** Lot 3 ; D7, D10, D19–D24, D26, D27 tranchées ; CGV, contrat d'intermédiation et
  conditions de paiement validés pour chaque pays de la première vague.

### Lot 5 : livraison et ouverture (1 à 2 semaines)

- **Contenu :** preuve de publication, validation et reversement de bout en bout ; tableau de bord
  par pays ; procédures écrites des tâches manuelles (relances de synchronisation, demandes sur les
  données, litiges, ouverture d'un pays) ; audit complet sécurité et conformité ; test de bout en
  bout inscription → contrat → paiement → publication validée → reversement.
- **Valeur :** cycle complet ; lancement de la première vague.
- **Agents :** `testeur`, `expert-cybersecurite` + `expert-conformite-rgpd`, `product-owner`,
  `dev-react-node`, `integrateur` (mise en production uniquement avec l'accord explicite du fondateur).
- **Skills :** `security-rgpd-audit`, `test-strategy`, `railway-deploy`.

### Si le délai dérape

À retirer en premier, sans toucher aux invariants : bouton « je suis intéressé », contrat en PDF
(remplacé par un récapitulatif en ligne et un e-mail), relances automatiques, tableau de bord
complet (remplacé par des exports).

### Après le MVP (ordre à confirmer selon le pilote)

1. Ouverture de nouveaux pays aux contrats (portugais avant le Brésil).
2. Algorithme de mise en relation si l'équipe sature (D11).
3. Envoi des campagnes Brevo depuis le backoffice.
4. Statistiques automatiques des réseaux, avis, agences, abonnement (D14).

---

## 6. Décisions ouvertes liées au MVP

Le suivi officiel est dans `CLAUDE.md` §13. Résumé des échéances :

| Échéance | Décisions |
|---|---|
| Maintenant, en parallèle du Lot 0 | **D25 pays de la société** (fondateur + avocat fiscaliste international) |
| Lot 0 | D1–D5, D12, D18 (`architecte`) ; D6 en fin de lot |
| Avant la mise en ligne du Lot 1 | D21 niveau de base ; D25 |
| Avant le Lot 2 | D27 devises |
| Pendant le Lot 2 | D24 créateurs particuliers ; étude de D9 et D26 |
| Avant le Lot 3 | D9 prestataire de paiement |
| Avant le Lot 4 | D7, D10, D19, D20, D22, D23, D26 |
| Après le MVP | D11, D14 |

---

## 7. Principaux risques

| Risque | Nature | Parade |
|---|---|---|
| Création de la société tardive, ou pays mal adapté (pas de prestataire de paiement, banques réticentes, fiscalité défavorable) | Légal / financier | D25 lancée en premier avec un avocat fiscaliste ; critère « prestataire et banque disponibles » éliminatoire ; Lot 0 démarré sans attendre |
| Validation juridique pays par pays trop longue | Légal | Inscriptions ouvertes partout, contrats ouverts pays par pays (D26) ; peu de pays dans la première vague |
| Prospection Apollo non conforme selon les pays (UE, CASL au Canada) | Légal | Qualification par pays ; séquences désactivées là où la base légale n'est pas validée |
| Pas assez d'offre et de demande dans le même pays | Produit | Première vague choisie là où se trouvent les annonceurs pilotes ; indicateurs 3 et 5 suivis par pays |
| Net de 65 % jugé trop bas par les créateurs | Commercial | Net expliqué dès la page créateurs ; motifs de refus enregistrés ; taux spéciaux ciblés |
| Contournement | Business | Tout tracé, pseudos masqués, paiement obligatoirement dans INFLUX, clause de non-contournement, alertes |
| Créateurs particuliers (fiscalité, consommation, requalification) selon les pays | Légal | D24 ; validation par l'expert-comptable et les juristes pour chaque pays ouvert |
| Reversements internationaux (frais, délais, pays non couverts) | Financier | Critère de D9 et D26 ; frais de conversion arbitrés (D27) |
| Friction à la vérification d'identité des créateurs | Produit | Demandée seulement au premier contrat ; parcours testé par `expert-ux` |
| Marque « INFLUX » déjà déposée dans une zone visée | Légal / commercial | Recherche d'antériorité en UE, aux États-Unis, au Canada et au Brésil avant d'investir |
| Ouverture sans documents légaux validés, règles de l'influence par pays | Légal | Juriste engagé tôt ; D21 ; veto de `expert-conformite-rgpd` |
| Fuite de données entre utilisateurs | Sécurité | RLS testée au niveau base, fichiers privés ; veto de `expert-cybersecurite` |
| Erreur de calcul ou montant manipulé | Financier | Calcul unique côté serveur, taux en base, identité parts + net = contrat testée, montants sans flottant |
| E-mail envoyé par erreur depuis l'environnement de test, e-mails en spam | Technique / commercial | Intégrations désactivées en `staging` ; domaine authentifié tôt ; montée en volume progressive |
| Périmètre qui grossit en cours de route | Projet | Tout ajout passe par `chef-de-projet` et remplace autre chose |

---

## 8. Prérequis externes

> Aucun agent ne lance ces actions sans l'accord explicite du fondateur.

| Ordre | Action | Nécessaire pour |
|---|---|---|
| 1 | Avocat fiscaliste international : comparaison des pays, choix du pays de la société (D25) | Tout le reste |
| 2 | Recherche d'antériorité et dépôt de la marque dans les zones visées ; noms de domaine | Avant d'investir dans la marque |
| 3 | Création de la société et compte bancaire multi-devises | Lot 1 (mentions légales), Lot 4 |
| 4 | Juriste (numérique, consommation, influence) : documents en français et en anglais ; juristes locaux par pays de la première vague | Lot 1, Lot 4 |
| 5 | Expert-comptable du pays de la société | D7, D22, D23, D24 |
| 6 | GitHub, Supabase, Railway (ouvrables avant la société puis transférés ; hébergement UE par défaut, à confirmer après D25) | Lot 0 |
| 7 | Brevo et Apollo.io au nom de la société | Lot 1 |
| 8 | Représentant dans l'UE (et éventuellement au Royaume-Uni) si la société est hors UE ; contrats de sous-traitance des données ; registre des traitements | Avant la mise en ligne du Lot 1 |
| 9 | Compte chez le prestataire de paiement | Ouverture pendant le Lot 2 |
| 10 | Recrutement des annonceurs et créateurs pilotes dans les pays de la première vague | Lots 1 à 3 |

---

## 9. Prochaines étapes

1. **Fondateur :** lancer les prérequis 1 à 3 ; confirmer que le backoffice reste en français.
2. **En parallèle :**
   - `expert-paiement-facturation` + `expert-conformite-rgpd` : dossier de comparaison des pays pour
     D25 (prestataire de paiement, banque, fiscalité, déclarations de la plateforme, RGPD, coût).
   - `architecte` : D1–D5, D12, D18, avec ces contraintes : pages publiques bien référencées et
     bilingues, backoffice isolé, calcul de commission unique, synchronisation des leads rejouable,
     modèle international (pays, langue, devise, fuseau horaire).
   - `expert-ux` : palette (D6) et parcours d'inscription des deux entrées, avec la présentation du
     net créateur.
   - `expert-marketing` : attributs Brevo, e-mails de bienvenue en français et en anglais, critères
     de qualification Apollo par pays.
3. **Ensuite :** `product-owner` spécifie le Lot 1 (`feature-spec`) ; `testeur` fixe le « prêt à
   livrer » des Lots 0 et 1 (`test-strategy`).
