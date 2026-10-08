# INFLUX — Guide projet pour Claude Code

> **Statut :** spécifications du MVP dans `docs/mvp/` ; avancement du produit réel dans
> `docs/mvp/21-plan-de-developpement.md` (jalon actif). La **maquette de démonstration** vit
> **uniquement sur la branche `demo`** et ne doit **jamais être fusionnée dans `main`** (§12).
> Ce document est lu par les agents IA **et** par le fondateur.

**Règle d'or :** une décision structurante absente de ce document ou de
`docs/mvp/decisions.md` ne s'invente pas. Elle s'inscrit en décision ouverte et s'arbitre par
`architecte` (technique) ou `chef-de-projet` (fonctionnel). Toute divergence se corrige ici
d'abord, puis dans le code.

## Documents de référence (à lire à la demande, par section)

> **Ne jamais lire une spécification en entier** (3 Mo au total, `04` seul ≈ 140k tokens).
> Consulter `docs/mvp/INDEX.md` (sections, lignes de départ, RG citées), puis lire la seule
> tranche utile avec `Read` (`offset`/`limit`) ou chercher la règle avec `Grep` (`RG113`).
> Après toute modification d'une spécification : `pnpm docs:index`.

| Sujet | Document |
|---|---|
| Registre des décisions D1 à D65 (statut, détail) | `docs/mvp/decisions.md` |
| Périmètre et lots du MVP | `docs/mvp/00-cadrage-mvp-v2.md` |
| Régime courté, commission au MVP | `docs/mvp/01-intermediation-courtee.md` |
| Architecture, 3 espaces, surveillance (§20), envoi du code (§18.10) | `docs/mvp/02-architecture-3-espaces.md` |
| Droits et RLS | `docs/mvp/03-matrice-des-droits-et-rls.md` |
| Modèle de données | `docs/mvp/04-modele-de-donnees-mvp.md` |
| Spécifications fonctionnelles | `docs/mvp/05` à `17b` |
| Direction design | `docs/mvp/20-direction-design.md` |
| Plan de développement, jalons | `docs/mvp/21-plan-de-developpement.md` |
| Prérequis (société, comptes, juristes) | `docs/mvp/prerequis.md` |

---

## 1. Vision produit

**INFLUX est une marketplace B2B2C de mise en relation entre annonceurs (marques) et
influenceurs (créateurs).** INFLUX est l'intermédiaire et se rémunère sur les contrats signés.

- **Au MVP, place de marché *courtée*** : découverte libre (la marque cherche des créateurs sur
  des **profils anonymisés**, le créateur postule aux campagnes), mais **aucune conversation sans
  validation d'un commercial puis acceptation des deux parties** (D45). Identités révélées à la
  seconde acceptation ; **jamais l'e-mail ni le téléphone** de l'autre partie (D46). Le commercial
  est **intermédiaire visible et nommé** dans une conversation à trois, peut ouvrir des **apartés**
  annoncés et confidentiels (D47), et peut **initier lui-même** une mise en relation.
- **Pas d'algorithme de matching au MVP** (D11). Plus tard, il priorise l'agent humain sans le
  remplacer : tout matching doit être explicable et surchargeable au backoffice.
- **International dès le lancement** : inscriptions mondiales, contrats limités aux **pays
  ouverts** (D26, en base), **français et anglais**. Aucun présupposé « France / euro / français ».
- Référence UX à égaler : **https://wekollab.fr/** (compréhension en 10 secondes).
- Métriques créateur prioritaires par réseau (D61) : taille de communauté, rythme de publication,
  commentaires moyens par publication.

## 2. Modèle économique — INVARIANT MÉTIER

> **Commission de 35 % du montant de chaque contrat signé via INFLUX : 20 % part annonceur +
> 15 % part créateur.** Relève du fondateur seul : aucun agent ne la modifie.

- Le **montant du contrat est le coût total annonceur** (commission incluse).
  `montant = part annonceur + part créateur + net créateur`, toujours vrai.
- Les deux taux sont **en base, paramétrables**, et **figés sur chaque contrat** à la signature.
- Fait générateur : la signature. Tout doit rester **traçable dans INFLUX** ; un parcours poussant
  à échanger des coordonnées hors plateforme est un **critère de rejet**.
