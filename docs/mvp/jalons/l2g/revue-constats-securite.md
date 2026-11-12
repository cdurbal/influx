# L2G — constats `expert-cybersecurite` (revue de fin de jalon)

> 2026-11-12 · plage `696f625..HEAD` (24 commits, `f245d7c` à `6f1aeed`). Migrations `0242` à `0245` lues en entier
> (droits, politiques, portes, déclencheurs, assertions), code `apps/api` neuf lu fichier par fichier, fronts lus sur les
> chemins sensibles (`blob:`, `data:`, stockage navigateur, noms de fichier) · aucun fichier modifié hors celui-ci · gravités :
> bloquant · à corriger dans le jalon · avant production · plus tard. **Aucun bloquant, aucun « jalon » ; quatre « avant
> production », quatre « plus tard ».**

## Constats

| # | Gravité | Fichier:ligne | Constat (surface, scénario, impact) | Correctif (effort) |
|---|---|---|---|---|
| L2GS-1 | avant production | `apps/api/src/domains/backoffice/creator-queues-routes.ts:522-532`, `:605-611` ; `0244:685-686` ; `apps/backoffice/src/components/CreatorReviewEntryScreen.tsx:5-6` ; `l2g/run.md:20` ; `db-tests/t14-creator-queue-route.test.ts:835-846` | **File 2, couche I hors détenteur.** `openedCreatorEntry` lit `readReviewedLines()` (pseudo, lien, pseudonyme, chiffres exacts) et les révisions en attente (pseudo ou lien proposés) **quelle que soit l'issue** de `open_creator_review_entry()` : `read_only` (C2) mais aussi `closed`. `run.md` l. 20 et l'en-tête de l'écran affirment « couche I servie au détenteur seul » : faux, et le cas T14 du mode lecture ne vérifie pas l'absence. Scénario : tout agent en `aal2` ouvre une à une des entrées closes (identifiants lus dans les historiques de fiche) et relève pseudo et lien de chaque créateur publié, alors que la fiche de compte les retire délibérément (`account-creator/repository.ts:7`, `17b` §3.6 ②). Chaque ouverture est journalisée (`queue.entry_opened`, issue), d'où la gravité. | Ne servir `handle`, `pseudonym`, `profileUrl`, chiffres exacts et valeurs proposées de pseudo et lien qu'aux issues `claimed`, `held` (et `read_only` si `product-owner` confirme que C2 l'exige), jamais à `closed`, avec un cas T14 qui l'assure et la note de `run.md` corrigée (0,25 j). |
| L2GS-2 | avant production (arbitrage `product-owner`) | `0244:1542-1599` (`approve_portfolio_item`), `0244:1738-1770` ; `apps/backoffice/src/components/PortfolioReviewDecision.tsx:56-73` ; `l2g/ux-constats.md` L2GU-21 | **Approbation d'un visuel jamais affiché.** La porte d'approbation n'exige aucune lecture préalable ; fix-3 n'ajoute qu'une phrase d'information côté écran. Scénario : un agent pressé enchaîne ‹v› puis « Confirmer » sur dix visuels sans les ouvrir ; un visuel portant un pseudo incrusté, un lieu identifiable ou un visage d'enfant devient `approved`, donc servi à toute marque dès la recherche du Lot 3. Impact : le seul contrôle humain de l'anonymisation des images (`CLAUDE.md` §5 règle 3, RG79) est contournable par négligence, sans trace distinctive. | `read_portfolio_item_for_review()` (et la lecture de file 2) écrit `last_read_by_account_id`, `last_read_at` sur le visuel, et `approve_portfolio_item()` refuse 55000 `not_displayed` sans lecture de l'appelant depuis `claimed_at` ; le refus reste possible sans lecture (0,5 j, migration I-4). |
| L2GS-3 | avant production (rehausse L2FS-9) | `0244:991-1005` ; `0233:510-517`, `0233:588-594` ; `21` l. 198 | **L2FS-9 est échu.** Sa condition était « avant toute écriture interne du handle » : `publish_creator_review_entry()` écrit désormais le handle sous `influx_moderation_definer`. Le chemin nominal est tenu par EC-L2G-04-5 (refus si « Compte vérifié » `active`), mais par **un seul contrôle**, lu avant l'`UPDATE` en lecture validée : si l'octroi de file 4 sur la même ligne valide entre ce test et l'écriture, `track_identifier_change()` ne voit pas le badge (politique de son propriétaire liée à `current_account_id()`, ici l'agent) et échoue ouvert, sans entrée en file 6. Impact : « Compte vérifié » affiché sur un handle jamais contrôlé ; probabilité faible (deux décisions quasi simultanées sur une ligne). Le correctif écrit pour L2FS-9 (42501 si le compte n'est pas l'appelant) casserait maintenant la publication. | Donner au propriétaire du déclencheur la lecture des seuls badges `account_verified` de la ligne mise à jour, tous comptes (politique `level = 'account_verified'`), pour qu'il ouvre l'entrée de file 6 quel que soit l'auteur, avec un cas base « handle appliqué par une révision sur une ligne vérifiée entre-temps » ; ligne L2FS-9 de `21` §8 passée « avant production » (0,25 j). |
| L2GS-4 | avant production (étend L2DS-7, L2FS-5) | `apps/api/src/domains/profiles/creator/profile.ts:401-405`, `:465`, `:542`, `:561` ; `networks.ts:299`, `:352`, `:360` ; `0243:1384-1390`, `0243:1558-1568` ; même patron `0209` (marque) | **Amplification par l'autosave d'un profil publié.** Chaque `PATCH` d'un profil `published`, même sans changement, insère **deux** `lead.updated` (Brevo et Apollo, clé d'idempotence aléatoire, aucune coalescence) ; chaque valeur différente du titre, de la bio, d'un handle ou d'une URL ajoute une révision (les remplacées sont gardées, texte compris) et une ligne de registre sous le verrou global de chaîne, et périme le jeton de file 2. Scénario : un script (ou une simple frappe longue, débit de l'autosave) émet des centaines d'appels Brevo et Apollo par minute pour un seul compte, consomme les limites de débit (et les crédits Apollo) partagées par toute la synchronisation des inscrits, et rend la révision indécidable (`stale_token` sans fin). | Limite par compte sur les routes d'écriture membres (L2DS-7, déjà avancée avant production par L2FS-5) étendue aux routes de L2G, et `lead.updated` coalescé par compte et destination tant qu'une ligne `pending` existe (index unique partiel, `on conflict do nothing`), marque comprise (0,5 j). |
| L2GS-5 | plus tard (avant toute porte neuve de ce propriétaire) | `0242:808-811`, `0242:834-839`, `0242:845-851` ; `0243:861-871`, `0243:1012-1013` | **`influx_creator_profile_definer` lit plus que ses portes.** Atteint par toute session créateur, il lit : les lignes `creator` de **tous** les comptes (`account_roles`), titre, bio, pays et tranches de **toute** vitrine non brouillon (dont les refusées pour `identifier_in_text`), légende et clé de tous les visuels d'anciens créateurs. Aucune porte ne l'exploite aujourd'hui (toutes filtrent sur `current_account_id()`, aucun `execute` dynamique), mais une porte future sans filtre exposerait des textes non modérés d'autrui. Couplage fragile : la politique des visuels (`not exists` rôle créateur) n'est juste que parce que celle des rôles montre tous les créateurs ; la restreindre ouvrirait tous les visuels. | Confier la lecture du statut d'autrui (`refuse_creator_role_removal`) à une aide `SECURITY DEFINER` d'un autre propriétaire, restreindre la politique « ancien créateur » aux états `uploading`, `pending`, `approved` et ajouter une assertion de fin qui fige ce périmètre (0,25 j). |
| L2GS-6 | plus tard | `apps/api/db-tests/t9-evidence-unreachable.test.ts:524-540` ; `0132:907-912` ; `0242:1403-1407` ; `0243:1655-1659` | **T9.6-O ne suit pas les déclencheurs.** `reachedRoles()` suit `EXECUTE` et les appartenances, pas les déclencheurs `SECURITY DEFINER` que déclenche une écriture d'un rôle atteint. Or `influx_identity_definer` (atteint depuis l'annonceur) détient `DELETE` sur toute ligne `creator` d'`account_roles`, ce qui exécute deux déclencheurs d'`influx_creator_profile_definer`, qui a des droits sur le portfolio. Aujourd'hui aucune porte annonceur de ce propriétaire ne supprime de rôle (seule `change_member_role()`, admin sous 2V) : l'invariant 1 tient, mais le test ne le prouverait pas si cela changeait. | Étendre la récursion aux propriétaires des déclencheurs `prosecdef` des tables où un rôle atteint a `INSERT`, `UPDATE` ou `DELETE`, et lister ce chemin comme exception connue (0,25 j, `testeur`). |
| L2GS-7 | plus tard (comme L2FS-6) | `0242:752-759`, `0242:774-775` ; `0243:818`, `0243:833` | **Textes lisibles par tout agent hors verrou, en base.** `influx_agent` et `influx_admin` lisent en `aal2`, pour tout compte sauf le leur : légende et commentaire interne des visuels, déclarations RG83, `member_message` et commentaire des entrées, `proposed_value` des révisions (pseudo et lien proposés, gardés aussi pour les remplacées). La restriction au détenteur n'est tenue que par `apps/api`. | Droits colonne par colonne (colonnes des listes et compteurs), textes et valeurs par les seules portes à verrou, `expected-rights.ts` ajusté (0,25 j). |
| L2GS-8 | plus tard (avant le Lot 3) | `apps/api/src/domains/profiles/creator/public-projection.ts:8-14`, `:105-113` ; `projection/repository.ts:123-124` ; `0244:503-512` | **La projection appelée « telle quelle » au Lot 3 ne filtre rien.** `readCreatorPublicProjection(accountId)` rend la couche A de tout compte lisible par l'appelant avec un simple drapeau `published` ; ni `is_searchable` (RG8), ni l'état du compte (`identity.accounts.status`, que la projection s'interdit de lire), et une publication ne vérifie pas que le compte est `active`. Scénario au Lot 3 : une recherche qui réutilise la fonction sans filtre propre sert un profil `pending_review`, masqué par son créateur, ou d'un compte suspendu. | La recherche du Lot 3 filtre `published`, `is_searchable` et compte `active` en SQL avant tout appel (cas T1 et T15 dédiés), et `lock_held_creator_review_entry()` refuse 55000 un compte non `active` à la publication (0,25 j). |

## Points vérifiés (section « Pour `expert-cybersecurite` »)

- **Invariants 1 et 16, droits de l'annonceur.** Trois tables en `0242`, trois en `0243` : RLS activée et forcée, `revoke all`
  de `public`, `anon`, `authenticated`, `service_role` et des quatre rôles métier. Assertions de fin non réversibles
  (`0242:1780-1800`, `0244:1893-1905`) : ni `influx_advertiser` ni `influx_identity_definer` n'ont de droit sur les tables ni
  d'`EXECUTE` sur les fonctions du portfolio et des files 2 et 3. Aucun rôle `influx_%` n'a de droit sur le schéma
  `storage`, `USAGE` compris (`0242:1735-1746`). T9.6 nomme les six tables pour l'annonceur et chaque rôle qu'il atteint
  (limite du calcul : L2GS-6). `influx_moderation_definer` et `influx_leads_definer` ne sont pas atteints depuis
  l'annonceur (récursion du test).
- **Storage.** Compartiment `portfolio` privé, `image/webp`, 8 388 608 octets (assertion) ; politique restrictive de `0204`
  présente sur `objects` et `buckets`. `storage.ts` refuse toute clé hors du motif `<uuid>/<uuid>.webp`. Deux seuls appels
  `store.read(PORTFOLIO_BUCKET, …)` (`portfolio.ts:477`, `creator-queues-routes.ts:378`), chacun avec la clé rendue par une
  porte de la base. Purge : `uploading` abandonné à 15 min, refusé ou retiré à `retention_due_at`, jamais `pending` ni
  `approved` (`0242:1530-1540`).
- **Passe-plat.** L'exception de `relay.ts` est ancrée (`PUT`, `^/v1/me/creator-profile/portfolio$`, chemin sans
  requête) ; corps compté pendant la lecture ; empreinte PP-12 renouvelée (`guards.ts`). Côté API : analyseur
  `application/octet-stream` seul et `bodyLimit` 8 Mio dans un périmètre propre à la route, toute autre route à 1 Mio ;
  corps vide refusé après la session (T14). Le tampon de 8 Mio avant authentification est le risque déjà accepté par D82.
