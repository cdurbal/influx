# L2C — constats `expert-cybersecurite` (revue de fin de jalon)

> 2026-11-05 · plage `e177d7d..HEAD` (27 commits, `1ceb507`), diff fichier par fichier · aucun fichier modifié hors
> celui-ci · gravités : bloquant · à corriger dans le jalon · avant production · plus tard. **Aucun bloquant.**

## Constats

| # | Gravité | Fichier:ligne | Constat (scénario, impact) | Correctif |
|---|---|---|---|---|
| L2CS-1 | à corriger dans le jalon | `supabase/migrations/0210_profiles_brand_review_decisions.sql:541-546, 600` ; `apps/api/src/domains/backoffice/queues-routes.ts:370-372` | Jeton et vue de décision lus dans deux instantanés `read committed` successifs, sans verrou du profil à l'ouverture ; A3 (`file.md` l. 27) exige `repeatable read`, absent d'`apps/api`. « Vue jamais plus ancienne que le jeton » ne couvre pas l'ABA : sur une entrée `submission` (écriture directe en `pending_review`), une marque qui alterne P1 et P2 par `PATCH` peut obtenir jeton = P1, vue = P2, puis une décision acceptée sur P1, que l'agent n'a jamais vu (invariant 4, L2BS-1). Probabilité faible (fenêtre de quelques ms, script, agent inattentif) ; impact borné au L2C (aucun profil publié n'est encore servi aux créateurs, Lot 3), réel ensuite. | Dans `open_advertiser_review_entry`, lire le compte de l'entrée puis verrouiller la ligne du profil `FOR UPDATE` avant l'entrée (ordre de `publish`, `reject` : pas d'interblocage), pour qu'aucune écriture membre (ligne du profil, ou `FOR SHARE` du déclencheur sur listes, interlocuteur, logos) ne s'intercale entre jeton et vue ; test db : écriture membre en attente tant que la transaction d'ouverture vit. 1 migration, 0,5 j. |
| L2CS-2 | avant production | `0210_profiles_brand_review_decisions.sql:547, 847, 1091` ; `0213_profiles_brand_logo_agent_read.sql:91` ; `apps/api/src/domains/backoffice/queues-decision-routes.ts:183-192` ; `queues-routes.ts:365` ; `queues-logo-routes.ts:76` ; `queues/repository.ts:247` | RG36 (compte **détenu**, `owner_agent_id`) tenu par la route seule ; la base ne refuse que le compte propre (C(3) strict, sans objet pour un compte interne). Un oubli de `conflictChecked` dans une route future suffit pour qu'un commercial publie le profil de son propre client : un seul contrôle sur un chemin critique ; la tentative refusée ne laisse qu'une ligne pino, aucune trace nominative au registre. | Refuser en 42501 dans `open` (hors `closed`), `publish`, `reject`, `extend` et `read_advertiser_review_logo` quand `identity.accounts.owner_agent_id = v_caller` (`SELECT (owner_agent_id)` à `influx_moderation_definer`), la route gardant son 403 `conflict_of_interest`, et journaliser le refus par `backoffice.action_refused` (code dédié). Avec L2CS-1, 0,5 j. |
| L2CS-3 | avant production | `supabase/migrations/0203_profiles_advertiser_submission.sql:90` ; `0122_identity_member_account.sql:213-217` ; `0209_profiles_brand_freeze_and_revision_door.sql:708-754` | RG6 au niveau base : `influx_identity_definer` détient `UPDATE (status)` sur sa ligne sans `WITH CHECK` sur la valeur, et le déclencheur ne contrôle pas la transition d'état ; seule la rédaction des portes membres empêche une marque d'atteindre `published`. Invariant 1 (« aucun membre n'exécute la transition ») tenu par le code, pas par un droit. | Étendre `guard_advertiser_member_write()` : sous `influx_advertiser` ou `influx_identity_definer`, refuser (55000) tout changement de `status` vers une autre valeur que `pending_review` ; test « membre vers `published` refusé ». Avec L2CS-1, 0,25 j. |
| L2CS-4 | plus tard | `0209_profiles_brand_freeze_and_revision_door.sql:250-292` ; `queues-decision-routes.ts:126-134` | La porte `submit_own_advertiser_revision` (EXECUTE `influx_advertiser`) ne contrôle que type et obligatoire ; forme et longueur des colonnes ne s'appliquent qu'à l'approbation. Une valeur déposée hors API (8 000 octets, domaine mal formé) rend l'entrée impubliable (23514 sans code de champ, donc 500) : défense en profondeur seulement, l'API valide avant. | Appliquer à la porte les contraintes de la colonne cible (domaine RG17, bornes de `presentation`, `contact_role`, code de secteur actif), 22023 sinon. 0,25 j. |
| L2CS-5 | plus tard | `apps/api/src/domains/backoffice/queues-decision-routes.ts:263-270` ; `apps/api/src/domains/leads/connectors/brevo/mapping.ts:84-85` | Le message « Autre » est filtré par `detectDirectContact`, plus étroit que le `LINK_PATTERN` du contrôle de sortie (`logo.Merci`, `@` isolé) : refus validé, e-mail ensuite refusé par RG158, marque non prévenue par e-mail. RG158 tient (échec fermé) ; défaut fonctionnel. | Refuser à la route, en 400, tout message que `LINK_PATTERN` refuserait (motif exporté et partagé). 0,1 j. |
| L2CS-6 | plus tard | `queues/repository.ts:83, 341-346` ; `0210_profiles_brand_review_decisions.sql:420-452` | `advertiser_duplicate_candidates()` est évaluée par ligne listée (jusqu'à 2 000 avec le filtre d'alerte), par deux balayages des profils publiés et `normalized_brand_name()` recalculée à chaque ligne : coût quadratique pour un interne authentifié, borné par le `statement_timeout` de 15 s d'`influx_app`. | Index d'expression `normalized_brand_name(legal_name)` et `lower(website_domain)` `where status = 'published'` avant le Lot 3. 0,25 j. |
| L2CS-7 | plus tard | `0209_profiles_brand_freeze_and_revision_door.sql:375-404` ; `apps/api/src/domains/profiles/brand-profile.ts:431` | Chaque enregistrement d'un champ immédiat d'un profil publié émet un `lead.updated` vers Brevo et Apollo, sans regroupement par sujet ni plafond par compte (même classe que `update_own_account` depuis le Lot 1) : un script membre consomme les quotas externes partagés. | Ne traiter que la dernière ligne `lead.updated` en attente d'un même `(subject_key, destination)` (la base est la source) ou plafonner par compte. 0,5 j. |
| L2CS-8 | plus tard (L2E) | `0212_leads_brand_profile_attributes_read.sql:14-16` ; `apps/api/src/domains/leads/connectors/apollo/mapping.ts:75-77` | `organization_name` d'Apollo vient de la colonne `legal_name`, qui porte le nom commercial jusqu'à L2E (EC-L2C-3) ; si L2E y range la raison sociale, RG80 serait violée sans changement de code. | En L2E, faire lire le nom commercial par sa propre colonne et ajouter un test RG80 sur `organization_name`. Au L2E. |

## Vérifié sans constat

- **RLS et droits** (`0206` à `0214`) : RLS activée et forcée sur les six tables neuves ; `REVOKE ALL` à `public`, `anon`,
  `authenticated`, `service_role` ; aucun rôle d'exécution n'écrit les tables de la file ; marque sans verrou, agent,
  échéances ni `internal_comment` (assertion de fin `0207`) ; `SECURITY DEFINER` en `search_path = ''`, propriétaires et
  appelants assertés en fin de migration ; aucun membre ni `CREATE` laissé aux définisseurs ; T2 complétée (`expected-rights.ts`).
- **`influx_moderation_definer`** : `NOLOGIN NOINHERIT`, sans attribut ni membre ; droits colonne par colonne ; politiques
  `WITH CHECK` (`status in ('published','rejected')`, révisions `approved`/`rejected`, logo `active`/`purging`, file à
  `priority = 100` et couples type/destination fermés) ; appelant vérifié (`require_review_agent` : actif, rôle, profil
  d'agent actif, `aal2`) ; levée forcée admin en base et en route, tentative d'agent journalisée et validée avant le 403.
- **Gel L2BS-1** (`0209`) : déclencheur sur les onze tables, sous `influx_advertiser` et `influx_identity_definer` ; aucun
  autre rôle atteignable par un membre n'écrit ces tables (droits relus de `0106` à `0214`) ; logo actif immobile en
  `published` ; `suspended` refuse tout (pays du compte excepté, EC-L2C-06-7, accepté) ; décision : profil `FOR UPDATE`
  puis entrée, jeton recalculé, obligatoires recontrôlés par `advertiser_missing_required_fields`.
- **RG6** : seules les fonctions d'`influx_moderation_definer`, `EXECUTE` à `influx_agent`/`influx_admin`, publient ;
  aucune tâche ni délai (C(20) amendé) ; `0214` n'écrit qu'une entrée par profil `pending_review`, ni état, ni file, ni droit.
- **Journal (D60)** : `queue.entry_opened` à chaque ouverture, toute issue, avant la vue qui porte l'interlocuteur
  (L2BS-7) ; fiche couverte par `history.account_read` ; `queue.logo_read` {`queue_code`, `logo_id`, `state`} ; aucune
  valeur, clé d'objet, message ni commentaire au registre ; erreurs base journalisées sans `DETAIL` (`serializeError`).
- **Sorties** : schémas zod stricts sur chaque route ; inconnu, propre compte, logo d'autrui : même 404 ; page ≤ 50,
  curseur opaque validé ; `no-store` partout ; route logo sans hôte Supabase, jeton ni clé (objet relu sous la clé de la base).
- **Leads et e-mail** : charges réduites aux identifiants ; `read_brevo_profile_decision` lié au compte de la ligne et au
  worker titulaire, jamais `internal_comment` ; `read_brand_profile_attributes` sans raison sociale, présentation ni
  interlocuteur ; Brevo sans domaine, Apollo `website_url` en liste fermée ; consentement relu (`no_consent`) ; message
  « Autre » échappé par `escapeHtml`, aucun gabarit Brevo.
- **`ci.yml` (14a)** : `permissions: contents: read` hérité ; `upload-artifact` v7.0.2 et `download-artifact` v8.0.2
  épinglés, SHA vérifiés contre les étiquettes ; `persist-credentials: false` ; artefacts du même run, rétention 1 jour,
  aucun secret dans l'environnement e2e, dépôt privé ; `migrate-staging` et `migrate-production` attendent `e2e-merge`,
  donc les deux éclats.

## Signatures `03` P7 (à reporter en clôture)

- `influx_moderation_definer` (`0210`, `0211`, `0213`) : **signé** par `expert-cybersecurite` le 2026-11-05, sous L2CS-1 et L2CS-2.
- `influx_identity_definer`, ajouts L2C (`0207`, `0209`, `0210` §8) : **signé** le 2026-11-05, sous L2CS-3.
- `influx_leads_definer`, `0211` et `0212` : **signé** le 2026-11-05.
- `influx_privacy_definer`, `0207` : **signé** le 2026-11-05.

## Attestation (commit de clôture, les deux lignes)

```
security-reviewed: 2026-11-05
security-reviewed: 2026-11-05 covers 4196b56777f94611d23904938cc1e52921a6fe5e 2c96b024123e673004af8649da538629a40a5ff1 386b220af4ed9fa06a2c13b12d8368143ab49ae3 ef5fb18c2620d9b43f0d6731022a0ee3598b9989 9252534fae5ff2c0b07e2ab02b62d93c6b59fc4e c585596a9291aca6695ae018f336535dd05ef9a0 665c4f18cc4bfcb855d9e681b6c599420b323236 85105ac941ed4a2d82274227850d55e5905aa557 ffd607cb556c279712d023eb8d83c21bd57799be
```

`check-security-review.ts e177d7d HEAD` relève 8 commits sans marqueur (tous couverts ci-dessus ; `85105ac` en plus, sans
effet). Le correctif de L2CS-1 à L2CS-3 sera une nouvelle migration, à porter elle-même son marqueur.

ETAT : revue sécurité L2C faite ; 0 bloquant, 1 à corriger dans le jalon (L2CS-1), 2 avant production (L2CS-2, L2CS-3),
5 plus tard (L2CS-4 à L2CS-8) ; attestation prête ; livraison en `production` autorisée sous condition de L2CS-1 à L2CS-3.
