# L2D — modèle du profil créateur (L2D-02)
> `architecte`, 2026-11-05. **Prime sur 03 à 09 et la fiche pour tout nom.** Pas de D82 : `CLAUDE.md` et
> `decisions.md` inchangés ; `03`, `04`, `07` amendés à la clôture. [T] tranche, [C] code, [D] date, [B] booléen,
> [M] texte modéré, [K] clé jamais servie. « Propre » : `account_id = (select influx.current_account_id())`.

## 0216 — vitrine (A)
`profiles.creator_profile_status` : `draft`, `pending_review`, `published`, `rejected`, `suspended` (EC-02-1).
**`creator_public_profiles`** : `account_id` uuid PK FK `identity.accounts` [K] · `public_ref` uuid not null unique
default `gen_random_uuid()` [K] · `alias` text not null unique `^[2-9BCDFGHJKLMNPQRSTVWXZ]{6}$` [C] · `status` not null
default `draft` [C] · `is_searchable` bool not null default true [B] · `published_at` [D] · `headline` ≤ 120, ni
contrôle ni saut [M] · `bio` ≤ 800, saut de ligne seul [M] · `primary_topic_code` null FK [C] · `residence_country_code`
char(2) not null FK, copie du compte [C] · `residence_region_code` FK composite `reference.regions` [C] · `travel_scope`
(`none`, `domestic`, `international`) [C] · `collaboration_experience_band` (`none`, `1_5`, `6_20`, `gt_20`, RG32)
[T] · `main_audience_country` FK [C] · `main_audience_share_band` (`ge_80`, `50_80`, `lt_50`) [T] ·
`audience_gender_band` FK `reference.audience_genders` [T] · `delivery_lead_band` (`lt_7d`, `7_14d`, `15_30d`,
`gt_30d`) [T] · `max_exclusivity_band` (`none`, `le_1m`, `le_3m`, `negotiable`) [T] · `accepts_non_monetary` bool not
null default false [B] · `availability_band` (`lt_2w`, `lt_1m`, `full`) [T] · `availability_declared_at` [D] ·
`created_at`, `updated_at` [D]. Minimums et obligatoires : règles de publication (L2G).
Listes (codes, FK au référentiel, `slot` plafonne) : `creator_topics` (slot 1-3, secondaires ; principale sur la
vitrine, doublon ôté par l'API) · `creator_publication_languages` (slot 1-5, EC-02-4) · `creator_tones` (slot 1-2)
· `creator_formats (account_id, format_code)` · `creator_usage_rights (account_id, usage_right_code, inclusion
'included'|'optional')`, `<> 'none'`.
**Alias** : `profiles.new_creator_alias()`, 6 signes sur 28 (2-9, consonnes sauf Y) : sans voyelle, ni mot ni genre ;
28⁶ ≈ 2^28,8. Octets de `uuid_send(gen_random_uuid())` hors 6 et 8, rejet ≥ 252. Collision : `on conflict (alias)
do nothing`, 5 essais. Aucune entrée (compte, pseudo, rang), TM12.6.
**Création** : `identity.provision_account()` recréée insère la vitrine d'un `creator`. **Reprise** : une ligne par
compte `creator`, `status <> 'deleted'`, `on conflict (account_id) do nothing`.

## 0217 — objets identifiants (I, N), non réversible
**`creator_identities`** (N) : `account_id` PK, `legal_first_name`, `legal_last_name`, `contact_email`,
`contact_phone` (`^\+[0-9]{7,15}$`), `address_line`, `postal_code`, `city`, `country_code`, `completeness_percent`
0-100 default 0 (EC-02-2), dates. Ligne créée à l'insertion de la vitrine (déclencheur), et reprise.
**`creator_social_accounts`** (I) : `id` uuid PK, `account_id` FK (EC-02-5), `network_code` not null, `is_primary`
bool not null default false, `handle` null ≤ 100, `pseudonym` null ≤ 60 (RG30), `profile_url` null `^https://` ≤ 500,
`followers_count` bigint, `posts_last_30_days` integer, `avg_comments_per_post` bigint, `avg_reach_per_post` bigint
(tous ≥ 0, nuls), `engagement_rate_bp` integer 0-10000 (EC-L2D-8), `figures_source` not null default `declared`
(`declared`, `agent_observed`), `figures_measured_at`, dates. `unique (id, account_id)` ; unique `(account_id,
network_code, lower(handle)) where handle is not null` (RG42) ; unique `(account_id) where is_primary`.
Audience exacte par ligne (I, RG59 ; rien à l'annonceur avant 0401), FK `(social_account_id,
account_id)` → `(id, account_id)` `on delete cascade`, `share_percent` 0-100 : `creator_audience_countries` (slot 0 =
principal, 1-4 ≥ 10 %, pays unique) · `creator_audience_ages` (`age_band_code`) · `creator_audience_genders`
(`female`, `male`, `other`). **N** : `creator_refused_sectors (account_id, sector_code)` ;
`creator_network_metrics_history` : `id` identity, `account_id`, `social_account_id` (sans FK), `network_code`,
trois métriques, `figures_source`, `confirmed`, `recorded_at`, `recorded_by_account_id` ; ajout seul.
`reference.network_url_hosts (network_code, host)` + garde `profiles.guard_creator_social_account()` : hôte listé
ou sous-domaine, sans identifiants ; réseau sans hôte : libre ; sinon 23514. `revoke` annonceur sur chaque objet.

## 0218 — dérivations
`creator_public_networks` : `social_account_id` PK FK cascade [K], `account_id` [K], `network_code` [C], `is_primary`
[B], `audience_band`, `reach_band` (`audience_bands`), `publication_frequency_code`, `comment_band`, `engagement_band`
(nul au L2D, RG48) [T], `figures_source` [C], `figures_measured_at` [D]. `creator_public_audience (account_id,
dimension 'country'|'age', bucket, share_band '10_25'|'25_50'|'gt_50')` [K, C, C, T], de la seule ligne principale
(EC-L2D-9), part < 10 % non servie. Bornes : codes actifs du référentiel, bornes incluses ; parts et genre :
`profiles.audience_share_band()`, `audience_gender_band()` IMMUTABLE (EC-02-7). Déclencheurs (`when (current_user
<> 'influx_privacy_definer')`) : `derive_creator_public_network()` et `record_creator_metrics_history()` (après
écriture d'une ligne), `derive_creator_public_audience()` → `refresh_creator_public_audience(uuid)` (audience, principal
changé, ligne supprimée), `check_creator_audience_sum()` (contrainte différée, ≤ 100 par ligne et dimension),
`copy_creator_residence_country()` (après `update of country_code` de `identity.accounts`, région remise à nul),
`guard_creator_public_profile_write()` (avant : date de disponibilité posée, propriétaire hors ligne propre borné
aux deux colonnes de résidence, 42501). **Porte** `profiles.confirm_own_creator_figures(p_social_account_id uuid,
p_followers_count bigint, p_posts_last_30_days integer, p_avg_comments_per_post bigint) returns timestamptz` : ligne
propre (sinon 42501, comme l'inconnue), trois valeurs (nul = non déclarée), `declared`, `now()` (EC-L2D-6) ; un
chiffre en autosave : historique `confirmed = false`, date inchangée.

## 0219 — droits des personnes
Export : catégorie `creator_profile` après `advertiser_profile` (15), historique compris (art. 15). Effacement :
vitrine gardée (clés, `alias`, pays), `suspended`, non cherchable, reste vidé ; listes, publics, audience, secteurs,
historique supprimés ; identités vidées ; lignes de réseau gardées (L2E), handle, pseudo, URL, chiffres, date vidés.

## Droits (S, I, U, D ; `agent`, `admin` : S partout, en `aal2`)
| Objet | `creator` (propre) | `advertiser` | `influx_identity_definer` | `influx_privacy_definer` |
|---|---|---|---|---|
| vitrine | S ; U 10 saisies | — | I provision ; U dérivées propre, résidence toute ligne (garde) | S, U |
| 5 listes, secteurs refusés | S, I, D | — | — | S, D |
| réseaux, audience publics | S | — | S, I, U, D propre | S, D |
| `creator_identities` | S ; U 9 colonnes | — | I (`account_id`) | S, U |
| `creator_social_accounts` | S, D ; I, U saisies, jamais source ni date | — | S ; U métriques, source, date (porte) | S, U |
| audience exacte | S, I, D | — | S | S, D |
| historique | — | — | I | S, D |

Insertions du définisseur : compte titulaire du rôle `creator`. `usage on schema profiles` à `influx_creator`. Rien
à `influx_moderation_definer` ni `influx_leads_definer`. Portes et dérivations `SECURITY DEFINER`, gardes et bornes
invoker, `search_path = ''`. **`03` P7** : clause « L2D » aux lignes `influx_identity_definer` (`0216` à `0218`) et
`influx_privacy_definer` (`0219`) ; ni rôle ni entrée E-n ; signature `expert-cybersecurite` en revue.

## Huit points
1. `social_account_id` clé, jamais servi : RG42 permet deux comptes sur un réseau.
2. Accepté : `bio`, `pseudonym` (ligne de réseau), deux métriques, `comment_band`, `public_ref`, `headline` 120 ; nuls
   en brouillon. Écartés : `figures_updated_at` de la vitrine, colonnes de badge avant L2E (EC-02-3).
3. `influx_identity_definer` : rôle signé ; la garde tient A5 de L2C (ni état ni publication, autrui borné à la résidence).
4. Âge : part par tranche en 10-25 · 25-50 · > 50, < 10 % absente ; « tranche dominante » (`10` F10) dérivée au Lot 3
   depuis l'exact, avis `expert-matching` avant.
5. Base (`reference.network_url_hosts`, servie avec les référentiels ; `packages/domain` : le comparateur seul) :
   instagram.com · tiktok.com · youtube.com · facebook.com, fb.com · linkedin.com · x.com, twitter.com · snapchat.com
   · twitch.tv · pinterest.com, pinterest.fr · threads.net, threads.com ; sous-domaines admis.
6. Conservé, invisible, FK simple au compte ; L2G refuse le changement hors `draft` ; durée revue au Lot 6.
7. Accepté, plus `is_searchable` faux et saisies vidées (EC-L2B-05-6) ; alias jamais réutilisé.
8. Accepté : pourcentages `female`, `male`, `other` ; `female_majority`/`male_majority` à 60 % ou plus, sinon `mixed`.

Champs de `07` sans colonne : photo (RG29), naissance (EC-L2D-7), statut (`accounts.declared_status`), tarif et net
(EC-L2D-2, D48), badges et captures (L2E) ; les autres sont nommés ci-dessus.

## Écarts
EC-L2D-1, 3 à 9 signés. EC-L2D-2 signé pour les tarifs, corrigé pour l'offre : `creator_formats` garde le nom de `04`,
le format porte son réseau (`reference.formats.network_code`), UGC sans réseau ; lignes d'offre de EC-L2D-4 = ses lignes.
EC-02-1 énumération propre, test de parité : renommer casse des corps plpgsql et neuf tests · EC-02-2 complétude hors
vitrine (`04` l. 1296, RG86), palier codé au Lot 3 si besoin · EC-02-3 une date par ligne (RG116), badges en L2E ·
EC-02-4 langues ≤ 5 : la base plafonne, des langues rares identifient · EC-02-5 `account_id` partout, une forme de
politique · EC-02-6 trois tables au lieu de `creator_audience_breakdowns` : FK par dimension · EC-02-7 seuils en
fonctions (RG58, commentaire de `0201`) · EC-02-8 aucun plafond de lignes de réseau (aucun écrit).