- **Ré-encodage (invariant 2).** `reencodePortfolio()` : détection par en-tête, contrôle des côtés et du nombre de pixels
  avant décodage, `autoOrient`, sRGB, WebP qualité 90, aucune méthode `keep*`/`with*` (garde statique), deux places
  partagées. `exif_stripped` posé par la seule porte de stockage, `CHECK` sur `approved`, déclencheur de réexamen sur
  `checksum`, `id`, `account_id` ; T9.5 relit les octets stockés.
- **Clé d'objet.** Colonne générée `<account_id>/<id>.webp`, aucun nom de fichier lu (le front n'envoie que les octets).
  Remarque : la clé se déduit de deux colonnes que l'agent lit ; la barrière réelle est que seul `apps/api` détient le
  secret Storage et ne lit qu'avec la clé rendue par une porte. Un test statique qui interdit tout autre appel au
  compartiment serait une défense de plus (sans gravité propre).
- **Verrou, jeton, conflit d'intérêt (invariant 10).** `lock_held_creator_review_entry()` et `lock_held_portfolio_item()` :
  42501 inconnu, propre ou détenu (`owner_agent_id`), verrou vivant de l'appelant exigé (55P03), entrée encore ouverte,
  jeton recalculé et comparé à chaque décision ; prise atomique, levée forcée réservée à l'admin avec motif typé. L'API
  journalise `queue.conflict_of_interest` avant de répondre 403 ; listes et compteurs excluent les comptes détenus.
