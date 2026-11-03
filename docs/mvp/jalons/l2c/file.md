# L2C — file 1 : objet et règles de décision (L2C-01)
> `architecte`, 2026-11-03, D81. **Prime sur les prompts 04 à 18 et la fiche § Écarts pour tout nom.**

**A1 — Entrée.** `profiles.advertiser_review_entries`, une `open` au plus par compte (index unique partiel) : verrou,
échéances, décision globale (RG65) ; révisions rattachées. *Raison :* RG63 liste un profil, une soumission n'a pas
de révision. Énums `profiles.review_entry_kind` (`submission`, `revision`), `profiles.review_entry_state` (`open`,
`published`, `rejected`, `withdrawn`). Colonnes : `id`, `account_id`, `kind`, `state`, `created_at`, `sla_due_at`,
`escalate_at`, `claimed_by_account_id`, `claimed_at`, `claim_expires_at`, `forced_release_at`,
`forced_release_by_account_id`, `forced_release_holder_account_id`, `forced_release_reason_code`,
`decided_by_account_id`, `decided_at`, `rejection_reason_code`, `member_message`, `internal_comment`, `closed_at`,
`sla_breached` (générée, `04` l. 2238), `updated_at` ; index `(sla_due_at, created_at) where state = 'open'`.
`profile_field_revisions` (`04` l. 1448) : sans verrou, décision, motif ni `sla_due_at` ; + `advertiser_review_entry_id
not null`, `closed_at`. Marque : lit ses entrées (sans verrou, agent ni `internal_comment`) et ses révisions ;
`agent`, `admin` en `aal2`, `account_id <> current_account_id()` (C(3)) ; aucune écriture directe. Effacement :
révisions supprimées, textes vidés, entrée ouverte `withdrawn` ; export sans `internal_comment`, agent ni verrou. (05)

**A2 — État.** `status` reste `published` pendant une révision (`04` l. 1476) ; l'API sert `pendingWithPublished` si une
entrée `revision` est ouverte. *Raison :* seule lecture où la version validée reste visible, comme le dit RG84.
Refus d'une révision : `published` ; refus d'une soumission : `rejected`.

**A3 — Écriture pendant l'examen.** Permise : directe hors `published`, révision en `published`. Jeton = empreinte,
`profiles.advertiser_review_token(p_account_id uuid) returns text` (sha256 hex du profil, des huit listes, de
l'interlocuteur, des logos `active` et `in_review`, des révisions en attente), jamais stocké, rendu à l'ouverture,
recalculé à la décision ; différent : 55000 `stale_token`, relecture « modifié après examen », saisie gardée.
Révision remplacée : `superseded` ; égale à la validée : `withdrawn` ; plus rien en attente : entrée `withdrawn`
(sortie écrite, C7). *Raison :* aucun déclencheur sur dix tables ; un retour à l'identique ne force aucune relecture.
Vue et jeton lus dans une transaction `repeatable read` (11).

**A4 — Champs modérés.** `profiles.profile_kind` (`advertiser`, `creator`) ; `moderated_fields` (`label_key` = `field.` +
code) : `advertiser.brand_name` (`legal_name`), `advertiser.logo`, `advertiser.presentation`,
`advertiser.website_domain`, `advertiser.contact_role`, `advertiser.primary_sector`. Secteurs secondaires et pays :
immédiats (listes fermées, RG13). Tout changement, retrait compris, est une révision ; obligatoire vidé : 23514.
Logo : `brand_logo_state` + `in_review` (un par compte) ; en `published`, `activate_brand_logo` pose `in_review` et
dépose `{"logo_object_id": id}`, `remove_own_brand_logo` dépose `{"logo_object_id": null}` ; l'actif reste servi,
aucune purge avant décision. Gel : déclencheur invoker `profiles.guard_advertiser_member_write()` (profil, huit
listes, interlocuteur, logos) : si `current_user` est `influx_advertiser` ou `influx_identity_definer`, `published`
refuse une colonne modérée active, `suspended` toute écriture (55000). Portes (`influx_identity_definer`, EXECUTE
`influx_advertiser`) : `profiles.submit_own_advertiser_revision(p_field_code text, p_value jsonb)` →
`(revision_status, entry_id)`, appelée aussi par `identity.update_own_account` (nom ; suspendu : 55000) et par le
logo ; `profiles.record_own_advertiser_profile_change()` → `lead.updated` si `published` (appel de 13). Valeur :
type et obligatoire à la porte, contraintes de la colonne à l'approbation (l'API valide avant, RG14). (06)

