# Modèle de données du MVP — schéma, droits, index, migrations

> **Date :** 2026-09-18 · **Auteur :** agent `expert-database` · **Statut :** proposition complète,
> applicable au Lot 0 ; les tranches des Lots 2 à 5 sont figées dans leur intention et pourront être
> précisées à l'ouverture de chaque lot.
>
> **Mise à jour du 2026-09-18, après arbitrage du fondateur — trois décisions intégrées :**
> **D41** (double rôle annonceur / créateur) : **un rôle par compte au MVP**, mais **la table de
> liaison `identity.account_roles` est posée dès le Lot 0**, avec une contrainte d'unicité qu'il
> suffira de retirer — §5.1 et **§5.1.1, qui chiffre la dette**.
> **D39** (SLA de la file de validation) : **1 jour ouvré**, valeur de départ renseignée dans
> `backoffice.sla_policies`, avec des colonnes générées qui rendent la mesure gratuite — §5.6, §5.10.
> **D40** (masquage symétrique) : **oui**. Les coordonnées de l'interlocuteur d'une marque suivent
> **exactement la même mécanique de révélation** que les réseaux d'un créateur — §5.2, §6.2.
>
> **Corrections demandées par `product-owner` après `05-spec-inscription-et-leads.md` :** trois
> champs collectés à l'inscription n'avaient pas de place avant le Lot 2. Corrigé — **statut déclaré**
> (`accounts.declared_status`, Lot 1, historisé dans le registre, §5.1), **nom d'entreprise**
> (`profiles.advertiser_profiles` **avancée au Lot 1** en forme minimale, §5.2), **adresse
> injoignable** (`accounts.email_status` + `identity.email_delivery_incidents`, Lot 1, §5.1). RG35
> (« le retrait du consentement n'affecte jamais l'e-mail transactionnel ») est désormais garantie
> **par quatre contraintes de base**, pas par convention — §5.1 et §5.8.
> **Skills appliquées :** `supabase-schema` (mode opératoire), `intermediation-tracking`,
> `messaging-spec`, `profile-verification`, `backoffice-ops`, `matching-spec`.
>
> **Ce que ce document tranche :** les schémas PostgreSQL et leur découpage, les tables, les
> colonnes, les types, les contraintes, les clés, la forme exacte de la séparation
> anonyme / identifiant, l'implémentation du registre chaîné, les index et la requête qui justifie
> chacun, les règles de conservation, le plan de migrations lot par lot.
>
> **Ce qu'il ne couvre pas :**
> - la **matrice d'autorisation par rôle**, qui appartient à `expert-cybersecurite`
>   (`docs/mvp/03-matrice-des-droits-et-rls.md`, écrit en parallèle). Ce document propose des
>   politiques et des droits ; **c'est le document `03` qui arbitre**. Les questions d'autorisation
>   soulevées ici lui sont explicitement renvoyées (§12) ;
> - les **règles de gestion fonctionnelles** (`product-owner`, documents `05` à `17`) : je modélise
>   ce que les documents `00`, `01` et `02` décrivent, je n'invente aucune règle métier ;
> - les **durées de conservation définitives**, proposées ici mais **validées par
>   `expert-conformite-rgpd`** (veto) ;
> - **toute migration réelle.** Aucun fichier n'est créé dans `supabase/`, `apps/` ou `packages/`.
>   Les extraits SQL de ce document sont des **illustrations** destinées à la revue, pas du code à
>   appliquer ;
> - le **contrat, la signature, l'encaissement, le calcul de la commission** (A1, V2).
>
> **À lire avec :** `docs/mvp/01-intermediation-courtee.md` (document pivot, il contraint celui-ci),
> `docs/mvp/02-architecture-3-espaces.md` (D2, D5, D12, D18, D37 tranchées ; le §14.2 pose six
> questions auxquelles le §7 ci-dessous répond une par une), `docs/mvp/00-cadrage-mvp-v2.md`
> (périmètre et lots).
>
> **Source de vérité :** `CLAUDE.md`. En cas d'écart, `CLAUDE.md` prime et c'est ce document qui est
> corrigé.

---

## 0. Résumé pour le fondateur

Sept idées suffisent à comprendre tout le reste.

1. **La base dit la vérité, et elle la protège elle-même.** Chaque fois qu'une règle peut être
   inscrite dans la base plutôt que dans le code (« une commission ne peut pas dépasser le montant
   négocié », « une date de révélation ne se réécrit pas », « une affaire ne peut pas exister sans
   mise en relation »), elle est inscrite dans la base. Le code applicatif se refait tous les deux
   ans ; la base, elle, reste.
2. **L'anonymisation n'est pas un filtre d'affichage, c'est une séparation d'objets.** Le profil
   d'un créateur vit dans **trois objets distincts** : ce que toute marque peut voir (anonymisé),
   ce qui se révèle à l'ouverture d'une mise en relation (pseudos, `@`, liens), et ce qui **ne se
   révèle jamais** dans le produit (nom légal, téléphone, adresse). Une marque n'a aucun droit de
   lecture sur le troisième — pas une permission refusée : **un droit qui n'existe pas**.
3. **Toutes les facettes de recherche sont des tranches**, jamais des valeurs exactes. « 47 312
   abonnés » identifie une personne en deux recoupements ; « micro-influenceur, 10 000 à 50 000 »
   ne l'identifie pas et rend le même service. La valeur exacte existe, mais dans l'objet
   identifiant, que la marque ne lit pas.
4. **Le registre de preuve est réellement inaltérable**, pas par convention : les droits de
   modification et de suppression sont retirés à tout le monde, un déclencheur en base lève une
   erreur si quelqu'un essaie malgré tout, chaque ligne est scellée à la précédente par une
   empreinte, et une vérification nocturne alerte si la chaîne est rompue. Ce qu'il **ne protège
   pas** : le propriétaire du projet Supabase, qui peut toujours tout détruire. C'est dit
   franchement au §7.2.
5. **Aucun taux, aucun calcul de commission.** La table des taux est **créée et vide**, et
   **personne n'a le droit d'y écrire** : la remplir exigera une migration relue. Le commercial
   saisit deux montants, la base les enregistre, les contrôle l'un par rapport à l'autre, et
   n'en déduit rien.
6. **Tout montant est un entier, avec sa devise à côté.** Jamais de nombre à virgule flottante :
   2 000,00 EUR est stocké `200000` en centimes, avec `EUR`. C'est la seule façon de ne pas
   inventer un centime au bout de six mois.
7. **Un commercial responsable figure sur les comptes et sur les affaires dès le premier jour**,
   même si au pilote tout le monde voit tout. Le jour où chaque commercial aura son portefeuille,
   ce sera un changement de règle d'accès — pas une reprise de données impossible à faire
   proprement.

---

## 1. Les dix règles qui gouvernent ce modèle

| # | Règle | Conséquence concrète |
|---|---|---|
| R1 | **Intégrité déclarative d'abord** | Clé étrangère, `NOT NULL`, `CHECK`, unicité partielle, déclencheur — dans cet ordre de préférence. Une validation qui n'existe que dans `apps/api` est une validation qu'un script d'import contournera |
| R2 | **Séparation d'objets, pas filtrage de colonnes** | L'anonymisation et le masquage des coordonnées se traduisent par des **tables différentes**, avec des droits différents |
| R3 | **Jamais de flottant sur de l'argent** | `bigint` en plus petite unité monétaire + `char(3)` ISO 4217, les deux ensemble ou aucun des deux |
| R4 | **Horodatages `timestamptz`, toujours** | Aucun `timestamp` nu, aucune `date` sauf quand la date civile est le fait métier (période de campagne) |
| R5 | **Append-only réel là où il y a preuve** | `REVOKE UPDATE, DELETE` + déclencheur + chaînage + vérification périodique |
| R6 | **Pas de suppression physique** de ce qui touche une mise en relation, une affaire ou un journal | Suppression logique + anonymisation ; la clé étrangère du registre vers les comptes rend la suppression physique d'un compte **techniquement impossible** |
| R7 | **Ce qui doit rester vrai « au jour des faits » est copié, pas joint** | Pays des parties, version de CGU, date de révélation : recopiés sur la mise en relation et sur l'affaire |
| R8 | **Aucune donnée d'affichage en français ou en anglais dans la base** | Les listes fermées portent un **code** ; les libellés vivent dans les fichiers de traduction. Y compris les messages système de la messagerie |
| R9 | **Index guidé par une requête écrite** | Chaque index du §10 cite la requête qui le motive. Aucun index de facette de recherche au Lot 3 : le volume ne le justifie pas, et je donne le seuil à partir duquel il le justifiera |
| R10 | **Pas de dénormalisation sans besoin démontré** | Trois exceptions seulement dans tout le modèle, chacune justifiée par une requête d'écran (§10.7) |

---

## 2. Vue d'ensemble

### 2.1 Un schéma PostgreSQL par domaine

Le découpage reprend exactement les domaines de `CLAUDE.md` §7 et de `docs/mvp/02-architecture-3-espaces.md` §8.
La justification du choix « schémas par domaine plutôt que schéma unique » est au **§7.5**.

| Schéma | Contenu | Lot d'apparition |
|---|---|---|
| `influx` | Fonctions utilitaires et fonctions d'accès au contexte (`current_account_id`, `current_account_role`, déclencheurs génériques). **Aucune table** | 0 |
| `reference` | Listes fermées partagées : pays, devises, langues, thématiques, formats, réseaux, secteurs, droits d'usage, bornes de tranches | 0 puis 2 |
| `identity` | Comptes, rôles, pays et langue, **commercial responsable**, profils d'agents, versions de CGU, acceptations, consentements | 0 |
| `audit` | **Registre chaîné append-only**, types d'événements, résultats des vérifications de chaîne | 0 |
| `billing` | **`commission_rates` créée et vide** (Lot 0) ; **`deals`** et l'historique de leurs montants (Lot 5) | 0 puis 5 |
| `leads` | `outbox_events`, état de synchronisation Brevo / Apollo par contact | 1 |
| `profiles` | Profil marque, **profil créateur en trois objets**, réseaux, audience, tarifs, portfolio, complétude | 2 |
| `verification` | Demandes de vérification, codes de propriété, pièces, décisions, badges et péremption, contestations | 2 |
| `campaigns` | Campagnes et leurs blocs, livrables, ciblage, validation | 3 |
| `search` | Journal des recherches, impressions et rangs cliqués, sélections (shortlists) | 3 |
| `matching` | **`introductions`**, détail des candidatures, motifs de refus, file de validation | 4 |
| `messaging` | Conversations, participants, messages, lectures, **journal des lectures par un agent**, signalements, détections, documents | 4 |
| `backoffice` | Notes internes, suspensions, envois d'e-mails et destinataires, demandes RGPD, politiques de SLA | 1 puis 5 |

Le schéma `public` **reste vide**. C'est une décision de sécurité autant que d'hygiène : c'est le
seul schéma exposé par défaut par PostgREST, et nous ne voulons aucune table atteignable par cette
voie (`docs/mvp/02-architecture-3-espaces.md` §2).

### 2.2 Quelles tables apparaissent à quel lot

| Lot | Tables créées |
|---|---|
| **0 — Socle** | `reference.countries` · `reference.currencies` · `reference.languages` · `identity.accounts` · **`identity.account_roles`** *(D41)* · `identity.agent_profiles` · `identity.terms_versions` · `identity.terms_acceptances` · `identity.consent_events` · `audit.event_types` · `audit.audit_events` · `audit.chain_checks` · `billing.commission_rates` *(vide)* · `backoffice.ownership_assignments` |
| **1 — Inscription et leads** | `leads.outbox_events` · `leads.contact_sync_states` · **`leads.sync_settings`** · **`identity.email_delivery_incidents`** · **`profiles.advertiser_profiles` *(forme minimale, avancée depuis le Lot 2)*** · `backoffice.sla_policies` |
| **2 — Profils, badge** | `reference.topics` · `reference.formats` · `reference.networks` · `reference.sectors` · `reference.usage_rights` · `reference.audience_bands` · `reference.price_bands` · *(`profiles.advertiser_profiles` : **extension** de la table créée au Lot 1)* · `profiles.advertiser_contact_details` · `profiles.creator_public_profiles` · `profiles.creator_public_networks` · `profiles.creator_public_audience` · `profiles.creator_public_rates` · `profiles.creator_social_accounts` · `profiles.creator_identities` · `profiles.creator_audience_breakdowns` · `profiles.creator_rate_cards` · `profiles.creator_topics` · `profiles.creator_formats` · `profiles.creator_refused_sectors` · `profiles.portfolio_items` · `verification.rejection_reasons` · `verification.verification_requests` · `verification.ownership_codes` · `verification.evidence_files` · `verification.badges` · `verification.disputes` |
| **3 — Campagnes et recherche** | `campaigns.rejection_reasons` · `campaigns.campaigns` · `campaigns.campaign_deliverables` · `campaigns.campaign_audience_targets` · `campaigns.campaign_topics` · `search.search_queries` · `search.search_impressions` · `search.shortlists` · `search.shortlist_items` |
| **4 — Mise en relation et messagerie** | `matching.rejection_reasons` · `matching.introductions` · `matching.application_details` · `matching.application_formats` · `matching.reference_counters` · `messaging.closure_reasons` · `messaging.report_reasons` · `messaging.conversations` · `messaging.conversation_participants` · `messaging.messages` · `messaging.conversation_reads` · `messaging.conversation_access_log` · `messaging.contact_detections` · `messaging.reports` · `messaging.documents` |
| **5 — Backoffice et pipeline** | `billing.lost_reasons` · `billing.deal_state_transitions` · `billing.deals` · `billing.deal_field_changes` · `backoffice.internal_notes` · `backoffice.account_suspensions` · `backoffice.email_send_limits` · `backoffice.email_sends` · `backoffice.email_send_recipients` · `backoffice.data_subject_requests` |
| **6 — Recette** | Aucune table nouvelle. Vérification de la couverture RLS, des index réellement utilisés et des purges |

**Total : 80 tables et 1 vue**, dont **18 tables de référence** (des listes fermées de quelques
lignes chacune) et une quinzaine de tables de jointure. Le modèle « réel » tient donc en une
quarantaine d'entités. Chaque table de ce document est citée par un document de cadrage ou par une
skill : aucune n'a été créée « au cas où ».

### 2.3 Ce qui n'existe pas au MVP, et pourquoi

| Absent | Raison |
|---|---|
| `contracts.*` | A1 : le contrat est hors application. Le domaine reviendra en V2 et se rattachera à `matching.introductions` |
| Table des pays ouverts aux contrats (D26) | Sans contrat dans l'application, l'objet n'a pas de sens (`00-cadrage-mvp-v2.md` §6.3). `reference.countries` existe, la colonne `is_contract_open` sera **ajoutée** en V2 — je n'introduis pas une colonne inerte |
| Table des alertes | Les deux alertes du MVP (coordonnées repérées, fil silencieux depuis 14 jours) sont des **requêtes**, pas des lignes. Les matérialiser avant d'avoir mesuré serait de la dénormalisation spéculative (R10) |
| Table des accusés de lecture par message | Trois fois le volume des messages pour un besoin que `conversation_reads` couvre (§5.8) |
| Table des codes d'authentification | Ils appartiennent à Supabase Auth (schéma `auth`), que nous ne modélisons pas et ne modifions jamais |
| Score de contournement | M6 fortement allégé : reporté (`01-intermediation-courtee.md` §5) |

---

## 3. Conventions communes

