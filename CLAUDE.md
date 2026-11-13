# INFLUX — Guide projet pour Claude Code

> Lu par les agents IA **et** par le fondateur. Spécifications du MVP : `docs/mvp/` ; état et jalon
> actif : `docs/mvp/21-plan-de-developpement.md` §0 et §8. La **maquette** vit **uniquement sur la
> branche `demo`** et n'est **jamais fusionnée dans `main`** (§12).

**Règle d'or :** une décision structurante absente de ce document ou de
`docs/mvp/decisions.md` ne s'invente pas. Elle s'inscrit en décision ouverte et s'arbitre par
`architecte` (technique) ou `chef-de-projet` (fonctionnel). Toute divergence se corrige ici
d'abord, puis dans le code.

## Documents de référence (à lire à la demande, par section)

> **Ne jamais lire une spécification en entier** (≈ 3,4 Mo ; `04` seul ≈ 150k tokens), ni
> `docs/mvp/INDEX.md` en entier : `Grep "^## 04-" -A 70` dans l'index (par exemple) donne les
> sections, lignes de départ et RG citées ; puis `Read` borné de la seule tranche, ou `Grep` de la
> règle (`RG113`). `docs/mvp/archives/` : seulement pour un identifiant cité. Un crochet (D77)
> refuse la lecture entière d'un document de plus de 30 Ko (Read, Bash, PowerShell) et toute
> tranche de plus de 32 Ko.

| Sujet | Document |
|---|---|
| Décisions : résumé · texte intégral, qui fait foi (`Grep "^## D66 "`, jamais en entier) | `docs/mvp/decisions.md` · `docs/mvp/decisions-detail.md` |
| `staging` iso-production, exploité par les agents (D70) | `docs/mvp/runbooks/staging.md` |
| Périmètre et lots · régime courté | `docs/mvp/00-cadrage-mvp-v2.md` · `01-intermediation-courtee.md` |
| Architecture, surveillance (§20), envoi du code (§18.10), mécanique KEO (§21) | `docs/mvp/02-architecture-3-espaces.md` |
| Droits et RLS · modèle de données | `docs/mvp/03-matrice-des-droits-et-rls.md` · `04-modele-de-donnees-mvp.md` |
| Spécifications fonctionnelles · plan de test | `docs/mvp/05` à `17b` · `18-plan-de-test-mvp.md` |
| Direction design, charte KEO Emerald (D73) | `docs/mvp/20-direction-design.md` §11 |
| Plan de développement, reliquat, jalon actif | `docs/mvp/21-plan-de-developpement.md` §0, §8 |
| Prérequis (société, comptes, juristes) | `docs/mvp/prerequis.md` |

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
  remplacer : tout matching est explicable et surchargeable au backoffice.
- **International dès le lancement** : inscriptions mondiales, contrats limités aux **pays
  ouverts** (D26, en base), **français et anglais**. Aucun présupposé « France / euro / français ».
- Référence UX à égaler : **https://wekollab.fr/** (compréhension en 10 secondes).
- Métriques créateur prioritaires par réseau (D61) : communauté, rythme de publication,
  commentaires moyens par publication.

## 2. Modèle économique — INVARIANT MÉTIER

> **Commission de 35 % du montant de chaque contrat signé via INFLUX : 20 % part annonceur +
> 15 % part créateur.** Relève du fondateur seul : aucun agent ne la modifie.

- Le **montant du contrat est le coût total annonceur** (commission incluse).
  `montant = part annonceur + part créateur + net créateur`, toujours vrai.
- Les deux taux sont **en base, paramétrables**, et **figés sur chaque contrat** à la signature.
- Fait générateur : la signature. Tout reste **traçable dans INFLUX** ; un parcours poussant à
  échanger des coordonnées hors plateforme est un **critère de rejet**.
- Le calcul de commission n'existe qu'**à un seul endroit** du code (duplication = défaut bloquant).
- Exemple de référence : 2 000 → 400 (annonceur) + 300 (créateur) + 1 300 (net) = 2 000.

