# Jalon L2D — Profil créateur : blocs 1 à 5 en trois couches, anonymisation prouvée

> **Source :** `jalons/lot2-plan.md` l. 28 (ligne L2D), l. 10, 12, 13 (préalables D61, D78, R-4), l. 55-57, 61-62 (risques) ; `21` §8 (L2CT-5, L2C-E2E, L2AT-5, L2C-HARNAIS) · **Préparé le** 2026-11-05 par Claude Code (`/jalon-prepare l2d`) · **Statut :** à valider · **Exécution :** `/jalon-run l2d`, table `jalons/l2d/run.md`.

## Objectif et périmètre

Un créateur retrouve un profil `draft` et un alias dès son inscription, remplit par enregistrement automatique les blocs 1 à 5 (présentation, ligne éditoriale, réseaux et trois métriques, audience, « Mon offre » sans tarif), voit sa complétude et l'étiquette de couche de chaque champ. La base sépare les trois objets (vitrine, révélable, jamais révélé) et dérive les tranches ; T1, TM11, TM12.6, T14, T16, T2 prouvent que rien d'identifiant n'atteint un annonceur.

**Ne change pas :** aucune soumission ni publication (`Publier` absent, L2G) ; aucune file ni fiche créateur au backoffice (L2G) ; portfolio (bloc 6), interrupteur (bloc 7), aperçu « ce qu'une marque voit » : L2G ; code en bio, captures, badges : L2E ; aucune route annonceur ne lit un créateur (Lot 3) ; aucun envoi vers Brevo ou Apollo hors du `lead.updated` existant du compte ; aucun montant, taux, net ni tarif.

## Invariants

