# Jalon L2A — Dette d'ouverture, marge e2e, référentiels du Lot 2

> **Source :** `jalons/lot2-plan.md` l. 25 (ligne L2A) et l. 35-47 (reliquat repris) · **Préparé le**
> 2026-11-01 par Claude Code (`/jalon-prepare L2A`) · **Statut :** validé par le fondateur le
> 2026-11-01 (réponses en fin de fiche) · **Exécution :** `/jalon-run l2a`, table `jalons/l2a/run.md`.

## Objectif et périmètre

Solder la dette qui précède les écrans du Lot 2 (RK-fin, PLS-1, PLS-3 et PLT-6, SNT-3, J4S-7),
regagner au moins 10 s d'e2e par l'horloge simulée de `journey-resume` (`21` §2.3 point 3), poser les
référentiels du lot (`0201`). **Ne change pas :** aucun écran, aucune route d'API, aucune règle métier,
aucun libellé, la vitrine (G3e, TD4, TK8.2) ; aucune table hors du schéma `reference` ; aucun montant,
taux, net ni tarif (CLAUDE.md §2, D48, D78).

## Invariants

1. Aucune ligne dans `reference.price_bands` ; colonnes `net_*`, contraintes et `REVOKE` de `04` l. 516-553
   créés tels quels ; aucun rôle d'exécution n'écrit un référentiel (T16).
2. Référentiels = schéma : chargés par `0201`, jamais par `supabase/seed` (`04` §11.1 règle 6) ; aucun
   libellé stocké, `label_key` seul (R8).
3. Droits calqués sur `0003` l. 265-308 : `SELECT` aux quatre rôles métier, membres avec contexte,
   `agent` et `admin` en aal2 ; RLS activée et forcée ; rien d'autre. Chaque table entre dans
   `expected-rights.ts` dans le même commit (T2).
4. Tranches : bornes entières, borne haute incluse, contiguës, sans chevauchement, dernière ouverte ;
   engagement en points de base ; `age_bands.min_age >= 18` (D15) ; genres en tranches, jamais en
   pourcentage. Valeurs : D79 point (10), `07` RG114 et RG115, `04` §4.2.
5. Tests : aucun attendu affaibli ; l'horloge simulée ne remplace que des attentes ; ni `retries`, ni
   `waitForTimeout`, ni délai relevé ; planchers jamais baissés (`case-floors.ts`).
6. e2e : ajout du jalon ≤ 20 s ; cas neufs : un cas par page et par langue, largeurs en boucle dans le
   cas (`21` §2.3 l. 63-67).
7. `/health` de `apps/web` : 200 ou 503, corps vide, `no-store`, état par processus seulement.
8. Dépendances en version exacte (`savePrefix: ""`), `minimumReleaseAge` respecté ;
   `@supabase/supabase-js` et `@supabase/postgrest-js` toujours absents ; suite locale complète (D76).
9. Aucun nom ni pseudo dans un chemin des espaces connectés : le collecteur d'erreurs envoie
   `location.pathname` (`packages/web-platform/src/observability/error-collector.ts` l. 42).

## Lectures