> ### ⏳ Régime transitoire du MVP
> Contrat envoyé et signé **hors plateforme** par le commercial, paiement à la confiance (A1).
> **Interdiction : aucun taux ni calcul de commission dans le code.** `commission_rates` existe et
> reste vide ; le commercial saisit montant et commission, l'application enregistre et additionne
> sans jamais déduire d'un taux. **Aucun pourcentage ni net estimé affiché** (D48) : « commission
> incluse, précisée par votre commercial ». **Aucun tarif créateur saisi ni annoncé**, et au Lot 3
> **aucun montant côté créateur** (recherche, candidature) ; le budget de campagne, en tranche, n'est
> vu que du commercial (D78). Les coûts se négocient avec le commercial. Encaissement : V2.

**Leads :** inscription gratuite ; chaque inscrit arrive dans **Brevo** (et **Apollo.io** selon la
configuration, D33). La synchronisation est une fonctionnalité de premier plan.

## 3. Personas (résumé)

- **Annonceur** : trouver vite des créateurs crédibles, maîtriser son budget.
- **Créateur** : opportunités rémunérées, comprendre sans ambiguïté ce qu'il touche (au MVP, le
  commercial l'annonce).
- **Commercial INFLUX (backoffice)** : partie prenante de chaque mise en relation — file de
  validation (SLA 1 jour ouvré, une entrée hors délai reste en file, D49), proposition INFLUX,
  conversation à trois, pipeline (seuls le responsable et l'admin écrivent, D50), invitation
  nominative (D54), badge « vérifié » (retrait approuvé par un admin distinct, D51), leads, e-mails
  Brevo. Produit à part entière, pour poste de travail ; mobile limité à deux gestes (D58).

Parcours détaillés : `00`, `17` et `17b`.

## 4. Identité et principes UX

- Nom **INFLUX** en capitales. **Dark theme partout, sans exception** (fond noir nuancé, jamais
  noir pur). **Vert** = marque et action ; **succès** dans sa propre teinte (sarcelle), distinct.
- **Deux chartes** (D73) : la **vitrine** (landing, pages légales publiques) garde D6 et D59, avec
  le vert de marque unique ; les **espaces connectés** (inscription, connexion, espaces marque et
  créateur, backoffice) suivent **KEO Emerald** (`20` §11 ; polices Manrope et Source Sans 3
  auto-hébergées, cartes de 16 px, boutons en pilule).
- Poste de travail : **navigation en colonne à gauche** (comportement de Railway, jamais son
  style), pages d'une rubrique en **sous-menu** de la rubrique active (D74) ; téléphone : barre du
  bas à cinq entrées et page-menu par rubrique (membres), vue D58 (backoffice). Ni pilules de
  section ni onglets de rubrique en tête de contenu.
- **Toute couleur et tout espacement passent par les tokens** (`packages/ui/src/styles/tokens.css`,
  bloc `[data-theme="keo"]` ; skill `design-system-influx`). Rien en dur, rien recopié de
  `design-proposals/`.
- Landing : carte métallisée premium, **un seul effet spectaculaire par écran** (D59).
- Principes : compréhension en 10 s ; deux portes d'entrée distinctes ; inscription minimale ;
  tout se passe dans INFLUX ; **mobile-first** ; **WCAG AA**, le vert n'est jamais seul porteur
  d'information ; **bilingue FR/EN** sur chaque écran, e-mail et document, formats selon la langue.

## 5. Stack et architecture

Imposé par le fondateur : **React + TS**, **Node.js + TS**, **Supabase**, **GitHub**, **Railway**,
**Brevo**, **Apollo.io**.

| Domaine | Choix |
|---|---|
| Fronts | **Next.js** (App Router), next-intl (ICU), **Tailwind v4** alimenté par les seuls tokens, pas de bibliothèque de composants ; polices par `next/font/local` seulement (aucun appel à Google Fonts), icônes `lucide-react` par un seul module `icons.ts` par front (`02` §21) |
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

**Conventions :** TypeScript strict, `any` interdit sauf justification commentée ; `camelCase`,
`PascalCase`, `SCREAMING_SNAKE_CASE`, fichiers `kebab-case` ; code, commentaires et commits **en
anglais**, libellés FR/EN externalisés ; pays ISO 3166-1, devise ISO 4217, langue et fuseau
explicites ; **aucun secret dans le code** (skill `env-secrets`) ; aucune logique métier dans les
composants React ; **Conventional Commits**, développement **directement sur `main`** (dérogation
du fondateur).

## 6. Données personnelles

Niveau RGPD pour tous, plus les règles locales (LGPD, Loi 25, CCPA, CASL). Consentement
marketing **non pré-coché, obligatoire à l'inscription** (D63, contre la recommandation, juriste
requis). **Mineurs exclus** (attestation 18+, D15). Droits des personnes prévus dès la conception,
suppression propagée à Brevo et Apollo. Référents : `expert-conformite-rgpd`,
`expert-cybersecurite` (vetos). Skill : `security-rgpd-audit`.

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
| Sécurité · conformité | `expert-cybersecurite` · `expert-conformite-rgpd` | **veto bloquant sur `production`** (D71) |

