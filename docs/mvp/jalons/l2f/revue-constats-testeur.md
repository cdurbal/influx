# Revue de fin du jalon L2F : constats `testeur`

**Plage** `c4d21dc..HEAD` (28 commits, migrations `0228` à `0240`). **Revue** statique des tests et des attendus, relecture des 12 runs CI de la plage (`gh run list`, lecture seule) ; aucun fichier modifié hors ce fichier, aucune base ni mutation lancée (la base locale commite des jeux de données : les mutations proposées ci-dessous sont à rejouer en copie).

## Récapitulatif

| Gravité | Nombre | Constats |
|---|---|---|
| Bloquant | 0 | |
| À corriger dans le jalon | 1 | L2FT-1 |
| Avant production | 3 | L2FT-2, L2FT-3, L2FT-4 |
| Plus tard | 7 | L2FT-5 à L2FT-11 |

**Verdict « prêt à livrer » (sur `main`, D71) : oui, sous réserve de L2FT-1** (un test e2e instable a rougi la CI deux fois sur douze runs, sans correctif ni inscription au registre DS-flaky). Aucun bloquant. Pour `production` : L2FT-2, L2FT-3 et L2FT-4 se traitent ou s'acceptent par écrit avant l'entrée.

## Contrôles demandés par `revue.md`, résultats