**A5 — Propriétaire.** `influx_moderation_definer` (NOLOGIN NOINHERIT, sans membre, créé en 07). *Raison :* il écrit
l'état et les champs d'autrui, `influx_identity_definer` est borné à la ligne de l'appelant : réunis, une porte
membre atteindrait la publication. Droits colonne par colonne, signature `expert-cybersecurite` (D71).

**A6 — Motifs.** `profiles.advertiser_rejection_reasons` (`code`, `label_key` = `reason.profiles_advertiser.` + code,
`message_key` = `profileDecision.reason.` + code, `requires_member_message`, `position`, `is_active`) :
`contact_in_public_field`, `presentation_insufficient`, `logo_non_compliant`, `misleading_brand_name`,
`sector_inconsistent`, `illicit_content`, `duplicate_brand`, `other` (seul `requires_member_message`, le
`requires_comment` du prompt 05). `member_message` : 20 à 500 caractères, texte brut, pour `other` seul, RG19
appliqué par l'API (12) ; `internal_comment` : ≤ 1 000, facultatif, jamais au membre, à l'e-mail ni au registre.
Textes : `apps/api/src/locales/{fr,en}/email.json` seul, servis aussi à l'aperçu (11) et au membre (13).

**A7 — Détection.** RG19 (e-mail, URL, domaine, téléphone de 8 chiffres ou plus, `@pseudo`, messageries ; adresse
postale non détectée) et L2BS-8 (non ASCII ou `xn--` : alerte seule) : pures, `packages/domain/src/brand-profile/`
(11). RG25, RG70 en SQL seul (07) : `profiles.normalized_brand_name(text)` IMMUTABLE (`lower`, `normalize(NFKD)`,
sans U+0300 à U+036F, espace ni ponctuation ; moins de 2 caractères : rien) ;
`profiles.advertiser_duplicate_candidates(p_account_id uuid, p_brand_name text, p_website_domain text)` →
`(account_id, matched_on)` (`brand_name`, `domain`), profils `published` d'autrui, 5 au plus, invoker, `agent`,
`admin`. Rien n'est stocké.

**A8 — Dépossession.** `backoffice.claim_release_reasons` (`code`, `label_key` = `reason.claim_release.` + code,
`is_active`) : `holder_absent`, `overdue_entry`, `wrong_claim`. Titulaire informé par `bo.queue.claim.forcedRelease`
(« Votre prise en charge a été levée par {admin} à {time} : {reason}. ») à sa prochaine ouverture ou action.
*Raison, sans e-mail :* `internal-email.ts` sert les alertes P0 d'administrateur ; l'avis n'importe qu'au retour.

**A9 — Expiration.** `claim_expires_at` = prise + `claim_expiry_minutes` ; tenu ⇔ titulaire et `claim_expires_at >
now()`. Sans tâche : la prise suivante ou la clôture écrit d'abord `queue.claim_expired` (instant réel) ; C7
garantit la reprise. Prolonger : titulaire, verrou tenu, `now() + claim_expiry_minutes`, journalisé.

**A10 — Adresses.** `/files/profils-marque`, `/files/profils-marque/[id]` (entrée) ; `GET /v1/bo/queues/counters`,
`GET /v1/bo/queues/profiles-advertiser/entries`, `POST …/entries/:id/` + `open`, `publish`, `reject`, `release`,
`extend`, `force-release` (admin).

## Fonctions (07) et échéance (04)