1. **Aucun droit annonceur (P5, §11.3, EC-L2D-1).** Au Lot 2, `influx_advertiser` n'a **aucun** `GRANT` sur aucun objet créateur : `creator_identities` et ses satellites jamais ; `creator_social_accounts` à `0401` (`matching.introductions` n'existe pas) ; vitrine au Lot 3, avec les garde-fous C(10). Le `REVOKE` de l'objet identifiant n'est jamais annulé : en-tête « non réversible » et test nommé (T1-R).
2. **Les couches de `07` RG16 font foi** (`07` l. 254-326), ville en N (D79). Toute colonne de `creator_public_*` est une tranche, un code, une date, un booléen ou un texte modéré (`04` l. 1296). Aucune photo, aucun avatar, aucun âge ni genre du créateur (RG29, RG40, CA6, CA29).
3. **Alias et référence (RG23, I-2, TM12.6).** Alias aléatoire, stable, sans dérivation du compte ni du pseudo ; `public_ref` UUID aléatoire distinct de `account_id` ; ni le créateur ni un agent ne les écrivent.
4. **Tranches (RG22, RG45, RG114 à RG116).** Calculées et stockées par le système depuis la valeur exacte, jamais écrites par le créateur (colonne sans droit) ; mêmes bornes que `reference.*`. Engagement : `engagement_band` reste nul au L2D (RG48) ; commentaires servis même déclarés (RG117).
5. **Date des chiffres (RG50, RG116, CA18, EC-L2D-6).** Jamais saisie ; renouvelée par une seule action « Confirmer mes chiffres » portant les trois métriques (une valeur nulle = non déclarée) ; modifier un chiffre seul ne la rajeunit pas (`creatorProfile.figures.confirmAll`).
6. **Historique (RG119).** Chaque saisie et confirmation des trois métriques écrit une ligne en ajout seul, couche N, jamais servie au créateur ni à une marque au L2D.
7. **Publication impossible.** Aucun rôle membre n'écrit `status`, `published_at`, `alias`, `public_ref`, une tranche ni `figures_source` ; `status` reste `draft` sur tout le jalon.
8. **D78, D48, T16.** Ni tarif, ni taux, ni net, ni devise dans une table créée au L2D, un contrat, une clé de traduction ou le DOM ; `creator_rate_cards` et `creator_public_rates` **non créées** (EC-L2D-2) ; `creatorProfile.rate.*` non ajoutées ; aucune opération arithmétique sur un identifiant de taux ou de pourcentage hors comparaison (T16.1).
9. **Droits des personnes (`04` §9.2 l. 5816-5830).** Toute donnée créateur entre dans `privacy.export_document()` et `privacy.execute_request()` dans ce jalon ; à l'effacement : identité vidée, handle, URL et pseudonyme effacés, textes modérés vidés, audience exacte et historique supprimés (Q18), profil retiré de toute lecture future.
10. **IDOR (T14).** Compte toujours celui de la session ; ligne de réseau d'autrui, annonceur ou créateur sur une route de l'autre rôle : même code, même corps qu'une adresse inconnue. Aucune route membre ne sert un champ interne d'un autre compte.
11. **Validation partagée (RG14).** Les règles de `packages/domain` et les schémas de `packages/contracts` servent navigateur et serveur ; la base arbitre listes, plafonds et sommes (`21` §2.1) ; aucune logique métier dans un composant.
12. **Détection (RG27, RG28).** Au L2D, avertissement non bloquant en réponse à l'autosave ; **rien n'est stocké** (type et position seuls, au L2G avec la file 2) ; un texte détecté n'est jamais journalisé.
13. **Journaux (D60).** Handle, URL, pseudonyme, identité et chiffres exacts absents de pino, `ops.*`, du registre ; aucune donnée créateur dans une charge `outbox`.
14. **Écran.** Tokens seuls ; charte KEO ; étiquette de couche icône + texte sur chaque champ, libellés imposés (`17` l. 1354-1358), jamais les codes A, I, N ; FR et EN sans résidu ; WCAG AA, vert jamais seul porteur ; aucun stockage navigateur ; le libellé d'audience porte sur l'audience (RG55, CA28).
15. **Honnêteté du message (RG88 à RG91, EC-L2D-5).** Tant que portfolio et badge n'existent pas, l'écran dit « À compléter : … » pour les blocs 1 à 5 et **ne parle pas de publication** ; le score ne compte que ce que le créateur a saisi (plafond 90 au L2D, annoncé nulle part comme un objectif).
16. **R-4 (D79).** « identité masquée » / *identity hidden* dans la landing, les e-mails et les écrans neufs ; « anonymisé » reste le vocabulaire des spécifications et du code.
17. **Tests.** Aucun attendu affaibli, planchers jamais baissés ; e2e ajouté ≤ 20 s, un cas par page et par langue, largeurs en boucle ; suite base complète pour chaque migration (D76) ; chaque migration porte ses lignes de `expected-rights.ts` (T2) et son marqueur I-4 à la revue.

## Lectures