**Règles :**
1. Demande floue ou transverse → `chef-de-projet` ; demande cadrée → spécialiste directement.
2. Un veto ne se contourne pas : il se traite ou s'arbitre explicitement par le fondateur. Il ne
   bloque, avec le contrôle I-4 (`security-reviewed:`), **que la branche `production`** et ce qui y
   entre (D71) ; sur `main`, build, CI et `staging` passent, la CI signale les marqueurs manquants.
3. Toute décision structurante est écrite (ici ou dans `docs/mvp/decisions.md`).
4. **Sur confirmation explicite du fondateur seulement** : création ou suppression d'un dépôt
   distant, d'un projet, d'un environnement ou d'un service ; **toute action sur la production,
   lecture comprise** ; remise à zéro de la base de `staging` ; DNS ; actions de
   `docs/mvp/prerequis.md` ; toute écriture distante par `gh` hors CI. **`staging` est exploité par
   les agents (D70)** : Railway (variables, réglages, redéploiement, retour arrière), Supabase
   (`config push`, SQL de données, clés), environnement GitHub `staging`, comptes Brevo et Apollo de
   `staging`. Migrations par la seule CI, jamais `railway up`. **CI** (`gh` authentifiée, compte
   `cdurbal`) : après chaque push, `gh run watch <id> --exit-status` en arrière-plan, sans bloquer ;
   un échec se corrige avant tout nouveau commit (`gh run view <id> --log-failed` ;
   `gh run rerun --failed` permis), sans attendre le fondateur.