`SECURITY DEFINER`, `search_path = ''`, `influx_moderation_definer`, EXECUTE `influx_agent`, `influx_admin`, `aal2` et
compte propre vérifiés : `profiles.open_advertiser_review_entry(p_entry_id uuid)` → `(outcome, holder_account_id,
claimed_at, claim_expires_at, review_token)`, `outcome` `claimed` · `held` · `read_only` · `closed`, prise `where state
= 'open' and (claimed_by_account_id is null or claim_expires_at <= now())` ; `release_advertiser_review_entry(uuid)` ;
`extend_advertiser_review_claim(uuid)` ; `force_release_advertiser_review_claim(uuid, p_reason_code text)` (admin) ;
`publish_advertiser_review_entry(uuid, p_review_token text, p_internal_comment text)` ;
`reject_advertiser_review_entry(uuid, p_review_token text, p_reason_code text, p_member_message text,
p_internal_comment text)`. Décision : révisions `approved` (appliquées) ou `rejected`, état,
`advertiser_profiles.first_published_at` (écrit une fois) ; `profile.decision` (`brevo_transactional`, priorité 100,
clé `profile.decision:<entry_id>`) ; `profile.completed` (clé `profile.completed:<account_id>`) à la première
publication, sinon `lead.updated`. Refus : 42501 inconnu, propre, rôle ; 55P03 verrou (DETAIL titulaire ou `none`) ;
55000 `stale_token` ou `entry_closed` ; 23514 obligatoire ; 22023 `reason` ou `member_message`.
`backoffice.business_deadline(p_queue_code text, p_from timestamptz, p_minutes integer)` (STABLE, invoker ; horaires
NULL : calendaire) : `sla_due_at` (`target_decision_minutes`), `escalate_at` (+ `escalate_after_minutes`). File 1 :
480, 240, **960** (3 j ouvrés d'ancienneté, RG7 ; prime sur le 1440 du prompt 04).

## Codes `audit.event_types` (domain, subject_type, severity ; commit)

- `profile.submitted` (existant, + `entry_id`), `profile.revision_submitted`, `profile.revision_withdrawn` (`field_code`,
  `entry_id`) : `profiles`, `advertiser_profile`, `info` (05, 06).
- `profile.published`, `profile.rejected` (`entry_id`, `kind`, `fields` ou `reason_code`, `late`) : `profiles`,
  `advertiser_profile`, `sensitive` (07).
- `queue.entry_opened` (`outcome`), `queue.claim_forced_release` (`holder_account_id`, `reason_code`) : `backoffice`,
  `queue_entry`, `sensitive` (07).
- `queue.claim_released`, `queue.claim_extended`, `queue.claim_expired` (`holder_account_id`, `claimed_at`,
  `expired_at`) : `backoffice`, `queue_entry`, `info` (07). Toute charge `queue.*` porte `queue_code`.
- File seule : `profile.completed` (`leads`, `account`, `info`), `profile.decision` (`profiles`, `queue_entry`, `info`).

Levée tentée par un agent : `backoffice.action_refused`. Coordonnées : `queue.entry_opened` ; sur la fiche,
`history.account_read` (`15` RG40). Aucun texte libre au registre.

## Amendements (commit qui l'applique)

- `04` l. 1446-1480, 6127 (05) : A1 ; §5.2, §5.11 (05 à 07) ; §4.3, §5.10, l. 2465-2480 (07) : codes,
  `queue.claim_forced_release` au L2C, A8, A9.
- `06` RG9, CA15, RG10 (13) : A2, A4 ; RG63, RG64, l. 668 (07) : A3, A9 ; RG66, RG68 (09) : A6, et « Contenu
  illicite » : « Votre profil contient un élément contraire aux conditions d'utilisation d'INFLUX. » / « Your
  profile contains content that breaches the INFLUX terms of use. », relu en porte de production (`21` §5.8).
- `03` P7 (06, 07) : A4, A5 ; C(20) (07) : A9, aucune tâche du worker.
- `15` (07) : C3 sans commentaire de relâche (registre sans texte libre), Prolonger ; C4 : A8 ; RG35. RG29 file 1 (04) : 960.
- `16` l. 794 (09) : clé `profile.decision:<entry_id>`, rendu par le worker depuis `email.json` (D69).

## Écarts et relecture

- EC-L2C-01-1 : environ 11 Ko au lieu de 4 : noms exacts, codes et amendements tenus dans un seul fichier.
- EC-L2C-01-2 : liste obligatoire vidée par écriture immédiate en `published` : refusée par l'API (13), recontrôlée
  à chaque publication.
- EC-L2C-01-3 : Lot 5 : la suspension clôt l'entrée (`withdrawn`) ; L2G aligne `07` l. 1049 sur A3.

Invariants 1 à 17 relus sans contradiction ; 4 (jeton), 7 (codes) et 14 (960) précisés ici.