- **Lecture d'un visuel par un agent sans verrou (D82 (7)).** Aucun chemin : les deux portes de lecture passent par les
  barrières ci-dessus et écrivent `queue.portfolio_read` dans la transaction qui rend la clé ; ni vignette en liste, ni
  image dans la fiche de compte ; `object_key` non accordée aux agents. Un visuel retiré ou refusé n'est plus lisible
  par un agent (portes limitées à `pending`, `approved`). Côté écran, `blob:` révoquée, CSP du backoffice inchangée.
- **Porte de soumission et gel (invariants 7 et 8, L2DS-4).** Compte lu dans le contexte, vitrine verrouillée
  `FOR UPDATE`, manquants sans aucune écriture, score recalculé par la base, `UPDATE (completeness_percent)` retiré au
  créateur, `status` écrivable par le seul propriétaire des portes et vers `pending_review` seulement. La garde
  (`0243:1663-1773`) refuse tout en `suspended`, `published_at` toujours, et en `published` titre, bio, légende d'un
  `approved`, handle (hors « Compte vérifié » actif), URL d'une ligne listée, ligne principale non listée. Le créateur
  n'a aucun droit d'écriture sur `creator_public_networks`. Les légendes sont toujours modérées : en file 3 si posées sur
  un visuel `pending`, en file 2 (jeton) si posées sur un `approved` avant publication.