| Ligne | Tranches |
|---|---|
| 01 | `18` §12.7 l. 1801-1891 ; `20` §11.1 à §11.8 l. 393-907 (par tranches) ; `archives/jalons/rk-fiche.md` l. 38-44, 205-210 |
| 02 | `20` §11.7 l. 824-851 ; captures de 01 (`test-results/logo-test/`) |
| 03 | `archives/jalons/pl/revue-constats.md` l. 27 ; `21` §2.4 l. 75-77 ; `pnpm-workspace.yaml` l. 7, 13 ; épingles nommées dans `03.md` |
| 04 | `archives/jalons/pl-fiche.md` l. 228-262 ; `apps/web/e2e/journey-resume.spec.ts` l. 24-48, 187-215 ; `e2e/support/journey.ts` l. 177-205 ; `src/components/auth/AuthFlow.tsx` l. 67 ; `CodeStep.tsx` (compte à rebours) |
| 05 | `revue-constats.md` l. 16, 29 ; `apps/web/src/server/status-cache.ts` (25 l.) ; `src/app/health/route.ts` l. 15-40 ; `tests/status-cache.test.ts` (46 l.) |
| 06 | `git show 40e1559` (menu) et `git show 5e49da1` (liens de marque) ; `components/landing/landing-sections.ts`, `SiteHeader.tsx` l. 25-70, `SiteHeaderMobileMenu.tsx`, `SiteFooter.tsx` ; `e2e/case-floors.ts` |
| 07 | `archives/21-journal-lot1-archive.md` l. 68 ; `error-collector.ts` l. 35-50 ; `apps/web/src/lib/member-paths.ts` l. 1-40 ; arborescences `apps/web/src/app/[locale]/` et `apps/backoffice/src/app/` ; `packages/test-kit/src/guards.ts` l. 239-360 |
| 08 | `06` l. 212, 275-279 ; `07` l. 271-326, RG33 et RG34 l. 424-433, RG37 l. 441-444 ; `08` pièces par réseau (`Grep "par réseau"`) ; `09` l. 366, RG84 l. 657-659 ; `10` l. 208-227 ; skill `matching-spec` |
| 09 | `04` §4.2 l. 469-566, §11.1 l. 6058-6074, l. 6119, §12.12 l. 6345-6360 ; `07` RG113 à RG117 l. 535-594 ; `08` Q10 l. 1264 ; `decisions-detail.md` D79 point (10) ; `supabase/migrations/0003_reference_core.sql` l. 1-50, 265-308 ; `packages/test-kit/src/rights/expected-rights.ts` l. 116-140, 890-905, 971-985 ; `apps/api/db-tests/t2-rls-matrix.test.ts` l. 270-300, 658-760 ; `t16-commission.test.ts` l. 55-160 ; `jalons/l2a/referentiels.md` |

## Commits

| # | Titre imposé | Contenu | Tests |
|---|---|---|---|
| 01 | `docs(mvp): charter traceability without orphan rule (RK-fin)` | `18` §12.7 : chaque phrase normative de `20` §11 a sa ligne, chaque preuve citée existe ; captures logo masqué pour 02, non commitées | contrôle scripté des identifiants |
| 02 | — (`ux`, sans commit) | Test du logo de `20` §11.7 par `expert-ux` (RK-fin) | — |
| 03 | `chore(deps): next 16.4 and zod 4.6.6 for the audited advisories` | PLS-1 ; **I-4** (`package.json` des fronts) | `pnpm audit --prod --audit-level high` ; suite complète |
| 04 | `test(e2e): simulated clock for the journey-resume abandon wait` | Levier de `21` §2.3 point 3 | `journey-resume` trois fois avant et après |
| 05 | `fix(web): /health cache window from the answer, never a 429` | PLS-3, PLT-6 | 3 cas unitaires au moins |
| 06 | `test(e2e): landing menu scrolling and brand links` | SNT-3 | 4 cas e2e au plus, ≤ 8 s |
| 07 | `test: no name or handle in a connected-space path` | J4S-7, garde avant les routes de profil de L2B | garde + cas négatif |
| 08 | `docs(mvp): Lot 2 starting reference lists (L2A-08 arbitration)` | Arbitrage `expert-matching` : listes de départ absentes des spécifications | — |
| 09 | `feat(db): Lot 2 reference taxonomies (0201)` | `0201` ; **I-4** (`GRANT`, `REVOKE`, politiques) | T2, T16.4, T16.5, contraintes ; suite base complète |
| C | `docs(mvp): close the L2A milestone` | Clôture | `pnpm check` + `pnpm test:e2e` trois fois |

## Tests

Aucune famille nouvelle : les cas portent la règle qu'ils prouvent (`04` §4.2, D15, D79, RG114, RG115,
J4S-7, SNT-3, PLS-3, PLT-6).

