# Fiche J5 — Inscription marque et créateur

> **Point d'entrée de toute session du J5.** Lire cette fiche, puis **seulement** les tranches
> citées (`Read` avec `offset`/`limit`, ou `Grep` sur la RG). Ne pas lire le plan `21` en entier,
> ni `INDEX.md`, ni `decisions.md`, ni les archives. Les numéros de ligne datent du 2026-10-07 :
> s'ils ont glissé, `Grep` sur le titre de section.

## Objectif et critère de fin

Une marque et un créateur s'inscrivent de bout en bout sur `staging` ; les trois lignes de file
attendues (EC-10) existent. Le worker ne déverse pas encore (J6).

## Commits prévus

1. **Dette J4** : J4S-2 (`QUOTED` sur le message d'occurrence + test T13 nominatif), J4S-4 (chemins
   ajoutés à `SECURITY_FILES`), J4S-5 (référence de projet `SUPABASE_URL` = staging), J4T-1 (tests
   plafonds adresse/instance de `client-errors`), `.node-version` → 24 (D64).
2. **Migrations Lot 1** : `0101` (`outbox_events`, `contact_sync_states`, RG35, FK
   `transactional_sends.outbox_event_id`), `0103` (`leads.sync_settings`, clés EC-8), `0104` (statut
   déclaré non nul, santé de l'adresse, `set_declared_status()`, `correct_email()`), `0105`
   (incidents de délivrance), `0106` (`profiles.advertiser_profiles` minimal), colonnes de source
   d'acquisition sur `identity.accounts` (EC-11), `identity.provision_account` (EC-30). **Pas de
   `0102` ni `0107`** (J8). T2 étendu aux nouvelles tables.
3. **CGU** : versions, empreinte calculée à la publication puis immuable, `GET /v1/terms/current`,
   pages publiques FR/EN (RG23–RG29).
4. **`POST /v1/signup`** : une transaction (RG7), variante discriminée par rôle, idempotent sur
   `auth_user_id` (RG110), refus si pays bloqué (RG8) ou sans CGU publiée.
5. **Écrans** : deux portes, écrans 1-2-3 (`17` §3), états et accessibilité, `locales/<langue>/auth.json`,
   accueil minimal par rôle (RG71) en `noindex`.
6. **Tests de fin** : Playwright, une inscription nominale par porte avec la doublure Brevo.

## Règles d'écart applicables

| # | Règle |
|---|---|
| EC-8 | Clés `leads.sync_settings` : `apollo_scope`, `apollo_legal_basis` (défaut `consentement_requis`, surcharge par pays), `apollo_prospecting_countries` (**vide**), `signup_blocked_countries` (vide), `retry_schedule`, `rate_limits`, identifiants de listes et modèles Brevo |
| EC-10 | À l'inscription, `lead.created` seul ⇒ 3 lignes : `brevo_contact`, `apollo_contact`, `brevo_transactional` (bienvenue) |
| EC-11 | Colonnes de source d'acquisition figées sur `identity.accounts` (UTM source/medium/campaign, domaine référent, « comment nous avez-vous connus ») ; invitations au J8 |
| EC-15 | Chemins localisés (`/fr/inscription/marque` · `/en/signup/brand`…) ; landing rebranchée au J9 |
| EC-30 | `identity.provision_account(...)` `SECURITY DEFINER`, propriétaire `influx_identity_definer`, `EXECUTE` à `influx_auth` seul, rôle limité à `advertiser` ou `creator` |

Rappels invariants : case de consentement **non pré-cochée et obligatoire** (D63) ; attestation 18+
datée pour un créateur (RG20) ; `business` imposé pour une marque (RG22) ; libellé exact du
consentement enregistré (RG32, RG33) ; aucun taux ni montant.

## Où lire (fichier · ligne de départ · nombre de lignes)

| Sujet | Tranche |
|---|---|
| Parcours, portes | `05-spec-inscription-et-leads.md` · 127 · 43 (§A, RG1–RG10) |
| Champs marque / créateur | `05` · 170 · 39 (§B) ; `05` · 209 · 36 (§C) |
| CGU et versions | `05` · 245 · 30 (§D) |
| Consentement | `05` · 275 · 46 (§E) + additif D63 · 1291 · 43 |
| Routage après vérification | `05` · 444 · 29 (§H) |
| États, messages, a11y | `05` · 684 · 60 (§L) |
| Source d'acquisition (D55) | `05` · 1236 · 55 |
| Cas limites / critères (CA1–CA10, CA22, CA65–CA69) | `05` · 744 · 101 ; `05` · 845 · 276 (`Grep` sur `CA<n>`) |
| Modèle `identity` | `04-modele-de-donnees-mvp.md` · 767 · 448 |
| Modèle `leads` | `04` · 4079 · 357 |
| Plan de migrations Lot 1 | `04` · 6054 · 63 (§11.2) |
| Routage, URL | `17-parcours-et-ecrans-espaces-membres.md` · 240 · 23 (§2.5) ; · 263 · 14 (§2.6) |
| Écrans 1, 2, 3, états, a11y | `17` · 308 · 54 / 362 · 47 / 440 · 69 / 509 · 14 / 523 · 22 |
| Tests TM10 | `18-plan-de-test-mvp.md` · 953 (`Grep` « TM10 ») |
| Contrat d'API du Lot 1 | `21-plan-de-developpement.md` §5.2 (`Grep` « 5.2 Le contrat ») |

## Code existant à réutiliser

- `apps/api/src/domains/identity/` : `verify-code.ts` (jeton d'inscription), `member-session.ts`,
  `repository.ts`, `routes.ts`. Nouvelle route dans ce domaine.
- `supabase/migrations/` : dernière migration `0016` ; numérotation Lot 1 en `01xx` (EC-37).
- `packages/contracts` : schémas zod de requête **et** de réponse.

## À traiter en fin de jalon (issu du commit 3)

- `architecte` : texte des pages légales chargé côté navigateur, pas en SSR (le passe-plat épinglé
  interdit à une page serveur d'appeler l'API, `02` §15.3) ; `noindex` des `draft-*` posé côté client.
  Garde git de `db:publish-terms` stricte sur `staging` seulement (avertissement en local).
- `expert-cybersecurite` : motif E-1 `identity.read_published_terms`, `relay-client.ts` (web et
  backoffice) acceptant un paramètre `query` borné, journal de l'échec fermé.
- `testeur` : jeu T2 et sonde d'insertion rebasés sur les versions en vigueur ; `tm10-terms-in-force`
  façonne la table sous le rôle de migration dans une transaction annulée (dérogation `18` T2 règle 5).
- Passe-plat : `ETag`/304 non relayés, « non publié » et « API indisponible » fondus côté web.
- **Staging** : textes publiés par la CI à chaque push (`db:publish-terms --latest`, EC-62 amendé) si la
  variable `STAGING_DATABASE_CA_CERT` existe dans l'environnement GitHub `staging` ; route jamais en 500
  (404 sans texte, 503 `terms_unavailable` sur défaillance). Textes `draft-2` validés par le juriste
  (2026-10-08) ; marqueurs `[…]` : fondateur, à la création de la société (version définitive = `draft-2`
  + marqueurs + en-tête « projet » retiré, rien d'autre).
- Veto `expert-conformite-rgpd` maintenu sur D63 (consentement exigé, art. 7(4) UK GDPR) et sur la
  synchronisation Apollo tant que le « contributor network » n'est pas désactivé.

## Issu du commit 4 (`7b33351`)

Validé par le fondateur (2026-10-08) : refus métier en 200 `outcome` (`country_blocked`, `terms_outdated`,
`terms_not_published`, `account_unavailable` ; le passe-plat ne relaie que 200/401) ; rejeu avec jeton valide =
nouvelle session ; clés `signup.consent.advertiser.label` / `signup.consent.creator.label` imposées par le serveur
(à reprendre au commit 5) ; 249 pays dans `packages/contracts/src/countries.ts`.

- `expert-cybersecurite` (fin de jalon) : signer le rejeu qui ouvre une session et l'appel de `identity.complete_signup`
  (dont `terms_in_force` sous ce motif).
- `testeur` : plancher `tm10-signup-route` = 16 ; `terms_not_published` non couvert de bout en bout (base partagée).

## Issu du commit 5 (`43eb292`)

Écarts pris au plus sûr : aucun stockage navigateur (garde CA8) ⇒ le sélecteur de langue n'est proposé qu'au choix de
porte et à l'écran 1 (requête UTM reportée), un rechargement ou un changement de langue aux écrans 2-3 repart de
l'adresse (RG111 partiel) ; consentement exigé côté web quelle que soit `signup_consent_required` ; changer de porte vide
aussi le pays ; succès et `roleMismatch` = écran d'étape avec lien vers l'espace (pas de bandeau sur l'accueil) ;
pages d'inscription `noindex` ; `/en/connexion`, `/en/marque`, `/en/createur` redirigent ; libellés de consentement
**provisoires** (RG127, Q12).

- `expert-cybersecurite` : `POST /v1/signup` appelé du navigateur (corps du contrat revalidé avant envoi), lien
  confidentialité `target="_blank" rel="noopener noreferrer"`, aucun `installErrorCollector` sur le parcours.
- `expert-conformite-rgpd` (Lot 6) / juriste : libellés `signup.consent.*.label` et `auth.privacy.notice` à faire valider ;
  la politique de confidentialité dit « moins de 18 ans », l'écran dit « majeur dans votre pays » (RG19).
- `testeur` : règles d'écran en unitaire seulement (`auth-steps`, `signup-form`) ; parcours réel au commit 6
  (Playwright). Le contrat accepte un référent IPv4 (`127.0.0.1`) malgré son commentaire « IP literal dropped ».
- `architecte` : `history`/URL non resynchronisée au changement de porte en cours de parcours ; `Commit 4 (SHA)` corrigé dans `21`.

## Discipline de session (économie de tokens)

- Une session par commit (`/clear` entre deux), reprise depuis cette fiche.
- Pendant le codage : seul le fichier de test en cours, `--reporter=dot`. Suite complète avant
  chaque commit (CLAUDE.md §7).
- Sous-agents : `expert-database` pour le commit 2 seulement ; revue groupée `expert-cybersecurite`
  + `testeur` en fin de jalon. Pas de `chef-de-projet` (jalon cadré).
- À la clôture : 1 ligne par commit dans `21` §J5, puis supprimer cette fiche ou la condenser.
