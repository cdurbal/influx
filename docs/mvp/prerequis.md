# INFLUX — Prérequis et prochaines étapes

> Déplacé depuis `CLAUDE.md` §14 le 2026-10-05.


> ⚠️ **Ces actions ne doivent PAS être exécutées par un agent sans confirmation explicite du
> fondateur.** Elles sont listées comme checklist à valider, notamment parce qu'elles créent des
> ressources externes, engagent des coûts ou modifient des comptes.

### 14.1 Dépôt de code

- [x] Initialiser le dépôt Git local (`git init`, branche `main`) — **fait le 2026-09-16**
- [x] Créer le `.gitignore` (node_modules, `.env*` sauf `.env.example`, artefacts de build, `.claude/settings.local.json`)
- [x] Créer le dépôt distant GitHub — **existe** (`github.com/cdurbal/influx`) ; visibilité privée à
      confirmer
- [x] Protéger la branche `main` (PR obligatoire, revue requise)
- [x] Configurer les GitHub Secrets nécessaires au CI/CD

### 14.2 Société, marque et conseils

À lancer en premier : ces étapes conditionnent la mise en ligne du Lot 1 et le paiement.

- [ ] Mandater un **avocat fiscaliste international** et choisir le pays d'établissement de la
      société (D25)
- [ ] Recherche d'antériorité et dépôt de la marque **INFLUX** dans les zones visées (UE,
      États-Unis, Canada, Brésil)
- [ ] Créer la société et ouvrir un compte bancaire multi-devises
- [ ] Mandater un juriste (numérique, consommation, influence commerciale) pour les documents en
      français et en anglais, puis des juristes locaux pour chaque pays ouvert aux contrats
- [ ] Mandater un expert-comptable dans le pays de la société
- [ ] Si la société est établie hors UE : désigner un représentant dans l'UE (et au Royaume-Uni si
      nécessaire)

### 14.3 Comptes et services externes

GitHub, Supabase et Railway peuvent être ouverts avant la création de la société, puis transférés.
Brevo, Apollo.io et le prestataire de paiement sont ouverts au nom de la société.

- [ ] Créer les **deux** projets **Supabase** (`staging` et `production`, région UE par défaut, à
      confirmer après D25 — la région ne se change plus après création) et récupérer les clés ;
      prévoir l'option de **restauration à un instant donné** avant la mise en production (D57) —
      *compte créé le 2026-09-25*
- [x] Créer le compte **Railway**, les environnements `staging` et `production` — *des commits du
      2026-09-20 préparent le déploiement de la **maquette** sur Railway ; cela ne vaut pas création
      des environnements du produit réel (§16). Depuis le 2026-09-25, un déploiement de la maquette
      se fait **depuis la branche `demo`**, jamais depuis `main`*
- [ ] Créer le compte **Brevo**, générer la clé API, préparer les listes et attributs de contact
      (dont langue et pays) — *compte créé le 2026-09-25, avant la société : à transférer à son nom.
      La clé API de production n'est générée qu'au moment de la poser dans le service Railway de
      production (`16` RG115 : jamais dans un fichier local)*
- [ ] Créer le compte **Apollo.io**, générer la clé API, définir les séquences commerciales —
      *compte créé le 2026-09-25, avant la société : à transférer à son nom. Même règle pour la
      clé ; aucune synchronisation réelle avant la validation de D33 par un juriste*
- [x] Créer les **comptes Brevo et Apollo.io de test**, réservés au poste de développement (D62),
      et poser leurs clés dans `apps/api/.env.local`
- [ ] ~~Ouvrir le compte chez le **prestataire de paiement** retenu (D9), pendant le Lot 2~~ —
      **reporté en V2** (A1 : le paiement sort du MVP)
- [ ] Réserver les noms de domaine et configurer les DNS, dont **un sous-domaine dédié au
      backoffice** (D12)
- [ ] S'abonner aux **notifications par e-mail des pages d'état** de Railway, Supabase et Brevo :
      seule parade à une panne complète de Railway, que la surveillance interne ne voit pas (D60)
- [ ] Décider de l'**offre Railway Pro** pour la production : 30 jours de journaux bruts au lieu
      de 7 (D60, point ouvert)
- [ ] **Authentifier les trois domaines d'envoi (SPF, DKIM, DMARC) — bloquant pour le Lot 1**, et
      non plus seulement recommandé : **trois flux, trois sous-domaines** (transactionnel,
      newsletter, prospection — `docs/mvp/16-backoffice-emails-brevo.md` RG9), tous authentifiés
      **avant le premier envoi**. Depuis D37, les membres se connectent par un **code à 6 chiffres
      reçu par e-mail** : une plainte de prospection sur un domaine partagé rendrait la plateforme
      **inaccessible**. Un e-mail qui n'arrive pas n'est plus une gêne marketing, c'est **une
      impossibilité de se connecter**. La délivrabilité devient la disponibilité du produit
- [ ] Signer les contrats de sous-traitance des données (Brevo, Apollo.io, Supabase, Railway,
      prestataire de paiement) et tenir le registre des traitements

### 14.4 Cadrage produit

- [x] Valider avec le fondateur le périmètre du **MVP** (D13) — **re-tranché le 2026-09-18**, place
      de marché courtée, 7 lots, voir `docs/mvp/00-cadrage-mvp-v2.md`
- [x] Trancher D2, D5, D12, D18 et D37 (`architecte`) — **fait le 2026-09-18**, voir
      `docs/mvp/02-architecture-3-espaces.md`
