# L2F — constats `expert-cybersecurite` (revue de fin de jalon)

> 2026-11-11 · plage `c4d21dc..HEAD` (27 commits, `ad25616` à `fd92d71`), diff fichier par fichier, migrations `0228` à
> `0240` lues en entier sur les chemins sensibles · aucun fichier modifié hors celui-ci · gravités : bloquant · à corriger
> dans le jalon · avant production · plus tard. **Aucun bloquant ; un « à corriger dans le jalon » (L2FS-1).**

## Constats

| # | Gravité | Fichier:ligne | Constat (scénario, impact) | Correctif |
|---|---|---|---|---|
| L2FS-1 | à corriger dans le jalon | `supabase/migrations/0228_verification_observed_handle_match.sql:235-237` ; `0224_verification_claims_and_decisions.sql:1589-1591` ; comparer `0234_verification_agent_opening.sql:1166-1171` ; `l2f/modele.md` §4 l. 42 | D83 Q4 n'est acceptée que **sous second regard a posteriori**, et ce second regard se lit au registre (Q3). Or seule `grant_brand_verified_by_login` écrit `channel`, `agent_opened`, `responsible_agent` sur `verification.granted` ; `grant_account_verified` (créateur, voie normale de Q4) et `grant_brand_verified` (`TXT` ou page) gardent `{level, badge_id, late}`, contre `modele.md` §4 (« Repris : `granted` (+ `channel`, `agent_opened`, `responsible_agent`) »), qui prime sur le prompt 09 (« ne pas toucher aux octrois »). Scénario : le commercial responsable ouvre la demande de son client créateur, la prend et accorde « Compte vérifié » en tapant le code ; la ligne du registre ne dit ni que la demande venait d'un agent ni que le décideur détenait le compte, et `owner_agent_id` est modifiable ensuite. Impact : l'indicateur de Q3 ne peut pas retrouver de façon fiable les accords donnés par un commercial à son propre client ; la contrepartie de Q4 n'existe pas. | Migration `0241` qui recrée ces deux octrois à l'identique plus `channel` (`network`, `dns_txt`, `web_page`), `agent_opened` (`opened_by = 'agent'`) et `responsible_agent` (`owner_agent_id = appelant` lu à la décision) dans `verification.granted` (et `verification.rejected`, par symétrie), cas base qui lit ces clés ; marqueur I-4 propre ; 0,25 j. |
| L2FS-2 | avant production | `0234:873-878`, `0234:1166-1171` ; `l2f/modele.md` §6 (Q3 : « indicateur Lot 6bis ») ; `CLAUDE.md` §10 (ouverture au Lot 6, 6bis après) | Le second regard de Q3 n'a aucun mécanisme avant le Lot 6bis, qui suit l'ouverture de `production` (Lot 6). Un commercial peut ouvrir, prendre et accorder seul (créateur : code qu'il déclare avoir lu ; marque : immatriculation qu'il a lui-même saisie dans le bloc interne), et rien ne le montre à un administrateur. Impact : badge de complaisance affiché aux annonceurs ; D83 (10) : « un seul faux rend douteux tous les autres ». | Avant `production` : liste hebdomadaire au backoffice, sur le patron de PD6 (`degradedConfirmationsByWeek`), des accords `responsible_agent = true` ou `agent_opened = true` (après L2FS-1), revue tracée par un administrateur ; l'indicateur RG du Lot 6bis peut suivre ; 0,5 j. |
| L2FS-3 | avant production | `0234:233-242` (liste), `0234:624-655` (`login_address_ineligibility`), `0234:1107-1112` ; `l2f/modele.md` §6 A-bis (« Toute demande de marque ») ; D83 (1) | A-bis tient sur la liste des messageries grand public : le domaine du site déclaré doit être celui (ou le parent) de l'adresse de connexion. 45 entrées laissent passer les marques dont **le domaine du site distribue aussi des boîtes gratuites** : variantes régionales (`yahoo.co.uk`, `yahoo.co.jp`, `yahoo.de`, `hotmail.co.uk`, `outlook.de`, `live.co.uk`…), portails et FAI (`sky.com`, `virginmedia.com`, `wp.pl`, `onet.pl`, `interia.pl`, `o2.pl`, `rambler.ru`, `ukr.net`, `uol.com.br`, `terra.com.br`, `sina.com`, `sohu.com`, `daum.net`, `kakao.com`, `freenet.de`, `tuta.com`, `protonmail.ch`, `gmx.at`, `gmx.ch`…) et jetables (`yopmail.com`, `mailinator.com`). Scénario : un tiers ouvre une boîte gratuite `@sky.com`, s'inscrit comme marque, site `sky.com`, raison sociale et numéro publics de Sky UK Limited (registre gratuit) ; le dossier affiche `login_address_eligible = true`, l'agent constate l'immatriculation (exacte) et accorde « Marque vérifiée » sans geste de la marque. Impact : usurpation d'un grand annonceur avec le badge, campagnes frauduleuses vers les créateurs (contenus, hameçonnage) ; probabilité faible à moyenne, conséquence lourde. Aggravant : `modele.md` §6 ouvre A-bis à **toute** demande de marque, alors que D83 (1) le cadrait pour une marque **connue** du commercial (adresse connue par un canal antérieur, « jamais sur la seule déclaration du compte »). | (a) Remplacer la liste par une liste publique maintenue des domaines de messagerie gratuite et jetable (plusieurs milliers d'entrées, chargée par migration, mise à jour trimestrielle tracée) ; (b) réserver `grant_brand_verified_by_login` aux demandes où un agent a engagé D83 (`opening_reason_code is not null`), sinon `login_address_ineligible` DETAIL `not_agent_opened` ; (b) amende `modele.md` §6 : arbitrage du fondateur si refusé, risque exposé ci-dessus ; 0,5 j + 0,1 j. |
| L2FS-4 | avant production | `0228:169-179` (`grant_account_verified`), `0232:1617-1627` (`overturn_refusal_account`), `0233:1279-1286` (`confirm_identifier_change`), `0234:1006-1016` (alerte du dossier) ; EC-L2F-08-10 | **Réponse à EC-L2F-08-10 : oui.** Le cas limite l. 800 (« le premier constat gagne, le second est refusé et les deux escaladés ») ne compare que `observed_handle_at_decision`, jamais le handle confirmé en file 6. A tient « Compte vérifié » sur `@ancien`, renomme en `@nouveau`, l'agent confirme « même compte » (constat sur l'entrée, badge inchangé). B, autre compte, déclare `@nouveau` et publie le code dans la bio : son octroi passe sans refus ni escalade (sauf si la référence stable `observed_platform_account_ref` a été saisie aux deux constats). L'inverse vaut aussi : la confirmation de A vers un handle confirmé chez B n'est pas vue. B doit maîtriser le compte : compte doublon de la même personne, compte cédé (A garde un badge sur un compte qui n'est plus le sien, motif `owner_changed` jamais déclenché), agence co-gestionnaire. Impact : deux profils « Compte vérifié » sur un même compte de réseau, doublons d'audience présentés aux marques, cession non détectée. L'alerte du dossier normalise en outre autrement (`lower(ltrim(…, '@'))`, sans `btrim`) que `normalize_handle()`. | Une fonction invoker `verification.verified_handle_of(badge_id)` = dernier `observed_handle` `confirmed` de la file 6, sinon `observed_handle_at_decision`, utilisée par les quatre comparaisons (et l'alerte, par `normalize_handle()`) ; cas base « handle confirmé chez A, octroi de B refusé et escaladé » ; 0,5 j. |
| L2FS-5 | avant production (rehausse L2DS-7) | `0233:519-549`, `0233:566-572` (déclencheur), `0233:873-891` (jeton), `0233:588-594` ; `0136` (`audit.append`, verrou global de chaîne) ; L2DS-7 | L'autosave du handle, sans limite de débit (L2DS-7), atteint désormais des données partagées : sur une ligne qui tient « Compte vérifié », **chaque** changement normalisé écrit une ligne au registre (`identifier_changed` ou `identifier_change_withdrawn`), sous le verrou global de la chaîne, dans un registre en ajout seul et non purgeable ; et chaque écriture de la ligne (handle, pseudonyme, URL) change le jeton de l'entrée. Scénario : un créateur malveillant scripte l'alternance `@celebrite` / `@celebrite_` : (1) des millions de lignes par jour au registre, contention du verrou de chaîne pour toutes les écritures journalisées de la plateforme ; (2) chaque décision de l'agent, y compris « preuve exigée », répond `stale_token` : le badge reste `active` sur un handle non contrôlé tant que dure le script (seul recours : retrait sous 2V). | Limite par compte sur les routes d'écriture membres (L2DS-7, avant `production` et non plus Lot 6) ; dans le déclencheur, aucune ligne de registre pour une mise à jour d'entrée déjà ouverte depuis moins de 10 min (compteur seul) ; `require_identifier_proof` (issue sûre) n'exige pas un jeton à jour quand seuls `new_handle`, `change_count`, `last_changed_at` ou la ligne ont changé ; 0,5 j. |
| L2FS-6 | plus tard | `0232:509` ; `0233:349` | `influx_agent` et `influx_admin` lisent **toutes** les colonnes de `verification.disputes` (texte du créateur, message, commentaire interne, décideurs) et de `verification.identifier_change_reviews` (ancien, nouveau et handle constaté, commentaire) en `aal2`, hors verrou et pour un compte qu'ils détiennent ; « lus par le seul détenteur du verrou » n'est tenu que par le code d'`apps/api`. Les listes n'en lisent que des métadonnées (vérifié). Impact : une route future ou une régression d'`apps/api` sert ces textes sans base pour l'en empêcher. | Droits colonne par colonne sur ces deux tables pour les rôles agent (colonnes des listes et compteurs), les textes et handles par les seules fonctions `SECURITY DEFINER` qui exigent le verrou ; `expected-rights.ts` ajusté ; 0,25 j. |
| L2FS-7 | plus tard | `0232:838-853`, `0232:992-996` | « Autre personne » compte tout compte interne actif hors décideurs, y compris le commercial qui **détient** le compte du créateur, lui-même refusé (`lock_held_dispute`). Équipe de deux (décideur + détenteur) : le décideur est refusé `reviewer_is_decider`, le détenteur `forbidden`, la contestation reste ouverte sans issue. Disponibilité, pas confidentialité. | Exclure de `dispute_other_reviewer_exists()` le `owner_agent_id` du compte contesté (paramètre ajouté) ; cas base ; 0,1 j. |
| L2FS-8 | plus tard | `0130_backoffice_alerts_and_dual_control.sql:750-766` ; `0231:583-605` | Forme dégradée du retrait : un administrateur seul demande puis confirme `verification.revoke_badge` dès qu'aucun **autre administrateur** n'existe (PD7), même si un agent actif pourrait être la seconde personne (l'agent peut désormais demander). Écrit `degraded_single_operator` et lu en PD6 : risque accepté, mais évitable pour cette action. | Pour `verification.revoke_badge` seulement, refuser la confirmation dégradée tant qu'un agent actif autre que le demandeur existe (l'administrateur fait demander l'agent et confirme) ; 0,1 j. |
| L2FS-9 | plus tard (avant toute écriture interne du handle, L2G ou Lot 5) | `0233:510-517`, `0233:1611-1629` | `track_identifier_change()` échoue **ouvert** : il ne voit le badge que par la politique de son propriétaire (`account_id = current_account_id()`, EC-L2F-19-1). Si un rôle interne écrit un jour le handle d'une ligne (correction d'agent), le badge reste `active` sur un handle non contrôlé, sans entrée en file 6. Aujourd'hui tenu par l'assertion de fin de `0233` et par T2 (`expected-rights.ts`, I-4) ; une fonction `SECURITY DEFINER` d'un autre propriétaire ne serait vue que si elle reçoit le droit. | Faire échouer fermé : hors `influx_privacy_definer`, `new.account_id <> influx.current_account_id()` lève 42501 dans le déclencheur ; cas base ; 0,1 j. |