| Ligne | Tranches |
|---|---|
| 01 | `21` §2.3 l. 60-67 ; `archives/jalons/l2c/e2e.md` ; `archives/jalons/l2c/revue-constats-testeur.md` (L2CT-5) ; `.github/workflows/ci.yml` l. 245-300 |
| 02 | Cette fiche ; `07` l. 241-345 ; `04` l. 1249-1374, 5278-5324, 5816-5830, 6074-6087, 6133-6149, 6184, 6376-6384 ; `03` l. 233-290, 758-790, 896-913 ; `archives/jalons/l2c/file.md` (forme) ; `0109` l. 351-353 ; `0134` l. 253-310 ; `0132` l. 337 ; `0209` l. 560 |
| 03 | `l2d/modele.md` ; `04` l. 1249-1297 ; `18` l. 1028 ; `0201` l. 1-40 (en-tête) ; `0106` l. 34-90 ; `expected-rights.ts` l. 596-680, 1636-1650 |
| 04 | `l2d/modele.md` ; `04` l. 1299-1374, 6184 ; `03` l. 758-790 ; `04` §6.2 l. 5308-5324 |
| 05 | `l2d/modele.md` ; `07` l. 478-505, 552-608, 620-632 ; `04` l. 6376-6384, 490-491 ; `0201` l. 143-160, 234-275, 476-530 |
| 06 | `l2d/modele.md` ; `04` l. 5816-5830 ; `0207` l. 811-, 1123- ; `privacy-*` de `db-tests/` |
| 07 | `07` l. 386-398, 471-505, 552-577, 620-623, 799-830 ; `packages/domain/src/brand-profile/*` ; `18` l. 768-787 |
| 08, 09 | `apps/api/src/domains/profiles/routes.ts`, `brand-profile.ts`, `repository.ts` ; `packages/contracts/src/brand-profile.ts` ; `db-tests/profiles-brand-route.test.ts` ; `18` l. 731-741 ; `07` l. 1004-1030, 1036-1037, 1060-1066, 1106-1114 ; `domains/ops/scrub.ts` l. 121-145 |
| 10 | `18` l. 286-329 ; `lot2-plan.md` l. 55-57 ; `apps/api/src/server.ts` l. 295-325 ; `tests/response-filter.test.ts` |
| 11 | `18` l. 759-792, 1010-1017 ; `packages/test-kit/tests/t16-static.test.ts`, `guards.test.ts` |
| 12 à 14 | `17` l. 1281-1384, 1462-1467 ; `07` l. 972-994 ; `components/brand-profile/*` ; `components/member/ui/LayerBadge.tsx` ; `lib/member-paths.ts` l. 35-36, 55-64 ; `e2e/brand-profile.spec.ts` ; `20` §11 par tranches ; skill `design-system-influx` |
| 15 | `17` l. 230, 263-275, 1231-1279 ; `components/auth/MemberHome.tsx` ; `components/brand-profile/BrandHome.tsx`, `AccountStateBlock.tsx` ; `lib/member-nav.ts` l. 29-35 |
| 17 | `decisions-detail.md` D79 (1) ; `locales/{fr,en}/landing.json` l. 62, 200-201 ; `apps/api/src/locales/{fr,en}/email.json` l. 291, 302 |

## Commits

| # | Titre imposé | Contenu | Tests |
|---|---|---|---|
| 01 | `ci(e2e): browser journeys shards rebalanced` | L2CT-5 et L2C-E2E, éclats mesurés avant les écrans neufs | `--list`, CI verte |
| 02 | *(arbitrage, sans commit de code)* | `l2d/modele.md` : noms, clés, droits, propriétaires ; D82 si structurant | — |
| 03 | `feat(db): creator public profile with its satellites and opaque identifiers` | `0216` : vitrine, satellites, alias, `public_ref`, création à l'inscription, reprise des comptes, RLS (I-4) | TM12.6, T2, L2D-D1 à D3 |
| 04 | `feat(db): creator identity objects, never granted to the advertiser role` | `0217` : `creator_identities`, `creator_social_accounts`, audience exacte, secteurs refusés, historique (I-4, non réversible) | T1-R, T2, L2D-D4 à D6 |
| 05 | `feat(db): bands derived from exact figures and metric history` | `0218` : dérivations, somme ≤ 100, confirmation, historique, pays recopié (I-4) | L2D-D7 à D13 |
| 06 | `feat(db): creator data in the export and the erasure` | `0219` : `export_document`, `execute_request` (I-4) | L2D-D14, D15, `privacy` |
| 07 | `feat(domain): creator profile rules` | `packages/domain/src/creator-profile/` : obligatoires, complétude, URL par réseau, pourcentage en points de base, détection partagée | Unitaires L2D-U1 à U6, T16 |
| 08 | `feat(api): creator profile read and autosave` | Contrats, `GET`/`PATCH /v1/me/creator-profile` : blocs 1, 2, 5, complétude | T14, CA2, L2D-A1 à A5 |
| 09 | `feat(api): creator network lines, figures and audience` | Lignes de réseau, confirmation, audience | T14.1, T14.2, CA10 à CA12, CA18, CA26, CA27 |
| 10 | `test(api): anonymisation sweep over the router inventory` | Inventaire dérivé du routeur, T1.1, T1.2, T1.3 adapté, T1.4, T1.6 avant, témoin | T1, T1-W |
| 11 | `test(contracts): identifying fields and prices refused in member contracts` | TM11.1, TM11.2, absence de prix (contrats, clés, DOM) | TM11, T16-L2D |
| 12 | `feat(web): creator profile, presentation and editorial blocks` | C2 sur `compte/profil` par rôle, sommaire, blocs 1 et 2, spec e2e (≤ 6 s) | Unitaires, e2e |
| 13 | `feat(web): creator networks block` | Bloc 3, métriques en tête, confirmation (≤ 5 s) | Unitaires, e2e |
| 14 | `feat(web): creator audience and offer blocks` | Bloc 4, C4 « Mon offre » (≤ 5 s) | Unitaires, e2e |
| 15 | `feat(web): creator home and rail lead to the profile` | Carte de C1, bloc d'état (≤ 2 s) | e2e `member-shell` |
| U | *(constats `expert-ux`, sans commit)* | Écrans 375, 768, 1440, FR, EN | `ux-constats.md` |
| 17 | `feat(web): identity hidden wording in the landing and e-mails` | R-4, FR et EN | Textes, connecteur, `landing-*` |
| F | *(recette du fondateur)* | Blocs 1 à 5 sur `staging` | `recette.md` |