5. **Vélocité :**
   - Micro-écart (`EC-*`) sans enjeu d'invariant : le choix le plus sûr, sans arrêt, documenté en
     fin de jalon.
   - Revue groupée `testeur` et `expert-cybersecurite` en fin de jalon, non bloquante sur `main`,
     exigée avant `production` ; commits déjà poussés couverts par un commit d'attestation
     `security-reviewed: <date> covers <sha>…`, jamais en réécrivant `main`.
     `expert-conformite-rgpd` au Lot 6 seulement (d'ici là : cases non pré-cochées, attestation 18+).
   - **Tests (D76).** Pendant le codage, le seul fichier en cours. Avant commit, selon
     `git diff --cached --name-only` :
     - documentation seule (`*.md`, `docs/**`) : rien ; le hook pré-commit régénère `INDEX.md`
       (`git config core.hooksPath .githooks` une fois par clone) ;
     - code : `pnpm check:fast` ; base touchée (`supabase/**`, repositories, schémas Drizzle, routes
       et services en base, `db-tests/**`) : en plus
       `pnpm --filter @influx/api test:db -- <fichiers du domaine> --reporter=dot`, **toute la suite
       base** pour une migration ou une RLS ; écran : sa spec
       (`pnpm --filter @influx/web exec playwright test <spec> --reporter=line`) ;
     - suite complète (`pnpm check`, puis `pnpm test:e2e`) : fin de jalon, avant une revue groupée
       ou `production`, nouvelle dépendance. En cas de doute, palier supérieur.
   - **Push par lot** : 3 à 4 commits, fin de jalon, avant une revue, à la demande du fondateur, au
     moins une fois par jour de travail ; la CI rejoue tout sur `main` (documentation seule :
     contrôles légers).
   - **Jalons (D77, amendée le 2026-11-13)** : `/lot-decoupe <N>` → `/jalon-prepare <id>` →
     `/jalon-run <id>`, chaque ligne dans un sous-agent neuf ; état dans `jalons/<id>/run.md` (une
     ligne par commit, note de 160 caractères au plus) ; `21` §8 : une ligne à l'ouverture, une à la
     clôture, aucun récit. Gabarits et arrêts : les skills de la chaîne.
   - Lots 3 à 5 : mode serré (`00` §9), puis **reprise intégrale du mode normal (Lot 6bis)**.

Agents : `.claude/agents/<nom>.md`. Skills : `.claude/skills/<nom>/SKILL.md` (`contract-commission`
est hors MVP).

## 8. Intégrations

- **Supabase** : `service_role` jamais côté client, migrations versionnées, région UE à confirmer (D25).
- **Brevo** : idempotence, rate limits, désinscriptions, segmentation par profil, langue et pays,
  source d'acquisition (D55) ; trois sous-domaines d'envoi authentifiés (la délivrabilité
  conditionne la connexion des membres).
- **Apollo.io** : périmètre en configuration (`05` RG81) ; tous les pays par défaut, sauf exclusion
  par un administrateur (`apollo_excluded_countries`, RG84, D33) ; base légale par pays
  (`consentement_requis` par défaut, RG83).
- **`staging` = production** (D70) : envois réels, mêmes exigences de démarrage ; seules
  différences : `INFLUX_ENV`, comptes et clés propres, domaine d'envoi propre, `noindex`, bandeau,
  données synthétiques ; `live` accepté en `staging`.
- **`.env.local` = valeurs de `staging`, et uniquement `staging`** (D70) : utilisable par tous les
  agents ; jamais une valeur de production ; jamais une valeur recopiée dans une réponse, un
  document, un commit ou un journal ; jamais chargé par un test automatisé (doublure, `16` RG148).
- Chaque tentative de synchronisation est journalisée ; les échecs sont rejouables au backoffice.

## 9. Décisions (résumé : `decisions.md` ; `decisions-detail.md` fait foi)

- **Ouvertes, porte de `production`** : D24 créateurs particuliers et fiscalité · D33 périmètre
  Apollo (veto RGPD, juriste) · D34 libellés du badge (juriste) · D63 consentement obligatoire
  (juriste).
- **Ouvertes, par échéance** : D38 masse critique (Lot 3) · D30 coordonnées dans la messagerie
  (Lot 4) · D35 saisie libre d'e-mails, D36 langue du backoffice (Lot 5) · plus tard : D14, D21,
  D29, DZ-1, 2, 4 à 7 · technique : gestion d'état côté front (aucune librairie sans besoin réel).
- **V2 (A1)** : D7, D9, D10, D19, D20, D22, D23, D26, D27 — **D7/D23 se réactivent au premier euro
  encaissé, D20 au premier litige.**
- **Tranchées qui cadrent le travail courant** : D25 (société en Angleterre ; identité en
  marqueurs dans `apps/api/legal/`) · D70 · D71 (`production` n'avance que par
  `git merge --no-ff main`) · D73 à D75 · D76 · D77 · D78 (étendue au Lot 3) · D79 · D83.

## 10. Lots du MVP

0 Socle ✅ · 1 Inscription et leads ✅ (`staging` ; production préparée, non ouverte) · extras DS,
SN, RK ✅ · 2 Profils et badge ✅ (2026-11-13, réserves au §8 de `21`) · **3 Campagnes et
recherche anonymisée** · 4 Mise en relation et messagerie · 5 Backoffice, pipeline, e-mails ·
6 Recette, audit, ouverture · 6bis rattrapage du mode normal.

## 11. Glossaire

**Annonceur** marque · **Créateur** influenceur · **Commission** 35 % (20 % + 15 %) ·
**Net créateur** montant − commission · **Pays ouvert** pays autorisé aux contrats ·
**Agent INFLUX** collaborateur humain (≠ agent Claude Code) · **Maquette** code jetable de `demo`.

## 12. Maquette jetable (D44)

- `main` : landing (pages publiques de `apps/web`, `components/landing|ui`, `content/`,
  `locales/*/landing.json`, `i18n/`, `styles/`), spécifications, outillage, produit réel.
- `demo` uniquement : maquette (API simulée, backoffice, espaces membres), **jamais fusionnée ni
  copiée dans `main`**, jamais branchée sur de vrais services, sans secret ni donnée réelle ; URL
  protégée, bandeau « Démonstration », non indexée (D56). Les spécifications font foi.
- Textes de la landing relus (D48) avant `production` (`21` §5.8).