- Le calcul de commission n'existe qu'**à un seul endroit** du code (duplication = défaut bloquant).
- Exemple de référence : 2 000 → 400 (annonceur) + 300 (créateur) + 1 300 (net) = 2 000.

> ### ⏳ Régime transitoire du MVP
> Contrat envoyé et signé **hors plateforme** par le commercial, paiement à la confiance (A1).
> **Interdiction : aucun taux ni calcul de commission dans le code.** `commission_rates` existe et
> reste vide ; le commercial saisit montant et commission, l'application enregistre et additionne
> sans jamais déduire d'un taux. **Aucun pourcentage ni net estimé affiché** (D48) : « commission
> incluse, précisée par votre commercial ». Encaissement dans la plateforme : V2.

**Leads :** inscription gratuite ; chaque inscrit doit arriver dans **Brevo** (et **Apollo.io**
selon la configuration, D33). La synchronisation est une fonctionnalité de premier plan.

## 3. Personas (résumé)

- **Annonceur** : trouver vite des créateurs crédibles, maîtriser son budget.
- **Créateur** : opportunités rémunérées, comprendre sans ambiguïté ce qu'il touche (au MVP, c'est
  le commercial qui l'annonce).
- **Commercial INFLUX (backoffice)** : partie prenante de chaque mise en relation ; file de
  validation (SLA 1 jour ouvré, une entrée hors délai reste en file, D49), proposition INFLUX,
  conversation à trois, pipeline d'affaire (seuls le responsable et l'admin écrivent, D50),
  invitation nominative (D54), badge « vérifié » (retrait approuvé par un admin distinct, D51),
  suivi des leads, envoi d'e-mails Brevo. Le backoffice est un **produit à part entière**, pensé
  pour poste de travail, avec une vue mobile limitée à deux gestes (D58).

Parcours détaillés : `docs/mvp/00-cadrage-mvp-v2.md`, `17` et `17b`.

## 4. Identité et principes UX

- Nom **INFLUX** en capitales. **Dark theme partout, sans exception** (fond noir nuancé, jamais
  noir pur). **Vert** = marque et action ; **succès en sarcelle**, distinct.
- **Toute couleur et tout espacement passent par les tokens** (`apps/web/src/styles/tokens.css`,
  skill `design-system-influx`). Rien en dur.
- Landing : carte métallisée premium, **un seul effet spectaculaire par écran** (D59).
- Principes : compréhension en 10 s ; deux portes d'entrée distinctes ; inscription minimale ;
  tout se passe dans INFLUX ; **mobile-first** ; **WCAG AA**, le vert n'est jamais seul porteur
  d'information ; **bilingue FR/EN** sur chaque écran, e-mail et document, formats selon la langue.

## 5. Stack et architecture

Imposé par le fondateur : **React + TS**, **Node.js + TS**, **Supabase**, **GitHub**, **Railway**,
**Brevo**, **Apollo.io**.