## Points vérifiés (section « Pour `expert-cybersecurite` »)

- **02, 03, 05 à 10 (et 0236 à 0240).** Sept tables neuves (`badge_revocation_requests`, `disputes`,
  `dispute_reasons`, `dispute_outcome_reasons`, `identifier_change_reviews`, `opening_reasons`, `consumer_email_domains`) :
  RLS activée **et forcée**, `revoke all` de `public`, `anon`, `authenticated`, `service_role` et des quatre rôles
  métier, assertion de fin. Analyse des 71 fonctions créées ou recréées : `set search_path = ''` partout, `SECURITY DEFINER`
  sur chaque porte, aides invoker sans `EXECUTE`, **aucun `execute` dynamique dans un corps** (seuls les blocs `do` de
  migration en portent). Rien pour `influx_advertiser` sur `verification` (`USAGE` compris, assertion de `0238`) ; seules
  exceptions, hors `verification` : `profiles.read_badge_grace_days()` (`0237`) et `read_badge_reminder_days()` (`0240`),
  un entier de réglage pour un compte membre actif, ni compte, ni badge, ni pièce, ni `storage.` : conformes à T9.6, à
  inscrire sous L2DS-5 (propriétaire `influx_identity_definer`).
- **2V.** `open_dual_control_for()` n'ouvre que `verification.revoke_badge`, charge exactement `{account_id, badge_id,
  reason_code}` reconstruite depuis la ligne du badge par `request_badge_revocation()` (badge verrouillé, compte propre et
  détenu refusés), une 2V vivante par badge ; `EXECUTE` des trois enveloppes à `influx_verification_definer` **seul**,
  aucun droit de celui-ci sur `dual_control_requests` ; `canonical_dual_control_payload()` diffère de `0141` par les seuls
  PLT-5/PLS-5 (diff vérifié) et refuse l'action à la porte admin ; `consume_dual_control_for()` : administrateur actif, R
  liée à la session de la requête, puis `consume_dual_control()` (charge comparée entière, motif, `confirmed`/`degraded`,
  non expirée, consommée une fois, par son confirmeur). L'agent ne confirme jamais (`require_active_admin`) ; confirmation
  et exécution dans la même transaction (`confirmAndExecute`), un refus de `revoke_badge` (compte détenu par le confirmeur)
  annule la confirmation. PLS-6 : `brevo_*_ids` typés strictement. PLT-5, PLS-5, PLS-6 fermées.
- **Contestation (file 5).** `submit_own_dispute()` : compte du contexte, créateur actif, décision du seul appelant
  (42501 sinon, identique à l'inconnu), refus `rejected` ou retrait sous 2V du badge nommé, fenêtre depuis `decided_at`
  ou `revoked_at`, une par décision (clés uniques). Décideurs figés au dépôt ; `gate_dispute_decision()` refuse le
  décideur tant qu'une autre personne existe (bris de glace exclu), sinon 24 h depuis le dépôt, `review_mode` écrit ;
  `read_dispute_evidence()` : verrou, pièce `active` de la demande refusée seulement, `evidence_viewed` dans la
  transaction. Files 5 et 6 : `require_agent()` (`aal2`, profil actif), verrou atomique, jeton de version, compte propre
  et détenu en 42501 (`lock_held_dispute`, `lock_held_identifier_change`), journalisé par l'API (`unlessHeld`). Limite :
  L2FS-7.
- **Déclencheur de la file 6.** Propriétaire `influx_creator_verification_definer`, aucun `EXECUTE`, exclu sous
  l'effacement ; une entrée ouverte par ligne (index partiel) ; handles jamais au registre (charges : `network_code`,
  `change_count`, `cause`, `badge_id`), jamais en `outbox`, jamais servis aux membres ni à `influx_leads_definer`
  (colonnes `0236` vérifiées) ; dossier au seul détenteur du verrou (`lock_held_identifier_change`). Abus : L2FS-5 ;
  échec ouvert : L2FS-9 ; droits agent : L2FS-6.
- **D83 (A).** Un compte, une ligne, un niveau par appel ; « Audience vérifiée » refusée ; motif fermé, commentaire jamais
  au registre ni à l'e-mail ; origine figée par `freeze_request_opening()` (passage `member` → `agent` sur le seul
  brouillon créé dans la transaction) ; e-mail `agent_opened_notice` ; registre `opened_by_agent` avec `taken_over` et
  `responsible_agent`. **Q4 (EC-L2F-09-1)** : la levée du refus `owner_agent_id` ne vaut que pour `opened_by = 'agent'`
  (`lock_held_request`, `open_request`, masques et `unlessHeld` d'`apps/api`, cohérents) ; une demande de membre reprise
  garde le refus : **plus strict** que `modele.md` §6 (« quand `opening_reason_code` est posé ») et approuvé tel quel.
  Files 5, 6 et retrait refusent toujours le compte détenu (vérifié). Conflit d'intérêts : le commercial responsable peut
  ouvrir et accorder seul ; acceptable sous L2FS-1 et L2FS-2. **Cohérence à rétablir en clôture** : la fiche (invariant 9)
  et `l2f/09.md` disent « détenu refusé » à l'ouverture alors que le code et `modele.md` §6 ne le refusent pas ;
  l'amendement de `15` RG36 doit décrire le code (ouverture permise sur un compte détenu ; décision permise au détenteur
  pour `opened_by = 'agent'` seulement).
- **A-bis, avis demandé par D83.** *Force de la preuve* : (+) le domaine est constaté **par la base**, pas déclaré par
  l'agent : à l'abri de la complaisance, contrairement au `TXT` ou à la page que l'agent dit avoir lus ; (+) l'adresse
  est reprouvée à chaque connexion (code à 6 chiffres) et un changement d'adresse exige deux codes (`0118`), une
  correction d'agent remet `email_verified_at` à nul (`0104`) ; (−) une boîte du domaine prouve l'appartenance, pas
  l'autorité (salarié, prestataire, alias partagé : risque accepté par D83) ; (−) liste trop courte et portée trop large :
  L2FS-3. *Domaines grand public* : sous-domaines d'une messagerie refusés, ordre `unverified` → `consumer_domain` →
  `other_domain` correct, domaine du site ou parent seulement (jamais l'inverse). *Adresse jamais exposée* : tenu.
  `identity.login_domain_of()` (`EXECUTE` à `influx_verification_definer` seul) rend le domaine, jamais l'adresse ;
  `login_address_ineligibility()` sans `EXECUTE` ne rend qu'une classe ; dossier : un booléen ; refus : la classe en
  DETAIL ; registre : `channel` ; constat : `observed_domain` = domaine du **site** ; aucun fichier d'`apps/api` ne lit
  l'adresse sur ces chemins (recherche faite). **Avis : favorable pour `production` sous L2FS-3.**
- **Lectures `read_*` de `0236` à `0240`.** `leads.read_brevo_badge_email()` et `read_brevo_verification_email()` :
  `EXECUTE` à `influx_worker` seul, colonnes nommées, politiques bornées aux comptes non effacés, jamais handle, texte du
  créateur, décideurs, verrou ni commentaire ; `read_badge_grace_days()`, `read_badge_reminder_days()` : voir plus haut ;
  `read_own_contestable_decisions()` : `influx_creator` seul, ses décisions, message de retrait (destiné au membre),
  jamais décideur, agent, verrou ni échéance ; `read_account_openings()` : agent et admin `aal2`, booléens pour la marque,
  jamais handle ni commentaire. Rien à `anon`, `authenticated`, `public` (assertions de fin relues).
- **Sorties.** Registre : 58 appels `audit.append` relus, ni handle, ni texte, ni chiffre (les clés `name`, `url` de `0229`
  sont celles d'un registre public) ; `outbox` : identifiants et `email_code` seuls ; e-mails : message de l'agent échappé
  (`escapeHtml`), lien refusé au rendu et en entrée (RG19, `direct_contact`) ; Brevo : `VERIFIED_LEVEL`, `VERIFIED_AT` ;
  Apollo : rien. Liens de profil du backoffice par `profileLinkOf()` (https, autorité simple, L2DS-1), `noopener`.
- **Effacement et export (`0235`).** Effacement dans la transaction de `execute_request()` : textes des retraits, des
  contestations (trois) et des entrées de la file 6 (quatre, handles compris) vidés, `opening_comment` vidé, ouvertes
  `withdrawn` `account_erased`, verrous levés, aucune ligne au registre ; politiques `influx_privacy_definer` bornées au
  compte `deleted` et à la ligne vidée. Export : données du seul demandeur, jamais décideurs, verrou, échéances,
  `review_mode` ni commentaire. Pour `expert-conformite-rgpd` (Lot 6) : l'export omet `previous_handle` et
  `observed_handle` (EC-L2F-10-2), données de la personne : choix de droit, pas de sécurité.
- **API et écrans.** Routes neuves en `strictObject`, compte de la session, badge lié au compte du chemin (404 sinon),
  refus de base traduits sans valeur ; aucun `sql.raw`, `innerHTML`, stockage navigateur ni `NEXT_PUBLIC` ajouté.

## Signatures `03` P7 (à reporter mot pour mot en clôture, lignes des propriétaires)

- `influx_verification_definer`, clause L2F (`0228` à `0234`, `0239`) : octrois recréés (handle constaté comparé au
  déclaré par `verification.normalize_handle()`, IMMUTABLE invoker) ; `add_registry_source()` (admin) ; retrait :
  `request_badge_revocation()`, `read_badge_revocation()` (admin), `revoke_badge()` (admin, 2V consommée par
  `backoffice.consume_dual_control_for()`), `read_account_badges()` ; files 5 et 6 (prise, relâche, prolongation, levée
  admin, dossiers, pièce journalisée, décisions) et déclencheurs `withdraw_superseded_disputes()`,
  `withdraw_identifier_reviews()`, `guard_audience_identifier()`, `restore_reconfirmed_audience()` (aucun `EXECUTE`) ;
  D83 : `open_request_for_member()`, `grant_brand_verified_by_login()`, `read_request_dossier()`, `lock_held_request()`
  et `open_request()` recréées (Q4 : `opened_by = 'agent'` seul) ; `read_account_openings()`. `EXECUTE` à `influx_agent`
  et `influx_admin`, l'appelant contrôlé dans la fonction. Droits nommés : demandes de retrait (écriture, exécution
  unique), badges (retrait, `to_reconfirm`, audience rendue, `dispute_id`), contestations et entrées (verrou, décision),
  brouillon d'ouverture, codes (émission, révocation), bloc interne de la marque (insertion), messageries, motifs,
  `EXECUTE` des trois enveloppes 2V et de `identity.login_domain_of()`. Politiques écartant le compte de l'appelant ;
  rien pour un membre. **Signé** par `expert-cybersecurite` le 2026-11-11, revue de fin de L2F, sous L2FS-1 à L2FS-4.
- `influx_creator_verification_definer`, clause L2F (`0232`, `0233`, `0238`) : `submit_own_dispute()` et
  `read_own_contestable_decisions()` (`EXECUTE` à `influx_creator` seul, compte du contexte) ; déclencheurs
  `track_identifier_change()` et `withdraw_entries_of_line()` (aucun `EXECUTE`, exclus sous l'effacement) ; droits bornés au
  compte de la session : insertion d'une contestation, entrées de la file 6 (ouverture, mise à jour, retrait),
  `observed_handle_at_decision`, motif et message d'un retrait ; `EXECUTE` de `normalize_handle()`. **Signé** le
  2026-11-11, sous L2FS-5 et L2FS-9.
- `influx_identity_definer`, clause L2F (`0229`, `0231`, `0234`, `0237`, `0240`) : `record_refused_action()` recréée (deux
  codes, conflit d'intérêts de l'administrateur) ; `canonical_dual_control_payload()` (PLT-5, PLS-5) ; enveloppes
  `backoffice.open_dual_control_for()`, `consume_dual_control_for()`, `dual_control_status_for()` (`verification.revoke_badge`
  seule, `EXECUTE` à `influx_verification_definer` seul) ; `identity.login_domain_of()` (lecture de
  `email_verified_at`, domaine seul, `EXECUTE` à `influx_verification_definer` seul) ; `profiles.read_badge_grace_days()`,
  `read_badge_reminder_days()` (`EXECUTE` à `influx_creator` et `influx_advertiser`, deux clés de réglage de plus).
  **Signé** le 2026-11-11, sous L2DS-5.
- `influx_maintenance_definer`, clause L2F (`0230`, `0235`) : `ops.run_badge_lifecycle()` et
  `ops.purge_verification_findings()` (`EXECUTE` à `influx_worker` seul, run `badge_lifecycle` ouvert de la tentative,
  500 par appel) : `to_refresh`, `expired`, rappel, ligne publique, file ; à `findings_retention_days` : pièces `purged`
  et codes supprimés, constats et textes vidés sur lignes closes, jamais lus. **Signé** le 2026-11-11.
- `influx_leads_definer`, clause L2F (`0230`, `0236`) : `leads.read_verified_badge()` recréée, `read_brevo_badge_email()`,
  `read_brevo_verification_email()` recréée (`EXECUTE` à `influx_worker` seul) ; colonnes nommées des retraits,
  contestations, entrées de la file 6 et de deux réglages, comptes non effacés ; jamais handle, texte du créateur,
  décideurs, verrou ni commentaire. **Signé** le 2026-11-11.
- `influx_privacy_definer`, clause L2F (`0235`) : export (origine D83 sans agent ni commentaire, message de retrait,
  contestations, nouveaux handles) et effacement des trois tables neuves et de `opening_comment`, sur un compte effacé
  seulement, ligne vidée seule. **Signé** le 2026-11-11.

## Attestation (commit séparé de clôture, `git commit --allow-empty -F <fichier>`)

À commiter en clôture : aucun bloquant ne reste. Le correctif de L2FS-1 (migration `0241`) porte **son propre**
marqueur `security-reviewed:` après relecture courte par `expert-cybersecurite` ; il n'est pas couvert ici.

```
chore(security): attest the end-of-L2F review