- **03** : `pnpm audit --prod --audit-level high` exit 0 ; `pnpm check` puis `pnpm test:e2e` verts.
- **04** : cumul médian de `journey-resume` sur trois invocations avant et après ; gain environ 3 s, décision du fondateur ; le reste du levier de `21` §2.3 point 3 (≈ 7 à 10 s) est reporté : cherché aux jalons suivants (cas redondants, éclats CI) ;
  assertions identiques (diff limité aux attentes et à l'horloge).
- **05** : `tests/status-cache.test.ts` + 3 cas au moins (échéance au règlement, levée synchrone, 429
  jamais gardé), horloge injectée ; plancher web relevé.
- **06** : menu de la landing (fr, en ; 1 440 et 375 px ; pied de page) et liens de marque ; chaque cas
  vu rouge par mutation locale (R4) ; cumul médian des cas ajoutés ≤ 8 s ; plancher e2e relevé.
- **07** : garde test-kit appliquée aux deux fronts, cas négatif sur arbre témoin ; planchers relevés.
- **09** : T2.1 à T2.7 avec les quatorze tables ; T16.4 et T16.5 étendus à `price_bands` ; fichier
  db-tests neuf : âge 17 refusé, contraintes nettes, tranches contiguës, valeurs exactes ; plancher base
  relevé ; suite base complète.
- **Durée e2e du jalon** : ajout ≤ 20 s (06 seul en ajoute) ; gain de 04 : environ 3 s, décision du fondateur ; le reste du levier de `21` §2.3 point 3 (≈ 7 à 10 s) est reporté : cherché aux jalons suivants (cas redondants, éclats CI) ; bilan net dans `run.md`.

## Critère de fin

- [ ] `pnpm audit --prod --audit-level high` sans critique ni élevée (03). *Preuve : sortie, exit 0.*
- [ ] e2e allégé : `journey-resume` environ 3 s de moins, abandon seul (04, décision du fondateur ; reste du levier reporté) ; ajout du jalon ≤ 20 s (somme des
      médianes des cas ajoutés, trois passages de clôture) ; job « Browser journeys » sous 8 min.
      *Preuve : `run.md`, rapport JSON, run CI.*
- [ ] `0201` appliquée sur `staging`. *Preuve : job « Migrate staging » vert, comptes de lignes des
      quatorze tables lus (`runbooks/staging.md`).*
- [ ] T2 et T16 verts avec les quatorze tables ; suite base complète verte (09). *Preuve : sorties.*
- [ ] Reliquat L2A soldé : RK-fin (01, 02), PLS-1 (03), PLS-3 et PLT-6 (05), SNT-3 (06), J4S-7 (07)
      retirés de `21` §8 ; lignes déjà soldées par PL retirées avec leur sha (EC-L2A-1) ; DS-flaky
      relevé sur les trois passages ; RK-e2e mesuré. *Preuve : diff de `21` §8, `run.md`.*
- [ ] `pnpm check` puis `pnpm test:e2e` verts trois fois de suite sans rejeu ; CI verte sur le dernier
      commit. *Preuve : dernières lignes, numéro du run.*
- [ ] Revue `testeur` + `expert-cybersecurite` faite ; attestation `security-reviewed:` couvrant 03 et
      09 (D71). *Preuve : sha du commit d'attestation.*

## Écarts, décisions ouvertes, risques

- **EC-L2A-1** (préparation) : la clôture PL (`78d83b0`) annonce sept lignes retirées de `21` §8 et n'en
  retire aucune. Déjà soldées, vérifiées dans l'arbre le 2026-11-01 : J9S-6 et J9S-7 (`e9da967`,
  `status-cache.ts`), J9S-9, J9T-8, J9T-9 (`0d37fba`, `tm1-apollo-settings-parity`, `artifact-floors.ts`),
  J9T-5 (`92b6263`, `0dcc5ec`, `e2e/support/hydration.ts`), SNT-1 (`0dcc5ec`). Retirées à la clôture.
  J9S-7 est fait ; PLS-7 reste à L2C.
- **Décision absente** : listes de départ de `topics`, `networks`, `formats`, `sectors`, `usage_rights`
  et pays dont les régions sont chargées ; aucune spécification ne les donne → ligne 08 (arbitrage
  `expert-matching`, relu avec la grille `product-owner`, CLAUDE.md §7).
- **`price_bands` sans ligne** (choix prudent, D78) : le budget indicatif de la marque (`06` l. 278,
  obligatoire) en exigera à L2B ; lignes, devises et portée de D78 sur les budgets à trancher à la
  préparation de L2B (`expert-paiement-facturation`, fondateur). `07` Q7 (bornes nettes) reste ouverte,
  sans effet ici.
- `04` §4.2 omet `comment_bands` et les bornes de `publication_frequencies` (§12.12 points 3 et 4) :
  `0201` les crée ; `04` §4.2 mis à jour à la clôture (documentation groupée).
- Drizzle : aucune déclaration sans lecteur ; le premier dépôt qui lit un référentiel (L2B) l'ajoute.
- 03 : `sharp` < 0.35.5 et `source-map-js` < 1.2.2 (élevées, transitives de `next`, relevé du
  2026-11-01) : si la montée de `next` ne les corrige pas, `overrides` exacts et commentés (EC) ;
  `minimumReleaseAge: 1440` peut retarder la dernière version.