- **L2DS-6.** Déclencheur `BEFORE DELETE` (EC-L2G-03-1) plutôt que `change_member_role()` recréée : couvre tout chemin
  hors effacement, 409 `creator_profile_not_draft` sous 2V, aucun droit neuf pour `influx_identity_definer`.
- **Lectures du worker (RG108).** Trois fonctions `influx_leads_definer`, `EXECUTE` à `influx_worker` seul : ligne en
  traitement de ce worker, compte tiré de la ligne, objet tiré de la charge, compte effacé exclu, Apollo refusé (22023).
  Colonnes accordées colonne par colonne, jamais handle, URL, chiffre, légende, clé. Le message de l'agent (`other`) est
  échappé en HTML et le texte des e-mails refuse tout `@` et tout lien.
- **Journaux (invariant 13, D60).** Registre : codes et identifiants (`row_key` = identifiant, jamais une valeur) ;
  charges `outbox` réduites aux identifiants ; lignes pino : issue, tailles, durée, raison Storage, jamais compte, clé,
  légende ni nom de fichier.
- **Constat de la ligne 17, corrigé par fix-3.** `EXACT_FIGURES_JOINS` est un fragment SQL statique, sans paramètre, défini
  une fois et utilisé par la fiche et `readReviewedLines()` ; il ne lit que les chiffres observés du badge d'audience tenant
  (`active`, `to_refresh`), jamais `observed_handle_at_decision`. Clos (exposition hors détenteur : L2GS-1).