- **Aucun plancher baissé : tenu.** Diff des sept `case-floors.ts` : chaque ligne retirée est remplacée par une valeur supérieure ou égale ; `e2e/verification.spec.ts: 9` devient 3 + 2 + 4 = 9, plus quatre fichiers neufs. Les planchers base égalent le nombre de cas relevé (`verification-brand-route` 24, `-route` 25, `t14-verification-queue-route` 37, etc.).
- **Aucun attendu affaibli : tenu, une réserve (L2FT-7).** Attendus modifiés relus un par un : `tm1-brevo-connector` (`to_reconfirm` ne compte plus ; `active` échu compte encore, conforme à `modele.md` §3 et à la tâche seule), `registry-sources-view` (mention « pas encore possible » retirée avec la fonction), deux « aucun lien » renversés en « un lien, Voir la demande » (fix-1, conséquence de la règle, assertion inversée et non retirée), `t1-anonymisation` (seuil du témoin abaissé : L2FT-7).
- **CA45 à CA54, `06` CA31 et CA32 : toutes couvertes** (D1 à D5, D7 à D9, D11, D13 ; CA54 par D14 et D15). Rien reporté.
- **L2F-D1 à D20 « vus rouges » : non démontrable.** Chaque test est livré dans le même commit que la migration ; `run.md` ne note de rouge que pour D19 (« témoin rouge ») et pour les deux mutations de la ligne 16. Je n'ai pas rejoué de mutation : constat de non-preuve, pas de défaut avéré. Les trous visibles à la lecture sont en L2FT-4.
- **TM5.3 : tenu au niveau SQL** (`verification-lifecycle.test.ts` l. 379-502 : 90 j puis 120 j, registre `system` sans acteur, rejeu à 0, compte vérifié intact, aucune autre main : agent, admin, membre, appel de la tâche par un agent, tous 42501). **Câblage du worker non prouvé : L2FT-2.**
- **TM5.4 : tenu** (`verification-revocation.test.ts` l. 381-508 : sans 2V, 2V d'un autre badge, d'un autre motif, expirée, consommée, demandeur seul avec un pair, écriture directe ; forme dégradée l. 688 ; témoin de réussite dans le même fichier, donc les refus ne sont pas des refus pour la mauvaise cause). Par la route : `t14-verification-badges-route` l. 469-544.
- **PLT-5, PLS-5, PLS-6 : tenus** (l. 1022-1113, avec témoin valide et sonde de la contrainte copiée du vrai tableau).
- **T9.6, T1, TM11 :** T9.6-R balaie le catalogue (dynamique) et nomme en plus les sept tables de `0231` à `0234` ; T2 exige RLS activée, forcée, une politique et une ligne d'attendu par table (dynamique) ; T1 et TM11 reçoivent les marqueurs neufs. Tenu.
- **Éclats sous 7 min 30 : tenu pour les trois éclats navigateur** (256 à 370 s sur les 7 runs verts relus). Hors périmètre littéral mais proche : le job base (L2FT-11).
- **e2e ≤ 20 s sur trois passages : non mesuré ensemble** (`run.md` § Mesures n'existe pas encore, prévu à la ligne C). Somme des mesures par ligne : L2FT-6.
- **DS-flaky : une occurrence neuve non inscrite** (L2FT-1).
- **Faits à corriger dans le brief de la revue :** la CI n'a pas été verte à chaque push (trois runs rouges, voir L2FT-1) ; la suite base, elle, est verte sur les 12 runs. La ligne 20 n'est pas un dépassement : +1,4 s pour 2 s visées (L2FT-6).

## Constats

### L2FT-1 · À corriger dans le jalon · e2e instable, deux CI rouges, aucune trace dans le registre DS-flaky

- **Où :** `apps/web/e2e/verification-creator.spec.ts:244-253` (clic « retour », lecture et écriture en base, `page.reload()` brut, attente de `[data-reason="ownership_not_proven"]`) ; même motif l. 210 → 226-227 ; `playwright.config.ts:55` (`retries: 0`).
- **Fait :** le cas `:44` (FR, du lien au badge) a échoué à l'identique, éclat 3/3, sur le run 42681708083 (push de `423cb61`) et sur le run 42816747442 (push de `2f4259b`) : « element(s) not found » sur la ligne de refus, 10 s. Les pushes suivants (`4d2effb`, `4b64f13`), sans changement de web, sont verts : instabilité, pas régression. Aucune des deux occurrences n'est dans `run.md` ni dans la ligne DS-flaky de `21` §. Le troisième run rouge (42583733529, push de `344eea5`) est le `relay-integration.artifacts.ts` T7.3 (`EPIPE`, « forwards 8 MiB… »), deuxième occurrence du motif déjà listé comme « première occurrence » ; lui non plus n'est pas noté, et aucun `gh run rerun --failed` n'apparaît (tentative 1 des trois).
- **Cause probable (à confirmer par la trace du run 42816747442) :** le test écrit en base et recharge sans attendre l'arrivée de la page cible du clic ; sous charge d'un éclat, le rechargement vise la page quittante. Le test utilise `page.reload()` alors que l'aide `reload(page)` de `e2e/support/journey.ts:183` attend l'hydratation.
- **Correctif :** attendre l'URL de destination (`toHaveURL`) ou un repère de la ligne avant `refuseAsAgent`, remplacer les `page.reload()` des lignes 227, 250, 274, 463 par `reload(page)`, puis inscrire les trois occurrences (runs ci-dessus) dans la ligne DS-flaky de `21` ; vert ×3 de ce fichier avant la clôture.

### L2FT-2 · Avant production · la tâche `badge_lifecycle` n'est exécutée de bout en bout par aucun test

- **Où :** `apps/api/src/domains/maintenance/periodic.ts:273-283` (`createPeriodicStore`, `runBadgeLifecycle`, `purgeVerificationFindings` dans `elevated`), `repository.ts:253-275`, `worker.ts:167` ; tests : `tests/periodic-scheduler.test.ts:882-948` (magasin factice) et `db-tests/verification-lifecycle.test.ts:223-249` (SQL appelé directement sous `influx_worker`).
- **Fait :** la chaîne réelle ordonnanceur, transaction élevée, `select ops.run_badge_lifecycle(...) as count` n'est vue ni en base ni sur `staging` (aucun badge n'y atteint 90 j, recette par dates vieillies non faite pour la péremption). Un défaut de câblage (colonne lue, droit de la transaction élevée, ligne de registre `elevated.maintenance.run_periodic`) laisserait tous les badges actifs en production, avec un seul signal : un run `failed` à l'écran de santé. La note de la ligne 12 (« un run validé agirait sur le jeu de données partagé ») ne tient pas : `db-tests/tm1-periodic-tasks.test.ts:78` et `:488` appellent déjà `createPeriodicStore` sur la vraie base pour les autres tâches.
- **Correctif :** ajouter dans `tm1-periodic-tasks.test.ts` un cas qui lance `createBadgeLifecycle(createPeriodicStore(...))` sur un run ouvert dans une transaction annulée ou un badge échu daté par le test, et lit son effet ; à défaut, preuve sur `staging` (agents, D70) par un badge vieilli et un passage réel du worker, consignée avant l'entrée en production.

### L2FT-3 · Avant production · EC-L2F-08-10 : le contrôle d'unicité compare un identifiant périmé