- 04 : le compte à rebours dépend d'une heure serveur (`page.clock` ne le gouverne pas) : laissé tel
  quel, 04 rescopé sur l'abandon (fondateur, 2026-11-01) ; arrêt si une assertion de l'abandon change.
- I-4 : 03 et 09 portent le marqueur à la revue, par attestation (D71).
- Risques : RK-e2e (marge) ; DS-flaky (`t14-backoffice-invitations-route`) relevé à chaque passage ;
  hors L2A : J9S-7 et PLS-7, PLK-1 (L2C) ; PLT-5, PLS-5, PLS-6 (L2F).

## Réponses du fondateur (2026-11-01)

1. Listes de départ des référentiels : fixées par `expert-matching` (ligne 08), validées par le
   fondateur à la relecture de la ligne.
2. `price_bands` sans ligne au L2A ; lignes et devises du budget marque tranchées à la préparation de
   L2B.
3. EC-L2A-1 : les sept lignes déjà soldées par PL sont retirées de `21` §8 à la clôture.

## Arbitrage L2A-08 (`expert-matching`, grille `product-owner`, 2026-11-01)

Codes, libellés FR / EN et bornes : `jalons/l2a/referentiels.md`, seule source de 09.
- `topics` 17, sans sous-thème (F1 sous k = 5 sinon, D38) ; ni `lifestyle` ni thématique d'opinion (A12).
- `networks` 10 (Instagram, TikTok, YouTube, Facebook, LinkedIn, X, Snapchat, Twitch, Pinterest,
  Threads), `supports_ownership_proof` vrai, constaté sur compte réel avant `production`.
- `formats` 24 préfixés par réseau, dont `youtube_integration` ; `ugc_video` et `ugc_photo` sans réseau.
- `sectors` 26, `is_sensitive` sur les sept de `09` RG84 seules ; politique, religion, tabac, armes,
  drogues absents par construction (amender RG84, `09` Q6).
- `usage_rights` = `09` RG38 ; tons et tranches (D79, RG114, RG115) codés ; `regions` : FR 13
  (métropole), GB 4, US 51, CA 13, AU 8, le reste à la demande ; `label_key` = `<table>.<code>`.
- Aucune exclusion par choix produit : listes versionnées ; six amendements pour la clôture.

## Revue

(rempli par `/jalon-run` : `L2AT-n`, `L2AS-n`, `L2AU-n` pour le test du logo)

### Test du logo (ligne 02, `expert-ux`, 2026-11-01)

Grille de `20` §11.7, sur les 10 captures de `apps/web/test-results/logo-test/` (logo masqué,
texte courant visible). Lecteur unique (`expert-ux`) : le test à **deux personnes extérieures** de
§11.7 « En revue » reste à faire à la recette ; ce qui suit en est la lecture préparatoire.

**Signature reconnue en premier, par capture**

