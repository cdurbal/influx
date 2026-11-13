# Revue de fin du jalon L2G : constats `testeur`

**Plage** `696f625..HEAD` (`f245d7c` à `6f1aeed`, 23 commits de jalon, migrations `0242` à `0245`). **Revue du 2026-11-12**, sur HEAD `6f1aeed`, arbre propre (seul fichier non suivi à mon arrivée : `revue-constats-securite.md`, d'une autre revue). **Lancé en local** parce que la CI GitHub est bloquée par la facturation (aucun run depuis `de69db7`, dernier vert `5243ef6`, dépassement accepté par le fondateur) ; aucun fichier modifié hors ce livrable, rien commité, rien poussé. Une seule action sur la base locale hors tests : la reproduction de L2GT-2, annulée ensuite (vérifiée).

## Récapitulatif

| Gravité | Nombre | Constats |
|---|---|---|
| Bloquant | 0 | |
| À corriger dans le jalon | 3 | L2GT-1, L2GT-2, L2GT-3 |
| Avant production | 6 | L2GT-4 à L2GT-9 |
| Plus tard | 6 | L2GT-10 à L2GT-15 |

**Verdict « prêt à livrer » sur `main` (D71) : oui, sous réserve de L2GT-1 à L2GT-3.** Aucun test rouge, aucun attendu affaibli, aucun plancher baissé. Les trois points du jalon sont : le job base qui dépasse le plafond que le fondateur a lui-même fixé (L2GT-1), une bombe à retardement de la base locale qui rougira `pnpm check` demain matin (L2GT-2), et trois cases de clôture (`18` §10, critère de fin) dont la preuve n'existe pas ou est partielle (L2GT-3). Pour `production` : L2GT-4 à L2GT-9 se traitent ou s'acceptent par écrit.

## Ce que j'ai lancé, mesures

| Suite | Résultat | Durée |
|---|---|---|
| Base, passage 1 / 2 / 3 (`pnpm --filter @influx/api test:db`) | **105 fichiers, 3 036 cas, verts ×3** ; planchers « met » | 478,7 / 478,1 / 472,4 s de vitest ; 481 / 480 / 474 s murales |
| Base, passage 4 (dans `pnpm check`) | vert | 476,4 s |
| `pnpm check` (format, types, lint, tests, build, artefacts) | **vert**, exit 0 ; contracts 190, domain 148, test-kit 251, web 651, backoffice 364, api sans base 1 853, artefacts web 52 ; une seule alerte : « floor may be raised » (L2GT-11) | 660 s |
| e2e des six specs du jalon, 1 travailleur, ×3 | **verts ×3** | 57 à 61 s murales |
| `pnpm test:e2e` entier, 2 travailleurs | **260 passés**, 0 échec, 0 instable (le « failed » du JSON est le témoin attendu `global-net.spec.ts:68`), plancher e2e « met » | 276 s ; somme des durées de cas 477,5 s (indicative, F0) |

**e2e des lignes du jalon, médiane de trois passages** (valeur annoncée dans la fiche) : ligne 13 `creator-portfolio.spec.ts:43` **6,0 s** (5,8 à 6,8 ; ≤ 6 : à la limite, un passage à 6,8) ; ligne 14 `creator-preview.spec.ts:38` **1,8 s** (1,7 à 1,9 ; ≤ 2) ; ligne 15 `creator-queue.spec.ts:38` **3,7 s** (≤ 5) ; ligne 16 `portfolio-queue.spec.ts:32` **2,8 s** (≤ 4) ; ligne 17 `account-creator.spec.ts:22` **1,5 s** (1,4 à 2,0 ; ≤ 2). **Somme des médianes 15,8 s pour 19 s annoncés.** Les 2,4 s (ligne 14) et 4,2 à 5 s (ligne 15) relevés en cours de jalon ne se reproduisent pas sur une machine au repos : c'est du bruit de charge, pas un dépassement ; les mesures de `run.md` (mesurées pendant d'autres suites) sont à remplacer par celles-ci à la clôture. **Éclats CI : non mesurables** (pas de CI) ; le seul signal est la suite entière à 4,5 min sur 2 travailleurs. `de69db7` pèse 9 lignes d'e2e : ligne 14 mesurée après lui.