- **Où :** `supabase/migrations/0228_verification_observed_handle_match.sql:175`, `0232_verification_badge_disputes.sql:1623` et `:1931`, `0233_verification_identifier_changes.sql:1283` (`normalize_handle(b.observed_handle_at_decision)`) ; test manquant dans `db-tests/verification-identifier-changes.test.ts:657-775` (seul le cas « identifiant tenu par un autre compte » est couvert, avec un badge dont l'identifiant n'a jamais changé).
- **Fait :** après « même compte », l'identifiant confirmé n'est écrit que sur l'entrée (`observed_handle` de `identifier_change_reviews`), jamais sur le badge. Conséquences non couvertes : (a) l'ancien identifiant, libéré sur le réseau puis repris par un autre créateur qui prouve sa propriété, est refusé `handle_already_verified` (escalade à tort) ; (b) le nouvel identifiant du compte vérifié n'est pas protégé contre un second compte qui le déclarerait. (b) exige que l'autre prouve la maîtrise du même profil, donc faible ; (a) est un faux refus plausible.
- **Correctif :** une seule fonction « identifiant tenu par ce badge » (dernier constat `confirmed` de l'entrée, sinon `observed_handle_at_decision`) utilisée par les quatre comparaisons, avec un cas base pour (a) ; ou accepter par écrit la limite et l'inscrire en `04` §5.

### L2FT-4 · Avant production · bornes de la péremption sans cas négatif, branche `to_reconfirm` de la tâche non testée

- **Où :** `supabase/migrations/0230_verification_badge_lifecycle.sql:450-473` (branche b : `to_refresh` **et** `to_reconfirm`), `:475-498`, `:500-522` ; tests `db-tests/verification-lifecycle.test.ts:510-606`.
- **Fait :** tous les cas posent un badge juste dû (J-14, 90 j, `expires_at + 30 j` exactement) ; aucun ne pose un badge juste avant le seuil (J-16, 89 j, grâce à 29 j) et vérifie qu'il reste intact. Un seuil décalé de plusieurs jours (rappel à 40 jours, grâce raccourcie) passerait D1 à D3 et TM5.3. Par ailleurs `to_reconfirm` passant à `expired` à la fin de la grâce, et EC-L2F-08-8 (audience rendue après reconfirmation dont l'échéance est passée, qui attend la tâche), n'ont aucun cas : `grep to_reconfirm` ne trouve que le déclenchement par la file 6. Mutations à rejouer en copie : (1) rappel à `v_reminder + 25`, (2) fin de grâce à `v_grace - 25`, (3) retrait de `'to_reconfirm'` de la branche b ; je m'attends à trois vertes.
- **Correctif :** dans D1, D2, D3, ajouter un second badge juste avant le seuil et attendre qu'il reste `active` ou `to_refresh`, sans rappel ni ligne au registre ; un cas `to_reconfirm` à échéance + 30 j qui expire et un à échéance + 29 j qui reste.

### L2FT-5 · Plus tard · ligne 01 : décompte des assertions inexact dans `run.md`, gain dans le bruit