| Domaine | Choix |
|---|---|
| Fronts | **Next.js** (App Router), next-intl (ICU), **Tailwind v4** alimenté par les seuls tokens, pas de bibliothèque de composants |
| Dépôt | Monorepo **pnpm 11** : `apps/web` (public + marque + créateur), `apps/backoffice` (hôte distinct, `noindex`, MFA, session courte), `apps/api` (Fastify 5 + worker), `packages/*` au premier besoin, `supabase/{migrations,seed}` |
| `apps/api` | **Sans build** : TS exécuté par Node (syntaxe effaçable seulement, pas d'`enum`/`namespace`/alias, `import type`, extension `.ts`), Node ≥ 24.12 en prod. Schémas zod compilés dans `src/platform/` ; une route sans schéma de réponse empêche le démarrage. Un secret interne par front (D64) |
| Données | **Drizzle**, migrations **SQL relues** (`drizzle-kit push` interdit) ; `@supabase/auth-js` cantonné à `apps/api` ; **un schéma par domaine, rien dans `public`**, `REVOKE ALL` sur `anon`/`authenticated` |
| File | `outbox_events` + worker `FOR UPDATE SKIP LOCKED` (leads, e-mails de révélation). Ni Redis, ni BullMQ |
| Auth | Membres : **code à 6 chiffres par e-mail**, sans mot de passe. Backoffice : mot de passe + **TOTP obligatoire**. Code envoyé **en synchrone par `apps/api`** (D43) |
| Surveillance | **Tout interne** (schéma `ops`, pino, sonde du worker), aucun outil externe, aucune donnée personnelle superflue dans les journaux (D60) |

**Règles non négociables :**
1. **Le front ne parle jamais à Supabase** pour de la donnée métier et ne porte **aucune clé
   Supabase**. Seul `apps/api` détient la `service_role key`.
2. **Rôles applicatifs = vrais rôles Postgres** (`SET LOCAL ROLE` par transaction), **aucun rôle
   d'exécution avec `BYPASSRLS`**. RLS sur toute table personnelle ou financière.
3. **L'anonymisation est une séparation d'objets** (profil identifiant sans `GRANT` au rôle
   annonceur, profil public anonymisé), doublée d'une politique SQL, d'un filtre de sortie et d'un test.
4. Synchronisation externe **asynchrone et rejouable** ; un échec Brevo/Apollo ne bloque jamais
   une inscription. La base est la source de vérité.
5. Toute mise en relation, tout changement de statut et toute lecture privilégiée sont **journalisés**.

### Conventions de code

- TypeScript strict, `any` interdit sauf justification commentée.
- Nommage : `camelCase`, `PascalCase`, `SCREAMING_SNAKE_CASE`, fichiers `kebab-case`.
- Code, commentaires et commits **en anglais** ; libellés utilisateurs FR/EN externalisés.
- Pays ISO 3166-1, devise ISO 4217, langue et fuseau explicites.
- **Aucun secret dans le code** (skill `env-secrets`).
- **Conventional Commits.** Dérogation du fondateur : développement **directement sur `main`**.
- Aucune logique métier dans les composants React.

## 6. Données personnelles

Niveau RGPD pour tous, plus les règles locales (LGPD, Loi 25, CCPA, CASL). Consentement
marketing **non pré-coché, obligatoire à l'inscription** (D63, contre la recommandation, juriste
requis). **Mineurs exclus** (attestation 18+, D15). Droits des personnes prévus dès la conception,
suppression propagée à Brevo et Apollo. Référents : `expert-conformite-rgpd`,
`expert-cybersecurite` (vetos bloquants). Skill : `security-rgpd-audit`.

## 7. Collaboration entre agents

| Domaine | Décide | Valide / veto |
|---|---|---|
| Priorités, lots | `chef-de-projet` | Fondateur |
| Spécification | `product-owner` | `chef-de-projet` |
| Choix techniques | `architecte` | `chef-de-projet` |
| Données, migrations, RLS | `expert-database` | `architecte` |
| Implémentation | `dev-react-node` | `architecte` + `testeur` |
| UX, design system | `expert-ux` | Fondateur |
| Funnel, CRM | `expert-marketing` | `chef-de-projet` |
| Recherche, anonymisation, matching | `expert-matching` | `product-owner` |
| Intermédiation, pipeline, commission | `expert-paiement-facturation` | Fondateur |
| API externes | `expert-integrations-api` | `architecte` |
| Git, CI/CD, Railway | `integrateur` | `architecte` |
| Tests | `testeur` | `architecte` |
| Sécurité | `expert-cybersecurite` | **veto bloquant** |
| Conformité | `expert-conformite-rgpd` | **veto bloquant** |

**Règles :**
1. Demande floue ou transverse → `chef-de-projet` ; demande cadrée → spécialiste directement.
2. Un veto ne se contourne pas : il se traite ou s'arbitre explicitement par le fondateur.
3. Toute décision structurante est écrite (ici ou dans `docs/mvp/decisions.md`).
4. **Aucune création/suppression de dépôt distant ni déploiement en production** sans
   confirmation explicite du fondateur ; idem pour les actions de `docs/mvp/prerequis.md`.