Numéro 16 réservé à un `fix` issu de U ; sinon `ignoré`.

## Tests

| Identifiant | Niveau | Ce qu'il prouve | Plancher |
|---|---|---|---|
| **T1.1, T1.2, T1.4** | Base + routeur (`db-tests/t1-anonymisation.test.ts`) | Aucun marqueur dans corps, en-têtes ou erreur (400, 404, 500 provoquée) de toute route `/v1/` appelée comme annonceur ; inventaire dérivé du hook `onRoute` | 100 % des routes inventoriées, ≥ 1 route ajoutée au L2D vue |
| **T1.3 adapté** | Idem | Les marqueurs sortent de la lecture du créateur lui-même (les routes marchent, la base en porte) | 7 marqueurs (sans fichier d'origine : L2G) |
| **T1.5, T1.3, T1.6 après** | — | **Reportés** : L2G (T1.5, vue de l'agent), Lot 4 (révélation), EC-L2D-3 | — |
| **T1.6 avant** | Idem | Aucune coordonnée d'une marque pour un créateur, aucune donnée d'un autre créateur | 2 sens |
| **T1-W** | Idem | Témoin : une route de test qui fuit fait échouer le balayage | 1 |
| **T1-R** | Base | `influx_advertiser` : `has_table_privilege` faux et `SELECT` 42501 sur chaque objet créateur | Tous les objets, garde par nom `creator_%` |
| **TM11.1, TM11.2** | Statique + routeur | Aucun schéma sauf le module créateur ne déclare un champ de `creator_identities` ou `creator_social_accounts` ; liste dérivée de Drizzle | Tous les contrats |
| **TM12.6** | Base | 1 000 générations : unicité, alphabet, longueur, aucun ordre ni lien avec le compte | 1 000 |
| **T14** | Base + routeur | Annonceur sur les routes créateur, créateur sur la ligne d'autrui : code et corps identiques à l'inconnu | Chaque route neuve |
| **T16-L2D** | Statique + base | T16.1, T16.2 sur le code neuf ; tables de tarif absentes ; aucune clé `rate`, `net`, `price`, `currency` dans les contrats et traductions du créateur | 4 contrôles |
| **T2** | Base | Lignes neuves de `expected-rights.ts` | Une par objet et par rôle |
| **L2D-D1 à D15** | Base | D1 : création à l'inscription ; D2 : reprise d'un compte existant ; D3 : alias et statut non écrits ; D4 : `handle` unique par réseau (RG42) ; D5 : une seule ligne principale ; D6 : pas de ville ni d'identité hors N ; D7 : tranche d'abonnés depuis l'exact ; D8 : rythme et commentaires ; D9 : confirmation et date (RG116) ; D10 : somme ≤ 100, 60 accepté ; D11 : historique en ajout seul ; D12 : pays recopié, y compris par `correct_member_account` ; D13 : changement de ligne principale redérive la vitrine ; D14 : export ; D15 : effacement | 15 |
| **L2D-U1 à U6** | Unitaire | Complétude (somme 100, plafond 90, aucun tarif), obligatoires, URL par réseau (CA12), pourcentage à 2 décimales sans calcul, bornes 20-120 et 150-800, détection | Chaque RG citée |
| **L2D-A1 à A5** | Base + routeur | Lecture, autosave partiel, listes fermées refusées, plafonds, avertissement `identifierInText` sans stockage | 5 |
| **e2e** | Navigateur | Un cas FR, un cas EN (blocs 1 à 5), largeurs 375 et 1440 en boucle, carte de C1 | ≤ 18 s |

`creator-profile.spec.ts` entre dans `e2e/case-floors.ts`. Le cas « un créateur trouve 404 sur `/compte/profil` » s'inverse par conception (L2B invariant 12, `member-paths.ts` l. 55-58) : le commit 12 le dit dans son message ; 404 reste vrai pour une route API marque.

## Critère de fin

- [ ] T1 et TM11 verts trois fois de suite (`18` §1.3) : trois sorties notées dans `run.md`.
- [ ] TM12.6, T14, T16, T2 verts ; **toute** la suite base verte : sorties.
- [ ] Ni tarif, ni net, ni taux saisi ou affiché : T16-L2D et lecture du DOM dans la spec e2e.
- [ ] Blocs 1 à 5 enregistrés sur `staging` : ligne F de `run.md`.
- [ ] Vocabulaire R-4 remplacé : `Grep -i anonym` sur `locales/`, seuls restent les emplois légitimes listés en § Écarts.
- [ ] e2e ajouté ≤ 20 s (`sum-e2e-durations.ts`, trois passages) ; chaque éclat sous 7 min 30 en CI : ids de run.
- [ ] `pnpm check` et `pnpm test:e2e` verts : sorties ; CI verte : id de run.
- [ ] Revue soldée, attestation `security-reviewed:` : sha.

## Écarts, décisions ouvertes, risques

Choix prudents, à signer par `architecte` en ligne 02 ou par le fondateur à la validation :

- **EC-L2D-1 : aucun droit annonceur sur la vitrine au Lot 2** (contre `03` l. 240, `04` l. 5298). Aucune route ne la lit ; le droit de colonnes et la forme de la lecture (sans `account_id`, `completeness_percent`, `status`) viennent au Lot 3 avec C(10).
- **EC-L2D-2 : `creator_rate_cards` et `creator_public_rates` non créées** (`04` l. 1281, 1363 ; D78). Rien à fuir, rien à garder vide ; ajout additif si le pilote annonce un jour des tarifs. **`creator_formats` remplacée par `creator_offer_lines(account_id, network_code, format_code)`** : RG64 tient sans tarif, format lié au réseau ou sans réseau (UGC, `0201` l. 436-437).
- **EC-L2D-3 : contre-test T1.3 sur la lecture du créateur**, pas sur la vue de l'agent (`lot2-plan.md` l. 57) : la fiche interne n'existe qu'au L2G. L2G rejoue T1 (T1.5) et ajoute la vue de l'agent ; Lot 4 ajoute le « après ».
- **EC-L2D-4 : RG87 sans tarif.** Les 11 points « 1re ligne de tarif 8 · 2e ligne 3 » vont aux **lignes d'offre** (même poids, total 100). Le rythme et les commentaires restent dans la « ligne complète » du score, sans être obligatoires pour publier (Q15).
- **EC-L2D-5 : pas de `creatorProfile.publish.missing` ni de bouton au L2D** : la phrase serait fausse sans portfolio ni badge (RG91). Nouvelle clé `creatorProfile.blocks.missing` ; L2G la remplace.
- **EC-L2D-6 : RG116 lue avec Q15.** RG116 date d'avant l'amendement : « confirmées » = les trois valeurs présentes dans la même opération, nulle admise si la métrique n'est pas déclarée. Obligatoire au L2G : date non nulle sur le compte principal.
- **EC-L2D-7 : `date_of_birth`, `company_name`, `company_registration_number` non créées** (D79 (4), RG15). L2E ajoute la date si le doute à la vérification l'exige.
- **EC-L2D-8 : chiffre d'engagement en points de base** (`engagement_rate_bp integer` 0-10000, contre `numeric(6,4)` de `04` l. 1309) : mêmes unités que `reference.engagement_bands`, et conversion de la saisie par la chaîne, sans `/ 100` (T16.1).
- **EC-L2D-9 : audience saisie par ligne de réseau** (RG57), `main_audience_*` de la vitrine dérivés de la ligne principale. L'obligatoire de RG56 porte sur le compte principal.

À trancher en ligne 02 (`architecte`), avec recommandation dans `modele.md` :

1. Clé de `creator_public_networks` : `04` l. 1279 (`account_id, network_code`) contredit RG42 (deux comptes sur un réseau). Recommandation : `social_account_id` clé, jamais servi.
2. Colonnes manquantes à `04` : `bio`, `pseudonym`, `posts_last_30_days`, `avg_comments_per_post`, `comment_band`, `public_ref` ; `headline` borné à 120 (`04` l. 1255 : 280 ; RG25) ; `primary_topic_code`, `handle` nullables (brouillon, effacement) ; `publication_frequency_code`, `comment_band` nullables (Q15, contre `04` l. 6378-6379).
3. Propriétaire des dérivations : `influx_identity_definer` (signé L2C, `03` l. 896) ou un nouveau rôle ; recommandation : le premier.
4. Forme publique de la répartition par âge (RG58 ne la dit pas) : mêmes tranches que les autres pays (10-25 · 25-50 · > 50), à confirmer avec `expert-matching`.
5. URL par réseau : table `reference` (la base arbitre) ou constante de `packages/domain` ; liste des domaines des dix réseaux (`07` l. 289 : fixée à L2D).
6. Effet de `identity.change_member_role()` (`0134` l. 253) sur un profil créateur : conservé, invisible, jamais servi à l'annonceur ; recommandation : refus si le profil n'est pas `draft` au L2G.
7. Sort de la vitrine à l'effacement : ligne gardée (alias, tranches pseudonymes), `status` `suspended`, textes vidés.
8. Répartition de genre (RG61) : sa saisie reste en pourcentages (`07` l. 309), `creator_public_audience` en tranche.

**Écarts de spécification à corriger à la clôture** (`07`, `04`, `03`, code d'abord) : RG76 dernière phrase et RG87 (D78), cas limite l. 1010 et CA68 (Q15), `04` §5.2 et §12.12 (points 1, 2 ci-dessus), `04` §11.2 (numéros réels), CA24 (« plus de 70 % » n'est pas dérivable de la tranche 50-80 : Lot 3).

**Hors L2D, inscrits en `21` §8 à la clôture :** L2AT-5 (`price_bands` non chargée sous D78 : passe à « au chargement ») ; L2C-HARNAIS (décision à prendre ; recommandation : « plus tard », une seule suite base à la fois) ; vocabulaire des CGU (`apps/api/legal/`, « de façon anonyme », `draft-3.md` l. 32 : « pseudonymisé » selon D79, version nouvelle relue par le juriste, avant production).

**Emplois légitimes de « anonym » restant :** `email.json` l. 118 et `data-export.json` l. 12 (effacement d'un compte), commentaires de code.

**Risques.** e2e : L2C a pris 31 à 40 s pour 20 prévus ; une spec, deux cas, durée notée à chaque commit, arrêt à 20 s. Volume : **15 commits contre 10 estimés** au plan, le découpage de la base pèse le plus. D61 : `17` et `07` mentionnent parfois les trois métriques comme obligatoires, Q15 fait foi. Autres sessions : `git add` des seuls fichiers du commit.

## Revue

2026-11-06, `547cecf^..7e0acc3` (21 commits, `fe380b6` d'une autre session compris) : **aucun bloquant**. `testeur` : 4 dans le jalon, 2 avant production, 4 plus tard ; `expert-cybersecurite` : rien dans le jalon, 1 avant production, 6 plus tard, `0215` relue (L2C-fix2 soldée), signatures `03` P7 et attestation prêtes. Détail : `l2d/revue-constats-testeur.md`, `l2d/revue-constats-securite.md` ; échéances : `l2d/cloture.md` § Reliquat.

| Id | Gravité | Fichier:ligne | Correctif → sort |
|---|---|---|---|
| L2DT-1 | dans le jalon | `e2e/brand-profile.spec.ts:169-170` | Instable (run 42243018278) : `expect.poll` sur l'état stocké avant `reload` → `fix-2` |
| L2DT-2 | dans le jalon | `ci.yml:295-298` | Éclats à 701-803 s, dont 464-524 s de `playwright install --with-deps` : navigateur en cache sur `main`, `--with-deps` selon la mesure → `fix-1` (I-4) |
| L2DT-3 | dans le jalon | `run.md` ; `recette.md:15` | `fe380b6` sans ligne, F-1 « à revoir » → ligne `fix-F1` et F-1 clos, écrits avec la revue |
| L2DT-4 | dans le jalon | `l2d/10.md` (EC-L2D-10-1) | Corps refusé : 400 avant la session, non 404 → `18` T14.3 amendé en clôture, sans code |
| L2DT-5 | avant production | `db-tests/t1-anonymisation.test.ts:585-600, 624-636` | Ville, publications, commentaires, parts exactes en marqueurs distinctifs → `21` §8 |
| L2DT-6 | avant production | `t1-anonymisation.test.ts:744-757` | Balayage du routeur sans session → `21` §8 |
| L2DT-7 | plus tard | `member/ui/LayerBadge.tsx:231` | Ordre de tabulation à `expert-ux`, dépassement en fonction pure testée → `21` §8 |
| L2DT-8 | plus tard | `tests/tm11-identifying-fields.test.ts:299-312` | Exemption prouvée par le nom des cas T14, non par la chaîne `T14.3` → `21` §8 |
| L2DT-9 | plus tard | `profiles-creator-*.test.ts` ; `use-creator-profile.ts:215-234` | Concurrence (`Promise.all` par invariant), crochet « un à la fois » → `21` §8 |
| L2DT-10 | plus tard | `profiles-creator-bands.test.ts:293-301` | Bornes 499 999 et 999 999 (abonnés, portée) → `21` §8 |
| L2DS-1 | avant production (avant tout `profile_url` cliquable : L2E, Lot 4) | `creator-profile/network-line.ts:57,75` ; `0217:205,269,277` | `https://evil.example\.instagram.com` accepté : autorité `^[A-Za-z0-9.-]+(:[0-9]{1,5})?$` au domaine et en base, témoins `\` et `%5C` → `21` §8 |
| L2DS-2 | plus tard (L2E) | `0217:516-518` ; `0218:530, 689-698` | Métrique écrite par le créateur : `figures_source = 'declared'` forcé → `21` §8 |
| L2DS-3 | plus tard (avant Lot 3) | `profiles-creator-identity.test.ts:197-221` ; `0217:600-629` | T1-R par dépendances, tous schémas → `21` §8 |
| L2DS-4 | plus tard (L2G) | `0216:318-322` ; `creator/profile.ts:49-53` | Vitrine modérée comme L2C, complétude recalculée à la soumission → `21` §8 |
| L2DS-5 | plus tard (avant Lot 3) | `0218:271-376` ; `03` l. 896 | Aucun `execute` dynamique chez `influx_identity_definer` → `21` §8 |
| L2DS-6 | plus tard | `0218:509-528, 730-733, 356-362` | Reprise de `0218` §8 à tout changement de bornes ; rôle figé hors `draft` (L2G) → `21` §8 |
| L2DS-7 | plus tard (Lot 6) | `0218:825-831` ; `creator/routes.ts:149-165` | Limite de débit des écritures membres → `21` §8 |

Hors table : `member-shell.spec.ts:193` assoupli (`toBeCloseTo(0, 0)`, EC-L2D-15-1), accepté par `testeur`, dit en clôture (invariant 17).