- **Où :** `docs/mvp/jalons/l2f/run.md` ligne 01 ; `apps/web/e2e/support/verification.ts:486-496`.
- **Fait :** décompte recalculé par motif `expect(` : 262 avant (fichier d'origine), 264 après (259 dans les trois fichiers + 5 dans le support, dont 3 `ok()` neufs dans `sendAudienceRequest` : aucune assertion perdue sauf `[data-piece]` du dépôt amorcé, déjà couvert par `verification-creator.spec.ts:452`). Le « 262 → 261 » écrit ne se retrouve pas. Gain mesuré 1,3 s sur 35,1 s (4 %), pour 10 s visées : dit honnêtement, mais le levier est sans effet mesurable ; 2 travailleurs donnent 40,6 s (contention), donc le mur de CI ne bouge pas.
- **Correctif :** corriger la ligne 01 (264, pas 261) et inscrire dans `21` § L2D-E2E que ce levier est épuisé, le temps restant étant le démarrage des serveurs ; ne pas le rouvrir comme levier d'amorce.

### L2FT-6 · Plus tard · budget e2e serré, mesure consolidée absente

- **Où :** `docs/mvp/jalons/l2f/run.md` lignes 17 à 21, fix-1, fix-2 ; `cloture.md` point 2.
- **Fait :** somme des ajouts mesurés (1 travailleur) : ligne 17 de 6,2 à 7,0 s (pour 6 s : le seul dépassement, ≈ 0,5 s), 18 : 4,7 s (étendue 3,6 à 5,5 s pour 5 s), 19 : 4,0 s, 20 : +1,4 s (**sous** les 2 s visées, ce n'est pas un dépassement), 21 : +0,87 s, fix-1 : +0,8 s, fix-2 : +0,4 s, soit 18,4 à 19,2 s pour 20 s, avant le −1,3 s de la ligne 01. La marge est d'environ 1 s et chaque mesure est une médiane isolée, pas un passage complet ×3.
- **Correctif :** produire le § Mesures à la ligne C (trois passages complets, somme par `sum-e2e-durations.ts`) ; si la somme dépasse 20 s, l'écrire comme dépassement accepté avec son total, sans baisser de plancher.

### L2FT-7 · Plus tard · témoin de T1 abaissé

- **Où :** `apps/api/db-tests/t1-anonymisation.test.ts:1137-1140`.
- **Fait :** `errors.length > statuses.size` devient `errors.length > webRoutes.length`, les routes `/v1/bo/` étant exclues (elles répondent 404 à la surface web par construction, T14.1). Raison légitime, mais le seuil baisse du nombre de routes du backoffice et ne prouve plus que chaque route web répond 500 au témoin qui jette.
- **Correctif :** asserter structurellement que chaque route web du balayage contient un 500 (ou que l'ensemble des routes sans 500 est exactement celui attendu), plutôt qu'un cardinal.

### L2FT-8 · Plus tard · aucune assertion « rien vers Apollo » ni cas de non-consentement sur les sorties L2F

- **Où :** `db-tests/verification-lifecycle.test.ts:290-305` (`queueOf` compte tous les `lead.updated` par compte, ce qui attrapera un doublon mais pas un événement d'un autre type) ; invariant 11 de la fiche (« Apollo : rien »).
- **Fait :** l'invariant est tenu par construction (`ops.queue_badge_change`, `0230:379-387` : `brevo_contact` seul) et le blocage sans consentement est prouvé au connecteur (`tm1-brevo-connector.test.ts:357`), mais rien ne le dit pour les événements L2F. Les e-mails de badge sont transactionnels : un membre sans consentement doit les recevoir sans être synchronisé.
- **Correctif :** dans `queueOf`, compter aussi toute ligne `destination like 'apollo%'` et l'attendre à 0 ; un cas de membre non consentant dans la péremption (e-mail oui, contact non) peut venir au Lot 6bis.

### L2FT-9 · Plus tard · D83, choix « adresse de connexion » non couvert en navigateur

- **Où :** `apps/web/e2e/verification-revocation.spec.ts` (cas étendu à la ligne 20) ; ligne 20 : « non couvert en navigateur : le choix adresse de connexion ».
- **Fait :** le lancement par un commercial est en e2e ; l'octroi par l'adresse de connexion (`grant-by-login`), seconde moitié du parcours D83, est prouvé en unitaire, route et base seulement, et à la main par le fondateur en recette F. Parcours à valeur business, mais déjà vu sur `staging`.
- **Correctif :** un cas e2e court de la file 4 (marque, domaine, adresse du compte, clic « adresse de connexion », badge) au prochain jalon qui touche cet écran, avec la même amorce que le cas du lancement.

### L2FT-10 · Plus tard · tâche arrêtée plus de 30 jours : « à rafraîchir » envoyé pour une grâce échue

- **Où :** `0230_verification_badge_lifecycle.sql:450-498` (b avant c dans un même appel, c ne passant qu'en `to_refresh`).
- **Fait :** si la tâche n'a pas tourné pendant plus de 30 jours après une échéance, le badge actif passe d'abord `to_refresh` (e-mail « à rafraîchir » avec une `graceEndsAt` déjà passée), puis `expired` au run suivant. Aucun cas ne documente ce comportement ; sans gravité tant que le worker est surveillé.
- **Correctif :** un cas D3 bis qui fixe le comportement voulu (soit expiration directe, soit « à rafraîchir » puis expiré le lendemain) ; décision au `product-owner`.

### L2FT-11 · Plus tard · durée du job base proche de 7 min 30

- **Où :** CI, job « Database tests » : 457 s (run 42824784003) et 461 s (run 42874489389) ; 356 s au run de la ligne 18 (`68a7f19`).
- **Fait :** pas de seuil écrit pour ce job (le critère vise les éclats navigateur) mais la tendance est de +100 s en trois commits (lignes 18 à 21) et la suite base est la plus longue de la CI.
- **Correctif :** inscrire la durée du job base dans le § Mesures de la ligne C et fixer un seuil d'alerte (par exemple 8 min) avant que L2G ne grossisse la suite.

## Ce qui n'est pas couvert, dit explicitement

- Mutations de la ligne 16 (agent exécutant la tâche, retrait sans consommation) : crues sur déclaration de `run.md`, non rejouées ; aucune mutation sur D1 à D18 (voir L2FT-4 pour les trois que je jugerais utiles).
- Concurrence de la tâche : deux travailleurs simultanés ; la protection est `for update skip locked` et l'unicité du run par période (existante), non rejouée en deux connexions pour `badge_lifecycle`.
- Contestation d'un retrait par la route membre (`POST /v1/me/verification/disputes` sur un retrait) : prouvée en base (`verification-disputes`) et par l'e2e EN de la ligne 17 ; jamais par un cas de route dédié (écrit à la ligne 14).
- Rétention 3 ans : borne exacte (jour 1095 contre 1096) non testée.
- `to_reconfirm` sans échéance (compte vérifié) : aucun délai de sortie si le créateur ne reconfirme jamais ; décision de produit, non spécifiée.
- Débit de l'autosave (L2DS-7) : une entrée par ligne est prouvée ; la charge ne l'est pas.
- Recette de péremption réelle sur `staging` : aucun badge n'atteint 90 j avant février (D70) ; la couverture est par dates vieillies en base uniquement.