Group review of 2026-11-11 (expert-cybersecurite) over the L2F milestone
(c4d21dc..fd92d71), no blocker; findings L2FS-1 to L2FS-9 in
docs/mvp/jalons/l2f/revue-constats-securite.md (L2FS-1 fixed by its own
commit). 0228 to 0240: seven new tables with RLS enabled and forced, all
revoked from PUBLIC, the Data API roles and the business roles; every
function with an empty search_path, no dynamic SQL in any body, nothing
for influx_advertiser on verification (two settings reads in profiles,
T9.6 kept). The agent door of the 2V opens verification.revoke_badge only,
its payload rebuilt from the badge row, the three wrappers executable by
influx_verification_definer alone; consumption once, by the confirmer,
under R. Queues 5 and 6: claim, version token, aal2, own and held account
refused; the contested decider excluded or delayed 24 h. D83 Q4 lifted for
opened_by = agent only. A-bis: the login address never leaves the base.
Erasure empties every L2F text in one transaction. 03 P7 signed for
influx_verification_definer, influx_creator_verification_definer,
influx_identity_definer, influx_maintenance_definer, influx_leads_definer
and influx_privacy_definer (L2F clauses).

security-reviewed: 2026-11-11
security-reviewed: 2026-11-11 covers 8984b3997248d60a14819ca3e0514b1f1fd07dd8 0bd9ab934732a97d88c2f9692fe173f69aa16493 344eea57fe611bae3e7f38d3111b40ad63064d8e a41d32d7912708a76689b1ecd124171873cf2908 19663507587c33b1b27c3ece3cd00dc8c38a37f6 423cb610c112f894b26d7bc622374b69fc5a921a 34de14371ae976dcdbe3de5819cf50599d5f4530 19d9dc47d636209f19b8c6e6f14f15770277c7b2 1090aa837df74b8adb1e14a4a2b7310ae2035db0 cf6529e85ed47defb4f5da8578dc236db55adc66 2f4259b339208ac4ea92a7dafa01d3c70604baf7 c9aa3cc5abb19e326aa20d0a30ac41e07e287658 b57d31bc3458ba5931b4fa8b0bef96c50e617e5d
```

(Ligne d'attribution de la session qui commite, après.) `node packages/test-kit/scripts/check-security-review.ts c4d21dc
HEAD` relève exactement ces treize commits, ceux que donne `git log --format='%h %s' c4d21dc..HEAD -- supabase/migrations` :
`8984b39` (`0228`), `0bd9ab9` (`0229`), `344eea5` (`0230`), `a41d32d` (`0231`), `1966350` (`0232`), `423cb61` (`0233`),
`34de143` (`0234`), `19d9dc4` (`0235`), `1090aa8` (`0236`), `cf6529e` (`0237`), `2f4259b` (`0238`), `c9aa3cc` (`0239`),
`b57d31b` (`0240`). Aucun autre commit de la plage ne touche un fichier sous I-4 (workflows, `expected-rights` hors ces
commits, relais, `config.toml`).

ETAT : revue sécurité L2F faite ; 0 bloquant, 1 à corriger dans le jalon (L2FS-1), 4 avant production (L2FS-2 à
L2FS-5), 4 plus tard (L2FS-6 à L2FS-9) ; avis A-bis favorable sous L2FS-3 ; EC-L2F-08-10 confirmé (L2FS-4) ; attestation
prête ; livraison en `production` autorisée sous condition de L2FS-1 à L2FS-5.
