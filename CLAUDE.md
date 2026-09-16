# INFLUX — Guide projet pour Claude Code

> **Statut du projet : phase d'initialisation.** Aucun code applicatif n'existe encore.
> Ce document est la source de vérité pour toute session Claude Code travaillant sur INFLUX.
> Il est lu par les agents IA **et** par le fondateur : il doit rester compréhensible sans
> connaissance technique préalable dans ses parties produit/business.

---

## 1. À propos de ce document

| Public | Usage attendu |
|---|---|
| Sessions et agents Claude Code | Instructions système. À lire avant toute action. Les règles ici priment sur les habitudes par défaut. |
| Fondateur (non-développeur / développeur occasionnel) | Relecture de cohérence fonctionnelle et business. Toute divergence constatée doit être corrigée **ici d'abord**, puis répercutée dans le code. |

**Règle d'or :** si une décision structurante n'est pas tranchée dans ce document, elle ne doit
pas être inventée. Elle remonte en section [13. Décisions ouvertes](#13-décisions-ouvertes) et
est arbitrée par l'agent `architecte` (technique) ou `chef-de-projet` (fonctionnel/priorités).

---

## 2. Vision produit

**INFLUX est une marketplace B2B2C de mise en relation entre annonceurs et influenceurs.**

- Les **annonceurs** (marques, e-commerçants, PME) veulent lancer des campagnes ou promotions
  sur leurs produits et cherchent des audiences pertinentes.
- Les **influenceurs** (créateurs de contenu, micro à macro) proposent leur audience et leurs
  formats (post, story, vidéo, UGC, placement produit…).
- **INFLUX est l'intermédiaire** : il fait se rencontrer l'offre et la demande, sécurise la
  relation contractuelle, et se rémunère sur les contrats signés via la plateforme.

La mise en relation est **hybride** :

1. **Algorithmique** — un moteur de matching propose des candidats pertinents de part et d'autre.
2. **Humaine** — des agents internes d'INFLUX interviennent depuis un backoffice pour qualifier,
   arbitrer, relancer et closer les mises en relation à forte valeur.

Ces deux voies coexistent en permanence. L'algorithme **ne remplace pas** l'agent humain : il
le priorise et lui fait gagner du temps. Toute fonctionnalité de matching doit donc être
consultable, explicable et surchargeable manuellement depuis le backoffice.

### Positionnement concurrentiel

Référence UX/UI à égaler puis dépasser : **https://wekollab.fr/**.
Ce site sert de mètre étalon pour le niveau de finition attendu (clarté du parcours
d'inscription, lisibilité des profils, fluidité de la mise en relation). INFLUX doit être
**au moins aussi simple** à comprendre en 10 secondes sur la page d'accueil.

---

## 3. Modèle économique — INVARIANT MÉTIER

> ### 💰 **Commission de 35 % sur le montant de chaque contrat signé via INFLUX.**

C'est l'invariant le plus structurant du projet. Il conditionne l'architecture données, les
écrans, les contrats, la facturation et le discours commercial.

| Règle | Détail |
|---|---|
| Assiette | Montant du contrat signé entre l'annonceur et l'influenceur **via l'intermédiaire d'INFLUX**. L'assiette exacte (HT ou TTC) est une décision ouverte, cf. §13. |
| Taux | **35 %**, valeur par défaut de la plateforme. |
| Paramétrabilité | Le taux doit être **stocké en base et paramétrable**, jamais codé en dur. Des taux dérogatoires (partenariats, offres de lancement) seront nécessaires. Chaque contrat fige le taux appliqué **au moment de la signature** (historisation obligatoire). |
| Fait générateur | La **signature du contrat** via la plateforme. Un contrat conclu hors plateforme après mise en relation INFLUX constitue un contournement : la traçabilité de la mise en relation doit permettre de le détecter. |
| Conséquence produit | Toute campagne, tout échange et toute signature doivent être **traçables dans INFLUX**. Un parcours qui pousse les parties à s'échanger leurs coordonnées hors plateforme détruit le modèle économique : c'est un critère de rejet en revue UX. |

**Inscription libre et gratuite** pour les deux profils. La monétisation intervient uniquement
à la signature. Il n'y a pas d'abonnement au lancement (décision réversible, §13).

### Second pilier : la valeur des leads

Chaque inscription alimente la machine commerciale d'INFLUX :

- **Brevo** — emailing, nurturing, CRM, campagnes déclenchées depuis le backoffice.
- **Apollo.io** — prospection commerciale sortante, prioritairement sur les annonceurs.

Un lead qui n'arrive pas dans Brevo et Apollo est un lead perdu. La synchronisation est donc
une **fonctionnalité de premier plan**, pas un « nice to have » de fin de backlog.

---

## 4. Personas et parcours utilisateurs

### 4.1 Annonceur (marque / e-commerçant)

**Ce qu'il veut :** trouver vite des influenceurs crédibles, maîtriser son budget, mesurer.

Parcours cible :

1. **Découverte** — landing page, proposition de valeur claire, preuve sociale.
2. **Inscription libre** — création de compte, choix du profil « Annonceur ».
3. **Création de profil** — entreprise, secteur, produits, budget indicatif, objectifs.
4. **Publication d'une campagne** — brief, produit à promouvoir, formats attendus, budget,
   période, cibles (audience, thématique, zone géographique).
5. **Mise en relation** — réception de profils proposés (algorithme + agent humain),
   consultation des profils influenceurs, shortlist.
6. **Négociation** — échanges via messagerie interne (traçables).
7. **Contractualisation** — génération du contrat, montant, application de la commission 35 %.
8. **Suivi** — livrables, validation, paiement, bilan de campagne.

### 4.2 Influenceur (créateur de contenu)

**Ce qu'il veut :** des opportunités rémunérées qui collent à sa ligne éditoriale, sans perdre
de temps en prospection.

Parcours cible :

1. **Découverte** — landing dédiée créateurs, promesse « des marques viennent à vous ».
2. **Inscription libre** — création de compte, choix du profil « Influenceur ».
3. **Création de profil** — réseaux, thématiques, audience (volume, démographie), formats
   proposés, tarifs indicatifs, portfolio / campagnes passées.
4. **Découverte de campagnes** — fil de campagnes ouvertes + propositions ciblées reçues.
5. **Candidature / réponse** à une proposition.
6. **Négociation** — messagerie interne.
7. **Contractualisation** — contrat signé, rémunération nette connue **avant** signature.
8. **Exécution** — dépôt des livrables, validation par l'annonceur, paiement.

> ⚠️ **Point UX sensible.** L'influenceur doit comprendre sans ambiguïté ce qu'il touche
> réellement. Toute interface affichant un montant doit lever le doute entre *montant du
> contrat*, *commission INFLUX* et *net créateur*. C'est un point de contrôle obligatoire
> pour `expert-ux` et `expert-paiement-facturation`.

### 4.3 Agent interne INFLUX (backoffice)

**Ce qu'il veut :** piloter l'activité, faire matcher, relancer, encaisser.

Parcours cible :

1. **Tableau de bord** — inscriptions du jour, campagnes ouvertes, mises en relation en cours,
   contrats signés, CA commissionné.
2. **Gestion des comptes** — modération, vérification, qualification des profils.
3. **Matching assisté** — voir les suggestions de l'algorithme, les surcharger, forcer une mise
   en relation, annoter.
4. **Pilotage des campagnes marketing** — sélection d'un segment, **déclenchement d'envois via
   l'API Brevo directement depuis le backoffice**, suivi des performances.
5. **Suivi des leads** — état de synchronisation Brevo / Apollo.io, relance des échecs.
6. **Facturation** — contrats signés, commissions dues, encaissements, exports comptables.

Le backoffice est un **produit à part entière**, pas un écran d'admin bricolé. Il est utilisé
tous les jours par l'équipe et porte la rentabilité opérationnelle.

---

## 5. Identité de marque et principes UX

### 5.1 Charte graphique

| Élément | Règle |
|---|---|
| Nom | **INFLUX** (toujours en capitales dans l'UI et les documents) |
| Couleur de marque | **Vert** — couleur d'accent, d'action et de succès |
| Typographie | **Noir** pour le texte — contraste fort, lisibilité maximale |
| Base | Fonds clairs, beaucoup de blanc, respiration généreuse |
| Référence | https://wekollab.fr/ — niveau de finition à égaler |

**Les valeurs hexadécimales exactes (nuance de vert, échelle de gris, tokens de thème) ne sont
pas encore figées** : c'est une décision ouverte (§13) qui sera tranchée par `expert-ux` avec
validation du fondateur, puis formalisée via la skill `design-system-influx`. Aucun agent ne
doit inventer et disséminer des couleurs arbitraires dans le code : toute couleur passe par les
tokens du design system.

### 5.2 Principes UX non négociables

1. **Compréhension en 10 secondes.** La page d'accueil explique qui fait quoi et pour qui.
2. **Deux portes d'entrée assumées.** Annonceur et Influenceur ne partagent ni le même discours,
   ni le même onboarding, ni le même vocabulaire.
3. **Inscription sans friction.** Le minimum d'informations pour créer le compte ; le profil se
   complète progressivement (profil complété = meilleur matching, à rendre visible).
4. **Transparence financière permanente.** Le montant du contrat, la commission 35 % et le net
   créateur sont toujours explicites. Jamais de coût découvert en fin de parcours.
5. **Tout se passe dans INFLUX.** Les parcours ne doivent pas encourager la sortie de plateforme.
6. **Mobile-first.** Les influenceurs consultent majoritairement sur mobile.
7. **Accessibilité.** Contrastes conformes WCAG AA au minimum — le vert de marque ne doit jamais
   être le seul porteur d'information (état, erreur, succès).

---

## 6. Stack technique imposée

Ces choix sont **imposés par le fondateur** et ne sont pas rediscutables par les agents.

| Domaine | Technologie |
|---|---|
| Frontend | **React + TypeScript** |
| Backend | **Node.js + TypeScript** |
| Base de données | **Supabase** (PostgreSQL managé, Auth, Storage, RLS) |
| Hébergement du code | **GitHub** |
| Déploiement applicatif | **Railway** |
| Emailing / CRM | **Brevo** (API) |
| Prospection commerciale | **Apollo.io** (API) |

Sont **ouverts** et relèvent de l'agent `architecte` : framework React (Vite / Next.js),
framework backend Node (Express / Fastify / NestJS), librairie UI, gestion d'état, ORM ou accès
Supabase direct, structure monorepo ou multi-repo, outillage de test. Voir §13.

### Conventions de code attendues

- **TypeScript strict** (`strict: true`). Le `any` est interdit sauf justification en commentaire.
- **Nommage** : `camelCase` (variables/fonctions), `PascalCase` (composants/types),
  `SCREAMING_SNAKE_CASE` (constantes), `kebab-case` (fichiers non-composants).
- **Langue du code** : identifiants, commentaires et messages de commit **en anglais**. Les
  libellés affichés aux utilisateurs sont **en français**, externalisés dans des fichiers de
  traduction dès le départ (une ouverture à l'international est probable).
- **Pas de secret dans le code.** Toutes les clés (Supabase, Brevo, Apollo, Railway) passent par
  des variables d'environnement — voir la skill `env-secrets`.
- **Commits** : convention *Conventional Commits* (`feat:`, `fix:`, `chore:`, `docs:`…).
- **Branches** : `main` protégée, travail sur `feat/<sujet>` ou `fix/<sujet>`, merge par Pull
  Request avec revue.
- **Un module = une responsabilité.** Aucune logique métier dans les composants React.
- **Logique financière centralisée.** Le calcul de la commission n'existe qu'à **un seul endroit**
  dans tout le code. Toute duplication est un défaut bloquant.

---

## 7. Architecture cible (haut niveau)

```
                 ┌──────────────────────────────────────────────┐
                 │               Utilisateurs                   │
                 │  Annonceurs · Influenceurs · Agents INFLUX    │
                 └───────────────────┬──────────────────────────┘
                                     │
          ┌──────────────────────────┼──────────────────────────┐
          │                          │                          │
   ┌──────▼───────┐          ┌───────▼────────┐        ┌────────▼────────┐
   │ App publique │          │  App membres   │        │   Backoffice    │
   │ React + TS   │          │  React + TS    │        │   React + TS    │
   │ (marketing)  │          │  (marketplace) │        │   (interne)     │
   └──────┬───────┘          └───────┬────────┘        └────────┬────────┘
          └──────────────────────────┴──────────────────────────┘
                                     │  HTTPS / API
                          ┌──────────▼───────────┐
                          │   API Node.js + TS   │
                          │  ┌────────────────┐  │
                          │  │ Auth & profils │  │
                          │  │ Campagnes      │  │
                          │  │ Matching       │  │
                          │  │ Messagerie     │  │
                          │  │ Contrats       │  │
                          │  │ Commission 35% │  │
                          │  │ Leads & sync   │  │
                          │  └────────────────┘  │
                          └───┬──────────────┬───┘
                              │              │
                   ┌──────────▼──┐      ┌────▼──────────────────────┐
                   │  Supabase   │      │  Intégrations externes    │
                   │  Postgres   │      │  ┌─────────┐ ┌──────────┐ │
                   │  Auth       │      │  │  Brevo  │ │ Apollo.io│ │
                   │  Storage    │      │  └─────────┘ └──────────┘ │
                   │  RLS        │      │   (file d'événements)     │
                   └─────────────┘      └───────────────────────────┘

        Code : GitHub  ──────►  CI/CD  ──────►  Déploiement : Railway
```

### Domaines fonctionnels

| Domaine | Rôle |
|---|---|
| `identity` | Comptes, authentification, rôles (annonceur / influenceur / agent / admin) |
| `profiles` | Profils annonceurs et influenceurs, complétude, vérification |
| `campaigns` | Campagnes, briefs, budgets, formats, statuts |
| `matching` | Scoring et proposition de mises en relation, surcharge manuelle |
| `messaging` | Échanges traçables entre parties |
| `contracts` | Contrats, signature, montants, taux de commission historisé |
| `billing` | Commissions, facturation, encaissements, exports |
| `leads` | Capture de leads et synchronisation Brevo / Apollo.io |
| `backoffice` | Pilotage interne, campagnes Brevo, supervision |

### Principes d'architecture

1. **La synchronisation externe est asynchrone et rejouable.** Un échec Brevo ou Apollo ne doit
   jamais bloquer une inscription. File d'événements + retries + journal d'audit.
2. **La base est la source de vérité**, pas les outils externes.
3. **Sécurité par défaut** : Row Level Security Supabase activée sur toutes les tables contenant
   des données personnelles ou financières.
4. **Traçabilité** : toute mise en relation, tout changement de statut de contrat et tout calcul
   de commission sont journalisés et auditables (obligation business et légale).

---

## 8. Intégrations externes requises

| Service | Rôle dans INFLUX | Points d'attention |
|---|---|---|
| **Supabase** | Base PostgreSQL, authentification, stockage de fichiers (portfolios, livrables, contrats), RLS | Ne jamais exposer la `service_role key` côté client. Migrations versionnées dans Git. |
| **Brevo** | Emailing transactionnel, nurturing, CRM, **campagnes déclenchées depuis le backoffice via API** | Rate limits, idempotence, gestion des désinscriptions (obligation légale), segmentation par type de profil. Skill : `brevo-campaign`. |
| **Apollo.io** | Prospection commerciale sortante sur les leads annonceurs | Qualification avant envoi (ne pas polluer la base), mapping des champs, conformité de la prospection B2B. Skill : `apollo-lead-sync`. |
| **GitHub** | Hébergement du code, Pull Requests, revue, CI | `main` protégée, secrets dans GitHub Secrets. |
| **Railway** | Déploiement de l'API et des fronts, environnements | Séparation `staging` / `production`, variables d'environnement par environnement. Skill : `railway-deploy`. |

**Aucun de ces comptes n'est encore créé ni configuré** — voir §14, Prérequis.

### Règle de synchronisation des leads

À chaque inscription (annonceur ou influenceur), un événement `lead.created` est émis puis
consommé de façon asynchrone :

- → **Brevo** : création/mise à jour du contact, affectation à la bonne liste, entrée dans le
  scénario de nurturing correspondant au type de profil.
- → **Apollo.io** : prioritairement pour les **annonceurs** (cible de prospection commerciale),
  enrichissement et séquence commerciale.

Chaque tentative est journalisée avec son statut. Le backoffice expose les échecs et permet le
rejeu. **Le consentement de l'utilisateur conditionne l'envoi marketing** (cf. RGPD, §9).

---

## 9. Données personnelles et conformité

INFLUX traite des données personnelles des deux côtés du marché, et des données financières.

| Sujet | Exigence |
|---|---|
| Base légale | Consentement explicite pour le marketing (Brevo/Apollo), exécution du contrat pour le reste. Case à cocher non pré-cochée à l'inscription. |
| Droits des personnes | Accès, rectification, suppression, portabilité, opposition — à prévoir dès la conception, y compris la propagation de la suppression vers Brevo et Apollo. |
| Documents obligatoires | CGU, CGV, politique de confidentialité, mentions légales, politique cookies, **contrat d'intermédiation** matérialisant la commission de 35 %. |
| Statut d'INFLUX | Intermédiaire de mise en relation — les obligations d'information et de transparence des plateformes s'appliquent. |
| Mineurs | Certains influenceurs peuvent être mineurs : vérification d'âge et régime spécifique à traiter explicitement (législation française sur les enfants influenceurs). |
| Sécurité | Chiffrement en transit et au repos, RLS Supabase, principe du moindre privilège, journalisation des accès aux données sensibles. |

Agents référents : `expert-conformite-rgpd` (conformité) et `expert-cybersecurite` (sécurité
technique). Skill dédiée : `security-rgpd-audit`.

---

## 10. Règles de collaboration entre agents

### 10.1 Chaîne de décision

```
   Fondateur (humain)
        │  valide : vision, business, budget, branding, mise en production
        ▼
   chef-de-projet ──── arbitre priorités, séquence, cohérence fonctionnelle
        │
        ├─► product-owner ........ spécifie, rédige user stories et critères d'acceptation
        ├─► architecte ........... tranche les choix techniques structurants
        │       └─► dev-react-node, expert-database, integrateur (exécution)
        ├─► expert-ux ............ tranche les parcours et le design system
        ├─► expert-marketing ..... tranche le funnel, les segments, le contenu CRM
        └─► experts transverses .. matching, intégrations, paiement, sécurité, RGPD
                                   (avis obligatoire dans leur domaine)
```

### 10.2 Qui décide quoi

| Domaine | Décide | Valide / droit de veto |
|---|---|---|
| Priorités, périmètre d'un lot | `chef-de-projet` | Fondateur |
| Spécification fonctionnelle, critères d'acceptation | `product-owner` | `chef-de-projet` |
| Choix techniques structurants (framework, structure, librairies) | `architecte` | `chef-de-projet` |
| Modèle de données, migrations, RLS | `expert-database` | `architecte` |
| Implémentation applicative | `dev-react-node` | `architecte` + `testeur` |
| Parcours, maquettes, design system | `expert-ux` | Fondateur (branding) |
| Funnel, segments, contenus CRM | `expert-marketing` | `chef-de-projet` |
| Algorithme et règles de matching | `expert-matching` | `product-owner` |
| Contrats d'API externes, mapping, résilience | `expert-integrations-api` | `architecte` |
| Commission, facturation, flux financiers | `expert-paiement-facturation` | Fondateur |
| Git, CI/CD, déploiement Railway | `integrateur` | `architecte` |
| Stratégie et couverture de tests | `testeur` | `architecte` |
| Sécurité applicative | `expert-cybersecurite` | **veto bloquant** |
| Conformité RGPD et contractuelle | `expert-conformite-rgpd` | **veto bloquant** |

### 10.3 Règles de fonctionnement

1. **Une session démarre par `chef-de-projet`** si la demande est floue, transverse ou touche
   plusieurs domaines. Une demande précise et cadrée peut aller directement au spécialiste.
2. **Vetos bloquants.** `expert-cybersecurite` et `expert-conformite-rgpd` peuvent bloquer une
   livraison. Leur objection ne se contourne pas : elle se traite, ou se fait arbitrer par le
   fondateur, explicitement.
3. **Pas d'invention hors périmètre.** Un agent qui manque d'une information structurante
   l'inscrit en décision ouverte (§13) et propose des options argumentées — il ne choisit pas seul.
4. **Toute décision structurante est écrite** dans ce CLAUDE.md (section concernée + §13 mise à jour).
5. **Aucun agent ne modifie le modèle économique.** Le taux de 35 % et sa mécanique relèvent du
   fondateur seul.
6. **Aucun agent ne crée ni ne supprime de dépôt distant, et n'exécute de déploiement en
   production, sans confirmation explicite du fondateur.**
7. **Cohérence UI.** Toute contribution visuelle passe par les tokens du design system (skill
   `design-system-influx`). Pas de couleur ni d'espacement en dur.

---

## 11. Agents disponibles

Fichiers : `.claude/agents/<nom>.md`. Invocation : demander explicitement l'agent, ou laisser
Claude le sélectionner sur la base de sa `description`.

### Agents demandés au cadrage

| Agent | Quand le solliciter |
|---|---|
| `chef-de-projet` | Point d'entrée par défaut. Cadrage d'un besoin, arbitrage de priorités, découpage en lots, coordination multi-agents, point d'avancement. |
| `architecte` | Avant toute décision structurante : choix de framework, structure du code, découpage en modules, choix d'une librairie, revue de cohérence technique. |
| `dev-react-node` | Implémentation front React/TS et back Node/TS, refactoring, correction de bug, revue de code d'implémentation. |
| `expert-database` | Modélisation, schéma Supabase/PostgreSQL, migrations, index, politiques RLS, performance des requêtes. |
| `integrateur` | Git, branches, Pull Requests, CI/CD, configuration et déploiement Railway, environnements, variables d'environnement. |
| `testeur` | Stratégie de tests, tests unitaires/intégration/E2E, couverture, définition du « prêt à livrer ». |
| `expert-ux` | Parcours utilisateur, wireframes, design system, charte noir/vert, benchmark wekollab.fr, accessibilité. |
| `expert-marketing` | Funnel d'acquisition, conversion, segmentation, scénarios Brevo, séquences Apollo.io, contenus et messages. |
| `expert-cybersecurite` | Authentification, autorisation, protection des données, revue de sécurité avant livraison, gestion des secrets, dépendances. |

### Agents complémentaires ajoutés (et pourquoi)

| Agent | Justification de l'ajout |
|---|---|
| `product-owner` | Le fondateur n'est pas développeur. Sans traducteur entre l'intention métier et une spécification testable, chaque développement repose sur des suppositions. Cet agent produit user stories, règles de gestion et critères d'acceptation — le chaînon manquant entre `chef-de-projet` et `dev-react-node`. |
| `expert-matching` | La mise en relation **est** le produit. Ni l'architecte (technique) ni le développeur (implémentation) ne portent la logique métier du scoring : critères, pondérations, explicabilité, articulation avec l'intervention humaine. Le brief impose un dispositif hybride algorithme + agents humains : il mérite un responsable dédié. |
| `expert-integrations-api` | Brevo et Apollo.io sont des dépendances externes critiques (un lead non synchronisé est un lead perdu) et fragiles (rate limits, pannes, évolutions d'API). Cet agent détient les contrats d'interface, le mapping des champs, l'idempotence et les stratégies de reprise sur erreur. |
| `expert-paiement-facturation` | La commission de 35 % implique calcul, historisation du taux, facturation, TVA, encaissement, reversement au créateur et exports comptables. Domaine à risque financier et légal qui ne se délègue ni au développeur ni au marketing. |
| `expert-conformite-rgpd` | Données personnelles des deux profils, envoi vers deux outils tiers, contrats d'intermédiation, présence possible d'influenceurs mineurs. La conformité conditionne le droit d'exploiter la plateforme : elle a besoin d'un porteur avec droit de veto, distinct de la sécurité technique. |

---

## 12. Skills disponibles

Fichiers : `.claude/skills/<nom>/SKILL.md`. Une skill est un **mode opératoire réutilisable**
pour une tâche récurrente ou spécialisée du projet.

| Skill | Quand l'invoquer | Agents principaux |
|---|---|---|
| `feature-spec` | Transformer un besoin exprimé en spécification exploitable (user stories, règles de gestion, critères d'acceptation). | `product-owner`, `chef-de-projet` |
| `design-system-influx` | Créer ou modifier un écran, définir/étendre les tokens (noir/vert), vérifier la cohérence visuelle et l'accessibilité. | `expert-ux`, `dev-react-node` |
| `supabase-schema` | Modéliser une entité, écrire une migration, définir des politiques RLS. | `expert-database`, `architecte` |
| `brevo-campaign` | Intégrer l'API Brevo, synchroniser un contact, construire l'envoi de campagne depuis le backoffice. | `expert-integrations-api`, `expert-marketing` |
| `apollo-lead-sync` | Synchroniser un lead vers Apollo.io, mapper les champs, gérer la qualification et les erreurs. | `expert-integrations-api`, `expert-marketing` |
| `lead-pipeline` | Concevoir ou modifier le pipeline événementiel de capture et de distribution des leads (émission, file, retries, supervision). | `architecte`, `expert-integrations-api` |
| `matching-spec` | Définir ou faire évoluer les critères, pondérations et règles du moteur de mise en relation. | `expert-matching`, `product-owner` |
| `contract-commission` | Générer un modèle de contrat, appliquer et historiser la commission 35 %, calculer le net créateur. | `expert-paiement-facturation`, `expert-conformite-rgpd` |
| `railway-deploy` | Configurer un service, un environnement ou un déploiement Railway ; diagnostiquer un déploiement en échec. | `integrateur` |
| `env-secrets` | Ajouter, faire tourner ou documenter une variable d'environnement / un secret (Supabase, Brevo, Apollo, Railway, GitHub). | `integrateur`, `expert-cybersecurite` |
| `test-strategy` | Définir le plan de test d'une fonctionnalité, choisir le bon niveau de test, fixer le « prêt à livrer ». | `testeur`, `dev-react-node` |
| `security-rgpd-audit` | Revue avant livraison : sécurité applicative, données personnelles, consentement, droits des personnes. | `expert-cybersecurite`, `expert-conformite-rgpd` |

---

## 13. Décisions ouvertes

À trancher par l'agent indiqué, **avant** l'implémentation concernée. Ne pas inventer de réponse
hors de ce cadre ; mettre ce tableau à jour à chaque arbitrage.

| # | Sujet | Arbitre | Statut |
|---|---|---|---|
| D1 | Framework React : Vite (SPA) vs Next.js (SSR/SEO) — impacte fortement le SEO de la partie publique | `architecte` | Ouverte |
| D2 | Framework backend Node : Express / Fastify / NestJS | `architecte` | Ouverte |
| D3 | Structure du dépôt : monorepo (front + back + backoffice) vs multi-repo | `architecte` | Ouverte |
| D4 | Librairie UI : headless + utilitaire CSS, ou bibliothèque de composants — doit servir la charte noir/vert | `architecte` + `expert-ux` | Ouverte |
| D5 | Accès aux données : client Supabase direct, ORM (Prisma/Drizzle) ou couche d'accès maison | `expert-database` + `architecte` | Ouverte |
| D6 | Palette exacte : nuance de vert de marque, échelle de gris, tokens clair/sombre | `expert-ux` + Fondateur | Ouverte |
| D7 | Assiette de la commission : HT ou TTC ; traitement de la TVA | `expert-paiement-facturation` + Fondateur | Ouverte |
| D8 | Flux financier : INFLUX encaisse et reverse (tiers de confiance) ou facture sa seule commission | `expert-paiement-facturation` + Fondateur | Ouverte |
| D9 | Prestataire de paiement (Stripe Connect ou équivalent), si encaissement par INFLUX | `expert-paiement-facturation` + `architecte` | Ouverte |
| D10 | Signature électronique des contrats : solution tierce ou acceptation en ligne horodatée | `expert-conformite-rgpd` + `architecte` | Ouverte |
| D11 | Version 1 du matching : règles explicites pondérées ou approche par score appris | `expert-matching` | Ouverte |
| D12 | Backoffice : application séparée ou espace protégé de l'app membres | `architecte` + `product-owner` | Ouverte |
| D13 | Périmètre du MVP et ordre de livraison des lots | `chef-de-projet` + Fondateur | Ouverte |
| D14 | Modèle d'abonnement complémentaire à la commission (à moyen terme) | Fondateur | Ouverte |

---

## 14. Prérequis et prochaines étapes

> ⚠️ **Ces actions ne doivent PAS être exécutées par un agent sans confirmation explicite du
> fondateur.** Elles sont listées comme checklist à valider, notamment parce qu'elles créent des
> ressources externes, engagent des coûts ou modifient des comptes.

### 14.1 Dépôt de code

- [x] Initialiser le dépôt Git local (`git init`, branche `main`) — **fait le 2026-09-16**
- [x] Créer le `.gitignore` (node_modules, `.env*` sauf `.env.example`, artefacts de build, `.claude/settings.local.json`)
- [ ] Créer le dépôt distant GitHub (privé)
- [ ] Protéger la branche `main` (PR obligatoire, revue requise)
- [ ] Configurer les GitHub Secrets nécessaires au CI/CD

### 14.2 Comptes et services externes

- [ ] Créer le projet **Supabase** (région UE pour le RGPD) et récupérer les clés
- [ ] Créer le compte **Railway**, les environnements `staging` et `production`
- [ ] Créer le compte **Brevo**, générer la clé API, préparer les listes et attributs de contact
- [ ] Créer le compte **Apollo.io**, générer la clé API, définir les séquences commerciales
- [ ] Réserver le nom de domaine et configurer les DNS (+ authentification e-mail SPF/DKIM/DMARC
      pour Brevo)

### 14.3 Cadrage produit

- [ ] Valider avec le fondateur le périmètre du **MVP** (D13)
- [ ] Trancher les décisions D1 à D5 (`architecte`)
- [ ] Figer la palette et les tokens (D6, `expert-ux` + fondateur)
- [ ] Trancher le modèle financier D7/D8/D9 (`expert-paiement-facturation` + fondateur)
- [ ] Faire rédiger/valider les documents légaux par un juriste (CGU, CGV, contrat
      d'intermédiation, politique de confidentialité) — les agents préparent, un professionnel valide

### 14.4 Ordre de travail recommandé

1. Cadrage MVP avec `chef-de-projet` et `product-owner`
2. Décisions d'architecture avec `architecte` (D1→D5)
3. Design system et parcours clés avec `expert-ux` (D6)
4. Modèle de données avec `expert-database`
5. Socle technique et CI/CD avec `integrateur`
6. Parcours d'inscription + capture de leads (valeur business immédiate)
7. Campagnes, matching, messagerie
8. Contrats, commission, facturation
9. Backoffice et pilotage Brevo

---

## 15. Glossaire

| Terme | Définition |
|---|---|
| **Annonceur** | Marque ou entreprise qui souhaite promouvoir ses produits via des influenceurs. |
| **Influenceur / Créateur** | Personne proposant son audience et ses formats de contenu. |
| **Mise en relation** | Mise en contact qualifiée entre un annonceur et un influenceur, algorithmique et/ou opérée par un agent INFLUX. |
| **Campagne** | Offre publiée par un annonceur : brief, produit, formats, budget, période. |
| **Contrat** | Accord signé via INFLUX entre un annonceur et un influenceur. Fait générateur de la commission. |
| **Commission** | Part revenant à INFLUX : **35 %** du montant du contrat par défaut, taux historisé à la signature. |
| **Net créateur** | Montant perçu par l'influenceur après commission. |
| **Lead** | Inscription ou manifestation d'intérêt à synchroniser vers Brevo et/ou Apollo.io. |
| **Backoffice** | Application interne de pilotage utilisée par les agents INFLUX. |
| **Agent INFLUX** | Collaborateur humain de la plateforme (à ne pas confondre avec un agent Claude Code). |
| **RLS** | Row Level Security — contrôle d'accès aux lignes au niveau PostgreSQL/Supabase. |