- **EC-L2G-09-3 (créateur et valeurs observées).** Le créateur n'a pas de `SELECT` sur les colonnes `observed_*` des badges
  (`0221:1135-1138`) ; masquer ses chiffres déclarés sur une ligne observée est le choix sûr, sans fuite. Si L2GU-13 conduit à
  lui montrer les chiffres observés : lecture par une porte liée au compte propre, jamais par une colonne accordée à
  `influx_creator`. Lui donner la valeur exacte relevée l'aiderait à caler ses déclarations sous le seuil
  `figures_gap_alert_percent` : point à peser par `product-owner`.
- **Rétention 30 j, `withdrawn`, `purging`** (modele point 3, EC-L2G-02-1, -02-6 ; dans la fiche et le modèle,
  l'identifiant EC-L2G-12 désigne les alertes d'entrée, relues aussi : signal seul, rien de stocké). Un visuel retiré,
  remplacé ou refusé n'est lisible que par son créateur jusqu'à la purge ; l'effacement passe tout en `purging` aussitôt ;
  un ancien créateur ne lit plus rien. À surveiller (conformité, Lot 6) : un refus `illicit_content` garde l'objet 30 jours
  et le créateur ne peut pas supprimer un visuel refusé avant ce terme ; l'export ne contient pas les octets des visuels
  (portabilité).
- **Nouveau rôle `influx_creator_profile_definer`.** NOLOGIN NOINHERIT, ni superutilisateur ni `BYPASSRLS`, aucun membre
  (assertions `0242:1766-1778`), `CREATE` repris après usage. Portes `SECURITY DEFINER`, `search_path = ''`, compte lu dans
  le contexte, pas d'`execute` dynamique. Étendue de ses lectures : L2GS-5.
- **Fixtures de test.** Données synthétiques (identifiants `…ff21` à `…ff28`, textes « T2 caption », `l2g_<préfixe>`)
  écrites par le rôle de migration dans la pile locale ; aucun fichier binaire neuf (les images géolocalisées existantes
  sont synthétiques) ; aucun chargement de `.env.local` (garde `env-local-guard`) ; aucune route de test exposée par
  `apps/api`.
- **`de69db7` (retouche du fondateur).** Front seul : marque « révélé » sur ce que l'API sert déjà au créateur lui-même,
  aucune donnée neuve ni route touchée.

## Marqueur I-4 (à apposer par le commit d'attestation de clôture, non créé ici)

- Migrations : `0242` `94c19d399bad8a3a127509fa6d1f13e244d733dc` · `0243` `86289ae478cb9db5ee75c0c8e366bd05c2706e07` ·
  `0244` `d4d4379d8d37ae78797ecc7882639a5cc396d3ed` · `0245` `057cf0de3a677eee846dc3a92825b314a332d45f`.
- Commits de code couverts : `94c19d3` `86289ae` `d4d4379` `057cf0d` `a2c4c74` `01f2a88` `3f620de` `cf7b5e2` `5313b1e`
  `9429ec8` `9710cfa` `a5af2d5` `9ce3a56` `405d73e` `f3992c6` `4431048` `7c8a6af` `4c14aae` `5243ef6` `de69db7`.
- Documentation (sans marqueur requis) : `f245d7c` `05dd20b` `87ca7fe` `6f1aeed`.

## Verdict

**`main` et `staging` : rien ne bloque** (D71). **Entrée dans `production` : autorisée sous conditions.** Avant
`production`, il faut traiter L2GS-1 à L2GS-4 ou les faire arbitrer par le fondateur : L2GS-2 demande d'abord l'arbitrage de
`product-owner`, et L2GS-3 fait passer L2FS-9 de « plus tard » à « avant production » dans `21` §8. L2GS-5 à L2GS-8 vont au
reliquat, L2GS-8 avant le Lot 3. Aucun constat n'ouvre de ligne `fix` dans `run.md`.

ETAT : 0 bloquant · 0 à corriger dans le jalon · 4 avant production · 4 plus tard.