**DS-flaky :** `backoffice-queue.spec.ts:82` (2,1 s) et `:422` (2,8 s) passés dans le passage entier ; une seule observation (pas de ×3 de la suite entière). Le registre de `21` §8 cite `:418` pour L2E et `:422` pour L2F : la ligne a dérivé, à harmoniser à la clôture.

## Contrôles demandés par `revue.md`, résultats

- **Fiche § Tests : chaque identifiant existe, au plancher, vert ×3.** TM5.5 (`profiles-creator-decisions.test.ts:393-477`, base ; `profiles-creator-preview-route.test.ts:344-400`, projection), T9.5 (`images.test.ts:413`, fixtures avec témoins de géolocalisation l. 127 ; octets relus dans `profiles-portfolio-route.test.ts:325-351, 442-449`), T9.10 (`profiles-portfolio.test.ts:296-435`, avec deux mutations vues rouges l. 372-406), T1 (T1.5) (`t1-anonymisation.test.ts:1361-1510` : trois textes, octets d'un visuel `pending`, clés d'objet, aucune URL, C-1 et C-2 ; plancher 11 → 15), L2G-D1 à D13 (tous nommés dans les fichiers de base), L2G-U1 et U3 nommés, **U2 existe sans nom (L2GT-15)**, T9.6 (six tables nommées, `t9-evidence-unreachable.test.ts:116-121`, mutation `SELECT` accordé l. 1282), TM11, T14 (`t14-creator-queue-route.test.ts`, 28 cas, inventaire des routes), T2, T16 (`t16-commission.test.ts`, inchangé, vert). Tous verts aux quatre passages.
- **Aucun attendu affaibli : tenu.** `git diff` des lignes retirées dans les tests existants, relues une à une : `profiles-creator-route.test.ts` (92 → 100 points atteignables, deux manquants ajoutés, `isSearchable` devenu écrivable par le créateur : un cas positif remplace le refus, `profiles-creator-public.test.ts:392-413` ; « gelé hors brouillon » ne boucle plus que sur `suspended`, le régime de `published` est testé dans `profiles-creator-submission-route.test.ts`), `creator-profile-view.test.ts` (l'interdit `portfolio|publish|visibility` retiré, l'interdit tarifaire D78 gardé), `profiles-creator-privacy.test.ts` (`read_tables` 15 → 17, justifié par `0245`), `creator-profile-completeness.test.ts` (plafond 92 retiré : 100 atteignable, testé l. 152), `guards.ts` (empreinte de `relay.ts`, geste conscient pour le passe-plat 8 Mio). Chaque modification est une conséquence de la règle neuve, jamais un retrait de preuve.
- **Aucun plancher baissé : tenu.** Diff des sept `case-floors.ts` : chaque ligne retirée est remplacée par une valeur supérieure ; chaque fichier neuf a son plancher dans le commit qui le crée (vérifié commit par commit sur les 25 fichiers neufs). **Une exception inverse : un plancher non relevé (L2GT-11).**
- **TM5.5 contre `18` l. 950 :** tenu au niveau base (profil `published` par la seule décision d'un agent ou d'un administrateur ; créateur, annonceur, agent, admin refusés 42501 ; l'annonceur ne lit aucun visuel, `pending` ni `approved`, aucun droit sur les portes) et au niveau projection (aucun visuel non approuvé dans l'aperçu, l'ancien approuvé servi pendant un remplacement, CA47, CA44). **Non couvert : la même exigence sur le texte (L2GT-4).**
- **T9.5 contre `18` l. 658 :** tenu, par les octets (en-tête RIFF, `VP8X` sans ICC, EXIF ni XMP, valeurs connues absentes, somme de contrôle recalculée sur l'objet relu du Storage), sur le dépôt et le remplacement, et au test unitaire d'images avec témoins de la présence de la donnée dans l'entrée.
- **T9.10 contre `18` l. 663 :** tenu pour les deux moitiés (`approved` sans `exif_stripped` refusé, `exif_stripped` retiré à un approuvé refusé ; objet changé : `pending`, décision vidée) ; une sous-assertion est creuse (L2GT-10).
- **T1 contre `18` l. 286-330 :** T1.1, T1.2, T1.4, T1.5, T1.6 tenus et rejoués sur l'inventaire dérivé du routeur (les huit routes neuves y sont contrôlées, l. 1362-1376). **T1.3 (contre-test après révélation) reste adapté** (le créateur lit ses propres textes) : voir L2GT-3 pour la case de `18` §10.
- **`18` §10 Lot 2 l. 1548-1560, case par case :** T1 « intégralement » : partiel, T1.3 et la partie « après » de T1.6 au Lot 4 (**L2GT-3**) ; T9.6 : preuve ; T9.5 : preuve ; TM12.6 : `profiles-creator-public.test.ts:537-560` ; I-10 : livré (`e2e/account-screens.spec.ts:50`, déjà noté au plan du Lot 2) ; R-4 et R-5 : D79, Lot 6, pas de preuve à attendre ici ; D40 et D46 : déjà cochés ; TM5 partiel : TM5.5 ajouté ; **revue visuelle de dix visuels : aucune preuve écrite (L2GT-3)**.
- **e2e : somme des médianes, éclats CI, DS-flaky :** voir les mesures ci-dessus.
- **`de69db7` non couvert par la CI :** il ne touche que `apps/web` (vue pure, écran, deux textes, un test unitaire, 9 lignes d'e2e). Couvert localement : `pnpm check` vert, spec `creator-preview` verte ×3 et dans la suite entière. Reste le risque d'un défaut propre à l'environnement CI (L2GT-9).
- **Points connus vérifiés :** `verification-revocation.test.ts` : **reproduit** (L2GT-2). EC-L2G-09-3 : **toujours ouvert**, figé tel quel par trois tests (L2GT-7). e2e 14 et 15 : voir ci-dessus, non reproduits.

## Constats

### L2GT-1 · À corriger dans le jalon · le job base dépasse le plafond de 8 min que le jalon devait tenir

- **Où :** `.github/workflows/ci.yml:181-185` (job « Database tests », cap 15 min, aucun contrôle du plafond de 8 min) ; `docs/mvp/archives/jalons/l2f/run.md` § Mesures de clôture (seuil d'alerte 480 s, « à rouvrir avant que L2G ne grossisse la suite », L2FT-11) ; `jalons/l2g/e2e.md` (F0 : « le job ≤ 8 min fait foi »).
- **Preuve :** dernier job CI mesuré : 494 s (436 s à la clôture de L2F : +58 s en un jalon). En local, ce jour : 478,7, 478,1, 472,4 et 476,4 s de vitest, soit 474 à 481 s murales, avant l'installation et le démarrage de la pile, que la CI ajoute (d'où 494). Marge locale : 0 à 8 s sur le plafond, 0 à 20 s au prochain jalon. Plus lents : `t1-anonymisation` 48,7 s, `t9-evidence-unreachable` 35,2 s, `t8-backoffice-sign-in` 33,2 s, `t2-rls-matrix` 20,3 s, `t8-request-code` 14,7 s ; la somme des fichiers (393,9 s) est séquentielle (une base partagée).
- **Correctif :** en une phrase, soit `integrateur` coupe le job base en deux éclats à pile propre (comme les trois éclats e2e, `t1`, `t9` et `t2` d'un côté, le reste de l'autre), soit le fondateur relève le plafond par écrit dans `21` §2.3 ; ne pas laisser L3 ouvrir à 480 s.

### L2GT-2 · À corriger dans le jalon · `verification-revocation.test.ts` rougit dès qu'une demande 2V a plus de 24 h dans la base locale (connu, reproduit)

- **Où :** `apps/api/db-tests/verification-revocation.test.ts:949-952` (`update backoffice.dual_control_requests set state = 'cancelled' … where action_code = 'verification.revoke_badge' and state = 'pending'`).
- **Preuve :** la mise à jour annule **toutes** les demandes `pending` de la table, pas celles de la transaction ; le déclencheur refuse d'annuler une demande expirée (« the dual control request has expired »). Reproduit : j'ai vieilli de 25 h les 33 demandes `revoke_badge` en attente (`pending`) de la base locale, relancé le fichier : `L2F-D9 … holds the reasons of textes.md` échoue à la ligne 949, 1 échec sur 7 ; j'ai ensuite rajeuni exactement les mêmes 33 lignes (0 demande de plus de 24 h, déclencheur rétabli, fichier vert : 7 sur 7). **Échéance : la plus ancienne demande `revoke_badge` en attente date de 2026-11-12 07:32 UTC (la plus ancienne ligne de la table : 07:25 UTC, sans doute la dernière remise à zéro) ; la suite base et `pnpm check` rougiront donc à partir de 2026-11-13 vers 07:32 UTC**, y compris pour la ligne C. La CI n'est pas touchée (base neuve à chaque run) : c'est ce qui l'a masqué. Les tests e2e et base qui commitent des demandes en attente (`t14-verification-badges-route`) l'alimentent à chaque passage.
- **Correctif :** limiter la mise à jour aux lignes de la transaction (`and requested_at >= pg_catalog.transaction_timestamp()`, comme la ligne 959 le fait pour le registre juste en dessous) ou à l'identifiant rendu par `ask()` ; et, en prévention, purger ou vieillir proprement dans `db-tests/global-setup` les demandes 2V de plus de 24 h.

### L2GT-3 · À corriger dans le jalon · trois cases de clôture n'ont pas leur preuve (ligne C)

- **Où :** `docs/mvp/jalons/l2g-fiche.md:93, 97` (critère de fin : « un créateur `published` sur `staging`, trois visuels modérés » ; « revue de dix visuels modérés par le fondateur ») ; `jalons/l2g/run.md:28` (ligne F : « staging non préparé par un agent ») ; `jalons/l2g/recette.md` (dix visuels synthétiques, dont deux à refuser, déposés sur `staging` par un agent) ; `18-plan-de-test-mvp.md:1552, 1559`.
- **Preuve :** la ligne F dit que la recette est validée (« je valide la recette », après la CI verte sur `5243ef6`) mais aussi que `staging` n'a pas été préparé : aucune trace de qui a vu quoi, où, ni de dix visuels modérés par un humain contre la grille RG79. La case « T1 passe intégralement » ne peut pas être cochée sans réserve : T1.3 et le « après » de T1.6 sont au Lot 4 (fiche § Risques).
- **Correctif :** à la ligne C, ne cocher ni « créateur `published` sur `staging` » ni « dix visuels » sans une phrase datée du fondateur disant ce qu'il a revu (où, combien, quelles décisions) ; sinon les reporter au Lot 6 avec échéance dans `18` §10 et `21` §8 ; cocher « T1 » avec la mention « adapté, T1.3 et T1.6 après au Lot 4 ».

### L2GT-4 · Avant production · le texte d'une révision en attente n'est pas prouvé absent de l'aperçu (la projection que servira la recherche)

- **Où :** `apps/api/db-tests/profiles-creator-preview-route.test.ts:344-600` (aucune occurrence de « revision », CA48 ou CA49 dans ce fichier) ; `t1-anonymisation.test.ts:1378-1426` (le texte révisé est un marqueur « à lui seul », cherché dans quatre lectures confondues, l'aperçu n'est pas isolé) ; `apps/api/src/domains/profiles/creator/public-projection.ts` ; `profiles-creator-submission.test.ts` (L2G-D5, base).
- **Fait :** CA48 (la version validée reste servie) est prouvée en base (D5) et sur la lecture du profil du créateur, mais l'aperçu, qui est la projection destinée aux marques, n'a aucun test avec un profil `published` dont le titre, la bio ou la légende attend sa révision. Aujourd'hui la projection lit des colonnes validées, donc le défaut n'existe pas ; rien ne le détectera le jour où le Lot 3 ou un correctif lira la révision. C'est l'équivalent, pour le texte, de TM5.5 pour les visuels.
- **Correctif :** un cas dans `L2G-P3` : profil `published`, bio et légende en révision, `GET …/preview` sur les deux onglets : la version validée est servie, la valeur en attente est absente du corps et des en-têtes, puis `approve` : elle apparaît.

### L2GT-5 · Avant production · aucun test de concurrence sur les portes à verrou

- **Où :** `supabase/migrations/0242_profiles_portfolio_items.sql:1155, 1242, 1303` (`for update` sur les visuels du compte), `0243…sql:1108, 1221, 1448`, `0244…sql:519-526, 577, 669-675, 772, 875, 1308` ; tests : `profiles-portfolio*.test.ts`, `profiles-creator-decisions.test.ts`, `profiles-creator-submission.test.ts`, `t14-creator-queue-route.test.ts` (chaque scénario est une transaction annulée, ou des appels en série ; seul `profiles-portfolio-route.test.ts:1039-1043` envoie des requêtes en parallèle, et seulement pour des refus d'accès).
- **Fait :** les invariants 4, 5, 8 et 10 reposent sur des verrous qu'aucun test ne met en concurrence : deux dépôts simultanés sur la septième place (neuvième visuel ? quota de 16 dépassé ?), deux agents qui ouvrent la même entrée, une décision contre une écriture du créateur (jeton périmé), double soumission, **double publication : `profile.completed` deux fois** (RG106). Les deux fichiers `tm1-outbox-claim` montrent que le motif (deux connexions validées) existe déjà dans le dépôt.
- **Correctif :** un fichier `profiles-creator-concurrency.test.ts` à deux connexions validées (comptes jetables, nettoyage comme les autres) : quatre cas (neuvième visuel et quota, ouverture double, publication double = un seul `profile.completed`, décision contre écriture = `stale_token`).

### L2GT-6 · Avant production · durées du verrou et échéances des files 2 et 3 assertées par l'ordre seulement

- **Où :** `profiles-creator-decisions.test.ts:717-745` (`expires` seulement `toBeInstanceOf(Date)`, prise, prolongation, levée) ; `t14-creator-queue-route.test.ts:1287-1301` (`claimExpiresAt` `> Date.now()`) ; `profiles-creator-submission.test.ts:388` (`sla_due_at > created_at and escalate_at > sla_due_at`) ; `profiles-portfolio.test.ts:476-480`. À opposer à `profiles-brand-review.test.ts:268-270`, qui compare à `business_deadline('profiles_advertiser', now(), 480)`.
- **Fait :** l'invariant 10 de la fiche (verrou de 30 min, prolongation, `sla_due_at` à 1 jour ouvré, escalade à 3) n'est prouvé que pour les lignes de la politique (`tm3-backoffice-catalogue.test.ts`, 480 et 960 : bien), pas pour ce que les portes en font : un verrou de 1 s ou de 10 jours, une échéance calculée sur la mauvaise file passeraient.
- **Correctif :** asserter `claim_expires_at - now() = interval '30 minutes'` à la prise et à la prolongation, et `sla_due_at`, `escalate_at` égaux à `business_deadline(<file>, now(), 480 | 960)` pour une entrée de la file 2 et un visuel de la file 3.

### L2GT-7 · Avant production · `de69db7` et EC-L2G-09-3 : l'avis « l'onglet après ne révèle rien » n'a aucune preuve dans le navigateur, et le comportement en suspens est figé par trois tests

- **Où :** `apps/web/src/components/creator-profile/CreatorPreviewScreen.tsx:173, 254-255` (avis `data-preview-after-empty`) ; `apps/web/e2e/creator-preview.spec.ts:118-125` (seul `toHaveCount(0)`, le chemin « révélé » ; aucun cas où l'avis s'affiche) ; `apps/web/tests/creator-preview-view.test.ts:147-150, 357-371` ; `apps/api/db-tests/profiles-creator-preview-route.test.ts:508-528` ; `apps/web/src/locales/fr/creator-profile.json:525-542` (`afterIntro`, `afterEmpty.*`, `observed`).
- **Fait :** (1) l'avis ajouté à la recette n'est exercé que par la fonction pure `afterEmptyOf` : ni rendu, ni contraste, ni axe (le jalon fait de l'axe `wcag22` un critère), ni lecture EN. (2) EC-L2G-09-3 (une ligne `agent_observed` ne révèle pas de chiffre exact à la créatrice) reste une décision `product-owner` ouverte ; le comportement provisoire est verrouillé par `creator-preview-view.test.ts:147`, `profiles-creator-preview-route.test.ts:508` et l'e2e de la ligne 14, qui devront changer ensemble ; entre-temps `afterIntro` promet « vos chiffres exacts » pendant que `observed` dit qu'ils ne s'affichent pas : aucun test ne détecte cette contradiction. (3) Textes `preview.afterEmpty.*` encore « à relire » (`21` §5.8).
- **Correctif :** ajouter dans le même e2e un second profil sans réseau (ou une ligne sans pseudo) où l'avis apparaît, avec axe FR 375 et EN 1 440 ; arbitrer EC-L2G-09-3 avant `production` et réécrire les trois tests dans le commit qui l'applique.

### L2GT-8 · Avant production · le libellé RG83 « mot pour mot » n'est comparé à rien d'autre qu'à lui-même

- **Où :** `apps/web/e2e/creator-portfolio.spec.ts:122-124` (`fr.portfolio.brandConsent` lu dans le fichier de textes testé) ; `apps/web/src/locales/fr/creator-profile.json:383` ; `profiles-portfolio-privacy.test.ts:140` et `profiles-portfolio-route.test.ts:762` (seule la **clé** `creatorProfile.portfolio.brandConsent` est conservée) ; `docs/mvp/07-…:778-782` (RG83).
- **Fait :** la fiche (invariant 6) impose le texte de RG83 mot pour mot ; sa déclaration est horodatée et conservée **par clé**. Si le libellé du fichier de textes dérive (ou si la version anglaise diffère), aucun test ne rougit, et la déclaration conservée ne dit plus ce que la créatrice a lu. Les libellés D34 sont déjà « à relire avant production », ce qui rend le moment naturel.
- **Correctif :** un test unitaire sur la chaîne littérale française de RG83 et sur l'équivalent anglais validé ; et, si le texte doit être opposable, stocker la version de libellé (ou son empreinte) avec la déclaration.

### L2GT-9 · Avant production · aucune CI verte sur `de69db7` et `6f1aeed` (accepté, à écrire)

- **Où :** `jalons/l2g/run.md:27-28` (fix-4 et ligne F, CI verte citée sur `5243ef6`) ; `CLAUDE.md` §7 règles 4 et 5 (suivi de la CI, entrée en `production` sur CI verte).
- **Fait :** `5243ef6` est le dernier vert ; la recette du fondateur a changé le code après coup (`de69db7`), ce que le critère « CI verte, `gh run list` » ne couvre pas. Ma preuve locale est équivalente pour les suites (base ×3 + 1, `pnpm check`, e2e entier) mais pas pour l'environnement (pile propre, éclats, mémoire, dépendance au `CI=1`, cache de build).
- **Correctif :** inscrire à la ligne C que le fondateur a accepté de passer outre, avec la liste de ces mesures locales, puis relancer la CI sur `main` dès que la facturation revient et exiger le vert avant l'attestation `security-reviewed:` et avant tout `git merge --no-ff main` dans `production`.

### L2GT-10 · Plus tard · T9.10 : la sous-assertion « échéances neuves » est creuse

- **Où :** `apps/api/db-tests/profiles-portfolio.test.ts:341-367` (`pg_sleep(0.01)` puis `expect(sla_due_at).toBeGreaterThanOrEqual(avant)`).
- **Fait :** `now()` vaut l'instant de début de la transaction (`0242_…sql:656` utilise `pg_catalog.now()`), et le scénario tient dans une seule transaction : `pg_sleep` ne change rien, avant et après sont égaux, et `>=` passe aussi si le déclencheur oublie de recalculer l'échéance (mutation : garder l'ancienne valeur au repassage en `pending`). Le titre promet « its deadlines new ». Les deux moitiés réelles de T9.10 (CHECK, déclencheur de réexamen) sont, elles, vues rouges.
- **Correctif :** changer `target_decision_minutes` de la file dans la transaction entre les deux états et asserter l'égalité avec `business_deadline(…, now(), <nouveau>)`.

### L2GT-11 · Plus tard · plancher non relevé par `de69db7`

- **Où :** `apps/web/tests/case-floors.ts:17` (`"tests/creator-preview-view.test.ts": 18`).
- **Preuve :** `pnpm check` : « floor may be raised: tests/creator-preview-view.test.ts: 21 cases executed, floor 18 ». La règle du fichier : relever un plancher quand un fichier gagne des cas ; trois cas (`de69db7`) peuvent aujourd'hui disparaître sans alerte.
- **Correctif :** `18` → `21`, à la clôture avec les autres corrections.

### L2GT-12 · Plus tard · les quotas du dépôt dépendent du passage de minuit UTC

- **Où :** `apps/api/db-tests/profiles-portfolio-route.test.ts:240-261` (`usageOf` et `setUsage` calculent le jour par `now() at time zone 'UTC'`), `:701-732` (16e dépôt, 17e refusé, `Retry-After` à ± 5 s de minuit, 64 Mio).
- **Fait :** un test qui traverse 00:00 UTC entre `setUsage` et la lecture (quelques secondes par nuit, un run CI sur plusieurs milliers) échoue sans cause ; idem le `Retry-After` pris à `new Date()`. Probabilité faible, mais c'est un test non déterministe (règle du métier : instable = cassé).
- **Correctif :** en tête des trois cas, attendre le passage si moins de 60 s séparent de minuit UTC, ou injecter l'horloge.

### L2GT-13 · Plus tard · « aucune URL émise » (T1.5) vérifiée côté créateur, pas côté agent

- **Où :** `apps/api/db-tests/t14-creator-queue-route.test.ts:896-920` (lecture d'un visuel par l'agent : type, base64, `no-store`, mais pas de recherche d'hôte Storage, de jeton ni d'URL) ; le côté créateur le fait, `profiles-portfolio-route.test.ts:1070-1092`.
- **Fait :** le schéma de réponse est strict, donc le risque est faible ; la clause de T9.2 (« aucune réponse ne porte d'hôte ni de jeton ») vaut pour toutes les lectures d'image.
- **Correctif :** reprendre la liste interdite (`http`, `supabase`, `storage/v1`, `token`, clé, empreinte) dans les deux lectures de l'agent.

### L2GT-14 · Plus tard · la purge réelle du compartiment `portfolio` n'est prouvée que du côté SQL

- **Où :** `apps/api/db-tests/profiles-portfolio.test.ts:775-860` (`ops.claim_storage_purges` rend `bucket_id = 'portfolio'` et la clé : bon) ; `apps/api/src/domains/maintenance/storage-purge.ts:44-55` (exécuteur générique) ; `apps/api/db-tests/tm1-storage-purge.test.ts` (non modifié dans la plage, aucun objet `portfolio`).
- **Fait :** l'exécuteur supprime ce que la base lui désigne, sans connaître le compartiment : aucun test ne montre un objet de `portfolio` retiré du double du Storage, puis sa ligne purgée, avec le compartiment dans l'appel. Risque faible (code partagé), mais la promesse « 30 jours puis purgé » est un engagement RGPD.
- **Correctif :** un cas dans `tm1-storage-purge.test.ts` avec un visuel `withdrawn` échu, un double de Storage qui enregistre `remove(bucket, key)`.

### L2GT-15 · Plus tard · traçabilité : `L2G-U2` sans nom, commentaire périmé

- **Où :** `packages/domain/tests/creator-profile-completeness.test.ts:152` (le test « reaches 100 from L2G » est L2G-U2 de la fiche, sans identifiant, `grep L2G-U` ne trouve que U1 et U3) ; `apps/api/db-tests/t1-anonymisation.test.ts:456` (« the file of origin waits for the portfolio, L2G » : le portfolio est livré, le marqueur est à l. 1092).
- **Correctif :** préfixer le titre par `L2G-U2` ; corriger le commentaire.

## Non couvert, dit explicitement

- **Aucune CI** sur la plage depuis `de69db7` : éclats e2e et job base non mesurés (L2GT-1, L2GT-9).
- **Revue de dix visuels par un humain, `staging` avec un créateur `published`** : non automatisable, aucune preuve écrite (L2GT-3).
- **T1.3 et T1.6 « après »** (contre-test après révélation, coordonnées après mise en relation) : Lot 4, dépend des mises en relation.
- **Charge et mémoire du service `api`** (deux traitements d'image à la fois, 8 Mio, risque de la fiche) : aucun test de charge ; seul le plafond de corps est testé.
- **Envoi réel des e-mails de décision** : testé contre la doublure (D69, aucun modèle Brevo) ; rien n'est envoyé hors de la doublure ; l'envoi réel sur `staging` n'a pas de preuve ici.
- **Mutations** : je n'ai rejoué aucune mutation hors les deux de L2G-12 (vues rouges dans les fichiers) ; les propositions de L2GT-4, 6 et 10 sont à jouer en transaction annulée.

ETAT : 15 constats, bloquant 0, à corriger dans le jalon 3, avant production 6, plus tard 6.