5. **Discipline de vélocité (objectif MVP fin octobre) :**
   - Micro-écarts (`EC-*`) sans enjeu d'invariant : appliquer le choix le plus sûr, sans arrêt,
     documentation regroupée en fin de jalon.
   - `expert-cybersecurite` et `testeur` : **une revue groupée en fin de jalon** (marqueurs
     `security-reviewed:` I-4 apposés à ce moment).
   - `expert-conformite-rgpd` : **seulement au Lot 6** ; au Lot 1, `dev-react-node` respecte les
     cases non pré-cochées et l'attestation 18+ de `04`.
   - Tests : pendant le codage, le seul fichier en cours
     (`pnpm --filter @influx/api test:db -- <fichier> --reporter=dot`). **Avant chaque commit,
     suite complète obligatoire** : `pnpm typecheck`, `pnpm lint`, `pnpm test -- --reporter=dot`,
     `pnpm --filter @influx/api test:db -- --reporter=dot`.
   - `21-plan-de-developpement.md` : **1 ligne par commit** (`[x] Commit N (\`sha\`) — …`),
     condensée en 1 ligne à la clôture ; aucun récit.
   - Lots 3 à 5 : mode serré (`00` §9) d'abord, puis **reprise intégrale du mode normal (Lot 6bis)**.

Agents : `.claude/agents/<nom>.md`. Skills : `.claude/skills/<nom>/SKILL.md` (la description de
chacun indique quand l'invoquer ; `contract-commission` est hors MVP).

## 8. Intégrations

- **Supabase** : `service_role` jamais côté client, migrations versionnées, région UE à confirmer (D25).
- **Brevo** : idempotence, rate limits, désinscriptions, segmentation par profil/langue/pays, source
  d'acquisition (D55). **Trois sous-domaines d'envoi** authentifiés avant le Lot 1 : la
  délivrabilité conditionne la connexion des membres.
- **Apollo.io** : périmètre en configuration, valeur d'attente conservatrice (`05` RG81), seulement
  dans les pays où la base légale est validée.
- Postes de dev : uniquement des **comptes Brevo/Apollo de test** dans `apps/api/.env.local` (D62).
- Chaque tentative de synchronisation est journalisée, les échecs sont rejouables au backoffice.

## 9. Décisions ouvertes (détail dans `docs/mvp/decisions.md`)

- **D25 tranchée (2026-10-08)** : société en **Angleterre**, CGU sous droit d'Angleterre et du
  pays de Galles (UK GDPR + RGPD UE). Identité de la société encore en marqueurs dans `apps/api/legal/`.
- **D29** fenêtre de non-contournement · **D33** périmètre Apollo (veto RGPD, juriste avant Lot 1) ·
  **D63** consentement obligatoire (juriste avant Lot 1) · **D21** influence commerciale par pays.
- **D24** créateurs particuliers et fiscalité · **D34** libellé du badge · **D38** masse critique
  avant recherche · **D30** coordonnées dans la messagerie · **D35** saisie libre d'e-mails ·
  **D36** langue du backoffice · **D61** points restants · **D14** abonnement.
- Reportées en V2 (A1) : D7, D9, D10, D19, D20, D22, D23, D26, D27 — **D7/D23 se réactivent au
  premier euro encaissé, D20 au premier litige.**
- Ouvert technique : gestion d'état côté front (aucune librairie sans besoin réel).

## 10. Lots du MVP

0 Socle · 1 Inscription et leads (1re mise en ligne) · 2 Profils et badge · 3 Campagnes et
recherche anonymisée · 4 Mise en relation et messagerie · 5 Backoffice, pipeline, e-mails ·
6 Recette, audit, ouverture. Détail : `docs/mvp/00-cadrage-mvp-v2.md`.

## 11. Glossaire

**Annonceur** marque · **Créateur** influenceur · **Commission** 35 % (20 % + 15 %) ·
**Net créateur** montant − commission · **Pays ouvert** pays autorisé aux contrats ·
**Agent INFLUX** collaborateur humain (≠ agent Claude Code) · **Maquette** code jetable de `demo`.

## 12. Maquette jetable (D44)

- `main` : landing page (`apps/web` pages publiques, `components/landing|ui`, `content/`,
  `locales/*/landing.json`, `i18n/`, `styles/`), spécifications, outillage, et le produit réel.
- `demo` uniquement : maquette (API simulée, backoffice, espaces membres). **Jamais fusionnée ni
  copiée dans `main`**, jamais branchée sur de vrais services. Les spécifications font foi, pas la
  maquette. Aucun secret ni donnée réelle ; montrée seulement sur URL protégée, bandeau
  « Démonstration », non indexée (D56).
- Avant la mise en ligne de la landing : brancher les boutons `/signup`, `/login`,
  `/signup/advertiser`, `/signup/creator` sur le vrai Lot 1 et faire relire les textes (D48).