| Sujet | Règle | Exemple |
|---|---|---|
| Tables | Pluriel, `snake_case`, anglais | `matching.introductions` |
| Clé primaire | `id`, `uuid` avec `gen_random_uuid()` pour tout objet exposé à un front ; `bigint generated always as identity` pour les tables purement internes à fort volume (`audit.audit_events`, `leads.outbox_events`, `messaging.conversation_access_log`) | — |
| Clés étrangères | `<entite>_id`. Quand la cible est `identity.accounts` mais que le rôle compte, le nom le dit : `advertiser_account_id`, `creator_account_id`, `owner_agent_id` | — |
| Horodatages | `created_at timestamptz not null default now()` et `updated_at timestamptz not null default now()` maintenu par le déclencheur `influx.touch_updated_at()` | — |
| **Exceptions à `updated_at`** | Les tables **immuables par construction** n'en ont pas, et c'est documenté par un commentaire SQL : `audit.audit_events`, `messaging.messages`, `identity.consent_events`, `identity.terms_acceptances`, `messaging.conversation_access_log`, `billing.deal_field_changes`, `search.search_queries` | — |
| Dates civiles | `date` **uniquement** quand le fait métier est une date sans heure (période d'une campagne, période constatée sur une capture) | `campaigns.starts_on` |
| Pays | `char(2)` ISO 3166-1 alpha-2, **FK vers `reference.countries`** | `country_code` |
| Langue | `char(2)` ISO 639-1, FK vers `reference.languages` | `preferred_language` |
| Devise | `char(3)` ISO 4217, FK vers `reference.currencies` | `currency` |
| Montants | `bigint`, suffixe `_amount_minor`, **toujours accompagné** d'une colonne `currency` | `negotiated_amount_minor` |
| Taux | **Jamais** au MVP. En V2 : points de base entiers (`2000` = 20,00 %), jamais de `numeric` fractionnaire ni de flottant | `advertiser_rate_bp` |
| Texte libre | Toujours borné par un `CHECK (length(...) <= n)`. Un champ texte sans borne est un vecteur d'abus et une facture de stockage | — |
| Booléens | Nommés positivement (`is_searchable`, jamais `is_not_hidden`) | — |
| Commentaires SQL | `COMMENT ON TABLE` obligatoire sur **toutes** les tables ; `COMMENT ON COLUMN` sur toute colonne dont le nom ne suffit pas | — |

### 3.1 Énumération PostgreSQL ou table de référence : la règle de tri

C'est un choix qui se paie longtemps. La règle retenue :

| Cas | Choix | Pourquoi |
|---|---|---|
| **Le code branche sur la valeur** (machine à états, origine d'une mise en relation, rôle) | **Type `enum` PostgreSQL** | On veut que l'exhaustivité soit vérifiable des deux côtés : `switch` exhaustif en TypeScript, contrainte en base. Une valeur nouvelle **doit** être un changement de code |
| **La liste est une donnée métier qui évolue sans déploiement** (motifs de refus, thématiques, formats, secteurs, types d'événements) | **Table de référence + clé étrangère** | Le backoffice peut en activer ou désactiver une sans migration ; on peut y accrocher des attributs (`requires_comment`, `message_key`, `is_active`) ; les statistiques de refus se font par jointure |
| **Taxonomie destinée à durer et à servir de critère de score demain** | Table de référence **versionnée** : on **n'écrase jamais un code utilisé**, on le désactive (`retired_at`) | Exigence explicite de `matching-spec` A1 : deux vocabulaires divergents rendraient tout rapprochement impossible |

Les motifs de refus sont **une table par file** (`matching.rejection_reasons`,
`verification.rejection_reasons`, `campaigns.rejection_reasons`, `messaging.closure_reasons`,
`messaging.report_reasons`, `billing.lost_reasons`) plutôt qu'une table unique à colonne `scope`.
Raison : cela permet une vraie clé étrangère sans artifice, et `backoffice-ops` exige des listes
**distinctes par file** — « les motifs de refus d'une campagne n'ont rien à voir avec ceux d'une
demande de contact ».

### 3.2 Les rôles PostgreSQL

`docs/mvp/02-architecture-3-espaces.md` §5 pose que `apps/api` se connecte avec un rôle
`influx_app` **ni propriétaire, ni `BYPASSRLS`**, et exécute `SET LOCAL ROLE authenticated`. Il pose
aussi (§2.5) qu'il n'existe **aucun `GRANT` au rôle annonceur** sur l'objet identifiant. **Ces deux
phrases ne peuvent pas être vraies en même temps avec un seul rôle `authenticated`** : s'il n'existe
qu'un rôle applicatif, tout membre partage les mêmes droits de table et la séparation ne repose plus
que sur la RLS.

**Proposition (arbitrage : `expert-cybersecurite`, document `03`) : quatre rôles applicatifs.**

```sql
create role influx_advertiser nologin;
create role influx_creator    nologin;
create role influx_agent      nologin;
create role influx_admin      nologin;
create role influx_service    nologin;

-- rôle de connexion : membre des autres, mais SANS héritage
create role influx_app login noinherit;
grant influx_advertiser, influx_creator, influx_agent, influx_admin, influx_service to influx_app;
```

`NOINHERIT` est le point clé : `influx_app` **ne possède aucun droit par lui-même** ; il doit
explicitement `SET LOCAL ROLE <rôle>` au début de chaque transaction, après avoir résolu le rôle
métier du porteur de session en base. Conséquences :

1. « Aucun droit de l'annonceur sur l'objet identifiant » devient **littéralement vrai** : le
   `GRANT` n'existe pas, il n'y a rien à contourner, même avec une politique RLS mal écrite.
2. Une table ajoutée au Lot 5 n'est lisible par **personne** tant qu'un `GRANT` explicite n'est pas
   écrit. Combiné aux `ALTER DEFAULT PRIVILEGES` par schéma (§7.5), c'est le garde-fou contre l'oubli.
3. Les politiques RLS peuvent être **ciblées** (`create policy ... to influx_advertiser`), ce qui les
   rend gratuites à évaluer pour les autres rôles.

**Limite à dire franchement :** `SET LOCAL ROLE` est annulable par `RESET ROLE` dans la même session.
Une injection SQL permettrait donc de remonter à `influx_app` — qui, lui, n'a aucun droit propre, et
devrait alors refaire un `SET ROLE` vers un rôle plus puissant, ce qu'il peut faire. Le rempart reste
donc l'absence d'injection (requêtes paramétrées par Drizzle, jamais de SQL concaténé). C'est un
point pour `expert-cybersecurite` (§12).

---

## 4. Le socle transverse — `influx`, `reference`, `audit`

### 4.1 `influx` — fonctions de contexte

Aucune table. Quatre fonctions, toutes `STABLE` et `SECURITY INVOKER` sauf mention contraire.

| Fonction | Rôle |
|---|---|
| `influx.current_account_id() → uuid` | Renvoie `identity.accounts.id` du porteur de session, à partir de `auth.uid()` (lu dans `request.jwt.claims`, posé par `apps/api` dans la transaction) |
| `influx.current_account_role() → identity.account_role` | Rôle métier **lu en base**, jamais dans le jeton (D37, précision 2). Voir le coût au §7.3 |
| `influx.has_aal2() → boolean` | Lit `request.jwt.claims ->> 'aal'`. Utilisé par les politiques des objets du backoffice |
| `influx.touch_updated_at()` | Déclencheur générique `BEFORE UPDATE` |
| `influx.assert_append_only()` | Déclencheur générique `BEFORE UPDATE OR DELETE`, lève une exception |

```sql
create or replace function influx.current_account_id()
returns uuid
language sql
stable
security definer                 -- lit identity.accounts, sur laquelle les membres n'ont pas de droit direct
set search_path = identity, pg_catalog
as $$
  select a.id
    from identity.accounts a
   where a.auth_user_id = auth.uid()
     and a.status <> 'deleted'
$$;
```

> **Règle d'appel, non négociable.** Dans une politique RLS, ces fonctions s'appellent **toujours
> enveloppées dans une sous-requête scalaire** : `(select influx.current_account_id())`. C'est ce qui
> transforme un appel **par ligne** en un appel **par requête** (§7.3). Une politique qui écrit
> `influx.current_account_id()` sans parenthèses est un défaut de performance bloquant en revue.

### 4.2 `reference` — les listes fermées partagées

Toutes ces tables ont la même forme : un **code** comme clé primaire, une clé de traduction, un
indicateur d'activité, et des dates d'introduction et de retrait. **Aucun libellé français ou
anglais n'est stocké** (R8) : la colonne `label_key` pointe vers les fichiers de traduction.

| Table | Clé | Colonnes notables | Lot |
|---|---|---|---|
| `reference.countries` | `code char(2)` | `label_key`, `region_code`, `is_active` | 0 |
| `reference.currencies` | `code char(3)` | **`minor_unit smallint not null`** (2 pour EUR, 0 pour JPY, 3 pour TND), `is_active` | 0 |
| `reference.languages` | `code char(2)` | `label_key`, `is_ui_language boolean` (FR et EN au MVP) | 0 |
| `reference.topics` | `code text` | `parent_code` (auto-référence), `label_key`, `introduced_at`, `retired_at` | 2 |
| `reference.networks` | `code text` | `label_key`, `supports_ownership_proof boolean` | 2 |
| `reference.formats` | `code text` | `network_code` nullable, `label_key` | 2 |
| `reference.sectors` | `code text` | `label_key`, **`is_sensitive boolean`** (alcool, jeux, santé, finance…) | 2 |
| `reference.usage_rights` | `code text` | `label_key` | 2 |
| `reference.audience_bands` | `code text` | `min_followers bigint`, `max_followers bigint` nullable | 2 |
| `reference.price_bands` | `(currency, code)` | `min_amount_minor`, `max_amount_minor` | 2 |

**`reference.currencies.minor_unit` est la colonne la plus importante de ce schéma.** C'est elle qui
dit comment interpréter un `bigint` : `200000` vaut 2 000,00 EUR mais 200 000 JPY. Sans elle, le
premier contrat en yen produit une erreur d'un facteur 100.

**`reference.price_bands` a pour clé `(currency, code)`** : une tranche tarifaire n'a de sens
qu'adossée à une devise. C'est aussi ce qui rend visible, dès aujourd'hui, la donnée manquante
signalée par `matching-spec` (« règle de conversion entre devises », bloquante dès qu'une seconde
devise existe — D27, V2).

### 4.3 `audit` — le registre chaîné

C'est la table la plus contrainte du modèle. Elle porte **M2 et M4** de
`01-intermediation-courtee.md`.

#### `audit.event_types` — liste fermée des événements journalisables

| Colonne | Type | Contrainte |
|---|---|---|
| `code` | `text` | **PK**, ex. `introduction.identity_revealed` |
| `domain` | `text` | `not null` |
| `subject_type` | `text` | `not null` — le type d'objet attendu, contrôlé à l'écriture |
| `severity` | `text` | `not null check (severity in ('info','sensitive','critical'))` |
| `is_active` | `boolean` | `not null default true` |

Pourquoi une table plutôt qu'un `enum` : ajouter un type d'événement au Lot 5 ne doit pas exiger un
`ALTER TYPE` (non utilisable dans la même transaction que son usage), et l'on veut pouvoir compter
les événements par domaine et par gravité par simple jointure.

#### `audit.audit_events` — le registre

| Colonne | Type | Contrainte | Rôle |
|---|---|---|---|
| `chain_key` | `text` | `not null default 'global'` | Identifie la chaîne. Une seule au MVP (§7.2) |
| `seq` | `bigint` | **PK avec `chain_key`**, `not null` | Séquence **sans trou**, attribuée sous verrou |
| `id` | `uuid` | `not null unique default gen_random_uuid()` | Référence externe stable |
| `occurred_at` | `timestamptz` | `not null` | Instant métier |
| `recorded_at` | `timestamptz` | `not null default clock_timestamp()` | Instant d'écriture. L'écart avec `occurred_at` est un signal |
| `event_type` | `text` | `not null references audit.event_types(code)` | — |
| `actor_type` | `audit.actor_type` | `not null` | `member` · `agent` · `admin` · `system` · `service` |
| `actor_account_id` | `uuid` | `references identity.accounts(id)` **`on delete restrict`** | **Nul pour `system`.** La clé étrangère rend la suppression physique d'un compte impossible : c'est une fonctionnalité, pas un effet de bord |
| `subject_type` | `text` | `not null` | `introduction`, `deal`, `account`, `conversation`… |
| `subject_id` | `uuid` | `not null` | **Pas de clé étrangère** : un registre ne doit pas dépendre de l'existence actuelle de son sujet |
| `payload` | `jsonb` | `not null default '{}'`, `check (pg_column_size(payload) <= 8000)` | **Identifiants et codes uniquement.** Jamais un corps de message, jamais une adresse e-mail |
| `request_id` | `text` | — | Rapprochement avec les journaux `pino` de `apps/api` |
| `hash_algo` | `text` | `not null default 'sha256'` | Permet une évolution de format explicite |
| `hash_version` | `smallint` | `not null default 1` | Idem, pour la forme canonique |
| `payload_hash` | `bytea` | `not null` | Empreinte du contenu canonique |
| `prev_hash` | `bytea` | `not null` | Empreinte de la ligne précédente |
| `row_hash` | `bytea` | `not null unique` | `sha256(prev_hash || payload_hash)` |

Contraintes supplémentaires :

```sql
alter table audit.audit_events
  add constraint audit_events_no_fork unique (chain_key, prev_hash),
  add constraint audit_events_actor_consistency
      check ((actor_type = 'system') = (actor_account_id is null));
```

`unique (chain_key, prev_hash)` est la ceinture qui complète les bretelles : **deux lignes ne peuvent
pas avoir le même prédécesseur**. Même si la sérialisation par verrou venait à être contournée, une
bifurcation de chaîne échouerait au lieu de passer inaperçue.

**Ce qui rend cette table sensible :** c'est le seul élément de preuve interne d'INFLUX. Elle contient
des données **pseudonymes** (identifiants de comptes, jamais de noms ni de contenus), ce qui est
délibéré : elle survit à une suppression de compte, et elle doit pouvoir y survivre sans conserver de
données directement identifiantes.

#### `audit.chain_checks` — la preuve que la chaîne est vérifiée

| Colonne | Type | Rôle |
|---|---|---|
| `id` | `bigint identity` | — |
| `chain_key` | `text not null` | — |
| `checked_at` | `timestamptz not null default now()` | — |
| `from_seq`, `to_seq` | `bigint not null` | Portée de la vérification |
| `status` | `text not null check (status in ('ok','broken','gap'))` | — |
| `broken_at_seq` | `bigint` | Première anomalie |
| `duration_ms` | `integer not null` | Sert à décider quand passer d'une vérification complète à incrémentale |
| `head_row_hash` | `bytea not null` | **Empreinte de tête**, à publier à l'extérieur (§7.2) |

> « Une chaîne qu'on ne vérifie jamais n'est pas une chaîne »
> (`01-intermediation-courtee.md` §M4, point 4). Cette table est la trace que la vérification a lieu.

#### `matching.introduction_events` — une vue, pas une seconde table

```sql
create view matching.introduction_events
  with (security_invoker = true)
as
  select e.chain_key, e.seq, e.id, e.occurred_at, e.event_type,
         e.actor_type, e.actor_account_id, e.subject_id as introduction_id,
         e.payload, e.row_hash
    from audit.audit_events e
   where e.subject_type = 'introduction';
```

Le vocabulaire de `01-intermediation-courtee.md` est conservé, mais il n'existe **qu'une seule
chaîne physique**. Le raisonnement complet est au §7.2. `security_invoker = true` est obligatoire :
une vue ordinaire s'exécute avec les droits de son propriétaire et **contournerait la RLS de la
table sous-jacente** — c'est le piège classique, signalé par `architecte` au §2.5 du document `02`.

---

## 5. Le schéma, domaine par domaine

### 5.1 `identity` — comptes, rôles, CGU, consentement, santé de l'adresse (Lots 0 et 1)

#### `identity.accounts`

*Le compte d'un utilisateur, quel que soit son rôle. C'est la table racine du modèle.*

| Colonne | Type | Contrainte | Commentaire |
|---|---|---|---|
| `id` | `uuid` | PK | — |
| `auth_user_id` | `uuid` | `not null unique` | Correspond à `auth.users.id` (Supabase Auth). **Pas de clé étrangère** : le schéma `auth` appartient à Supabase et peut être migré par eux ; on ne s'y accroche pas |
| *(rôle)* | — | — | **Le rôle n'est pas une colonne de cette table** : il vit dans `identity.account_roles` (D41, ci-dessous). C'est la seule concession faite à une évolution future dans tout ce modèle, et elle est motivée |
| `email` | `text` | `not null unique`, `check (email = lower(email))`, `check (position('@' in email) > 1)` | Copie normalisée de l'adresse. Duplication assumée : le pipeline de leads et le backoffice en ont besoin **sous RLS**, et le schéma `auth` n'est pas interrogeable ainsi |
| `email_verified_at` | `timestamptz` | — | Posé à la première connexion réussie (D37 : le code prouve l'adresse) |
| `email_status` | `identity.email_status` | `not null default 'unknown'` | `unknown` · `deliverable` · `undeliverable`. **`undeliverable` signifie « compte inaccessible »**, pas « gêne marketing » (D37 : on se connecte par un code envoyé par e-mail) — RG61, RG62 |
| `email_undeliverable_at` | `timestamptz` | `check ((email_status = 'undeliverable') = (email_undeliverable_at is not null))` | Alimente la file backoffice « adresses injoignables » |
| `declared_status` | `identity.declared_status` | `not null` | **`individual` · `business`, obligatoire dès l'inscription** (RG18), sans valeur par défaut à l'écran. Conditionne le périmètre Apollo (D33 / RG81) |
| `country_code` | `char(2)` | `not null references reference.countries(code)` | Pays déclaré à l'inscription |
| `preferred_language` | `char(2)` | `not null references reference.languages(code)` | FR ou EN au lancement |
| `timezone` | `text` | `not null default 'UTC'` | Pour les relances et l'affichage |
| `display_name` | `text` | `check (length(display_name) <= 120)` | Nom affiché. Pour un agent : « Prénom » (le suffixe « — INFLUX » est ajouté à l'affichage, pas stocké) |
| `status` | `identity.account_status` | `not null default 'active'` | `active` · `suspended` · `deleted` |
| `owner_agent_id` | `uuid` | FK composite vers un compte **interne** | **Le commercial responsable, dès le Lot 0** |
| `is_adult_attested` | `boolean` | `not null default false` | D15 : mineurs exclus |
| `adult_attested_at` | `timestamptz` | `check (is_adult_attested = (adult_attested_at is not null))` | — |
| `signup_source` | `text` | — | Page ou campagne d'origine (utile à `expert-marketing`) |
| `created_at`, `updated_at` | `timestamptz` | `not null` | — |
| `suspended_at`, `deleted_at`, `anonymized_at` | `timestamptz` | — | **Suppression logique uniquement** (R6) |
| `last_seen_at` | `timestamptz` | — | Alimente l'indicateur d'activité du backoffice |

**Ce qui rend cette table sensible :** données personnelles directes (adresse e-mail) et rattachement
de tout le reste du modèle.

#### Le statut déclaré : une colonne au Lot 1, un historique dans le registre

`product-owner` a raison de le relever : `profiles.creator_identities.legal_entity_type` arrive au
Lot 2, alors que le statut est **obligatoire à l'inscription** (RG18) et qu'il **commande le périmètre
Apollo** (RG81). Sans lui au Lot 1, la valeur d'attente `annonceurs_et_createurs_pro` est
inapplicable, et D33 se refermerait de fait sur `annonceurs_seuls` — ce qui n'est pas ce qui a été
arbitré.

**Décision : une colonne `declared_status` sur `identity.accounts`, au Lot 1**, parce que c'est un
attribut de la personne inscrite, connu avant tout profil, et lu par le worker à chaque consommation
d'événement. `profiles.creator_identities.legal_entity_type` **disparaît** du Lot 2 : il n'y aura
jamais deux endroits qui disent la même chose (`legal_entity_type` aurait été une copie divergente au
bout de trois mois).

**L'historisation n'est pas un écrasement — et elle n'est pas non plus une table de plus :**

```sql
-- personne ne peut ecrire cette colonne directement
revoke update (declared_status) on identity.accounts
  from influx_advertiser, influx_creator, influx_agent, influx_admin, influx_service;
```

La seule porte est une fonction `SECURITY DEFINER` `identity.set_declared_status(account_id, status,
reason_code, comment)` qui, **dans la même transaction** : écrit la colonne, écrit un événement
**chaîné** `account.declared_status_changed` (`payload = {from, to, reason_code}`, acteur et date
compris), et met un `lead.updated` en file vers Brevo **et** Apollo — parce qu'un changement de statut
est un **changement de périmètre de prospection**, pas une correction cosmétique.

Pourquoi le registre plutôt qu'une table `declared_status_changes` dédiée : le registre est déjà
append-only, chaîné, horodaté, attribué, indexé par `(subject_type, subject_id, occurred_at desc)`, et
il survit à la suppression du compte. Une table dédiée offrirait **moins** de garanties pour une table
de plus. La question « quel était son statut le 14 mars, et sur quelle base l'a-t-on prospecté ? » se
répond par un `select` sur le registre — et cette réponse est, elle, difficile à contester.

> **Un invariant que la base ne peut pas porter** (RG22 : un compte annonceur est `business` par
> construction). Depuis D41, le rôle vit dans `account_roles` : une contrainte `CHECK` ne peut pas
> lire une autre table. L'invariant est donc tenu par la fonction de création de compte, plus une
> requête de contrôle quotidienne. Je le signale plutôt que de le laisser croire garanti.

#### L'adresse injoignable : `identity.email_delivery_incidents` (Lot 1)

> **C'est le point le plus sous-estimé de tout le Lot 1.** Depuis D37, l'adresse e-mail n'est pas un
> canal de contact : **c'est le moyen d'authentification**. Une adresse qui rebondit ne dégrade pas le
> marketing, elle **ferme le compte**. Cet état n'a donc rien à faire dans `leads` — il appartient à
> `identity`.

`identity.email_delivery_incidents`, **append-only** :

| Colonne | Type | Contrainte |
|---|---|---|
| `id` | `bigint` | `generated always as identity` |
| `account_id` | `uuid` | `not null references identity.accounts(id)` |
| `email_address` | `text` | `not null` — l'adresse **au moment de l'incident**, jamais l'actuelle (R7) |
| `channel` | `identity.email_channel` | `not null` — `transactional` · `marketing` |
| `incident_type` | `identity.email_incident` | `not null` — `hard_bounce` · `soft_bounce` · `spam_complaint` · `blocked` |
| `provider` | `text` | `not null` — `brevo` |
| `provider_event_id` | `text` | `not null unique` — **idempotence des webhooks** : un rebond notifié deux fois ne compte qu'une fois |
| `occurred_at` | `timestamptz` | `not null` |
| `payload` | `jsonb` | `not null default '{}'` — code SMTP, motif renvoyé par le prestataire |
| `created_at` | `timestamptz` | `not null` |

Le worker pose `accounts.email_status = 'undeliverable'` sur un `hard_bounce` du canal
**`transactional`** ; un incident du canal `marketing` alimente `leads.contact_sync_states` et **ne
ferme jamais un compte**.

**La correction par un administrateur est un acte sensible, et elle est tracée comme tel.** Changer
l'adresse e-mail d'un compte est, par construction, une **primitive de prise de contrôle de compte** :
c'est le seul facteur d'authentification du membre. La seule porte est
`identity.correct_email(account_id, new_email, reason_code, comment)`, réservée à `influx_admin`,
qui : exige un motif, écrit un événement chaîné `account.email_corrected` de gravité `critical`,
**notifie l'ancienne et la nouvelle adresse** (deux e-mails transactionnels en file), remet
`email_status` à `unknown` (la prochaine connexion réussie vaudra nouvelle preuve d'adresse), et
conserve l'ancienne adresse dans le `payload` du registre. RG62 est ainsi tenue en base, pas à
l'écran. **La procédure de vérification d'identité préalable (Q8 de la spécification `05`) reste
ouverte : elle relève de `expert-cybersecurite`** (§12.1, point 9).

#### `identity.account_roles` — la liaison compte ↔ rôles (D41)

*Le ou les rôles détenus par un compte. Au MVP, exactement un — garanti par une contrainte d'unicité
qu'il suffira de retirer.*

| Colonne | Type | Contrainte | Commentaire |
|---|---|---|---|
| `account_id` | `uuid` | **PK avec `role`**, `references identity.accounts(id)` | — |
| `role` | `identity.account_role` | **PK avec `account_id`** | `advertiser` · `creator` · `agent` · `admin` |
| `granted_at` | `timestamptz` | `not null default now()` | — |
| `granted_by_account_id` | `uuid` | FK, nullable (nul à l'inscription) | Un rôle interne est toujours accordé par un administrateur nommé |
| `is_internal` | `boolean` | `generated always as (role in ('agent','admin')) stored` | Support de la clé étrangère composite ci-dessous |
| `created_at` | `timestamptz` | `not null` | — |

```sql
-- D41, MVP : EXACTEMENT UN ROLE PAR COMPTE.
-- Le jour ou le double role s'ouvre, cette seule ligne disparait. Rien d'autre ne bouge en base.
alter table identity.account_roles
  add constraint account_roles_single_role_mvp unique (account_id);

comment on constraint account_roles_single_role_mvp on identity.account_roles is
  'D41 (2026-09-18) : un seul role par compte au MVP. Contrainte volontairement isolee :
   son retrait est la SEULE modification de schema necessaire pour ouvrir le double role.
   Avant de la retirer, lire docs/mvp/04-modele-de-donnees-mvp.md §5.1.1 (dette chiffree).';

-- cible de la cle etrangere composite ; survit au retrait de la contrainte ci-dessus
alter table identity.account_roles
  add constraint account_roles_internal_key unique (account_id, is_internal);
```

**La table ne contient que les rôles en cours.** Un rôle retiré est **supprimé** de cette table, et
l'attribution comme le retrait sont journalisés dans `audit.audit_events`
(`account.role_granted` / `account.role_revoked`). Deux raisons : la contrainte « un seul rôle » reste
alors une unicité simple, lisible et sans condition ; et le rôle courant se lit sans filtre
`where revoked_at is null` dans **la requête la plus fréquente du système**.

> **« Exactement un », et non « au plus un ».** L'unicité garantit le plafond. Le plancher (tout
> compte a un rôle) est garanti par la création du compte et de son rôle **dans la même transaction**,
> plus une requête de contrôle quotidienne qui alerte sur un compte sans rôle. Je le dis plutôt que de
> laisser croire à une garantie déclarative qui n'existe pas : une contrainte « au moins un fils »
> exigerait une clé étrangère circulaire différée, dont le coût dépasse le risque.

**Le commercial responsable, toujours en intégrité déclarative.** `owner_agent_id` ne doit pouvoir
désigner qu'un compte `agent` ou `admin`. Un déclencheur saurait le faire, mais il se désactive. La
forme purement déclarative s'appuie désormais sur `account_roles` :

```sql
alter table identity.accounts
  add column owner_is_internal boolean generated always as (true) stored,
  add constraint accounts_owner_is_internal_fk
      foreign key (owner_agent_id, owner_is_internal)
      references identity.account_roles (account_id, is_internal);
```

Coût : une colonne générée et un index d'unicité. Bénéfice inchangé : il devient **impossible**
d'attribuer un compte à un créateur, y compris par un script d'import ou une correction manuelle — et
**impossible de retirer son rôle d'agent à quelqu'un qui est encore responsable d'un compte**, la clé
étrangère bloquant la suppression de la ligne. C'est exactement la règle 19 de `backoffice-ops`
(« la réattribution est un préalable à la désactivation »), obtenue sans une ligne de code.

**Ce qui rend `account_roles` sensible : c'est la surface d'escalade de privilèges du produit.**
Aucun rôle applicatif n'a le droit d'y écrire : `REVOKE INSERT, UPDATE, DELETE` à tous, et une
fonction `SECURITY DEFINER` `identity.grant_role()` réservée à `influx_admin`, qui refuse qu'un
administrateur agisse **sur son propre compte** (`backoffice-ops`, interdit n° 46) et journalise
systématiquement.

#### 5.1.1 La dette du double rôle, chiffrée d'avance (D41)

Le fondateur a tranché : **un rôle par compte au MVP**, parcours nets et anonymisation garantie. Le
modèle pose néanmoins la liaison dès le Lot 0, pour que l'ouverture future ne soit pas une migration
sur des données de production. Voici ce que coûtera exactement cette ouverture — écrit maintenant,
pendant qu'on y voit clair.

**Ce qui ne coûtera rien** (déjà fait) :

| Déjà en place | Pourquoi ça tiendra |
|---|---|
| `identity.account_roles` | Le schéma est déjà le bon. **Aucune donnée à migrer, aucune colonne à déplacer** |
| `introductions check (advertiser_account_id <> creator_account_id)` | Une personne ne pourra **jamais** se mettre en relation avec elle-même, y compris avec deux rôles. La base le refuse déjà |
| Les cinq rôles PostgreSQL (§3.2) | Ils sont déjà indépendants du compte : un même compte pourra ouvrir une transaction sous `influx_advertiser` puis une autre sous `influx_creator` |
| `profiles.*` en tables 1-1 par rôle | Un même compte peut porter un `advertiser_profiles` **et** un `creator_public_profiles` sans aucun conflit de clé |
| Les politiques RLS | Elles testent `account_id`, jamais « le rôle du compte ». Elles restent vraies |

**Ce qu'il faudra changer** :

| # | Chantier | Charge estimée | Détail |
|---|---|---|---|
| 1 | **Base** : retirer `account_roles_single_role_mvp` | **0,5 j** | Une ligne de migration, réversible tant qu'aucun compte n'a deux rôles |
| 2 | **API** : le rôle cesse d'être déductible du compte | **2 à 3 j** | `withUserTransaction` ne peut plus « deviner » le rôle : il faut un **contexte explicite** par requête (préfixe de route ou en-tête), validé contre `account_roles`, avant `SET LOCAL ROLE`. C'est le vrai cœur du chantier |
| 3 | **Écrans** : sélecteur de rôle et routage | **2 à 3 j** | Choix du contexte à la connexion, bascule visible en permanence, deux tableaux de bord, notifications étiquetées par rôle. `expert-ux` doit trancher la forme |
| 4 | **Recherche** : exclusion de soi-même | **0,5 j** | Un compte double ne doit pas apparaître dans ses propres résultats ; l'exclusion est une clause de plus dans le domaine `search`, silencieuse comme les autres (`matching-spec` A8) |
| 5 | **Candidature à sa propre campagne** | **0,5 j** | Interdite. Contrainte à ajouter : la campagne d'une candidature ne peut pas appartenir au candidat. Déclaratif si l'on recopie `advertiser_account_id` sur la candidature, sinon déclencheur |
| 6 | **Anonymisation** : le risque nouveau, et le seul sérieux | **1 à 2 j** | Aujourd'hui, seule une marque voit l'annuaire anonymisé. Demain, **un créateur pourra s'inscrire comme marque pour consulter l'annuaire de ses concurrents.** Le contournement existe déjà (rien n'empêche un créateur de créer un second compte marque), mais l'ouverture le rend gratuit et invisible. Parades à spécifier : journalisation de recherche **par compte et non par rôle**, alerte sur un compte double dont l'activité marque est exclusivement de la consultation, et maintien du k-anonymat, qui reste la vraie protection |
| 7 | **Tests RLS** : la matrice double | **1 à 2 j** | Chaque table doit être testée pour un compte qui détient deux rôles simultanément : c'est là que se logeront les régressions |
| **Total** | | **8 à 12 jours** | Dont **une demi-journée de base** |

**Si la liaison n'avait pas été posée maintenant**, il faudrait ajouter à ces 8 à 12 jours : la
création de la table et la **migration de la colonne `account_role` sur des comptes réels** (avec la
fenêtre d'indisponibilité correspondante), la réécriture de la clé étrangère composite du commercial
responsable, la reprise de toutes les requêtes et de tout le code qui lisent `accounts.account_role`,
et une double lecture transitoire pendant la bascule. **Estimation : 3 à 5 semaines**, et un risque
d'erreur sur des données de production. Le surcoût d'aujourd'hui est d'**une table de deux colonnes**.

**La dette est donc chiffrée, isolée et documentée dans la base elle-même** : le commentaire SQL de
la contrainte renvoie à ce paragraphe. Celui qui voudra la retirer lira d'abord ce qu'elle protège.

#### `identity.agent_profiles`

*Les informations internes d'un agent ou d'un administrateur — jamais visibles d'un membre.*

`account_id` (PK, FK), `first_name`, `job_title`, `invited_by_account_id`, `invited_at`,
`activated_at`, `deactivated_at`, `mfa_enrolled_at`, `requires_reassignment boolean`,
`created_at`, `updated_at`.

`requires_reassignment` matérialise la règle 19 de `backoffice-ops` : **la réattribution est un
préalable à la désactivation**. Le déclencheur qui pose `deactivated_at` refuse si le compte est
encore responsable d'une mise en relation active ou d'une affaire ouverte.

#### `identity.terms_versions`

*Chaque version publiée d'un document contractuel ou informatif, dans une langue donnée.*

| Colonne | Type | Contrainte |
|---|---|---|
| `id` | `uuid` | PK |
| `document_kind` | `identity.document_kind` | `not null` — `terms_of_service` · `privacy_policy` · `cookie_policy` |
| `locale` | `char(2)` | `not null references reference.languages(code)` |
| `version_label` | `text` | `not null` — ex. `2026-09-v1` |
| `content_uri` | `text` | `not null` — chemin du document publié |
| `content_hash` | `bytea` | `not null` — empreinte du texte exact publié |
| `requires_acceptance` | `boolean` | `not null` — vrai pour les CGU, faux pour la politique de confidentialité |
| `published_at` | `timestamptz` | `not null` |
| `effective_from` | `timestamptz` | `not null` |
| `effective_to` | `timestamptz` | `check (effective_to is null or effective_to > effective_from)` |
| `created_at` | `timestamptz` | `not null` |

```sql
create unique index terms_versions_current_idx
  on identity.terms_versions (document_kind, locale)
  where effective_to is null;
```

Une seule version en vigueur par document et par langue, garanti par la base.
**Immuabilité :** un déclencheur `BEFORE UPDATE` refuse toute modification de `content_hash`,
`content_uri`, `version_label` ou `locale` après `published_at`. Une version de CGU qui change
rétroactivement annule toute la valeur de `terms_acceptances`.

#### `identity.terms_acceptances`

*La preuve qu'une personne précise a accepté une version précise, à une date précise, par un moyen
précis.* C'est la table qui rend la clause de non-contournement opposable (A5).

| Colonne | Type | Contrainte | Ce que ça prouve |
|---|---|---|---|
| `id` | `uuid` | PK | — |
| `account_id` | `uuid` | `not null references identity.accounts(id)` | **Qui** |
| `terms_version_id` | `uuid` | `not null references identity.terms_versions(id)` | **Quelle version** |
| `content_hash` | `bytea` | `not null` | **Copie** de l'empreinte du texte au moment de l'acceptation (R7) |
| `accepted_at` | `timestamptz` | `not null` | **Quand** |
| `channel` | `identity.acceptance_channel` | `not null` — `signup` · `re_acceptance` · `introduction_screen` | **Par quel moyen** |
| `introduction_id` | `uuid` | FK, nullable | Acceptation spécifique à une mise en relation (proposition INFLUX, §5.6) |
| `locale` | `char(2)` | `not null` | La langue dans laquelle le texte a été présenté |
| `ip_address` | `inet` | — | Élément de preuve. **Donnée personnelle** : conservation et opportunité à valider par `expert-conformite-rgpd` (§12.2) |
| `user_agent` | `text` | `check (length(user_agent) <= 500)` | Idem |
| `created_at` | `timestamptz` | `not null` | — |

```sql
create unique index terms_acceptances_unique_idx
  on identity.terms_acceptances (account_id, terms_version_id, coalesce(introduction_id, '00000000-0000-0000-0000-000000000000'));
```

**Table append-only** (`REVOKE UPDATE, DELETE`) : une acceptation ne se corrige pas, elle se complète
par une nouvelle. Et chaque acceptation écrit aussi une ligne dans `audit.audit_events`.

#### `identity.consent_events`

*L'historique complet des consentements marketing, dans les deux sens.* Le consentement n'est pas un
booléen sur le compte : c'est une **suite d'événements datés**, parce que la question posée six mois
plus tard est « qu'est-ce qui était vrai le 14 mars ? ».

| Colonne | Type | Contrainte |
|---|---|---|
| `id` | `uuid` | PK |
| `account_id` | `uuid` | `not null references identity.accounts(id)` |
| `purpose` | `identity.consent_purpose` | `not null` — `marketing_email` · `commercial_prospection` |
| `granted` | `boolean` | `not null` |
| `source` | `identity.consent_source` | `not null` — `signup_form` · `account_settings` · `brevo_webhook` · `apollo_optout` · `backoffice` · `data_request` |
| `occurred_at` | `timestamptz` | `not null` |
| `evidence` | `jsonb` | `not null default '{}'` — version du formulaire, libellé de la case, locale |
| `recorded_by_account_id` | `uuid` | FK, nullable (agent, si saisie backoffice) |
| `created_at` | `timestamptz` | `not null` |

Append-only. La question « a-t-il consenti maintenant ? » se lit par :

```sql
create index consent_events_lookup_idx
  on identity.consent_events (account_id, purpose, occurred_at desc);
```

**Pas de table d'état courant.** La lecture du dernier événement est un accès indexé à une ligne ; en
créer une copie dénormalisée serait une optimisation sans mesure (R10). Si le worker mesure un coût
réel, la copie s'ajoutera alors — pas avant.

**Ce qui rend cette table sensible :** elle conditionne **toute** synchronisation vers Brevo et
Apollo. Le worker la relit **au moment de la consommation**, pas à l'émission (skill `lead-pipeline`,
règle 2) : entre les deux, le consentement a pu être retiré.

> **RG35 — « le retrait du consentement n'affecte jamais l'e-mail transactionnel » — est garantie par
> construction, pas par convention.** La question posée par `product-owner` est la bonne : un membre
> qui se désabonne ne doit pas pouvoir se rendre lui-même incapable de se connecter. Quatre
> propriétés structurelles l'en empêchent, et aucune n'est une règle de code :
>
> 1. **L'énumération `identity.consent_purpose` ne contient aucune valeur transactionnelle.** Il
>    n'existe donc, littéralement, aucun consentement à retirer sur ce canal — on ne peut pas révoquer
>    ce qui n'est pas modélisable.
> 2. **La base interdit d'ignorer un envoi transactionnel pour défaut de consentement** :
>    `check (destination <> 'brevo_transactional' or skip_reason is distinct from 'no_consent')` sur
>    `leads.outbox_events` (§5.8). Un worker mal écrit échouerait à l'écriture, bruyamment.
> 3. **Aucun état de désinscription n'existe pour le canal transactionnel** :
>    `leads.contact_sync_states` porte un `check (destination <> 'brevo_transactional')`. Il n'y a pas
>    de ligne où poser un `unsubscribed_at` qui bloquerait un code de connexion.
> 4. **Les règles de périmètre (`leads.sync_settings`) ne s'appliquent qu'aux destinations
>    marketing**, par la même contrainte.
>
> Reste une dépendance qui n'est pas dans la base et qu'il faut nommer : **les flux transactionnel et
> marketing doivent être séparés chez Brevo** (document `02` §7). Une désinscription globale posée
> par le prestataire sur un contact, tous flux confondus, contournerait les quatre garanties
> ci-dessus. C'est un point de configuration à vérifier au Lot 1, pas un point de modélisation —
> `expert-integrations-api` en est responsable.

---

### 5.2 `profiles` — le profil marque et le profil créateur en trois objets (Lot 2)

#### La décision structurante : trois objets, pas deux

`docs/mvp/02-architecture-3-espaces.md` §2.5 décrit **deux** objets : identifiant et anonymisé. À la
modélisation, deux ne suffisent pas, parce que les documents décrivent en réalité **trois** régimes
de visibilité distincts :

| Objet | Contenu | Qui peut le lire |
|---|---|---|
| **1. `creator_public_profiles`** et ses satellites | Alias stable, thématiques, tranches d'audience, pays d'audience en tranche, formats, tranches tarifaires, portfolio modéré, badge et sa date | **Toute marque authentifiée**, sous les garde-fous de recherche appliqués par `apps/api` |
| **2. `creator_social_accounts`** | Pseudos, `@`, URL de profil, **valeurs exactes** d'abonnés et d'engagement | Le créateur, les agents — et **la marque uniquement après `identity_revealed_at`**, sur un **sous-ensemble de colonnes** |
| **3. `creator_identities`** | Nom légal, date de naissance, téléphone, adresse e-mail de contact, ville, code postal, secteurs refusés | Le créateur et les agents. **Aucune marque, jamais, y compris après révélation** |

Pourquoi trois et pas deux : A2 et D16 disent que **les pseudos, `@` et liens** sont masqués
*jusqu'à la mise en relation* — donc ils se révèlent. `messaging-spec` étape 4 dit que **les
coordonnées directes restent masquées même après ouverture de la conversation**. Ce sont deux
régimes différents ; les mélanger dans une seule table « identifiante » obligerait à ré-ouvrir des
droits colonne par colonne sur une table qui contient aussi le nom légal et la date de naissance.

**Bénéfice décisif :** la phrase « aucun `GRANT` au rôle annonceur sur l'objet identifiant » reste
**littéralement vraie** pour l'objet 3, pour toujours. La révélation ne consiste jamais à ouvrir un
droit sur la table qui contient le plus sensible.

Ce découpage **ne contredit pas** le document `02` : il en précise la mise en œuvre. Si
`expert-cybersecurite` préfère la forme à deux objets, la seule conséquence est que l'objet 2
fusionne dans l'objet 3 avec des `GRANT` de colonnes — plus fragile, et c'est mon avis motivé.

#### `profiles.creator_public_profiles` — la vitrine anonymisée

| Colonne | Type | Contrainte | Commentaire |
|---|---|---|---|
| `account_id` | `uuid` | **PK**, FK `identity.accounts(id)` | Un profil par compte |
| `alias` | `text` | `not null unique`, `check (alias ~ '^[A-Z0-9]{4,8}$')` | **Stable à vie, global, non séquentiel, non dérivé du pseudo, sans marque de genre** (`matching-spec` A6) |
| `headline` | `text` | `check (length(headline) <= 280)` | Texte **modéré** avant publication |
| `primary_topic_code` | `text` | `not null references reference.topics(code)` | — |
| `main_audience_country` | `char(2)` | `references reference.countries(code)` | La facette la plus utile (F6) |
| `main_audience_share_band` | `text` | `check (... in ('ge_80','50_80','lt_50'))` | **Tranche**, jamais un pourcentage |
| `availability_band` | `text` | — | `lt_2w` · `lt_1m` · `full` |
| `availability_declared_at` | `timestamptz` | — | Une disponibilité sans date ne vaut rien |
| `accepts_non_monetary` | `boolean` | `not null default false` | F13 |
| `max_exclusivity_band` | `text` | — | F15 |
| `figures_updated_at` | `timestamptz` | — | **Date de dernière mise à jour des chiffres**, affichée partout |
| `completeness_percent` | `smallint` | `not null default 0 check (between 0 and 100)` | Calculé par `packages/domain`, stocké pour le tri |
| `status` | `profiles.profile_status` | `not null default 'draft'` | `draft` · `pending_review` · `published` · `rejected` |
| `is_searchable` | `boolean` | `not null default true` | **Droit d'opposition** : le créateur peut se retirer de la recherche. Question ouverte de `matching-spec` A12 |
| `published_at` | `timestamptz` | — | — |
| `created_at`, `updated_at` | `timestamptz` | `not null` | — |

Satellites, tous rattachés par `account_id` et **tous en tranches** :

| Table | Clé | Contenu |
|---|---|---|
| `profiles.creator_public_networks` | `(account_id, network_code)` | `audience_band`, `engagement_band` (**nul si non vérifié**), `is_verified`, `verified_at`, `figures_measured_at` |
| `profiles.creator_public_audience` | `(account_id, network_code, dimension, bucket)` | Répartition **de l'audience** par pays, âge, genre, **en tranches et agrégée** (A12 : jamais un attribut du créateur) |
| `profiles.creator_public_rates` | `(account_id, network_code, format_code, currency)` | `price_band_code` — FK composite vers `reference.price_bands(currency, code)` |
| `profiles.creator_topics` | `(account_id, topic_code)` | `is_primary boolean`, ≤ 3 secondaires (contrainte par déclencheur de comptage) |
| `profiles.creator_formats` | `(account_id, format_code)` | Formats proposés |
| `profiles.portfolio_items` | `id` | `storage_path`, `caption`, `moderation_status`, `moderated_by_agent_id`, `moderated_at`, `rejection_reason_code`, `exif_stripped boolean not null`, `display_order` |

**`portfolio_items` mérite une attention particulière** : `matching-spec` A9 en fait « la fuite
d'anonymisation la plus probable ». Deux garanties en base :
`check (moderation_status <> 'approved' or exif_stripped)` — une image dont les métadonnées n'ont pas
été retirées **ne peut pas** être approuvée ; et un déclencheur qui repasse `moderation_status` à
`pending` dès que `storage_path` change (re-modération à chaque remplacement).

**Ce qui rend ces tables sensibles :** ce sont les seules lues par le rôle annonceur. Une colonne
exacte ajoutée ici par inadvertance détruit l'anonymisation **sans erreur visible**. D'où la règle de
revue : *toute colonne ajoutée à `creator_public_*` doit être une tranche, un code de liste fermée,
une date ou un booléen. Jamais un nombre brut, jamais un texte non modéré.*

#### `profiles.creator_social_accounts` — l'objet révélable

| Colonne | Type | Contrainte |
|---|---|---|
| `id` | `uuid` | PK |
| `creator_account_id` | `uuid` | `not null references identity.accounts(id)` |
| `network_code` | `text` | `not null references reference.networks(code)` |
| `handle` | `text` | `not null check (length(handle) <= 100)` — **identifiant `@`** |
| `profile_url` | `text` | `check (profile_url ~ '^https://')` |
| `followers_count` | `bigint` | `check (followers_count >= 0)` — **valeur exacte** |
| `engagement_rate` | `numeric(6,4)` | `check (between 0 and 1)` — **exact, jamais un flottant** |
| `figures_source` | `text` | `check (... in ('declared','agent_observed'))` |
| `figures_measured_at` | `timestamptz` | — |
| `is_ownership_verified` | `boolean` | `not null default false` |
| `verified_at` | `timestamptz` | — |
| `created_at`, `updated_at` | `timestamptz` | `not null` |

`unique (creator_account_id, network_code, handle)`.

Le **sous-ensemble révélable** est explicite dans le `GRANT` :

```sql
grant select (id, creator_account_id, network_code, handle, profile_url,
              is_ownership_verified, verified_at)
  on profiles.creator_social_accounts to influx_advertiser;
```

`followers_count` et `engagement_rate` **ne figurent pas dans ce `GRANT`** : même après révélation,
la marque voit le pseudo et le lien, pas les chiffres exacts (elle voit les tranches et le badge).
C'est un choix de modélisation qui mérite une confirmation de `product-owner` (§12.4, Q3).

#### `profiles.creator_identities` — l'objet jamais révélé

`account_id` (PK, FK), `legal_first_name`, `legal_last_name`, `company_name`,
`company_registration_number`, `date_of_birth`, `contact_email`, `contact_phone`, `address_line`,
`postal_code`, `city`, `country_code`, `created_at`, `updated_at`.

> **`legal_entity_type` n'existe plus ici.** Le statut déclaré particulier / professionnel est
> collecté dès l'inscription et vit sur `identity.accounts.declared_status` (§5.1). Le dupliquer au
> Lot 2 aurait produit deux vérités divergentes sur la donnée qui **commande le périmètre de
> prospection** — exactement le genre d'écart qu'on ne détecte qu'en lisant un e-mail parti chez le
> mauvais destinataire.

Satellites de même régime : `profiles.creator_audience_breakdowns` (parts d'audience **exactes** par
pays, âge, genre), `profiles.creator_rate_cards` (tarifs **exacts** : `amount_minor` + `currency`),
`profiles.creator_refused_sectors` (secteurs refusés).

**Ce qui rend ces tables sensibles :**
- `date_of_birth` est une donnée personnelle dont la seule justification est le contrôle de majorité
  (D15). Question ouverte pour `expert-conformite-rgpd` : **la conserver, ou ne conserver que
  l'attestation** (§12.2) ;
- `creator_refused_sectors` pourrait laisser **inférer une conviction personnelle** (`matching-spec`
  A12). Elle n'est **jamais** exposée, y compris à travers un message d'exclusion : l'exclusion de
  recherche est **silencieuse**, appliquée par `apps/api` côté serveur, ce qui n'exige aucun droit de
  lecture pour la marque ;
- `creator_rate_cards` porte des montants : `bigint` + devise, jamais de flottant (R3).

#### `profiles.advertiser_profiles` et `profiles.advertiser_contact_details`

**D40 est tranchée (2026-09-18) : le masquage est symétrique.** Le profil marque suit donc
exactement la même mécanique que les réseaux d'un créateur — **deux objets, pas un filtre**.

> **`profiles.advertiser_profiles` est avancée au Lot 1, en forme minimale.** Le nom d'entreprise est
> collecté à l'inscription (RG11) et le site est en production dès le Lot 1 (A6). Deux options :
> une colonne `company_name` sur `identity.accounts`, ou la table créée tôt et étendue au Lot 2.
> **Je choisis la seconde**, et la raison est opérationnelle : la première obligerait, au Lot 2, à
> **déplacer une colonne d'une table à une autre sur des données réelles** — une migration
> destructive, avec la procédure du §11.4 et l'accord du fondateur, pour une commodité d'écriture.
> La seconde n'est qu'un `ALTER TABLE … ADD COLUMN` au Lot 2 : additif, réversible, sans reprise.
> **Le nom d'entreprise est un attribut de profil, pas d'identité** ; le ranger ailleurs pour gagner
> trois jours coûterait une migration risquée.
>
> Forme au **Lot 1** : `account_id` (PK, FK), `legal_name not null check (length <= 120)`,
> `status not null default 'draft'`, `created_at`, `updated_at`. Tout le reste arrive au Lot 2 en
> colonnes nullables.

- `profiles.advertiser_profiles` — **public** *(forme complète au Lot 2)* : `brand_name`, `legal_name`, `sector_code`,
  `company_size_band`, `website_domain`, `description` (modérée), `logo_path`, `budget_band`,
  `objectives`, `completeness_percent`, `status`, `published_at`.
  *Nom, logo, site et secteur restent visibles de tous : une marque n'est pas anonyme, c'est son
  interlocuteur qui l'est.*
- `profiles.advertiser_contact_details` — **révélable** : `contact_first_name`, `contact_role`,
  `contact_email`, `contact_phone`, `contact_url`. **Aucun `GRANT` au rôle créateur avant
  révélation** ; après, un `GRANT` de colonnes doublé d'une politique testant `identity_revealed_at`,
  **strictement symétrique de celle de `creator_social_accounts`** (§6.2 e).

`contact_url` suit le régime des coordonnées et non celui du site : une page « contactez-nous » est
un vecteur de contournement au même titre qu'un numéro de téléphone. `website_domain`, lui, reste
public. Si `product-owner` veut trancher autrement, c'est un déplacement de colonne entre deux
tables, sans reprise de droits.

> **Ce que D40 confirme rétrospectivement :** avoir séparé ces colonnes dès la conception, alors que
> la décision n'était pas prise, a fait passer le coût de l'arbitrage de « une migration de données
> plus une reprise de droits » à « un `GRANT` et une politique ». C'est l'illustration exacte de la
> règle R2.

---

### 5.3 `verification` — preuves, badge, péremption (Lot 2)

#### `verification.verification_requests`

*Une demande de vérification, et la file qui la traite.*

`id`, `account_id`, `social_account_id` (nullable — nul pour « Marque vérifiée »),
`requested_level` (`account_ownership` · `audience` · `brand`),
`status` (`pending` · `in_review` · `approved` · `rejected` · `cancelled`),
`claimed_by_agent_id`, `claimed_at`, `claim_expires_at`, `decided_by_agent_id`, `decided_at`,
`rejection_reason_code` (FK `verification.rejection_reasons`), `agent_comment`,
`sla_due_at`, `created_at`, `updated_at`.

Contraintes qui portent les règles de la skill `profile-verification` :

```sql
-- « Audience vérifiée » suppose « Compte vérifié » (règle 7) : contrôlé à la décision
alter table verification.verification_requests
  add constraint verification_rejection_requires_reason
      check (status <> 'rejected' or rejection_reason_code is not null),
  add constraint verification_decision_requires_agent
      check (status not in ('approved','rejected') or decided_by_agent_id is not null);

-- verrou anti-double-traitement : un seul agent par entrée en cours
create unique index verification_requests_claim_idx
  on verification.verification_requests (id)
  where status = 'in_review';
```

Le **verrou anti-double-traitement** ne repose pas sur un index mais sur une **transition
conditionnelle atomique** — voir le motif commun au §5.6, partagé avec la file des mises en relation.

#### `verification.ownership_codes`

`id`, `account_id`, `social_account_id`, `code text not null unique`, `expires_at not null`,
`observed_by_agent_id`, `observed_at`, `revoked_at`, `created_at`.
**L'agent constate lui-même le code en ligne** (règle 15) : `observed_by_agent_id` est donc
obligatoire pour qu'une demande de propriété soit approuvée.

#### `verification.evidence_files`

`id`, `verification_request_id`, `storage_path` (compartiment **privé** `verification-evidence`),
`content_type check (... in ('image/png','image/jpeg','application/pdf'))`, `byte_size`,
`checksum bytea`, `capture_period_start date`, `capture_period_end date`,
`uploaded_by_account_id`, `uploaded_at`, `retention_due_at not null`, `deleted_at`.

**Ce qui rend cette table sensible :** les captures d'espaces analytiques contiennent presque
toujours **des données de tiers** (commentateurs, miniatures, visages). Trois garanties :
`retention_due_at` est **obligatoire dès l'insertion** (aucune pièce sans date de purge) ; aucun
`GRANT` au rôle annonceur, jamais, sous aucun prétexte (`profile-verification` règle 25) ; **tout
accès d'un agent est journalisé** dans `audit.audit_events`
(`event_type = 'verification.evidence_viewed'`).

#### `verification.badges`

*Ce que le badge affirme : un fait précis, constaté sur pièce, par une personne nommée, à une date
donnée.* Le modèle doit rendre chacun de ces quatre mots vérifiable.

| Colonne | Type | Rôle |
|---|---|---|
| `id` | `uuid` | — |
| `account_id` | `uuid` | `not null` |
| `social_account_id` | `uuid` | Nul pour « Marque vérifiée ». **Le badge est par réseau** (règle 8) |
| `level` | `verification.badge_level` | `account_verified` · `audience_verified` · `brand_verified` |
| `granted_by_agent_id` | `uuid` | `not null` — **la personne nommée** |
| `granted_at` | `timestamptz` | `not null` — **la date** |
| `evidence_source` | `text` | `not null` — `native_dashboard` · `registry` · `domain_control` — **la source** |
| `observed_followers` | `bigint` | **Saisi par l'agent**, jamais recopié du déclaratif (règle 11) |
| `observed_engagement` | `numeric(6,4)` | Idem |
| `observed_period_start`, `observed_period_end` | `date` | La période lisible sur la pièce |
| `declared_followers_at_decision` | `bigint` | Copie du déclaré **au moment de la décision** |
| `expires_at` | `timestamptz` | `not null` pour `audience_verified` (90 jours, D34) |
| `state` | `verification.badge_state` | `active` · `to_refresh` · `expired` · `revoked` |
| `revoked_at`, `revocation_reason_code` | — | Retrait hors péremption (4 cas, règle 21) |
| `created_at`, `updated_at` | `timestamptz` | — |

```sql
alter table verification.badges
  add constraint badges_audience_requires_expiry
      check (level <> 'audience_verified' or expires_at is not null),
  add constraint badges_revocation_requires_reason
      check (state <> 'revoked' or revocation_reason_code is not null);

create unique index badges_active_unique_idx
  on verification.badges (account_id, coalesce(social_account_id,'000...'::uuid), level)
  where state in ('active','to_refresh');
```

**L'écart déclaré / constaté** (`declared_followers_at_decision` − `observed_followers`) n'est jamais
publié : c'est un signal interne pour le commercial (règle 5 de l'étape 4 de la skill). Il est calculé
à la lecture, pas stocké — c'est une soustraction, pas une donnée.

`verification.disputes` : `id`, `badge_id` ou `verification_request_id` (exactement un des deux,
`check (num_nonnulls(...) = 1)`), `account_id`, `submitted_at`, `reason`, `reviewed_by_agent_id`
(**différent du décideur initial** — contrôlé applicativement dès que l'équipe compte deux
personnes), `decided_at`, `outcome`.

---

### 5.4 `campaigns` — campagnes et blocs (Lot 3)

#### `campaigns.campaigns`

*L'offre d'une marque : le brief, les livrables, le budget, le calendrier et les modalités de
candidature.* Huit blocs, dont un **interne**.

| Bloc | Colonnes |
|---|---|
| Identification | `id`, `advertiser_account_id`, `title` (≤ 140), `status`, `created_at`, `updated_at`, `published_at` |
| Produit | `sector_code` (FK vers `reference.sectors`), `product_description` (≤ 4 000). **Le caractère sensible du secteur n'est pas recopié ici** : il se lit sur `reference.sectors.is_sensitive` (voir la note ci-dessous) |
| Livrables | table `campaigns.campaign_deliverables` |
| Ciblage | tables `campaigns.campaign_audience_targets` et `campaigns.campaign_topics` |
| Budget | `per_creator_amount_min_minor`, `per_creator_amount_max_minor`, `currency`, **`total_budget_minor` (interne)** |
| Calendrier | `starts_on date`, `ends_on date`, `publication_deadline date` |
| Candidature | `verified_only boolean`, `max_applications smallint`, `applications_close_at` |
| Interne | `owner_agent_id`, `internal_note`, `reviewed_by_agent_id`, `review_decided_at`, `rejection_reason_code` |

> **Note de modélisation.** Une colonne générée ne peut pas lire une autre table ; le caractère
> sensible du secteur se lit donc par jointure sur `reference.sectors.is_sensitive`. C'est une
> jointure sur une table de dix lignes : aucune raison de la dénormaliser.

Contraintes argent et calendrier, toutes déclaratives :

```sql
alter table campaigns.campaigns
  add constraint campaigns_budget_range
      check (per_creator_amount_min_minor is null
             or per_creator_amount_max_minor is null
             or per_creator_amount_min_minor <= per_creator_amount_max_minor),
  add constraint campaigns_amount_needs_currency
      check (num_nonnulls(per_creator_amount_min_minor, per_creator_amount_max_minor) = 0
             or currency is not null),
  add constraint campaigns_dates_ordered
      check (ends_on is null or starts_on is null or ends_on >= starts_on),
  add constraint campaigns_published_needs_review
      check (status <> 'published' or reviewed_by_agent_id is not null);
```

**Ce qui rend cette table sensible :** `total_budget_minor` est une **donnée interne** — le cadrage
dit « rémunération par créateur publiée, budget total interne ». Aucun `GRANT` de cette colonne au
rôle créateur. C'est exactement le genre de règle qu'un filtre applicatif oublie un jour.

`campaigns.campaign_deliverables` : `(campaign_id, network_code, format_code)`, `quantity`,
`usage_rights_code` (FK), `exclusivity_band`, `notes`. Les **droits d'usage et l'exclusivité** sont
« les deux premières causes de désaccord en négociation » : ils sont structurés, pas en texte libre.

---

### 5.5 `search` — journal de recherche et sélections (Lot 3)

#### `search.search_queries`

*Chaque recherche lancée, par qui, avec quels filtres, et ce qu'elle a renvoyé.* C'est à la fois un
garde-fou anti-aspiration et **le jeu de données qui permettra de régler D11**.

`id`, `account_id`, `actor_role`, `view_mode` (`advertiser_anonymous` · `agent_identified`),
`campaign_id` (nullable), `filters jsonb not null`, `result_count int not null`,
`page_reached smallint not null`, `blocked_by_k_anonymity boolean not null`,
`request_id`, `created_at`. **Append-only.**

#### `search.search_impressions`

`search_query_id`, `creator_account_id`, `rank smallint not null`, `was_opened boolean not null
default false`, `opened_at`. PK `(search_query_id, creator_account_id)`.

**Rang affiché et rang cliqué** sont explicitement réclamés par `matching-spec` comme donnée
manquante bloquante pour D11. Volume : 12 lignes par recherche — négligeable, et irremplaçable plus
tard.

`search.shortlists` (`id`, `advertiser_account_id`, `name`, `campaign_id`) et
`search.shortlist_items` (`shortlist_id`, `creator_account_id`, `added_at`, `note`) : la sélection
privée de la marque. **Aucune notification au créateur** : l'ajout à une sélection n'est pas un acte
de mise en relation.

**Ce qui rend ces tables sensibles :** `filters` décrit ce qu'une marque cherche — une information
commerciale. Et le journal sert **deux finalités** (sécurité anti-aspiration, amélioration produit),
ce qui doit figurer au registre des traitements avec une durée écrite (§9).

---

### 5.6 `matching` — l'objet pivot (Lot 4)

#### `matching.introductions`

*La mise en relation : qui, avec qui, à l'initiative de qui, décidée par qui, révélée quand.* C'est
l'objet dont tout le modèle économique dépend.

| Colonne | Type | Contrainte | Pourquoi elle existe |
|---|---|---|---|
| `id` | `uuid` | PK | — |
| `reference` | `text` | `not null unique check (reference ~ '^MER-\d{4}-\d{6}$')` | `MER-2026-000123`. Citée dans les e-mails, les fils et la future facture |
| `origin` | `matching.introduction_origin` | `not null`, **immuable** (déclencheur) | `brand_contact_request` · `creator_application` · `influx_proposal` |
| `origin_reason` | `text` | `check (origin <> 'influx_proposal' or length(btrim(coalesce(origin_reason,''))) >= 10)` | **Motif écrit obligatoire** pour la proposition INFLUX |
| `advertiser_account_id` | `uuid` | `not null` FK | — |
| `creator_account_id` | `uuid` | `not null` FK, `check (<> advertiser_account_id)` | — |
| `campaign_id` | `uuid` | FK, `check (origin = 'brand_contact_request' or campaign_id is not null)` | Obligatoire pour la candidature et la proposition |
| `owner_agent_id` | `uuid` | FK interne, `check (status not in ('in_review','approved') or owner_agent_id is not null)` | **Le commercial responsable** |
| `advertiser_country_at_intro` | `char(2)` | `not null` FK `reference.countries` | **Copié** (R7) : le droit applicable se lit au jour des faits |
| `creator_country_at_intro` | `char(2)` | `not null` FK | Idem |
| `advertiser_terms_version_id` | `uuid` | FK | La version de CGU acceptée **par chaque partie**, séparément |
| `creator_terms_version_id` | `uuid` | FK | Idem |
| `advertiser_accepted_at` | `timestamptz` | — | Acceptation **à l'écran de cette mise en relation** |
| `creator_accepted_at` | `timestamptz` | — | Idem |
| `identity_revealed_at` | `timestamptz` | **write-once** (déclencheur + `REVOKE UPDATE` de colonne) | Date de naissance de la créance V2, point de départ de D29 |
| `status` | `matching.introduction_status` | `not null default 'pending_review'` | `pending_review` · `in_review` · `approved` · `rejected` · `withdrawn` · `expired` |
| `rejection_reason_code` | `text` | FK, `check (status <> 'rejected' or rejection_reason_code is not null)` | Motif **typé**, jamais muet |
| `sla_due_at` | `timestamptz` | `not null` | Calculé **une fois**, à la création, depuis `backoffice.sla_policies` (**D39 : 1 jour ouvré**) |
| `claimed_by_agent_id`, `claimed_at` | — | — | Prise en charge, verrou |
| `decided_at` | `timestamptz` | — | Mesure de la file |
| `seconds_to_claim` | `integer` | **colonne générée `stored`** | `extract(epoch from (claimed_at - created_at))::int` |
| `seconds_to_decision` | `integer` | **colonne générée `stored`** | Idem avec `decided_at` |
| `sla_breached` | `boolean` | **colonne générée `stored`** | `decided_at is not null and decided_at > sla_due_at` |
| `source_search_query_id` | `uuid` | FK `search.search_queries` | **Le lien entre ce que la marque a cherché et ce qu'elle a signé** (`matching-spec`, donnée manquante) |
| `created_at`, `updated_at` | `timestamptz` | `not null` | — |

Les trois contraintes qui portent la preuve :

```sql
alter table matching.introductions
  -- on ne révèle qu'une mise en relation approuvée
  add constraint introductions_reveal_requires_approval
      check (identity_revealed_at is null or status = 'approved'),
  -- on ne révèle jamais sans le consentement des DEUX parties (§4.3 du document 01)
  add constraint introductions_reveal_requires_both_acceptances
      check (identity_revealed_at is null
             or (advertiser_accepted_at is not null and creator_accepted_at is not null)),
  -- une acceptation suppose une version de CGU identifiée
  add constraint introductions_acceptance_requires_terms
      check ((advertiser_accepted_at is null) = (advertiser_terms_version_id is null)
         and (creator_accepted_at    is null) = (creator_terms_version_id    is null));
```

**La mesure du SLA ne coûte rien, et c'est voulu (D39).** Le délai de D39 est tranché à **1 jour
ouvré**, mais il reste une **donnée** (`backoffice.sla_policies`) : le jour où le fondateur le
resserrera à quatre heures, ce sera une ligne de configuration, pas un déploiement.

```sql
alter table matching.introductions
  add column seconds_to_claim integer
    generated always as (extract(epoch from (claimed_at  - created_at))::integer) stored,
  add column seconds_to_decision integer
    generated always as (extract(epoch from (decided_at  - created_at))::integer) stored,
  add column sla_breached boolean
    generated always as (decided_at is not null and decided_at > sla_due_at) stored;
```

Trois conséquences, et c'est tout l'intérêt :

1. **Les indicateurs p50 / p90 de la file** (`00-cadrage-mvp-v2.md`, indicateur n° 3) se calculent
   par `percentile_disc` sur une colonne entière, **sans arithmétique de dates ligne à ligne**.
2. **Le « % hors SLA » est un `count(*) where sla_breached`**, servi par un index partiel (§10.5).
3. **`sla_due_at` est figé à la création**, jamais recalculé : une mise en relation reste jugée sur
   le SLA **en vigueur au moment où elle est arrivée**. Changer la politique demain ne doit pas
   réécrire l'histoire d'hier — c'est la règle R7 appliquée au pilotage.

Les heures ouvrées sont appliquées **une seule fois**, au calcul de `sla_due_at`, par une fonction
déterministe lisant `backoffice.sla_policies`. Aucune requête d'écran ne refait ce calcul.

**Blocage des doublons** (`intermediation-tracking`, règle 4) :

```sql
create unique index introductions_active_pair_idx
  on matching.introductions (
       advertiser_account_id,
       creator_account_id,
       coalesce(campaign_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where status in ('pending_review','in_review','approved');
```

**`identity_revealed_at` en écriture unique** — la contrainte, puis la porte unique :

```sql
create or replace function matching.assert_reveal_is_write_once()
returns trigger language plpgsql as $$
begin
  if old.identity_revealed_at is not null
     and new.identity_revealed_at is distinct from old.identity_revealed_at then
    raise exception 'identity_revealed_at is write-once (introduction %)', old.reference
      using errcode = '55006';
  end if;
  if new.origin is distinct from old.origin then
    raise exception 'origin is immutable (introduction %)', old.reference
      using errcode = '55006';
  end if;
  return new;
end;
$$;

create trigger introductions_write_once
  before update on matching.introductions
  for each row execute function matching.assert_reveal_is_write_once();

revoke update (identity_revealed_at, origin, reference, advertiser_country_at_intro,
               creator_country_at_intro)
  on matching.introductions from influx_agent, influx_admin, influx_advertiser, influx_creator;
```

Aucun rôle applicatif ne peut écrire ces colonnes par une mise à jour ordinaire. **La seule porte est
une fonction `SECURITY DEFINER`**, qui exécute en une transaction l'intégralité de l'étape 5 du
processus (document `01` §3) :

```sql
create or replace function matching.reveal_identity(p_introduction_id uuid)
returns void
language plpgsql
security definer
set search_path = matching, messaging, audit, leads, pg_catalog
as $$
declare v_intro matching.introductions%rowtype; v_conversation_id uuid;
begin
  select * into strict v_intro
    from matching.introductions
   where id = p_introduction_id
   for update;                                   -- sérialise deux révélations concurrentes

  if v_intro.identity_revealed_at is not null then
    raise exception 'already revealed' using errcode = '55006';
  end if;
  if v_intro.advertiser_accepted_at is null or v_intro.creator_accepted_at is null then
    raise exception 'both parties must accept first' using errcode = '55006';
  end if;

  update matching.introductions
     set identity_revealed_at = now()
   where id = p_introduction_id;                 -- autorisé : le propriétaire de la fonction a le droit

  -- 1 conversation + 3 participants + 1 événement chaîné + 2 e-mails en file
  ...                                            -- tout ou rien
end;
$$;
```

C'est la traduction exacte de la contrainte **C2** du document `02` : « révélation + conversation +
événement chaîné + e-mails, tout ou rien ».

#### Le verrou anti-double-traitement de la file

Motif commun aux deux files (mises en relation, vérifications). **Ce n'est pas un `SELECT` puis un
`UPDATE`** : c'est une transition conditionnelle atomique, dont le nombre de lignes affectées est la
réponse.

```sql
update matching.introductions
   set status = 'in_review',
       claimed_by_agent_id = (select influx.current_account_id()),
       claimed_at = now()
 where id = $1
   and status = 'pending_review'          -- ← la condition EST le verrou
returning id;
```

Zéro ligne renvoyée ⇒ un autre commercial a pris la main : `apps/api` répond `409` avec le nom du
titulaire, jamais un écran d'erreur (`intermediation-tracking` étape 3, point 2).

#### `matching.application_details`

Extension 1-1 **optionnelle** de `introductions`, présente uniquement pour
`origin = 'creator_application'` : `introduction_id` (PK, FK), `pitch` (≤ 2 000),
`proposed_amount_minor`, `currency`, `created_at` ; plus `matching.application_formats`
(`introduction_id`, `network_code`, `format_code`) pour les formats proposés. Une table d'extension
plutôt que six colonnes nullables : la contrainte « ces champs n'existent que pour ce déclencheur »
devient structurelle.

#### `matching.reference_counters`

`year int primary key`, `last_value bigint not null`. La référence `MER-AAAA-NNNNNN` s'obtient par
`update ... set last_value = last_value + 1 returning last_value`, qui pose un verrou de ligne : deux
mises en relation simultanées ne peuvent pas obtenir le même numéro. Une séquence PostgreSQL aurait
des trous à chaque transaction annulée — acceptable techniquement, mais une référence commerciale
trouée invite les questions.

---

### 5.7 `messaging` — la conversation à trois (Lot 4)

#### `messaging.conversations`

`id`, **`introduction_id uuid not null unique references matching.introductions(id)`**, `state`
(`open` · `active` · `paused` · `closed` · `archived`), `opened_at not null`,
`last_message_at`, `closed_at`, `closure_reason_code` (FK, `check (state <> 'closed' or ... is not
null)`), `archived_at`, `created_at`, `updated_at`.

> **Écart assumé avec `intermediation-tracking`.** La skill liste `conversation_id` parmi les champs
> de `introductions`. Je ne le crée pas : la relation 1-1 est portée par
> `conversations.introduction_id unique`, ce qui **garantit** l'unicité et supprime une référence
> circulaire entre deux tables. L'information est strictement la même, la contrainte est plus forte.
> « Une conversation orpheline est un défaut bloquant » devient ici **impossible**, pas seulement
> interdit.

`last_message_at` est l'une des **trois seules dénormalisations** du modèle (§10.7) : elle est
justifiée par la requête de liste de conversations, triée par activité, sur les trois espaces.

#### `messaging.conversation_participants`

`id`, `conversation_id`, `account_id`, `participant_role` (`advertiser` · `creator` · `agent`),
`joined_at not null`, `left_at`, `added_by_account_id`, `created_at`.

```sql
-- une seule marque et un seul créateur actifs par conversation
create unique index conversation_participants_party_idx
  on messaging.conversation_participants (conversation_id, participant_role)
  where participant_role in ('advertiser','creator') and left_at is null;

-- un compte ne peut pas être deux fois participant actif
create unique index conversation_participants_active_idx
  on messaging.conversation_participants (conversation_id, account_id)
  where left_at is null;
```

**La date d'entrée est obligatoire et fait partie du produit** : `messaging-spec` règle 2 impose que
l'ajout d'un agent en cours de route soit un événement **visible**, matérialisé par un message système
horodaté. Un agent qui rejoint le 14 mars ne doit pas apparaître comme présent depuis l'origine.

« Au moins un agent participant » n'est pas exprimable en contrainte simple (elle porte sur
l'ensemble des lignes filles). C'est un **invariant applicatif** posé par `matching.reveal_identity()`,
doublé d'une **requête de contrôle nocturne** qui alerte si une conversation active n'a plus d'agent.
Je préfère le dire que de faire croire à une garantie qui n'existe pas.

#### `messaging.messages`

| Colonne | Type | Contrainte |
|---|---|---|
| `id` | `uuid` | PK |
| `conversation_id` | `uuid` | `not null` FK |
| `kind` | `messaging.message_kind` | `not null` — `member` · `system` |
| `sender_account_id` | `uuid` | FK, `check ((kind = 'system') = (sender_account_id is null))` |
| `sender_role` | `messaging.participant_role` | Copie au moment de l'envoi |
| `body` | `text` | `check (kind = 'system' or (length(btrim(body)) between 1 and 10000))` |
| `system_event_code` | `text` | `check ((kind = 'system') = (system_event_code is not null))` |
| `system_params` | `jsonb` | Paramètres du message système |
| `created_at` | `timestamptz` | `not null default now()` |

Trois points structurants :

1. **L'auteur réel est immuable et il n'existe aucun mécanisme d'écriture « au nom de »**
   (`messaging-spec` règle 3). `REVOKE UPDATE` sur toute la table : **un message ne se modifie ni ne
   se supprime**. Pas d'`updated_at`, pas de `deleted_at`.
2. **Les messages système ne stockent aucun texte** : un code et des paramètres
   (`{"agent_display_name":"Thomas","joined_at":"…"}`), rendus dans la langue du lecteur. Stocker
   « Thomas — INFLUX a rejoint la conversation » condamnerait le bilinguisme (R8).
3. **Aucune pièce jointe.** Il n'existe **aucune colonne** de fichier sur cette table : l'interdiction
   est structurelle, pas une règle d'écran (`messaging-spec` règle 21).

#### `messaging.conversation_reads`

`(conversation_id, account_id)` PK, `last_read_message_id`, `last_read_at`, `updated_at`.

**Pourquoi pas un accusé de lecture par message :** trois lignes par message, pour un besoin produit
(« non lu ») que le curseur couvre entièrement. La traçabilité légale (A10) est portée par la table
suivante, qui est un objet différent et ne doit pas être confondue avec un accusé de lecture.

#### `messaging.conversation_access_log`

*Chaque fois qu'un agent ouvre une conversation, la trace est écrite avant que les messages ne
sortent.* C'est l'exécution d'A10.

`id bigint identity`, `conversation_id`, `agent_account_id`, `accessed_at not null`,
`was_participant boolean not null`, `surface` (`backoffice_queue` · `backoffice_deal` ·
`backoffice_search` · `member_app`), `access_scope` (`thread` · `export`), `request_id`,
`message_count_returned int`.

Écrite par la fonction `SECURITY DEFINER` `messaging.read_conversation(p_conversation_id)`, qui
journalise **puis** retourne les messages. La garantie décisive n'est pas la fonction, c'est le
`REVOKE` qui l'accompagne :

```sql
revoke select on messaging.messages from influx_agent, influx_admin;
grant execute on function messaging.read_conversation(uuid) to influx_agent, influx_admin;
```

Sans ce `REVOKE`, il resterait un chemin de lecture non journalisé et la garantie serait décorative
(document `02` §10.2, point 1).

**Append-only, mais non chaînée** — et c'est un arbitrage, pas un oubli : chaîner les lectures
imposerait de sérialiser **toutes** les écritures du registre sur un acte à haute fréquence qui ne
crée aucune obligation. Le registre chaîné porte les **actes** (décision, révélation, montant) ; les
**lectures** vont dans une table append-only dédiée, protégée par les mêmes `REVOKE UPDATE, DELETE`
et le même déclencheur. **À confirmer par `expert-cybersecurite` et `expert-conformite-rgpd`**
(§12.1, §12.2).

#### `messaging.contact_detections`

`id`, `message_id` FK, `detection_type` (`email` · `phone` · `social_handle` · `messaging_link` ·
`iban` · `url`), `match_start int`, `match_end int`, `detector_version text not null`,
`reviewed_by_agent_id`, `reviewed_at`, `review_outcome` (`legitimate` · `circumvention_suspected` ·
`false_positive`), `created_at`.

**On stocke le type et la position, jamais une copie du texte détecté** (`intermediation-tracking`,
section détection). Le message est déjà stocké ; en recopier un extrait doublerait l'exposition d'une
donnée personnelle sans rien apporter. `detector_version` permet de rejouer le corpus quand la
détection évoluera.

#### `messaging.reports` et `messaging.documents`

- `messaging.reports` : `id`, `conversation_id`, `message_id` (nullable), `reporter_account_id`,
  `reason_code` (FK `messaging.report_reasons`), `comment`, `status`, `claimed_by_agent_id`,
  `decided_at`, `outcome_code`, `sla_due_at`, `created_at`.
- `messaging.documents` : `id`, **`introduction_id`** (rattaché à la mise en relation, pas au
  message), `uploaded_by_account_id`, `storage_path`, `label_code` (liste fermée),
  `original_filename` (**stocké pour l'agent, jamais renvoyé à un membre** — c'est un champ de texte
  libre, donc un vecteur de coordonnées : `devis-jean-0612345678.pdf`),
  `content_type check (... in ('application/pdf','image/png','image/jpeg'))`, `byte_size`,
  `moderation_status`, `moderated_by_agent_id`, `moderated_at`, `rejection_reason_code`,
  `created_at`.

  > **Conditionnelle.** Le canal de documents est une **proposition** de `messaging-spec` (question
  > ouverte n° 4, arbitre : le fondateur). Si elle est écartée, ces deux tables ne sont pas créées :
  > aucune autre table n'en dépend.

---

### 5.8 `leads` — la file de synchronisation (Lot 1)

#### `leads.outbox_events`

*Une ligne par (fait métier, destination).* Insérée **dans la même transaction que le fait**, ce qui
garantit qu'il n'existe ni fait sans événement, ni événement sans fait.

| Colonne | Type | Contrainte |
|---|---|---|
| `id` | `bigint` | `generated always as identity` PK — interne, jamais exposé |
| `event_id` | `uuid` | `not null` — regroupe les lignes d'un même fait |
| `event_type` | `text` | `not null references audit.event_types(code)` — nommé **au passé** |
| `destination` | `leads.outbox_destination` | `not null` — `brevo_contact` · `apollo_contact` · `brevo_transactional` |
| `subject_key` | `text` | `not null` — clé d'ordonnancement (identifiant du lead ou de la mise en relation) |
| `priority` | `smallint` | `not null default 100 check (between 0 and 1000)` — `0` = urgent |
| `payload` | `jsonb` | `not null check (pg_column_size(payload) <= 4000)` — **identifiants uniquement** |
| `idempotency_key` | `text` | `not null` |
| `status` | `leads.outbox_status` | `not null default 'pending'` |
| `skip_reason` | `text` | `check (status <> 'skipped' or skip_reason is not null)` |
| `attempts` | `smallint` | `not null default 0 check (attempts <= 10)` |
| `available_at` | `timestamptz` | `not null default now()` |
| `last_error_code`, `last_error_message` | `text` | **Cause en clair**, lisible au backoffice |
| `provider_message_id` | `text` | **Le `messageId` de Brevo** — le lien entre notre registre et la preuve détenue par un tiers (M2) |
| `provider_contact_id` | `text` | Identifiant du contact chez le destinataire |
| `locked_by`, `locked_at` | `text`, `timestamptz` | Observabilité du worker |
| `created_at`, `updated_at`, `completed_at` | `timestamptz` | — |

`unique (destination, idempotency_key)` : un rejeu ne peut pas créer de doublon côté Brevo ou Apollo,
**même si le backoffice le demande deux fois**.

**La contrainte qui protège la connexion des membres** (RG35, §5.1) :

```sql
alter table leads.outbox_events
  add constraint outbox_transactional_never_needs_consent
      check (destination <> 'brevo_transactional' or skip_reason is distinct from 'no_consent');

comment on constraint outbox_transactional_never_needs_consent on leads.outbox_events is
  'RG35 : un e-mail transactionnel (dont le code de connexion, D37) ne peut JAMAIS etre ignore
   pour defaut de consentement marketing. Un retrait de consentement qui rendrait un membre
   incapable de se connecter serait un defaut bloquant : la base le rend impossible.';
```

Requête de prise de lot du worker (document `02` §6), et les index qu'elle justifie au §10.4 :

```sql
select *
  from leads.outbox_events
 where status = 'pending' and available_at <= now()
 order by priority, available_at, id
 limit 20
 for update skip locked;
```

#### `leads.contact_sync_states`

`(account_id, destination)` PK, `external_contact_id`, `last_attempt_at`, `last_success_at`,
`last_status`, `last_error_code`, `unsubscribed_at`, `suppressed_reason`, `updated_at`, plus
`check (destination <> 'brevo_transactional')` : **le canal qui porte le code de connexion n'a pas
d'état de désinscription** — son état de santé vit dans `identity` (§5.1), là où se trouve
l'authentification.

**Dénormalisation assumée n° 2 (§10.7).** L'écran « inscrits et état de synchronisation » du Lot 1
affiche une ligne par compte avec son état Brevo et son état Apollo. Le calculer par agrégation sur
`outbox_events` imposerait un `DISTINCT ON` sur toute la file à chaque affichage. Une ligne par
(compte, destination), mise à jour par le worker, est la bonne forme.

**La désinscription revenant de Brevo n'ouvre pas une troisième table** : elle écrit un
`identity.consent_events` (`granted = false`, `source = 'brevo_webhook'`) **et** pose
`unsubscribed_at` ici. La vérité du consentement reste à un seul endroit.

#### `leads.sync_settings` — la configuration est une donnée (Lot 1)

*Le périmètre Apollo, la base légale par pays, les pays exclus, les plafonds de débit et le calendrier
de nouvelles tentatives.* La spécification `05` l'exige explicitement : **modifiable sans
redéploiement, et chaque modification journalisée** (RG81).

| Colonne | Type | Contrainte |
|---|---|---|
| `key` | `text` | **PK**, `check (key in ('apollo_scope','apollo_blocked_countries','apollo_legal_basis_by_country','retry_schedule','rate_limits'))` |
| `value` | `jsonb` | `not null` |
| `updated_by_account_id` | `uuid` | `not null` FK |
| `updated_at` | `timestamptz` | `not null` |

`apollo_scope` prend l'une des trois valeurs de RG81 (`annonceurs_seuls`,
`annonceurs_et_createurs_pro`, `tous_les_inscrits`), avec **`annonceurs_et_createurs_pro` comme
valeur d'attente chargée par la migration** — c'est la position conservatrice tant que D33 n'est pas
levée, et elle n'est **applicable que parce que `declared_status` existe dès le Lot 1** (§5.1).

Trois garanties : l'écriture est réservée à `influx_admin` par une fonction `SECURITY DEFINER` qui
écrit un événement chaîné `leads.setting_changed` (ancienne et nouvelle valeur dans le `payload`) ;
la lecture se fait **à chaque consommation d'événement**, jamais au démarrage du worker ; et un
changement de périmètre **met en file la réévaluation** des comptes précédemment ignorés pour ce
motif — la bascule de D33 est donc une mise à jour de ligne, pas un développement.

> **Une clé/valeur, et j'assume l'exception.** Je refuse habituellement les tables fourre-tout : elles
> ne se contraignent pas et deviennent illisibles. Ici, la liste des clés est **fermée par un
> `CHECK`**, chaque valeur a un schéma zod dans `packages/contracts`, et l'alternative — une colonne
> par réglage — imposerait une migration à chaque nouveau paramètre, c'est-à-dire exactement ce que la
> règle « modifiable sans redéploiement » cherche à éviter.

---

### 5.9 `billing` — les taux (vides) et les affaires

#### `billing.commission_rates` — **créée et vide** (Lot 0)

| Colonne | Type | Contrainte |
|---|---|---|
| `id` | `uuid` | PK |
| `scope` | `billing.rate_scope` | `not null` — `platform_default` · `account` |
| `account_id` | `uuid` | FK, `check ((scope = 'account') = (account_id is not null))` |
| `advertiser_rate_bp` | `integer` | `not null check (between 0 and 10000)` — **points de base entiers** |
| `creator_rate_bp` | `integer` | `not null check (between 0 and 10000)` |
| — | — | `check (advertiser_rate_bp + creator_rate_bp <= 10000)` |
| `effective_from` | `timestamptz` | `not null` |
| `effective_to` | `timestamptz` | `check (effective_to is null or effective_to > effective_from)` |
| `note` | `text` | — |
| `created_by_account_id` | `uuid` | `not null` FK |
| `created_at` | `timestamptz` | `not null` |

```sql
comment on table billing.commission_rates is
  'Taux de commission de la plateforme, en points de base entiers (2000 = 20,00 %).
   CETTE TABLE EST VOLONTAIREMENT VIDE AU MVP (arbitrage A1 du 2026-09-18).
   Aucun taux et aucun calcul de commission n''existe dans le code du MVP : le commercial
   saisit le montant negocie et le montant de commission convenu, l''application les
   enregistre et les controle l''un par rapport a l''autre, elle ne les calcule pas.
   Elle existe des le Lot 0 comme GARDE-FOU : elle oblige le developpeur de la V2 a lire
   les taux en base plutot qu''a ecrire 0.35 en dur (CLAUDE.md §6, un seul endroit).
   AUCUN ROLE APPLICATIF N''A DE DROIT D''INSERTION : la remplir exigera une migration relue.';

revoke insert, update, delete on billing.commission_rates
  from influx_advertiser, influx_creator, influx_agent, influx_admin, influx_service;
grant select on billing.commission_rates to influx_agent, influx_admin;
```

Le retrait du droit d'insertion à **tous** les rôles, y compris `influx_service`, est ce qui
transforme l'intention en garantie : au MVP, il est **impossible** de remplir cette table depuis
l'application. La remplir sera un acte délibéré, écrit, relu et versionné.

#### `billing.deals` — le pipeline commercial (Lot 5)

> **Note d'emplacement.** Le plan d'exécution range `deals` dans le domaine `backoffice`.
> `01-intermediation-courtee.md` §9 et `02-architecture-3-espaces.md` §8 le rangent dans `billing`.
> Je suis `billing` : c'est le domaine de `apps/api` qui porte l'objet, et c'est là que le module de
> facturation de la V2 viendra le rejoindre. Le **pipeline** reste un écran du backoffice ; l'objet
> est financier.

| Colonne | Type | Contrainte |
|---|---|---|
| `id` | `uuid` | PK |
| `introduction_id` | `uuid` | `not null unique references matching.introductions(id)` — **pas d'affaire orpheline** |
| `owner_agent_id` | `uuid` | `not null` FK interne |
| `state` | `billing.deal_state` | `not null default 'open'` |
| `revealed_at` | `timestamptz` | `not null` — **copie** de `identity_revealed_at` (R7), ce qui rend la contrainte chronologique déclarative |
| `currency` | `char(3)` | FK `reference.currencies` |
| `negotiated_amount_minor` | `bigint` | `check (negotiated_amount_minor is null or negotiated_amount_minor > 0)` |
| `agreed_commission_amount_minor` | `bigint` | `check (… > 0)` |
| `agreed_commission_note` | `text` | Texte libre (« barème standard 35 % »), **jamais un taux exploité par le code** |
| `contract_sent_at`, `contract_sent_channel` | — | `email` · `docusign` · `in_person` · `other` |
| `signed_at` | `timestamptz` | — |
| `commission_invoiced_at`, `commission_invoice_ref` | — | Référence de facture **externe** |
| `commission_received_amount_minor`, `commission_received_at` | — | — |
| `commission_shortfall_note` | `text` | Justification obligatoire si encaissé < convenu |
| `lost_reason_code`, `lost_at` | — | FK `billing.lost_reasons` |
| `disputed_note` | `text` | — |
| `stalled_since` | `timestamptz` | Alimenté par la tâche quotidienne |
| `created_at`, `updated_at` | `timestamptz` | `not null` |

Les contraintes financières, **toutes déclaratives** :

```sql
alter table billing.deals
  add constraint deals_amount_needs_currency
      check (num_nonnulls(negotiated_amount_minor, agreed_commission_amount_minor,
                          commission_received_amount_minor) = 0 or currency is not null),
  add constraint deals_commission_within_amount
      check (agreed_commission_amount_minor is null
             or negotiated_amount_minor is null
             or agreed_commission_amount_minor <= negotiated_amount_minor),
  add constraint deals_received_within_agreed
      check (commission_received_amount_minor is null
             or agreed_commission_amount_minor is null
             or commission_received_amount_minor <= agreed_commission_amount_minor
             or commission_shortfall_note is not null),
  add constraint deals_signed_after_reveal
      check (signed_at is null or signed_at >= revealed_at),
  add constraint deals_chronology
      check (coalesce(commission_received_at, 'infinity') >= coalesce(commission_invoiced_at,'-infinity')
         and coalesce(commission_invoiced_at,'infinity')  >= coalesce(signed_at,'-infinity')),
  -- champs obligatoires par etat (document 01 §6.1)
  add constraint deals_negotiating_requires_amount
      check (state <> 'negotiating' or (negotiated_amount_minor is not null and currency is not null)),
  add constraint deals_contract_sent_requires_channel
      check (state <> 'contract_sent' or (contract_sent_at is not null and contract_sent_channel is not null)),
  add constraint deals_signed_requires_commission
      check (state <> 'signed' or (signed_at is not null and negotiated_amount_minor is not null
             and agreed_commission_amount_minor is not null)),
  add constraint deals_lost_requires_reason
      check (state <> 'lost' or lost_reason_code is not null);
```

C'est l'illustration la plus nette de la doctrine : **l'exemple de référence du document `01` §6.3
(2 000,00 EUR, commission 700,00 EUR) est vérifié par la base**, pas par un formulaire.
700 000 ≤ 2 000 000 est une contrainte ; le net créateur affiché (1 300,00) est une **soustraction à
la lecture**, jamais une colonne — une colonne calculée serait déjà un début de moteur de commission.

**Transitions** : table `billing.deal_state_transitions (from_state, to_state)` alimentée par la
migration, plus un déclencheur qui refuse toute transition absente. Changer les règles de transition
devient une ligne de données, pas un déploiement.

**Devise immuable après signature** : le même déclencheur refuse un changement de `currency` lorsque
`state` a dépassé `signed`.

#### `billing.deal_field_changes`

*Toute modification d'un montant ou d'une date est historisée : qui, quand, ancienne valeur, nouvelle
valeur.* Écrite par un **déclencheur**, pas par le code applicatif — c'est ce qui la rend
incontournable.

`id bigint identity`, `deal_id`, `field_name text not null`, `old_value text`, `new_value text`,
`changed_by_account_id not null`, `changed_at not null`, `reason text`.

Append-only. « Un montant écrasé sans trace est un montant perdu » (document `01` §6.2).

---

### 5.10 `backoffice` — pilotage interne

| Table | Rôle | Lot |
|---|---|---|
| `backoffice.ownership_assignments` | **Historique des commerciaux responsables successifs.** `account_id` / `introduction_id` / `deal_id` nullables avec `check (num_nonnulls(...) = 1)`, `agent_account_id`, `assigned_at`, `unassigned_at`, `assigned_by_account_id`, `reason_code`. `backoffice-ops` règle 18 : l'historique est conservé, pas écrasé | 0 |
| `backoffice.sla_policies` | `queue_code` PK, `target_claim_minutes`, `target_decision_minutes`, `business_hours jsonb`, `escalate_after_minutes`, `is_active`. **D39 tranchée : décision sous 1 jour ouvré.** Valeur de départ chargée par la migration `0102` — `target_decision_minutes = 480` (un jour ouvré de 8 h), `escalate_after_minutes = 480`, `business_hours` couvrant du lundi au vendredi. **Le délai reste une donnée, pas une constante** : le resserrer sera une mise à jour de ligne | 1 |
| `backoffice.internal_notes` | Notes internes **immuables** (on ajoute, on ne corrige pas), rattachées à exactement un sujet | 5 |
| `backoffice.account_suspensions` | `account_id`, `reason_code`, `comment`, `started_at`, `ended_at`, `suspended_by`, `lifted_by`. Le motif **n'est jamais divulgué à l'autre partie** d'une conversation | 5 |
| `backoffice.email_send_limits` | `(role_code, source)` PK, `max_recipients_per_send`, `max_recipients_per_day`. **Les plafonds de D35 sont des données** | 5 |
| `backoffice.email_sends` | `source` (`platform_contacts` · `brevo_segment` · `manual_entry`), `legal_basis`, `created_by_agent_id`, `subject`, `template_ref`, `status`, `scheduled_for`, **`cancel_window_ends_at`** (fenêtre d'annulation de 5 min), `confirmed_at`, `confirmed_by_account_id`, `recipient_count` | 5 |
| `backoffice.email_send_recipients` | `email_send_id`, `account_id` (nullable), `email_address`, `consent_checked_at`, `status`, `provider_message_id`, `skip_reason`. `unique (email_send_id, email_address)` | 5 |
| `backoffice.data_subject_requests` | `request_type` (`access` · `rectification` · `erasure` · `portability` · `objection` · `restriction`), `received_at`, `due_at` (= reçu + 30 jours, colonne **générée**), `status`, `handled_by_agent_id`, `completed_at`, `outcome_code` | 5 |

**`backoffice.email_sends` est la table la plus sensible du backoffice** : elle porte un risque
juridique direct (A4, D35, veto `expert-conformite-rgpd`). Trois garanties en base :
`check (source <> 'manual_entry' or confirmed_at is not null)` — la saisie libre exige la
confirmation différée ; `check (recipient_count <= …)` contrôlé par déclencheur contre
`email_send_limits` ; et `consent_checked_at not null` sur chaque destinataire de source
`platform_contacts`.

---

### 5.11 Le stockage de fichiers (Supabase Storage)

Quatre compartiments, **tous privés**, sans exception.

| Compartiment | Contenu | Écriture | Lecture |
|---|---|---|---|
| `verification-evidence` | Captures et pièces de vérification | Le créateur (URL signée, ≤ 5 min) | **Agents seulement.** Jamais un annonceur, jamais un autre créateur |
| `portfolio` | Visuels de portfolio | Le créateur | Agents ; annonceurs **uniquement** si `moderation_status = 'approved'` |
| `introduction-documents` | Canal de documents (si D30/Q4 le retient) | Participants d'une mise en relation | Contrepartie **après** modération |
| `legal-documents` | Versions publiées des CGU et politiques | Administrateur | Tout le monde, par URL signée longue |

Règles communes, alignées sur les RLS des tables correspondantes :

1. **Le chemin encode le propriétaire** : `verification-evidence/<account_id>/<request_id>/<uuid>.png`.
   Les politiques du Storage comparent le premier segment à `influx.current_account_id()`.
2. **Aucune lecture directe** : toute lecture passe par une URL signée émise par `apps/api` après
   contrôle, de durée courte, **dont l'émission est journalisée** (exception E1 du document `02`).
3. **Une ligne en base pour chaque objet stocké.** Un fichier sans ligne est un orphelin : une tâche
   hebdomadaire les liste et alerte.
4. **La suppression d'un fichier suit la rétention de sa ligne**, jamais l'inverse.

---

## 6. Les politiques RLS — principes et exemples

> **Arbitrage : `expert-cybersecurite`, document `03`.** Ce qui suit est une proposition de
> `expert-database`, destinée à être reprise, corrigée et complétée table par table dans la matrice
> des droits. Je ne décris ici que les **principes de mise en œuvre** et **quatre politiques types**.

### 6.1 Les cinq principes

1. **`ENABLE` et `FORCE ROW LEVEL SECURITY` sur toutes les tables**, sans exception, y compris les
   tables de référence. `FORCE` soumet aussi le propriétaire : sans lui, une migration exécutée sous
   le rôle propriétaire ignorerait silencieusement toutes les politiques.
2. **Refus par défaut.** Une table sans politique est inaccessible. Une table nouvelle sans ligne
   dans la matrice du document `03` **fait échouer la CI** (document `02` §10.3).
3. **Politiques ciblées par rôle** (`to influx_advertiser`), pour que leur coût d'évaluation soit nul
   pour les autres rôles.
4. **Le droit avant la politique.** Quand une donnée ne doit jamais être lue par un rôle, on **ne
   donne pas le `GRANT`**. Une politique est un filtre ; l'absence de droit est un mur.
5. **`ALTER DEFAULT PRIVILEGES` par schéma**, pour que l'oubli d'un `REVOKE` sur une table future ne
   soit pas une faille (§7.5).

### 6.2 Cinq politiques types

**(a) La révélation d'identité — la politique la plus importante du produit.**

```sql
create policy social_accounts_revealed_to_advertiser
  on profiles.creator_social_accounts
  for select to influx_advertiser
  using (exists (
    select 1
      from matching.introductions i
     where i.creator_account_id    = creator_social_accounts.creator_account_id
       and i.advertiser_account_id = (select influx.current_account_id())
       and i.identity_revealed_at is not null
  ));
```

Adossée à l'index du §10.5. C'est la formulation annoncée par `architecte` au §2.5 du document `02`,
appliquée à l'**objet révélable** et non à l'objet identifiant.

**(b) La vitrine anonymisée.**

```sql
create policy public_profiles_visible_to_advertisers
  on profiles.creator_public_profiles
  for select to influx_advertiser
  using (status = 'published' and is_searchable);
```

Les garde-fous de forme (k-anonymat, pagination plafonnée, limitation de débit, export interdit) ne
sont **pas** exprimables ici : ce sont des règles sur la forme des requêtes, appliquées par
`apps/api` (document `02` §10.2, point 5).

**(c) L'objet jamais révélé.**

```sql
-- Aucun GRANT au rôle annonceur : il n'y a pas de politique a ecrire pour lui.
revoke all on profiles.creator_identities from influx_advertiser;

create policy creator_identities_owner
  on profiles.creator_identities
  for all to influx_creator
  using (account_id = (select influx.current_account_id()))
  with check (account_id = (select influx.current_account_id()));

create policy creator_identities_internal
  on profiles.creator_identities
  for select to influx_agent, influx_admin
  using ((select influx.has_aal2()));
```

**(d) La révélation symétrique, côté marque (D40).** Exactement la même forme que (a), miroir près :

```sql
grant select (account_id, contact_first_name, contact_role, contact_email, contact_phone, contact_url)
  on profiles.advertiser_contact_details to influx_creator;

create policy advertiser_contacts_revealed_to_creator
  on profiles.advertiser_contact_details
  for select to influx_creator
  using (exists (
    select 1
      from matching.introductions i
     where i.advertiser_account_id = advertiser_contact_details.account_id
       and i.creator_account_id    = (select influx.current_account_id())
       and i.identity_revealed_at is not null
  ));
```

**Le même index sert les deux politiques** : `(advertiser_account_id, creator_account_id) where
identity_revealed_at is not null` reçoit deux égalités dans les deux sens de lecture. D40 ne coûte
donc **aucun index supplémentaire** (§10.5).

**(e) Le registre, en insertion seule.**

```sql
alter table audit.audit_events enable row level security;
alter table audit.audit_events force row level security;

revoke update, delete, truncate on audit.audit_events from public;
revoke update, delete, truncate on audit.audit_events
  from influx_advertiser, influx_creator, influx_agent, influx_admin, influx_service, influx_app;

create trigger audit_events_no_update_delete
  before update or delete on audit.audit_events
  for each row execute function influx.assert_append_only();

create trigger audit_events_no_truncate
  before truncate on audit.audit_events
  for each statement execute function influx.assert_append_only();
```

### 6.3 Qui lit quoi — vue d'ensemble proposée

`L` = lecture · `E` = écriture · `F` = à travers une fonction `SECURITY DEFINER` seulement ·
`—` = **aucun droit**.

| Table | annonceur | créateur | agent | admin | service |
|---|---|---|---|---|---|
| `identity.accounts` | L (sa ligne) | L (sa ligne) | L | L / E | L / E |
| `identity.terms_acceptances` | L (les siennes) + E | idem | L | L | E |
| `identity.consent_events` | L + E | L + E | L | L + E | L + E |
| `profiles.creator_public_*` | **L** | L + E (les siennes) | L | L | L |
| `profiles.creator_social_accounts` | **L après révélation, colonnes limitées** | L + E | L | L | L |
| `profiles.creator_identities` | **—** | L + E | L | L | L |
| `profiles.advertiser_contact_details` | L + E (la sienne) | **L après révélation, colonnes limitées** (D40) | L | L | L |
| `verification.evidence_files` | **—** | L (les siennes) | L (journalisé) | L | — |
| `campaigns.campaigns` | L + E (les siennes) | L (publiées, sans budget total) | L | L | L |
| `matching.introductions` | L (les siennes) | L (les siennes) | L + E | L + E | F |
| `matching.introductions.identity_revealed_at` | — | — | **F** | **F** | **F** |
| `messaging.messages` | L (ses fils) + E | L (ses fils) + E | **F** | **F** | — |
| `messaging.conversation_access_log` | — | — | E (par la fonction) | L | L |
| `billing.deals` | **—** | **—** | L + E | L + E | L |
| `billing.commission_rates` | — | — | L | L | — |
| `audit.audit_events` | — | — | L (filtré) | L | **insertion seule** |
| `leads.outbox_events` | — | — | L + rejeu | L + rejeu | L + E |

Les cases les plus significatives : **l'annonceur n'a aucun droit sur `creator_identities` ni sur
`billing.deals`** ; **personne ne peut modifier le registre**, y compris le rôle de service ;
**les agents ne lisent les messages qu'à travers la fonction qui journalise**.

---

## 7. Réponse aux six points du §14.2 du document `02`

### 7.1 — Forme exacte de `creator_identity` / `creator_public_profile`

**Décision : trois tables réelles, aucune vue, aucune vue matérialisée.**

| Option | Verdict | Motif |
|---|---|---|
| **Tables séparées** | **Retenue** | C'est la seule forme où « aucun `GRANT` au rôle annonceur » est littéralement vrai. Les deux objets ont des cycles de vie différents (la vitrine est publiée et modérée, l'identité ne l'est pas), des volumes de mise à jour différents, et des politiques simples à écrire et à tester |
| Table + vue `security_invoker = true` | **Écartée** | Une vue `security_invoker` s'exécute avec **les droits de l'appelant** : l'annonceur aurait besoin d'un `SELECT` sur la table identifiante sous-jacente. On retomberait sur « un droit existe, mais une politique le restreint » — précisément ce que l'architecture refuse. Une vue **sans** `security_invoker` contournerait la RLS : pire encore |
| Vue matérialisée | **Écartée** | PostgreSQL **n'applique pas la RLS sur une vue matérialisée** ; il faudrait la protéger par des droits seuls. S'y ajoutent la fraîcheur (un badge retiré resterait visible jusqu'au rafraîchissement — inacceptable pour une donnée qui engage la responsabilité d'INFLUX), le verrou du rafraîchissement, et l'obligation d'un index unique pour `REFRESH CONCURRENTLY`. Aucun gain : au volume du pilote, la lecture des tables est déjà instantanée |

**Précision par rapport au document `02` : il y a trois objets, pas deux** (§5.2). L'objet
intermédiaire, `creator_social_accounts`, est celui que la révélation ouvre — sur un sous-ensemble de
colonnes. L'objet identifiant, lui, n'est **jamais** ouvert à une marque.

**Comment les deux restent cohérents :** `apps/api` écrit les deux dans **la même transaction**, les
tranches étant calculées par `packages/domain` (fonction pure, testée). La garantie n'est pas la
discipline du développeur : c'est que **la table publique ne possède aucune colonne capable
d'accueillir une valeur exacte**. On ne peut pas y fuiter un nombre d'abonnés, faute d'endroit où
l'écrire.

### 7.2 — Chaînage : algorithme, sérialisation, séquence, vérification

**Algorithme.** `sha256`, fonction native de PostgreSQL depuis la version 11 (aucune extension).
Deux empreintes par ligne :

```
payload_hash = sha256( forme_canonique )
row_hash     = sha256( prev_hash || payload_hash )
```

**Forme canonique** — concaténation d'un ordre fixe, jamais une sérialisation implicite :

```
chain_key | seq | occurred_at (ISO 8601 UTC, microsecondes) | event_type |
actor_account_id (ou '-') | subject_type:subject_id | payload::text
```

`payload::text` sur un `jsonb` est déterministe pour une version majeure de PostgreSQL donnée (les
clés y sont normalisées). Comme ce n'est pas garanti **entre** versions majeures, les colonnes
`hash_algo` et `hash_version` existent dès le premier jour : un changement de forme canonique devient
une décision explicite, et le vérificateur sait traiter les deux formats.

**Sérialisation, et que se passe-t-il si deux écritures arrivent en même temps.**

```sql
perform pg_advisory_xact_lock(hashtextextended('audit.chain:' || p_chain_key, 0));
```

- Le verrou est **de transaction** (`_xact_`), obligatoire : les verrous de session ne survivent pas
  au multiplexeur Supabase en mode transaction (document `02` §5, point 4).
- La transaction B qui arrive pendant que A détient le verrou **attend**. Quand A valide, le verrou
  est libéré au `COMMIT` et B lit alors le maillon que A vient d'écrire. Il n'y a jamais deux lecteurs
  du même « dernier maillon ».
- Si A **annule**, son maillon n'a jamais existé : B lit le maillon précédent et prend le même `seq`.
  **La séquence reste sans trou**, ce qu'une séquence PostgreSQL ne saurait pas garantir.
- Ceinture supplémentaire : `unique (chain_key, prev_hash)`. Même si le verrou était contourné, une
  bifurcation **échouerait** au lieu de passer.

**Trois règles d'usage qui font partie de la décision :**

1. **La ligne de registre est écrite le plus tard possible** dans la transaction métier. Le verrou est
   détenu jusqu'au `COMMIT` : le prendre tôt, c'est faire attendre tout le monde.
2. **Aucun appel réseau dans une transaction qui écrit le registre.** Un appel Brevo de 3 secondes
   sous verrou bloque toute la plateforme pendant 3 secondes.
3. **Toujours prendre le verrou de chaîne en dernier**, après tous les verrous de ligne, pour écarter
   le risque d'interblocage.

**Débit.** Une insertion sous verrou coûte environ 0,3 ms (lecture indexée du dernier maillon +
deux `sha256` + insertion) : de l'ordre de **3 000 événements par seconde**. Le pilote en produira
quelques centaines par jour. La sérialisation globale n'est donc pas un sujet — et si elle le
devenait, la colonne `chain_key` permet de partitionner la chaîne **sans migration de schéma**.

**Une seule chaîne, et `introduction_events` est une vue.** Deux chaînes (une globale, une par mise
en relation) donneraient un extrait de preuve auto-portant par affaire, ce qui est séduisant. Mais
elles laisseraient un angle mort : la suppression de **toute** une chaîne d'introduction serait
indétectable, aucune autre chaîne ne la référençant. Une chaîne unique n'a pas ce défaut, se vérifie
en un seul parcours, et l'extrait par mise en relation reste possible (filtrage par `subject_id`, les
`seq` conservés montrant sa position dans l'ensemble). **À confirmer par `expert-cybersecurite`.**

**Vérification, une requête qui tient en dix lignes :**

```sql
select e.seq,
       case
         when p.seq is null and e.seq > 1               then 'gap'
         when e.seq > 1 and e.prev_hash <> p.row_hash   then 'broken_link'
         when e.row_hash <> sha256(e.prev_hash || e.payload_hash) then 'broken_row'
       end as anomaly
  from audit.audit_events e
  left join audit.audit_events p
         on p.chain_key = e.chain_key and p.seq = e.seq - 1
 where e.chain_key = 'global'
   and e.seq > $1                      -- depuis la derniere verification
 order by e.seq;
```

Résultat écrit dans `audit.chain_checks`. Toute anomalie est une **alerte immédiate** (document `02`
§11.3). Périodicité : incrémentale chaque nuit, complète chaque semaine tant que la table tient sous
le million de lignes.

**L'honnêteté due, une fois pour toutes.** Le propriétaire du projet Supabase peut désactiver un
déclencheur, restaurer une sauvegarde ou détruire la table. **Aucune construction en base ne protège
contre celui qui détient la base.** Cette garantie protège contre le code, contre une migration
distraite et contre un agent — pas contre INFLUX lui-même. C'est exactement ce que dit
`01-intermediation-courtee.md` §M4 (« preuve auto-produite »). **Parade à coût nul, recommandée :**
publier chaque mois `chain_checks.head_row_hash` hors de la base (e-mail au fondateur, journal
Railway archivé). Une empreinte de 64 caractères envoyée à un tiers le 1er de chaque mois transforme
une preuve interne en preuve **ancrée**, pour zéro euro.

### 7.3 — Coût réel de la lecture du rôle en base, et comment le mesurer

**Trois constats, dont le troisième compte plus que les deux autres.**

1. **Résoudre le rôle coûte un second accès index, et rien de plus.** `apps/api` doit de toute façon
   obtenir `account_id` à partir de `auth.uid()` au début de chaque transaction. Depuis D41, le rôle
   n'est plus sur cette ligne : il se lit dans `identity.account_roles`, par la clé primaire. Les deux
   lectures se font **en une seule requête jointe**, de l'ordre de **0,1 à 0,2 ms**, à comparer aux
   2 à 5 ms d'une requête HTTP complète. Le compromis « révocation immédiate contre performance » de
   D37 se paie donc **moins de 5 %** d'une requête — c'est le prix, mesuré, de la préparation au
   double rôle, et il est négligeable.
2. **Le coût réel n'est pas la lecture, c'est l'endroit où on l'écrit.** Une politique qui appelle
   `influx.current_account_id()` **nu** fait évaluer la fonction **par ligne examinée** : sur un
   balayage de 5 000 profils, c'est 5 000 accès index, soit environ 250 ms **par requête**. La même
   politique écrite `(select influx.current_account_id())` produit un **InitPlan** évalué **une seule
   fois** : environ 0,1 ms. Le rapport est de 1 à 2 500. D'où la règle du §4.1, qui est un point de
   revue bloquant.
3. **Avec quatre rôles PostgreSQL (§3.2), la lecture du rôle disparaît des politiques.** C'est aussi
   ce qui rendra le double rôle (D41) mécanique le jour venu : le rôle est déjà porté par la
   transaction, pas par le compte. Le rôle
   métier est porté par le rôle PostgreSQL de la transaction ; les politiques sont ciblées
   `to influx_advertiser` et PostgreSQL ne les évalue même pas pour les autres. `current_account_role()`
   ne sert plus que côté API. **C'est le vrai gain**, et il est structurel.

**Protocole de mesure, à exécuter au Lot 0 et à consigner dans le document `18` :**

| Étape | Méthode | Seuil |
|---|---|---|
| Jeu d'essai | 50 000 comptes, 20 000 profils publiés, 200 000 messages, générés par `supabase/seed` | — |
| Mesure unitaire | `explain (analyze, buffers)` sur cinq requêtes types (recherche, fil de conversation, file de validation, liste d'affaires, journal de sync), **avec et sans RLS** (`set role`) | Surcoût RLS **< 10 %** du temps total |
| Mesure du piège | La même politique écrite nue puis enveloppée dans `(select …)` | Doit figurer au rapport : c'est la démonstration qui empêchera la régression |
| Surveillance continue | `pg_stat_statements` sur `mean_exec_time` des dix requêtes les plus fréquentes | Alerte si le p95 double d'un lot à l'autre |

Si le seuil de 10 % était dépassé sans explication, l'échappatoire (dans cet ordre) : mettre le rôle
en cache dans `apps/api` pour la durée d'une requête HTTP — **jamais au-delà**, sinon la révocation
immédiate, qui est la raison d'être de ce choix, serait perdue.

### 7.4 — Index de `outbox_events` et des files de validation

Trois index, pas un de plus, chacun adossé à une requête réelle. Détail et requêtes au **§10.4**.

```sql
-- (1) la boucle du worker, la requete la plus frequente du systeme
create index outbox_events_claim_idx
  on leads.outbox_events (priority, available_at, id)
  where status = 'pending';

-- (2) l'ecran « echecs de synchronisation » du backoffice
create index outbox_events_failed_idx
  on leads.outbox_events (updated_at desc)
  where status = 'failed';

-- (3) l'idempotence : garantie fonctionnelle, pas optimisation
create unique index outbox_events_idempotency_idx
  on leads.outbox_events (destination, idempotency_key);
```

Trois remarques qui font partie de la décision :

- **L'index partiel est ici bien plus qu'une optimisation.** La file est une table où 99 % des lignes
  finissent en `succeeded` ; un index total grossirait indéfiniment alors que la requête ne regarde
  jamais ces lignes. L'index partiel reste de la taille de la file **en attente**, c'est-à-dire
  quelques dizaines de lignes.
- **Le passage `pending → succeeded` retire la ligne de l'index**, ce qui empêche les mises à jour
  HOT et fabrique des lignes mortes. À notre volume c'est sans effet ; la parade, si un jour elle
  devient utile, est un `autovacuum_vacuum_scale_factor` abaissé sur cette table seule — **pas** un
  index de plus.
- **Pas d'index sur `subject_key`** au Lot 1 : aucune requête ne le filtre. Le verrou consultatif du
  worker le hache, il ne le cherche pas. Il s'ajoutera si l'écran « historique d'un lead » est
  effectivement construit au Lot 5.

Pour les **files de validation**, même raisonnement, deux index partiels :

```sql
create index introductions_queue_idx
  on matching.introductions (sla_due_at, created_at)
  where status in ('pending_review','in_review');

create index verification_requests_queue_idx
  on verification.verification_requests (sla_due_at, created_at)
  where status in ('pending','in_review');
```

Justification : l'écran de file trie par échéance de SLA croissante et ne regarde **jamais** les
entrées décidées. Les deux index restent de la taille de la file ouverte — quelques dizaines de
lignes au pilote, quelques milliers au pire.

### 7.5 — Schémas PostgreSQL par domaine, ou schéma unique

**Décision : un schéma par domaine.** Le gain n'est pas esthétique, il est de **sécurité** et il tient
en deux lignes de SQL :

```sql
revoke all on all tables in schema verification from influx_advertiser;
alter default privileges in schema verification revoke all on tables from influx_advertiser;
```

La seconde ligne est celle qui compte : **toute table créée plus tard dans ce schéma sera
inaccessible au rôle annonceur, sans que personne n'ait à y penser.** Dans un schéma unique, la même
garantie exigerait de se souvenir d'un `REVOKE` à chaque `CREATE TABLE` — et c'est exactement le type
d'oubli que le document `02` §2.2 décrit comme « silencieux, sans erreur, sans test rouge ».

Quatre bénéfices secondaires : la frontière de domaine de `apps/api` devient visible dans le SQL (un
`repository.ts` qui interroge un schéma étranger se voit en revue) ; `public` reste vide, donc
PostgREST n'expose rien ; les sauvegardes et exports partiels par domaine deviennent triviaux ; et
les noms se raccourcissent (`introductions` plutôt que `matching_introductions`).

Trois coûts, assumés :

| Coût | Ampleur | Traitement |
|---|---|---|
| `search_path` explicite partout | Faible | `set search_path` figé dans chaque fonction ; Drizzle déclare ses tables avec `pgSchema('matching')` |
| L'interface Supabase montre mal les schémas non `public` | Réel mais souhaitable | Nous ne travaillons pas depuis l'interface (règle `CLAUDE.md` §8) |
| Un objet mal placé se déplace mal | Faible | `ALTER TABLE … SET SCHEMA` fonctionne, mais casse les vues dépendantes. Le placement se décide à la conception |

Deux conventions complémentaires : **pas de table dans `public`, jamais** ; et **les fonctions
`SECURITY DEFINER` déclarent toujours `set search_path`**, faute de quoi elles sont vulnérables à une
attaque par schéma.

### 7.6 — Rétention et purge

Proposition détaillée au **§9**, à valider par `expert-conformite-rgpd` (veto). En une phrase :
**trois régimes** — ce qui se purge tôt (données techniques, pièces, journaux de recherche), ce qui
suit la vie du compte (profils, messages), et **ce qui ne se purge jamais** (le registre chaîné,
pseudonymisé par construction). La purge est une tâche quotidienne du worker, chaque table ayant sa
colonne d'échéance ou sa règle écrite.

---

## 8. Les règles argent, même sans calcul au MVP

### 8.1 Les cinq règles

1. **Jamais de `float`, `double precision` ni `real`.** Nulle part, pour aucun montant, sous aucun
   prétexte. La revue rejette toute migration qui en contient.
2. **`bigint` en plus petite unité monétaire**, suffixe obligatoire `_amount_minor`. 2 000,00 EUR
   s'écrit `200000`. Le `bigint` couvre 92 millions de milliards de centimes : aucune limite
   pratique.
3. **La devise accompagne le montant, toujours**, en `char(3)` ISO 4217 avec clé étrangère vers
   `reference.currencies`, et une contrainte qui interdit l'un sans l'autre :
   `check (num_nonnulls(amount_minor, currency) <> 1)`.
4. **`reference.currencies.minor_unit` dit comment lire l'entier.** L'affichage et l'analyse la
   lisent ; le code ne suppose jamais « deux décimales ».
5. **Aucun taux, aucune multiplication.** La seule arithmétique du MVP est l'addition et la
   soustraction de montants **saisis**. Le net créateur affiché (1 300,00) est une soustraction à la
   lecture, **jamais une colonne** : une colonne calculée serait un moteur de commission déguisé.

### 8.2 Ce qui est prévu pour que la V2 se branche sans migration douloureuse

| Préparation | Ce qu'elle évite en V2 |
|---|---|
| `billing.commission_rates` **créée, vide, en points de base entiers** | Le développeur de la V2 lit les taux en base. Il ne peut pas écrire `0.35` : la table existe déjà et les colonnes lui disent quoi faire |
| Les **composantes** sont conservées sur `deals` (montant, devise, commission convenue, commission encaissée), pas seulement le résultat | Le barème de la V2 se règle sur des données réelles du pilote, et non sur des souvenirs |
| `deals.introduction_id` **unique et obligatoire** | Le contrat de la V2 se rattache à la même mise en relation : aucune reprise de données, aucune clé à inventer |
| `introductions.identity_revealed_at` **write-once**, `*_country_at_intro`, `*_terms_version_id` | L'assiette de la créance V2 et le point de départ de la fenêtre D29 existent déjà, à la date des faits. **Non reconstituables** plus tard |
| `reference.currencies.minor_unit` | Le premier contrat en yen ou en dinar ne produit pas une erreur d'un facteur 100 ou 1 000 |
| `reference.price_bands (currency, code)` | Rend visible dès aujourd'hui la donnée manquante « taux de conversion » (D27), au lieu de la découvrir en V2 |
| Aucune colonne calculée, aucune vue de calcul | Le calcul de la V2 naîtra **à un seul endroit** (`apps/api/src/domains/billing`), conformément à `CLAUDE.md` §6 |
| `billing.deal_field_changes` alimentée par déclencheur | L'historique des montants du pilote est déjà complet le jour où il devient une pièce comptable |

**Ce qui restera à faire en V2, et qui n'est pas préparé ici** (volontairement, faute de décisions) :
la table `contracts`, l'arrondi et l'attribution du reliquat (D19), les taxes (D7, D23), les
références du prestataire de paiement (D9), les pays ouverts (D26). Aucune de ces décisions n'existe :
les préparer serait inventer.

---

## 9. Conservation, suppression, anonymisation

> **Proposition de `expert-database`. Arbitrage : `expert-conformite-rgpd` (veto).**
> Les durées ci-dessous sont des points de départ argumentés, pas des décisions.

### 9.1 Durées par catégorie

| Catégorie | Tables | Durée proposée | Point de départ | Justification |
|---|---|---|---|---|
| Compte actif | `identity.accounts`, `profiles.*` | Vie du compte + **3 ans** d'inactivité | `last_seen_at` | Un créateur inactif 3 ans n'est plus une offre commerciale |
| Preuves d'acceptation | `identity.terms_acceptances`, `identity.consent_events` | **5 ans** après la fin de la relation | `deleted_at` du compte | Preuve du consentement et de l'acceptation des CGU (durée usuelle de prescription) |
| Pièces de vérification | `verification.evidence_files` | **90 jours** après la décision | `decided_at` | La pièce n'a plus de raison d'être une fois le constat saisi. C'est le constat qui vaut, pas la pièce (`profile-verification` règle 27) |
| Badges et décisions | `verification.badges`, `verification_requests` | **3 ans** | `decided_at` | Historique de responsabilité : INFLUX répond de ce qu'il a affirmé |
| Messages | `messaging.messages` | **3 ans** après la clôture de la conversation | `closed_at` | Preuve d'une négociation d'où peut naître une créance V2 (D29) |
| Journal des lectures | `messaging.conversation_access_log` | **3 ans** | `accessed_at` | Contrepartie de la supervision annoncée (A10) : elle doit être vérifiable aussi longtemps que les échanges |
| Incidents de délivrance | `identity.email_delivery_incidents` | **24 mois** | `occurred_at` | Diagnostic d'un compte fermé et suivi de la réputation d'envoi ; au-delà, sans usage |
| Journal des recherches | `search.search_queries`, `search_impressions` | **12 mois** | `created_at` | Double finalité (anti-aspiration, amélioration produit) ; au-delà, l'intérêt décroît vite |
| File de synchronisation | `leads.outbox_events` | `succeeded` : **30 jours** · `failed` : jusqu'à traitement | `completed_at` | Document `02` §6 |
| Affaires | `billing.deals`, `deal_field_changes` | **10 ans** | `created_at` | Obligation comptable dans la plupart des pays visés. **Aucune suppression physique** (R6) |
| **Registre chaîné** | `audit.audit_events`, `chain_checks` | **Aucune purge** | — | Une chaîne trouée n'est plus une chaîne. Pseudonyme par construction (aucun nom, aucun contenu) |

### 9.2 Ce qui se passe quand un compte demande sa suppression

**Aucune suppression physique.** La procédure, en une transaction :

1. `identity.accounts.deleted_at = now()`, `status = 'deleted'` ; la session est révoquée et l'accès
   fermé immédiatement.
2. **Anonymisation** des données directement identifiantes :
   `accounts.email` remplacé par `deleted+<id>@invalid`, `display_name` par un libellé neutre ;
   `profiles.creator_identities` et `profiles.advertiser_contact_details` **vidées** (les lignes
   restent, les colonnes passent à `null`) ; `creator_social_accounts.handle` et `profile_url`
   effacés ; portfolio et pièces supprimés du Storage.
3. `accounts.anonymized_at = now()`.
4. Un événement `account.anonymized` est écrit **dans le registre**, et un événement
   `account.deleted` part dans `outbox_events` en **priorité 0** vers Brevo et Apollo — la
   propagation de la suppression aux sous-traitants est une obligation, pas une option.

**Ce qui survit, sous forme pseudonymisée** — et qui doit figurer **dans la politique de
confidentialité dès le Lot 1** :

| Ce qui survit | Sous quelle forme | Pourquoi |
|---|---|---|
| **La mise en relation** (`matching.introductions`) | Identifiants de comptes, pays au jour des faits, dates, référence `MER-…`. **Aucun nom** | Preuve d'intermédiation : elle fonde la créance éventuelle de la V2 et la défense d'INFLUX en cas de litige |
| **L'affaire** (`billing.deals`) | Montants, devise, dates, commercial responsable | Obligation comptable. Un euro encaissé doit rester rattaché à un acte |
| **Le registre** (`audit.audit_events`) | Identifiants et codes | Intégrité de la chaîne. Retirer une ligne casse toutes les suivantes |
| **La conversation** (`messaging.*`) | Les messages restent, l'auteur devient « Compte supprimé » pour l'autre partie | `messaging-spec` règle 35 : conservation au titre de la constatation et de la défense de droits |
| **Le journal des lectures** | Identifiant de l'agent, date, conversation | Sans lui, la supervision annoncée deviendrait invérifiable |

> **Sans mention explicite dans la politique de confidentialité, le droit de conserver ces éléments
> n'existe pas** — et tout le dispositif d'intermédiation perd son fondement
> (`messaging-spec` règle 36, `01-intermediation-courtee.md` §M4 point 6). C'est un **prérequis du
> Lot 1**, pas un sujet du Lot 5.

**La clé étrangère `audit_events.actor_account_id → accounts(id) on delete restrict` est le
garde-fou technique** : elle rend le `DELETE` physique d'un compte **impossible**, y compris par un
script d'administration distrait. La suppression logique n'est pas une convention, c'est la seule
opération que la base autorise.

### 9.3 Mise en œuvre de la purge

Une tâche quotidienne du worker, une requête par catégorie, **bornée en volume** (`limit 1000` par
passage) pour ne jamais tenir un verrou long. Chaque purge écrit un résumé dans le registre
(`retention.purged`, avec le nombre de lignes et la catégorie) : **on doit pouvoir prouver que la
rétention est appliquée**, pas seulement écrite.

---

## 10. Les index, et la requête qui justifie chacun

Aucun index de ce chapitre n'est spéculatif. Les clés primaires et les index d'unicité ne sont pas
répétés. **Les clés étrangères ne sont pas indexées par défaut** : seules celles que ce chapitre cite
le sont, parce qu'elles sont réellement interrogées ou qu'une suppression en cascade les parcourrait
(et il n'y a pas de cascade ici).

### 10.1 Identité et session — Lot 0

| Index | Requête qui le justifie |
|---|---|
| `accounts (auth_user_id)` **unique** | `influx.current_account_id()`, exécutée **à chaque requête HTTP**. C'est l'index le plus utilisé du système |
| `account_roles` PK `(account_id, role)` + unique `(account_id)` | Résolution du rôle à chaque transaction, jointe à la précédente. L'unicité **est** la contrainte D41, l'index n'est qu'un effet |
| `accounts (email)` **unique** | Connexion, contrôle d'unicité à l'inscription, recherche backoffice par e-mail |
| `accounts (created_at desc)` | Tableau de bord : « inscriptions du jour », trié par date décroissante |
| `accounts (owner_agent_id) where deleted_at is null` | « Mes comptes » du commercial — prépare le portefeuille (Lot 5, indicateur n° 4) |
| `consent_events (account_id, purpose, occurred_at desc)` | Vérification du consentement **par le worker à chaque envoi** |
| `accounts (email_status) where email_status = 'undeliverable'` | File backoffice « adresses injoignables » (RG61). Index partiel : il ne contient que les comptes fermés, c'est-à-dire presque rien |
| `email_delivery_incidents (provider_event_id)` **unique** | **Idempotence des webhooks Brevo** : garantie fonctionnelle, pas optimisation |
| `email_delivery_incidents (account_id, occurred_at desc)` | Fiche d'un inscrit : « pourquoi cette adresse est-elle injoignable ? » |
| `terms_acceptances (account_id, accepted_at desc)` | Fiche de compte au backoffice : « quelle version a-t-il acceptée, et quand ? » |

### 10.2 Registre — Lot 0

| Index | Requête |
|---|---|
| PK `(chain_key, seq)` | Lecture du dernier maillon (`order by seq desc limit 1`) et parcours de vérification |
| `audit_events (subject_type, subject_id, occurred_at desc)` | « Historique de cet objet » — l'écran le plus utilisé du backoffice après les files |
| `audit_events (occurred_at desc) where event_type in (…critiques…)` | Écran « actions sensibles des dernières 24 h ». **À créer au Lot 5 seulement**, quand l'écran existe |

### 10.3 Profils et recherche — Lots 2 et 3

**Aucun index de facette n'est créé au Lot 3, et c'est une décision.** Avec l'objectif de D38
(≈ 30 profils publiés à l'ouverture, quelques milliers au mieux en fin de pilote), un balayage complet
de `creator_public_profiles` coûte **moins de 5 ms**. Un index sur chaque facette coûterait de
l'écriture à chaque mise à jour de profil, de la place, et **ne serait probablement pas choisi par le
planificateur**.

| Index créé | Requête |
|---|---|
| `creator_public_profiles (status, is_searchable)` — **partiel**, `where status = 'published' and is_searchable` | Toute recherche commence par ce filtre. L'index partiel sert surtout à **compter** rapidement pour le k-anonymat |
| `creator_public_networks (account_id)` | Reconstitution d'une carte de résultat (12 par page) |
| `portfolio_items (account_id, display_order) where moderation_status = 'approved'` | Les 1 à 3 visuels d'une carte, sans jamais toucher les visuels non modérés |
| `verification.badges (expires_at) where state = 'active'` | **Tâche quotidienne de péremption à 90 jours** (D34) : sans cet index, elle balaie toute la table chaque nuit |
| `search_queries (account_id, created_at desc)` | Limitation de débit (30/h, 200/j) et détection d'affinage — lecture à **chaque** recherche |

> **Seuil de réexamen, écrit à l'avance.** Dès que `creator_public_profiles` dépasse **20 000 lignes
> publiées** ou que le p95 de la recherche dépasse **150 ms** mesuré par `pg_stat_statements`, on
> ré-ouvre le sujet. La forme probable sera alors **un index GIN** sur une colonne de facettes
> agrégée, pas dix index btree — mais on le décidera sur des plans d'exécution réels, pas ici.

### 10.4 File de leads — Lot 1

| Index | Requête |
|---|---|
| `outbox_events (priority, available_at, id) where status = 'pending'` | La boucle du worker, **toutes les 2 secondes**. L'ordre des colonnes suit exactement l'`ORDER BY` |
| `outbox_events (updated_at desc) where status = 'failed'` | Écran « échecs de synchronisation », trié par ancienneté |
| `outbox_events (destination, idempotency_key)` **unique** | Garantie d'idempotence au rejeu |
| `contact_sync_states (last_status)` | Liste « inscrits non synchronisés », filtrée par état |

**Pas d'index sur `accounts.declared_status`**, bien qu'il commande le périmètre Apollo : la
réévaluation d'un changement de périmètre (RG81) est une opération **rare** et **par lot**, sur
quelques milliers de comptes au pilote. Un balayage y suffit largement. Il s'ajoutera le jour où la
mesure le demandera, pas avant (R9).

### 10.5 Mise en relation — Lot 4

| Index | Requête |
|---|---|
| `introductions (advertiser_account_id, creator_account_id) where identity_revealed_at is not null` | **Les deux politiques RLS de révélation** (§6.2 a et d). Elle s'exécute pour chaque ligne de `creator_social_accounts` lue par une marque **et** pour chaque `advertiser_contact_details` lue par un créateur (D40) : les deux colonnes sont fournies en égalité dans les deux sens, donc **un seul index suffit**. Sans lui, chaque consultation de profil deviendrait un balayage |
| `introductions (sla_due_at) where sla_breached` | Liste « décisions hors SLA » du tableau de bord (D39, indicateur n° 3). Index partiel : il ne contient que les manquements, c'est-à-dire presque rien si la file est tenue |
| `introductions (sla_due_at, created_at) where status in ('pending_review','in_review')` | L'écran de file de validation, trié par échéance de SLA |
| `introductions (owner_agent_id, status)` | « Mes mises en relation » du commercial ; indicateur « affaires traitées par commercial et par semaine » |
| `introductions (creator_account_id, status)` | Côté créateur : « mes demandes en cours » |
| `introductions (reference)` **unique** | Recherche par référence `MER-…` depuis un e-mail ou un appel |
| `introductions (advertiser_account_id, creator_account_id, coalesce(campaign_id,…))` **unique partiel** | Blocage des doublons — contrainte, pas optimisation |

### 10.6 Messagerie — Lot 4

| Index | Requête |
|---|---|
| `messages (conversation_id, created_at desc, id)` | Affichage d'un fil, paginé par curseur. **Le seul index dont la messagerie a besoin au MVP** |
| `conversation_participants (account_id) where left_at is null` | « Mes conversations », point de départ de la liste sur les trois espaces |
| `conversations (last_message_at desc)` | Tri de cette liste par activité |
| `conversation_access_log (conversation_id, accessed_at desc)` | « Qui a lu ce fil ? » — à la demande d'un utilisateur ou d'une autorité |
| `conversation_access_log (agent_account_id, accessed_at desc)` | « Qu'a lu cet agent ? » — revue de conformité |
| `contact_detections (created_at desc) where reviewed_at is null` | Liste d'alertes du backoffice (M6) |

### 10.7 Pipeline commercial — Lot 5

| Index | Requête |
|---|---|
| `deals (owner_agent_id, state)` | Pipeline d'un commercial |
| `deals (state, signed_at) where state = 'signed' and commission_invoiced_at is null` | **Relance J+7** : affaire signée dont la commission n'est pas facturée |
| `deals (commission_invoiced_at) where state = 'commission_invoiced' and commission_received_at is null` | **Relance J+30** |
| `deals (commission_received_at, currency) where commission_received_amount_minor is not null` | Indicateur n° 1 : **commission encaissée par devise et par mois**, et rapprochement bancaire |

### 10.8 Les trois seules dénormalisations du modèle

| Colonne | Requête qui l'impose | Maintenue par |
|---|---|---|
| `conversations.last_message_at` | Liste des conversations triée par activité, sur trois espaces. Sans elle, un `max()` corrélé sur `messages` à chaque affichage | Déclencheur `AFTER INSERT` sur `messages` |
| `leads.contact_sync_states` | Écran « inscrits et état de synchronisation » : un `DISTINCT ON` sur toute la file à chaque affichage | Le worker, en fin de traitement |
| `billing.deals.revealed_at` | Copie de `identity_revealed_at` qui rend la contrainte `signed_at >= revealed_at` **déclarative** au lieu d'exiger un déclencheur avec sous-requête | Posée à la création de l'affaire, jamais modifiée |

Toute autre dénormalisation proposée devra s'accompagner d'une **mesure**, pas d'une intuition (R10).

---

## 11. Plan de migrations

### 11.1 Règles communes

1. **Une migration = un changement cohérent**, un fichier SQL numéroté dans `supabase/migrations`,
   relu et versionné dans Git. **`drizzle-kit push` est interdit** (D5) ; `drizzle-kit generate` ne
   sert qu'à rédiger un brouillon.
2. **Le fichier contient tout ce qui va ensemble** : table, contraintes, commentaires SQL, `GRANT` /
   `REVOKE`, politiques RLS, déclencheurs, index. **Une table livrée sans sa politique est une
   faille** — elles ne se séparent donc pas en deux fichiers.
3. **Idempotence autant que possible** : `create table if not exists`, `create index if not exists`,
   `drop policy if exists` avant `create policy`.
4. **Chaque migration porte son annulation en commentaire d'en-tête**, ou l'explication de son
   impossibilité.
5. **Aucune migration destructive sans confirmation écrite du fondateur** (§11.4).
6. **Les données de référence sont des migrations**, pas des seeds : `reference.currencies` et
   `reference.countries` sont du schéma, pas du jeu d'essai. `supabase/seed` ne contient que des
   comptes de démonstration, jamais de donnée réelle.

### 11.2 Les migrations, lot par lot

| # | Fichier | Contenu | Réversible ? |
|---|---|---|---|
| **Lot 0** | | | |
| 0001 | `init_schemas_and_roles` | Schémas, cinq rôles + `influx_app` `NOINHERIT`, `ALTER DEFAULT PRIVILEGES` par schéma, `public` vidé | **Oui** (`drop schema … cascade` sur une base vide) |
| 0002 | `influx_helpers` | `current_account_id`, `current_account_role`, `has_aal2`, `touch_updated_at`, `assert_append_only` | Oui |
| 0003 | `reference_core` | `countries`, `currencies`, `languages` + leurs données | Oui |
| 0004 | `identity_core` | `accounts`, **`account_roles` avec la contrainte D41**, `owner_agent_id` et sa clé étrangère composite, `agent_profiles`, `grant_role()`, RLS | Oui tant qu'aucun compte réel n'existe |
| 0005 | `identity_terms_and_consent` | `terms_versions`, `terms_acceptances`, `consent_events`, append-only | Oui (idem) |
| 0006 | `audit_chain` | `event_types`, `audit_events`, `chain_checks`, `append_event()`, `REVOKE`, déclencheurs, ligne de genèse | **Non** dès la première ligne réelle : annuler, c'est détruire la preuve |
| 0007 | `billing_commission_rates_empty` | Table **vide**, commentaire SQL, `REVOKE INSERT` à tous | Oui |
| 0008 | `backoffice_ownership` | `ownership_assignments` | Oui |
| **Lot 1** | | | |
| 0101 | `leads_outbox` | `outbox_events`, `contact_sync_states`, index partiels, contrainte RG35 | Oui |
| 0102 | `backoffice_sla_policies` | Table + **valeur de départ de D39 : décision sous 1 jour ouvré** | Oui |
| 0103 | `leads_sync_settings` | Table de configuration + **`apollo_scope = 'annonceurs_et_createurs_pro'`** (valeur d'attente de D33) | Oui |
| 0104 | `identity_signup_fields` | `accounts.declared_status` (**`not null`**), `email_status`, `email_undeliverable_at`, `set_declared_status()`, `correct_email()` | Oui tant qu'aucun compte réel n'existe ; **`declared_status` devient non annulable ensuite** |
| 0105 | `identity_email_health` | `email_delivery_incidents`, append-only, index d'idempotence | Oui |
| 0106 | `profiles_advertiser_minimal` | Schéma `profiles`, privilèges par défaut, `advertiser_profiles` **en forme minimale** (nom d'entreprise) | Oui |
| **Lot 2** | | | |
| 0201 | `reference_taxonomies` | `topics`, `networks`, `formats`, `sectors`, `usage_rights`, `audience_bands`, `price_bands` | Oui |
| 0202 | `profiles_advertiser_full` | **Extension** de `advertiser_profiles` (colonnes du Lot 2, toutes nullables, aucune donnée à migrer) + `advertiser_contact_details` | Oui |
| 0203 | `profiles_creator_public` | Vitrine anonymisée et ses satellites | Oui |
| 0204 | `profiles_creator_identity` | Objets révélable et identifiant, `REVOKE` au rôle annonceur | Oui |
| 0205 | `profiles_portfolio` | `portfolio_items`, compartiment `portfolio`, politiques Storage | Oui |
| 0206 | `verification_core` | Demandes, codes, pièces, badges, contestations, motifs | Oui |
| **Lot 3** | | | |
| 0301 | `campaigns_core` | Campagnes et blocs, motifs de refus | Oui |
| 0302 | `search_journal` | `search_queries`, `search_impressions`, `shortlists` | Oui |
| **Lot 4** | | | |
| 0401 | `matching_introductions` | `introductions`, motifs, compteur de référence, contraintes, write-once | **Partiellement** : le schéma s'annule, la preuve non |
| 0402 | `matching_reveal_function` | `reveal_identity()` `SECURITY DEFINER`, `REVOKE` de colonnes | Oui |
| 0403 | `messaging_core` | Conversations, participants, messages, lectures | Oui |
| 0404 | `messaging_supervision` | `conversation_access_log`, `read_conversation()`, **`REVOKE SELECT` sur `messages` aux agents** | Oui |
| 0405 | `messaging_safety` | `contact_detections`, `reports`, `documents` *(conditionnel)* | Oui |
| **Lot 5** | | | |
| 0501 | `billing_deals` | `deals`, transitions, `deal_field_changes`, déclencheur d'historisation | Oui |
| 0502 | `backoffice_operations` | Notes, suspensions, plafonds et envois d'e-mails, demandes RGPD | Oui |
| **Lot 6** | | | |
| 0601 | `retention_jobs` | Fonctions de purge, index de purge manquants | Oui |

### 11.3 Ce qui n'est pas réversible, et pourquoi

| Migration | Pourquoi l'annulation est impossible ou interdite |
|---|---|
| `0006 audit_chain` | Dès la première ligne, annuler c'est **détruire la preuve**. Techniquement faisable, **interdit par décision** |
| `0401 matching_introductions` | Le schéma s'annule tant qu'aucune mise en relation n'existe. Après : `identity_revealed_at` n'est **pas reconstituable** |
| `0204 profiles_creator_identity` | Le `REVOKE` au rôle annonceur ne doit **jamais** être annulé. Toute migration future qui le rétablirait est un défaut bloquant, à détecter par le test du document `18` |
| Toute migration qui supprime une colonne de montant ou de date | Perte comptable. Procédure du §11.4 obligatoire |

### 11.4 Procédure pour une migration destructive

Une migration est **destructive** si elle supprime une table, une colonne, une contrainte protectrice
(`REVOKE`, `CHECK`, unicité), ou si elle transforme un type avec perte.

1. **Écrire pourquoi** : quelle donnée disparaît, combien de lignes, qui l'utilise, ce qui la remplace.
2. **Confirmation explicite et écrite du fondateur.** Aucun agent ne l'exécute de sa propre autorité
   (`CLAUDE.md` §10.3, règle 6).
3. **Procédure en quatre temps** (« étendre puis contracter »), jamais en un seul déploiement :
   ajouter le nouveau → migrer les données et écrire dans les deux → basculer le code et vérifier →
   supprimer l'ancien, **au lot suivant au plus tôt**.
4. **Sauvegarde ponctuelle prise et vérifiée avant l'étape 4**, avec sa date consignée.
5. **Vérification post-migration** : la suite de tests RLS du document `18` passe intégralement,
   **et** la vérification de la chaîne du registre est exécutée immédiatement après.
6. **Un événement `schema.destructive_migration` est écrit dans le registre**, avec le numéro de
   migration et la référence de l'accord du fondateur.

### 11.5 Environnements

Deux projets Supabase distincts (`staging`, `production`, document `02` §12.2). Les migrations sont
appliquées par la CI avec `DIRECT_DATABASE_URL`, **toujours sur `staging` d'abord**, jamais par
l'interface Supabase. Le rôle qui applique les migrations est **le propriétaire**, distinct de
`influx_app` : c'est ce qui fait que l'application ne peut pas modifier son propre schéma.

---

## 12. Ce qui reste ouvert

### 12.1 Pour `expert-cybersecurite` (document `03`) — **avis obligatoire, veto bloquant**

| # | Sujet | Pourquoi je le lui renvoie |
|---|---|---|
| 1 | **Quatre rôles PostgreSQL applicatifs** (§3.2) plutôt qu'un rôle `authenticated` unique | C'est la condition pour que « aucun `GRANT` au rôle annonceur » soit littéralement vrai. C'est aussi une décision d'autorisation, donc la sienne |
| 2 | **Risque résiduel de `RESET ROLE`** après `SET LOCAL ROLE` en cas d'injection SQL | Je décris la parade (requêtes paramétrées, aucun SQL concaténé) ; l'acceptation du risque lui revient |
| 3 | **Trois objets créateur au lieu de deux** (§5.2), et la liste exacte des colonnes de `creator_social_accounts` ouvertes après révélation | C'est la surface d'anonymisation : elle doit être arbitrée, pas héritée |
| 4 | **`conversation_access_log` append-only mais non chaînée** (§5.7) | Arbitrage débit / force de preuve sur un acte à haute fréquence |
| 5 | **Une seule chaîne globale** plutôt qu'une chaîne par mise en relation (§7.2) | Le choix a des conséquences sur la forme d'un extrait de preuve |
| 6 | **Conservation de `ip_address` et `user_agent`** sur `terms_acceptances` | Renforce la preuve, augmente la surface de données personnelles. Décision partagée avec `expert-conformite-rgpd` |
| 7 | **Liste des fonctions `SECURITY DEFINER`** : `current_account_id`, `append_event`, `reveal_identity`, `read_conversation`, `grant_role`, `set_declared_status`, **`correct_email`** | Ce sont les seules portes privilégiées du modèle. Chacune mérite une revue ligne à ligne |
| 8 | Politiques du **Storage** sur les quatre compartiments (§5.11), alignées sur les RLS des tables | Exception E1 du document `02` |
| 9 | **`identity.correct_email()`** (§5.1, RG62, question Q8 de la spécification `05`) | Depuis D37, l'adresse e-mail **est** le facteur d'authentification : cette fonction est une primitive de prise de contrôle de compte. Je fournis la trace (motif obligatoire, événement chaîné de gravité `critical`, notification aux deux adresses, remise à zéro de la vérification d'adresse) ; **la procédure de vérification d'identité préalable lui appartient** |
| 10 | **`identity.account_roles` est la surface d'escalade de privilèges** : aucun droit d'écriture applicatif, `grant_role()` réservée à `influx_admin` et refusant d'agir sur son propre compte | À valider avec la matrice du document `03` |

### 12.2 Pour `expert-conformite-rgpd` — **avis obligatoire, veto bloquant**

| # | Sujet |
|---|---|
| 1 | **Toutes les durées du §9.1.** Ce sont des propositions argumentées, pas des décisions |
| 2 | **Ce qui survit à une suppression de compte** (§9.2) et sa rédaction dans la politique de confidentialité — **prérequis du Lot 1**, pas du Lot 5 |
| 3 | **`profiles.creator_identities.date_of_birth`** : conserver la date, ou seulement l'attestation de majorité ? La date facilite le contrôle D15, mais c'est une donnée personnelle de plus |
| 4 | **`ip_address` et `user_agent`** sur les acceptations de CGU (valeur probatoire contre minimisation) |
| 5 | **Double finalité du journal des recherches** (anti-aspiration et amélioration produit) : à inscrire au registre des traitements avec sa durée |
| 6 | **Données de tiers dans `verification.evidence_files`** : base légale, instructions de capture, durée (90 jours proposés) |
| 7 | **Conservation du corpus de `contact_detections`** : type et position uniquement, mais rattachés à un message conservé |
| 8 | **Propagation de la suppression** vers Brevo et Apollo par `outbox_events` en priorité 0 : suffisant ou faut-il une preuve de suppression côté sous-traitant ? |

### 12.3 Pour `architecte`

| # | Sujet |
|---|---|
| 1 | Le §5.2 **précise** le §2.5 du document `02` (trois objets au lieu de deux). À valider ou à corriger |
| 2 | `introductions.conversation_id` **n'est pas créé** : la relation est portée par `conversations.introduction_id unique` (§5.7). Écart assumé avec `intermediation-tracking` |
| 3 | `billing.deals` est placé dans le schéma `billing`, conformément aux documents `01` et `02`, et non dans `backoffice` |
| 4 | La déclaration Drizzle devra utiliser `pgSchema()` pour treize schémas : à confirmer avec le pilote et le multiplexeur (`prepare: false`) |

### 12.4 Pour `product-owner` — questions de règle de gestion

| # | Question | Pourquoi elle bloque le modèle |
|---|---|---|
| ~~Q1~~ | ~~Un utilisateur peut-il être à la fois annonceur et créateur ?~~ | **Close le 2026-09-18 par D41** : un rôle par compte au MVP, liaison `identity.account_roles` posée dès le Lot 0, dette chiffrée au **§5.1.1**. Deux points restent à `product-owner` le jour de l'ouverture : la **candidature à sa propre campagne** (à interdire) et l'**exclusion de soi-même des résultats de recherche** |
| **Q2** | **Une mise en relation peut-elle donner lieu à plusieurs affaires** (une seconde collaboration avec la même marque, plus tard) ? Le modèle pose `deals.introduction_id` **unique** | Si la réponse est oui, l'unicité saute et le rattachement comptable devient ambigu. Ma recommandation : garder l'unicité, une nouvelle collaboration = une nouvelle mise en relation |
| **Q3** | **Après révélation, la marque voit-elle les chiffres exacts d'audience**, ou seulement les tranches et le badge ? | Le §5.2 propose **tranches seulement** (`followers_count` hors du `GRANT`). C'est cohérent avec le badge, qui constate en tranches, mais c'est une règle produit |
| **Q4** | **Plafond de candidatures actives** par créateur, **durée de validité** du code de propriété, **délai de grâce** après péremption du badge | Ce sont des paramètres ; je les veux **en table** (`backoffice.sla_policies` ou équivalent), pas en constantes — mais il faut des valeurs de départ |
| **Q5** | **Le canal de documents** (§5.7) est-il retenu ? | Deux tables et un compartiment Storage en dépendent, rien d'autre |

### 12.5 Pour le fondateur

| # | Point | Pourquoi c'est à vous |
|---|---|---|
| 1 | **Rien ne se supprime vraiment.** Un compte supprimé devient anonyme, mais la mise en relation, l'affaire, les messages et le journal **restent**, sous une forme qui ne porte plus de nom. C'est ce qui protège INFLUX en cas de contestation — et cela **doit être écrit dans la politique de confidentialité dès la première mise en ligne** | C'est une promesse faite à vos utilisateurs, pas un réglage technique |
| 2 | **La table des taux de commission est créée et verrouillée.** Personne ne peut y écrire depuis l'application : la remplir, en V2, exigera une modification de la base relue et validée | C'est le garde-fou qui garantit qu'aucun « 35 % » ne se glissera quelque part dans le code d'ici là |
| 3 | **Le registre de preuve protège contre le code, pas contre vous.** Celui qui détient le projet Supabase peut tout effacer. Parade gratuite proposée : **recevoir chaque mois par e-mail l'empreinte de tête du registre** (64 caractères). Un tiers en détient alors une copie datée | Cela transforme une preuve interne en preuve difficilement contestable, pour zéro euro. À accepter ou à refuser |
| 4 | **D41, D39 et D40 sont intégrées** (2026-09-18). Ce qu'il faut en retenir : le double rôle reste **fermé** au MVP, mais la porte est posée et son ouverture est chiffrée à **8 à 12 jours** au lieu de 3 à 5 semaines (**§5.1.1**) ; le délai de la file est **1 jour ouvré**, réglable sans déploiement ; les coordonnées d'une marque sont désormais **masquées jusqu'à la mise en relation**, comme celles d'un créateur | Ce sont vos arbitrages : ce paragraphe est là pour que vous puissiez vérifier qu'ils ont été compris comme vous les avez posés |

---

## 13. Impacts sur le code existant

**Aucun code n'est cassé : il n'existe aujourd'hui aucune table, aucune migration, aucune ligne
Supabase dans le dépôt.** Les impacts sont donc des **obligations de construction**, pas des
reprises.

| Endroit | Ce qui en découle |
|---|---|
| `supabase/migrations` | À créer au Lot 0 avec les migrations 0001 à 0008. Rien avant la validation des documents `00` à `04` |
| `apps/api/src/db/schema/*.ts` | Déclaration Drizzle **alignée à la main** sur le SQL, avec `pgSchema()` pour chacun des treize schémas. Le SQL fait foi, pas le TypeScript |
| `apps/api/src/db/index.ts` | `withUserTransaction` doit, dans l'ordre : ouvrir la transaction, poser `request.jwt.claims`, **résoudre `account_id` et le rôle en une seule requête jointe `accounts ⋈ account_roles`**, puis `SET LOCAL ROLE` le rôle applicatif correspondant (§3.2). Le jour où D41 s'ouvrira, c'est **ce point précis** qui changera : le rôle deviendra un contexte explicite de la requête au lieu d'une déduction (§5.1.1, chantier n° 2) |
| `packages/contracts` | Les types `enum` PostgreSQL de ce document (statuts de mise en relation, états d'affaire, rôles, origines) sont la **source** des unions fermées zod. Un écart entre les deux doit faire échouer la compilation |
| `packages/domain` (Lot 2) | Porte le **découpage anonyme / révélable / identifiant** et le **calcul des tranches**. Fonctions pures, testées : ce sont elles qui garantissent qu'aucune valeur exacte n'atterrit dans la vitrine |
| `apps/web` — prototype `AccountForm.tsx` | Les champs du prototype correspondent à `accounts` : e-mail, pays, langue, attestation de majorité, consentement — **plus deux champs à ajouter** : le **statut déclaré** (particulier / professionnel, sans valeur pré-sélectionnée, RG18) et le **nom d'entreprise** côté annonceur (RG11, qui alimente `profiles.advertiser_profiles`). Le rôle part dans `account_roles`, **le consentement devient une ligne de `consent_events`, pas une colonne**, et la case reste non pré-cochée |
| `apps/api/src/domains/billing` | **Vide de tout calcul au MVP.** Il n'expose que la lecture et l'écriture de `deals`, avec des contrôles d'addition et de comparaison |
| Document `18` (`testeur`) | Trois tests qui viennent directement d'ici : (a) le rôle de `DATABASE_URL` n'est ni propriétaire ni `BYPASSRLS` ; (b) une marque n'obtient **aucune** colonne identifiante, avant comme après révélation, sur **toutes** les routes ; (c) toute table nouvelle sans ligne dans la matrice du document `03` fait échouer la CI |

---

## 14. Checklist de la skill `supabase-schema`

- [x] RLS activée, `FORCE` comprise, et politiques proposées pour chaque rôle sur chaque table
      (§6) — **arbitrage final au document `03`**
- [x] Aucun montant en flottant, devise présente et contrainte (§8)
- [x] Taux de commission **non historisés parce qu'inexistants** : table créée, vide, en écriture
      impossible (§5.9) — le régime cible reviendra en V2
- [x] Pays, langue et fuseau explicites sur les comptes ; pays des parties **copiés** sur la mise en
      relation (§5.1, §5.6)
- [x] Consentement marketing modélisé en événements datés et sourcés, relu à la consommation (§5.1)
- [x] Durée de conservation proposée pour chaque catégorie de données personnelles (§9)
- [x] Journal d'audit alimenté sur les entités sensibles, append-only **réel** et chaîné (§4.3, §7.2)
- [x] Réversibilité documentée migration par migration, impossibilités expliquées (§11.3)
- [x] Tests d'intégration RLS demandés à `testeur` (§13)
- [x] Revue `expert-cybersecurite` demandée (§12.1) · revue `expert-conformite-rgpd` demandée (§12.2)

---

**Ce document ne modifie aucun autre fichier.** Les mises à jour de `CLAUDE.md` relèvent de
`chef-de-projet`. Les questions d'autorisation relèvent de `docs/mvp/03-matrice-des-droits-et-rls.md`.