| Capture | Reconnu en premier | Cause visible |
|---|---|---|
| accueil-marque-1440 | Aucune franchement (outil sombre générique) ; Spotify faible | Rail à gauche et cartes de 16 px neutres ; halo vert sous l'en-tête et barre verte de l'item actif. INFLUX seulement par le texte « Un commercial INFLUX vous met en relation » et un point de rôle de 8 px |
| accueil-marque-375 | Spotify, faible à moyen | Barre du bas à icône + libellé, trait vert sur l'item actif, pilule « English », halo ; aucune signature INFLUX hors du point de rôle |
| accueil-createur-1440 | Idem marque : aucune franchement ; Spotify faible | Mêmes causes ; seul le point rose distingue l'espace de la marque |
| accueil-createur-375 | Spotify, faible à moyen | Mêmes causes que marque-375 |
| accueil-backoffice-1440 | Aucune : outil interne générique | Le bandeau orange d'environnement domine ; aucune pilule verte, vert limité à l'item actif ; pas de signature INFLUX visible (la barre violette n'existe que dans la vue identifiée, absente de la capture) |
| accueil-backoffice-375 | Aucune | Écran « poste de travail » (F7) : texte et bouton neutre, aucun effet ; rien de Spotify ni d'INFLUX hors le texte du bandeau |
| connexion-1440 | **Spotify** | Seule pilule verte lumineuse (ombre) sur noir, halo vert derrière le titre ; rien d'autre ne signe INFLUX |
| connexion-375 | **Spotify** (plus net) | Même cause, la pilule pleine largeur est l'unique objet saillant de l'écran |
| mon-compte-1440 | Aucune ; Spotify faible | Liste de lignes à icône et chevron (écran de réglages), halo ; point de rôle rose seul signe INFLUX |
| mon-compte-375 | Spotify faible | Barre du bas, trait vert de l'item actif ; même point de rôle |

**Parades de §11.7, une à une**

| Parade | Résultat |
|---|---|
| Jamais de bouton vert rond à icône seule | Tenue sur 10/10 : le seul bouton vert est « Recevoir mon compte » (pilule à libellé, connexion) ; les autres boutons sont neutres, à libellé |
| Halo jamais sur une carte | Tenue sur 10/10 : le halo reste sous l'en-tête, aucune carte n'en porte. (L'ombre lumineuse de la pilule verte est celle de F6, hors cette parade.) |
| Surtitre jamais vert | Tenue : « ÉTAPE 1 SUR 3 » est gris (`connexion`) ; aucun autre surtitre |
| Vert rare (jamais en texte, montant ou état) | Tenue : vert limité à l'indicateur d'item actif et à la pilule principale |
| Commercial nommé et statuts datés au premier écran | Sans objet avant les Lots 4 et 5 (aucun commercial affecté, aucune mise en relation) ; non compté en défaut. À contrôler à la recette du Lot 4 |
| Provenance des montants (P3), barre violette de la vue identifiée | Sans objet : aucun montant ni vue identifiée dans ces écrans ; non compté |

**Constats**

- **L2AU-1 (moyen) : la connexion évoque Spotify en premier**, 1440 et 375. Cause : une seule pilule
  verte lumineuse + halo + noir, et aucune signature INFLUX sur l'écran (le logo masqué ne laisse
  rien qui dise « marketplace courtée »). Renforts **additifs** proposés, sans retirer d'effet ni de
  couleur : (a) une ligne d'assurance de médiation sous le titre, par exemple « Un commercial INFLUX
  vous accompagne jusqu'à la mise en relation » / « An INFLUX sales rep guides you through to the
  introduction » (P5 ; formulation à aligner avec `expert-marketing`, sans promesse de délai) ; (b) le
  point de rôle de la porte d'entrée reprise en pastille avec libellé (« Marque » / « Créateur »)
  au-dessus du titre, quand la porte est connue.
- **L2AU-2 (faible) : la paire de couleurs de rôle, signature de marque (§11.7), est quasi invisible**
  : point de 8 px à côté de « Espace marque / créateur » sur 6 captures. Renfort : pastille à
  libellé et point d'au moins 12 px en tête de la colonne (poste de travail) et de l'en-tête
  (téléphone), tokens de rôle existants, aucune nouvelle couleur.
- **L2AU-3 (moyen, accessibilité, hors test logo) : liens sans signe de lien.** « Politique de
  confidentialité (nouvel onglet) » (`connexion`, centré et en gras sur 375, il se lit comme un
  titre) et « Gérer mon compte » (carte des accueils) ne sont ni soulignés ni distincts du texte
  courant, alors que le lien « Voir les échecs à traiter » du backoffice est souligné. WCAG 1.4.1 :
  souligner, ou donner l'allure d'un bouton secondaire avec icône ; aligner à gauche sur 375.
- **L2AU-4 (faible, hors test logo) : doublons à 1440 sur les accueils.** « Connecté avec … » figure
  dans le pied du rail et dans la bannière bleue de la carte, et deux boutons de déconnexion
  coexistent (« Se déconnecter » du rail, « Me déconnecter » de la carte). Garder le rail, retirer
  carte et bannière quand l'accueil recevra son contenu (L2B) ; pas d'action avant.

**Verdict.** Un seul gabarit, la connexion, fait lire Spotify en premier ; les écrans connectés se
lisent comme un outil sombre générique, ni Spotify ni encore INFLUX : le risque est le manque de
signature plus que l'excès d'emprunt. Les renforts de L2AU-1 et L2AU-2 sont additifs ; **aucun ne
retire un effet ou une couleur gardés par le fondateur (F6) : pas d'arrêt `fondateur`**. Si le test
à deux personnes extérieures cite encore Spotify après ces renforts, la suite (alléger l'ombre
lumineuse ou le halo de la connexion) revient au fondateur.