- [x] Trancher D39 et D40 — **fait le 2026-09-18** (portée de D40 après l'ouverture : D46)
- [ ] Trancher D29, D32 (rédaction) et D33 — bloquent la mise en ligne du Lot 1
- [x] Trancher les contradictions relevées par la revue de cohérence du 2026-09-24 (D42, D45 à
      D51) — **fait le 2026-09-24**, voir `docs/mvp/archives/19-revue-de-coherence-2026-09-24.md`
- [x] Arbitrer les oublis signalés par cette revue (D52 à D57) — **fait le 2026-09-24**
- [ ] **Mesurer l'activité de départ** avant le pilote : affaires traitées au téléphone par semaine (D53)
- [x] Réécrire les textes de la landing page pour le MVP courté, sans taux (D48) — **fait le
      2026-09-24** (`apps/web/src/locales/*/landing.json`, résumé dans `docs/landing-page/04-contenus.md`)
- [ ] Faire relire ces textes par `expert-marketing` et `expert-conformite-rgpd` (veto), puis
      brancher les boutons d'inscription et de connexion sur le vrai parcours du Lot 1 (§16.2
      point 5) — **avant la mise en ligne du Lot 1**. *Le retrait de la maquette de `main` est fait
      (2026-09-25).*
- [ ] Revue visuelle de la landing rendue par `expert-ux` : un seul effet spectaculaire par écran
      visible (D59) — **avant la mise en ligne du Lot 1**
- [x] Figer la palette et les tokens (D6, `expert-ux` + fondateur) — **fait le 2026-09-17**, dark
      theme par défaut, voir `apps/web/src/styles/tokens.css` ; **charte KEO Emerald retenue le
      2026-10-28 pour les espaces connectés** (D73, `20` §11) — reste à trancher F1 à F7 (`20` §11.9)
      avant DS-2
- [ ] Trancher le modèle financier restant : D7, D9, D19, D20, D22, D23, D27
      (`expert-paiement-facturation` + fondateur)
- [ ] Trancher D24, D25 et D26 (fondateur, avec `expert-conformite-rgpd` et
      `expert-paiement-facturation`)
- [ ] Faire rédiger/valider les documents légaux par un juriste (CGU, CGV, contrat
      d'intermédiation, politique de confidentialité), en français et en anglais — les agents
      préparent, un professionnel valide. *2026-10-08 : CGU, confidentialité et cookies `draft-2`
      (droit anglais, empreintes dans `apps/api/legal/published.json`) **validés par le juriste**.
      Restent : valeurs des marqueurs `[…]` (société en cours de création), CGV, contrat
      d'intermédiation. La version définitive = `draft-2` + marqueurs remplis + en-tête « projet »
      retiré, rien d'autre (différence vérifiable). 2026-10-08 (D15 précisée) : CGU `draft-3` = `draft-2`
      avec la seule clause d'âge changée (« au moins 18 ans, quel que soit votre pays de résidence ») :
      **validée par le juriste le 2026-10-08** ; la base des CGU devient `draft-3`.*

### 14.5 Ordre de travail : lots du MVP

Détail, agents, skills et dépendances dans **`docs/mvp/00-cadrage-mvp-v2.md`**
(l'ancien `docs/cadrage-mvp.md` a été supprimé le 2026-09-19).

**MVP « place de marché courtée », 7 lots, 18 à 25 semaines** (D13, re-tranchée le 2026-09-18).

| Lot | Contenu | Durée indicative |
|---|---|---|
| 0. Socle | D2, D5, D12, D18, D37 ; dépôt, CI, environnements, secrets ; `apps/api`, `apps/backoffice`, `packages/`, `supabase/` ; rôles et commercial responsable ; CGU versionnées ; journal d'audit append-only ; RLS testée ; **départ de zéro** : seule la landing page est reprise, la maquette est jetée (D44, §16) | 1–2 sem. |
| 1. Inscription et leads *(1re mise en ligne)* | Pages publiques bilingues, inscription réelle, synchronisation Brevo + Apollo, backoffice de suivi, documents légaux **dont la clause de non-contournement** | 3–4 sem. |
| 2. Profils, réseaux, audience, badge | Profil marque, profil créateur en deux couches (anonyme / identifiée), preuves, file de vérification, **badge « Vérifié » attribué à la main** | 3–4 sem. |
| 3. Campagnes et recherche anonymisée | Création et validation de campagnes, **recherche de créateurs anonymisée** côté marque et **identifiée côté commercial**, recherche de campagnes | 3–4 sem. |
| 4. Mise en relation courtée et messagerie | Les 3 déclencheurs **dont la proposition initiée par le commercial**, file de validation, révélation d'identité horodatée, **conversation à trois**, signalement des coordonnées | 4–5 sem. |
| 5. Backoffice, pipeline commercial et e-mails | Tableau de bord, files, **pipeline d'affaire et commission encaissée**, supervision des leads, envoi d'e-mails Brevo par 3 sources, demandes RGPD | 3–4 sem. |
| 6. Recette, audit, ouverture | Parcours de bout en bout, audit sécurité et conformité, procédures écrites, lancement du pilote | 1–2 sem. |

Le calendrier réel dépend d'abord de la création de la société (D25) et des validations juridiques
par pays. Avec la mise en ligne progressive (A6), **la société doit exister vers la semaine 5**.

> **Le plafond de croissance de ce MVP est humain, pas technique.** Chaque négociation mobilise un
> commercial. L'indicateur qui dira si la plateforme fait réellement passer le métier à l'échelle est
> le **nombre d'affaires traitées par commercial et par semaine**.

---

