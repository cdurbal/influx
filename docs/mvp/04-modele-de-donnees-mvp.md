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
> **Mise à jour du 2026-09-19, après les spécifications `06` à `11` — 34 corrections intégrées.**
> Six documents de spécification des Lots 2 et 3 ont relu ce modèle et signalé des manques ; cinq
> d'entre eux ont été signalés **indépendamment par deux ou trois documents**, ce qui les rend
> prioritaires. Ce qui change :
> **`profiles`** — état `suspendu` sur les profils marque et créateur (`06`, `07`, `09`) ;
> conservation de **la dernière version validée** pendant une re-validation partielle
> (`06`, `07`, `09`) ; sept champs de profil créateur ajoutés, portée moyenne comprise (`07`) ;
> `GRANT` de révélation élargi aux chiffres exacts (`07`, ferme **Q3** du §12.4).
> **`reference`** — **bornes nettes** sur `price_bands` (`07`, `09`), `engagement_bands`,
> `age_bands`, `audience_genders`, `editorial_tones`, `publication_frequencies`, `regions`,
> `campaign_types`.
> **`verification`** — PDF retiré des pièces (alignement sur `03` E1-9, qui fait autorité),
> référentiel des **motifs de retrait**, état **« à reconfirmer »**, identifiant du compte
> **observé au moment du constat** (`08`).
> **`campaigns`** — type de campagne, quatre textes distincts et messages clés, dotation, droits
> d'usage remontés au niveau de la campagne avec durée et territoires, **quatre dates nommées**
> et ordonnées, nature de la rémunération, nombre de créateurs, tranches de budget dérivées,
> éléments demandés, ciblage d'audience détaillé, revue renforcée à deux validateurs, six états
> (`09`).
> **`search`** — **table de blocage entre parties** (`matching.party_blocks`, le manque le plus
> important de la liste), réglages et facettes en table, tri et version des facettes journalisés,
> raisons d'explication rattachées aux impressions, compteurs de masse critique (`10`).
> **`matching`** — compteurs de candidatures, motifs **corrigibles**, sous-motif d'expiration,
> brouillon de candidature, et **résolution de la collision d'index unique partiel** par
> `matching.interest_submissions` (`11`).
> **`audit`** — `campaign.published` et `campaign.updated` (`09`).
> **Vérifié sans modification :** la contrainte `introductions_reveal_requires_both_acceptances`
> reste **inconditionnelle** (§5.6) ; rien dans ce document ne la restreint à une origine, et
> `matching.reveal_identity()` la contrôle de la même façon pour les trois origines. C'est cette
> version qui fait foi, `03` C(21) a été aligné le 2026-09-19.
> **Ce qui reste à valider ailleurs est regroupé au §12.6.**
>
> **Mise à jour du 2026-09-19 (seconde passe), après les spécifications `12` et `13` — 16 corrections
> intégrées.** Les deux documents du Lot 4 — la messagerie à trois et la file de validation — ont relu
> ce modèle et signalé seize manques. Ce qui change :
> **`messaging`** — les deux indicateurs qui distinguent une maladresse d'un contournement assumé sur
> `contact_detections` (`12` RG45) ; un **motif typé de lecture** (`messaging.access_reasons`) sur le
> journal des lectures, qui ne portait que l'écran (`12` RG56 à RG58) ; `read_session_id`, cité par
> `03` §5.2 ; **pause motivée et attribuée**, **réouverture réellement possible** et table des
> transitions autorisées (`12` RG17, RG20, RG22) ; **date de mise à disposition** et **journal des
> téléchargements** sur `documents` (`12` RG71, RG75).
> **`identity`** — la **prise de connaissance** de l'information « ces échanges sont supervisés »
> rejoint `terms_acceptances` au lieu d'une table de plus, avec une **nature** qui distingue une prise
> de connaissance d'une acceptation (`12` RG104).
> **`matching`** — deux sous-motifs d'expiration manquants (`13` RG95) ; le **refus par une partie**,
> qui n'avait aucun support : côté, liste B de motifs **jamais communiqués à l'autre partie**, et
> horodatage (`13` RG82 à RG90) ; `proposal_batch_id`, qui rend le geste commercial mesurable
> (`13` RG53 à RG59) ; le **`messageId` du prestataire d'envoi** conservé dans
> `matching.introduction_emails` (`13` RG79) ; les **transitions depuis `approved`** rendues
> réversibles tant que rien n'est révélé (`13` RG102, RG103).
> **`audit`** — **35 codes d'événements** ajoutés, 17 pour la messagerie et 18 pour le cycle de la
> file et de la mise en relation.
> **Non traité ici, volontairement :** le contrat d'appelant des fonctions de révélation d'identité
> (`13` écarts 4 et 5) appartient à `expert-cybersecurite` et au document `03`.
> **`billing`** — **`deals`, ses trois référentiels de motifs, ses transitions et
> `deal_field_changes` avancées du Lot 5 au Lot 4** : l'affaire est créée **automatiquement, à l'état `open`, dans la
> transaction de révélation** (arbitrage `chef-de-projet` du 2026-09-19, §5.6 et §12.7 point 1).
> Sans elle, une mise en relation perdue n'aurait nulle part où porter son **motif de perte typé**.
> **Un point conservateur reste signalé au §12.7** : un fil archivé ne se rouvre pas.
>
> **Mise à jour du 2026-09-19 (troisième passe), après les spécifications `14` et `15` — les écarts
> E1 à E11 et les douze points du backoffice intégrés.**
> **`billing`** — **`commission_receipts`** (l'écart **bloquant** `14` E1 : le règlement standard se
> fait **en deux fois par deux payeurs**, et la paire de colonnes d'encaissement unique écrasait le
> premier) ; `commission_shortfall_note` **renommée** `commission_variance_note`, la contrainte ne
> visant que le **trop-perçu** ; montant **nul autorisé** avec motif typé ; état **`cancelled`**
> distinct de `lost` ; **`stalled` et `disputed` redeviennent des attributs** ; **bases fiscales** et
> **payeur de la commission avec ses deux parts saisies**, seule matière pour instruire **D7** et
> **D23** ; champs de mesure du contournement ; motif **obligatoire** sur les champs financiers.
> **`backoffice`** — six tables qui manquaient : **`queues`** (sans elle, « une file hors catalogue
> n'existe pas » était invérifiable), **`alert_definitions`** et **`alert_instances`** (les 41 alertes
> vivaient en requêtes éparpillées), **`dual_control_requests`** (`03` PD4 décrivait des colonnes sans
> table), **`exports`** (**agrégés seulement** : `05` RG106 est abrogée, alignement sur `03` C(17)),
> **`suspension_reasons`** et ses motifs de levée ; notes internes et demandes RGPD complétées.
> **`identity`** — `agent_profiles` porte enfin `is_active`, **`is_break_glass`** (le compte de
> secours existe **dès le Lot 0**) et l'absence déclarée.
> **`audit`** — **23 codes** de plus, dont cinq chargés aux Lots 0 et 1 parce que les actes qu'ils
> tracent existent dès le premier jour.
> **Neuf points conservateurs au §12.8**, dont la restriction d'écriture au commercial responsable,
> **volontairement non tranchée** : c'est une règle d'autorisation, elle appartient à `03`.
>
> **Mise à jour du 2026-09-19 (quatrième passe), après la spécification `16` — les 11 écarts
> intégrés.** **`backoffice`** — quatre tables : **`email_templates`** (aucun envoi improvisé,
> empreinte du contenu validé **revérifiée avant chaque envoi**), **`brevo_allowed_segments`** (sans
> liste fermée, n'importe quel segment improvisé chez Brevo devient envoyable en deux clics),
> **`email_send_transitions`**, et onze colonnes sur `email_sends` — dont le **volume recalculé à la
> fin de la fenêtre d'annulation** et les cinq champs de la saisie libre. **`email_send_recipients`
> cesse de recopier les adresses** : unicité sur `coalesce(account_id::text, lower(email_address))`,
> adresse stockée pour la seule saisie libre, **table vide pour un segment Brevo**. Trois plafonds de
> plus (mensuel, par domaine, une sollicitation par adresse). **`leads`** — les deux **compteurs de
> cadence** et **`transactional_sends`**, le journal qui manquait pour répondre à « je n'ai pas reçu
> mon code » : depuis **D37**, c'est une question de disponibilité, pas de délivrabilité.
> **L'interrupteur d'urgence** est une clé de configuration, pas une table — il n'a ni historique
> propre ni objet rattaché, et son histoire est déjà au registre. **Amorçages** : la file
> `email_send_failures` et les alertes **AL42 à AL48**.
>
> **Mise à jour du 2026-09-19 (cinquième passe) — D43 intégrée.** L'architecte a tranché
> (`02` §18) : le **code de connexion (`P0`) part de façon synchrone depuis `apps/api`**, hors de
> `leads.outbox_events`, et **`leads.transactional_sends` est un journal, jamais une file**. Six
> conséquences en base : la **sémantique de `status`** écrite en commentaire (`queued` = *tentative
> engagée, issue inconnue*, pas *travail à prendre*) avec la liste des gestes de file **interdits** ;
> les **droits**, qui manquaient — `influx_auth` insère et met à jour les **seules colonnes
> d'issue**, `influx_worker` n'écrit que `delivered_at`, **rien pour les rôles membres** ; la **liste
> fermée des trois `failure_code`**, en correspondance exacte avec les trois causes de `05` RG60 ;
> **aucun index sur `status`**, avec la raison écrite — *un index de prise est une file qui
> s'ignore* ; la **purge des utilisateurs GoTrue orphelins à 24 h** (**E-4**), conséquence directe de
> la création inconditionnelle d'utilisateur qui supprime l'oracle d'énumération ; et
> **`identity.auth_request_throttle`**, les compteurs de débit de `05` RG44 — sans eux, l'indicateur
> « demandes sans connexion aboutie » serait faux, **une demande plafonnée n'écrivant aucune ligne de
> journal**. Six points au **§12.10**, dont cinq pour `expert-cybersecurite`.
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
| `reference` | Listes fermées partagées : pays, devises, langues, thématiques, formats, réseaux, secteurs, droits d'usage, **tons éditoriaux, fréquences de publication, régions**, bornes de tranches (audience, **engagement**, **âge**, **genre d'audience**, prix **avec leurs bornes nettes**), **types de campagne** | 0, 2 puis 3 |
| `identity` | Comptes, rôles, pays et langue, **commercial responsable**, profils d'agents, versions de CGU, acceptations, consentements, **compteurs de débit de la demande de code** | 0 puis 1 |
| `audit` | **Registre chaîné append-only**, types d'événements, résultats des vérifications de chaîne | 0 |
| `billing` | **`commission_rates` créée et vide** (Lot 0) ; **`deals`**, ses motifs de perte, ses transitions et l'historique de ses montants — **au Lot 4, parce que l'affaire naît dans la transaction de révélation** ; seule la **saisie** des montants arrive au Lot 5 | 0 puis **4** |
| `leads` | `outbox_events`, état de synchronisation Brevo / Apollo par contact **et compteurs de cadence marketing**, **journal des e-mails transactionnels** (dont le code de connexion) | 1 |
| `profiles` | Profil marque, **profil créateur en trois objets**, réseaux, audience, tarifs, portfolio, complétude | 2 |
| `verification` | Demandes de vérification, codes de propriété, pièces, décisions, badges et péremption, contestations | 2 |
| `campaigns` | Campagnes et leurs blocs, livrables, ciblage, validation | 3 |
| `search` | Journal des recherches, impressions et rangs cliqués, sélections (shortlists) | 3 |
| `matching` | **`introductions`**, expressions d'intérêt, brouillons, compteurs de plafonds, motifs de refus **par INFLUX et par une partie**, file de validation, **transitions autorisées**, **e-mails de mise en relation**, **blocage entre parties** | **3** *(blocage)* puis 4 |
| `messaging` | Conversations, participants, messages, lectures, **journal des lectures par un agent et ses motifs typés**, motifs de pause, transitions d'état, signalements, détections, documents et **journal de leurs téléchargements** | 4 |
| `backoffice` | **Catalogue des files**, politiques de SLA, **catalogue et instances d'alertes**, **demandes de double validation**, paramètres d'exploitation, notes internes, suspensions et leurs motifs, **journal des exports**, envois d'e-mails et destinataires, demandes RGPD | 1, 3, 4 puis 5 |

Le schéma `public` **reste vide**. C'est une décision de sécurité autant que d'hygiène : c'est le
seul schéma exposé par défaut par PostgREST, et nous ne voulons aucune table atteignable par cette
voie (`docs/mvp/02-architecture-3-espaces.md` §2).

### 2.2 Quelles tables apparaissent à quel lot

| Lot | Tables créées |
|---|---|
| **0 — Socle** | `reference.countries` · `reference.currencies` · `reference.languages` · `identity.accounts` · **`identity.account_roles`** *(D41)* · `identity.agent_profiles` · `identity.terms_versions` · `identity.terms_acceptances` · `identity.consent_events` · `audit.event_types` · `audit.audit_events` · `audit.chain_checks` · `billing.commission_rates` *(vide)* · `backoffice.ownership_assignments` |
| **1 — Inscription et leads** | `leads.outbox_events` · `leads.contact_sync_states` · **`leads.sync_settings`** · **`identity.email_delivery_incidents`** · **`profiles.advertiser_profiles` *(forme minimale, avancée depuis le Lot 2)*** · **`backoffice.queues`** · `backoffice.sla_policies` · **`backoffice.alert_definitions`** · **`backoffice.dual_control_requests`** · **`leads.transactional_sends`** · **`identity.auth_request_throttle`** |
| **2 — Profils, badge** | `reference.topics` · `reference.formats` · `reference.networks` · `reference.sectors` · `reference.usage_rights` · `reference.audience_bands` · `reference.price_bands` · *(`profiles.advertiser_profiles` : **extension** de la table créée au Lot 1)* · `profiles.advertiser_contact_details` · `profiles.creator_public_profiles` · `profiles.creator_public_networks` · `profiles.creator_public_audience` · `profiles.creator_public_rates` · `profiles.creator_social_accounts` · `profiles.creator_identities` · `profiles.creator_audience_breakdowns` · `profiles.creator_rate_cards` · `profiles.creator_topics` · `profiles.creator_formats` · `profiles.creator_refused_sectors` · `profiles.portfolio_items` · `verification.rejection_reasons` · `verification.verification_requests` · `verification.ownership_codes` · `verification.evidence_files` · `verification.badges` · `verification.disputes` · **`reference.engagement_bands`** · **`reference.age_bands`** · **`reference.audience_genders`** · **`reference.editorial_tones`** · **`reference.publication_frequencies`** · **`reference.regions`** · **`profiles.creator_tones`** · **`profiles.creator_usage_rights`** · **`profiles.moderated_fields`** · **`profiles.profile_field_revisions`** · **`verification.revocation_reasons`** |
| **3 — Campagnes et recherche** | `campaigns.rejection_reasons` · `campaigns.campaigns` · `campaigns.campaign_deliverables` · `campaigns.campaign_audience_targets` · `campaigns.campaign_topics` · `search.search_queries` · `search.search_impressions` · `search.shortlists` · `search.shortlist_items` · **`reference.campaign_types`** · **`campaigns.campaign_key_messages`** · **`campaigns.campaign_usage_territories`** · **`campaigns.campaign_price_bands`** · **`campaigns.requested_items`** · **`campaigns.campaign_requested_items`** · **`campaigns.campaign_published_snapshots`** · **`search.search_settings`** · **`search.facet_settings`** · **`search.facet_config_versions`** · **`search.explanation_reasons`** · **`search.impression_reasons`** · **`search.supply_counters`** · **`backoffice.operational_settings`** · **`matching.block_reasons`** · **`matching.party_blocks`** *(les deux dernières arrivent au Lot 3 bien que le reste du schéma `matching` arrive au Lot 4 : le blocage est une exclusion de recherche, §5.6)* |
| **4 — Mise en relation et messagerie** | `matching.rejection_reasons` · `matching.introductions` · **`matching.interest_submissions`** *(ex-`application_details`)* · **`matching.interest_submission_formats`** *(ex-`application_formats`)* · **`matching.application_drafts`** · **`matching.application_draft_formats`** · **`matching.application_quotas`** · `matching.reference_counters` · **`matching.decline_reasons`** · **`matching.introduction_transitions`** · **`matching.introduction_emails`** · `messaging.closure_reasons` · `messaging.report_reasons` · `messaging.conversations` · `messaging.conversation_participants` · `messaging.messages` · `messaging.conversation_reads` · **`messaging.conversation_channel_activity`** *(apartés, §5.7.1)* · `messaging.conversation_access_log` · `messaging.contact_detections` · `messaging.reports` · `messaging.documents` · **`messaging.access_reasons`** · **`messaging.pause_reasons`** · **`messaging.conversation_state_transitions`** · **`messaging.document_labels`** · **`messaging.document_rejection_reasons`** · **`messaging.document_downloads`** · **`billing.lost_reasons`** · **`billing.cancellation_reasons`** · **`billing.non_monetary_reasons`** · **`billing.deal_state_transitions`** · **`billing.deals`** · **`billing.deal_field_changes`** · **`backoffice.alert_closure_reasons`** · **`backoffice.alert_instances`** *(les six premières **avancées depuis le Lot 5** : l'affaire est créée par `matching.reveal_identity()`, §5.6)* |
| **5 — Backoffice et pipeline** | **`billing.commission_receipts`** *(la seule table `billing` du Lot 5 : elle arrive avec la première saisie de règlement, `14` E1)* · `backoffice.internal_notes` · **`backoffice.suspension_reasons`** · **`backoffice.suspension_lift_reasons`** · `backoffice.account_suspensions` · **`backoffice.exports`** · `backoffice.email_send_limits` · **`backoffice.email_templates`** · **`backoffice.brevo_allowed_segments`** · **`backoffice.email_send_transitions`** · `backoffice.email_sends` · `backoffice.email_send_recipients` · `backoffice.data_subject_requests` |
| **6 — Recette** | Aucune table nouvelle. Vérification de la couverture RLS, des index réellement utilisés et des purges |

**Total : 135 tables et 1 vue**, dont **44 tables de référence** (des listes fermées de quelques
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

> **Correspondance des noms de fonctions de contexte, arrêtée le 2026-09-19.** Point de cohérence
> renvoyé par `docs/mvp/03-matrice-des-droits-et-rls.md` §3.4 : deux jeux de noms coexistaient pour
> les mêmes fonctions. **Ce sont les noms de ce document qui survivent**, pour deux raisons — ils
> sont déjà employés dans la totalité du SQL des §5 à §7, et `influx.current_role()` était à une
> qualification de schéma près de `current_role`, **fonction native de PostgreSQL qui renvoie le rôle
> *Postgres*** : deux notions qu'une politique RLS ne doit jamais confondre.
>
> | Nom dans `03` (première rédaction) | Nom retenu | Est-ce la même fonction ? |
> |---|---|---|
> | `influx.current_account()` | **`influx.current_account_id()`** | **Oui.** Substitution purement mécanique, aucun changement de sens |
> | `influx.current_role()` | **`influx.current_account_role()`** | **Oui.** Idem, et le nom retenu lève l'ambiguïté avec `current_role` natif |
> | `influx.current_aal()` | **`influx.current_aal()`, conservée** — `influx.has_aal2()` s'y ajoute | **Non : ce sont deux fonctions**, et les deux restent (ci-dessous) |
>
> **`current_aal()` et `has_aal2()` ne font pas la même chose, et c'est voulu.** La première **lit le
> niveau** (`text` : `aal1`, `aal2`, ou `null` si le contexte est absent) ; la seconde est son
> **enveloppe booléenne**, `coalesce(influx.current_aal() = 'aal2', false)`. Les deux sont sûres
> devant l'absence de contexte (`03` P4 : une valeur manquante refuse l'accès), et aucune des deux
> n'est une négation. On écrit `has_aal2()` là où une politique attend un booléen, et
> `current_aal() = 'aal2'` là où le document `03` démontre la formulation positive — le jour où un
> troisième niveau existera, c'est `current_aal()` qui servira, sans réécrire une seule politique.
>
> **`03` a été corrigé le 2026-09-19 pour les deux premières lignes seulement**, par substitution
> d'identifiants. **Aucune règle d'autorisation n'a changé**, et `03` reste l'arbitre du contrôle
> d'accès.

Aucune table. **Six** fonctions, toutes `STABLE` et `SECURITY INVOKER` sauf mention contraire.

| Fonction | Rôle |
|---|---|
| `influx.current_account_id() → uuid` | Renvoie `identity.accounts.id` du porteur de session, à partir de `auth.uid()` (lu dans `request.jwt.claims`, posé par `apps/api` dans la transaction) |
| `influx.current_account_role() → identity.account_role` | Rôle métier **lu en base**, jamais dans le jeton (D37, précision 2). Voir le coût au §7.3 |
| `influx.current_aal() → text` | **Le niveau d'authentification brut** (`aal1` · `aal2` · `null`), lu dans `request.jwt.claims`. Renvoie `null` si le contexte est absent — donc toute comparaison refuse |
| `influx.has_aal2() → boolean` | **Enveloppe booléenne** de la précédente : `coalesce(influx.current_aal() = 'aal2', false)`. Utilisée par les politiques des objets du backoffice |
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
| `reference.audience_bands` | `code text` | `min_followers bigint`, `max_followers bigint` nullable. **Sert aussi de référentiel de portée moyenne** (§5.2) | 2 |
| `reference.engagement_bands` | `code text` | `min_rate_bp integer`, `max_rate_bp integer` nullable, `label_key`, `introduced_at`, `retired_at`. **Bornes en points de base entiers** (350 = 3,50 %), jamais en flottant | 2 |
| `reference.age_bands` | `code text` | `min_age smallint not null`, `max_age smallint` nullable — `18_24`, `25_34`, `35_44`, `45_plus`. **`check (min_age >= 18)` : aucune tranche mineure n'est modélisable** (D15) | 2 |
| `reference.audience_genders` | `code text` | `female_majority` (≥ 60 %), `mixed`, `male_majority` (≥ 60 %) — **tranches, jamais un pourcentage** | 2 |
| `reference.editorial_tones` | `code text` | Les sept tons de `07` RG34, `label_key`, `introduced_at`, `retired_at` | 2 |
| `reference.publication_frequencies` | `code text` | `daily` · `several_per_week` · `weekly` · `biweekly` · `monthly_or_less`, `sort_order` | 2 |
| `reference.regions` | `(country_code, code)` | Niveau administratif 1 (ISO 3166-2), `label_key`, `is_active`. **Chargée pays par pays**, à la demande : charger le monde entier au Lot 2 serait 4 000 lignes inutilisées | 2 |
| `reference.price_bands` | `(currency, code)` | `min_amount_minor`, `max_amount_minor`, **`net_min_amount_minor`, `net_max_amount_minor`**, `net_basis_label`, `net_computed_at`, `introduced_at`, `retired_at` (ci-dessous) | 2 |
| `reference.campaign_types` | `code text` | Les **sept** types de `09` RG18, **sans valeur `other`**, `label_key`, `introduced_at`, `retired_at` | 3 |

**`reference.currencies.minor_unit` est la colonne la plus importante de ce schéma.** C'est elle qui
dit comment interpréter un `bigint` : `200000` vaut 2 000,00 EUR mais 200 000 JPY. Sans elle, le
premier contrat en yen produit une erreur d'un facteur 100.

**`reference.price_bands` a pour clé `(currency, code)`** : une tranche tarifaire n'a de sens
qu'adossée à une devise. C'est aussi ce qui rend visible, dès aujourd'hui, la donnée manquante
signalée par `matching-spec` (« règle de conversion entre devises », bloquante dès qu'une seconde
devise existe — D27, V2).

#### Les bornes nettes de `reference.price_bands` — la seule façon d'afficher un net sans calculer un taux

`07` RG72 et `09` RG59 demandent la même chose, indépendamment : **afficher au créateur un net
estimé sans qu'aucune multiplication d'un montant par un taux n'existe dans le code applicatif**.
C'est une exigence structurelle, pas un confort : `03` C(32) interdit d'écrire dans
`billing.commission_rates` et le contrôle d'intégration continue T16 échoue sur toute multiplication
d'un montant par une constante dans `apps/` et `packages/`.

La seule forme compatible est de **stocker les bornes nettes comme des données du référentiel**,
calculées **une fois**, à la main, dans la migration qui crée la version du référentiel — au même
titre que les bornes brutes :

```sql
alter table reference.price_bands
  add column net_min_amount_minor bigint,
  add column net_max_amount_minor bigint,
  add column net_basis_label      text,
  add column net_computed_at      timestamptz,
  add column introduced_at        timestamptz not null default now(),
  add column retired_at           timestamptz,

  -- les deux bornes nettes vont ensemble, ou aucune
  add constraint price_bands_net_pair
      check (num_nonnulls(net_min_amount_minor, net_max_amount_minor) in (0, 2)),
  -- un net ne depasse jamais le brut, et ne descend jamais sous zero
  add constraint price_bands_net_within_gross
      check (net_min_amount_minor is null
             or (net_min_amount_minor >= 0
                 and net_max_amount_minor >= net_min_amount_minor
                 and net_min_amount_minor <= min_amount_minor
                 and (max_amount_minor is null or net_max_amount_minor <= max_amount_minor))),
  -- un net sans base ecrite n'est pas opposable
  add constraint price_bands_net_needs_basis
      check (net_min_amount_minor is null
             or (net_basis_label is not null and net_computed_at is not null));

comment on column reference.price_bands.net_min_amount_minor is
  'Borne basse du net createur pour cette tranche, en plus petite unite monetaire.
   VALEUR DE DONNEE, CALCULEE HORS APPLICATION, ECRITE PAR UNE MIGRATION RELUE.
   Le code ne la recalcule jamais et ne multiplie jamais un montant par un taux (03 C(32), T16).
   Nulle = aucun net affiche pour cette devise (09 RG59, cas limite) : on n''estime pas a la volee.';

comment on column reference.price_bands.net_basis_label is
  'Base ecrite du calcul, en clair et non exploitable par le code
   (ex. « bareme plateforme 35 % au 2026-09-19 »). Sert a la relecture et a l''audit,
   jamais a un calcul.';

-- meme regime que billing.commission_rates : personne n'ecrit ce referentiel depuis l'application
revoke insert, update, delete on reference.price_bands
  from influx_advertiser, influx_creator, influx_agent, influx_admin, influx_service;
```

Trois conséquences à assumer :

1. **Le net affiché est un « environ »**, et il doit être écrit ainsi partout (`09` RG60, `07` RG70).
   Une tranche donne un ordre de grandeur, pas un montant dû.
2. **Changer les taux de la plateforme ne réécrit pas l'histoire** : on **retire** la version du
   référentiel (`retired_at`) et on en **introduit** une nouvelle. Les affaires et les campagnes qui
   citent un code de tranche continuent de citer la version qui était en vigueur.
3. **La table des taux reste vide et inaccessible.** Ce que l'on introduit ici n'est pas un taux,
   c'est une borne monétaire figée — mais elle **en dérive économiquement**, ce qui doit être validé
   par `expert-paiement-facturation` et le fondateur (§12.6, point 1).

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

**Codes ajoutés au Lot 3** (`09`, Impacts ; `10` RG28). Ce sont des **données**, chargées par la
migration `0301` : les ajouter n'exige aucun changement de schéma.

| Code | `domain` | `subject_type` | `severity` | Fait relaté |
|---|---|---|---|---|
| `campaign.submitted` | `campaigns` | `campaign` | `info` | La marque soumet sa campagne à validation |
| **`campaign.published`** | `campaigns` | `campaign` | `sensitive` | Décision humaine de publication (`09` RG5), avec le ou **les deux** validateurs |
| **`campaign.updated`** | `campaigns` | `campaign` | `info` | Modification d'une campagne publiée, avec le régime appliqué (re-validation ou effet immédiat, `09` RG7) |
| `campaign.rejected` | `campaigns` | `campaign` | `sensitive` | Refus avec motif typé |
| `campaign.paused` · `campaign.closed` | `campaigns` | `campaign` | `info` | Mise en pause, clôture (y compris automatique) |
| `block.created` · `block.lifted` | `matching` | `party_block` | `sensitive` | Blocage entre deux parties, posé ou retiré (`10` RG28) |
| `search.settings_changed` | `search` | `search_setting` | `sensitive` | Modification d'un réglage de recherche ou d'une facette (`10` RG2, RG11) |

Les deux premiers étaient explicitement manquants (`09`, Impacts) ; les autres sont leurs frères de
la même migration — un cycle de vie dont seuls deux événements sur six seraient journalisés ne
prouve rien.

**Codes ajoutés au Lot 4, cycle de la file et de la mise en relation** (`13`, Impacts, écart 9 —
**18 codes**). Mêmes remarques : ce sont des **données**, chargées par la migration `0401`, et
l'ajout d'un code n'exige aucun changement de schéma.

| Code | `domain` | `subject_type` | `severity` | Fait relaté |
|---|---|---|---|---|
| `introduction.created` | `matching` | `introduction` | `info` | Entrée en file, quel que soit le déclencheur (`13` RG100, état 1) |
| `introduction.claimed` | `matching` | `introduction` | `info` | Prise en charge par un commercial : le verrou est posé (`13` RG102) |
| `introduction.claim_released` | `matching` | `introduction` | `info` | Le titulaire rend la main sans décider |
| `introduction.claim_expired` | `matching` | `introduction` | `info` | Verrou expiré (`claim_expiry_minutes`, alerte A3) |
| **`introduction.reviewed`** | `matching` | `introduction` | **`sensitive`** | **Ouverture de l'écran de décision : un rôle interne a vu deux identités non révélées** (`13` RG109, point 10). C'est le pendant de `conversation.read` pour l'amont |
| `introduction.approved` | `matching` | `introduction` | `sensitive` | Validation par le commercial titulaire (état 3) |
| `introduction.rejected` | `matching` | `introduction` | `sensitive` | **Refus A**, par INFLUX, avec le motif typé de la liste A (`13` RG83) |
| `introduction.party_accepted` | `matching` | `introduction` | `sensitive` | Acceptation d'une partie, avec son côté et sa version de CGU |
| `introduction.party_declined` | `matching` | `introduction` | `sensitive` | **Refus B**, par une partie, avec le côté et le motif de la **liste B** (`13` RG90). **Le motif n'est jamais restitué à l'autre partie, y compris depuis ce registre** |
| **`introduction.identity_revealed`** | `matching` | `introduction` | **`critical`** | La révélation simultanée (état 4). Le code existait déjà en exemple au §4.3 ; il est ici **inscrit dans le référentiel** |
| `introduction.withdrawn` | `matching` | `introduction` | `info` | Retrait par l'initiateur, ou par le commercial pour une proposition |
| `introduction.expired` | `matching` | `introduction` | `info` | Clôture sans suite, **avec son sous-motif** (`13` RG95) |
| `introduction.reassigned` | `matching` | `introduction` | `sensitive` | Changement de commercial responsable, motif typé (`backoffice-ops` règle 18) |
| `introduction.reminder_sent` | `matching` | `introduction` | `info` | Relance J+3 ou J+6, avec la partie relancée (`13` RG92) |
| `introduction.email_delivered` | `matching` | `introduction` | `info` | Accusé du prestataire d'envoi, **avec le `messageId`** (`13` RG79) |
| `introduction.email_failed` | `matching` | `introduction` | `sensitive` | Échec définitif après rejeux : **une mise en relation sans preuve externe** (alerte A8) |
| `introduction.batch_created` | `matching` | `introduction_batch` | `info` | Envoi groupé d'une proposition INFLUX, avec le nombre de créateurs (`13` RG54) |
| `introduction.cap_reached` | `matching` | `account` | `info` | Plafond atteint : sélection de 20, 60 propositions par jour, plafonds de candidature (`13` RG53) |

> **`introduction.batch_created` porte `subject_type = 'introduction_batch'` et
> `subject_id = proposal_batch_id`.** C'est le seul sujet du registre qui ne corresponde pas à une
> table : le lot n'a **pas** de table à lui (§5.6), et le registre n'a jamais eu de clé étrangère
> vers ses sujets — c'est précisément ce qui l'autorise.

**Codes ajoutés au Lot 4, messagerie** (`12`, Impacts, manque 6 — **17 codes**, chargés par les
migrations `0403` et `0405`).

| Code | `domain` | `subject_type` | `severity` | Fait relaté |
|---|---|---|---|---|
| `conversation.opened` | `messaging` | `conversation` | `info` | Ouverture du fil et de ses trois participants (`12` RG1, RG2) |
| `conversation.paused` · `conversation.resumed` | `messaging` | `conversation` | `info` | Pause et reprise, **avec le motif typé et l'auteur** (`12` RG17, RG19) |
| `conversation.closed` | `messaging` | `conversation` | `sensitive` | Clôture, avec son motif typé (`12` RG20) |
| `conversation.reopened` | `messaging` | `conversation` | `sensitive` | **Réouverture**, avec son motif (`12` RG22). C'est le registre, et non une colonne écrasée, qui porte la suite des clôtures et des réouvertures |
| `conversation.archived` | `messaging` | `conversation` | `info` | Archivage, automatique à 90 jours ou manuel (`12` RG23) |
| `conversation.agent_joined` · `conversation.agent_left` | `messaging` | `conversation` | `sensitive` | Entrée et sortie d'un agent, nommé et horodaté. **Jamais un ajout silencieux** (`12` RG8, RG9) |
| `conversation.write_closed_by_block` | `messaging` | `conversation` | `sensitive` | Fermeture de l'écriture des deux parties à la suite d'un blocage (`12` RG87). Le blocage lui-même reste journalisé par `block.created` / `block.lifted`, créés au Lot 3 |
| `conversation.read` | `messaging` | `conversation` | `sensitive` | Lecture par un rôle interne, **avec son motif typé** (`12` RG55, A10). Doublon assumé avec `messaging.conversation_access_log` : le journal détaillé sert l'exploitation, le registre sert la preuve |
| `report.created` · `report.decided` | `messaging` | `report` | `sensitive` | Signalement émis, puis issue typée (`12` RG82, RG84) |
| `detection.reviewed` | `messaging` | `contact_detection` | `sensitive` | Classement d'une détection par un commercial (`12` RG50) |
| `document.uploaded` | `messaging` | `document` | `info` | Dépôt d'un document *(conditionnel au canal de documents)* |
| `document.reviewed` | `messaging` | `document` | `sensitive` | Contrôle par un agent, accepté ou refusé avec motif (`12` RG73) |
| `document.available` | `messaging` | `document` | `info` | **Mise à disposition de l'autre partie** — distincte du contrôle (`12` RG74) |
| `document.downloaded` | `messaging` | `document` | `info` | Téléchargement, avec son auteur (`12` RG75) |

**Codes ajoutés au Lot 5, backoffice et vie du compte** (`15`, écart 12 — **23 codes**). Certains
sont chargés plus tôt, avec le lot qui crée le fait : la colonne « Lot » le dit.

| Code | `domain` | `subject_type` | `severity` | Lot | Fait relaté |
|---|---|---|---|---|---|
| `account.suspended` · `account.suspension_lifted` | `backoffice` | `account` | `critical` | 5 | Suspension et levée, **avec leur motif typé** (`15` RG52, RG55) |
| `account.note_added` | `backoffice` | `account` | `info` | 5 | Note interne ajoutée — **immuable**, donc jamais de `note_edited` |
| `account.field_corrected` | `backoffice` | `account` | `sensitive` | 5 | Correction d'une donnée de compte par un interne (`15`, `09` RG94) |
| `ownership.reassigned` | `backoffice` | `account` | `sensitive` | 1 | Changement de commercial responsable, motif typé |
| `ownership.bulk_transferred` | `backoffice` | `account` | `critical` | 5 | Transfert **en masse** d'un portefeuille — rare, donc d'autant plus à tracer |
| `queue.claim_forced_release` | `backoffice` | `queue_entry` | `sensitive` | 4 | Verrou orphelin levé par un administrateur : **le titulaire dépossédé en est informé** (`15` C4, `03` C(20)) |
| `alert.acknowledged` · `alert.closed` | `backoffice` | `alert_instance` | `info` | 4 | Prise en charge et classement d'une alerte d'événement (`15` RG69) |
| `dual_control.requested` · `dual_control.confirmed` · `dual_control.expired` | `backoffice` | `dual_control_request` | `critical` | 1 | Le contrôle à quatre yeux, de bout en bout (`03` PD4, `15` RG31) |
| `export.produced` | `backoffice` | `export` | `critical` | 5 | Export produit, **avec ses filtres exacts et l'empreinte du fichier** (`15` RG94) |
| `privacy.request_received` · `privacy.identity_verified` · `privacy.request_executed` · `privacy.request_closed` | `backoffice` | `data_subject_request` | `critical` | 5 | Les quatre moments d'une demande relative aux données personnelles (`15` §G). **`identity_verified` est un code à part** : exécuter un effacement sans avoir vérifié qui demande est le pire des scénarios |
| `agent.invited` · `agent.role_changed` · `agent.deactivated` · `agent.mfa_reset` | `identity` | `account` | `critical` | 0 | Cycle de vie d'un compte interne. **`mfa_reset` est `critical`** : c'est une primitive de prise de contrôle |
| **`agent.break_glass_login`** | `identity` | `account` | **`critical`** | **0** | **Connexion du compte de secours** (`15` RG103, AL33). Alerte immédiate au fondateur, justification écrite sous 24 h |
| `settings.changed` | `backoffice` | `setting` | `sensitive` | 1 | Modification d'un paramètre d'exploitation, d'un plafond ou d'un SLA, **nominativement** |

> **`agent.*` et `dual_control.*` arrivent aux Lots 0 et 1, pas au Lot 5**, alors que le reste du
> backoffice arrive au Lot 5 : les comptes internes et le compte de secours existent **dès le premier
> jour** (`15` RG103), et la première action à double validation est la correction d'une adresse
> e-mail (`identity.correct_email()`, Lot 1), qui est une **primitive de prise de contrôle de
> compte**. Journaliser à partir du Lot 5 laisserait quatre lots sans trace sur exactement les actes
> qui en ont le plus besoin.

> **Pourquoi `document.uploaded`, `document.available` et `document.downloaded` sont trois codes et
> non un seul.** Le dépôt, la mise à disposition et le téléchargement se produisent à trois instants,
> sous la responsabilité de trois personnes différentes, et c'est exactement la question qu'on posera
> en cas de litige : « qui a mis ce fichier à la disposition de qui, et quand l'a-t-il récupéré ? »
> Un code unique rendrait la réponse impossible.

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
`activated_at`, `mfa_enrolled_at`, `requires_reassignment boolean`, `created_at`, `updated_at`,
**plus les six colonnes ajoutées par `15`** (écart 8) :

| Colonne | Type | Contrainte | Pourquoi (`15`) |
|---|---|---|---|
| **`is_active`** | `boolean` | `not null default true`, `check (is_active = (deactivated_at is null))` | **RG105** : un compte interne **n'est jamais supprimé** — ses actions passées conservent son nom, sinon six mois de journal deviennent illisibles |
| `deactivated_at` | `timestamptz` | Couple lié à `is_active` | Idem |
| **`deactivated_by_account_id`** | `uuid` | FK interne, `check ((deactivated_at is null) = (deactivated_by_account_id is null))` | Une désactivation a un auteur |
| **`is_break_glass`** | `boolean` | `not null default false` | **RG103** : le **compte de secours**, qui existe **dès le Lot 0** (`03` MFA-10, constat bloquant B7) |
| **`absence_from`, `absence_to`** | `date` | `check (absence_to is null or absence_to >= absence_from)` | **RG62** et **RG106** : une absence **déclarée** ne change aucun droit et ne réattribue rien — elle alimente l'alerte **AL41** et le motif de lecture `continuite_de_service` |

```sql
-- un seul compte de secours, et il se voit
create unique index agent_profiles_break_glass_idx
  on identity.agent_profiles (is_break_glass)
  where is_break_glass;

-- AL41 : responsabilites d'un agent absent ou desactive (15 RG60, RG62)
create index agent_profiles_absent_idx
  on identity.agent_profiles (absence_from, absence_to)
  where absence_from is not null;

comment on column identity.agent_profiles.is_break_glass is
  'Compte administrateur de secours (15 RG103, 03 MFA-10). Adresse DISTINCTE, jamais un alias
   d''une adresse personnelle ; TOTP sur un appareil hors ligne ; codes de secours imprimes et
   scelles. TOUTE connexion declenche une alerte immediate au fondateur (AL33) et une ligne
   d''audit (agent.break_glass_login), et son usage est justifie par ecrit sous 24 heures.
   Il n''est JAMAIS utilise pour le travail quotidien.
   Index unique partiel : il n''y en a qu''un, et sa multiplication serait le premier symptome
   d''un probleme.';

comment on column identity.agent_profiles.absence_from is
  'Periode d''absence DECLAREE (15 RG62, RG106). Elle ne change AUCUN droit et ne reattribue
   RIEN : aucune reattribution automatique au MVP. Elle sert a trois choses seulement —
   l''alerte AL41, la justification du motif de lecture continuite_de_service (12 RG56),
   et la lisibilite de la file pour les collegues.';
```

`requires_reassignment` matérialise la règle 19 de `backoffice-ops` : **la réattribution est un
préalable à la désactivation** (`15` RG60, RG105). Le déclencheur qui pose `deactivated_at` refuse si
le compte est encore responsable d'une mise en relation active ou d'une affaire ouverte.

#### `identity.terms_versions`

*Chaque version publiée d'un document contractuel ou informatif, dans une langue donnée.*

| Colonne | Type | Contrainte |
|---|---|---|
| `id` | `uuid` | PK |
| `document_kind` | `identity.document_kind` | `not null` — `terms_of_service` · `privacy_policy` · `cookie_policy` · **`supervision_notice`** *(Lot 4, `12` RG103)* |
| `locale` | `char(2)` | `not null references reference.languages(code)` |
| `version_label` | `text` | `not null` — ex. `2026-09-v1` |
| `content_uri` | `text` | `not null` — chemin du document publié |
| `content_hash` | `bytea` | `not null` — empreinte du texte exact publié |
| `requires_acceptance` | `boolean` | `not null` — vrai pour les CGU, faux pour la politique de confidentialité **et pour l'information de supervision** (`12` RG104 : ce n'est pas un consentement) |
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
| `nature` | `identity.acceptance_nature` | `not null default 'acceptance'` — `acceptance` · **`acknowledgement`** | **Accepter ou avoir pris connaissance** — deux actes juridiquement distincts (`12` RG104) |
| `channel` | `identity.acceptance_channel` | `not null` — `signup` · `re_acceptance` · `introduction_screen` · **`supervision_notice_screen`** | **Par quel moyen** |
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

##### La prise de connaissance de la supervision : une **nature** de plus, pas une table de plus (`12` manque 4)

`12` RG103 et RG104 exigent que la prise de connaissance de l'information « ces échanges sont
supervisés » soit **horodatée, avec la version du texte et la langue**, avant le premier message —
et RG104 précise, à juste titre, que **ce n'est pas un consentement** : on ne demande pas une
autorisation qu'on ne pourrait pas refuser sans fermer le produit.

**Décision : on étend `terms_acceptances`, on ne crée pas de table.** Trois raisons, dans cet ordre :

1. Les colonnes demandées sont **déjà toutes là** : `terms_version_id`, `content_hash` copiée,
   `accepted_at`, `locale`, `ip_address`, `user_agent`, l'unicité par compte et par version, et le
   régime append-only. Une table jumelle aurait dupliqué neuf colonnes sur dix.
2. La question posée deux ans plus tard est **la même** pour les deux actes : « quel texte exact
   cette personne a-t-elle eu sous les yeux, quand, et dans quelle langue ? ». Deux tables
   répondraient à la même question de deux endroits, et **divergeraient**.
3. L'immuabilité de `terms_versions` (déclencheur `BEFORE UPDATE`) protège déjà le texte de
   l'information de supervision **exactement comme** elle protège les CGU.

Ce qu'il fallait ajouter, en revanche, c'est **la distinction juridique**, qu'une table séparée
aurait portée par son nom et qu'une colonne doit désormais porter explicitement :

```sql
create type identity.acceptance_nature as enum ('acceptance', 'acknowledgement');

alter table identity.terms_acceptances
  add column nature identity.acceptance_nature not null default 'acceptance',

  -- l'ecran d'information de supervision ne produit JAMAIS une acceptation,
  -- et une acceptation ne passe JAMAIS par cet ecran
  add constraint terms_acceptances_notice_is_acknowledgement
      check ((channel = 'supervision_notice_screen') = (nature = 'acknowledgement'));

comment on column identity.terms_acceptances.nature is
  'acceptance : la personne a accepte un document qui exige une acceptation (CGU).
   acknowledgement : la personne a PRIS CONNAISSANCE d''une information qu''elle ne pouvait pas
   refuser sans renoncer au produit — information de supervision des echanges (12 RG103, RG104).
   CE N''EST PAS UN CONSENTEMENT et cette ligne ne doit jamais etre presentee comme tel,
   ni dans le produit, ni dans un export, ni devant une autorite.
   La qualification de la base legale appartient a expert-conformite-rgpd (12 Q1, veto).';
```

**Ce que la base garantit alors :** une seule prise de connaissance par compte et par version de
l'information (l'index unique existant suffit : `introduction_id` reste nul), la **version exacte du
texte** par `content_hash`, la **langue** par `locale`, et l'impossibilité de réécrire l'histoire.
« L'écran ne réapparaît pas à la deuxième conversation » (`12` CA56) devient une lecture indexée,
pas une règle d'écran : l'application cherche une ligne `acknowledgement` pour la version en
vigueur de `supervision_notice`, et l'affiche si elle n'existe pas.

**Une conséquence à assumer :** le jour où le texte de l'information change, une **nouvelle version**
est publiée et l'écran **réapparaît une fois** à chaque membre. C'est voulu — une information
modifiée dont personne n'a repris connaissance n'est pas une information donnée.

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
| `max_exclusivity_band` | `text` | `check (... in ('none','le_1m','le_3m','negotiable'))` | F15. **Mêmes bornes que `campaigns.exclusivity_band`** (`09` RG42) : deux vocabulaires rendraient tout rapprochement faux |
| `residence_country_code` | `char(2)` | `not null references reference.countries(code)` | Repris du compte au Lot 1 (`07` RG36) |
| `residence_region_code` | `text` | FK composite `reference.regions (country_code, code)` | **Région de résidence**, niveau administratif 1 (`07` RG37). Affichée **seulement si au moins 5 profils publiés partagent le couple (pays, région)** — le seuil est lu dans `search.search_settings`, jamais codé en dur, et l'évaluation est faite par `apps/api` comme les autres garde-fous de forme de requête. **Jamais une facette** (`07` RG38) |
| `travel_scope` | `text` | `check (travel_scope in ('none','domestic','international'))` | **Déplacements possibles** (`07` RG39). Aucune distance, aucun rayon, aucun point de départ : ce sont des données de localisation fine |
| `delivery_lead_band` | `text` | `check (... in ('lt_7d','7_14d','15_30d','gt_30d'))` | **Délai de livraison habituel** (`07`, bloc 5) |
| `collaboration_experience_band` | `text` | `check (... in ('none','1_5','6_20','gt_20'))` | **Expérience de collaborations** (`07` RG32) : une tranche déclarative, **jamais une liste de marques** — une liste de marques identifie le créateur en une recherche web |
| `figures_updated_at` | `timestamptz` | — | **Date de dernière mise à jour des chiffres**, affichée partout |
| `completeness_percent` | `smallint` | `not null default 0 check (between 0 and 100)` | Calculé par `packages/domain`, stocké pour le tri |
| `status` | `profiles.profile_status` | `not null default 'draft'` | **Cinq valeurs : `draft` · `pending_review` · `published` · `rejected` · `suspended`.** L'état `suspended` était manquant et a été réclamé **indépendamment par `06`, `07` et `09`** : il est posé par un administrateur seul, retire le profil de la recherche et de toute publication **sans rien détruire**, et une campagne dont la marque est suspendue cesse d'être visible (`09` RG11). **La même énumération sert aux deux profils**, marque et créateur |
| `is_searchable` | `boolean` | `not null default true` | **Droit d'opposition** : le créateur peut se retirer de la recherche. Question ouverte de `matching-spec` A12 |
| `published_at` | `timestamptz` | — | — |
| `created_at`, `updated_at` | `timestamptz` | `not null` | — |

Satellites, tous rattachés par `account_id` et **tous en tranches** :

| Table | Clé | Contenu |
|---|---|---|
| `profiles.creator_public_networks` | `(account_id, network_code)` | `audience_band` (FK `reference.audience_bands`), **`reach_band`** (FK `reference.audience_bands` — **portée moyenne par publication**, `07` RG47), `engagement_band` (**FK `reference.engagement_bands`, nul si non vérifié**, `07` RG48), **`publication_frequency_code`** (FK `reference.publication_frequencies`), `is_primary` (**exactement une ligne à vrai**, index unique partiel), `is_verified`, `verified_at`, `figures_measured_at` |
| `profiles.creator_public_audience` | `(account_id, network_code, dimension, bucket)` | Répartition **de l'audience** par pays, âge, genre, **en tranches et agrégée** (A12 : jamais un attribut du créateur) |
| `profiles.creator_public_rates` | `(account_id, network_code, format_code, currency)` | `price_band_code` — FK composite vers `reference.price_bands(currency, code)` |
| `profiles.creator_topics` | `(account_id, topic_code)` | `is_primary boolean`, ≤ 3 secondaires (contrainte par déclencheur de comptage) |
| `profiles.creator_formats` | `(account_id, format_code)` | Formats proposés |
| `profiles.creator_tones` | `(account_id, tone_code)` | **Ton éditorial**, FK `reference.editorial_tones`, **≤ 2** (déclencheur de comptage, comme les thématiques secondaires) — `07` RG34 |
| `profiles.creator_usage_rights` | `(account_id, usage_right_code)` | **Droits d'usage inclus / en option**, FK `reference.usage_rights` + `inclusion` `check (inclusion in ('included','optional'))`. La clé primaire garantit qu'un même droit **ne peut pas être à la fois inclus et en option** (`07` RG73) |
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
| `avg_reach_per_post` | `bigint` | `check (avg_reach_per_post >= 0)` — **portée moyenne par publication** (`07` RG47), valeur exacte. Déclarée **par publication, jamais par mois** : c'est le libellé qui donne son sens au nombre |
| `figures_source` | `text` | `check (... in ('declared','agent_observed'))` |
| `figures_measured_at` | `timestamptz` | — |
| `is_ownership_verified` | `boolean` | `not null default false` |
| `verified_at` | `timestamptz` | — |
| `created_at`, `updated_at` | `timestamptz` | `not null` |

`unique (creator_account_id, network_code, handle)`.

Le **sous-ensemble révélable** est explicite dans le `GRANT` :

```sql
grant select (id, creator_account_id, network_code, handle, profile_url,
              followers_count, engagement_rate, avg_reach_per_post,
              figures_source, figures_measured_at,
              is_ownership_verified, verified_at)
  on profiles.creator_social_accounts to influx_advertiser;
```

**Le `GRANT` est élargi aux chiffres exacts : Q3 du §12.4 est close par `07` RG45 et RG59.** La
première rédaction excluait `followers_count` et `engagement_rate`, y compris après révélation.
`product-owner` a tranché dans l'autre sens, et l'argument est bon : **une fois le `@` connu, la
marque lit le nombre d'abonnés publiquement sur le réseau**. Le lui cacher ajoute de la friction
sans rien protéger, et pousse à sortir de la plateforme pour vérifier.

Trois conditions accompagnent cet élargissement, et elles sont dans le `GRANT` lui-même :

1. **`figures_source` et `figures_measured_at` sont ouvertes avec les chiffres**, jamais sans. Un
   nombre sans sa source ni sa date est un nombre qu'on ne peut pas contester (`07` RG45, RG50).
2. **Le badge continue de ne constater qu'en tranches.** Ce que la marque lit ici est le
   **déclaratif du créateur** ou le constat d'un agent ; ce que le badge affirme reste
   `verification.badges` (§5.3). Les deux ne se confondent pas.
3. **Rien de tout cela n'est lisible avant révélation** : la politique du §6.2 (a) est inchangée, et
   la **vitrine anonymisée ne gagne aucune colonne exacte** — la règle de revue du paragraphe
   précédent reste entière.

> **Cet élargissement reste soumis à `expert-cybersecurite`** : le §12.1, point 3, lui renvoie
> explicitement « la liste exacte des colonnes ouvertes après révélation ». `03` ne l'énumère pas à
> ce jour. En cas de désaccord, c'est `03` qui tranche et ce document qui est corrigé.

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

> **Le profil marque porte la même énumération de statut** (`profiles.profile_status`, cinq valeurs
> depuis cette version) et **le même mécanisme de re-validation partielle** que le profil créateur :
> `06` point 4 et `07` point 6 décrivent exactement le même besoin sur deux objets différents. Voir
> ci-dessous.

#### La dernière version validée survit à une re-validation partielle

**Trois documents indépendants ont signalé le même manque** (`06` point 4, `07` point 6, `09`
point 12) : quand un membre corrige une faute de frappe sur un élément modéré, son profil ou sa
campagne repasse en validation — et **disparaît** jusqu'à la décision de l'agent. Une correction de
faute rend donc invisible ; c'est un défaut produit majeur, et c'est un manque de modèle.

**Deux mécaniques différentes, parce que les deux objets ne se re-valident pas de la même façon.**

| Objet | Régime de re-validation | Forme retenue |
|---|---|---|
| **Profil** (marque et créateur) | **Partielle** : seuls **les éléments modifiés** repassent en examen, les autres champs restent à effet immédiat (`06` RG9, `07` RG9) | La ligne vivante porte **toujours la version validée** ; les valeurs soumises attendent dans `profiles.profile_field_revisions` |
| **Campagne** | **Globale** : la campagne entière repasse en `à valider` (`09` RG7) | La **dernière version publiée** est figée dans `campaigns.campaign_published_snapshots` et c'est **elle** que lit un créateur (§5.4) |

Pour le profil, la forme « pendant » est meilleure que la forme « instantané » : elle évite de
figer les champs à **effet immédiat** (chiffres, tarifs, disponibilité, secteurs refusés), qui
doivent continuer à bouger pendant l'examen.

#### `profiles.moderated_fields` — la liste fermée de ce qui se re-valide

| Colonne | Type | Contrainte |
|---|---|---|
| `code` | `text` | **PK** — ex. `creator.headline`, `creator.network_handle`, `advertiser.brand_name` |
| `profile_kind` | `profiles.profile_kind` | `not null` — `advertiser` · `creator` |
| `target_table` | `text` | `not null` — la table portant la valeur, pour la fonction d'application |
| `label_key` | `text` | `not null` — clé de traduction (R8) |
| `is_active` | `boolean` | `not null default true` |

Une table plutôt qu'un `enum` : la liste des champs modérés bougera au fil de la modération réelle,
et le backoffice doit pouvoir en désactiver un sans migration (§3.1).

#### `profiles.profile_field_revisions` — la valeur soumise, en attente de décision

| Colonne | Type | Contrainte | Rôle |
|---|---|---|---|
| `id` | `uuid` | PK | — |
| `account_id` | `uuid` | `not null references identity.accounts(id)` | Le propriétaire du profil |
| `field_code` | `text` | `not null references profiles.moderated_fields(code)` | **Ce qui change** |
| `row_key` | `text` | — | Discriminant quand le champ est porté par une ligne fille (réseau, visuel de portfolio) |
| `proposed_value` | `jsonb` | `not null check (pg_column_size(proposed_value) <= 8000)` | **La valeur soumise, pas la valeur publiée** |
| `status` | `profiles.revision_status` | `not null default 'pending_review'` | `pending_review` · `approved` · `rejected` · `withdrawn` · `superseded` |
| `submitted_at` | `timestamptz` | `not null default now()` | — |
| `claimed_by_agent_id`, `claimed_at` | — | — | Même verrou de file qu'ailleurs (§5.6) |
| `decided_by_agent_id`, `decided_at` | — | `check (status not in ('approved','rejected') or decided_by_agent_id is not null)` | Décision humaine obligatoire |
| `rejection_reason_code` | `text` | FK, `check (status <> 'rejected' or rejection_reason_code is not null)` | Motif **typé**, jamais muet |
| `sla_due_at` | `timestamptz` | `not null` | Calculé une fois, depuis `backoffice.sla_policies` (D39) |
| `created_at`, `updated_at` | `timestamptz` | `not null` | — |

```sql
-- une seule revision en attente par champ (et par ligne fille) : une resoumission remplace
create unique index profile_field_revisions_pending_idx
  on profiles.profile_field_revisions (account_id, field_code, coalesce(row_key, ''))
  where status = 'pending_review';

comment on table profiles.profile_field_revisions is
  'Valeurs soumises a moderation et EN ATTENTE. La ligne vivante du profil porte toujours la
   derniere version VALIDEE : un profil ne devient jamais invisible parce que son auteur a corrige
   une faute de frappe (06 RG9, 07 RG9, 09 RG7). A l''approbation, la fonction applique la valeur
   sur la table cible et passe la revision a approved, dans la meme transaction.';
```

**Le profil ne change pas d'état pour une re-validation partielle.** `status` reste `published` ; ce
qui est « en attente de validation » est **la révision**, pas le profil. C'est la seule lecture
compatible avec « la dernière version validée reste affichée » — et elle a l'avantage de rendre la
file de validation lisible : le backoffice liste des **révisions**, avec leur champ et leur
ancienneté, pas des profils entiers à relire.

**Les visuels de portfolio gardent leur mécanique propre** (`portfolio_items.moderation_status` et
le déclencheur qui repasse à `pending` quand `storage_path` change) : un visuel est un objet, pas un
champ, et son ancienne version reste affichée tant que la nouvelle n'est pas approuvée.


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
`observed_by_agent_id`, `observed_at`, **`observed_handle`**, **`observed_platform_account_ref`**,
`revoked_at`, `created_at`.
**L'agent constate lui-même le code en ligne** (règle 15) : `observed_by_agent_id` est donc
obligatoire pour qu'une demande de propriété soit approuvée.

> **Les deux colonnes ajoutées disent *ce qui* a été observé, et pas seulement *qui* l'a observé**
> (`08`, écart 5). Sans elles, **RG78 est inapplicable** : on ne peut pas détecter qu'un badge porte
> sur un compte qui a changé d'identifiant ou de titulaire, puisque rien n'a gardé trace de
> l'identifiant vu le jour du constat.
>
> ```sql
> comment on column verification.ownership_codes.observed_handle is
>   'Identifiant @ du compte tel que l''agent l''a LU EN LIGNE au moment du constat (R7).
>    Jamais recopie depuis le declaratif du createur, jamais mis a jour ensuite.
>    C''est la valeur qu''on compare a l''identifiant courant pour detecter un changement (08 RG78).';
>
> comment on column verification.ownership_codes.observed_platform_account_ref is
>   'Identifiant interne stable du compte chez le reseau (numeric user id), quand le reseau
>    l''expose. Un pseudo change, cet identifiant non : c''est le seul element qui distingue
>    « le meme compte renomme » de « un autre compte qui a repris le pseudo ». Nullable :
>    tous les reseaux ne l''affichent pas.';
> ```
>
> `check ((observed_at is null) = (observed_handle is null))` : un constat sans ce qui a été
> constaté n'est pas un constat.

#### `verification.evidence_files`

`id`, `verification_request_id`, `storage_path` (compartiment **privé** `verification-evidence`),
`content_type check (content_type in ('image/png','image/jpeg'))`, `byte_size`,
`checksum bytea`, `capture_period_start date`, `capture_period_end date`,
`uploaded_by_account_id`, `uploaded_at`, `retention_due_at not null`, `deleted_at`.

> **Le PDF est retiré, et `03` fait autorité.** La première rédaction autorisait
> `application/pdf` ; la condition **E1-9** de `03` §6.6 le refuse au MVP, et `08` RG34 tranche dans
> le même sens : **images uniquement**. `03` est le document à veto de `expert-cybersecurite` : la
> contrainte est resserrée, jamais assouplie. La raison tient en une phrase : un PDF est un format
> **actif** (scripts, contenus incorporés, calques) que personne chez INFLUX ne sait désarmer au
> Lot 2, alors qu'une image est ré-encodée et débarrassée de ses métadonnées au dépôt.
>
> Conséquence de mise en œuvre : la restriction est portée **deux fois**, par le `CHECK` ci-dessus
> **et** par la configuration du compartiment Storage (§5.11). Un contrôle d'API seul serait
> contournable par une URL signée mal cadrée.

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
| `state` | `verification.badge_state` | **Cinq valeurs : `active` · `to_refresh` · `to_reconfirm` · `expired` · `revoked`.** `to_reconfirm` (`08` RG78) n'est **pas** `expired` : le badge n'est pas périmé, c'est **l'identité du compte observé qui est en doute** après un changement de pseudo. Il reste **visible du créateur** et **n'est pas affiché comme actif à une marque** |
| `revoked_at`, `revocation_reason_code` | `text references verification.revocation_reasons(code)` | Retrait hors péremption. **Le référentiel manquait** (`08` écart 2) : `revocation_reason_code` pointait dans le vide |
| `observed_handle_at_decision` | `text` | **L'identifiant `@` lu en ligne le jour de la décision** (R7). C'est lui que la tâche quotidienne compare à l'identifiant courant pour lever une entrée « identifiant modifié à contrôler » (`08` RG78) |
| `observed_platform_account_ref` | `text` | Identifiant interne stable du compte chez le réseau, si le réseau l'expose |
| `created_at`, `updated_at` | `timestamptz` | — |

```sql
alter table verification.badges
  add constraint badges_audience_requires_expiry
      check (level <> 'audience_verified' or expires_at is not null),
  add constraint badges_revocation_requires_reason
      check (state <> 'revoked' or revocation_reason_code is not null);

create unique index badges_active_unique_idx
  on verification.badges (account_id, coalesce(social_account_id,'000...'::uuid), level)
  where state in ('active','to_refresh','to_reconfirm');
```

**`to_reconfirm` entre dans l'index d'unicité, et c'est délibéré** : un badge en cours de
reconfirmation occupe la place. Sans cela, un créateur qui change de pseudo pourrait obtenir un
second badge du même niveau sur le même réseau pendant que le premier attend un constat.

#### `verification.revocation_reasons` — les motifs de retrait, distincts des motifs de refus

| Colonne | Type | Contrainte |
|---|---|---|
| `code` | `text` | **PK** |
| `label_key`, `message_key` | `text` | `not null` — libellé interne et message envoyé au créateur (R8) |
| `requires_comment` | `boolean` | `not null default false` |
| `notifies_member` | `boolean` | `not null default true` |
| `escalates_to_admin` | `boolean` | `not null default false` |
| `is_active` | `boolean` | `not null default true` |

Cinq codes chargés par la migration (`08` RG73) : `forged_evidence`, `account_closed`,
`owner_changed`, `terms_breach`, **`influx_error`**.

> **Pourquoi une table distincte de `verification.rejection_reasons`** : refuser une demande et
> retirer un badge déjà accordé sont deux actes différents, avec deux messages différents, deux
> publics différents et deux statistiques différentes. Les fondre dans une liste unique à colonne
> `scope` interdirait la vraie clé étrangère (§3.1) — et surtout, **`influx_error` n'a de sens que
> du côté du retrait** : c'est le motif qui dit qu'INFLUX s'est trompé, et sa fréquence est
> l'indicateur de qualité de la procédure (`08` RG74). Noyé parmi des motifs qui accusent le
> créateur, il ne serait jamais choisi.

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
candidature.* **Neuf blocs, dont un interne.** `09` a relevé **douze écarts** sur cette table : elle
est la plus largement corrigée de cette version.

| Bloc | Colonnes |
|---|---|
| Identification | `id`, `advertiser_account_id`, `title` (10 à 140), **`campaign_type_code`** (FK `reference.campaign_types`), `status`, `internal_reference` (≤ 40, **interne à la marque**), `created_at`, `updated_at`, `published_at` |
| **Textes** | **`public_summary`** (120 à 400), **`brief`** (300 à 4 000), **`product_description`** (20 à 600), **`restrictions`** (≤ 1 000) + table `campaigns.campaign_key_messages` |
| Produit et dotation | `sector_code` (FK `reference.sectors`), **`product_is_sent`**, **`product_value_band_code`** + **`product_value_currency`**, **`creator_keeps_product`**, **`shipping_costs_borne_by`** |
| Livrables | table `campaigns.campaign_deliverables` |
| **Droits et exclusivité** | **`usage_rights_code`** (FK), **`usage_rights_duration_band`**, **`usage_rights_territory_scope`**, **`exclusivity_band`** + table `campaigns.campaign_usage_territories` |
| Ciblage | tables `campaigns.campaign_audience_targets` et `campaigns.campaign_topics` |
| Budget | `per_creator_amount_min_minor`, `per_creator_amount_max_minor`, `currency`, **`remuneration_kind`**, **`creators_wanted`**, **`total_budget_minor` (interne)** + table `campaigns.campaign_price_bands` |
| Calendrier | **`applications_close_on`**, **`content_due_on`**, `starts_on`, `ends_on` — **quatre dates civiles nommées** |
| Candidature | `verified_only boolean`, `max_applications smallint`, **`active_applications_count`** + table `campaigns.campaign_requested_items` |
| Interne | `owner_agent_id`, `internal_note`, `reviewed_by_agent_id`, `review_decided_at`, `rejection_reason_code`, **`second_reviewed_by_agent_id`**, **`second_review_decided_at`**, **`authorizations_declared_at`**, **`authorizations_declared_by_account_id`**, **`authorizations_declaration_locale`**, **`authorizations_declaration_hash`** |

> **Note de modélisation.** Une colonne générée ne peut pas lire une autre table ; le caractère
> sensible du secteur se lit donc par jointure sur `reference.sectors.is_sensitive`. C'est une
> jointure sur une table de dix lignes : aucune raison de la dénormaliser. **`09` RG84 va plus
> loin : ce caractère ne doit jamais être recopié sur la campagne** — c'est pourquoi la revue
> renforcée est contrôlée par un déclencheur qui lit le référentiel, et non par une colonne booléenne
> de commodité (voir plus bas).

#### Les six états, et rien d'autre

```sql
create type campaigns.campaign_status as enum
  ('draft', 'pending_review', 'published', 'paused', 'closed', 'rejected');
```

`09` RG3 en exige **six**, et l'énumération n'était pas écrite dans la première version de ce
document. `paused` et `closed` manquaient à l'appel de fait : sans eux, « en pause » se serait
traduit par un booléen à côté du statut, c'est-à-dire par deux vérités sur le même sujet. `closed`
est **irréversible** (transition contrôlée par déclencheur, comme `billing.deals`).

**`campaigns.rejection_reasons`** — la liste de motifs de la file de validation des campagnes,
citée au §2.2 et au §3.1 mais **jamais définie jusqu'ici** (relevé par le contrôle de complétude du
2026-09-19). Même forme que ses sœurs, une table par file : `code` **PK**, `label_key`,
`message_key` (le message envoyé à la marque, R8), **`is_correctable boolean not null`** *(sans
valeur par défaut, même raisonnement que `matching.rejection_reasons`)*, `requires_comment`,
`sort_order`, `is_active`. Codes du MVP (`09` RG9) : `brief_incomplet` · `budget_incoherent` ·
`dates_incoherentes` · `secteur_sensible_sans_mention` · `contenu_illicite` ·
`coordonnees_dans_le_brief` · `doublon` · `autre`.

#### Le type de campagne : une table de référence, pas un `enum`

`reference.campaign_types` porte les **sept** valeurs de `09` RG18, **sans valeur `other`**. C'est
une taxonomie destinée à servir de critère de rapprochement demain (§3.1, troisième cas) : elle est
donc **versionnée** — on ne réécrit jamais un code utilisé, on le retire (`retired_at`) et on en
introduit un autre. Une valeur `other` en ferait un texte libre déguisé (`matching-spec` A2).

#### Quatre textes, et non un seul

Le champ unique `product_description` (≤ 4 000) fusionnait **quatre objets de nature différente**
(`09` écart 2). Deux conséquences que le champ unique rendait impossibles :

1. **Afficher une carte de campagne courte sans exposer le brief complet.** La carte lit
   `public_summary` (120 à 400 caractères) ; le brief ne part que sur la fiche.
2. **Modérer précisément.** Un refus porte sur « le brief contient une coordonnée directe », pas sur
   « le texte de la campagne ». Avec la table de révisions du §5.2, chaque texte est un champ
   modéré distinct : corriger le brief ne remet pas le résumé en examen.

```sql
alter table campaigns.campaigns
  add constraint campaigns_summary_length
      check (public_summary is null or length(btrim(public_summary)) between 120 and 400),
  add constraint campaigns_brief_length
      check (brief is null or length(btrim(brief)) between 300 and 4000),
  add constraint campaigns_product_length
      check (product_description is null or length(btrim(product_description)) between 20 and 600),
  add constraint campaigns_restrictions_length
      check (restrictions is null or length(restrictions) <= 1000),
  -- les quatre textes obligatoires le sont A LA SOUMISSION, pas au brouillon
  add constraint campaigns_texts_required_when_submitted
      check (status = 'draft'
             or (public_summary is not null and brief is not null
                 and product_description is not null));
```

`campaigns.campaign_key_messages` : `(campaign_id, position smallint)` **PK**,
`body text not null check (length(btrim(body)) between 10 and 200)`, `created_at`.
`check (position between 1 and 5)` — **1 à 5 puces** (`09` RG24, RG27). Une table fille plutôt qu'un
tableau de textes : les puces sont **modérées une par une** et une seule d'entre elles peut porter le
motif de refus.

#### La dotation

| Colonne | Type | Contrainte |
|---|---|---|
| `product_is_sent` | `boolean` | **`not null`, sans valeur par défaut à l'écran** (`09` RG29) |
| `product_value_band_code` | `text` | FK composite vers `reference.price_bands (currency, code)` avec `product_value_currency` — **une tranche, jamais un montant exact** (`09` RG30) |
| `product_value_currency` | `char(3)` | FK `reference.currencies` |
| `creator_keeps_product` | `boolean` | Conservé ou à rendre — « un produit à rendre n'est pas une rémunération » |
| `shipping_costs_borne_by` | `text` | `check (... in ('brand','creator'))` |

```sql
alter table campaigns.campaigns
  add constraint campaigns_gift_fields_consistency
      check (
        case when product_is_sent
             then product_value_band_code is not null
              and product_value_currency  is not null
              and creator_keeps_product   is not null
              and shipping_costs_borne_by is not null
             else product_value_band_code is null
              and product_value_currency  is null
              and creator_keeps_product   is null
              and shipping_costs_borne_by is null
        end);
```

**La valeur de la dotation ne s'additionne jamais à la fourchette de rémunération** (`09` RG31) :
ce sont deux colonnes distinctes, dans deux unités différentes (une tranche, une fourchette exacte),
et aucune vue ne les somme. L'articulation des deux est **déclarée** par `remuneration_kind`.

#### Les droits d'usage remontent au niveau de la campagne

`09` RG41 est net : les droits d'usage, leur durée, leur territoire et l'exclusivité sont des
**conditions de la campagne entière**, pas des attributs d'une ligne de livrable — « une campagne
dont le reel et la story auraient des droits différents est deux campagnes ». `usage_rights_code` et
`exclusivity_band` **quittent donc `campaign_deliverables`** pour `campaigns.campaigns`, et deux
manques sont comblés au passage : la **durée** et le **territoire**.

| Colonne | Type | Contrainte |
|---|---|---|
| `usage_rights_code` | `text` | `not null references reference.usage_rights(code)` |
| `usage_rights_duration_band` | `text` | `check (... in ('1m','3m','6m','12m','unlimited'))` — `09` RG39 |
| `usage_rights_territory_scope` | `text` | `check (... in ('worldwide','selected_countries'))` |
| `exclusivity_band` | `text` | `check (... in ('none','le_1m','le_3m','negotiable'))` — **mêmes bornes que le profil créateur** (`09` RG42) |

```sql
alter table campaigns.campaigns
  -- des droits sans duree ni territoire n'existent pas dans ce produit (RG39)
  add constraint campaigns_usage_rights_need_terms
      check (usage_rights_code = 'none'
             or (usage_rights_duration_band is not null
                 and usage_rights_territory_scope is not null)),
  -- une campagne UGC ne peut pas ne pas ceder de droits (RG43)
  add constraint campaigns_ugc_requires_usage_rights
      check (campaign_type_code <> 'ugc_delivered' or usage_rights_code <> 'none');
```

`campaigns.campaign_usage_territories` : `(campaign_id, country_code)` **PK**, FK
`reference.countries`. Obligatoire dès que `usage_rights_territory_scope = 'selected_countries'` —
et, comme toute contrainte « au moins un fils », **portée par la fonction de soumission et une
requête de contrôle**, pas par une contrainte déclarative (même aveu qu'au §5.7 : je préfère le dire
que de laisser croire à une garantie qui n'existe pas).

#### Quatre dates nommées, et un ordre écrit en base

`publication_deadline` était ambiguë : elle pouvait désigner la date limite de candidature comme la
fin de la période de publication. Elle **disparaît**, remplacée par les quatre dates de `09` RG69,
toutes des **dates civiles** (R4, `09` RG73) :

| Colonne | Caractère | Ce qu'elle dit |
|---|---|---|
| `applications_close_on` | **Obligatoire** | Date limite de candidature. Au-delà, la campagne n'accepte plus de candidature mais **reste lisible** (`09` RG72) |
| `content_due_on` | Recommandée | Date de livraison des contenus à la marque |
| `starts_on` | **Obligatoire** | Début de la période de publication |
| `ends_on` | **Obligatoire** | Fin de la période de publication |

```sql
alter table campaigns.campaigns
  -- RG70 : l'ordre des quatre dates, en une seule contrainte lisible
  add constraint campaigns_dates_ordered
      check (
        applications_close_on <= coalesce(content_due_on, starts_on)
        and coalesce(content_due_on, applications_close_on) <= starts_on
        and starts_on <= ends_on),
  -- RG74 : au-dela de 12 mois, c'est un contrat d'ambassadeur, pas une campagne
  add constraint campaigns_publication_window_max_12m
      check (ends_on <= starts_on + interval '12 months'),
  -- RG71 : aucune des quatre dates n'est dans le passe A LA PUBLICATION.
  -- Non declaratif (depend de now()) : controle par la fonction de publication, qui refuse
  -- avec le motif type « calendrier depasse ».
  add constraint campaigns_dates_required_when_submitted
      check (status = 'draft'
             or (applications_close_on is not null and starts_on is not null and ends_on is not null));
```

> **Une contrainte qui compare une date à `now()` ne peut pas être déclarative** : `CHECK` doit être
> immuable. Le contrôle « aucune date dans le passé » vit donc dans la fonction de publication, et
> c'est dit ici pour que personne ne croie la base garante de cette règle-là.

#### Budget : nature, nombre de créateurs, et tranches dérivées

| Colonne | Type | Contrainte |
|---|---|---|
| `remuneration_kind` | `campaigns.remuneration_kind` | `not null` — `cash` · `cash_and_gift` · `gift_only` · `affiliate` (`09` RG62). **Un `enum` et non une table** : le code branche dessus (§3.1, premier cas) |
| `creators_wanted` | `smallint` | `check (creators_wanted between 1 and 50)` (`09` RG66) |

```sql
alter table campaigns.campaigns
  -- RG63 : « dotation seule » signifie qu'il n'y a pas de fourchette en numeraire
  add constraint campaigns_gift_only_has_no_cash_range
      check (remuneration_kind <> 'gift_only'
             or num_nonnulls(per_creator_amount_min_minor, per_creator_amount_max_minor) = 0),
  -- RG62 : « numeraire et dotation » suppose un produit envoye
  add constraint campaigns_cash_and_gift_requires_product
      check (remuneration_kind <> 'cash_and_gift' or product_is_sent),
  -- RG55, RG64 : toute autre nature exige une fourchette, meme estimee (affiliation comprise)
  add constraint campaigns_cash_range_required
      check (status = 'draft' or remuneration_kind = 'gift_only'
             or (per_creator_amount_min_minor is not null and per_creator_amount_max_minor is not null)),
  -- RG68 : un minimum strictement positif, un maximum au moins egal
  add constraint campaigns_min_amount_positive
      check (per_creator_amount_min_minor is null or per_creator_amount_min_minor > 0),
  add constraint campaigns_budget_range
      check (per_creator_amount_min_minor is null
             or per_creator_amount_max_minor is null
             or per_creator_amount_min_minor <= per_creator_amount_max_minor),
  -- un montant sans devise n'existe pas (R3), dotation comprise
  add constraint campaigns_amount_needs_currency
      check (num_nonnulls(per_creator_amount_min_minor, per_creator_amount_max_minor,
                          total_budget_minor) = 0
             or currency is not null);
```

**Le rapport maximum / minimum supérieur à 10 n'est pas une contrainte** : `09` RG68 demande une
**alerte au modérateur**, pas un refus. Une fourchette de 100 à 50 000 est une absence de budget,
mais c'est au modérateur de le dire, pas à la base de le refuser.

**`campaigns.campaign_price_bands` — la tranche de budget dérivée** (`09` écart 7, RG59) :

| Colonne | Type | Contrainte |
|---|---|---|
| `campaign_id` | `uuid` | **PK avec `price_band_code`**, FK |
| `currency` | `char(3)` | `not null` — la devise de la campagne, recopiée pour porter la clé étrangère composite |
| `price_band_code` | `text` | `not null`, FK composite `(currency, price_band_code) → reference.price_bands (currency, code)` |
| `derived_at` | `timestamptz` | `not null` — quand la dérivation a été faite |

*Une fourchette exacte 1 000 – 2 000 EUR couvre une à plusieurs tranches du référentiel ; d'où une
table fille et non une colonne.* Cette table sert **deux usages, et c'est ce qui la justifie** :

1. **Le filtrage** de la recherche de campagnes côté créateur, qui compare des **codes**, jamais des
   montants ;
2. **L'affichage du net créateur estimé**, lu directement dans `reference.price_bands.net_*` — donc
   **sans aucune multiplication d'un montant par un taux** (`09` RG59, `03` C(32), contrôle T16).

La dérivation est faite **à la publication**, une fois, par une fonction déterministe ; elle est
refaite si la fourchette change (ce qui repasse de toute façon en validation, `09` RG7). Si la devise
ne dispose d'aucune tranche, la table reste vide : **le net n'est alors pas affiché**, jamais estimé
à la volée (`09`, cas limite).

#### Candidature : ce que la marque demande, et ce qui est compté

`campaigns.requested_items` (référentiel, cinq codes de `09` RG77) et
`campaigns.campaign_requested_items` `(campaign_id, item_code)` **PK**, **≤ 4** par déclencheur de
comptage.

```sql
comment on table campaigns.campaign_requested_items is
  'Elements que la marque met en avant a l''intention du createur (09 RG77).
   CHAMP INFORMATIF UNIQUEMENT (arbitrage chef-de-projet du 2026-09-19) :
   il ne modifie AUCUN champ du formulaire de candidature, qui est unique et fixe (11 RG47).
   La motivation reste obligatoire sur toute candidature, quelle que soit la campagne :
   c''est cette invariance qui garantit le motif ecrit exige par A9.
   Toute lecture de cette table qui conditionnerait un champ de formulaire est un defaut.';
```

**`active_applications_count`** (`integer not null default 0`) est maintenue par déclencheur sur
`matching.introductions` : c'est le compteur que `max_applications` contraint (§5.6, `11` écart 2).

#### La revue renforcée à deux validateurs

`reviewed_by_agent_id` était **unique** : il n'y avait aucune place pour le second décideur qu'exige
`09` RG85 sur un secteur sensible, ni pour la déclaration d'autorisations.

| Colonne | Type | Rôle |
|---|---|---|
| `second_reviewed_by_agent_id` | `uuid` | FK interne. **Doit différer du premier** |
| `second_review_decided_at` | `timestamptz` | — |
| `authorizations_declared_at` | `timestamptz` | Horodatage de la case **non pré-cochée** de RG85 |
| `authorizations_declared_by_account_id` | `uuid` | FK — **qui** a déclaré, côté marque |
| `authorizations_declaration_locale` | `char(2)` | La langue dans laquelle le texte a été présenté |
| `authorizations_declaration_hash` | `bytea` | **Empreinte du texte exact affiché** — même mécanique que `identity.terms_acceptances` : une déclaration dont on ne sait plus ce qu'elle disait ne prouve rien |

```sql
alter table campaigns.campaigns
  add constraint campaigns_published_needs_review
      check (status <> 'published' or reviewed_by_agent_id is not null),
  add constraint campaigns_second_reviewer_is_distinct
      check (second_reviewed_by_agent_id is null
             or second_reviewed_by_agent_id <> reviewed_by_agent_id),
  add constraint campaigns_declaration_is_complete
      check (authorizations_declared_at is null
             or (authorizations_declared_by_account_id is not null
                 and authorizations_declaration_locale is not null
                 and authorizations_declaration_hash   is not null));
```

**Le reste ne peut pas être déclaratif, et c'est assumé** : « une campagne de secteur sensible exige
un second validateur et une déclaration » suppose de lire `reference.sectors.is_sensitive`, ce qu'un
`CHECK` ne sait pas faire — et `09` RG84 interdit de recopier ce caractère sur la campagne. Un
déclencheur `BEFORE UPDATE` `campaigns.assert_enhanced_review()` fait la jointure et refuse le
passage à `published` si le second validateur ou la déclaration manque. C'est le **seul** endroit du
domaine `campaigns` où une règle de publication n'est pas déclarative ; elle est doublée d'un test
d'intégration.

#### `campaigns.campaign_published_snapshots` — ce qu'un créateur lit

*La dernière version publiée d'une campagne, figée, et servie telle quelle pendant qu'une nouvelle
version est en examen.*

| Colonne | Type | Contrainte |
|---|---|---|
| `id` | `uuid` | PK |
| `campaign_id` | `uuid` | `not null` FK |
| `version` | `smallint` | `not null`, `unique (campaign_id, version)` |
| `payload` | `jsonb` | `not null check (pg_column_size(payload) <= 32000)` — **la projection publiée**, codes et montants uniquement |
| `content_hash` | `bytea` | `not null` — empreinte de ce qui a été montré aux créateurs |
| `published_at` | `timestamptz` | `not null` |
| `published_by_agent_id` | `uuid` | `not null` FK interne |
| `second_published_by_agent_id` | `uuid` | FK interne — revue renforcée |
| `created_at` | `timestamptz` | `not null` |

Et sur la campagne : `current_snapshot_id uuid references campaigns.campaign_published_snapshots(id)`.

**Deux bénéfices, dont un que je n'attendais pas en écrivant la correction :**

1. **La dernière version validée reste affichée** pendant une re-validation (`09` RG7) : la ligne
   vivante peut repasser en `pending_review`, l'instantané, lui, ne bouge pas.
2. **Le budget total interne ne peut pas fuiter.** Le rôle créateur ne lit **jamais** la ligne
   vivante : il lit l'instantané, qui **ne contient structurellement pas** `total_budget_minor`,
   `internal_reference` ni `internal_note` (`09` RG65). Ce n'est plus un `GRANT` de colonne à ne pas
   oublier — c'est une donnée qui n'existe pas dans l'objet lu.

> **Un `jsonb`, et j'assume l'exception** (la seconde du modèle, avec `leads.sync_settings`). Une
> table de versions à colonnes identiques doublerait trente colonnes et leurs contraintes, et
> divergerait à la première évolution du schéma. Ici, l'instantané n'est pas une source de vérité :
> **c'est une copie datée de ce qui a été montré**, dont la forme est validée par un schéma zod dans
> `packages/contracts` et dont l'empreinte est conservée. La vérité reste la ligne vivante.

#### Les tables filles du ciblage et des livrables

`campaigns.campaign_deliverables` : `(campaign_id, network_code, format_code)` **PK**, `quantity`,
`notes`. **`usage_rights_code` et `exclusivity_band` n'y sont plus** : ils ont remonté sur la
campagne (RG41).

**`campaigns.campaign_audience_targets`, détaillée** (`09` écart 10, `10`). Une ligne par valeur
visée, **toujours un code de liste fermée, jamais un pourcentage** :

| Colonne | Type | Contrainte |
|---|---|---|
| `campaign_id` | `uuid` | `not null` FK |
| `dimension` | `campaigns.audience_dimension` | `not null` — `country` · `language` · `audience_band` · `age_band` · `audience_gender` |
| `country_code` | `char(2)` | FK `reference.countries` |
| `language_code` | `char(2)` | FK `reference.languages` |
| `audience_band_code` | `text` | FK `reference.audience_bands` |
| `age_band_code` | `text` | FK `reference.age_bands` |
| `audience_gender_code` | `text` | FK `reference.audience_genders` |
| `value_code` | `text` | **colonne générée `stored`** = `coalesce(...)` des cinq précédentes |

```sql
alter table campaigns.campaign_audience_targets
  add constraint audience_targets_exactly_one_value
      check (num_nonnulls(country_code, language_code, audience_band_code,
                          age_band_code, audience_gender_code) = 1),
  add constraint audience_targets_value_matches_dimension
      check ((dimension = 'country'         and country_code         is not null)
          or (dimension = 'language'        and language_code        is not null)
          or (dimension = 'audience_band'   and audience_band_code   is not null)
          or (dimension = 'age_band'        and age_band_code        is not null)
          or (dimension = 'audience_gender' and audience_gender_code is not null)),
  add primary key (campaign_id, dimension, value_code);
```

**Cinq colonnes typées plutôt qu'un couple `(dimension, value_code)` en texte libre** : c'est la
seule forme qui garde une **vraie clé étrangère** par dimension (R1). Le prix est une colonne
générée ; le bénéfice est qu'un code de pays inexistant ou une tranche d'âge inventée sont refusés
**par la base**, et que les mêmes référentiels servent au profil créateur et à la campagne — sans
quoi aucun rapprochement, humain aujourd'hui ou pondéré demain, ne serait possible
(`09` RG49 à RG54).

**Aucune tranche d'âge sous 18 ans n'est modélisable** : `reference.age_bands` porte
`check (min_age >= 18)`. Une campagne ne peut donc pas viser une audience mineure, même par erreur
de saisie (`09` RG51, D15).

`campaigns.campaign_topics` : `(campaign_id, topic_code)`, ≤ 3 (déclencheur de comptage), FK
`reference.topics` — **le même référentiel que les thématiques d'un créateur** (`09` RG54).

**Ce qui rend `campaigns.campaigns` sensible :** `total_budget_minor`, `internal_reference` et
`internal_note` sont des **données internes à la marque** — le cadrage dit « rémunération par
créateur publiée, budget total interne ». Depuis cette version, la protection n'est plus seulement
un `GRANT` de colonne à ne pas oublier : **le rôle créateur lit l'instantané publié, jamais la ligne
vivante**.

---

### 5.5 `search` — journal de recherche et sélections (Lot 3)

#### `search.search_queries`

*Chaque recherche lancée, par qui, avec quels filtres, et ce qu'elle a renvoyé.* C'est à la fois un
garde-fou anti-aspiration et **le jeu de données qui permettra de régler D11**.

`id`, `account_id`, `actor_role`, `view_mode` (`advertiser_anonymous` · `agent_identified`),
`campaign_id` (nullable), `filters jsonb not null`, **`sort_code text not null`**,
**`facet_config_version bigint not null references search.facet_config_versions(version)`**,
`result_count int not null`, `page_reached smallint not null`,
`blocked_by_k_anonymity boolean not null`, `request_id`, `created_at`. **Append-only.**

> **Les deux colonnes ajoutées sont ce qui rend le journal interprétable** (`10` écart 4). Sans le
> **tri actif** et sans la **version des facettes en vigueur au moment de la recherche**, une mesure
> avant / après un changement de pondération ou d'ouverture de facette (`10` RG88) ne veut rien
> dire : on comparerait deux populations de requêtes produites par deux moteurs différents, sans
> savoir lequel a produit quoi. Ce sont **deux colonnes qui coûtent seize octets** et sans
> lesquelles tout le journal perd sa seconde finalité.
>
> `sort_code` est une liste fermée contrôlée par `CHECK` : le tri par défaut de `10` RG35 (`default`)
> est le seul au Lot 3, mais le jour où un second tri apparaît, les recherches passées restent
> lisibles.

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

#### `search.impression_reasons` — l'explication affichée, rejouable et mesurable

*Les 2 à 4 raisons montrées sur une carte (« Proposé car : … »), rattachées à l'impression qui les a
portées.*

| Colonne | Type | Contrainte |
|---|---|---|
| `search_query_id` | `uuid` | **PK avec les deux suivantes**, FK composite vers `search.search_impressions` |
| `creator_account_id` | `uuid` | idem |
| `reason_code` | `text` | `not null references search.explanation_reasons(code)` |
| `position` | `smallint` | `not null check (position between 1 and 4)` — l'ordre d'affichage, qui suit les paliers de `10` RG35 |
| `reason_params` | `jsonb` | `not null default '{}' check (pg_column_size(reason_params) <= 500)` — **codes et tranches uniquement** |

`search.explanation_reasons` est le référentiel des raisons (`code`, `label_key`, `tier` — le palier
de tri dont la raison est issue, `is_active`).

**Pourquoi rattacher l'explication à l'impression plutôt que la recalculer** (`10` écart 5) : parce
que le calcul changera. Les paliers de tri, les facettes ouvertes et les libellés évolueront, et
rejouer aujourd'hui l'explication d'une recherche de mars ne reproduira pas ce que la marque a lu.
Or la question qui compte pour D11 est précisément **« quelle raison affichée a converti ? »** :
elle exige la raison **telle qu'elle a été montrée**.

**Deux garanties de fond, portées par la forme de la table :**

1. **`reason_params` ne contient jamais un nombre exact** (`10` RG41, règle 4). Une explication
   stocke `{"threshold_band":"gt_70"}`, jamais `{"share":72}` : un pourcentage exact dans une
   explication annule la facette qu'il illustre, et il serait ici **conservé** — donc exportable.
2. **Aucun libellé français ni anglais** (R8) : un code, des paramètres, et les fragments ICU
   vivent dans `next-intl` (`10` RG41, règle 6).

Volume : 2 à 4 lignes par impression, soit au plus 48 par recherche. Négligeable, et irremplaçable
plus tard.

#### `search.facet_settings`, `search.facet_config_versions` et `search.search_settings`

*Ce qui est ouvert, ce qui est plafonné, et depuis quand.* Trois documents demandent la même chose
sous trois angles (`10` écarts 2 et 3) : **les réglages de la recherche sont des données, pas des
constantes**.

| Table | Clé | Contenu |
|---|---|---|
| `search.facet_settings` | `facet_code` **PK** | `wave smallint not null` (vague d'ouverture), `is_open boolean not null`, `display_order smallint not null`, `updated_by_account_id`, `updated_at` — `10` RG11 |
| `search.facet_config_versions` | `version bigint identity` **PK** | `changed_at`, `changed_by_account_id`, `snapshot jsonb not null`, `note`. **Append-only** : une ligne par changement de configuration de facettes |
| `search.search_settings` | `key text` **PK**, liste fermée par `CHECK` | `value jsonb not null`, `updated_by_account_id`, `updated_at` |

Clés de `search.search_settings`, fermées par `CHECK` (`10` RG2, RG57, RG63) :
`is_open_to_advertisers`, `k_anonymity_threshold` (5), `page_size` (12), `max_pages` (5),
`rate_limits` (30/h, 200/j, 60 profils ouverts/j), `cold_profile_quota`,
`critical_mass_thresholds` (30 profils publiés, 5 par thématique), `alert_thresholds`,
`region_display_threshold` (5, lu par `profiles.creator_public_profiles.residence_region_code`).

Trois garanties, calquées sur `leads.sync_settings` (§5.8) : l'écriture est réservée à
`influx_admin` par une fonction `SECURITY DEFINER` qui **écrit un événement chaîné
`search.settings_changed`** (ancienne et nouvelle valeur) ; **toute modification de `facet_settings`
insère une ligne dans `facet_config_versions`**, ce qui donne à `search_queries` la version à
recopier ; et la lecture se fait **à chaque recherche**, jamais au démarrage du service.

> **La même exception clé/valeur qu'au §5.8, pour la même raison** : la liste des clés est fermée
> par un `CHECK`, chaque valeur a son schéma zod, et l'alternative — une colonne par réglage —
> imposerait une migration à chaque nouveau plafond, c'est-à-dire exactement ce que « modifiable
> sans redéploiement » cherche à éviter.

#### `search.supply_counters` — les compteurs de masse critique (D38)

| Colonne | Type | Contrainte |
|---|---|---|
| `snapshot_on` | `date` | **PK avec les deux suivantes** |
| `dimension` | `text` | `not null check (dimension in ('global','topic','country'))` |
| `dimension_value` | `text` | `not null default '*'` |
| `published_profiles_count` | `integer` | `not null check (>= 0)` |
| `searchable_profiles_count` | `integer` | `not null check (>= 0)` |
| `computed_at` | `timestamptz` | `not null` |

Une ligne par jour et par valeur, écrite par la tâche quotidienne (`10` RG2). Elle sert à
**proposer** l'ouverture de la recherche, jamais à l'activer : l'atteinte des seuils lève une alerte
au backoffice, la bascule de `search_settings.is_open_to_advertisers` reste **une décision humaine**.

Pourquoi stocker plutôt que compter à la demande : ce qu'on veut savoir n'est pas « combien
aujourd'hui », c'est **« la courbe monte-t-elle ? »**. Une série datée répond aux deux ; un `count(*)`
ne répond qu'à la première, et jamais rétrospectivement. L'index partiel
`creator_public_profiles (status, is_searchable)` du §10.3 sert exactement à alimenter cette tâche.

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
| **`proposal_batch_id`** | `uuid` | `check (proposal_batch_id is null or origin = 'influx_proposal')` | **Le lot d'envoi d'une proposition INFLUX** (`13` RG53 à RG59). Sans table associée, ci-dessous |
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
| `status` | `matching.introduction_status` | `not null default 'pending_review'` | `pending_review` · `in_review` · `approved` · `rejected` · `withdrawn` · `expired`. **`approved` n'est terminal qu'une fois révélée** (`13` RG103, ci-dessous) |
| `rejection_reason_code` | `text` | FK `matching.rejection_reasons`, `check (status <> 'rejected' or rejection_reason_code is not null)` | Motif **typé**, jamais muet. La valeur **`declined_by_party`** distingue le refus B du refus A (ci-dessous) |
| `expiry_reason` | `matching.expiry_reason` | `check ((status = 'expired') = (expiry_reason is not null))` | **Le sous-motif de la clôture sans suite** (`11` écart 4, RG77), **sept** valeurs : `campaign_closed` · `application_deadline_passed` · `advertiser_suspended` · `creator_unavailable` · `no_advertiser_answer` · **`no_creator_answer`** · **`no_answer_both_parties`** (`13` RG95 ; les deux dernières manquaient). Sans lui, le tableau de bord confond **une campagne fermée** et **une marque silencieuse** — deux problèmes opposés, l'un de catalogue, l'autre de relance commerciale. Le message envoyé au créateur, lui, reste **neutre et identique** (`11` RG77) : le sous-motif est interne |
| **`declining_side`** | `matching.party_side` | `check ((declining_side is not null) = (rejection_reason_code = 'declined_by_party'))` | **Refus B** : quelle partie a refusé — `advertiser` · `creator` (`13` RG82) |
| **`decline_reason_code`** | `text` | `references matching.decline_reasons(code)`, `check (decline_reason_code is null or declining_side is not null)` | Motif de la **liste B**, **jamais communiqué à l'autre partie** |
| **`decline_comment`** | `text` | `check (length(decline_comment) <= 1000)` | Commentaire facultatif de la partie qui refuse. Jamais transmis (`13` RG87) |
| **`declined_at`** | `timestamptz` | `check ((declining_side is null) = (declined_at is null))` | Horodatage du refus B |
| **`declined_by_account_id`** | `uuid` | FK, `check ((declining_side is null) = (declined_by_account_id is null))` | L'auteur réel du refus, jamais déduit du côté |
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
               creator_country_at_intro,
               -- ajoutees le 2026-09-19 : l'acceptation et l'etat ne s'ecrivent QUE par fonction
               advertiser_accepted_at, creator_accepted_at,
               advertiser_terms_version_id, creator_terms_version_id,
               status, owner_agent_id)
  on matching.introductions from influx_agent, influx_admin, influx_advertiser, influx_creator;
```

Aucun rôle applicatif ne peut écrire ces colonnes par une mise à jour ordinaire. **Les seules portes
sont des fonctions `SECURITY DEFINER`** — et elles sont **quatre**, pas une.

#### Les quatre fonctions du cycle de mise en relation (corrigé le 2026-09-19)

> **Correction.** `docs/mvp/03-matrice-des-droits-et-rls.md` C(21) décrivait, dans sa première
> rédaction, **une seule** fonction atomique nommée `open_introduction(...)`, censée vérifier que
> son appelant est **un agent avec `aal2`**. La spécification `docs/mvp/13-file-de-validation-et-mise-en-relation.md`
> §F établit que le déclencheur réel de la révélation est **la seconde acceptation d'un membre**
> (RG74), pas une action de commercial : la condition était inexécutable, et le nom
> `open_introduction()` entrait en collision avec la fonction de **création** décrite ici même.
> C(21) a été réécrite en **quatre contrats** (C(21a) à C(21d)) le 2026-09-19 ; ce paragraphe en est
> la contrepartie dans le modèle de données. **Les deux documents disent désormais exactement la même
> chose, et `03` fait foi sur le contrôle d'accès.**

| Moment | Fonction | Appelant | Pose `identity_revealed_at` ? | `03` |
|---|---|---|---|---|
| **0. Création** | `matching.open_introduction(...)` | Membre initiateur, ou agent `aal2` (proposition INFLUX) | **Non** | C(21a) |
| **1. Décision** | `matching.approve_introduction(...)` | Agent `aal2` **titulaire du verrou** | **Non**, sauf la branche `13` RG43 | C(21b) |
| **2. Acceptation** | `matching.record_introduction_acceptance(...)` | **La marque ou le créateur, pour lui-même** | **Non** directement | C(21c) |
| **2bis. Refus** | `matching.record_introduction_decline(...)` | Idem, mêmes contrôles | **Jamais** | C(21c) |
| **3. Révélation** | `matching.reveal_identity(...)` | **Aucun rôle applicatif** — appelée en interne par 1 et 2 | **Oui, seule porte** | C(21d) |

**Le rôle propriétaire.** Les quatre fonctions appartiennent à un rôle dédié
`influx_intro_owner` (`NOLOGIN`, **non accordé à `influx_app`**, membre d'aucun rôle applicatif),
seul détenteur des droits d'écriture sur `identity_revealed_at`, `messaging.conversations` et
`messaging.conversation_participants`. C'est **la propriété commune** qui permet aux moments 1 et 2
d'appeler le moment 3 : `reveal_identity` ne reçoit **aucun `GRANT EXECUTE`**, donc aucun droit ne
peut être élargi un jour par distraction.

```sql
revoke execute on all functions in schema matching from public;

grant execute on function matching.open_introduction(...)
  to influx_advertiser, influx_creator, influx_agent, influx_admin;
grant execute on function matching.approve_introduction(...)
  to influx_agent, influx_admin;                 -- aal2 verifie DANS la fonction
grant execute on function matching.record_introduction_acceptance(...)
  to influx_advertiser, influx_creator;          -- et a personne d'autre : ni agent, ni admin
grant execute on function matching.record_introduction_decline(...)
  to influx_advertiser, influx_creator;
-- matching.reveal_identity(uuid) : AUCUN grant, jamais.
```

**Moment 2 — l'acceptation d'un membre**, qui est le déclencheur réel de la révélation :

```sql
create or replace function matching.record_introduction_acceptance(
          p_introduction_id uuid)
returns void
language plpgsql
security definer
set search_path = ''                             -- P7 : obligatoire, objets tous qualifies
as $$
declare
  v_intro   matching.introductions%rowtype;
  v_account uuid := influx.current_account_id();
  v_side    text;
  v_terms   uuid := identity.current_terms_version_id();   -- lue EN BASE, jamais recue du client
begin
  select * into v_intro
    from matching.introductions
   where id = p_introduction_id
   for update;                                   -- serialise deux acceptations concurrentes

  -- meme erreur pour "n'existe pas" et "vous n'en etes pas partie" (03 T14, IDOR)
  if not found
     or v_account is null
     or v_account not in (v_intro.advertiser_account_id, v_intro.creator_account_id)
     or influx.is_suspended(v_account) then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  v_side := case when v_account = v_intro.advertiser_account_id
                 then 'advertiser' else 'creator' end;     -- DEDUIT, jamais recu en parametre

  if v_intro.status <> 'approved' or v_intro.identity_revealed_at is not null then
    raise exception 'introduction not open for acceptance' using errcode = '55006';
  end if;

  -- deja accepte : refus, SAUF re-acceptation pour changement de version de CGU (13 RG68, Q3)
  ...

  update matching.introductions
     set advertiser_accepted_at      = case when v_side = 'advertiser'
                                            then now() else advertiser_accepted_at end,
         advertiser_terms_version_id = case when v_side = 'advertiser'
                                            then v_terms else advertiser_terms_version_id end,
         creator_accepted_at         = case when v_side = 'creator'
                                            then now() else creator_accepted_at end,
         creator_terms_version_id    = case when v_side = 'creator'
                                            then v_terms else creator_terms_version_id end
   where id = p_introduction_id
  returning * into v_intro;

  perform audit.append('introduction.party_accepted', jsonb_build_object(
            'introduction_id', p_introduction_id, 'side', v_side,
            'terms_version_id', v_terms));

  -- LE point : la revelation est la consequence mecanique de la SECONDE acceptation
  if v_intro.advertiser_accepted_at is not null
     and v_intro.creator_accepted_at is not null then
    perform set_config('influx.reveal_ctx', p_introduction_id::text, true);  -- local a la transaction
    perform matching.reveal_identity(p_introduction_id);
  end if;
end;
$$;
```

**Moment 3 — la révélation**, inchangée dans son effet, resserrée dans son contrat d'appel :

```sql
create or replace function matching.reveal_identity(p_introduction_id uuid)
returns void
language plpgsql
security definer
set search_path = ''                             -- corrige le 2026-09-19 (03 P7, regle 1)
as $$
declare v_intro matching.introductions%rowtype; v_conversation_id uuid;
begin
  -- garde-fou anti-appel direct : SECONDE barriere. La premiere est l'absence de GRANT EXECUTE.
  if current_setting('influx.reveal_ctx', true) is distinct from p_introduction_id::text then
    raise exception 'reveal_identity is not directly callable' using errcode = '55006';
  end if;

  select * into strict v_intro
    from matching.introductions
   where id = p_introduction_id
   for update;                                   -- sérialise deux révélations concurrentes

  -- re-verification COMPLETE et volontairement redondante : on ne fait pas confiance a l'appelant
  if v_intro.identity_revealed_at is not null then
    raise exception 'already revealed' using errcode = '55006';
  end if;
  if v_intro.status <> 'approved' then
    raise exception 'introduction must be approved first' using errcode = '55006';
  end if;
  if v_intro.advertiser_accepted_at is null or v_intro.creator_accepted_at is null then
    raise exception 'both parties must accept first' using errcode = '55006';
  end if;

  update matching.introductions
     set identity_revealed_at = now()
   where id = p_introduction_id;                 -- autorisé : le propriétaire de la fonction a le droit

  -- 1 evenement chaine + 1 conversation + 3 participants + 1 affaire (deals, etat open)
  -- + 2 e-mails en file + 1 notification au commercial responsable
  -- (arbitrage chef-de-projet, 2026-09-19 : l'affaire naît a la revelation ; billing.deals est cree
  -- des le Lot 4 pour cette raison, seule la saisie des montants arrive au Lot 5)
  ...                                            -- tout ou rien
end;
$$;
```

C'est la traduction exacte de la contrainte **C2** du document `02` : « révélation + conversation +
événement chaîné + e-mails, tout ou rien » — la création de l'**affaire** (`billing.deals`, état
`open`, `13` RG74 point 4) y est ajoutée le 2026-09-19, sans quoi l'indicateur « révélée sans état
d'affaire à 30 jours » (**A6**) n'aurait aucune ligne à interroger.

**Moment 1 — la décision du commercial** (`matching.approve_introduction`) n'est pas détaillée ici :
elle pose `status = 'approved'`, `owner_agent_id` et `decided_at`, écrit `introduction.approved` et
met les invitations en file. Elle vérifie **elle-même** que l'appelant est un agent en `aal2`,
**titulaire du verrou** (`claimed_by_agent_id`), sans conflit d'intérêt. Elle appelle
`reveal_identity()` **dans un seul cas** : les deux acceptations existaient déjà avant la validation
(`13` RG43 — la marque a demandé le contact *et* le créateur a candidaté sur la même campagne), et
cette branche-là exige une confirmation séparée et un second facteur frais (`03` C(21b)).
**Valider n'est pas révéler** (`13` RG42).

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

#### Les deux refus ne sont pas le même objet — `matching.decline_reasons` (`13` écart 2)

> **C'est le manque le plus lourd de conséquence des deux documents du Lot 4.** `13` RG82 établit
> qu'il existe **deux refus distincts**, à deux moments, par deux acteurs, avec deux listes de motifs
> et deux messages. Le modèle n'en connaissait qu'un. En l'état, un refus de partie se serait rangé
> dans la liste A — celle d'INFLUX — et **toute statistique de refus aurait été fausse, dans les deux
> sens** : des refus attribués à INFLUX qu'il n'a pas prononcés, et des refus de parties invisibles.

| | **Refus A — INFLUX refuse** | **Refus B — une partie refuse** |
|---|---|---|
| Quand | Avant validation, dans la file (`in_review` → `rejected`) | **Après** validation, à l'écran d'acceptation (`approved` non révélée → `rejected`) |
| Support | `rejection_reason_code` → `matching.rejection_reasons` (**liste A**) | `rejection_reason_code = 'declined_by_party'` **plus** `declining_side`, `decline_reason_code` → `matching.decline_reasons` (**liste B**) |
| Qui décide | Le commercial titulaire du verrou | La marque **ou** le créateur, pour lui-même |
| Ce qu'en sait l'autre partie | **Rien, jamais** (`03` C(18)) | Un message neutre, **jamais le motif, jamais qui a refusé** (`13` RG88) |

**`matching.decline_reasons` — la liste B.** Table de référence de la même forme que les autres
listes de motifs (§3.1), **une table par file** et non une colonne `scope` :

| Colonne | Type | Contrainte |
|---|---|---|
| `code` | `text` | **PK** — `not_available` · `not_relevant` · `terms_not_suitable` · **`pre_existing_relationship`** · `no_longer_interested` · `other` (`13` RG87) |
| `label_key` | `text` | `not null` (R8) — aucun libellé français ou anglais en base |
| `available_to_side` | `text` | `not null check (available_to_side in ('advertiser','creator','any'))` — `any` pour les six motifs du MVP |
| `triggers_internal_task` | `boolean` | `not null default false` — **vrai pour `pre_existing_relationship` seulement** |
| `requires_comment` | `boolean` | `not null default false` — **faux partout** : `13` RG89, refuser ne se justifie pas |
| `sort_order` | `smallint` | `not null` — l'ordre de l'écran de refus est une donnée, pas un `order by code` |
| `is_active` | `boolean` | `not null default true` |
| `introduced_at`, `retired_at` | `timestamptz` | Un code utilisé ne s'écrase jamais, il se retire (§3.1) |

```sql
create type matching.party_side as enum ('advertiser', 'creator');

comment on table matching.decline_reasons is
  'LISTE B : motifs de refus d''une mise en relation PAR UNE PARTIE sollicitee (13 RG87).
   DISTINCTE de matching.rejection_reasons (liste A), qui porte les refus decides par INFLUX.
   Les confondre produirait le pire des malentendus : un createur qui croit avoir ete rejete par
   une marque qui n''a jamais rien vu de lui (13 RG82).';

comment on column matching.introductions.decline_reason_code is
  'Motif de refus choisi par la partie sollicitee (liste B).
   *** JAMAIS COMMUNIQUE A L''AUTRE PARTIE, SOUS AUCUNE FORME, Y COMPRIS AGREGEE (13 RG88). ***
   L''autre partie recoit exactement ceci, et rien d''autre :
   « INFLUX n''a pas pu ouvrir cette mise en relation. »
   Elle n''apprend NI le motif, NI qui a refuse, NI que l''autre avait accepte.
   Aucune route de apps/api servant un role membre ne selectionne cette colonne, ni declining_side,
   ni decline_comment, ni declined_by_account_id, ni declined_at : ces cinq colonnes sont lues par
   les seuls roles internes. Un GRANT de colonne ne suffit pas a lui seul a le garantir — c''est
   un point de revue du document 03 et un test du document 18.';

comment on column matching.introductions.declining_side is
  'Cote qui a refuse (13 RG82). DEDUIT du compte appelant par la fonction d''enregistrement du
   refus, JAMAIS recu en parametre : un cote recu du client est un cote falsifiable.
   Meme regime de confidentialite que decline_reason_code ci-dessus.';

comment on column matching.decline_reasons.triggers_internal_task is
  'pre_existing_relationship declenche une tache commerciale (appeler) ET consigne une relation
   preexistante au sens de la clause de sauvegarde des CGU (13 RG87, 01 §8.1).
   Reconstituer cette information deux ans plus tard est impossible : c''est la raison d''etre
   de ce motif, et la seule valeur vraie de cette colonne au MVP.';
```

**Et un code de plus dans la liste A** : `declined_by_party`, `is_correctable = false`,
`requires_comment = false`. Il n'est **pas** proposé à un agent dans l'écran de refus : c'est la
fonction d'enregistrement du refus B (`matching.record_introduction_decline`, ci-dessus) qui le pose,
et c'est lui seul qui autorise les cinq colonnes de refus de partie à être non nulles. Deux listes de
motifs, un seul statut `rejected`, et une requête de pilotage qui ne ment pas :

```sql
-- repartition des refus, liste A et liste B SEPAREMENT (13, Indicateurs)
select coalesce(d.code, r.code) as reason_code,
       (i.declining_side is not null) as by_party,
       count(*)
  from matching.introductions i
  left join matching.rejection_reasons r on r.code = i.rejection_reason_code
  left join matching.decline_reasons   d on d.code = i.decline_reason_code
 where i.status = 'rejected'
 group by 1, 2;
```

**Le contrôle « autre » sous 10 %** (`13` RG86) se lit sur la même requête, par liste : c'est le
signal que la liste est incomplète, et il ne veut rien dire si les deux listes sont mélangées.

#### `proposal_batch_id` — le lot d'une proposition INFLUX, sans table de lot (`13` écart 3)

`13` RG54 : le commercial sélectionne jusqu'à 20 créateurs et envoie **en une seule action** ; RG55
affiche « N mises en relation distinctes seront créées ». Chacune est bien une mise en relation
autonome — c'est le principe, et il ne bouge pas. Mais **le geste commercial, lui, est unique**, et
c'est lui que le tableau de bord doit mesurer : combien de propositions parties, quel taux
d'acceptation par envoi, quel commercial, quel motif commun.

```sql
alter table matching.introductions
  add column proposal_batch_id uuid,
  add constraint introductions_batch_requires_proposal
      check (proposal_batch_id is null or origin = 'influx_proposal');

create index introductions_proposal_batch_idx
  on matching.introductions (proposal_batch_id)
  where proposal_batch_id is not null;

comment on column matching.introductions.proposal_batch_id is
  'Identifiant commun aux mises en relation creees par UN SEUL envoi groupe (13 RG54).
   Genere par apps/api au clic 3, jamais par la base : il doit etre connu AVANT la premiere
   insertion pour que les N lignes le partagent dans la meme transaction.
   AUCUNE TABLE DE LOT : un lot n''a ni cycle de vie, ni etat, ni droit propre — il n''a que des
   membres. Une table matching.proposal_batches n''aurait porte que created_by et created_at,
   deja presents sur chaque ligne et deja dans le registre (introduction.batch_created).
   Le jour ou un lot aura un etat (modele reutilisable, envoi differe), la table se creera et
   cette colonne deviendra sa cle etrangere, sans reprise de donnees.';
```

**Ce que cela rend possible en une requête** : « mes propositions de la semaine, par lot, avec leur
taux d'acceptation ». Sans cette colonne, la question est **inaccessible** — vingt lignes créées à la
même seconde par le même agent ne sont pas un lot, ce sont vingt coïncidences, et un envoi partiel
(`13` RG58, « ce qui n'est pas parti et pourquoi ») devient impossible à reconstituer.

```sql
select i.proposal_batch_id,
       min(i.created_at)                                              as sent_at,
       count(*)                                                       as proposed,
       count(*) filter (where i.identity_revealed_at is not null)     as opened,
       count(*) filter (where i.declining_side is not null)           as declined_by_party
  from matching.introductions i
 where i.owner_agent_id = $1
   and i.proposal_batch_id is not null
 group by i.proposal_batch_id
 order by sent_at desc;
```

#### `matching.introduction_transitions` — `approved` n'est terminal qu'une fois révélée (`13` écart 6)

`13` RG102 et RG103 tranchent un écart avec la skill `intermediation-tracking`, et le modèle suit :
**une mise en relation validée mais non révélée reste réversible** vers refusée par une partie,
retirée, ou clôturée sans suite. C'est même le **cas nominal** de la proposition INFLUX — on valide
d'abord, on demande ensuite. Sans cette réversibilité, un refus de partie après validation n'a
**nulle part où aller**.

La règle tient en deux temps, et le second est la vraie garantie :

| Condition | Ce qui est permis |
|---|---|
| `identity_revealed_at is null` | Les transitions de la table ci-dessous, **y compris depuis `approved`** |
| `identity_revealed_at is not null` | **Aucun changement de statut, jamais, par personne.** L'état 4 est terminal (`13` RG102) |

| Colonne | Type | Contrainte |
|---|---|---|
| `from_status` | `matching.introduction_status` | **PK avec les deux suivantes** |
| `to_status` | `matching.introduction_status` | **PK**, `check (to_status <> from_status)` |
| `allowed_actor` | `text` | **PK**, `check (allowed_actor in ('agent','party','initiator','system'))` |
| `requires_reason` | `boolean` | `not null default false` — motif typé obligatoire sur cette transition |
| `is_active` | `boolean` | `not null default true` |

```sql
comment on table matching.introduction_transitions is
  'Transitions autorisees d''une mise en relation (13 RG102). DONNEE, pas code : ouvrir une
   transition est une ligne relue en migration, jamais un deploiement applicatif.
   Meme forme et meme intention que billing.deal_state_transitions (§5.9).
   allowed_actor documente QUI peut faire la transition ; l''autorisation reelle est portee par
   les fonctions du §5.6 et par les politiques du document 03. La base garantit la FORME du
   graphe d''etats, pas le droit d''agir — ne jamais confondre les deux.';
```

Données chargées par la migration `0401`, transcription exacte de `13` RG102 :

| `from_status` | `to_status` | `allowed_actor` | `requires_reason` |
|---|---|---|---|
| `pending_review` | `in_review` | `agent` | non |
| `pending_review`, `in_review` | `withdrawn` | `initiator` | non |
| `pending_review`, `in_review` | `expired` | `system` | **oui** (`expiry_reason`) |
| `in_review` | `approved` | `agent` | non |
| `in_review` | `rejected` | `agent` | **oui** (liste A) |
| **`approved`** | **`rejected`** | **`party`** | **oui** (liste B **et** `declining_side`) |
| **`approved`** | **`withdrawn`** | `initiator`, `agent` | non |
| **`approved`** | **`expired`** | `system` | **oui** (`expiry_reason`) |

Et le déclencheur, qui fait tenir les deux temps ensemble :

```sql
create or replace function matching.assert_status_transition()
returns trigger language plpgsql as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  -- 1. une mise en relation REVELEE ne change plus jamais d'etat (13 RG102, etat 4 terminal)
  if old.identity_revealed_at is not null then
    raise exception 'introduction % is revealed: status is frozen at %', old.reference, old.status
      using errcode = '55006';
  end if;

  -- 2. la transition doit exister dans la table de donnees
  if not exists (select 1
                   from matching.introduction_transitions t
                  where t.from_status = old.status
                    and t.to_status   = new.status
                    and t.is_active) then
    raise exception 'forbidden transition % -> % (introduction %)',
      old.status, new.status, old.reference using errcode = '55006';
  end if;

  -- 3. un refus de partie exige son cote, son horodatage et son auteur
  if new.status = 'rejected' and new.rejection_reason_code = 'declined_by_party'
     and (new.declining_side is null
          or new.declined_at is null
          or new.declined_by_account_id is null) then
    raise exception 'a party decline needs a side, a timestamp and an author (introduction %)',
      old.reference using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger introductions_status_transition
  before update of status on matching.introductions
  for each row execute function matching.assert_status_transition();
```

**Ce que la contrainte existante devient : rien, et c'est le bon résultat.**
`introductions_reveal_requires_approval` (`identity_revealed_at is null or status = 'approved'`)
**reste inchangée et reste juste** — elle disait déjà « on ne révèle qu'une validée », et le point 1
du déclencheur y ajoute « et une fois révélée, on ne quitte plus `approved` ». Les deux ensemble
donnent exactement les états 3 et 4 de `13` RG100, **sans colonne d'état supplémentaire** : l'état
« révélée » **est** `status = 'approved' and identity_revealed_at is not null`, et il se lit en une
expression. Ajouter une sixième valeur `revealed` à l'énumération aurait dédoublé la vérité et
permis, un jour, qu'une ligne soit `approved` avec une date de révélation.

> **Écart réglé, et il faut le dire dans ce sens-là.** La skill `intermediation-tracking` décrit
> `approved` comme terminal dès la validation. Ce document suit `13` RG103 : **c'est la skill qui est
> à aligner**, pas le modèle. Le signalement appartient à `chef-de-projet` (`13` Q2).

#### L'affaire naît à la révélation — arbitrage rendu le 2026-09-19 (`13` écart 7)

> **Tranché par `chef-de-projet` le 2026-09-19.** `billing.deals` est créée **automatiquement, à
> l'état `open`, dans la transaction de révélation**, une affaire par mise en relation. C'est ce que
> posent `03` C(21) étape 4, `13` RG74 point 4 et le document pivot `01` §6. **J'avais proposé
> l'option inverse (création différée par le commercial) : elle est écartée, et j'écris ici pourquoi
> l'arbitrage est le bon, parce que la raison compte plus que la décision.**

**La raison décisive n'est pas l'alerte A6, c'est le motif de perte.** Une mise en relation qui
n'aboutit pas doit pouvoir porter un **motif de perte typé** (`billing.lost_reasons`), et ce motif
n'a **nulle part où se ranger** s'il n'existe pas d'affaire : `matching.introductions` s'arrête à la
révélation, et son `rejection_reason_code` décrit un refus **avant** ouverture, pas une négociation
qui échoue **après**. Sans affaire créée d'office, toute mise en relation ouverte puis perdue
disparaît de la mesure — et c'est exactement la donnée de transformation qu'attend **A8**. Un objet
créé seulement quand quelqu'un pense à le créer ne mesure que la discipline de saisie.

**Ce que devient mon objection de fond — la seule qui tenait.** Le cycle de dépendance entre
migrations était réel : `billing.deals` au Lot 5, la révélation au Lot 4, donc `0402` dépendant de
`0501`. **Il se règle en avançant les tables `billing` de l'affaire au Lot 4** (§2.2, §11.2) :
`lost_reasons`, `cancellation_reasons`, `non_monetary_reasons`, `deal_state_transitions`, `deals`
et `deal_field_changes` sont créées par la migration **`0402a`, juste avant `0402`** ; seul
`billing.commission_receipts` reste au Lot 5, avec la première saisie de règlement (`14` E1). Seule la **saisie** des montants — écrans, validations,
pipeline — reste au Lot 5. Créer une table n'est pas construire un écran.

**Trois conséquences, à lire ensemble :**

1. **L'affaire à l'état `open` est vide, et c'est licite.** Les contraintes de `billing.deals`
   (§5.9) sont **par état** : `deals_negotiating_requires_amount`,
   `deals_signed_requires_commission`, `deals_lost_requires_reason` ne s'appliquent qu'aux états
   correspondants. À l'état `open`, seules `introduction_id`, `owner_agent_id`, `revealed_at` et
   `state` sont renseignées — toutes **copiées de la mise en relation** dans la même transaction, et
   aucune ne demande de décision humaine. Aucune contrainte n'est relâchée pour l'occasion.
2. **L'alerte A6 change de requête, et elle y gagne.** Elle ne cherche plus une **ligne absente**
   mais une **affaire immobile** — ce qui est la vraie question posée (`01` §11 : contournement ou
   saisie négligée ?) :

   ```sql
   -- A6 : revelee depuis 30 jours, affaire jamais sortie de l'etat initial
   select d.id, i.reference, d.revealed_at, d.owner_agent_id
     from billing.deals d
     join matching.introductions i on i.id = d.introduction_id
    where d.state = 'open'
      and d.revealed_at < now() - interval '30 days';
   ```

   Servie par un index partiel (§10.7), là où la jointure externe balayait `introductions`.
3. **Le contrôle « pas d'affaire orpheline » devient un contrôle dans les deux sens.**
   `deals.introduction_id not null unique` interdisait déjà une affaire sans mise en relation ; la
   création d'office ajoute la réciproque — **une mise en relation révélée sans affaire est
   désormais une anomalie**, détectable par une requête de contrôle nocturne et non plus un état
   normal du produit :

   ```sql
   -- controle nocturne : doit toujours renvoyer zero ligne
   select i.reference
     from matching.introductions i
     left join billing.deals d on d.introduction_id = i.id
    where i.identity_revealed_at is not null
      and d.id is null;
   ```

**L'invariant, lui, n'a jamais bougé :**
`deals.introduction_id not null unique references matching.introductions(id)` — **pas d'affaire
orpheline, au plus une affaire par mise en relation**. Seul le *moment* de la création était en
discussion ; il est tranché.

#### `matching.introduction_emails` — la preuve qui sort du système (`13` écart 8)

`13` RG78 et RG79 : l'e-mail de confirmation de mise en relation est **la preuve la plus forte et la
moins chère** du dispositif, précisément parce qu'il **sort** du système d'INFLUX — copie chez le
prestataire d'envoi, chez les deux fournisseurs de messagerie, souvent chez les parties elles-mêmes,
et **aucune de ces copies n'est sous notre contrôle**. Encore faut-il pouvoir les retrouver : sans le
`messageId` renvoyé par le prestataire, **le lien entre notre registre interne et la preuve détenue
par un tiers est rompu**. Le modèle n'avait aucun endroit où le poser.

*Table du Lot 4, **append-only** pour tout ce qui décrit l'envoi ; seules les colonnes d'accusé de
réception sont écrites après coup, par le worker.*

| Colonne | Type | Contrainte |
|---|---|---|
| `id` | `uuid` | PK |
| `introduction_id` | `uuid` | `not null references matching.introductions(id)` |
| `recipient_account_id` | `uuid` | `not null` FK — **le destinataire réel**, jamais une adresse recopiée |
| `recipient_side` | `text` | `not null check (recipient_side in ('advertiser','creator','agent'))` |
| `email_kind` | `matching.introduction_email_kind` | `not null` — `invitation` · `reminder` · `reveal_confirmation` · `decline_neutral` · `expiry_neutral` · `rejection_motivated` · `agent_instruction` (`13` RG111) |
| `reminder_stage` | `smallint` | `check ((email_kind = 'reminder') = (reminder_stage is not null))` — 3 ou 6 (`13` RG92) |
| `locale` | `char(2)` | `not null` FK `reference.languages` — **la langue dans laquelle la preuve a été envoyée** (`13` RG119) |
| `outbox_event_id` | `uuid` | FK `leads.outbox_events(id)` — le lien avec la file, ses rejeux et son rejeu manuel |
| **`provider_message_id`** | `text` | `unique` — **le `messageId` de RG79**. Nul tant que le prestataire n'a pas accepté l'envoi |
| `provider` | `text` | `not null default 'brevo'` |
| `status` | `matching.email_status` | `not null default 'queued'` — `queued` · `sent` · `delivered` · `failed` |
| `sent_at`, `delivered_at`, `failed_at` | `timestamptz` | Chronologie contrôlée ci-dessous |
| `failure_code` | `text` | `check ((status = 'failed') = (failure_code is not null))` |
| `created_at` | `timestamptz` | `not null` |

```sql
alter table matching.introduction_emails
  -- un envoi accepte par le prestataire a forcement un identifiant chez lui
  add constraint introduction_emails_sent_needs_message_id
      check (status in ('queued','failed') or provider_message_id is not null),
  add constraint introduction_emails_chronology
      check (coalesce(delivered_at, 'infinity') >= coalesce(sent_at, '-infinity')),
  add constraint introduction_emails_failed_has_date
      check ((status = 'failed') = (failed_at is not null));

-- une seule confirmation de revelation par destinataire et par mise en relation
create unique index introduction_emails_reveal_idx
  on matching.introduction_emails (introduction_id, recipient_account_id)
  where email_kind = 'reveal_confirmation';

-- alerte A8 : les envois definitivement en echec, c'est-a-dire les mises en relation sans preuve externe
create index introduction_emails_failed_idx
  on matching.introduction_emails (introduction_id)
  where status = 'failed';

comment on table matching.introduction_emails is
  'Journal des e-mails transactionnels d''une mise en relation, et SEUL emplacement du messageId
   renvoye par le prestataire d''envoi (13 RG79). Sert a retrouver, chez un tiers, la copie d''un
   e-mail que nous ne controlons pas : c''est precisement ce qui lui donne sa valeur de
   corroboration (01 M2, skill intermediation-tracking).
   NE CONTIENT NI OBJET, NI CORPS, NI ADRESSE : le destinataire est un identifiant de compte,
   l''adresse se lit sur identity.accounts sous RLS, et le texte vit dans les fichiers de
   traduction (R8).
   VOCABULAIRE : cette table est un JOURNAL D''ENVOI. Les termes « preuve legale »,
   « horodatage certifie » et « valeur probante » restent interdits dans le produit comme dans
   les ecrans qui l''affichent (01 M4, 12 RG105).';

comment on column matching.introduction_emails.provider_message_id is
  'Identifiant attribue par le prestataire (Brevo). UNIQUE : un webhook rejoue qui porte le meme
   identifiant echoue au lieu de creer une seconde ligne — c''est l''idempotence, obtenue par une
   contrainte et non par du code. Un rejeu qui produit un NOUVEL identifiant cree, lui, une
   nouvelle ligne : deux envois ont reellement eu lieu, et le journal doit le dire.';
```

**Pourquoi une table plutôt qu'une colonne sur `introductions`, ou une ligne de registre.** Une
colonne ne tiendrait pas : il y a **au moins quatre e-mails** par mise en relation — deux
invitations, deux confirmations — plus les deux relances et la consigne au commercial. Le registre,
lui, est **immuable par construction**, or l'accusé de réception du prestataire arrive **après**
l'envoi, par webhook, et l'état d'un envoi **change** (`queued` → `sent` → `delivered` ou `failed`).
Une ligne de registre qu'il faudrait mettre à jour n'est pas une ligne de registre. Le partage est
donc net : le registre reçoit les **faits** (`introduction.email_delivered`,
`introduction.email_failed`), cette table porte **l'état courant et la référence externe**.

#### `matching.interest_submissions` — la correction de la collision d'index unique partiel

*Ce que **chaque partie** a écrit pour demander la mise en relation : une candidature, une demande
de contact, ou les deux sur la même mise en relation.*

**Le défaut signalé par `11` (écart 6) est réel, et il bloque un cas normal.** L'ancienne table
`matching.application_details` était une extension **1-1** de `introductions`, réservée à
`origin = 'creator_application'`. Or l'index unique partiel `introductions_active_pair_idx`
interdit — à raison — une seconde mise en relation active sur le même triplet (marque, créateur,
campagne). Conséquence : **quand une demande de contact de la même marque sur la même campagne
existe déjà, la candidature du créateur n'a nulle part où se ranger.** Et le comportement attendu
est écrit noir sur blanc dans `11` (cas limite) : « la candidature **ne crée pas de seconde mise en
relation** : son contenu est rattaché à l'entrée existante comme élément d'instruction pour le
commercial ».

**Correction : la charge utile cesse d'être une extension 1-1 de la mise en relation et devient une
table fille, une ligne par partie qui s'est exprimée.**

| Colonne | Type | Contrainte |
|---|---|---|
| `id` | `uuid` | PK |
| `introduction_id` | `uuid` | `not null references matching.introductions(id)` |
| `submitted_by_account_id` | `uuid` | `not null` FK — **l'auteur réel** |
| `submitted_by_role` | `identity.account_role` | `not null check (submitted_by_role in ('advertiser','creator'))` |
| `kind` | `matching.submission_kind` | `not null` — `brand_contact_request` · `creator_application` |
| `pitch` | `text` | `check (length(btrim(pitch)) between 120 and 2000)` — la motivation (`11` RG47) |
| `concept` | `text` | `check (length(concept) <= 1000)` |
| `proposed_amount_minor` | `bigint` | `check (proposed_amount_minor is null or proposed_amount_minor > 0)` |
| `currency` | `char(3)` | FK, `check ((proposed_amount_minor is null) = (currency is null))` — **un tarif sans devise n'existe pas** (`11` RG54) |
| `accepts_gift` | `boolean` | Case **non pré-cochée** de `11` RG47 |
| `available_on_period` | `boolean` | Idem |
| `terms_version_id` | `uuid` | FK — l'acceptation à l'écran, rattachée à sa version |
| `created_at` | `timestamptz` | `not null` — **append-only, aucune modification, aucune suppression** |

```sql
-- une partie s'exprime au plus une fois par mise en relation
alter table matching.interest_submissions
  add constraint interest_submissions_one_per_kind unique (introduction_id, kind);

comment on table matching.interest_submissions is
  'Charge utile des expressions d''interet rattachees a une mise en relation (ex-application_details).
   Une ligne par partie : la candidature d''un createur ET la demande de contact d''une marque
   peuvent coexister sur la MEME introduction (11, cas limite « demande deja en file »).
   introductions.origin reste la PREMIERE origine et demeure immuable (11 RG82) :
   une candidature ne devient jamais une demande de contact.
   La presence des deux lignes est le signal le plus fort du produit — les deux parties se sont
   cherchees — et elle est lisible en une jointure par le commercial.';
```

`matching.interest_submission_formats` (`submission_id`, `network_code`, `format_code`) remplace
`matching.application_formats` : les formats proposés appartiennent à la soumission, pas à la mise
en relation.

**Ce qui ne change pas, et qui était bon :** l'index unique partiel reste tel quel — il n'y a
toujours **qu'une mise en relation active par triplet**, et c'est ce qui empêche les doublons de
file. Ce qui change, c'est qu'on ne confond plus **l'objet** (la mise en relation) avec **les gestes
qui l'ont provoquée**.

**Ce que le créateur voit reste inchangé :** son état de candidature est « envoyée ». Il n'apprend
**jamais** qu'une demande de contact le concernait (`03` C(18)) — la table est lue par les agents,
et la politique du rôle créateur ne renvoie que **ses propres** soumissions.

#### `matching.application_drafts` — le brouillon, qui n'est pas une candidature

`11` RG52 : la candidature est enregistrée en brouillon pendant la rédaction, « un créateur
interrompu ne recommence jamais ». Le modèle n'avait aucun endroit pour ça (`11` écart 5).

| Colonne | Type | Contrainte |
|---|---|---|
| `creator_account_id` | `uuid` | **PK avec `campaign_id`**, FK |
| `campaign_id` | `uuid` | `not null` FK |
| `pitch`, `concept` | `text` | **Sans borne basse** : un brouillon incomplet est normal, c'est tout son intérêt |
| `proposed_amount_minor`, `currency` | — | Mêmes contraintes de couple que ci-dessus |
| `accepts_gift`, `available_on_period` | `boolean` | — |
| `updated_at` | `timestamptz` | `not null` |
| `expires_at` | `timestamptz` | `not null` — purge automatique |

`matching.application_draft_formats` porte les formats pré-sélectionnés.

**Trois propriétés que la base garantit, et qui sont des règles produit** (`11` RG52) :

1. **Un brouillon n'est pas une entrée en file** : il vit dans une table distincte de
   `introductions`. Il ne peut donc pas être pris en charge, ni validé, ni compté.
2. **Il ne compte dans aucun plafond** : les compteurs ci-dessous lisent `introductions`, jamais
   cette table.
3. **Il n'appartient qu'à son auteur** : `GRANT` au seul rôle `influx_creator`, politique
   `creator_account_id = (select influx.current_account_id())`, **aucun droit pour un agent**. Un
   brouillon n'est pas une intention opposable ; le lire serait lire par-dessus l'épaule.

**Choix de conservation, le plus conservateur** (`11` Q12 ouverte) : le brouillon est supprimé
physiquement à la fermeture de la campagne ou à `expires_at` (30 jours d'inactivité, valeur de
départ **en table**). C'est la seule table du modèle où la suppression physique est admise, parce
qu'elle ne touche **ni une mise en relation, ni une affaire, ni un journal** (R6) : rien ne s'est
passé. À confirmer par `product-owner` (§12.6).

#### `matching.application_quotas` — le compteur en face du plafond

`11` écart 2 : `max_applications` existait sans rien pour le contraindre. Deux plafonds, donc deux
compteurs, et **aucun des deux ne peut être un `count(*)` fait au moment du clic** — entre le compte
et l'insertion, deux candidatures simultanées passent toutes les deux.

| Où | Colonne / table | Plafond contraint |
|---|---|---|
| **Par campagne** | `campaigns.campaigns.active_applications_count integer not null default 0` | **P3** : `max_applications` (30 par défaut). À l'atteinte, la campagne passe en « candidatures closes » (`11` RG65) |
| **Par créateur** | `matching.application_quotas (creator_account_id PK, active_applications_count, applications_today_count, counted_on date, max_active_applications smallint, updated_at)` | **P1** (10 candidatures actives) et **P2** (5 nouvelles par jour glissant) |

```sql
-- la contrainte EST le plafond : l'insertion echoue, elle ne « depasse » jamais
alter table campaigns.campaigns
  add constraint campaigns_applications_within_cap
      check (max_applications is null or active_applications_count <= max_applications);

alter table matching.application_quotas
  add constraint application_quotas_within_cap
      check (max_active_applications is null
             or active_applications_count <= max_active_applications);
```

Les deux compteurs sont maintenus par **un déclencheur sur `matching.introductions`** (insertion,
changement de statut), jamais par le code applicatif : un compteur tenu à la main diverge en trois
semaines. La **fermeture atomique** exigée par `11` est alors gratuite — le déclencheur incrémente,
la contrainte refuse, la transaction échoue, et `apps/api` répond « candidatures closes » sans avoir
jamais eu à lire le compteur avant d'écrire.

`max_active_applications` nullable = **le plafond global** de
`backoffice.operational_settings ('application_caps')` s'applique ; non nul = dérogation nominative
accordée par un administrateur, journalisée (`11` RG69).

**Deux dénormalisations de plus, assumées et justifiées** (§10.8) : sans elles, le plafond n'est pas
tenable sous concurrence. C'est exactement le critère de R10 — une mesure, pas une intuition.

#### `matching.party_blocks` — le blocage entre une marque et un créateur (Lot 3)

> **C'est le manque le plus important de toute la relecture** (`10` écart 1). Le blocage est une
> **exclusion de premier rang** de la recherche (`10` RG28) et il n'avait **aucun support en base** :
> ni table, ni colonne, ni référentiel de motifs.

*Bien que le reste du schéma `matching` arrive au Lot 4, ces deux tables arrivent au **Lot 3** : la
recherche de créateurs en dépend dès son ouverture. Le schéma, lui, existe depuis la migration
`0001`.*

| Colonne | Type | Contrainte |
|---|---|---|
| `id` | `uuid` | PK |
| `advertiser_account_id` | `uuid` | `not null` FK |
| `creator_account_id` | `uuid` | `not null` FK, `check (<> advertiser_account_id)` |
| `blocked_by_account_id` | `uuid` | `not null` FK — **qui a posé le blocage** : l'une des deux parties, ou un rôle interne |
| `blocked_by_side` | `text` | `not null check (blocked_by_side in ('advertiser','creator','influx'))` |
| `reason_code` | `text` | `not null references matching.block_reasons(code)` — **motif typé, jamais muet** |
| `comment` | `text` | `check (length(comment) <= 1000)`, obligatoire si `block_reasons.requires_comment` |
| `created_at` | `timestamptz` | `not null` |
| `lifted_at` | `timestamptz` | — |
| `lifted_by_account_id`, `lift_reason_code` | — | `check ((lifted_at is null) = (lifted_by_account_id is null))` |

```sql
-- un seul blocage actif par couple, quel que soit celui qui l'a pose
create unique index party_blocks_active_idx
  on matching.party_blocks (advertiser_account_id, creator_account_id)
  where lifted_at is null;

comment on table matching.party_blocks is
  'Blocage declare entre une marque et un createur (10 RG28). EFFET SYMETRIQUE A LA LECTURE :
   si l''un bloque l''autre, AUCUN DES DEUX n''apparait dans les resultats de l''autre, quel que
   soit le sens du blocage. L''exclusion est SILENCIEUSE (10 RG29) : le profil est absent, il
   n''entre pas dans le nombre de resultats, aucun message, aucun emplacement grise.
   Le motif n''est JAMAIS expose a la partie bloquee ni journalise a son niveau (10 RG30).
   Pose et retire depuis l''espace membre ou par un role interne, toujours journalise
   (audit : block.created / block.lifted).';
```

`matching.block_reasons` : `code` **PK**, `label_key`, `available_to_side`
(`advertiser` · `creator` · `influx` · `any`), `requires_comment`, `is_active`. Une liste **par
partie** : les motifs qu'une marque invoque ne sont pas ceux qu'un créateur invoque.

**Le blocage n'est pas une suppression** : les mises en relation ouvertes et les conversations en
cours ne sont **pas** détruites — le blocage porte sur la découverte et sur toute **nouvelle**
mise en relation. Ce que la base garantit en plus : la fonction `matching.open_introduction()`
refuse d'ouvrir une mise en relation sur un couple bloqué, et le refus est journalisé côté interne
seulement.

**Ce qui rend cette table sensible :** elle est lue à **chaque** recherche, pour **chaque** ligne de
résultat, et une erreur de sens (bloquant / bloqué inversés) est indétectable à l'œil — d'où le
choix de deux colonnes nommées par rôle (`advertiser_account_id`, `creator_account_id`) plutôt que
`blocker_id` / `blocked_id`, et d'un **effet symétrique** qui rend l'inversion sans conséquence.

#### `matching.rejection_reasons` — un motif corrigible n'a pas le même effet qu'un motif définitif

`11` RG67 et RG92 : après un refus, **une seconde et dernière candidature** est possible sur la même
campagne **si et seulement si** le motif est marqué corrigible. L'attribut manquait (`11` écart 3).

| Colonne | Type | Contrainte |
|---|---|---|
| `code` | `text` | **PK** |
| `label_key`, `message_key` | `text` | `not null` (R8) |
| **`is_correctable`** | `boolean` | `not null` — **sans valeur par défaut** |
| `requires_comment` | `boolean` | `not null default false` |
| `is_active` | `boolean` | `not null default true` |

```sql
comment on column matching.rejection_reasons.is_correctable is
  'Vrai : le createur peut corriger et recandidater UNE SEULE FOIS sur la meme campagne,
   tant qu''elle est ouverte (11 RG67, plafond P4). Faux : toute nouvelle candidature est
   refusee, avec un message qui nomme le motif precedent et propose d''autres campagnes.
   PAS DE VALEUR PAR DEFAUT : celui qui ajoute un motif doit trancher. Un defaut a vrai
   rouvrirait la porte a chaque nouveau motif ; un defaut a faux fermerait un parcours
   sans que personne l''ait decide.';
```

La règle « une seule seconde chance » se lit sans table supplémentaire : elle compte les
`interest_submissions` de type `creator_application` déjà rattachées au couple (créateur, campagne),
y compris sur une mise en relation refusée.

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
`archived_at`, `created_at`, `updated_at`, **plus les colonnes de pause, de clôture et de
réouverture décrites deux paragraphes plus bas** (`12` manque 3). *La colonne `last_message_at` a été
**supprimée le 2026-09-24** : une date d'activité unique trahissait l'existence d'un aparté. Elle est
remplacée par `messaging.conversation_channel_activity` (§5.7.1, point 3).*

> **Écart assumé avec `intermediation-tracking`.** La skill liste `conversation_id` parmi les champs
> de `introductions`. Je ne le crée pas : la relation 1-1 est portée par
> `conversations.introduction_id unique`, ce qui **garantit** l'unicité et supprime une référence
> circulaire entre deux tables. L'information est strictement la même, la contrainte est plus forte.
> « Une conversation orpheline est un défaut bloquant » devient ici **impossible**, pas seulement
> interdit.

La dernière activité d'une conversation est une **dénormalisation** (§10.8), justifiée par la requête
de liste de conversations, triée par activité, sur les trois espaces. Depuis les apartés, elle est
tenue **par canal** dans `messaging.conversation_channel_activity`, sous les mêmes politiques que les
messages (§5.7.1).

##### Pause, clôture et réouverture : un motif, un auteur, et aucune impasse (`12` manque 3)

> **Deux défauts signalés par `12`, et ils se tiennent.** Le champ de pause n'avait **ni motif ni
> auteur** — alors que `12` RG17 en fait une décision humaine à motif typé obligatoire. Et la
> contrainte de clôture, écrite comme un état terminal, **rendait la réouverture impossible à écrire
> proprement** : `12` RG22 autorise explicitement un agent à rouvrir un fil clos, avec motif et
> message système. Corrigé des deux côtés.

| Colonne | Type | Contrainte | Pourquoi |
|---|---|---|---|
| `paused_at` | `timestamptz` | `check ((state = 'paused') = (paused_at is not null))` | **La pause est un état daté**, pas un booléen |
| `pause_reason_code` | `text` | `references messaging.pause_reasons(code)`, `check ((paused_at is null) = (pause_reason_code is null))` | **Motif typé obligatoire** (`12` RG17, CA10) |
| `paused_by_account_id` | `uuid` | FK interne, `check ((paused_at is null) = (paused_by_account_id is null))` | **Une décision humaine a un auteur.** La pause n'est jamais automatique |
| `pause_comment` | `text` | `check (length(pause_comment) <= 1000)`, obligatoire si `pause_reasons.requires_comment` | Complément interne, jamais montré aux parties (`12` RG32) |
| `closed_at` | `timestamptz` | `check ((state = 'closed') = (closed_at is not null))` | **Décrit la clôture *en cours*, pas l'historique** |
| `closure_reason_code` | `text` | FK `messaging.closure_reasons`, `check ((closed_at is null) = (closure_reason_code is null))` | Motif typé obligatoire (`12` RG20) |
| `closed_by_account_id` | `uuid` | FK interne, même couple | — |
| `closure_comment` | `text` | Obligatoire sur le motif `autre` (`12` RG20) | — |
| `reopened_at`, `reopened_by_account_id` | `timestamptz`, `uuid` | Couple lié | **La dernière** réouverture |
| `reopen_count` | `smallint` | `not null default 0` | Compteur, pour l'alerte du backoffice : un fil rouvert trois fois est un signal |
| `archived_at` | `timestamptz` | `check ((state = 'archived') = (archived_at is not null))` | Automatique à 90 jours après clôture, ou manuel (`12` RG23) |

**Le point qui règle la réouverture : les colonnes de clôture décrivent la clôture *en cours*, et
elles sont remises à `null` quand le fil est rouvert.** L'historique, lui, ne vit pas dans ces
colonnes — il vit **dans le registre**, exactement comme `12` RG22 le demande (« l'historique des
clôtures et réouvertures successives vit dans le registre, pas dans une colonne écrasée ») :
`conversation.closed` et `conversation.reopened`, chacun avec son auteur, sa date et son motif.

```sql
alter table messaging.conversations
  -- une cloture en cours a TOUJOURS son motif, son auteur et sa date : les quatre ensemble
  add constraint conversations_closure_is_complete
      check (num_nonnulls(closed_at, closure_reason_code, closed_by_account_id) in (0, 3)),
  add constraint conversations_closed_state_matches
      check ((state = 'closed') = (closed_at is not null)),
  -- une pause en cours : idem
  add constraint conversations_pause_is_complete
      check (num_nonnulls(paused_at, pause_reason_code, paused_by_account_id) in (0, 3)),
  add constraint conversations_paused_state_matches
      check ((state = 'paused') = (paused_at is not null)),
  -- on ne rouvre que ce qui a ete clos : un compteur non nul suppose une reouverture datee
  add constraint conversations_reopen_is_complete
      check ((reopen_count = 0) = (reopened_at is null)
             and (reopened_at is null) = (reopened_by_account_id is null)),
  -- un fil archive est un fil qui a ete clos
  add constraint conversations_archive_follows_closure
      check (archived_at is null or archived_at >= opened_at);

comment on column messaging.conversations.closure_reason_code is
  'Motif de la cloture EN COURS (12 RG20). REMIS A NULL A LA REOUVERTURE (12 RG22) :
   cette colonne decrit l''etat actuel, jamais l''histoire.
   L''histoire des clotures et des reouvertures successives est dans audit.audit_events
   (conversation.closed / conversation.reopened), qui est append-only et chaine.
   AFFICHAGE : en clair aux agents, sous un libelle NEUTRE aux parties (12 RG32).
   Un motif interne comme signalement_fonde n''est jamais montre a une partie.';

comment on column messaging.conversations.reopen_count is
  'Nombre de reouvertures. Colonne de PILOTAGE, pas de preuve : la preuve est au registre.
   Un fil rouvert plusieurs fois signale une negociation mal cloturee ou une file mal tenue ;
   au-dela du seuil de backoffice.operational_settings, une alerte est levee.';
```

**`messaging.pause_reasons` — le référentiel manquant.** Même forme que `messaging.closure_reasons`
et `messaging.report_reasons` (§3.1, une table par file) :

| Colonne | Type | Contrainte |
|---|---|---|
| `code` | `text` | **PK** — `attente_element_marque` · `attente_element_createur` · `verification_en_cours` · `instruction_signalement` · `mediation` · `autre` |
| `label_key`, `message_key` | `text` | `not null` (R8). `message_key` porte le **libellé neutre montré aux parties**, distinct du libellé interne |
| `requires_comment` | `boolean` | `not null default false` — **vrai sur `autre`** |
| `is_active` | `boolean` | `not null default true` |
| `sort_order` | `smallint` | `not null` |

**`messaging.conversation_state_transitions` — le graphe d'états, en données.** Cinq états
(`12` RG15), et une réouverture qui n'était exprimable nulle part :

| Colonne | Type | Contrainte |
|---|---|---|
| `from_state` | `messaging.conversation_state` | **PK avec les deux suivantes** |
| `to_state` | `messaging.conversation_state` | **PK**, `check (to_state <> from_state)` |
| `allowed_actor` | `text` | **PK**, `check (allowed_actor in ('agent','system'))` — **aucune partie ne change l'état d'un fil** |
| `requires_reason` | `boolean` | `not null default false` |
| `is_active` | `boolean` | `not null default true` |

| `from_state` | `to_state` | `allowed_actor` | `requires_reason` |
|---|---|---|---|
| `open` | `active` | `system` | non — **automatique au premier message, y compris celui du commercial** (`12` RG16) |
| `open`, `active` | `paused` | `agent` | **oui** (`12` RG17) |
| `paused` | `active` | `agent` | non (`12` RG19) |
| `open`, `active`, `paused` | `closed` | `agent` | **oui** (`12` RG20) |
| **`closed`** | **`active`** | **`agent`** | **oui** — **la réouverture** (`12` RG22) |
| `closed` | `archived` | `agent`, `system` | non (`12` RG23) |

```sql
comment on table messaging.conversation_state_transitions is
  'Graphe des etats d''une conversation (12 RG15 a RG23), en DONNEES.
   Trois proprietes que la table rend vraies par construction :
   1. AUCUNE transition ne mene a une suppression — clore, archiver et supprimer sont trois choses
      differentes, et la troisieme n''existe pas au MVP, pour personne (12 RG24) ;
   2. AUCUNE ligne n''a allowed_actor = ''party'' : une partie ne met en pause, ne clot, ni ne
      rouvre jamais un fil ;
   3. closed -> active EXISTE : la cloture n''est pas terminale (12 RG22).
   archived n''a AUCUNE transition sortante : choix conservateur, signale au §12.7 point 2.';
```

Et le déclencheur correspondant, sur le modèle de celui de `billing.deals` :

```sql
create or replace function messaging.assert_conversation_transition()
returns trigger language plpgsql as $$
begin
  if new.state is not distinct from old.state then
    return new;
  end if;

  if not exists (select 1
                   from messaging.conversation_state_transitions t
                  where t.from_state = old.state
                    and t.to_state   = new.state
                    and t.is_active) then
    raise exception 'forbidden conversation transition % -> % (conversation %)',
      old.state, new.state, old.id using errcode = '55006';
  end if;

  -- la reouverture efface la cloture EN COURS et incremente le compteur ;
  -- l'histoire reste au registre (12 RG22)
  if old.state = 'closed' and new.state = 'active' then
    new.closed_at            := null;
    new.closure_reason_code  := null;
    new.closed_by_account_id := null;
    new.closure_comment      := null;
    new.reopened_at          := now();
    new.reopen_count         := old.reopen_count + 1;
  end if;

  -- la reprise efface la pause EN COURS, meme raisonnement
  if old.state = 'paused' and new.state = 'active' then
    new.paused_at            := null;
    new.pause_reason_code    := null;
    new.paused_by_account_id := null;
    new.pause_comment        := null;
  end if;

  return new;
end;
$$;

create trigger conversations_state_transition
  before update of state on messaging.conversations
  for each row execute function messaging.assert_conversation_transition();
```

**Une conséquence à assumer, et elle est bonne :** `12` cas limite n° 4 (« deux agents clôturent le
même fil au même instant ») se règle **sans code applicatif**. Le premier passe, le second trouve
`old.state = 'closed'` et sa transition `closed → closed` n'existe pas — la transaction échoue,
« aucun motif n'est écrasé », et `apps/api` répond `409` avec le nom de celui qui a clos. Le même
mécanisme couvre la pause, la reprise et la réouverture concurrentes.

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

| Colonne | Type | Contrainte |
|---|---|---|
| `id` | `bigint` | `generated always as identity` |
| `conversation_id` | `uuid` | `not null` FK |
| `agent_account_id` | `uuid` | `not null` FK |
| `accessed_at` | `timestamptz` | `not null default clock_timestamp()` |
| `was_participant` | `boolean` | `not null` — **au moment de la lecture** (R7), jamais recalculé après coup |
| **`reason_code`** | `text` | **`not null references messaging.access_reasons(code)`** — le **motif typé** (`12` RG56) |
| **`reason_comment`** | `text` | `check (length(reason_comment) <= 1000)`, **obligatoire** si `access_reasons.requires_comment` |
| **`read_session_id`** | `uuid` | `not null` — regroupe les appels d'une même consultation (`03` §5.2) |
| `surface` | `messaging.access_surface` | `not null` — `backoffice_queue` · `backoffice_deal` · `backoffice_search` · `backoffice_reports` · `member_app` |
| `access_scope` | `text` | `not null check (access_scope in ('thread','export'))` — `export` **n'est utilisé par aucun chemin au MVP** (`12` RG62) |
| `request_id` | `text` | Rapprochement avec les journaux `pino` |
| `cursor_before`, `page_limit` | — | Les bornes de pagination (`12` RG58) |
| `message_count_returned` | `integer` | `not null` — **un compteur, jamais un extrait** |

**Le motif typé était le manque le plus grave de la messagerie** (`12` manque 2). La table portait
`surface`, qui dit **l'écran**, pas **la raison légitime** : sans motif, A10 trace l'accès mais pas
sa légitimité, et la promesse faite aux utilisateurs (« chacune de ces lectures est horodatée,
attribuée et conservée », `12` RG103) devient invérifiable sur le seul point qui compte — *pourquoi*.

**`messaging.access_reasons` — la liste fermée des motifs de lecture** (`12` RG56) :

| Colonne | Type | Contrainte |
|---|---|---|
| `code` | `text` | **PK** — `suivi_de_l_affaire` · `continuite_de_service` · `reprise_de_dossier` · `instruction_signalement` · `litige_ou_contestation` · `controle_qualite` · `demande_rgpd` · `incident_de_securite` · `autre` |
| `label_key` | `text` | `not null` (R8) |
| **`is_auto_selectable`** | `boolean` | `not null default false` — **vrai pour `suivi_de_l_affaire` seulement** |
| `requires_comment` | `boolean` | `not null default false` — **vrai pour `autre`** (`12` RG56) |
| `requires_participation` | `boolean` | `not null default false` — **vrai pour `suivi_de_l_affaire`** : on ne « suit » pas l'affaire d'un autre |
| `is_reviewed_weekly` | `boolean` | `not null default false` — **vrai pour `autre`**, motif surveillé chaque semaine |
| `sort_order` | `smallint` | `not null` |
| `is_active` | `boolean` | `not null default true` |

```sql
comment on table messaging.access_reasons is
  'Motifs types d''une lecture de conversation par un role interne (12 RG56).
   LISTE FERMEE : un motif libre serait un motif vide. is_auto_selectable = true uniquement pour
   suivi_de_l_affaire, retenu AUTOMATIQUEMENT quand l''agent est participant — aucune friction
   sur le geste quotidien (12 RG56, CA30). Pour un agent NON participant, le motif est choisi
   AVANT que le moindre message ne soit affiche (12 RG57, CA31) : un motif choisi apres coup ne
   vaut rien, et c''est la fonction de lecture qui le garantit, pas l''ecran.
   incident_de_securite est ajoute a la liste de 12 RG56 : une investigation apres incident est
   une raison legitime, et l''absence du motif pousserait a cocher ''autre''.';

comment on column messaging.conversation_access_log.reason_code is
  'NOT NULL SANS VALEUR PAR DEFAUT : il n''existe aucun moyen d''ecrire une lecture sans motif.
   C''est la difference entre tracer un acces et pouvoir en rendre compte (12 RG58).';
```

**`read_session_id` : la colonne existe, et voici ce qu'elle fait.** `03` §5.2 la cite pour
« regrouper les lectures à l'affichage » ; `12` la signalait absente de `04` (manque 7). Elle est
**générée par `apps/api` à l'ouverture d'un fil** et repassée à chaque page suivante. Sans elle,
un agent qui fait défiler cinq pages produit cinq lignes indiscernables de cinq consultations, et la
revue hebdomadaire X4 — « classement des agents par nombre de fils distincts lus » — mesure la
pagination au lieu de l'attention. **Aucun autre mécanisme ne la remplace** : `request_id` change à
chaque appel (c'est son rôle), et `accessed_at` ne permet qu'un regroupement par fenêtre de temps,
c'est-à-dire une heuristique.

```sql
-- X4 : fils distincts reellement ouverts par agent sur 24 h (12 RG61, seuil de depart : 40)
select agent_account_id, count(distinct conversation_id) as threads,
       count(distinct read_session_id)                   as sessions
  from messaging.conversation_access_log
 where accessed_at > now() - interval '24 hours'
 group by agent_account_id
having count(distinct conversation_id) > 40;
```

**Ce qui n'y est pas, et n'y sera jamais :** le contenu d'un message, un extrait, un aperçu, un
objet, un nom. Journaliser l'accès, pas la donnée.

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

| Colonne | Type | Contrainte |
|---|---|---|
| `id` | `uuid` | PK |
| `message_id` | `uuid` | `not null references messaging.messages(id)` |
| `detection_type` | `messaging.detection_type` | `not null` — `email` · `phone` · `social_handle` · `messaging_link` · `iban` · `url` (`12` RG47) |
| `match_start`, `match_end` | `integer` | `not null`, `check (match_end > match_start and match_start >= 0)` — **des positions, jamais du texte** |
| `detector_version` | `text` | `not null` — rejeu du corpus sans réécrire l'historique |
| **`warned_before_send`** | `boolean` | `not null` — **l'émetteur a vu l'avertissement avant l'envoi** (`12` RG45) |
| **`sent_despite_warning`** | `boolean` | `not null` — **il a choisi « Envoyer quand même »** (`12` RG45, CA22) |
| `reviewed_by_agent_id` | `uuid` | FK interne |
| `reviewed_at` | `timestamptz` | Couple lié au suivant |
| `review_outcome` | `messaging.review_outcome` | `legitimate` · `circumvention_suspected` · `false_positive` (`12` RG50) |
| `created_at` | `timestamptz` | `not null` — **append-only sauf les trois colonnes de classement** |

```sql
alter table messaging.contact_detections
  -- on ne peut pas avoir envoye "malgre l'avertissement" sans avoir ete averti
  add constraint contact_detections_warning_consistency
      check (not sent_despite_warning or warned_before_send),
  add constraint contact_detections_review_is_complete
      check (num_nonnulls(reviewed_by_agent_id, reviewed_at, review_outcome) in (0, 3));

comment on column messaging.contact_detections.warned_before_send is
  'Vrai si le controle prealable a affiche l''avertissement a l''emetteur AVANT l''envoi
   (12 RG42, RG43). Faux dans deux cas legitimes : detection ajoutee par une version
   posterieure du detecteur, ou chemin d''envoi sans ecran (import, rattrapage).
   ATTENTION : le controle prealable NE STOCKE RIEN (12 RG44). Un brouillon corrige avant envoi
   ne laisse aucune trace — cette colonne ne decrit que les messages REELLEMENT envoyes.';

comment on column messaging.contact_detections.sent_despite_warning is
  'Vrai si l''emetteur a choisi « Envoyer quand meme » apres l''avertissement (12 RG45, CA22).
   *** C''EST LA DONNEE LA PLUS UTILE DU DISPOSITIF. *** Un partage involontaire et un partage
   assume apres avertissement ne disent pas la meme chose, et seul le second merite l''attention
   du commercial. C''est aussi l''indicateur de contournement le plus honnete du MVP
   (12, Indicateurs) : « part des detections envoyees malgre l''avertissement ».
   NE DECLENCHE AUCUNE SANCTION AUTOMATIQUE (12 RG48, M5 allege) : on signale, on ne masque pas,
   on ne bloque pas. Cette colonne alimente une conversation entre humains.';
```

**On stocke le type et la position, jamais une copie du texte détecté** (`intermediation-tracking`,
section détection ; `12` RG46, CA23). Le message est déjà stocké ; en recopier un extrait doublerait
l'exposition d'une donnée personnelle sans rien apporter — et reviendrait à construire, à côté de la
messagerie, **l'annuaire qu'on cherche précisément à éviter**. `detector_version` permet de rejouer
le corpus quand la détection évoluera, **sans jamais réécrire une détection passée** (`12`, cas
limite « le détecteur est mis à jour »).

**La détection s'applique aussi aux messages des agents** (`12` RG49) : la table ne porte aucune
condition sur le rôle de l'auteur. Une détection sur un message d'agent est visible de
**l'administrateur**, pas des parties — c'est une règle de politique RLS, pas de schéma (`03`).

```sql
-- liste de travail du commercial : detections non classees, les assumees d'abord (12 RG99)
create index contact_detections_pending_idx
  on messaging.contact_detections (sent_despite_warning desc, created_at desc)
  where reviewed_at is null;
```

#### `messaging.reports`

`id`, `conversation_id`, `message_id` (nullable), `reporter_account_id`, `reason_code`
(FK `messaging.report_reasons`), `comment`, `status`, `claimed_by_agent_id`, `decided_at`,
`outcome_code`, `sla_due_at`, `created_at`.

```sql
-- anti-abus : 5 signalements actifs par compte (12 RG85), valeur en table
create index reports_active_by_reporter_idx
  on messaging.reports (reporter_account_id)
  where status in ('open','in_review');
```

La **personne visée n'est jamais informée** de l'existence d'un signalement (`12` RG83) : aucune
colonne ne la désigne, et aucune politique ne lui donne de lecture sur cette table. Le signalant, lui,
apprend que son signalement a été **traité**, `outcome_code` restant interne (`12` RG84).

#### `messaging.documents` — le canal contrôlé (conditionnel)

> **Périmètre conditionnel, inchangé.** Le canal de documents est une **proposition** de
> `messaging-spec` (question ouverte n° 4, reprise en `12` Q5, arbitre : le fondateur, avec **veto de
> `expert-cybersecurite` sur l'absence d'analyse antivirale**). S'il est écarté, les **trois** tables
> de ce paragraphe ne sont pas créées : aucune autre table n'en dépend.

| Colonne | Type | Contrainte |
|---|---|---|
| `id` | `uuid` | PK |
| **`introduction_id`** | `uuid` | `not null` FK — **rattaché à la mise en relation, pas au message** (`12` RG66) |
| `uploaded_by_account_id` | `uuid` | `not null` FK |
| `storage_path` | `text` | `not null unique` — compartiment privé, jamais d'URL publique |
| `label_code` | `text` | `not null` FK `messaging.document_labels` — `brief` · `moodboard` · `exemple_de_contenu` · `charte_de_marque` · `planning` · `autre` (`12` RG69). **Ni `contrat`, ni `devis`, ni `facture`** (`12` RG70, CA41) |
| `label_comment` | `text` | Obligatoire sur `autre` |
| `original_filename` | `text` | **Stocké pour l'agent, jamais renvoyé à un membre** — champ de texte libre, donc vecteur de coordonnées (`devis-jean-0612345678.pdf`, `12` RG69) |
| `content_type` | `text` | `not null check (content_type in ('image/png','image/jpeg','application/pdf'))` — **voir la réserve E1-9 ci-dessous** |
| `byte_size` | `bigint` | `not null check (byte_size > 0 and byte_size <= 10485760)` — 10 Mo (`12` RG68) |
| `moderation_status` | `messaging.moderation_status` | `not null default 'pending'` — `pending` · `approved` · `rejected` |
| `moderated_by_agent_id`, `moderated_at` | — | Couple lié au statut |
| `rejection_reason_code` | `text` | FK **`messaging.document_rejection_reasons`**, `check ((moderation_status = 'rejected') = (rejection_reason_code is not null))` (`12` RG73) |
| **`available_at`** | `timestamptz` | **La mise à disposition de l'autre partie** — distincte du dépôt **et** du contrôle (`12` RG71, RG74) |
| `review_due_at` | `timestamptz` | `not null` — 1 jour ouvré, lu dans `backoffice.sla_policies` (`12` RG71) |
| `created_at` | `timestamptz` | `not null` — **la date de dépôt** |

**Trois dates, et non une seule : c'est tout l'objet de la correction** (`12` manque 5). Le dépôt
(`created_at`), le contrôle (`moderated_at`) et la **mise à disposition** (`available_at`) se
produisent à trois instants, sous la responsabilité de deux personnes différentes. Tant que
`available_at` est nul, **l'autre partie ne voit rien** — ni le document, ni son existence, ni un
emplacement en attente (`12` RG72, CA37) : c'est cette colonne, et elle seule, que la politique RLS
du destinataire interroge.

```sql
alter table messaging.documents
  -- un document mis a disposition a forcement ete accepte
  add constraint documents_available_requires_approval
      check (available_at is null or moderation_status = 'approved'),
  add constraint documents_moderation_is_complete
      check ((moderation_status = 'pending')
             = (num_nonnulls(moderated_by_agent_id, moderated_at) = 0)),
  add constraint documents_chronology
      check (coalesce(available_at, 'infinity') >= coalesce(moderated_at, '-infinity')),
  -- 10 documents par mise en relation (12 RG68) : contrainte tenue par declencheur,
  -- un CHECK ne peut pas compter des lignes soeurs
  add constraint documents_size_within_cap
      check (byte_size <= 10485760);

comment on column messaging.documents.available_at is
  'Instant ou le document devient visible de L''AUTRE partie (12 RG71, RG74).
   DISTINCT de created_at (depot) et de moderated_at (controle) : un agent peut accepter un
   document sans le mettre a disposition dans la meme seconde, et un document DEPOSE PUIS
   CONTROLE APRES LA CLOTURE du fil est mis a disposition SANS ROUVRIR le fil (12, cas limite).
   NUL = l''autre partie ne voit RIEN : ni le document, ni son existence, ni un emplacement en
   attente, ni un decompte (12 RG72). C''est cette colonne que lit la politique RLS du
   destinataire — pas moderation_status, qui dirait seulement que quelqu''un a decide.
   La mise a disposition produit le message systeme document.available (12 RG74) et
   l''evenement de registre du meme nom.';

comment on column messaging.documents.original_filename is
  'Nom de fichier d''origine. *** JAMAIS RENVOYE A UN MEMBRE, y compris au deposant (12 RG69). ***
   C''est un champ de TEXTE LIBRE choisi par un membre, donc un vecteur de coordonnees.
   Visible du seul agent qui controle. Le membre voit label_code, rendu dans sa langue.';
```

> **Réserve à lever avant la migration `0405` — le PDF.** `03` **E1-9** pose « images uniquement
> (PNG, JPEG, WebP), **PDF refusé au MVP** », parce qu'un PDF servi depuis notre origine est un
> **document actif**. La règle vise explicitement le portfolio et les pièces de vérification ; son
> motif, lui, vaut tout autant ici. Or `12` RG68 liste **PDF, PNG, JPEG** — un brief sans PDF n'est
> pas un brief. **Position conservatrice retenue :** la valeur `application/pdf` figure dans la
> contrainte **mais n'est activée qu'à deux conditions**, posées par E1-9 elle-même — servi depuis
> une **origine distincte**, en `Content-Disposition: attachment`. `03` **E1-11** demandait par
> ailleurs la réouverture du sujet antiviral « si un canal de documents est ouvert » : **il l'est
> ici**. Les deux points partent en **§12.7, point 3**, veto `expert-cybersecurite` (`12` Q5).
> Tant qu'ils ne sont pas levés, la migration charge la contrainte **sans** `application/pdf` :
> retirer une valeur d'un `CHECK` est une migration destructive, en ajouter une ne l'est pas.

**`messaging.document_labels`** : `code` PK, `label_key`, `requires_comment` (**vrai sur `autre`**),
`sort_order`, `is_active`. Liste fermée de six valeurs, **dont l'absence de `contrat`, `devis` et
`facture` est une décision de produit** (`12` RG70) : le contrat est hors application (**A1**) et ce
canal ne doit pas le devenir par glissement.

**`messaging.document_rejection_reasons`** : `code` PK, `label_key`, `message_key` (le message
**envoyé au seul déposant**), `requires_comment`, `sort_order`, `is_active`. Codes du MVP :
`illisible` · `hors_sujet` · `coordonnees_dans_le_document` · `format_non_conforme` ·
`contenu_contractuel` · `autre`. C'est la cible de la clé étrangère `rejection_reason_code`, qui
jusqu'ici n'en avait aucune — **une clé étrangère sans table est une contrainte qui n'existe pas**.

```sql
comment on table messaging.document_rejection_reasons is
  'Motifs de refus d''un document (12 RG73). Le refus est notifie AU SEUL DEPOSANT et
   N''EST PAS un message systeme : l''autre partie n''a jamais su que le document existait
   (12 RG73, CA39). Une table par file (§3.1) : ces motifs n''ont rien a voir avec ceux d''une
   cloture de fil, d''un signalement ou d''une campagne.';
```

#### `messaging.document_downloads` — le journal des téléchargements (`12` manque 5)

`12` RG75 exige que **le dépôt, le contrôle, la mise à disposition et *chaque téléchargement***
soient journalisés avec leur auteur et leur date. Les trois premiers sont des colonnes de la table
ci-dessus ; le quatrième est **un fait répétable**, donc une ligne.

*Table **append-only**, `REVOKE UPDATE, DELETE` à tous les rôles + déclencheur
`influx.assert_append_only()`.*

| Colonne | Type | Contrainte |
|---|---|---|
| `id` | `bigint` | `generated always as identity` |
| `document_id` | `uuid` | `not null references messaging.documents(id)` |
| `downloaded_by_account_id` | `uuid` | `not null` FK — **l'auteur réel**, membre ou agent |
| `downloader_role` | `messaging.participant_role` | `not null` — copie au moment du téléchargement (R7) |
| `downloaded_at` | `timestamptz` | `not null default clock_timestamp()` |
| `request_id` | `text` | Rapprochement avec les journaux applicatifs |
| `signed_url_expires_at` | `timestamptz` | `not null` — **l'URL signée émise**, jamais l'URL elle-même |

```sql
create index document_downloads_by_document_idx
  on messaging.document_downloads (document_id, downloaded_at desc);

comment on table messaging.document_downloads is
  'Un telechargement = une ligne (12 RG75). APPEND-ONLY, pas d''updated_at.
   Repond a la seule question qui compte en cas de litige : « qui a recupere ce fichier,
   et quand ? ». Le simple fait qu''un document soit mis a disposition ne prouve pas qu''il ait
   ete lu — c''est pourquoi la date de mise a disposition (documents.available_at) NE SUFFIT PAS
   et ne remplace pas cette table.
   NE CONTIENT JAMAIS l''URL signee elle-meme, seulement sa date d''expiration : une URL signee
   journalisee est une URL signee qui fuit.
   Ecrite par la fonction SECURITY DEFINER qui emet l''URL, AVANT de l''emettre — meme doctrine
   que messaging.read_conversation() : on journalise, PUIS on sert.';
```

**Une conséquence de conception à noter** : `access_scope = 'export'` de
`messaging.conversation_access_log` et ce journal-ci sont **deux objets différents**. Télécharger un
document mis à disposition est un geste normal du produit ; exporter une conversation n'existe pas au
MVP (`12` RG62). Les confondre ferait passer l'un pour l'autre dans la revue hebdomadaire.

#### 5.7.1 Les apartés — canaux, accès par canal et données dérivées (D47, `12` §K)

> **Date :** 2026-09-24 · **Auteur :** `expert-database` · **Source :** `12` §K (RG113 à RG146) et
> les sept besoins de données de ses impacts ; arbitrages du fondateur du 2026-09-24 (D47, `20` Q1
> et Q2). **Le cloisonnement (A1) et le cas de l'administrateur unique (A3) ont été tranchés par le
> fondateur le 2026-09-24** ; `03` a été aligné (A4). **Reste soumis à l'avis (veto)
> d'`expert-cybersecurite`** : les deux fonctions privilégiées ajoutées (question A2).

**Ce que les apartés demandent au modèle, en une phrase :** un **canal** sur chaque message, et la
garantie qu'aucune lecture — d'un message **ou de ce qui en dérive** — ne franchit la frontière entre
les deux apartés.

| # | Besoin (`12` §K, impacts) | Traduction | Règles |
|---|---|---|---|
| 1 | Un canal sur chaque message, obligatoire, sans valeur par défaut, immuable | Type `messaging.message_channel`, colonne `messages.channel not null` **sans `default`**, deux contraintes `check` | RG114, RG120, RG128 |
| 2 | Accès par canal **en base** pour la marque et le créateur | Politiques de lecture et d'écriture **par rôle**, à **liste de canaux constante**, doublées de la contrainte `messages_party_channel` ; déclencheur d'écriture pour la matrice état × canal | RG115, RG123, RG126, RG127, RG145 |
| 3 | Curseur de lecture par canal | `conversation_reads` : clé primaire étendue au canal | RG133 |
| 4 | Canal dans le journal des lectures | `conversation_access_log.channel not null` ; `read_conversation()` exige un canal et ne sert que lui | RG130, RG132 |
| 5 | Passage `ouverte` → `active` limité au fil commun | Condition `kind = 'member' and channel = 'common'` dans le déclencheur d'insertion | RG124 |
| 6 | Canal dans l'événement de notification | `channel` dans la charge utile, **dans la clé d'idempotence** (qui tient seule le cycle par canal), deux codes d'e-mail | RG135, RG136 |
| 7 | Signalement d'un message d'agent réservé aux administrateurs autres que l'auteur | `reports.agent_author_account_id`, posé par déclencheur, et deux politiques | RG140 |
| + | **Données dérivées** (dernière activité, non-lus, tri) sous la même règle d'accès | `conversations.last_message_at` **remplacée** par `messaging.conversation_channel_activity`, soumise aux mêmes politiques par canal | RG118, RG146 |

Le dernier point n'était pas dans la liste de `12`, et c'est le plus important : **`last_message_at`
était une fuite.** Une seule date de dernière activité par conversation, lue par les deux parties
pour trier leur liste, bouge quand la marque écrit dans son aparté ; le créateur voit alors la
conversation remonter sans message nouveau, et apprend qu'un aparté existe. `12` RG146 le dit : « une
fuite passe plus souvent par un compteur que par un message ».

##### (1) Le canal

```sql
create type messaging.message_channel as enum ('common', 'advertiser_private', 'creator_private');
```

| Colonne ajoutée à `messaging.messages` | Type | Contrainte |
|---|---|---|
| **`channel`** | `messaging.message_channel` | `not null`, **aucune valeur par défaut** (`12` RG120). Immuable : la table est déjà sous `REVOKE UPDATE` |

```sql
alter table messaging.messages
  -- une partie n'ecrit que dans le fil commun ou dans SON aparte (12 RG115) :
  -- impossible, pas seulement interdit, meme si une politique etait mal ecrite
  add constraint messages_party_channel
      check (kind = 'system'
             or sender_role = 'agent'
             or (sender_role = 'advertiser' and channel in ('common', 'advertiser_private'))
             or (sender_role = 'creator'    and channel in ('common', 'creator_private'))),
  -- dans un aparte, seuls trois messages systeme existent (12 RG128)
  add constraint messages_private_system_events
      check (kind = 'member'
             or channel = 'common'
             or system_event_code in ('agent.joined', 'agent.left', 'agent.owner_changed'));

comment on column messaging.messages.channel is
  'Canal du message (12 RG114) : common, advertiser_private ou creator_private.
   AUCUNE VALEUR PAR DEFAUT, et c''est la regle (12 RG120) : un envoi qui oublie son canal doit
   ECHOUER, jamais atterrir dans le fil commun. Une valeur par defaut transformerait un bogue
   d''ecran en fuite d''un aparte vers l''autre partie.
   Immuable (REVOKE UPDATE sur la table) : aucun message ne change de canal (12 RG114).';
```

**Les messages système d'entrée et de sortie d'un agent sont écrits en trois lignes**, une par canal
(`12` RG128), par la fonction d'ajout d'un agent (`03` C(25)), qui fixe elle-même le canal de chacune.

**L'appartenance à un aparté n'a pas de table.** Un aparté réunit sa partie et **tous les agents
participants** (arbitrage du fondateur, `20` Q2) : c'est exactement ce que dit déjà
`conversation_participants`. Une table d'appartenance répéterait cette information et pourrait la
contredire. La décision du fondateur est aussi la forme la plus simple du modèle.

##### (2) L'accès par canal, en base

**Lecture par les membres.** Une politique par rôle, dont la **liste de canaux est une constante** :
elle ne dépend d'aucune donnée, elle se lit d'un coup d'œil et elle se teste.

```sql
create policy messages_select_advertiser
  on messaging.messages for select to influx_advertiser
  using (
    channel in ('common', 'advertiser_private')        -- LA CONSTANTE EST LE CLOISONNEMENT
    and exists (select 1
                  from messaging.conversation_participants p
                 where p.conversation_id  = messages.conversation_id
                   and p.account_id       = (select influx.current_account_id())
                   and p.participant_role = 'advertiser'));

create policy messages_select_creator
  on messaging.messages for select to influx_creator
  using (
    channel in ('common', 'creator_private')
    and exists (select 1
                  from messaging.conversation_participants p
                 where p.conversation_id  = messages.conversation_id
                   and p.account_id       = (select influx.current_account_id())
                   and p.participant_role = 'creator'));
```

**Écriture.** Même forme, avec en plus l'auteur réel (`12` RG13) et la participation active :

```sql
create policy messages_insert_advertiser
  on messaging.messages for insert to influx_advertiser
  with check (
    kind = 'member'
    and sender_account_id = (select influx.current_account_id())
    and sender_role       = 'advertiser'
    and channel in ('common', 'advertiser_private')
    and exists (select 1
                  from messaging.conversation_participants p
                 where p.conversation_id  = messages.conversation_id
                   and p.account_id       = (select influx.current_account_id())
                   and p.participant_role = 'advertiser'
                   and p.left_at is null));

-- miroir exact pour influx_creator avec ('common', 'creator_private')

create policy messages_insert_agent
  on messaging.messages for insert to influx_agent, influx_admin
  with check (
    kind = 'member'
    and sender_account_id = (select influx.current_account_id())
    and sender_role       = 'agent'
    and (select influx.has_aal2())
    and exists (select 1
                  from messaging.conversation_participants p
                 where p.conversation_id  = messages.conversation_id
                   and p.account_id       = (select influx.current_account_id())
                   and p.participant_role = 'agent'
                   and p.left_at is null));
```

Les agents **n'ont toujours aucun `SELECT`** sur `messages` (`03` §5.2) : ils écrivent sans
`RETURNING`, l'identifiant du message étant généré par `apps/api`, et ils lisent par
`read_conversation()` (point 4).

**Deux murs, et non un.** Une partie qui tente d'écrire dans l'aparté de l'autre est arrêtée par la
politique **et** par la contrainte `messages_party_channel`. La politique protège contre un appel
forgé ; la contrainte protège contre une politique mal écrite ou supprimée par une migration. C'est
la même doctrine que l'anonymisation (`CLAUDE.md` §6) : une règle en base, doublée d'un filtre de
sortie dans `apps/api`, et d'un test.

**La matrice état × canal, en base.** `12` RG123, RG126 et RG127 disent qui écrit selon l'état du fil.
Un déclencheur les tient, pour le fil commun comme pour les apartés :

```sql
create or replace function messaging.assert_message_writable()
returns trigger language plpgsql
security definer set search_path = ''
as $$
declare
  v_state   messaging.conversation_state;
  v_blocked boolean;
begin
  if new.kind = 'system' then
    return new;                          -- ecrits par les seules fonctions privilegiees
  end if;

  select c.state into v_state
    from messaging.conversations c
   where c.id = new.conversation_id;

  if v_state in ('closed', 'archived') then                      -- 12 RG20, RG123
    raise exception 'conversation not writable' using errcode = '55006';
  end if;

  if new.sender_role = 'agent' then
    return new;                          -- les agents ecrivent dans tous les canaux d'un fil non clos
  end if;

  if influx.is_suspended(new.sender_account_id) then             -- 12 RG127 : aucun canal
    raise exception 'account suspended' using errcode = 'insufficient_privilege';
  end if;

  if new.channel = 'common' then
    if v_state = 'paused' then                                   -- 12 RG18, RG123
      raise exception 'conversation paused' using errcode = '55006';
    end if;

    select exists (select 1
                     from messaging.conversations c
                     join matching.introductions  i on i.id = c.introduction_id
                     join matching.party_blocks   b
                       on b.advertiser_account_id = i.advertiser_account_id
                      and b.creator_account_id    = i.creator_account_id
                      and b.lifted_at is null
                    where c.id = new.conversation_id)
      into v_blocked;

    if v_blocked then                                            -- 12 RG87, RG126
      raise exception 'pair blocked' using errcode = '55006';
    end if;
  end if;

  -- l'aparte d'une partie reste ouvert en pause et malgre un blocage (12 RG123, RG126)
  return new;
end $$;

create trigger messages_writable
  before insert on messaging.messages
  for each row execute function messaging.assert_message_writable();
```

**Pourquoi `security definer` :** les agents n'ont pas de `SELECT` sur `conversations` (`03` §5.2),
et un membre ne lit pas nécessairement `party_blocks` dans le sens qui l'intéresse. La fonction **ne
fait que lire et refuser** ; elle n'écrit rien. Elle rejoint pourtant la liste des fonctions
privilégiées à revoir ligne à ligne (§12.1 point 7).

##### (3) Les données dérivées : `messaging.conversation_channel_activity`

*Remplace `conversations.last_message_at`, qui est **supprimée** (§10.8 mis à jour).*

| Colonne | Type | Contrainte |
|---|---|---|
| `conversation_id` | `uuid` | `not null references messaging.conversations(id)` — **PK avec la suivante** |
| `channel` | `messaging.message_channel` | `not null` — **PK** |
| `last_message_at` | `timestamptz` | `not null` — dernier message, système compris, **de ce canal** |

Une ligne par canal **qui a reçu au moins un message** : la ligne d'un aparté n'existe qu'après son
premier message, et elle n'est visible que de sa partie et des agents.

```sql
create or replace function messaging.on_message_inserted()
returns trigger language plpgsql
security definer set search_path = ''
as $$
begin
  insert into messaging.conversation_channel_activity as a
         (conversation_id, channel, last_message_at)
  values (new.conversation_id, new.channel, new.created_at)
  on conflict (conversation_id, channel)
  do update set last_message_at = greatest(a.last_message_at, excluded.last_message_at);

  -- 12 RG16 amendee par RG124 : SEUL un message de membre du FIL COMMUN rend le fil actif.
  -- Un aparte qui changerait l'etat, affiche aux deux parties (12 RG32), revelerait son existence.
  if new.kind = 'member' and new.channel = 'common' then
    update messaging.conversations
       set state = 'active'
     where id = new.conversation_id
       and state = 'open';
  end if;

  return new;
end $$;

create trigger messages_after_insert
  after insert on messaging.messages
  for each row execute function messaging.on_message_inserted();

-- memes politiques par canal que les messages : la fuite est impossible par construction
create policy channel_activity_advertiser
  on messaging.conversation_channel_activity for select to influx_advertiser
  using (
    channel in ('common', 'advertiser_private')
    and exists (select 1
                  from messaging.conversation_participants p
                 where p.conversation_id  = conversation_channel_activity.conversation_id
                   and p.account_id       = (select influx.current_account_id())
                   and p.participant_role = 'advertiser'));

-- miroir pour influx_creator ; lecture directe pour influx_agent et influx_admin :
-- une date d'activite n'est pas le contenu d'une conversation (pas de journal, 12 RG55 inchangee)
grant select on messaging.conversation_channel_activity to influx_agent, influx_admin;
revoke insert, update, delete on messaging.conversation_channel_activity
  from influx_advertiser, influx_creator, influx_agent, influx_admin;   -- le declencheur seul ecrit
```

**La liste « Mes conversations » d'un membre**, triée par activité — la requête n'a **pas besoin de
penser aux apartés**, c'est la politique qui retire la ligne invisible avant le `max()` :

```sql
select p.conversation_id, max(a.last_message_at) as last_activity_at
  from messaging.conversation_participants p
  join messaging.conversation_channel_activity a using (conversation_id)
 where p.account_id = (select influx.current_account_id())
 group by p.conversation_id
 order by last_activity_at desc;
```

**Le silence de 14 jours** (`12` RG125) se mesure, lui, **sur tous les canaux**, par le travail
nocturne qui lit la table sans filtre de canal : `having max(last_message_at) < now() - interval '14
days'`.

`on_message_inserted()` est `security definer` parce que seul le rôle propriétaire écrit dans
`conversations` (`03` C(21)) ; elle écrit deux choses, et deux seulement. Elle rejoint la liste du
§12.1 point 7.

##### (4) Le curseur de lecture et le journal des lectures, par canal

**`messaging.conversation_reads`** : clé primaire **`(conversation_id, account_id, channel)`**. Un
membre a deux curseurs par conversation (commun, son aparté), un agent en a trois. La politique
d'écriture d'un membre porte la même liste de canaux constante que ses messages. Le décompte des
non-lus d'un canal compte les messages **de ce canal** postérieurs à son curseur ; aucun accusé de
lecture n'est tiré d'un curseur d'aparté (`12` RG133).

**`messaging.conversation_access_log`** :

| Colonne ajoutée | Type | Contrainte |
|---|---|---|
| **`channel`** | `messaging.message_channel` | `not null`, **aucune valeur par défaut** — le canal lu (`12` RG130) |

**`messaging.read_conversation()`** prend un canal **obligatoire**, ne sert **que ce canal**, et
écrit une ligne de journal **par appel, donc par canal** :

```sql
create function messaging.read_conversation(
        p_conversation_id uuid,
        p_channel         messaging.message_channel,   -- OBLIGATOIRE, aucune valeur par defaut
        p_context         text,
        p_cursor          timestamptz default null,
        p_limit           int         default 50)
  returns setof messaging.messages
  -- ... corps inchange (03 §5.2), a deux differences pres :
  --     1. le journal (conversation_access_log ET audit.append) porte p_channel ;
  --     2. la requete servie filtre : and m.channel = p_channel
```

Ouvrir le fil commun **ne charge donc pas** les apartés (`12` RG132) : il n'existe aucun appel qui
renvoie deux canaux à la fois. Un agent non participant qui ouvre ensuite un aparté produit une
seconde ligne, portant ce canal — c'est CA68, tenu par la signature de la fonction.

```sql
-- 12 RG134 : la revue hebdomadaire isole les lectures d'apartes par des non-participants,
-- la lecture la plus sensible du produit
create index access_log_private_non_participant_idx
  on messaging.conversation_access_log (accessed_at desc)
  where channel <> 'common' and not was_participant;
```

##### (5) Les notifications : le cycle par canal tenu par la clé d'idempotence

L'événement de notification (`leads.outbox_events`, destination `brevo_transactional`) porte dans sa
charge utile, **identifiants uniquement** : `conversation_id`, `message_id`,
`recipient_account_id`, **`channel`**. Deux codes d'e-mail distincts dans
`leads.transactional_sends.email_code` : `message.notification` (fil commun) et
**`message.private_notification`** (aparté, « … vous a écrit en privé », lien vers l'onglet de
l'aparté, `12` RG135).

**Le cycle de `12` RG136 n'a pas besoin de table.** La clé d'idempotence est construite ainsi :

```
message.notification:<recipient_account_id>:<conversation_id>:<channel>:<cycle>:<immediate|reminder>
```

où `<cycle>` est le `last_read_at` du curseur de ce destinataire **sur ce canal** au moment de
l'émission (`never` s'il n'a jamais lu). La contrainte existante `unique (destination,
idempotency_key)` rend alors impossible un troisième e-mail sur un même canal et un même cycle
(au plus un immédiat et un rappel), et l'ouverture de l'onglet, qui avance le curseur, ouvre un
nouveau cycle (`12` RG94). **L'autre partie ne reçoit rien** (`12` RG138) : un événement n'est
jamais émis vers un destinataire qui n'a pas le canal dans sa liste constante.

##### (6) Le signalement d'un message d'agent

| Colonne ajoutée à `messaging.reports` | Type | Contrainte |
|---|---|---|
| **`agent_author_account_id`** | `uuid` | FK `identity.accounts`, nullable, `check (agent_author_account_id is null or message_id is not null)` — **l'auteur du message signalé quand c'est un agent**, posé par déclencheur, jamais saisi |

```sql
create or replace function messaging.set_report_agent_author()
returns trigger language plpgsql
as $$
begin
  if new.message_id is not null then
    -- execute sous le role du signalant : il ne lit que les canaux qui lui sont visibles,
    -- il ne peut donc signaler qu'un message qu'il a pu lire
    select case when m.sender_role = 'agent' then m.sender_account_id end
      into new.agent_author_account_id
      from messaging.messages m
     where m.id = new.message_id
       and m.conversation_id = new.conversation_id;
    if not found then
      raise exception 'message not found' using errcode = 'no_data_found';
    end if;
  end if;
  return new;
end $$;

create trigger reports_agent_author
  before insert on messaging.reports
  for each row execute function messaging.set_report_agent_author();

-- 12 RG140 : un agent ne voit JAMAIS un signalement visant un message d'agent
create policy reports_agent_queue
  on messaging.reports for all to influx_agent
  using (agent_author_account_id is null)
  with check (agent_author_account_id is null);

-- un administrateur les instruit, sauf ceux qui visent ses propres messages
create policy reports_admin_queue
  on messaging.reports for all to influx_admin
  using (agent_author_account_id is distinct from (select influx.current_account_id()))
  with check (agent_author_account_id is distinct from (select influx.current_account_id()));
```

Le signalant lit ses propres signalements **sans cette colonne** (`GRANT SELECT` par colonnes) :
elle désigne un membre de l'équipe, pas une information qui lui est due. L'alerte de nouveau
signalement (`backoffice.alert_instances`) suit la même règle de destinataires.

##### Ce qui ne change pas

- **`conversation_participants`** : aucune colonne nouvelle (voir point 1).
- **`contact_detections`** : **aucune colonne de canal.** Le canal se lit sur le message détecté ; le
  recopier serait une dénormalisation sans mesure (R10).
- **Conservation** (`12` RG144) : un aparté suit sa conversation, durées inchangées (§9.1).
- **Registre** : aucun code d'événement nouveau ; la charge utile de `messaging.conversation_read`
  porte le canal.
- **Droit d'accès** (`12` RG143) : la fonction d'export applique la **même liste de canaux
  constante** que les politiques de lecture, plus le filtre de `15` Q7 sur le fil commun.

##### Tests à ajouter (`03` §8 et plan `18`)

| # | Vérification | Critère |
|---|---|---|
| TA1 | `information_schema.columns.column_default` est **nul** pour `messages.channel` et `conversation_access_log.channel` | RG120, CA65 |
| TA2 | Sous `influx_creator` participant, `select count(*)` sur les messages, l'activité et les curseurs de canal `advertiser_private` renvoie **0** alors que des lignes existent ; idem en miroir | CA63, RG146 |
| TA3 | Une insertion du créateur dans `advertiser_private` échoue **par la politique** ; la même insertion, politiques désactivées dans la base de test, échoue **par la contrainte** | RG115, deux murs |
| TA4 | Un message d'aparté laisse `state = 'open'` ; un message du fil commun le fait passer à `active` | CA62 |
| TA5 | `read_conversation()` ne s'appelle pas sans canal ; un appel écrit exactement une ligne de journal portant ce canal | CA68 |
| TA6 | En pause, un membre écrit dans son aparté et pas dans le fil commun ; même chose sous blocage ; rien après clôture | CA69 à CA71 |
| TA7 | Sous `influx_agent`, un signalement visant un message d'agent est invisible ; sous `influx_admin`, l'auteur ne voit pas celui qui le vise | CA77 |
| TA8 | Deux notifications de même canal, même cycle, même type : la seconde est refusée par l'unicité | CA74 |

##### Migrations

Les migrations `0403`, `0404` et `0405` (§11) ne sont pas encore écrites, et le produit réel n'a
aucune donnée (D44) : les apartés **amendent leur contenu** plutôt que d'ajouter une migration de
reprise. Réversibles, comme elles.

| Migration | Ajout |
|---|---|
| `0403` `messaging_core` | Type `message_channel`, colonne `messages.channel` et ses deux contraintes, **`conversation_channel_activity` à la place de `conversations.last_message_at`**, déclencheurs `assert_message_writable` et `on_message_inserted`, clé de `conversation_reads`, politiques par canal, index de lecture par canal |
| `0404` `messaging_supervision` | `conversation_access_log.channel`, signature de `read_conversation()` avec canal, index partiel de la revue X4 |
| `0405` `messaging_safety` | `reports.agent_author_account_id`, son déclencheur et ses deux politiques |

##### Questions ouvertes

| # | Question | Hypothèse retenue | Arbitre | Échéance |
|---|---|---|---|---|
| **A1** | **Cloisonnement par politique à canal constant plus contrainte, ou trois tables de messages séparées** (un « mur » de droits plutôt qu'un filtre de lignes) ? | **Tranchée par le fondateur le 2026-09-24 : politique à canal constant, doublée d'une contrainte en base, plus tests** (`03` T19). La marque doit de toute façon lire une partie des lignes de la table où vit son aparté : trois tables ne suppriment pas le filtre, elles multiplient les clés étrangères (détections, signalements), les index et les requêtes d'union, pour une garantie équivalente | Fondateur, dans un domaine sous veto `expert-cybersecurite` (`CLAUDE.md` §10.3 point 2) | Fait |
| **A2** | Deux fonctions `security definer` de plus : `assert_message_writable` (lecture seule) et `on_message_inserted` (deux écritures) | Acceptées, à revoir ligne à ligne avec les sept autres (§12.1 point 7) | **`expert-cybersecurite` (veto)** | Avant l'écriture de `0403` |
| **A3** | Un signalement vise un message de **l'unique administrateur** : personne ne peut l'instruire (`12` RG140) | **Tranchée par le fondateur le 2026-09-24 :** le signalement reste en file, sans instructeur, et une alerte persistante l'annonce **sans aucun détail** ; il est instruit dès qu'un second administrateur existe — même bascule que PD7 (`03` §1.3). Mécanisme ci-dessous ; limite écrite en `03` C(27) | Fondateur | Fait |
| **A4** | `03` §5.2 et la condition C(23) décrivent `read_conversation()` et la lecture des membres **sans canal** | **Fait le 2026-09-24**, à la demande du fondateur : `03` C(23) à C(25), nouvelle C(27), §5.2 et T19 | `expert-cybersecurite` (relecture) | Fait |

**Mécanisme de A3.** Aucune colonne nouvelle : un signalement est **sans instructeur possible**
quand `agent_author_account_id` n'est pas nul et qu'aucun compte `admin` actif autre que lui
n'existe. Le travail qui calcule les alertes le détecte à chaque passage et tient une alerte du
catalogue `backoffice.alert_definitions` (numéro à attribuer dans `15`), dont la charge utile est **un
simple nombre** — ni identifiant de signalement, ni conversation, ni message. L'alerte se referme
seule dès qu'un second administrateur actif existe : la politique `reports_admin_queue` lui rend
alors le signalement visible sans rien changer au code.

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

##### Les deux compteurs de cadence (`16` écart 3, RG80)

`16` RG80 impose deux compteurs par contact, poussés vers les attributs Brevo du même nom :
`LAST_MARKETING_SENT_AT` et `MARKETING_SENDS_30D`. **Ils n'avaient aucun emplacement.** Deux
colonnes ici, et non une table ni une vue :

| Colonne | Type | Contrainte |
|---|---|---|
| **`last_marketing_sent_at`** | `timestamptz` | Dernière transmission marketing **réussie**, quelle que soit la source |
| **`marketing_sends_30d`** | `smallint` | `not null default 0 check (marketing_sends_30d >= 0)` — fenêtre glissante de 30 jours |
| **`marketing_counters_at`** | `timestamptz` | `not null default now()` — **date de recalcul** de la fenêtre |

```sql
comment on column leads.contact_sync_states.marketing_sends_30d is
  'Compteur de cadence sur 30 jours glissants (16 RG80), pousse vers l''attribut Brevo
   MARKETING_SENDS_30D par la file habituelle.
   ICI PLUTOT QUE DANS UNE TABLE A PART : le compteur est un ETAT DE SYNCHRONISATION par
   (compte, destination) — exactement ce que porte deja cette table — et le worker qui l''ecrit
   est celui qui ecrit deja la ligne. Une table de plus aurait impose une seconde ecriture dans
   la meme transaction pour la meme personne.
   PAS UNE VUE : une vue recalculee a chaque envoi balaierait la file entiere, et le compteur
   doit etre POUSSE vers Brevo, donc materialise.
   marketing_counters_at dit QUAND la fenetre a ete recalculee : un compteur glissant qu''on ne
   sait pas dater ne se distingue pas d''un compteur fige.';

comment on column leads.contact_sync_states.last_marketing_sent_at is
  'Un contact hors cadence est ECARTE AUTOMATIQUEMENT, et c''est un cas normal (16 RG81) :
   l''ecartement est journalise, il n''apparait JAMAIS dans les echecs, et il n''existe aucun
   bouton « envoyer quand meme ».
   Les scenarios de nurturing automatiques comptent dans la cadence (16 RG83) : un e-mail parti
   sans passer par le backoffice reste un e-mail recu par la personne.';
```

#### `leads.transactional_sends` — le journal des transactionnels hors mise en relation (`16` écart 4)

> **`matching.introduction_emails` ne couvre que la mise en relation.** `16` RG94 exige que le
> `messageId` soit conservé pour **tout** e-mail transactionnel — à commencer par le **code de
> connexion**, qui est depuis **D37** le moyen d'authentification des membres. Quand quelqu'un dit
> « je n'ai pas reçu mon code », il n'existait **aucune ligne à interroger**.

*Table du **Lot 1** — elle arrive avec le premier e-mail transactionnel, donc avec l'inscription.
**Append-only** sur tout ce qui décrit l'envoi ; seules les colonnes d'accusé sont écrites après.*

| Colonne | Type | Contrainte |
|---|---|---|
| `id` | `bigint` | `generated always as identity` |
| `email_code` | `text` | `not null` — le code de l'e-mail (`auth.login_code`, `auth.new_device`, `message.notification`…) |
| **`priority`** | `leads.send_priority` | `not null` — **`p0` · `p1` · `p2`**. `p0` = **le code de connexion**, que l'interrupteur d'urgence ne coupe jamais (`16` RG122) |
| `account_id` | `uuid` | FK, **nullable** — un destinataire n'est pas toujours un compte |
| `recipient_email` | `text` | **Nullable et renseignée uniquement si `account_id` est nul** — même doctrine que `email_send_recipients` |
| `locale` | `char(2)` | `not null` FK `reference.languages` |
| `template_ref` | `text` | FK `backoffice.email_templates` |
| `template_version` | `integer` | **Copiée** (R7) : la version envoyée, pas la version actuelle |
| `outbox_event_id` | `uuid` | FK `leads.outbox_events(id)` |
| **`provider_message_id`** | `text` | `unique` — **le `messageId` de RG94** |
| `status` | `matching.email_status` | `not null default 'queued'` — même type que le journal de mise en relation |
| `sent_at`, `delivered_at`, `failed_at` | `timestamptz` | Chronologie contrôlée |
| `failure_code` | `text` | `check ((status = 'failed') = (failure_code is not null))` |
| `created_at` | `timestamptz` | `not null` |

```sql
alter table leads.transactional_sends
  add constraint transactional_sends_recipient_xor
      check ((recipient_email is not null) = (account_id is null)),
  add constraint transactional_sends_sent_needs_message_id
      check (status in ('queued','failed') or provider_message_id is not null),
  add constraint transactional_sends_chronology
      check (coalesce(delivered_at, 'infinity') >= coalesce(sent_at, '-infinity'));

-- AL48 : delivrabilite du code de connexion (16 RG98). C'est un incident, pas un indicateur :
-- des gens ne peuvent pas se connecter.
create index transactional_sends_login_code_idx
  on leads.transactional_sends (created_at desc)
  where priority = 'p0';

-- « je n'ai pas recu mon code » : la question posee au support, indexee telle quelle
create index transactional_sends_by_account_idx
  on leads.transactional_sends (account_id, created_at desc)
  where account_id is not null;

comment on table leads.transactional_sends is
  'Journal des e-mails transactionnels HORS mise en relation (16 RG94, ecart 4).
   Meme forme et meme doctrine que matching.introduction_emails (§5.6), et deliberement une
   table distincte : celui-la porte une PREUVE D''INTERMEDIATION rattachee a une introduction et
   conservee comme telle ; celui-ci porte un DIAGNOSTIC D''EXPLOITATION, sans sujet metier commun.
   *** NE CONTIENT JAMAIS LE CORPS, NI L''OBJET, NI — SURTOUT — LE CODE A SIX CHIFFRES. ***
   Le code est un secret d''authentification : il ne se journalise pas, nulle part, jamais
   (03 §Secrets). Ce que cette table sait dire, c''est QU''UN e-mail est parti, QUAND, VERS QUI,
   DANS QUELLE LANGUE, et ce que le prestataire en a fait.
   Depuis D37, c''est la table qui permet de repondre a « je n''ai pas recu mon code » autrement
   que par une supposition.';

comment on column leads.transactional_sends.priority is
  'p0 = code de connexion et alertes critiques internes : JAMAIS coupe par l''interrupteur
   d''urgence (16 RG122), y compris au niveau all_paused.
   p1 et p2 = notifications et e-mails de service, mis EN ATTENTE (jamais perdus) si
   l''interrupteur passe en all_paused.
   NOT NULL SANS DEFAUT : un envoi dont personne n''a decide la priorite ne doit pas exister,
   sans quoi l''interrupteur d''urgence coupe au hasard.';
```

##### **D43 : cette table est un journal, jamais une file** (tranchée le 2026-09-19)

`docs/mvp/02-architecture-3-espaces.md` §18 tranche deux choses qui changent la lecture de cette
table. La première : **le `P0` — le code de connexion — est envoyé de façon synchrone par `apps/api`,
sans passer par `leads.outbox_events`** (D18 reste entière pour `P1` et `P2`). La seconde :
`transactional_sends` est **un journal, et rien d'autre**.

**La sémantique de `status` n'est donc pas celle d'une ligne de file, et c'est écrit en base :**

```sql
comment on column leads.transactional_sends.status is
  'ATTENTION — LA SEMANTIQUE DIFFERE DE CELLE D''UNE LIGNE DE FILE (D43, 02 §18.8).
   queued  = *** TENTATIVE ENGAGEE, ISSUE INCONNUE ***, et NON « en attente d''un traitement ».
             Personne ne viendra prendre cette ligne : il n''existe aucun consommateur.
             Une ligne P0 restee queued plus de quelques minutes signale un PROCESSUS INTERROMPU
             AU MILIEU D''UNE REQUETE. C''est un INDICATEUR D''EXPLOITATION, jamais un
             declencheur de reprise.
   sent    = accepte par Brevo, provider_message_id renseigne.
   failed  = refuse, expire, ou disjoncteur ouvert ; failure_code renseigne (liste fermee).
   delivered = ecrit PLUS TARD par le webhook Brevo consomme par le worker. C''est la SEULE
             ecriture asynchrone sur cette table, et elle ne porte que les colonnes d''accuse.
   Ce qui ne doit jamais attendre, c''est l''ENVOI ; la CONFIRMATION d''un envoi deja parti,
   elle, arrive par le chemin ordinaire.';

comment on table leads.transactional_sends is
  'Journal des e-mails transactionnels HORS mise en relation (16 RG94, ecart 4).
   *** CE N''EST PAS UNE FILE (D43, 02 §18.8). *** Le seul mecanisme de file du projet est
   leads.outbox_events (D18) ; un second mecanisme ne par glissement d''un journal serait un
   mecanisme que personne n''a concu, supervise ni teste.
   SONT INTERDITS SUR CETTE TABLE, et leur absence se verifie en relisant le code :
     - tout SELECT ... FOR UPDATE, SKIP LOCKED ou verrou consultatif ;
     - tout index destine a PRENDRE du travail, en particulier sur status ;
     - toute boucle de worker qui LIT cette table pour decider d''un envoi ;
     - tout reessai declenche depuis cette table (G2, 05 RG60, test T10) ;
     - tout bouton « rejouer » au backoffice sur une ligne P0 — rejouer, c''est renvoyer un code
       que personne n''attend plus ; la personne redemande, elle seule.
   Meme forme que matching.introduction_emails (§5.6) et deliberement distincte : celle-la porte
   une PREUVE D''INTERMEDIATION, celle-ci un DIAGNOSTIC D''EXPLOITATION.
   NE CONTIENT JAMAIS LE CORPS, NI L''OBJET, NI — SURTOUT — LE CODE A SIX CHIFFRES :
   un secret d''authentification ne se journalise nulle part, jamais (03 §Secrets).
   Depuis D37, c''est la table qui permet de repondre a « je n''ai pas recu mon code »
   autrement que par une supposition.';
```

**Les trois causes d'échec d'un `P0`, en liste fermée** — correspondance **exacte** avec `05` RG60,
parce que ce sont les trois messages distincts que la personne voit à l'écran :

| `failure_code` | Cause `05` RG60 | Ce qu'elle révèle (`02` §18.5 R3) |
|---|---|---|
| **`undeliverable_address`** | **(a)** adresse non délivrable | Une propriété **de l'adresse**, et seulement sur un **refus du fournisseur portant sur l'adresse** — on ne consulte **jamais** `email_status` ni les incidents **avant** d'envoyer, un contrôle préalable ferait de notre état interne un oracle |
| **`provider_unavailable`** | **(b)** service d'envoi indisponible | Un état **global**, identique pour tout le monde. Couvre aussi le **disjoncteur ouvert** et le dépassement du délai d'attente (G1) |
| **`rate_limited`** | **(c)** plafond de demandes atteint | Une propriété **du demandeur**. **Cette valeur n'apparaît quasiment jamais dans le journal** : une demande plafonnée n'écrit **aucune ligne** (ci-dessous) |

```sql
alter table leads.transactional_sends
  add constraint transactional_sends_p0_failure_codes
      check (priority <> 'p0'
             or failure_code is null
             or failure_code in ('undeliverable_address','provider_unavailable','rate_limited'));

comment on constraint transactional_sends_p0_failure_codes on leads.transactional_sends is
  'Trois causes, et trois seulement, en correspondance EXACTE avec 05 RG60 : ce sont les trois
   messages distincts affiches a la personne. Un message generique unique serait une faute —
   il la laisserait essayer indefiniment (RG60).
   Les trois sont des proprietes de l''ADRESSE, du DEMANDEUR ou du FOURNISSEUR : aucune ne
   depend de l''existence, du role, de l''etat ni de l''historique d''un compte (02 §18.5,
   03 A-5). C''est ce qui rend l''invariant anti-enumeration testable.
   Une quatrieme valeur ajoutee ici sans relire 05 RG60 serait un oracle de plus.';
```

> **Aucun index sur `status`, et c'est une décision, pas un oubli.** `02` §18.8 l'interdit
> nommément : **un index de prise est une file qui s'ignore**. Le jour où quelqu'un ajoute
> `create index ... on transactional_sends (status) where status = 'queued'`, la table a déjà
> changé de nature — il ne manque plus que la boucle qui la lit. Les **deux** index de cette table
> sont des index de **lecture** : `priority = 'p0'` pour l'alerte **AL48**, et
> `(account_id, created_at desc)` pour le support. La surveillance des lignes `queued` anciennes est
> un **indicateur**, calculé par le contrôle nocturne sur la fenêtre des dernières 24 heures — un
> balayage de quelques centaines de lignes, sans index.

**La clé d'idempotence de `16` RG89 n'ajoute aucune colonne.** Le code de connexion appartient à la
famille « une fois par **occurrence** » : sa clé est **`auth.login_code:<id de la ligne de journal>`**
— l'identifiant `bigint` de la ligne écrite **avant** l'appel à Brevo. Deux demandes de code
produisent deux lignes, donc deux clés, donc **deux e-mails, et c'est voulu** (`16` RG89, point 2).
La « double ceinture » de RG90 est ici asymétrique et il faut le dire : la ceinture locale est
l'**unicité de `provider_message_id`** (qui protège l'accusé de réception), l'en-tête
`Idempotency-Key` protégeant l'appel lui-même. Il n'existe **pas** de contrainte d'unicité sur
« une occurrence », et il ne doit pas y en avoir : elle empêcherait la seconde demande légitime.

#### `identity.auth_request_throttle` — les compteurs de débit, que le journal ne remplace pas

> **Conséquence directe de D43, et elle manquait.** Une demande **plafonnée** (cause (c)) n'appelle
> pas Brevo, donc **n'écrit aucune ligne** dans `transactional_sends` : c'est cohérent — on ne
> journalise pas un envoi qui n'a pas eu lieu — mais cela rend l'indicateur « **demandes sans
> connexion aboutie** » faux si on le calcule sur le seul journal. Les demandes refusées au plafond
> en sont **absentes par construction**, et ce sont précisément celles qu'un abus produit en masse.
> Les plafonds de `05` RG44 n'avaient par ailleurs **aucun support en base**.

*Table du **Lot 1**, à **durée de vie courte** : c'est un compteur d'exploitation, pas un historique.*

| Colonne | Type | Contrainte |
|---|---|---|
| `scope` | `identity.throttle_scope` | `not null` — **`email`** · **`ip`** (les deux niveaux de `05` RG44) |
| **`scope_key_hash`** | `bytea` | `not null` — **empreinte** de l'adresse normalisée ou de l'IP, **jamais la valeur en clair** |
| `window_code` | `text` | `not null check (window_code in ('15m','1h'))` — 3 par 15 min et 10 par heure pour une adresse, 20 par heure pour une IP |
| `window_started_at` | `timestamptz` | `not null` |
| `request_count` | `smallint` | `not null default 0 check (request_count >= 0)` |
| **`denied_count`** | `smallint` | `not null default 0` — **les demandes refusées au plafond**, celles qui n'existent nulle part ailleurs |
| `failed_verification_count` | `smallint` | `not null default 0` — le second plafond par IP de RG44 |
| `last_request_at` | `timestamptz` | `not null` |
| `expires_at` | `timestamptz` | `not null` — purge automatique |

```sql
alter table identity.auth_request_throttle
  add constraint auth_throttle_pk
      primary key (scope, scope_key_hash, window_code);

create index auth_request_throttle_expiry_idx
  on identity.auth_request_throttle (expires_at);

comment on table identity.auth_request_throttle is
  'Compteurs de debit de la demande de code de connexion (05 RG44, trois niveaux).
   POURQUOI UNE TABLE PLUTOT QU''UN CALCUL SUR LE JOURNAL : une demande plafonnee n''ecrit
   AUCUNE ligne dans leads.transactional_sends (aucun envoi n''a eu lieu), et une demande
   refusee avant appel non plus. Compter les abus sur le journal reviendrait donc a compter
   exactement ce qui n''y est pas. denied_count est la seule trace chiffree d''un abus.
   L''INDICATEUR « demandes sans connexion aboutie » SE LIT SUR LES DEUX SOURCES :
   le journal pour les envois partis, ces compteurs pour les demandes refusees.
   *** AUCUNE ADRESSE, AUCUNE IP EN CLAIR. *** scope_key_hash est une empreinte calculee avec un
   poivre serveur : une table de compteurs en clair serait un annuaire des adresses sollicitees,
   y compris celles qui n''ont jamais de compte (02 §18.5 R1 : un utilisateur GoTrue est cree
   inconditionnellement, donc toute adresse essayee passe ici).
   L''egalite de traitement (03 A-5) impose que ces compteurs soient lus et ecrits de la meme
   facon pour une adresse connue et une adresse inconnue.';

comment on column identity.auth_request_throttle.denied_count is
  'Un depassement de plafond N''INVALIDE JAMAIS le code en cours et ne bloque jamais un compte
   (05 RG45) : il empeche seulement l''envoi d''un NOUVEAU code. Le blocage vise l''attaquant,
   jamais la victime — sinon demander des codes en boucle suffirait a empecher quelqu''un de se
   connecter.
   RESERVE D''EXPLOITATION (02 §18.5) : un echec de cause (b), panne du fournisseur, ne doit PAS
   consommer le quota par ADRESSE — sinon une panne de trois minutes verrouille un quart d''heure
   ceux qui ont eu la mauvaise idee de reessayer, et la panne survit a la panne. Il consomme en
   revanche le quota par IP, qui est l''anti-abus. Point soumis a expert-cybersecurite (§12.10).';
```

**Durée de vie : 30 jours**, par `expires_at`, purgée avec les autres (§9.3). Au-delà, un compteur
de fenêtre glissante n'a plus aucun usage — et le conserver reviendrait à garder l'empreinte
d'adresses que nous ne connaissons pas.

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

#### `billing.deals` — le pipeline commercial (**table créée au Lot 4**, écrans au Lot 5)

> **Avancée du Lot 5 au Lot 4 le 2026-09-19** (arbitrage `chef-de-projet`). L'affaire est créée
> **dans la transaction de révélation**, à l'état `open` (§5.6) : la table doit donc exister avant
> `matching.reveal_identity()`, c'est-à-dire à la migration **`0402a`**. Ce qui reste au Lot 5 est
> le **produit** — écrans du pipeline, saisie et validation des montants, exports. La table,
> ses transitions, ses motifs de perte et son historique de montants, eux, arrivent au Lot 4.
>
> **Ce que porte une affaire à l'état `open` :** `introduction_id`, `owner_agent_id`, `revealed_at`
> et `state`, **tous copiés de la mise en relation** dans la même transaction. Aucun montant, aucune
> devise, aucune date de contrat — et aucune contrainte relâchée pour autant : les contraintes de
> cette table sont **par état** (ci-dessous), et aucune ne s'applique à `open`.

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
| `negotiated_amount_minor` | `bigint` | **`check (negotiated_amount_minor is null or negotiated_amount_minor >= 0)`** — **zéro autorisé** (`14` E4, ci-dessous) |
| **`non_monetary_reason_code`** | `text` | FK `billing.non_monetary_reasons`, obligatoire si le montant vaut zéro (`14` E4) |
| `agreed_commission_amount_minor` | `bigint` | `check (… >= 0)` |
| `agreed_commission_note` | `text` | Texte libre (« barème standard 35 % »), **jamais un taux exploité par le code** |
| **`commission_payer`** | `billing.commission_payer` | `advertiser` · `creator` · `both` — **qui règle la commission** (`14` E8) |
| **`advertiser_share_amount_minor`** | `bigint` | **Saisie**, jamais dérivée d'un taux (`14` E8) |
| **`creator_share_amount_minor`** | `bigint` | Idem. Contrôle d'**addition** ci-dessous |
| **`amount_tax_basis`** | `billing.tax_basis` | `hors_taxes` · `taxes_comprises` · `inconnue` — base fiscale du **montant de la collaboration** (`14` E7) |
| **`commission_tax_basis`** | `billing.tax_basis` | Idem pour la **commission**. Les deux obligatoires à `signed` |
| `contract_sent_at`, `contract_sent_channel` | — | `email` · `docusign` · `in_person` · `other` |
| `signed_at` | `timestamptz` | — |
| `commission_invoiced_at`, `commission_invoice_ref` | — | Référence de facture **externe** |
| ~~`commission_received_amount_minor`, `commission_received_at`~~ | — | **Supprimées (`14` E1)** : remplacées par `billing.commission_receipts` et deux colonnes **dérivées** ci-dessous |
| **`commission_received_total_minor`** | `bigint` | **Somme dérivée** des règlements, maintenue par déclencheur. **Une addition, jamais un taux** |
| **`commission_last_receipt_on`** | `date` | Date du dernier mouvement, dérivée. Sert aux relances et à l'âge du reste dû |
| ~~`commission_shortfall_note`~~ → **`commission_variance_note`** | `text` | **Renommée (`14` E2)** : la contrainte visait le **trop-perçu**, pas le manque. Voir le commentaire SQL |
| `lost_reason_code`, `lost_at` | — | FK `billing.lost_reasons` |
| **`cancellation_reason_code`**, **`cancelled_at`** | — | FK **`billing.cancellation_reasons`** — l'annulation n'est **pas** un échec commercial (`14` E5) |
| **`stalled_since`** | `timestamptz` | **Attribut, pas état** (`14` E6). Alimenté par la tâche quotidienne |
| **`disputed_since`**, `disputed_note`, **`disputed_resolved_at`** | — | **Attributs, pas état** (`14` E6) : un litige ne doit **jamais** effacer l'information « signé » |
| **`estimated_external_amount_minor`** | `bigint` | **Montant estimé de la *collaboration* conclue hors INFLUX** — jamais d'une commission (`14` E9) |
| **`estimated_confidence`** | `billing.estimate_confidence` | `faible` · `moyenne` · `elevee` |
| **`estimated_source`** | `text` | D'où vient l'estimation (déclaration, capture publique, dire du commercial) |
| `created_at`, `updated_at` | `timestamptz` | `not null` |

Les contraintes financières, **toutes déclaratives** :

```sql
alter table billing.deals
  add constraint deals_amount_needs_currency
      check (num_nonnulls(negotiated_amount_minor, agreed_commission_amount_minor,
                          advertiser_share_amount_minor, creator_share_amount_minor) = 0
             or currency is not null),
  add constraint deals_commission_within_amount
      check (agreed_commission_amount_minor is null
             or negotiated_amount_minor is null
             or agreed_commission_amount_minor <= negotiated_amount_minor),

  -- 14 E8 : les deux parts SAISIES font la commission convenue. Une ADDITION, pas un taux.
  add constraint deals_shares_sum_to_commission
      check (num_nonnulls(advertiser_share_amount_minor, creator_share_amount_minor) = 0
             or agreed_commission_amount_minor is null
             or coalesce(advertiser_share_amount_minor, 0)
              + coalesce(creator_share_amount_minor, 0) = agreed_commission_amount_minor),
  add constraint deals_payer_matches_shares
      check (commission_payer is null
             or (commission_payer = 'advertiser' and coalesce(creator_share_amount_minor, 0) = 0)
             or (commission_payer = 'creator'    and coalesce(advertiser_share_amount_minor, 0) = 0)
             or  commission_payer = 'both'),

  -- 14 E1 + E2 : le total encaisse est une SOMME DERIVEE ; seul le TROP-PERCU exige une note
  add constraint deals_received_within_agreed
      check (commission_received_total_minor is null
             or agreed_commission_amount_minor is null
             or commission_received_total_minor <= agreed_commission_amount_minor
             or commission_variance_note is not null),

  -- 14 E4 : montant nul = contrepartie non monetaire, et il faut dire laquelle
  add constraint deals_zero_amount_needs_reason
      check (negotiated_amount_minor is null
             or negotiated_amount_minor > 0
             or non_monetary_reason_code is not null),

  -- 14 E7 : les deux bases fiscales sont obligatoires des la signature
  add constraint deals_signed_requires_tax_basis
      check (state <> 'signed'
             or (amount_tax_basis is not null and commission_tax_basis is not null)),

  -- 14 E9 : l'estimation de contournement ne vit qu'avec son motif de perte
  add constraint deals_estimate_requires_lost_reason
      check (estimated_external_amount_minor is null
             or (lost_reason_code = 'conclu_hors_influx'
                 and estimated_confidence is not null
                 and estimated_source is not null)),

  add constraint deals_signed_after_reveal
      check (signed_at is null or signed_at >= revealed_at),
  add constraint deals_chronology
      check (coalesce(commission_invoiced_at, 'infinity') >= coalesce(signed_at, '-infinity')),

  -- 14 E6 : litige et enlisement sont des ATTRIBUTS, avec leur propre chronologie
  add constraint deals_dispute_chronology
      check (disputed_resolved_at is null
             or (disputed_since is not null and disputed_resolved_at >= disputed_since)),

  -- champs obligatoires par etat (document 01 §6.1)
  add constraint deals_negotiating_requires_amount
      check (state <> 'negotiating' or (negotiated_amount_minor is not null and currency is not null)),
  add constraint deals_contract_sent_requires_channel
      check (state <> 'contract_sent' or (contract_sent_at is not null and contract_sent_channel is not null)),
  add constraint deals_signed_requires_commission
      check (state <> 'signed' or (signed_at is not null and negotiated_amount_minor is not null
             and agreed_commission_amount_minor is not null)),
  add constraint deals_lost_requires_reason
      check (state <> 'lost' or lost_reason_code is not null),
  -- 14 E5 : l'annulation a sa propre liste de motifs
  add constraint deals_cancelled_requires_reason
      check (state <> 'cancelled' or (cancellation_reason_code is not null and cancelled_at is not null));

comment on column billing.deals.commission_variance_note is
  'Ex-commission_shortfall_note, RENOMMEE le 2026-09-19 (14 E2).
   L''ancien nom decrivait l''INVERSE de ce que la contrainte controle : shortfall = manque,
   alors que deals_received_within_agreed ne se declenche QUE sur le TROP-PERCU
   (total encaisse > commission convenue). Un encaissement partiel, lui, est normal et attendu :
   c''est le cas standard du reglement en deux fois par deux payeurs (14 RG55).
   Un nom trompeur sur une contrainte financiere finit toujours par etre mal lu.';

comment on column billing.deals.commission_received_total_minor is
  'SOMME DERIVEE des lignes de billing.commission_receipts, maintenue par declencheur.
   Une addition de montants en unites mineures n''est PAS un calcul de commission :
   aucun taux, aucune multiplication, aucun arrondi (CLAUDE.md §3, controle T16).
   Colonne de lecture : personne ne l''ecrit a la main, et REVOKE UPDATE l''interdit.';

comment on column billing.deals.amount_tax_basis is
  'Base fiscale du montant de la collaboration : hors_taxes, taxes_comprises, ou inconnue
   (14 E7, RG33). SAISIE, jamais deduite. DONNEE IRRECUPERABLE APRES COUP : personne ne saura,
   dans six mois, si le 2 000 note en mars etait HT ou TTC. C''est la seule matiere qui rendra
   D7 et D23 instruisables sur des cas reels plutot que sur des hypotheses.
   inconnue est autorisee AVANT la signature et interdite apres (deals_signed_requires_tax_basis).';

comment on column billing.deals.estimated_external_amount_minor is
  'Montant estime de la COLLABORATION conclue hors INFLUX (14 E9, RG95).
   *** JAMAIS UNE COMMISSION, JAMAIS CONVERTI EN CREANCE. *** Aucun taux ne lui est applique,
   nulle part. C''est une mesure du contournement, pas une facture : l''y transformer serait
   reclamer une somme sur une imputation non prouvee.
   N''existe qu''avec lost_reason_code = ''conclu_hors_influx'', son niveau de confiance et sa
   source. Donnee personnelle indirecte : conservation a trancher (D29, 14 Q11, §12.7).';

comment on column billing.deals.disputed_since is
  'ATTRIBUT, PAS ETAT (14 E6). Une affaire signee en litige reste SIGNEE : faire de disputed
   un etat effacerait l''information la plus importante de la ligne — qu''un contrat existe.
   Meme raisonnement pour stalled_since, alimente par la tache quotidienne.
   billing.deal_state ne contient donc NI stalled NI disputed, contrairement a 01 §6.1.';
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

##### Les états de l'affaire, corrigés par `14` (E5 et E6)

```sql
create type billing.deal_state as enum
  ('open', 'negotiating', 'contract_sent', 'signed',
   'commission_invoiced', 'commission_received', 'lost', 'cancelled');
```

Deux corrections, et elles vont dans des sens opposés :

- **`cancelled` entre** (`14` E5). Sans lui, une collaboration annulée après signature — voire après
  encaissement — se rangeait dans `lost`, c'est-à-dire parmi les **échecs commerciaux**. Ce n'en est
  pas un : le commercial a fait son travail, et confondre les deux fausse le seul indicateur de
  transformation du pilote. `billing.cancellation_reasons` est **distincte** de `billing.lost_reasons`
  pour la même raison qu'il y a deux listes de refus au §5.6 : *« ils se sont désistés »* et *« je
  n'ai pas conclu »* ne se comptent pas ensemble.
- **`stalled` et `disputed` sortent** (`14` E6). `01` §6.1 les traitait comme des états ; ce sont des
  **attributs**. Une affaire signée en litige reste signée — la faire basculer dans un état `disputed`
  effacerait l'information la plus importante de la ligne, et il faudrait ensuite *deviner* où elle
  revient quand le litige se règle. Ils deviennent `stalled_since`, `disputed_since`,
  `disputed_note`, `disputed_resolved_at`.

**`billing.cancellation_reasons`** : `code` PK, `label_key`, `applies_after_signature boolean`,
`requires_comment`, `sort_order`, `is_active`. Codes du MVP : `desistement_marque` ·
`desistement_createur` · `campagne_annulee` · `accord_non_trouve_apres_signature` ·
`force_majeure` · `erreur_de_saisie` · `other`.

**`billing.non_monetary_reasons`** (`14` E4) : `code` PK, `label_key`, `requires_comment`,
`sort_order`, `is_active`. Codes : `dotation_produit` · `echange_de_visibilite` ·
`collaboration_test` · `other`.

```sql
comment on table billing.non_monetary_reasons is
  'Pourquoi une collaboration a un montant nul (14 E4). Le cas est reel — dotation produit,
   echange de visibilite — et la contrainte stricte > 0 le bloquait purement et simplement.
   Le montant passe a >= 0 AVEC un motif typé obligatoire : autoriser zero sans exiger de dire
   pourquoi aurait ouvert la porte au zero par negligence, qui est indistinguable a la lecture.
   Une affaire a zero ne produit aucune commission : c''est une donnee de marche, pas un revenu.';
```

#### `billing.commission_receipts` — un encaissement n'est pas un événement unique (`14` E1, **bloquant**)

> **C'est l'écart le plus grave signalé par `14`.** `billing.deals` portait
> `commission_received_amount_minor` et `commission_received_at` : **une seule ligne d'encaissement**.
> Or le **cas standard** du pilote est un règlement **en deux fois par deux payeurs** — l'annonceur
> règle sa part, le créateur la sienne (`14` RG55, `CLAUDE.md` §3). Le second encaissement **écrasait
> le premier**, en silence, sur la donnée la plus sensible du produit. S'y ajoutent les
> remboursements et les abandons de créance, qui n'avaient nulle part où exister.

*Table du **Lot 5**, **append-only** (`REVOKE UPDATE, DELETE` + déclencheur). Une correction n'écrase
pas une ligne : elle en ajoute une, de sens inverse — c'est la règle d'une écriture comptable.*

| Colonne | Type | Contrainte |
|---|---|---|
| `id` | `uuid` | PK |
| `deal_id` | `uuid` | `not null references billing.deals(id)` |
| `kind` | `billing.receipt_kind` | `not null` — `paiement` · `remboursement` · `abandon_de_creance` |
| `amount_minor` | `bigint` | `not null check (amount_minor > 0)` — **toujours positif** ; c'est `kind` qui porte le sens |
| `currency` | `char(3)` | `not null` FK, **égale à celle de l'affaire** (déclencheur) |
| `payer_side` | `matching.party_side` | Qui a réglé — **la colonne qui rend le règlement en deux fois lisible** (`14` E1) |
| `received_on` | `date` | `not null` — **date civile** : un règlement bancaire est daté du jour, pas de la seconde (§3, R4) |
| `payment_method` | `billing.payment_method` | `not null` — `virement` · `carte` · `cheque` · `especes` · `compensation` · `autre` |
| `external_ref` | `text` | Référence de rapprochement (relevé, virement). `check (length(external_ref) <= 140)` |
| `note` | `text` | `check (length(note) <= 1000)`, **obligatoire** sur `remboursement` et `abandon_de_creance` |
| `recorded_by_account_id` | `uuid` | `not null` FK interne — **l'auteur réel de la saisie** |
| `recorded_at` | `timestamptz` | `not null default now()` |

```sql
alter table billing.commission_receipts
  add constraint receipts_reason_required
      check (kind = 'paiement' or length(btrim(coalesce(note, ''))) >= 10),
  -- 14 Q2 : les especes sont interdites pendant le pilote, mais restent SAISISSABLES
  -- pour enregistrer un fait deja survenu. C'est l'exploitation qui interdit, pas le schema.
  add constraint receipts_cash_is_flagged
      check (payment_method <> 'especes' or length(btrim(coalesce(note, ''))) >= 10);

create index commission_receipts_by_deal_idx
  on billing.commission_receipts (deal_id, received_on);

comment on table billing.commission_receipts is
  'Mouvements de commission d''une affaire (14 E1). APPEND-ONLY : une erreur se corrige par une
   ligne de sens inverse, jamais par une modification — c''est la regle d''une ecriture comptable,
   et c''est ce qui rend l''historique opposable.
   PLUSIEURS LIGNES PAR AFFAIRE, C''EST LE CAS NOMINAL : l''annonceur regle sa part, le createur
   la sienne (CLAUDE.md §3, 14 RG55). L''ancienne paire de colonnes sur billing.deals rendait ce
   cas standard IMPOSSIBLE sans perte de donnee.
   AUCUN TAUX, AUCUNE MULTIPLICATION : le total sur l''affaire est une addition.';

comment on column billing.commission_receipts.amount_minor is
  'TOUJOURS POSITIF. Le sens du mouvement est porte par kind, jamais par le signe : un montant
   negatif se lit mal, se somme mal, et se saisit mal. Le total de l''affaire vaut
   sum(paiement) - sum(remboursement) - sum(abandon_de_creance).';
```

**Le total sur l'affaire est une somme, et c'est tout.** Un déclencheur `AFTER INSERT` recalcule
`deals.commission_received_total_minor` et `commission_last_receipt_on`. On pourrait s'en passer et
faire la somme à la lecture ; la colonne existe parce que **la relance J+30 et l'indicateur n° 1 la
lisent sur toutes les affaires à la fois** (§10.7), et parce que la contrainte de trop-perçu doit
être **déclarative**.

```sql
-- 14 E10 : « signee sans facture » et « facturee sans encaissement » sont DERIVABLES.
-- Un index partiel suffit ; une colonne « facture manquante » serait une verite dupliquee.
create index deals_signed_without_invoice_idx
  on billing.deals (signed_at)
  where state = 'signed' and commission_invoice_ref is null;

create index deals_invoiced_unpaid_idx
  on billing.deals (commission_invoiced_at)
  where commission_invoiced_at is not null
    and (commission_received_total_minor is null
         or commission_received_total_minor < agreed_commission_amount_minor);
```

> **L'exception unique au contrôle T16** (`14` E11). Le contrôle d'intégration continue T16 échoue
> sur **toute multiplication d'un montant par une constante** dans `apps/` et `packages/`. Il existe
> **une** exception légitime, et une seule : la **conversion d'unité monétaire** entre la saisie
> décimale d'un écran et le `bigint` en unités mineures — `2 000,00 EUR` ↔ `200000`, le facteur
> venant de `reference.currencies.minor_unit`, **jamais d'un littéral**. Cette conversion vit dans
> **une fonction unique de `packages/domain`**, annotée, testée, et **exemptée nommément** du
> contrôle. Sans exemption nommée, l'équipe désactivera T16 — et un contrôle désactivé ne protège
> rien. **À porter dans `03` §8 T16 par `expert-cybersecurite` et dans le plan de test de
> `testeur`** (§12.7).

#### `billing.deal_field_changes`

*Toute modification d'un montant ou d'une date est historisée : qui, quand, ancienne valeur, nouvelle
valeur.* Écrite par un **déclencheur**, pas par le code applicatif — c'est ce qui la rend
incontournable.

`id bigint identity`, `deal_id`, `field_name text not null`, `old_value text`, `new_value text`,
`changed_by_account_id not null`, `changed_at not null`, **`is_financial_field boolean generated
always as stored`**, `reason text`.

Append-only. « Un montant écrasé sans trace est un montant perdu » (document `01` §6.2).

**Le motif devient obligatoire sur les champs financiers** (`14` E3). Il était facultatif partout,
ce qui revenait à autoriser la correction silencieuse d'un montant déjà saisi — exactement ce que
cette table est censée empêcher :

```sql
alter table billing.deal_field_changes
  add column is_financial_field boolean
    generated always as (field_name in (
        'negotiated_amount_minor', 'agreed_commission_amount_minor',
        'advertiser_share_amount_minor', 'creator_share_amount_minor',
        'currency', 'amount_tax_basis', 'commission_tax_basis',
        'commission_payer', 'signed_at', 'commission_invoiced_at')) stored,

  add constraint deal_field_changes_financial_needs_reason
      check (not is_financial_field or length(btrim(coalesce(reason, ''))) >= 10);

comment on column billing.deal_field_changes.is_financial_field is
  'Colonne GENEREE : la liste des champs financiers est dans la definition, pas dans le code
   applicatif — un declencheur qui oublierait un champ ne pourrait pas contourner la contrainte.
   Ajouter un champ financier demain = une migration relue, et c''est voulu (14 E3).';

comment on column billing.deal_field_changes.reason is
  'FACULTATIF sur les champs non financiers, OBLIGATOIRE (10 caracteres au moins) sur les
   montants, la devise, les parts, les bases fiscales, le payeur et les dates de signature et de
   facturation. Corriger un montant sans dire pourquoi est indistinguable d''une falsification
   six mois plus tard (15, point 3 des ecarts ; 09 RG94).';
```

---

### 5.10 `backoffice` — pilotage interne

| Table | Rôle | Lot |
|---|---|---|
| `backoffice.ownership_assignments` | **Historique des commerciaux responsables successifs.** `account_id` / `introduction_id` / `deal_id` nullables avec `check (num_nonnulls(...) = 1)`, `agent_account_id`, `assigned_at`, `unassigned_at`, `assigned_by_account_id`, `reason_code`. `backoffice-ops` règle 18 : l'historique est conservé, pas écrasé | 0 |
| **`backoffice.queues`** | **Le catalogue des files** (`15` RG26, RG29) : `queue_code` **PK**, `label_key`, `spec_document` (le document qui fait autorité), `handled_by_roles text[]`, `allows_bulk_action boolean`, `has_lock boolean`, `is_active`, `introduced_at`, `retired_at`. **Sans elle, « une file absente du catalogue n'existe pas » est un vœu** : c'est cette table qui rend la règle vérifiable | **1** |
| `backoffice.sla_policies` | **`queue_code` PK, désormais `references backoffice.queues(code)`**, `target_claim_minutes`, `target_decision_minutes`, `business_hours jsonb`, `escalate_after_minutes`, `is_active`. **D39 tranchée : décision sous 1 jour ouvré.** Valeur de départ chargée par la migration `0102` — `target_decision_minutes = 480` (un jour ouvré de 8 h), `escalate_after_minutes = 480`, `business_hours` couvrant du lundi au vendredi. **Le délai reste une donnée, pas une constante** : le resserrer sera une mise à jour de ligne. **Quatre files ont un délai différent** (`15` RG29, ci-dessous) | 1 |
| **`backoffice.alert_definitions`** | **Le catalogue des 41 alertes AL1 à AL41** (`15` §F) : `code` **PK**, `label_key`, `nature` (`etat` · `evenement`, `15` RG64), `threshold_value jsonb`, `recipient_role`, `source_document`, `is_active`. Les seuils sont des **données** : les 41 alertes vivaient jusqu'ici en requêtes éparpillées dans dix documents | **1** |
| **`backoffice.alert_closure_reasons`** | Motifs de classement d'une alerte d'événement (`15` RG69) : `traitee` · `sans_suite` · `faux_positif` · `doublon` · `other` (commentaire obligatoire). `code` PK, `label_key`, `requires_comment`, `is_active` | **4** |
| **`backoffice.alert_instances`** | **Les alertes d'événement**, celles qui doivent être classées par un humain (`15` RG64, RG69) : `id`, `alert_code` FK, `subject_type`, `subject_id`, `opened_at`, `acknowledged_by_account_id`, `acknowledged_at`, `closed_at`, `closure_reason_code` FK, `closure_comment`. **Les alertes d'état n'ont pas de ligne** : elles se lèvent et se referment seules | **4** |
| **`backoffice.dual_control_requests`** | **Les demandes de seconde validation** (`03` PD4, `15` RG31, file 15) : `id`, `action_code` (liste fermée), `payload jsonb`, `requested_by_account_id`, `requested_at`, `expires_at`, `state` (`pending` · `confirmed` · `expired` · `cancelled` · `degraded`), `confirmed_by_account_id`, `confirmed_at`, `degraded_justification`. `03` en décrivait les colonnes ; **aucune table ne les portait** | **1** |
| **`backoffice.operational_settings`** | **Les plafonds et délais d'exploitation qui ne sont ni des SLA ni des réglages de recherche**, en clé/valeur à liste fermée (`key text PK check (key in (…))`, `value jsonb`, `updated_by_account_id`, `updated_at`), même régime que `leads.sync_settings` : écriture par fonction `SECURITY DEFINER` réservée à `influx_admin`, chaque modification journalisée. Clés du Lot 3 : `application_caps` (P1 = 10, P2 = 5/jour, P3 = 30, P4 = 1 seconde chance), `campaign_caps` (10 campagnes simultanées, 50 créateurs recherchés), `claim_expiry_minutes` (30), `ownership_code_ttl_days` (7), `badge_grace_days`, `verified_only_enabled` (**faux au lancement**, D38), `campaign_autoclose_days` (30), `application_draft_ttl_days` (30), `unanswered_application_days` (7). **Les six documents de spécification exigent tous la même chose : ces valeurs sont des données, pas des constantes** | 3 |
| `backoffice.internal_notes` | Notes internes **immuables** (on ajoute, on ne corrige pas), rattachées à exactement un sujet. **Complétée (`15`, écart 3) :** **`subject_type`** (`backoffice.note_subject` : `account` · `introduction` · `deal` · `campaign` · `data_subject_request`), `subject_id`, **`author_account_id not null`**, `body` borné, `created_at` — et **`REVOKE UPDATE, DELETE` + `influx.assert_append_only()`** : « immuable » est désormais garanti en base, pas par convention | 5 |
| **`backoffice.suspension_reasons`** | Les **huit** motifs de `15` RG52 : `code` PK, `label_key`, **`message_key`** (le message envoyé au titulaire — **il n'existe aucune suspension muette**), **`requires_admin_escalation boolean`** (vrai sur `suspected_circumvention`), **`discloses_real_reason boolean`** (**faux** sur `suspected_circumvention`, `15` RG53), `requires_comment`, `is_active` | **5** |
| **`backoffice.suspension_lift_reasons`** | Les cinq motifs de `15` RG55 : `erreur_interne` (message avec excuses explicites) · `situation_regularisee` · `decision_revue` · `fin_de_la_mesure` · `other`. `code` PK, `label_key`, `message_key`, `requires_comment`, `is_active` | **5** |
| `backoffice.account_suspensions` | `account_id`, **`reason_code` FK `suspension_reasons`**, `comment`, `started_at`, `ended_at`, `suspended_by`, `lifted_by`, **`lift_reason_code` FK `suspension_lift_reasons`** avec `check ((ended_at is null) = (lift_reason_code is null))`. Le motif **n'est jamais divulgué à l'autre partie** d'une conversation | 5 |
| **`backoffice.exports`** | **Le journal des exports** (`15` RG94 à RG96) : `id`, `export_kind` (`backoffice.export_kind`, liste fermée), `requested_by_account_id`, `requested_at`, `filters jsonb` (**les filtres exacts**), `row_count`, **`file_sha256 bytea not null`**, `storage_path`, `link_expires_at`, `downloaded_at`. **Agrégats seulement**, jamais de ligne nominative (ci-dessous) | **5** |
| `backoffice.email_send_limits` | `(role_code, source)` PK, `max_recipients_per_send`, `max_recipients_per_day`, **`max_sends_per_month`**, **`max_sends_per_domain_90d`**, **`one_solicitation_per_address boolean`** (`16` RG54, RG55). **Les plafonds de D35 sont des données** | 5 |
| **`backoffice.email_templates`** | **La bibliothèque de modèles** (`16` RG65 à RG69) : `template_ref` **PK**, `name`, `nature` (`transactional` · `marketing` · `prospecting`), `version`, `status` (`draft` · `validated` · `retired`), `declared_variables jsonb`, `sender_identity`, **`content_sha256`** (empreinte du contenu validé, **revérifiée avant chaque envoi**), `validated_by_account_id`, `validated_at`, `locales_complete boolean`. **Aucun envoi improvisé n'existe** | **5** |
| **`backoffice.brevo_allowed_segments`** | **La liste fermée des segments envoyables** (`16` RG42) : `brevo_segment_id` **PK**, `name`, `population_note`, `legal_basis`, **`has_cadence_exclusion boolean`**, `declared_by_account_id`, `declared_at`, `is_active`. **Sans elle, n'importe quel segment improvisé chez Brevo devient envoyable en deux clics** | **5** |
| **`backoffice.email_send_transitions`** | Le graphe d'états d'un envoi (`16` RG6), en données, sur le modèle de `billing.deal_state_transitions` : `from_status`, `to_status`, `allowed_actor`, `requires_reason`, `is_active` | **5** |
| `backoffice.email_sends` | `source` (`platform_contacts` · `brevo_segment` · `manual_entry`), `legal_basis`, `created_by_agent_id`, `subject`, **`template_ref` FK `email_templates`**, **`status` en liste fermée de huit valeurs** (`16` RG6), `scheduled_for`, **`cancel_window_ends_at`** (fenêtre d'annulation de 5 min), `confirmed_at`, `confirmed_by_account_id`, `recipient_count` **et son origine** — plus les **onze colonnes ajoutées par `16`**, détaillées ci-dessous | 5 |
| `backoffice.email_send_recipients` | `email_send_id`, `account_id` (nullable), **`email_address` nullable — renseignée pour la seule source `manual_entry`**, `consent_checked_at`, `status`, `provider_message_id`, `skip_reason`. **Unicité réécrite** (`16` écart 1) et **table vide pour `brevo_segment`** (`16` écart 2), ci-dessous | 5 |
| `backoffice.data_subject_requests` | `request_type` (`access` · `rectification` · `erasure` · `portability` · `objection` · `restriction`), `received_at`, `due_at` (= reçu + 30 jours, colonne **générée**), `status`, `handled_by_agent_id`, `completed_at`, `outcome_code`. **Complétée (`15`, écart 4) :** **`requester_account_id` nullable** — *un demandeur n'est pas toujours un membre*, **`requester_email`**, **`channel`** (`self_service` · `email` · `oral_consigne`), **`identity_verified_at`**, **`identity_verification_method`**, **`scope_note`**, **`refusal_reason_code`**, **`response_sent_at`**, **`response_provider_message_id`**, et `outcome_code` en **liste fermée** (`15` RG77 : `satisfaite` · `satisfaite_partiellement` · `refusee` · `sans_objet` · `abandonnee`) | 5 |

**`backoffice.email_sends` est la table la plus sensible du backoffice** : elle porte un risque
juridique direct (A4, D35, veto `expert-conformite-rgpd`). Trois garanties en base :
`check (source <> 'manual_entry' or confirmed_at is not null)` — la saisie libre exige la
confirmation différée ; `check (recipient_count <= …)` contrôlé par déclencheur contre
`email_send_limits` ; et `consent_checked_at not null` sur chaque destinataire de source
`platform_contacts`.

#### `backoffice.email_sends` — les onze colonnes ajoutées par `16` (écarts 7 et 9)

| Colonne | Type | Contrainte |
|---|---|---|
| `status` | `backoffice.email_send_status` | `not null` — **huit valeurs** (`16` RG6) : `draft` · `pending_confirmation` · `scheduled` · `sending` · `sent` · `partially_sent` · `cancelled` · `blocked`. Transitions portées par `email_send_transitions` + déclencheur |
| **`cancelled_at`, `cancelled_by_account_id`, `cancel_reason_code`** | — | `check ((status = 'cancelled') = (cancelled_at is not null))`. Trois causes : annulation humaine, **interrupteur d'urgence**, expiration |
| **`recipient_count_source`** | `backoffice.count_source` | `not null` — **`counted`** (INFLUX a compté) · **`brevo_declared`** (chiffre annoncé par Brevo, `16` RG43) |
| **`recipient_count_at`** | `timestamptz` | Horodatage du comptage — un volume sans date ne veut rien dire |
| **`final_recipient_count`, `final_count_at`** | — | **Le volume recalculé à la fin de la fenêtre d'annulation** (`16` RG28 à RG31, écart 7). L'écart avec `recipient_count` **bloque** l'envoi au-delà du seuil (alerte AL47) |
| **`manual_country_code`** | `char(2)` | FK `reference.countries` — **pays déclaré** de la source 3 |
| **`manual_organisation`** | `text` | L'organisation visée (`16` RG54 : plafond par domaine sur 90 jours) |
| **`manual_reason_code`** | `text` | **Motif codé** de la sollicitation |
| **`manual_reason_text`** | `text` | **Son texte**, `check (length(btrim(manual_reason_text)) >= 20)` (`16` CA, ≥ 20 caractères) |
| **`manual_attestation_at`** | `timestamptz` | La **case d'attestation** cochée, horodatée. Pas un booléen : on veut savoir *quand* |

```sql
alter table backoffice.email_sends
  -- 16 ecart 9 : les cinq champs de la source 3 sont obligatoires SI ET SEULEMENT SI c'est elle
  add constraint email_sends_manual_fields_required
      check ((source = 'manual_entry') = (num_nonnulls(
                manual_country_code, manual_organisation, manual_reason_code,
                manual_reason_text, manual_attestation_at) = 5)),

  -- 16 ecart 2 : le volume d'un segment Brevo est DECLARE par Brevo, jamais compte par nous
  add constraint email_sends_count_source_matches
      check ((source = 'brevo_segment') = (recipient_count_source = 'brevo_declared')),

  -- 16 RG28 a RG31 : rien ne part avant la fin de la fenetre, et le volume est RECALCULE
  add constraint email_sends_final_count_after_window
      check (final_count_at is null
             or (cancel_window_ends_at is not null and final_count_at >= cancel_window_ends_at)),
  add constraint email_sends_sent_requires_final_count
      check (status not in ('sending', 'sent', 'partially_sent')
             or final_recipient_count is not null),

  add constraint email_sends_cancel_is_complete
      check (num_nonnulls(cancelled_at, cancelled_by_account_id, cancel_reason_code) in (0, 3));

comment on column backoffice.email_sends.final_recipient_count is
  'Volume RECALCULE a la fin de la fenetre d''annulation (16 RG28 a RG31, ecart 7).
   AUCUN APPEL SORTANT VERS BREVO PENDANT LA FENETRE : c''est ce qui rend l''annulation reelle,
   et non un simple bouton qui arrive trop tard (15 interdit 10).
   Un ecart de plus de 10 % ou de 50 destinataires avec recipient_count BLOQUE l''envoi
   (status = blocked) et leve AL47 : entre la preparation et l''envoi, une population a change,
   et personne ne doit decouvrir apres coup qu''elle a ecrit a trois fois plus de monde.';

comment on column backoffice.email_sends.recipient_count_source is
  'brevo_declared = chiffre ANNONCE PAR BREVO, non verifie par INFLUX (16 RG43).
   Il doit etre affiche avec cette mention, en toutes lettres. Confondre un chiffre verifie et
   un chiffre declare est la facon la plus simple de croire qu''on maitrise un volume.';

comment on column backoffice.email_sends.manual_reason_text is
  'Pourquoi cette personne precise est sollicitee, ecrit par l''agent, 20 caracteres au moins
   (16, source 3). Ce n''est pas une formalite : l''agent doit pouvoir dire D''OU VIENT
   l''adresse, ce qui exclut l''extraction automatisee, l''achat de fichier, la copie d''un
   annuaire — y compris le notre (03 C(17)) — et l''adresse devinee.
   Avec manual_attestation_at, c''est la seule piece qui documente la base legale d''une
   prospection individuelle le jour ou elle est contestee.';
```

#### `backoffice.email_send_recipients` — cesser de recopier les adresses (`16` écarts 1 et 2)

> **L'incohérence était réelle et je la corrige telle quelle.** `unique (email_send_id,
> email_address)` **obligeait** à recopier l'adresse de chaque destinataire — y compris pour la
> source `platform_contacts`, où la personne **a déjà un compte**. Or `matching.introduction_emails`
> a précisément renoncé à ce geste trois mois plus tôt (« ne contient ni objet, ni corps, ni
> adresse », §5.6). Deux tables voisines, deux doctrines opposées : c'est le genre d'écart qui finit
> par se résoudre du mauvais côté.

```sql
alter table backoffice.email_send_recipients
  alter column email_address drop not null,

  -- l'adresse n'est recopiee QUE la ou il n'existe aucun compte a designer
  add constraint recipients_address_only_for_manual
      check ((email_address is not null) = (account_id is null)),

  -- 16 ecart 2 : un segment Brevo ne produit AUCUNE ligne ici
  add constraint recipients_never_for_brevo_segment
      check (send_source <> 'brevo_segment');

-- unicite sur le compte OU sur l'adresse normalisee, selon ce qui identifie la personne
create unique index email_send_recipients_unique_idx
  on backoffice.email_send_recipients
     (email_send_id, coalesce(account_id::text, lower(email_address)));

comment on column backoffice.email_send_recipients.email_address is
  'NULLE pour platform_contacts : le destinataire est designe par account_id, et son adresse se
   lit sur identity.accounts sous RLS (16 ecart 1). Recopier une adresse qu''on possede deja,
   c''est creer une seconde verite qui divergera au premier changement d''adresse — et une
   surface de fuite de plus dans une table exportable.
   NON NULLE pour manual_entry seulement : il n''existe alors AUCUN compte a designer, et
   l''adresse EST la donnee de l''envoi.
   VIDE pour brevo_segment : aucun destinataire de segment n''entre dans la base INFLUX,
   ni adresse, ni personne, ni compteur individuel (16 RG44).';

comment on constraint recipients_never_for_brevo_segment on backoffice.email_send_recipients is
  'Un segment Brevo ne produit aucune ligne de destinataire (16 RG44, RG49). Les chiffres de cet
   envoi sont des AGREGATS portes par backoffice.email_sends (recipient_count,
   recipient_count_source = brevo_declared). Sans cette contrainte, un developpeur presse
   « completerait » la table en recopiant le segment depuis Brevo — et reconstituerait chez nous
   exactement l''annuaire que RG44 interdit.';
```

`send_source` est une **colonne dénormalisée** de `email_sends.source`, maintenue par déclencheur :
c'est la seule façon d'écrire la contrainte ci-dessus de façon **déclarative** — un `CHECK` ne peut
pas lire la table parente. Quatrième dénormalisation du modèle, et elle est du même type que
`billing.deals.revealed_at` (§10.8) : une copie qui rend une contrainte possible, pas une
optimisation.

#### `backoffice.email_send_limits` — trois plafonds de plus (`16` écart 10, RG54)

| Colonne ajoutée | Valeur de départ `agent` / `admin` | Ce qu'elle empêche |
|---|---|---|
| **`max_sends_per_month`** | 50 / 100 | **Le contournement par accumulation** : dix envois par jour tous les jours font une campagne |
| **`max_sends_per_domain_90d`** | 3 / 3 | Trois personnes d'une même entreprise, **pas tout l'organigramme** |
| **`one_solicitation_per_address`** | `true` | `16` RG55 : **une adresse n'est sollicitée qu'une fois, et jamais relancée** au MVP |

```sql
-- 16 RG55 : la seconde sollicitation d'une meme adresse est REFUSEE, pas deconseillee.
-- Index unique global (tous envois confondus) sur la seule source ou l'adresse existe.
create unique index email_recipients_one_solicitation_idx
  on backoffice.email_send_recipients (lower(email_address))
  where email_address is not null;

comment on index backoffice.email_recipients_one_solicitation_idx is
  'RG55 : aucune relance de prospection au MVP. Une seconde tentative sur la meme adresse echoue
   a l''insertion, et l''ecran affiche la date et l''auteur de la premiere.
   La relance doublerait le risque juridique pour un gain commercial marginal (D35).
   Le jour ou elle sera autorisee, cet index devient partiel sur une fenetre glissante :
   une migration d''une ligne, et une decision explicite — pas un oubli.';
```

#### `backoffice.email_templates` — aucun envoi improvisé (`16` écart 5, RG65 à RG69)

| Colonne | Type | Contrainte |
|---|---|---|
| `template_ref` | `text` | **PK** — référence stable, citée par `email_sends` |
| `name` | `text` | `not null` |
| `nature` | `backoffice.template_nature` | `not null` — `transactional` · `marketing` · `prospecting` |
| `version` | `integer` | `not null` |
| `status` | `backoffice.template_status` | `not null default 'draft'` — `draft` · `validated` · `retired` |
| `declared_variables` | `jsonb` | `not null default '[]'` — les variables que l'envoi peut renseigner, **et aucune autre** |
| `sender_identity` | `text` | `not null` — l'expéditeur, donc le sous-domaine (`16` RG9 : trois flux, trois sous-domaines) |
| **`content_sha256`** | `bytea` | **Empreinte du contenu validé**, `check ((status = 'validated') = (content_sha256 is not null))` |
| `locales_complete` | `boolean` | `not null` — `check (status <> 'validated' or locales_complete)` |
| `validated_by_account_id`, `validated_at` | — | `check ((status = 'validated') = (num_nonnulls(validated_by_account_id, validated_at) = 2))` |

```sql
comment on column backoffice.email_templates.content_sha256 is
  'Empreinte du contenu au moment de la validation (16 RG69). RECALCULEE AVANT CHAQUE ENVOI :
   un modele heberge chez Brevo peut y etre modifie sans qu''INFLUX en sache rien — c''est la
   faiblesse assumee de RG67. En cas d''ecart, l''envoi est REFUSE, le modele repasse en draft,
   et l''alerte AL46 part a l''administrateur. On ne discute pas d''un texte qu''on n''a pas relu.';

comment on column backoffice.email_templates.locales_complete is
  'Parite francais / anglais (16 RG66). Un modele dont une langue manque n''est PAS VALIDABLE,
   donc pas envoyable : la contrainte le rend impossible, pas seulement deconseille.
   C''est la transposition, pour les e-mails, de la parite des cles de traduction verifiee a la
   compilation (D28).';

comment on table backoffice.email_templates is
  'Bibliotheque des modeles (16 RG65). OU VIT LE TEXTE depend de la nature, et ce n''est pas une
   incoherence : transactionnel = fichiers de traduction d''INFLUX, versionnes dans le depot,
   Brevo n''assure que le transport (04 R8) ; marketing et prospection = modeles Brevo,
   references ici — exiger un deploiement pour changer une accroche tuerait l''usage.
   Cette table porte la REFERENCE et la PREUVE dans les deux cas, jamais le corps du message.';
```

#### `backoffice.brevo_allowed_segments` — la liste fermée (`16` écart 6, RG42)

`brevo_segment_id` **PK**, `name`, `population_note`, `legal_basis`, **`has_cadence_exclusion
boolean not null`**, `declared_by_account_id`, `declared_at`, `is_active`, `retired_at`.

```sql
comment on table backoffice.brevo_allowed_segments is
  'Segments Brevo envoyables depuis le backoffice (16 RG42). LISTE FERMEE, alimentee par
   expert-marketing avec l''accord d''expert-conformite-rgpd.
   SANS ELLE, N''IMPORTE QUEL SEGMENT IMPROVISE CHEZ BREVO DEVIENT ENVOYABLE EN DEUX CLICS —
   c''est exactement le trou que l''arbitrage A4 cherchait a fermer.
   has_cadence_exclusion = false rend le segment NON SELECTIONNABLE : sur un segment Brevo, la
   cadence est portee cote Brevo (RG46), et un segment qui ne la porte pas ne l''applique pas.
   C''est le seul endroit du dispositif ou INFLUX delegue une regle qu''il ne peut pas verifier,
   et il le dit a chaque envoi (RG82).';
```

#### L'interrupteur d'urgence (`16` écart 8, RG121) — une clé, pas une table

**Clé `email_kill_switch` dans `backoffice.operational_settings`**, même régime que les autres :
écriture par fonction `SECURITY DEFINER` réservée à `influx_admin`, motif obligatoire, journalisation
nominative (`settings.changed`). Valeur : `{"level": "off" | "marketing_paused" | "all_paused",
"reason": "…", "activated_at": "…", "activated_by": "…"}`.

**Pourquoi une clé de configuration et non une table.** L'interrupteur n'a **ni historique propre, ni
cycle de vie, ni objet rattaché** : c'est un état unique, global, à deux niveaux. Son historique
existe déjà — dans le registre, par `settings.changed`, horodaté et nominatif. Une table
`email_kill_switch` n'aurait jamais contenu qu'une ligne, et il aurait fallu se demander laquelle
fait foi.

> **Ce que la base ne garantit pas, et qu'il faut dire.** `16` RG122 pose que **le code de connexion
> n'est jamais coupé** — même par `all_paused`, qui ne met en attente que P1 et P2. Aucune contrainte
> de base ne peut tenir cette règle : c'est le **worker** qui la tient, en lisant la priorité de
> l'envoi avant l'interrupteur. La base y contribue d'un seul côté, mais il est décisif : la
> **priorité est une colonne obligatoire** du journal transactionnel ci-dessous, donc un envoi sans
> priorité n'existe pas, et un envoi P0 est toujours reconnaissable. Couper P0 fermerait la
> plateforme à tous ses membres pour régler un problème de réputation (D37). **Contrôle attendu du
> document `18`.**

#### `backoffice.queues` — le catalogue qui rend la règle vérifiable (`15`, écart 1)

`15` RG26 : « une file absente du catalogue **n'existe pas** ». Sans table, la phrase est un vœu —
rien n'empêche un développeur de créer une seizième file dans un écran. La clé étrangère
`sla_policies.queue_code → queues.code` la rend **exécutoire** : **une file sans délai est
impossible, et un délai sans file l'est tout autant.**

```sql
alter table backoffice.sla_policies
  add constraint sla_policies_queue_fk
      foreign key (queue_code) references backoffice.queues (code);

comment on table backoffice.queues is
  'Catalogue ferme des files du backoffice (15 RG26, RG29, RG125). Les 16 files du MVP y sont chargees
   par migration, lot par lot : une file arrive avec le lot qui la remplit.
   spec_document nomme le document qui fait autorite sur le CONTENU de la file ; ce modele, lui,
   ne fait autorite que sur la forme. Transposition de la regle de lecture n° 1 de 03 §2.
   CONTROLE ATTENDU (document 18) : toute file servie par apps/backoffice a une ligne ici.';
```

**Quatre files n'ont pas le délai commun d'un jour ouvré** (`15` RG29). Ce sont des **valeurs
d'attente non validées**, chargées comme telles :

| `queue_code` | Délai de décision | Statut |
|---|---|---|
| `verification_disputes` | **5 jours ouvrés** | **Proposition `15` Q2 — non validée** |
| `team_selection` | **1 jour ouvré** | **Proposition `15` Q3 — non validée** |
| `lead_sync_failures` | **2 jours ouvrés**, **aucun verrou** (`15` RG30 : le rejeu est idempotent) | **Proposition `15` Q4 — non validée** |
| `email_delivery_incidents` | **2 jours ouvrés** | **Proposition `15` Q4 — non validée** |
| `data_subject_requests` | **30 jours calendaires** (délai légal), objectif interne 10 jours ouvrés | Délai **légal**, pas une proposition |
| `dual_control_pending` | **24 h**, puis **expiration** (`15` RG31) | Tranché par `15` |

Elles sont marquées `is_provisional = true` dans `sla_policies` — une colonne qui ne coûte rien et
qui empêche qu'une proposition devienne une règle par simple écoulement du temps (§12.7).

**Une seizième file, chargée en amorçage** (`16`, écart 1 avec `15`) : **`email_send_failures`** —
délai **2 jours ouvrés** *(provisoire)*, **aucun verrou** (le rejeu est idempotent, même
raisonnement que `lead_sync_failures`), traitée par `agent` et `admin`, **action de masse autorisée**
(rejeu en lot, plafond 200). Elle est chargée comme les quinze autres : une ligne dans
`backoffice.queues`, **donc une ligne obligatoire dans `sla_policies`** — c'est la clé étrangère qui
le garantit, et c'est précisément ce que `15` RG26 demandait de rendre vérifiable.

**Sept définitions d'alerte de plus, AL42 à AL48** (`16` RG131), chargées dans
`backoffice.alert_definitions` avec leur seuil de départ :

| Code | Nature | Seuil de départ | Destinataire |
|---|---|---|---|
| **AL42** Taux de plainte au-delà du seuil | `evenement` | 0,3 % / 24 h | `admin` + fondateur |
| **AL43** Taux de rebond dur au-delà du seuil | `evenement` | 5 % sur un envoi | `admin` |
| **AL44** Quota Brevo proche ou atteint | `etat` | 80 % d'une catégorie | `admin` |
| **AL45** Interrupteur d'urgence actif | `etat` | Dès l'activation | Tous + fondateur |
| **AL46** Modèle modifié chez Brevo depuis sa validation | `evenement` | Écart d'empreinte | `admin` |
| **AL47** Envoi bloqué par écart de volume | `evenement` | 10 % ou 50 destinataires | L'auteur + `admin` |
| **AL48** Délivrabilité du code de connexion hors seuil | `etat` | Seuils de `16` RG98 | `admin`, **immédiatement** |

> **AL48 n'est pas un indicateur de délivrabilité, c'est un incident de disponibilité.** Depuis
> **D37**, un code de connexion qui n'arrive pas n'est pas une gêne marketing : **des gens ne peuvent
> pas se connecter**. C'est la raison d'être de `leads.transactional_sends` (§5.8) et de son index
> partiel sur `priority = 'p0'` — sans eux, l'alerte n'aurait aucune ligne à interroger.

#### Les alertes deviennent des lignes — `alert_definitions` et `alert_instances` (`15`, écart 5)

`15` §F catalogue **41 alertes** (AL1 à AL41) qui n'existaient jusqu'ici que sous forme de requêtes
dérivées, dispersées dans dix documents. Deux tables, parce que `15` RG64 distingue **deux natures**
qu'il ne faut pas confondre :

| Nature | Ce que la base porte | Pourquoi |
|---|---|---|
| **Alerte d'état** | **Rien qu'une définition.** La condition est une requête ; l'alerte se lève et se referme **seule** | Matérialiser « décision hors délai » créerait une ligne à effacer dès que la décision est prise — une dénormalisation à entretenir (R10) |
| **Alerte d'événement** | **Une ligne dans `alert_instances`**, qu'un humain doit classer | « Coordonnée détectée dans un fil » ne disparaît pas toute seule : quelqu'un doit l'avoir lue et avoir décidé (`15` RG69). **Sans instance, RG64 et RG69 ne sont pas implémentables** |

```sql
-- une seule instance ouverte par (code, objet) : un fait ne se signale pas deux fois
create unique index alert_instances_open_idx
  on backoffice.alert_instances (alert_code, subject_type, subject_id)
  where closed_at is null;

-- file de travail : les alertes ouvertes, les plus anciennes d'abord
create index alert_instances_pending_idx
  on backoffice.alert_instances (alert_code, opened_at)
  where closed_at is null;

comment on table backoffice.alert_instances is
  'Alertes d''EVENEMENT uniquement (15 RG64). Une alerte d''etat n''a jamais de ligne ici.
   AUCUNE DISPARITION SILENCIEUSE : une instance se ferme avec un motif typé et un auteur.
   La part de faux_positif par code est l''indicateur qui dit si un seuil est mal regle
   (15 RG69) ; au-dela de 50 instances ouvertes sur un meme code, une alerte de second rang
   part a l''administrateur (15 RG67) — requete sur cet index, pas colonne.
   AUCUNE ALERTE NE DECLENCHE DE SANCTION AUTOMATIQUE (15 RG65, 01 M5) : elle informe un humain.
   AUCUNE ALERTE NE PART VERS BREVO NI APOLLO, y compris agregee (15 RG70).';
```

#### `backoffice.dual_control_requests` — les colonnes décrites par `03` PD4 ont enfin une table (`15`, écart 6)

`03` PD4 décrit `requested_by`, `requested_at`, `confirmed_by`, `confirmed_at` et un marqueur
`dual_control`… **sur aucune table**. La file 15 du backoffice (`dual_control_pending`) et `15` RG31
n'avaient donc rien à interroger.

```sql
alter table backoffice.dual_control_requests
  -- 15 RG31 : une demande expire au bout de 24 h, parametre en table
  add constraint dual_control_expiry_after_request
      check (expires_at > requested_at),
  -- backoffice-ops, interdit n° 46 : jamais sa propre seconde validation
  add constraint dual_control_second_pair_of_eyes
      check (confirmed_by_account_id is null
             or confirmed_by_account_id <> requested_by_account_id),
  add constraint dual_control_confirmed_is_complete
      check ((state = 'confirmed') = (num_nonnulls(confirmed_by_account_id, confirmed_at) = 2)),
  -- le mode degrade (une seule personne dans l'equipe) EXIGE une justification ecrite
  add constraint dual_control_degraded_needs_justification
      check (state <> 'degraded'
             or length(btrim(coalesce(degraded_justification, ''))) >= 20);

comment on constraint dual_control_second_pair_of_eyes on backoffice.dual_control_requests is
  'Une personne ne confirme jamais sa propre demande. C''est la seule chose que la base puisse
   garantir du controle a quatre yeux — le reste (qui a le droit de confirmer quoi) appartient
   au document 03. Tant qu''une seule personne cumule agent et admin, l''etat degraded est la
   verite : un controle affaibli, COMPTE ET LU chaque semaine (15 RG22), qui tombe a zero
   a l''arrivee du second administrateur.';
```

#### `backoffice.exports` — et l'interdiction qui va avec (`15`, écart 7)

`15` RG94 exige, pour chaque export : l'auteur, la date, le type, **les filtres exacts**, le nombre
de lignes et **l'empreinte du fichier**. L'empreinte n'est pas un raffinement : sans elle, on ne
peut pas dire, six mois plus tard, si un fichier qui circule vient bien de là.

```sql
-- 15 RG96 : 5 exports par compte interne et par jour ouvre, plafond en table
create index exports_by_account_day_idx
  on backoffice.exports (requested_by_account_id, requested_at desc);

comment on table backoffice.exports is
  'Journal des exports produits depuis le backoffice (15 RG94 a RG96).
   *** AUCUN EXPORT NOMINATIF. *** Les exports du MVP sont AGREGES : compteurs, delais,
   repartitions par motif, montants par devise et par mois. Aucune ligne ne porte un nom, une
   adresse e-mail, un pseudo, un identifiant de compte ni un contenu de message.
   05 RG106 (export nominatif de la liste des inscrits) est ABROGE depuis le 2026-09-19, aligne
   sur 03 C(17) : « aucun role interne n''exporte l''annuaire, sous quelque forme que ce soit,
   y compris par une pagination detournee ».
   Un export est livre par lien court a usage unique, jamais en piece jointe (15 RG95) :
   une piece jointe voyage, se transfere, et finit dans des boites que personne ne controle.
   file_sha256 est NOT NULL : un export sans empreinte n''est pas tracable, donc n''existe pas.';
```

**Clés ajoutées à `backoffice.operational_settings`** (`15` RG104, `14` Q13) : `exports_per_day` (5),
`alert_open_instances_threshold` (50, `15` RG67), `deal_amount_missing_days` (**14 j** vers le
responsable, **30 j** vers l'administrateur — `14` Q13, valeurs d'attente),
`deal_receivable_age_days` (90), `dual_control_expiry_hours` (24),
`deal_write_off_approval_minor` (**50 000**, soit 500,00 EUR — `14` Q5, valeur d'attente).

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
| `profiles.advertiser_contact_details` | L + E (la sienne) | **L après révélation, prénom seulement** (D40, précisée par D46 le 2026-09-24 : e-mail, téléphone et page de contact jamais servis à un membre) | L | L | L |
| `verification.evidence_files` | **—** | L (les siennes) | L (journalisé) | L | — |
| `campaigns.campaigns` | L + E (les siennes) | **—** *(le créateur lit l'instantané, jamais la ligne vivante)* | L | L | L |
| `campaigns.campaign_published_snapshots` | L | **L** | L | L | L |
| `matching.party_blocks` | L + E (les siens) | L + E (les siens) | L + E | L + E | L |
| `matching.application_drafts` | **—** | L + E (les siens) | **—** | **—** | — |
| `reference.price_bands` (bornes nettes comprises) | L | L | L | L | L |
| `matching.introductions` | L (les siennes) | L (les siennes) | L + E | L + E | F |
| `matching.introductions.identity_revealed_at` | — | — | **F** | **F** | **F** |
| `messaging.messages` | L + E (ses fils : **commun + aparté marque**, §5.7.1) | L + E (ses fils : **commun + aparté créateur**) | **F** + E | **F** + E | — |
| **`messaging.conversation_channel_activity`** | L (**canaux visibles seulement**) | L (idem) | L | L | — *(déclencheur seul)* |
| `messaging.conversation_access_log` | — | — | E (par la fonction) | L | L |
| **`messaging.reports`** | L (les siens, **sans `agent_author_account_id`**) + E | idem | L + E **sauf messages d'agents** | L + E **sauf les siens** | — |
| `billing.deals` | **—** | **—** | L + E | L + E | L |
| `billing.commission_rates` | — | — | L | L | — |
| `audit.audit_events` | — | — | L (filtré) | L | **insertion seule** |
| `leads.outbox_events` | — | — | L + rejeu | L + rejeu | L + E |
| **`leads.transactional_sends`** | **—** | **—** | **L** | **L** | **E** *(voir ci-dessous : deux rôles distincts)* |
| **`identity.auth_request_throttle`** | **—** | **—** | **—** | **L** (agrégats) | **E** |

**Deux rôles, deux droits distincts sur `leads.transactional_sends`** — la table n'était dans aucune
ligne de cette matrice, et deux écrivains très différents s'y succèdent (D43) :

```sql
-- l'envoi synchrone du code : apps/api, en operation elevee E-1 (03 P7)
grant insert on leads.transactional_sends to influx_auth;
grant update (status, provider_message_id, sent_at, failed_at, failure_code)
  on leads.transactional_sends to influx_auth;

-- l'accuse de reception, plus tard, par le webhook : le worker
grant update (status, delivered_at)
  on leads.transactional_sends to influx_worker;

-- lecture d'exploitation : support et supervision
grant select on leads.transactional_sends to influx_agent, influx_admin;

-- et RIEN, jamais, pour les roles membres
revoke all on leads.transactional_sends from influx_advertiser, influx_creator;

-- les compteurs de debit ne sont ecrits que par le chemin d'authentification
grant select, insert, update on identity.auth_request_throttle to influx_auth;
grant select on identity.auth_request_throttle to influx_admin;
revoke all on identity.auth_request_throttle
  from influx_advertiser, influx_creator, influx_agent;
```

Trois points qui font la valeur de ces quatre lignes :

1. **`UPDATE` restreint aux colonnes d'issue.** Ni `email_code`, ni `priority`, ni `account_id`, ni
   `created_at` ne sont modifiables **par personne**. Une ligne de journal dont on peut réécrire le
   destinataire ou la priorité après coup ne prouve plus rien — et `priority` est précisément ce que
   l'interrupteur d'urgence lit (`16` RG122).
2. **Le worker n'écrit que `delivered_at`.** C'est la seule écriture asynchrone admise sur cette
   table (`02` §18.8) : il ne peut ni marquer `failed`, ni inventer un `provider_message_id`, ni
   réécrire une issue déjà constatée par `apps/api`.
3. **Aucun rôle membre n'a le moindre droit**, pas même en lecture sur ses propres lignes. Un membre
   n'a pas à savoir combien de codes ont été demandés pour son adresse, et un attaquant encore
   moins : ce serait l'oracle que tout `02` §18.5 s'emploie à supprimer. La réponse « je n'ai pas
   reçu mon code » passe par le support, donc par un agent.

> **`influx_auth` est un rôle applicatif de plus, et il doit être déclaré comme tel** (§3.2). Ce
> n'est pas `influx_service` : il porte **uniquement** le chemin d'authentification, ne lit aucune
> donnée métier, et son `GRANT` se relit en quatre lignes. `03` P7 le prévoit déjà en opération
> élevée **E-1** ; ce document ajoute seulement les droits de table correspondants. **Nom et
> périmètre exact à confirmer par `expert-cybersecurite`** (§12.10).

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
| **Documents et téléchargements** | `messaging.documents`, **`messaging.document_downloads`** | **3 ans** après la clôture de la conversation | `closed_at` du fil | **Même durée que les messages** : un brief transmis fait partie de la négociation. Les octets sortent du Storage à la même échéance, le journal des téléchargements reste pendant la même durée |
| **Journal d'envoi des e-mails** | **`matching.introduction_emails`** | **3 ans** | `created_at` | Corroboration externe d'une mise en relation (`13` RG79). Ne contient ni adresse ni texte : sa conservation coûte peu et son absence rendrait la preuve externe introuvable |
| **Notes internes** | **`backoffice.internal_notes`** | **Vie du compte ou de l'objet + 3 ans** | `deleted_at` du sujet | Alignées sur ce qu'elles commentent (`15`, écart 11). Une note qui survit à son sujet est une donnée personnelle orpheline ; une note purgée avant lui rend l'historique incompréhensible |
| **Instances d'alerte** | **`backoffice.alert_instances`** | **24 mois** | `closed_at` | Assez pour régler les seuils sur une saisonnalité complète (`15` RG67), pas assez pour constituer un dossier sur une personne |
| **Journal des exports** | **`backoffice.exports`** | **Sans purge** | — | Il **vit dans le registre** (`export.produced`) : purger la table sans purger le registre créerait une incohérence, et purger le registre est interdit (`01` M4) |
| **Encaissements** | **`billing.commission_receipts`** | **10 ans** | `received_on` | Même régime que les affaires : pièce comptable. **Aucune suppression physique** (R6) |
| **Envois d'e-mails** | **`backoffice.email_sends`, `backoffice.email_send_recipients`** | **3 ans** | `created_at` | `16` RG112, écart 11. Même justification que `introduction_emails` : prouver **à qui** INFLUX a écrit, **sur quelle base légale** et **avec quel modèle**, aussi longtemps qu'une réclamation est possible. **Valeur d'attente** (`16` Q5), veto `expert-conformite-rgpd` |
| **Compteurs de débit d'authentification** | **`identity.auth_request_throttle`** | **30 jours** | `expires_at` | Compteur d'exploitation, pas historique. Au-delà, une fenêtre glissante n'a plus d'usage — et l'on garderait l'empreinte d'adresses que nous ne connaissons pas |
| **Utilisateurs Supabase Auth orphelins** | *(schéma `auth`, hors de nos tables)* | **24 heures** | Création | Conséquence de la création inconditionnelle d'utilisateur (`02` §18.5) — procédure au §9.3 |
| **Journal transactionnel** | **`leads.transactional_sends`** | **13 mois** | `created_at` | Diagnostic d'exploitation, pas preuve : assez pour couvrir une saisonnalité complète de délivrabilité, et bien moins que les envois marketing. Ne contient **ni corps, ni code** |
| **Suspensions** | `backoffice.account_suspensions` | **5 ans** après la levée | `ended_at` | Une suspension est une décision opposable : le titulaire peut la contester, et INFLUX doit pouvoir l'expliquer |
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

#### Une purge d'un genre différent : les utilisateurs Supabase Auth sans compte (D43, `02` §18.5)

Elle ne porte pas sur nos tables, et c'est pour cela qu'elle risquait de n'être écrite nulle part.

**D'où vient le problème.** Pour que la réponse à une demande de code **ne dépende d'aucune propriété
du compte** (`05` RG46, `03` A-5), le gestionnaire exécute **exactement la même suite d'appels** que
l'adresse existe ou non : l'utilisateur GoTrue est créé **inconditionnellement** — l'erreur « déjà
existant » est avalée — *puis* le code est demandé. Supprimer la branche plutôt que la masquer est la
bonne décision : un `if (compte existe)` réintroduirait une différence de durée **corrélée à ce que
l'on protège**, qu'aucun plancher de réponse ne masquerait dans la queue de distribution.

**La conséquence est mécanique :** *toute* adresse essayée, y compris au hasard par un robot, laisse
un utilisateur dans le schéma `auth` de Supabase — sans jamais devenir un compte INFLUX.

| Quoi | Utilisateurs `auth.users` **sans ligne `identity.accounts`** correspondante |
|---|---|
| **Quand** | **24 heures** après leur création |
| **Comment** | Tâche périodique, opération élevée **E-4** (`maintenance.run_periodic`, `03` P7). **Par l'API d'administration de GoTrue**, jamais par un `DELETE` sur le schéma `auth` — nous ne modifions jamais un schéma qui appartient à Supabase (§5.1, `accounts.auth_user_id` n'a d'ailleurs **volontairement pas** de clé étrangère) |
| **Garde-fou** | Le rapprochement se fait sur `identity.accounts.auth_user_id`, **jamais sur l'adresse** : un compte supprimé logiquement (`status = 'deleted'`) garde sa ligne, donc son utilisateur GoTrue n'est **pas** purgé |
| **Trace** | Un résumé au registre, comme toute purge : `retention.purged`, catégorie `auth_orphan_users`, avec le nombre |

> **Pourquoi 24 heures et pas moins.** Le délai doit couvrir un parcours d'inscription interrompu et
> repris le lendemain matin : purger à une heure ferait perdre le code en cours de quelqu'un qui
> déjeune. Il doit rester court parce que la table `auth.users` est, sans cette purge, **un annuaire
> en croissance libre des adresses essayées** — exactement ce que la limitation de débit de `05` RG44
> et l'empreinte de `identity.auth_request_throttle` s'emploient à ne pas constituer de notre côté.
> **À soumettre à `expert-cybersecurite`** (§12.10) : c'est lui qui arbitre le compromis entre la
> fenêtre de reprise et la surface d'énumération.

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
| `party_blocks (advertiser_account_id, creator_account_id)` **unique partiel**, `where lifted_at is null` | **Exclusion de premier rang de la recherche** (`10` RG28), évaluée pour chaque résultat. L'unicité **est** la contrainte ; l'index n'en est que l'effet |
| `party_blocks (creator_account_id) where lifted_at is null` | Le sens inverse : « ce créateur est-il bloqué par quelqu'un ? », lu par la recherche de campagnes et par `open_introduction()` |
| `profile_field_revisions (sla_due_at) where status = 'pending_review'` | **File de validation des révisions**, triée par échéance. Index partiel : il ne contient que ce qui est en attente |
| `campaigns (status, applications_close_on) where status = 'published'` | Le fil de campagnes côté créateur : publiées, non encore fermées aux candidatures, triées par échéance |
| `campaigns (advertiser_account_id, status)` | « Mes campagnes » côté marque, et le plafond de 10 campagnes simultanées (`09` RG15) |
| `campaigns (created_at) where status = 'pending_review'` | File « campagnes à valider » du backoffice, triée par ancienneté croissante (`09` RG87) |
| `campaign_price_bands (currency, price_band_code)` | Filtre « tranche de budget » de la recherche de campagnes : une comparaison de **codes**, jamais de montants |
| `supply_counters (dimension, dimension_value, snapshot_on desc)` | Courbe de masse critique par thématique (D38), lue au tableau de bord et par la tâche d'alerte |

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
| `interest_submissions (introduction_id, kind)` **unique** | Une expression d'intérêt par partie et par mise en relation ; sert aussi à charger les deux soumissions d'un coup pour le commercial |
| `interest_submissions (submitted_by_account_id, created_at desc)` | « Mes candidatures » côté créateur, et le décompte de la seconde chance après un refus corrigible (`11` RG67) |
| `application_drafts (expires_at)` | **Purge quotidienne** des brouillons abandonnés. Sans lui, la tâche balaie toute la table chaque nuit |
| `introductions (campaign_id, status) where origin = 'creator_application'` | Reconstruction et contrôle du compteur `active_applications_count` (`11` P3), et statistiques de candidature par campagne |
| **`introductions (proposal_batch_id) where proposal_batch_id is not null`** | **Suivi d'un envoi groupé** : « mes propositions de la semaine, par lot, avec leur taux d'acceptation » (`13` RG54 à RG59). Index partiel : seules les propositions INFLUX y entrent |
| **`introduction_emails (introduction_id) where status = 'failed'`** | **Alerte A8** : les mises en relation sans preuve externe. Doit rester vide — l'index ne coûte donc presque rien (`13` RG80) |
| **`introduction_emails (introduction_id, recipient_account_id) where email_kind = 'reveal_confirmation'`** **unique** | Une seule confirmation de révélation par destinataire : contrainte, pas optimisation |
| **`introduction_emails (provider_message_id)`** **unique** | Idempotence du webhook d'accusé de réception, et recherche depuis une réclamation (« retrouvez-moi cet e-mail ») |

### 10.6 Messagerie — Lot 4

| Index | Requête |
|---|---|
| `messages (conversation_id, channel, created_at desc, id)` | Affichage d'un fil, **un canal à la fois**, paginé par curseur, et décompte des non-lus d'un canal (§5.7.1). **Le seul index dont la messagerie a besoin au MVP** |
| `conversation_participants (account_id) where left_at is null` | « Mes conversations », point de départ de la liste sur les trois espaces |
| `conversation_channel_activity` (clé primaire) | Tri de cette liste par activité : au plus trois lignes par conversation, lues par la clé (§5.7.1). *Remplace l'index sur `conversations.last_message_at`, supprimée* |
| **`conversation_access_log (accessed_at desc) where channel <> 'common' and not was_participant`** | Revue hebdomadaire des **lectures d'apartés par des agents non participants** (`12` RG134) |
| `conversation_access_log (conversation_id, accessed_at desc)` | « Qui a lu ce fil ? » — à la demande d'un utilisateur ou d'une autorité |
| `conversation_access_log (agent_account_id, accessed_at desc)` | « Qu'a lu cet agent ? » — revue de conformité |
| `contact_detections (sent_despite_warning desc, created_at desc) where reviewed_at is null` | Liste d'alertes du backoffice (M6). **L'ordre des colonnes est le message** : les envois assumés après avertissement remontent en tête, ce sont les seuls qui méritent un appel (`12` RG45) |
| **`conversation_access_log (read_session_id)`** | Regroupement des appels d'une même consultation à l'affichage et dans la revue X4 (`03` §5.2) — sans lui, la pagination se compte comme des lectures |
| **`conversation_access_log (reason_code, accessed_at desc)`** | « Lectures par un agent non participant, par semaine et par motif » (`12`, Indicateurs) : l'indicateur qui rend la supervision annoncée mesurable |
| **`documents (introduction_id) where moderation_status = 'pending'`** | **File de contrôle des documents** et alerte de dépassement du SLA (`12` RG71, RG99) |
| **`document_downloads (document_id, downloaded_at desc)`** | « Qui a récupéré ce fichier, et quand ? » — la seule question posée en cas de litige (`12` RG75) |

### 10.7 Pipeline commercial — Lot 4 *(table)* puis Lot 5 *(écrans)*

| Index | Requête |
|---|---|
| **`deals (revealed_at) where state = 'open'`** | **Alerte A6** : affaire créée à la révélation et **jamais sortie de son état initial après 30 jours** — signal de contournement **ou** de saisie négligée (`01` §11, `13` RG106). Index partiel, **nécessaire dès le Lot 4** puisque l'affaire y naît. Il remplace la jointure externe sur `introductions` de l'ancienne rédaction |
| `deals (owner_agent_id, state)` | Pipeline d'un commercial |
| `deals (state, signed_at) where state = 'signed' and commission_invoiced_at is null` | **Relance J+7** : affaire signée dont la commission n'est pas facturée |
| `deals (commission_invoiced_at) where commission_invoiced_at is not null and (commission_received_total_minor is null or commission_received_total_minor < agreed_commission_amount_minor)` | **Relance J+30** — réécrit sur le **total dérivé** (`14` E1) : l'ancienne forme, fondée sur une date d'encaissement unique, ratait toute affaire réglée **partiellement** |
| **`commission_receipts (received_on, currency)`** | **Indicateur n° 1 : commission encaissée par devise et par mois** (`14`), et rapprochement bancaire. Il **remplace** l'index sur les deux colonnes supprimées de `deals` : l'agrégat se fait désormais sur les mouvements, qui sont la vérité |
| **`commission_receipts (deal_id, received_on)`** | Les règlements d'une affaire, dans l'ordre — l'écran de fiche, et le recalcul du total dérivé |
| **`deals (signed_at) where state = 'signed' and commission_invoice_ref is null`** | **`14` E10** : « signée sans facture à J+7 », **doit tendre vers zéro**. Index partiel plutôt qu'une colonne « facture manquante » : la vérité n'est pas dupliquée |
| **`deals (lost_at) where lost_reason_code = 'conclu_hors_influx'`** | Mesure du contournement : montants estimés par devise et par niveau de confiance (`14` E9). **Jamais convertie en commission** |
| **`deals (revealed_at) where state = 'open' and negotiated_amount_minor is null`** | **`14` RG8bis / Q13** : affaire ouverte **sans montant** à 14 puis 30 jours. Distinct de l'alerte A6 (affaire immobile) : ici, c'est le **montant** qui manque, pas le mouvement |

### 10.7bis Backoffice — Lots 1, 4 et 5

| Index | Requête |
|---|---|
| `alert_instances (alert_code, subject_type, subject_id) where closed_at is null` **unique** | **Un fait ne se signale pas deux fois** : contrainte, pas optimisation (`15` RG64) |
| `alert_instances (alert_code, opened_at) where closed_at is null` | File de travail des alertes ouvertes, les plus anciennes d'abord ; sert aussi au seuil de second rang des 50 instances (`15` RG67) |
| `dual_control_requests (state, expires_at) where state = 'pending'` | **File 15** du backoffice et tâche d'expiration à 24 h (`15` RG31) |
| `exports (requested_by_account_id, requested_at desc)` | Plafond de **5 exports par jour ouvré** et détection d'une série (`15` RG96) |
| `internal_notes (subject_type, subject_id, created_at desc)` | « Les notes sur cet objet » — l'encadré présent sur toutes les fiches du backoffice |
| `account_suspensions (account_id) where ended_at is null` | **La suspension en cours d'un compte**, lue à chaque ouverture de session : partiel, donc minuscule |
| `agent_profiles (is_break_glass) where is_break_glass` **unique** | Il n'y a **qu'un** compte de secours (`15` RG103) ; sa multiplication serait le premier symptôme d'un problème |
| `email_send_recipients (email_send_id, coalesce(account_id::text, lower(email_address)))` **unique** | **`16` écart 1** : un destinataire une seule fois par envoi, **sans recopier l'adresse** quand un compte existe |
| `email_send_recipients (lower(email_address)) where email_address is not null` **unique** | **`16` RG55** : une adresse de prospection n'est sollicitée **qu'une fois, définitivement**. Contrainte, pas optimisation |
| `email_sends (status, cancel_window_ends_at) where status = 'scheduled'` | La tâche qui **recalcule le volume** à la fin de la fenêtre d'annulation (`16` RG28 à RG31) |
| `email_sends (created_by_agent_id, created_at desc) where source = 'manual_entry'` | Consommation des **plafonds de saisie libre par agent** — jour, mois glissant, domaine (`16` RG54) : le chiffre qui révèle une dérive avant qu'elle ne devienne une campagne |
| `transactional_sends (created_at desc) where priority = 'p0'` | **AL48** : délivrabilité du **code de connexion** (`16` RG98). Partiel, donc minuscule, et c'est le seul index dont dépend une alerte de disponibilité |
| `transactional_sends (account_id, created_at desc) where account_id is not null` | « Je n'ai pas reçu mon code » — la question du support, indexée telle quelle |
| `data_subject_requests (due_at) where completed_at is null` | Les demandes **en retard ou proches du délai légal de 30 jours** — la seule file dont le dépassement est une infraction |

### 10.8 Les cinq dénormalisations du modèle

| Colonne | Requête ou règle qui l'impose | Maintenue par |
|---|---|---|
| **`messaging.conversation_channel_activity`** *(remplace `conversations.last_message_at` depuis le 2026-09-24)* | Liste des conversations triée par activité, sur trois espaces. Sans elle, un `max()` corrélé sur `messages` à chaque affichage. **Par canal**, parce qu'une date unique révélait l'existence d'un aparté (`12` RG118, §5.7.1) | Déclencheur `AFTER INSERT` sur `messages` (`on_message_inserted`) |
| `leads.contact_sync_states` | Écran « inscrits et état de synchronisation » : un `DISTINCT ON` sur toute la file à chaque affichage | Le worker, en fin de traitement |
| `billing.deals.revealed_at` | Copie de `identity_revealed_at` qui rend la contrainte `signed_at >= revealed_at` **déclarative** au lieu d'exiger un déclencheur avec sous-requête | Posée à la création de l'affaire, jamais modifiée |
| **`campaigns.campaigns.active_applications_count`** | **Ce n'est pas une optimisation, c'est une correction.** Le plafond P3 (`11`) doit **fermer atomiquement** la campagne : un `count(*)` lu avant l'insertion laisse passer deux candidatures simultanées. Le compteur est la ligne que la transaction verrouille, et la contrainte `check (… <= max_applications)` refuse l'insertion en trop | Déclencheur sur `matching.introductions` |
| **`matching.application_quotas`** | Même raisonnement pour les plafonds P1 et P2 côté créateur, plus le compteur journalier glissant qu'aucune requête ne peut tenir sans une ligne à verrouiller | Déclencheur sur `matching.introductions` + réinitialisation quotidienne de `counted_on` |

Les deux ajouts de cette version ne sont pas des copies de confort : **sans eux, une règle de
gestion est fausse sous concurrence**. C'est le seul motif qui fait céder R10 — une mesure ou une
impossibilité démontrée, jamais une intuition de performance.

**Un cas voisin, qui n'est pas une dénormalisation :** `campaigns.campaign_published_snapshots` ne
duplique pas une donnée vivante, il **conserve une version datée de ce qui a été montré**, au même
titre que `terms_acceptances.content_hash` ou que les pays recopiés sur une mise en relation (R7).
La ligne vivante reste la source de vérité ; l'instantané est une preuve.

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
| 0004 | `identity_core` | `accounts`, **`account_roles` avec la contrainte D41**, `owner_agent_id` et sa clé étrangère composite, `agent_profiles` (**`is_active`, `is_break_glass`, absence déclarée, `deactivated_by`**), `grant_role()`, RLS, **les cinq codes `agent.*` dont `agent.break_glass_login`** | Oui tant qu'aucun compte réel n'existe |
| 0005 | `identity_terms_and_consent` | `terms_versions`, `terms_acceptances`, `consent_events`, append-only | Oui (idem) |
| 0006 | `audit_chain` | `event_types`, `audit_events`, `chain_checks`, `append_event()`, `REVOKE`, déclencheurs, ligne de genèse | **Non** dès la première ligne réelle : annuler, c'est détruire la preuve |
| 0007 | `billing_commission_rates_empty` | Table **vide**, commentaire SQL, `REVOKE INSERT` à tous | Oui |
| 0008 | `backoffice_ownership` | `ownership_assignments` | Oui |
| **Lot 1** | | | |
| 0101 | `leads_outbox` | `outbox_events`, `contact_sync_states`, index partiels, contrainte RG35 | Oui |
| 0102 | `backoffice_queues_and_sla` | **`queues`** (catalogue des files, `15` RG26) puis `sla_policies` **avec sa clé étrangère vers `queues`** + **valeur de départ de D39 : décision sous 1 jour ouvré** + **`is_provisional`** sur les quatre délais proposés et non validés (`15` Q2 à Q4) | Oui |
| **0107** | **`backoffice_alerts_and_dual_control`** | **`alert_definitions`** (catalogue AL1 à **AL48**, chargé lot par lot), **`dual_control_requests`** et ses contraintes, **les codes `dual_control.*`, `settings.changed` et `ownership.reassigned`** | Oui |
| **0108** | **`leads_transactional_sends`** | **`transactional_sends`** append-only, `priority` **sans valeur par défaut**, **la liste fermée des trois `failure_code` d'un `P0`** (D43, `05` RG60), ses deux index de **lecture** — **et aucun sur `status`** —, les `GRANT` de `influx_auth` et `influx_worker`, **`identity.auth_request_throttle`** (`05` RG44), **les compteurs de cadence** sur `contact_sync_states` (`16` RG80). **Cette migration est la plus précoce de toutes les corrections de cette série : le code de connexion existe dès la première mise en ligne** | Oui |
| 0103 | `leads_sync_settings` | Table de configuration + **`apollo_scope = 'annonceurs_et_createurs_pro'`** (valeur d'attente de D33) | Oui |
| 0104 | `identity_signup_fields` | `accounts.declared_status` (**`not null`**), `email_status`, `email_undeliverable_at`, `set_declared_status()`, `correct_email()` | Oui tant qu'aucun compte réel n'existe ; **`declared_status` devient non annulable ensuite** |
| 0105 | `identity_email_health` | `email_delivery_incidents`, append-only, index d'idempotence | Oui |
| 0106 | `profiles_advertiser_minimal` | Schéma `profiles`, privilèges par défaut, `advertiser_profiles` **en forme minimale** (nom d'entreprise) | Oui |
| **Lot 2** | | | |
| 0201 | `reference_taxonomies` | `topics`, `networks`, `formats`, `sectors`, `usage_rights`, `audience_bands`, **`engagement_bands`**, **`age_bands`** (`check (min_age >= 18)`), **`audience_genders`**, **`editorial_tones`**, **`publication_frequencies`**, **`regions`**, `price_bands` **avec ses bornes nettes et son `REVOKE`** | Oui |
| 0202 | `profiles_advertiser_full` | **Extension** de `advertiser_profiles` (colonnes du Lot 2, toutes nullables, aucune donnée à migrer) + `advertiser_contact_details` | Oui |
| 0203 | `profiles_creator_public` | Vitrine anonymisée et ses satellites, **les sept champs ajoutés par `07`**, `creator_tones`, `creator_usage_rights`, **`profile_status` à cinq valeurs** | Oui |
| 0204 | `profiles_creator_identity` | Objets révélable et identifiant, `avg_reach_per_post`, **`GRANT` de révélation élargi aux chiffres exacts** (§5.2), `REVOKE` au rôle annonceur sur l'objet identifiant | Oui |
| 0205 | `profiles_portfolio` | `portfolio_items`, compartiment `portfolio`, politiques Storage | Oui |
| 0206 | `verification_core` | Demandes, codes, pièces (**images uniquement**), badges, contestations, motifs de refus, **`revocation_reasons`**, **état `to_reconfirm`**, **identifiant observé au constat** | Oui |
| 0207 | `profiles_revisions` | `moderated_fields`, `profile_field_revisions`, index de file, fonction d'application d'une révision approuvée | Oui |
| **Lot 3** | | | |
| 0301 | `campaigns_core` | `reference.campaign_types`, campagnes (**six états, quatre textes, dotation, droits d'usage, quatre dates, nature de la rémunération**), livrables, ciblage détaillé, messages clés, territoires, éléments demandés, motifs de refus, **types d'événements `campaign.*`** | Oui |
| 0302 | `campaigns_publication` | `campaign_published_snapshots`, `campaign_price_bands`, fonction de publication (dérivation des tranches, contrôle des dates, revue renforcée à deux validateurs) | Oui |
| 0303 | `search_journal` | `search_queries` (**tri et version des facettes compris**), `search_impressions`, `explanation_reasons`, `impression_reasons`, `shortlists` | Oui |
| 0304 | `search_settings` | `search_settings`, `facet_settings`, `facet_config_versions`, `supply_counters`, fonction d'écriture réservée à `influx_admin` | Oui |
| 0305 | `matching_party_blocks` | **`block_reasons`, `party_blocks`** et leurs politiques — au Lot 3, parce que la recherche en dépend | Oui |
| 0306 | `backoffice_operational_settings` | Table clé/valeur des plafonds et délais d'exploitation + valeurs de départ (`11` P1 à P4, `09` RG15, RG88, `08` RG100) | Oui |
| **Lot 4** | | | |
| 0401 | `matching_introductions` | `introductions` (**`expiry_reason` à sept valeurs**, **`proposal_batch_id`**, **les cinq colonnes de refus de partie**), `rejection_reasons` (**`is_correctable`**, + le code `declined_by_party`), **`decline_reasons` (liste B)**, **`introduction_transitions` et son déclencheur**, `interest_submissions` et leurs formats, compteur de référence, contraintes, write-once, **les 18 codes `introduction.*` de `audit.event_types`** | **Partiellement** : le schéma s'annule, la preuve non |
| 0402b | `matching_quotas_and_drafts` | `application_quotas`, `application_drafts` et leurs formats, déclencheurs de comptage, contraintes de plafond, purge | Oui |
| **0402a** | **`billing_deals_at_reveal`** | **`lost_reasons`, `cancellation_reasons`, `non_monetary_reasons`, `deal_state_transitions`** (avec `cancelled`, **sans** `stalled` ni `disputed`), **`deals`** (bases fiscales, payeur et parts saisies, attributs de litige et d'enlisement, champs d'estimation de contournement), **`deal_field_changes`** avec `is_financial_field` et son motif obligatoire, et le déclencheur d'historisation — **avancées du Lot 5** (arbitrage du 2026-09-19). **Dépendance stricte : doit s'appliquer avant `0402`**, qui crée l'affaire à la révélation | Oui tant qu'aucune affaire réelle n'existe ; **non** ensuite (donnée comptable, §11.3) |
| 0402 | `matching_reveal_function` | `reveal_identity()` `SECURITY DEFINER`, `REVOKE` de colonnes, **création de l'affaire à l'état `open`**. **Dépend de `0402a`** | Oui |
| **0402c** | **`matching_introduction_emails`** | **`introduction_emails`**, ses contraintes de chronologie, ses trois index, l'unicité du `provider_message_id` | Oui |
| 0403 | `messaging_core` | Conversations (**pause motivée, clôture réouvrable, `reopen_count`**), **`pause_reasons`**, **`conversation_state_transitions` et son déclencheur**, participants, messages, lectures, **les 10 codes `conversation.*` de `audit.event_types`** ; **apartés (§5.7.1)** : type `message_channel`, `messages.channel` sans valeur par défaut et ses deux contraintes, politiques par canal, **`conversation_channel_activity`** (sans `conversations.last_message_at`), déclencheurs `assert_message_writable` et `on_message_inserted`, curseurs par canal | Oui |
| 0404 | `messaging_supervision` | **`access_reasons`**, `conversation_access_log` (**`reason_code` non nul, `read_session_id`, `channel` sans valeur par défaut**), `read_conversation()` **à canal obligatoire**, **`REVOKE SELECT` sur `messages` aux agents**, index partiel des lectures d'apartés | Oui |
| **0406** | **`backoffice_alert_instances`** | **`alert_closure_reasons`**, **`alert_instances`** et ses deux index, **les codes `alert.*` et `queue.claim_forced_release`**. Au Lot 4 : les premières alertes d'événement sont les détections de coordonnées et les signalements | Oui |
| 0405 | `messaging_safety` | `contact_detections` (**`warned_before_send`, `sent_despite_warning`**), `reports` (**`agent_author_account_id`, son déclencheur et ses deux politiques**, §5.7.1), **`document_labels`**, **`document_rejection_reasons`**, `documents` (**`available_at`**), **`document_downloads`**, **les 7 codes `report.*`, `detection.*` et `document.*`** *(les quatre tables de documents restent conditionnelles au canal)* | Oui |
| **Lot 5** | | | |
| ~~0501~~ | ~~`billing_deals`~~ | **Supprimée le 2026-09-19 : son contenu est passé en `0402a`** (Lot 4). Le Lot 5 n'apporte **aucune table `billing` nouvelle** — seulement les écrans de saisie du pipeline | — |
| 0501 | **`billing_commission_receipts`** | **`commission_receipts`** append-only, ses contraintes, son index, le déclencheur qui maintient `deals.commission_received_total_minor` (`14` E1) | Oui tant qu'aucun règlement réel n'existe ; **non** ensuite |
| **0503** | **`backoffice_email_sending`** | **`email_templates`**, **`brevo_allowed_segments`**, **`email_send_transitions`** et son déclencheur, les **onze colonnes** de `email_sends`, la **réécriture de l'unicité** de `email_send_recipients` et ses deux index, les **trois plafonds** de `email_send_limits`, la clé `email_kill_switch` | Oui |
| 0502 | `backoffice_operations` | Notes **avec `subject_type`, auteur et ajout seul**, **`suspension_reasons`** et **`suspension_lift_reasons`**, suspensions, **`exports`**, plafonds et envois d'e-mails, demandes RGPD **complétées** (`15`, écart 4), **les 14 codes `account.*`, `ownership.bulk_transferred`, `export.produced` et `privacy.*`** | Oui |
| **Lot 6** | | | |
| 0601 | `retention_jobs` | Fonctions de purge, index de purge manquants | Oui |

### 11.3 Ce qui n'est pas réversible, et pourquoi

| Migration | Pourquoi l'annulation est impossible ou interdite |
|---|---|
| `0006 audit_chain` | Dès la première ligne, annuler c'est **détruire la preuve**. Techniquement faisable, **interdit par décision** |
| `0401 matching_introductions` | Le schéma s'annule tant qu'aucune mise en relation n'existe. Après : `identity_revealed_at` n'est **pas reconstituable** |
| `0402a billing_deals_at_reveal` | Le schéma s'annule tant qu'aucune affaire n'existe. Après : **perte comptable** (§9.1, 10 ans). Et l'annuler sans annuler `0402` casserait la transaction de révélation — **les deux migrations s'annulent ensemble ou pas du tout** |
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
| 7 | **Liste des fonctions `SECURITY DEFINER`** : `current_account_id`, `append_event`, `reveal_identity`, `read_conversation`, `grant_role`, `set_declared_status`, **`correct_email`**, **`assert_message_writable`** et **`on_message_inserted`** (apartés, §5.7.1, question A2) | Ce sont les seules portes privilégiées du modèle. Chacune mérite une revue ligne à ligne |
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
| ~~Q3~~ | ~~Après révélation, la marque voit-elle les chiffres exacts d'audience ?~~ | **Close le 2026-09-19 par `07` RG45 et RG59 : chiffres exacts visibles après révélation**, accompagnés obligatoirement de leur source et de leur date. Le `GRANT` du §5.2 est élargi en conséquence. **Reste soumis à `expert-cybersecurite`** (§12.1, point 3), qui arbitre la liste exacte des colonnes révélées |
| **Q4** | **Plafond de candidatures actives** par créateur, **durée de validité** du code de propriété, **délai de grâce** après péremption du badge | Ce sont des paramètres ; je les veux **en table** (`backoffice.sla_policies` ou équivalent), pas en constantes — mais il faut des valeurs de départ |
| **Q5** | **Le canal de documents** (§5.7) est-il retenu ? | Deux tables et un compartiment Storage en dépendent, rien d'autre |

### 12.5 Pour le fondateur

| # | Point | Pourquoi c'est à vous |
|---|---|---|
| 1 | **Rien ne se supprime vraiment.** Un compte supprimé devient anonyme, mais la mise en relation, l'affaire, les messages et le journal **restent**, sous une forme qui ne porte plus de nom. C'est ce qui protège INFLUX en cas de contestation — et cela **doit être écrit dans la politique de confidentialité dès la première mise en ligne** | C'est une promesse faite à vos utilisateurs, pas un réglage technique |
| 2 | **La table des taux de commission est créée et verrouillée.** Personne ne peut y écrire depuis l'application : la remplir, en V2, exigera une modification de la base relue et validée | C'est le garde-fou qui garantit qu'aucun « 35 % » ne se glissera quelque part dans le code d'ici là |
| 3 | **Le registre de preuve protège contre le code, pas contre vous.** Celui qui détient le projet Supabase peut tout effacer. Parade gratuite proposée : **recevoir chaque mois par e-mail l'empreinte de tête du registre** (64 caractères). Un tiers en détient alors une copie datée | Cela transforme une preuve interne en preuve difficilement contestable, pour zéro euro. À accepter ou à refuser |
| 4 | **D41, D39 et D40 sont intégrées** (2026-09-18). Ce qu'il faut en retenir : le double rôle reste **fermé** au MVP, mais la porte est posée et son ouverture est chiffrée à **8 à 12 jours** au lieu de 3 à 5 semaines (**§5.1.1**) ; le délai de la file est **1 jour ouvré**, réglable sans déploiement ; les coordonnées d'une marque sont désormais **masquées jusqu'à la mise en relation**, comme celles d'un créateur — *et, depuis D46 (2026-09-24), l'e-mail, le téléphone et la page de contact ne sont jamais servis à un membre (§12.11)* | Ce sont vos arbitrages : ce paragraphe est là pour que vous puissiez vérifier qu'ils ont été compris comme vous les avez posés |

### 12.6 Points à valider, ouverts par la relecture des documents `06` à `11` (2026-09-19)

Chacun de ces points a été **tranché dans le sens le plus conservateur** pour que le modèle ne
comporte pas de manque ; chacun peut être rouvert par son arbitre.

| # | Point | Choix conservateur retenu | Arbitre |
|---|---|---|---|
| 1 | **Bornes nettes dans `reference.price_bands`** | Colonnes nullables, écrites **par migration relue uniquement**, `REVOKE` à tous les rôles, base du calcul écrite en clair, affichage « environ ». **C'est la seule forme qui affiche un net sans multiplier un montant par un taux** — mais ces bornes **dérivent économiquement de la commission de 35 %**, ce qui doit être vu et accepté, pas glissé dans un référentiel | `expert-paiement-facturation` + **Fondateur** (§3 de `CLAUDE.md`) ; `architecte` pour T16 |
| 2 | **`GRANT` élargi aux chiffres exacts après révélation** | Élargi (`07` RG45), avec `figures_source` et `figures_measured_at` **obligatoirement** dans le même `GRANT` | `expert-cybersecurite` — **veto**, §12.1 point 3 |
| 3 | **Région de résidence et `reference.regions`** | Colonne ajoutée, **jamais une facette de recherche**, affichée au-delà d'un seuil de 5 profils lu en table. La ville reste en couche identifiante tant que **Q2 de `07`** n'est pas tranchée | `expert-conformite-rgpd` — **veto** ; `expert-ux` pour l'affichage |
| 4 | **Suppression physique des brouillons de candidature** | Admise, **seule exception à R6** : un brouillon ne touche ni mise en relation, ni affaire, ni journal. Durée par défaut 30 jours, en table | `expert-conformite-rgpd` + `product-owner` (`11` Q12) |
| 5 | **`campaign_published_snapshots` en `jsonb`** | Retenu, avec empreinte et schéma zod. Un instantané conserve **ce qui a été montré aux créateurs** : sa durée de conservation et son sort à l'anonymisation d'un compte doivent être écrits au §9 | `expert-conformite-rgpd` — **veto** ; `architecte` pour la forme |
| 6 | **`matching.party_blocks`** | Effet **symétrique**, exclusion **silencieuse**, motif **jamais** exposé à la partie bloquée. Un blocage levé est **conservé** (`lifted_at`), jamais supprimé : c'est un élément de contexte commercial et de sécurité | `expert-cybersecurite` (forme de l'exclusion) + `expert-conformite-rgpd` (conservation, information de la personne) |
| 7 | **`search.impression_reasons`** | Raisons **conservées** avec leurs paramètres en codes et tranches, jamais en valeurs exactes. Double finalité déjà signalée au §12.2 point 5 : cette table l'étend | `expert-conformite-rgpd` — **veto** |
| 8 | **`reach_band` réutilise `reference.audience_bands`** | Réutilisé plutôt que créer un référentiel de portée : un vocabulaire unique pour deux comptages de personnes. **À confirmer** — une portée moyenne et un nombre d'abonnés n'ont pas les mêmes ordres de grandeur, et des bornes mal calibrées rendraient la facette inutile | `expert-matching` + `product-owner` |
| 9 | **Bornes de `reference.engagement_bands`** | Un référentiel **global**, en points de base. Un taux d'engagement « bon » n'a pourtant pas la même valeur selon le réseau : la calibration par réseau est possible sans changement de schéma (colonne `network_code` à ajouter) | `expert-matching` |
| 10 | **Second validateur de la revue renforcée** | `09` RG85 autorise « un admin, ou un agent approuvé par un second rôle interne distinct » ; `03` §3.2 impose la double validation administrateur. La base exige seulement **deux personnes distinctes**, la règle plus stricte est appliquée par la fonction de publication | `expert-cybersecurite` — **veto** |
| 11 | **Emplacement des paramètres d'exploitation** | `backoffice.operational_settings` (§5.10), clé/valeur à liste fermée, sur le modèle éprouvé de `leads.sync_settings`. Les SLA restent dans `backoffice.sla_policies`, les réglages de recherche dans `search.search_settings` | `architecte` + `chef-de-projet` |

**Écarts signalés par les spécifications et *non* traités dans cette version**, parce qu'ils
supposent un arbitrage produit ou juridique, et non un choix de modélisation. Ils sont listés ici
pour qu'aucun ne se perde :

| Origine | Écart | Pourquoi je ne l'ai pas tranché |
|---|---|---|
| `06`, écarts 1 à 3 | `legal_name` doit quitter la couche publique du profil marque ; `contact_role` doit la rejoindre ; le **pays** et le **numéro d'immatriculation** manquent pour le badge « Marque vérifiée » | Les deux premiers sont des **arbitrages de visibilité** (`06` Q1, RGPD : une raison sociale peut être le nom d'une personne physique) ; le troisième dépend de la liste des registres consultables (`06` Q7). Ce sont des déplacements de colonnes sans reprise de droits, à faire dès l'arbitrage rendu — `product-owner` + `expert-conformite-rgpd` |
| `07`, écart 2 | La ville doit passer de la couche jamais révélée à la couche révélable | **Q2 de `07`** est ouverte ; la valeur d'attente conservatrice (maintien en couche identifiante) est conservée |
| `08`, écarts 4, 7 et 8 | Motifs typés, issues et délais sur `verification.disputes` ; compteur de demandes et de refus par triplet (RG60) ; version des instructions de capture acceptée au dépôt | Trois ajouts additifs et peu coûteux, hors de la liste des 34 corrections demandées. À traiter dans la même migration `0206` dès validation de `product-owner` et `expert-conformite-rgpd` (le troisième est une pièce de preuve RGPD, `08` Q2) |

### 12.7 Points à valider, ouverts par les spécifications `12` et `13` (2026-09-19)

Même règle qu'au §12.6 : chacun de ces points a été **tranché dans le sens le plus conservateur**
pour que le modèle ne comporte pas de manque, et chacun peut être rouvert par son arbitre.

| # | Point | Choix conservateur retenu | Arbitre |
|---|---|---|---|
| 1 | ~~**Moment de création de l'affaire (`billing.deals`)**~~ | **TRANCHÉ le 2026-09-19 par `chef-de-projet` — et dans le sens inverse de ma proposition.** L'affaire est créée **automatiquement, à l'état `open`, dans la transaction de révélation**, une par mise en relation (`03` C(21) étape 4, `13` RG74, `01` §6). **Raison décisive :** sans affaire, une mise en relation **perdue** n'a nulle part où porter son **motif de perte typé**, et la donnée de transformation attendue par **A8** disparaît. Mon objection de dépendance entre migrations était fondée et se règle autrement : **six tables `billing` sont avancées au Lot 4** (migration `0402a`, juste avant `0402`) ; seules la **saisie** des montants et la table des règlements (`commission_receipts`) restent au Lot 5. Détail et conséquences au **§5.6** | **Clos** — `chef-de-projet`, 2026-09-19 |
| 2 | **Un fil archivé peut-il être rouvert ?** `12` RG22 autorise la réouverture d'un fil **clos** ; l'archivage intervient 90 jours après la clôture et RG111 précise qu'un fil archivé reste lisible | **Non au MVP** : `archived` n'a **aucune transition sortante** dans `messaging.conversation_state_transitions`. Rouvrir une négociation endormie depuis trois mois produit une **nouvelle** mise en relation, donc une preuve d'intermédiation neuve — ce qui est plus sain pour la créance V2. Ouvrir cette transition est **une ligne de données**, si le produit le demande | `product-owner` (`12` Q7) |
| 3 | **PDF dans le canal de documents, et absence d'analyse antivirale** — `12` RG68 liste PDF, PNG, JPEG ; `03` **E1-9** refuse le PDF au MVP, et **E1-11** demande explicitement la réouverture du sujet antiviral « si un canal de documents est ouvert » | **`application/pdf` n'est pas chargé dans la contrainte tant que les deux conditions d'E1-9 ne sont pas tenues** (origine distincte, `Content-Disposition: attachment`). Ajouter une valeur à un `CHECK` n'est pas une migration destructive ; en retirer une l'est | **`expert-cybersecurite` — veto** (`12` Q5) + Fondateur pour le périmètre du canal |
| 4 | **Base légale de la prise de connaissance de la supervision** — `identity.terms_acceptances.nature = 'acknowledgement'` (`12` RG104) | La ligne est enregistrée comme une **prise de connaissance**, jamais comme un consentement, et la contrainte de base l'empêche d'être présentée autrement. **La qualification juridique, elle, n'est pas tranchée ici** | **`expert-conformite-rgpd` — veto** (`12` Q1) + juriste |
| 5 | **Conservation des refus de partie et de leurs motifs** — `13` Q11 | Conservation **au même titre que la mise en relation** (les colonnes vivent sur `introductions`), donc **sans purge propre** : purger le motif d'un refus laisserait une mise en relation refusée sans raison. Le motif reste **invisible de l'autre partie pour toujours**, ce qui est une règle d'accès, pas de durée | `expert-conformite-rgpd` — **veto** |
| 6 | **Plafond de 10 documents par mise en relation** (`12` RG68) | Tenu par **déclencheur**, pas par `CHECK` : une contrainte ne peut pas compter des lignes sœurs. Même schéma que les plafonds de candidature (§5.6), donc **atomique sous concurrence**. La valeur part dans `backoffice.operational_settings` | `product-owner` (valeur) ; la forme est tranchée |
| 7 | **Durée de conservation des documents et de leur journal de téléchargement** | Alignée sur les messages : **3 ans après la clôture du fil** (§9.1). Les octets sortent du Storage à la même échéance ; le journal, qui ne contient aucun contenu, reste | `expert-conformite-rgpd` — **veto** |

### 12.8 Points à valider, ouverts par les spécifications `14` et `15` (2026-09-19)

| # | Point | Choix conservateur retenu | Arbitre |
|---|---|---|---|
| 1 | **Écriture d'une affaire réservée au commercial responsable** (`14` RG39 vs `03` §3.5, qui l'accorde à tout agent) | **Non tranché ici, volontairement** — c'est une règle d'autorisation, pas de modélisation. La base pose ce qu'il faut pour l'appliquer si elle est retenue (`deals.owner_agent_id not null`, historique dans `backoffice.ownership_assignments`) et **rien qui l'empêche**. Aucune contrainte de propriétaire n'est écrite tant que `03` n'a pas tranché | `expert-cybersecurite` + `chef-de-projet` (`14` **Q7**) |
| 2 | **Quatre délais de file proposés et non validés** — `verification_disputes` 5 j, `team_selection` 1 j, `lead_sync_failures` et `email_delivery_incidents` 2 j | Chargés **marqués `is_provisional = true`** dans `backoffice.sla_policies`. Une proposition ne doit pas devenir une règle par simple écoulement du temps ; la colonne rend l'état visible dans le tableau de bord | `chef-de-projet` + `product-owner` (`15` **Q2 à Q4**) |
| 3 | **Encaissement en espèces** (`14` Q2) | Le mode `especes` **reste saisissable** — il faut pouvoir enregistrer un fait déjà survenu — mais exige une note et lève une alerte. **C'est l'exploitation qui l'interdit pendant le pilote, pas le schéma** : un schéma qui empêche d'enregistrer la réalité produit des données fausses | **Fondateur** + expert-comptable |
| 4 | **Exemption nommée du contrôle T16 pour la conversion d'unité monétaire** (`14` E11) | Documentée au §5.9. **À porter dans `03` §8 T16 et dans le plan de test** : sans exemption nommée, l'équipe désactivera le contrôle, et un contrôle désactivé ne protège rien | `expert-cybersecurite` (`03`) + `testeur` (`18`) |
| 5 | **Conservation du montant estimé d'un contournement** (`14` Q11) | Conservé avec l'affaire (10 ans) **en l'état**, faute de mieux : c'est une donnée personnelle indirecte **et une imputation non prouvée**. La proposition de `14` — conservation le temps de la fenêtre **D29** puis agrégation anonyme — est plus juste et **exige une purge partielle par colonne**, que je n'écris pas avant l'arbitrage | `expert-conformite-rgpd` — **veto** + Fondateur |
| 6 | **`data_subject_requests.request_type` contient `restriction`**, absent des cinq droits cités par `CLAUDE.md` §9 | **Conservé** : la limitation du traitement est un droit du RGPD (art. 18), et retirer une valeur d'une énumération après coup est une migration destructive, alors que l'ajouter ne l'est pas | `expert-conformite-rgpd` (`15` **Q6**) |
| 7 | **`claim_expiry_minutes` global ou par file** (`15`, écart 9) | **Global**, position actuelle, cohérente avec les six documents qui écrivent tous « 30 minutes ». Le passage à une valeur par file est **une colonne sur `backoffice.queues`**, pas une refonte | `chef-de-projet` |
| 8 | **Seuil d'abandon de créance exigeant l'accord du fondateur** (`14` Q5) et **délais de l'alerte « montant non saisi »** (`14` Q13) | Chargés comme **valeurs d'attente** dans `operational_settings` : 500,00 EUR, 14 j puis 30 j. En table, donc recalibrables sans déploiement | **Fondateur** + `chef-de-projet` |
| 9 | **Six durées de conservation nouvelles** (notes internes, alertes, exports, encaissements, suspensions, journal d'envoi) | Proposées au §9.1, dans le sens le plus conservateur pour les pièces comptables (10 ans) et le plus court pour les données de pilotage (24 mois) | `expert-conformite-rgpd` — **veto** |

### 12.9 Points à valider, ouverts par la spécification `16` (2026-09-19)

| # | Point | Choix conservateur retenu | Arbitre |
|---|---|---|---|
| 1 | **Conservation des envois d'e-mails** (`16` écart 11, Q5) | **3 ans** sur `created_at` pour `email_sends` et `email_send_recipients`, **13 mois** pour `leads.transactional_sends` — qui est un diagnostic, pas une preuve. **Valeurs d'attente** | `expert-conformite-rgpd` — **veto** |
| 2 | **Suivi nominatif des ouvertures et des clics** (`16`, écart 8 avec la skill) | **Rien en base.** Aucune colonne d'ouverture ni de clic n'existe sur `email_send_recipients` : agrégat par défaut, nominatif **par exception seulement**. Ajouter la colonne « au cas où » reviendrait à décider par défaut ce qui doit être décidé explicitement | `expert-conformite-rgpd` — **veto** + `expert-marketing` |
| 3 | **Webhooks Brevo sans signature** (`16`, écart 1 avec la skill — vérifié le 2026-09-19 : ni HMAC, ni JWT, ni en-tête de signature) | Côté base, la parade est l'**idempotence par contrainte** : `provider_message_id` **unique** sur les deux journaux d'envoi, `provider_event_id` **unique** sur `identity.email_delivery_incidents`. Un webhook rejoué ou forgé en double **échoue à l'écriture**. Cela ne remplace pas l'authentification de l'appelant | **`expert-cybersecurite` — veto** |
| 4 | **Le code de connexion n'est jamais coupé par l'interrupteur** (`16` RG122) | **Aucune contrainte de base ne peut le garantir** — c'est le worker qui lit la priorité. La base y contribue par une seule chose, et elle compte : `transactional_sends.priority` est **`not null` sans valeur par défaut**, donc un envoi P0 est toujours reconnaissable. **Contrôle attendu du document `18`** | `architecte` + `testeur` |
| 5 | **Seuils de cadence et de déclenchement automatique de l'interrupteur** (`16` RG123) | En configuration (`operational_settings`), **valeurs d'attente**, recalibrées après un mois de mesure | `expert-marketing` + **Fondateur** |
| 6 | **`email_send_recipients.send_source` est une quatrième dénormalisation** | Assumée : c'est la **seule** façon d'écrire de façon déclarative « aucune ligne pour un segment Brevo » — un `CHECK` ne lit pas la table parente. Même nature que `billing.deals.revealed_at` (§10.8) | `architecte` |

### 12.10 Points à valider, ouverts par D43 (2026-09-19)

| # | Point | Choix conservateur retenu | Arbitre |
|---|---|---|---|
| 1 | **Le rôle `influx_auth`** — un sixième rôle applicatif, porteur du seul chemin d'authentification | Créé et **cantonné** : `INSERT` sur `leads.transactional_sends`, `UPDATE` sur ses **cinq colonnes d'issue**, écriture des compteurs de débit, **et rien d'autre**. Ce n'est **pas** `influx_service`, dont le périmètre est bien plus large. `03` P7 le prévoit déjà en opération élevée **E-1** ; seuls les droits de table sont ajoutés ici. **Nom et périmètre exacts à confirmer** | **`expert-cybersecurite` — veto** |
| 2 | **Purge des utilisateurs GoTrue orphelins à 24 h** (`02` §18.5, **E-4**) | **24 heures**, par l'API d'administration, **jamais par un `DELETE` sur le schéma `auth`**, rapprochement sur `auth_user_id` et **jamais sur l'adresse**. Le délai est un compromis entre la fenêtre de reprise d'une inscription interrompue et la surface d'énumération | **`expert-cybersecurite`** + `expert-conformite-rgpd` |
| 3 | **Un échec de cause (b) ne doit pas consommer le quota par adresse** (`02` §18.5, corollaire) | Écrit en commentaire sur `denied_count`, **non implémenté en contrainte** : c'est une règle du code appelant, la base ne sait pas d'où vient l'incrément. Sinon une panne de trois minutes chez Brevo verrouille un quart d'heure ceux qui ont réessayé — **la panne survivrait à la panne** | **`expert-cybersecurite`** |
| 4 | **Empreinte plutôt qu'adresse en clair** dans `auth_request_throttle` | **Empreinte avec poivre serveur.** Une table de compteurs en clair serait un annuaire des adresses sollicitées, **y compris celles qui n'auront jamais de compte**. Le poivre doit vivre en variable d'environnement, jamais en base — sans quoi l'empreinte ne protège de rien | **`expert-cybersecurite`** (skill `env-secrets`) |
| 5 | **Plafond de la grappe de connexions élevée de `apps/api`** (garde-fou **G5**, valeur de départ 5) | **Hors du modèle de données**, mais il m'est adressé : je retiens **5 connexions** comme valeur de départ, à mesurer dès que le volume réel du pilote est connu. C'est ce plafond, et non une priorité, qui empêche une rafale de `P0` d'assécher le worker | `architecte` + `expert-database` |
| 6 | **Risque résiduel de la cause (a)** — un refus du fournisseur portant sur l'adresse apprend qu'elle a déjà reçu un e-mail d'INFLUX | **Accepté et écrit**, conformément à `02` §18.5 : très en deçà d'une énumération de comptes, non exploitable à l'échelle (20 demandes/heure/IP), et le supprimer coûterait le message unique que `05` RG60 refuse. Côté base, la garantie est **l'absence de toute consultation préalable** de `email_status` ou des incidents — aucune requête du chemin d'envoi ne les lit | **`expert-cybersecurite` — veto** |

### 12.11 Points ouverts par les arbitrages du fondateur du 2026-09-24

Ajoutés par la revue de cohérence (`19-revue-de-coherence-2026-09-24.md`). Ce sont des décisions
**prises** ; il reste à les traduire dans le schéma.

| # | Arbitrage | Conséquence à modéliser | Arbitre de la forme |
|---|---|---|---|
| 1 | **D46** — jamais d'e-mail, de téléphone ni de page de contact servis à un membre | Le `GRANT` de révélation sur `profiles.advertiser_contact_details` (§6.2 d) se limite au **prénom** ; e-mail, téléphone et page de contact ne reçoivent **aucun** droit du rôle `influx_creator`, révélation ou non | `expert-database` + `expert-cybersecurite` (veto) |
| 2 | **D45** — révélation à la seconde acceptation | Déjà conforme : `introductions_reveal_requires_both_acceptances` (§5.6). Rien à changer | — |
| 3 | **D47** — apartés privés du commercial avec une seule partie | Un canal par conversation (commun · marque · créateur), porté **en base** avec une politique d'accès par canal ; la détection, les curseurs de lecture et le journal des lectures doivent connaître le canal. **Traduit le 2026-09-24 : §5.7.1.** Les sept besoins de `12` §K sont modélisés, plus un huitième découvert en chemin : `conversations.last_message_at` trahissait l'existence d'un aparté et est remplacée par une activité par canal. A1, A3 et A4 tranchées ou faites le 2026-09-24 ; **reste A2** (les deux fonctions `security definer` ajoutées, avis de `expert-cybersecurite`) | `expert-database` + `expert-cybersecurite` (veto) |
| 4 | **D42** — renouvellement par proposition INFLUX | Un lien vers la mise en relation d'origine (par exemple `renews_introduction_id`), et une exception à `introductions_active_pair_idx` pour ce seul cas, une fois l'affaire précédente terminée | `expert-database` + `product-owner` (définition de « terminée ») |
| 5 | **D48** — aucun net estimé affiché pendant le pilote | Les bornes nettes de `reference.price_bands` (§12.6 point 1) **ne sont pas nécessaires au pilote** : colonnes laissées vides, aucune lecture par l'application | `expert-paiement-facturation` |
| 6 | **D50** — écriture d'une affaire réservée au responsable et à l'administrateur | Condition `owner_agent_id = appelant` pour le rôle `influx_agent` sur les écritures de `billing.deals` (§12.8 point 1, désormais tranché) | `expert-database` + `expert-cybersecurite` |
| 7 | **D52** — suivi de livraison par le commercial (`14` RG105 à RG108) | Sur `billing.deals` : date de publication prévue et réelle, lien de publication, date de validation par la marque, note ; qualificatif `delivery_status` (`attendue` · `publiee` · `validee` · `en_retard`), historisé comme les montants. Aucun droit pour les rôles membres | `expert-database` |
| 8 | **D53** — registre des relations préexistantes (`14` RG110, RG111) | Table en ajout seul (par exemple `matching.pre_existing_relationships`) : les deux parties, date déclarée du début de la relation, déclarant (`advertiser` · `creator` · `agent`), auteur, horodatage ; alimentée aussi par le motif `pre_existing_relationship` (`13` RG87). Durée de conservation à fixer | `expert-database` + `expert-conformite-rgpd` (veto) |
| 9 | **D54** — invitations nominatives (`05` RG116 à RG119) | Table des invitations : code unique, adresse, rôle proposé, langue, auteur (`agent` ou `admin`), expiration, date d'utilisation, compte créé ; attribution du commercial responsable à l'inscription (`backoffice.ownership_assignments`) | `expert-database` + `expert-cybersecurite` |
| 10 | **D55** — source d'acquisition (`05` RG120 à RG122) | Colonnes figées à la création du compte : `utm_source`, `utm_medium`, `utm_campaign`, domaine d'origine, code d'invitation, réponse déclarative (liste fermée en référentiel) ; jamais modifiées | `expert-database` + `expert-conformite-rgpd` |

### 12.12 Points ouverts par l'arbitrage du fondateur du 2026-09-25 — D61, métriques prioritaires des créateurs

Décision **prise** : pour chaque réseau, INFLUX suit en priorité la **taille de la communauté**, le
**rythme de publication** et le **nombre moyen de commentaires par publication** (`07` §E bis, RG113
à RG119 ; `08` RG38bis). Il reste à la traduire dans le schéma, sans rien changer aux règles de revue
du §5.2 (**vitrine : tranches et codes seulement**).

| # | Conséquence à modéliser | Forme proposée | Arbitre de la forme |
|---|---|---|---|
| 1 | **Deux valeurs exactes** sur l'objet révélable `profiles.creator_social_accounts` | `posts_last_30_days integer check (>= 0)` et `avg_comments_per_post bigint check (>= 0)`, toutes deux `not null` pour une ligne publiable ; **ajoutées au `GRANT` de révélation**, avec `figures_source` et `figures_measured_at` (mêmes trois conditions que §5.2) | `expert-database` + `expert-cybersecurite` (veto, §12.1 point 3) |
| 2 | **Deux codes** sur la vitrine `profiles.creator_public_networks` | `publication_frequency_code` (existe déjà) devient **`not null` et dérivé** de `posts_last_30_days`, plus jamais saisi ; nouvelle colonne `comment_band` (FK `reference.comment_bands`), `not null`, **servie même non vérifiée** (`07` RG117, contrairement à `engagement_band`) | `expert-database` |
| 3 | **Bornes numériques** sur `reference.publication_frequencies` | `min_posts_30d smallint not null`, `max_posts_30d smallint` nullable ; valeurs de départ de `07` RG114 ; libellé `biweekly` affiché « deux fois par mois » | `expert-database` + `expert-matching` (`07` Q16) |
| 4 | **Nouveau référentiel** `reference.comment_bands` | `code`, `min_comments bigint not null`, `max_comments bigint` nullable, `label_key`, `introduced_at`, `retired_at` ; valeurs de départ 0-9 · 10-49 · 50-199 · 200-999 · 1 000+ ; migration `0201` | `expert-database` + `expert-matching` (`07` Q16) |
| 5 | **Constat de l'agent** sur `verification.badges` | `observed_posts_last_30_days`, `observed_avg_comments`, `declared_posts_at_decision`, `declared_comments_at_decision` ; **obligatoires** pour `level = 'audience_verified'` (contrainte `check`) ; aucune colonne de texte de commentaire | `expert-database` |
| 6 | **Historique** des trois métriques prioritaires (`07` RG119) | Table en ajout seul, couche N (par exemple `profiles.creator_network_metrics_history`) : ligne de réseau, abonnés, publications sur 30 jours, commentaires moyens, source (`declared` · `agent_observed`), date de mesure, auteur. **Aucun droit pour le rôle annonceur**, lecture par `agent` et `admin` | `expert-database` + `expert-conformite-rgpd` (veto, durée : `07` Q18) |
| 7 | **Date de ligne renouvelée seulement si les trois métriques sont confirmées** (`07` RG116) | Contrôle dans la fonction d'écriture de `packages/domain`, pas dans un déclencheur : la confirmation est une intention de l'utilisateur, pas un état de la ligne | `architecte` |

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
| `packages/contracts` | Les types `enum` PostgreSQL de ce document (statuts de mise en relation, états d'affaire, rôles, origines) sont la **source** des unions fermées zod. Un écart entre les deux doit faire échouer la compilation. **Ajoutés en 2026-09-19** : `campaigns.campaign_status` (six valeurs), `campaigns.remuneration_kind`, `campaigns.audience_dimension`, `matching.expiry_reason`, `matching.submission_kind`, `profiles.profile_status` (**cinq** valeurs, l'ajout de `suspended` **casse tout `switch` exhaustif existant — c'est voulu**), `profiles.profile_kind`, `profiles.revision_status`, `verification.badge_state` (**cinq** valeurs).
**Ajoutés en seconde passe le 2026-09-19** (`12`, `13`) : `matching.party_side`,
`matching.introduction_email_kind`, `matching.email_status`, `identity.acceptance_nature`,
`messaging.conversation_state` (**cinq** valeurs), `messaging.access_surface`,
`messaging.detection_type`, `messaging.review_outcome`, `messaging.moderation_status`, et
**deux valeurs de plus** sur des types existants — `matching.expiry_reason` passe à **sept**
(`no_creator_answer`, `no_answer_both_parties`) et `identity.document_kind` à **quatre**
(`supervision_notice`) : **les `switch` exhaustifs existants cessent de compiler, c'est voulu**.
**Ajoutés en troisième passe** (`14`, `15`) : `billing.receipt_kind`, `billing.payment_method`,
`billing.tax_basis`, `billing.commission_payer`, `billing.estimate_confidence`,
`backoffice.export_kind`, `backoffice.note_subject`, `backoffice.alert_nature`,
`backoffice.dual_control_state`, `backoffice.dsr_channel` — et surtout **`billing.deal_state`
change deux fois** : `cancelled` **entre**, `stalled` et `disputed` **sortent** (`14` E5, E6).
Ce dernier point casse tout `switch` écrit sur l'ancienne liste, **et c'est exactement le but** :
un litige n'est pas un état, et le code doit être relu là où il le croyait. Trois schémas zod sont en outre exigés par les `jsonb` à liste fermée : `search.search_settings`, `backoffice.operational_settings`, `campaigns.campaign_published_snapshots.payload` |
| `apps/api` — domaine `campaigns` | **Le rôle créateur ne lit jamais la ligne vivante d'une campagne** : il lit `campaign_published_snapshots`. Toute route qui sert une campagne à un créateur depuis `campaigns.campaigns` est un défaut bloquant — c'est ce qui protège `total_budget_minor` autrement que par un `GRANT` de colonne à ne pas oublier |
| `apps/api` — affichage des montants | **Aucune multiplication d'un montant par un taux, nulle part.** Le net créateur affiché vient de `reference.price_bands.net_min_amount_minor` / `net_max_amount_minor`, lu tel quel. Si ces colonnes sont nulles pour la devise, **le net n'est pas affiché** — jamais estimé à la volée (`09` RG59, `07` RG72, contrôle T16) |
| `packages/domain` — plafonds | Les plafonds de candidature ne sont **jamais** vérifiés par un `count(*)` suivi d'une insertion : on insère, et on traite l'échec de contrainte (`campaigns_applications_within_cap`, `application_quotas_within_cap`) comme la réponse « candidatures closes ». C'est la seule forme correcte sous concurrence |
| `packages/domain` (Lot 2) | Porte le **découpage anonyme / révélable / identifiant** et le **calcul des tranches**. Fonctions pures, testées : ce sont elles qui garantissent qu'aucune valeur exacte n'atterrit dans la vitrine |
| `apps/web` — prototype `AccountForm.tsx` | Les champs du prototype correspondent à `accounts` : e-mail, pays, langue, attestation de majorité, consentement — **plus deux champs à ajouter** : le **statut déclaré** (particulier / professionnel, sans valeur pré-sélectionnée, RG18) et le **nom d'entreprise** côté annonceur (RG11, qui alimente `profiles.advertiser_profiles`). Le rôle part dans `account_roles`, **le consentement devient une ligne de `consent_events`, pas une colonne**, et la case reste non pré-cochée |
| `apps/api/src/domains/billing` | **Vide de tout calcul au MVP.** Il n'expose que la lecture et l'écriture de `deals`, avec des contrôles d'addition et de comparaison. **Il ne crée pas l'affaire** : elle naît dans `matching.reveal_identity()` à l'état `open` (§5.6), dès le **Lot 4**. Toute route qui insère dans `billing.deals` est un défaut — il n'y a qu'une porte |
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
- [x] **34 corrections des documents `06` à `11` intégrées (2026-09-19)** ; les arbitrages qui
      dépassent le périmètre de `expert-database` sont tranchés au plus conservateur et listés
      au **§12.6**, avec les trois écarts délibérément non tranchés
- [x] **16 corrections des documents `12` et `13` intégrées (2026-09-19, seconde passe)** :
      neuf tables ajoutées, huit tables modifiées, **35 codes d'événements**, sept points
      conservateurs au **§12.7**. Le contrat d'appel des fonctions de révélation appartient à
      `expert-cybersecurite` (`03` C(21a) à C(21d)) et n'a pas été touché ici
- [x] **Affaire créée à la révélation** (arbitrage `chef-de-projet`, 2026-09-19) : les quatre tables
      `billing` sont **avancées au Lot 4**, migration `0402a` avant `0402`, et l'alerte A6 devient un
      index partiel sur `deals (revealed_at) where state = 'open'` (§5.6, §10.7, §11.2)
- [x] **Écarts `14` (E1 à E11) et `15` (12 points) intégrés (2026-09-19, troisième passe)** :
      11 tables ajoutées, 8 modifiées, 23 codes d'événements, 6 durées de conservation, 17 index.
      L'écart bloquant E1 (encaissement unique) est corrigé par `billing.commission_receipts`
- [x] **D43 intégrée (2026-09-19, cinquième passe)** : `transactional_sends` documentée comme
      **journal et non file**, droits posés, trois `failure_code`, **aucun index sur `status`**,
      purge GoTrue à 24 h rattachée à **E-4**, et `identity.auth_request_throttle` ajoutée
- [x] **11 écarts du document `16` intégrés (2026-09-19, quatrième passe)** : 4 tables ajoutées,
      5 modifiées, 2 durées de conservation, 6 index, file et alertes amorcées. **Aucune adresse
      recopiée quand un compte existe**, sur aucune des trois tables d'envoi
- [x] **Aucun export nominatif possible** : `backoffice.exports` est documentée comme
      **agrégée seulement**, `05` RG106 abrogée, alignement sur `03` C(17)
- [x] **Noms des fonctions de contexte unifiés** entre `03` et `04` (§4.1, encadré du 2026-09-19) :
      substitution d'identifiants dans `03`, aucune règle d'autorisation modifiée

---

**Ce document ne modifie aucun autre fichier.** Les mises à jour de `CLAUDE.md` relèvent de
`chef-de-projet`. Les questions d'autorisation relèvent de `docs/mvp/03-matrice-des-droits-et-rls.md`.
