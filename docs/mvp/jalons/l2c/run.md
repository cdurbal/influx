# Exécution du jalon L2C

| # | Fichier | Type | Modèle | Effort | Agent | État | Note |
|---|---|---|---|---|---|---|---|
| 01 | 01.md | arbitrage | opus | xhigh | architecte | fait | `l2c/file.md` (noms définitifs), D81 ; RG6 tenu : seules les fonctions de `influx_moderation_definer` publient ; escalade 960 |
| 02 | 02.md | commit | sonnet | high | dev-react-node | fait | PLK-1 : 5 fichiers de routes + `action-guards.ts` (≤ 303 l.), `actions-routes.ts` reste le point d’enregistrement et ré-exporte les gardes ; comportement constant, aucun test modifié |
| 03 | 03.md | commit | sonnet | medium | dev-react-node | fait | PLS-7 : `UnverifiedNote` sur pile, page de l’occurrence et du groupe (navigateur seul, route non nulle), jamais cliquable ; J9S-7 soldé (L2A) ; plancher 5 à 8 |
| 04 | 04.md | commit | opus | high | expert-database | fait | I-4. `0206` : file 1 (480, 240, escalade 960), `operational_settings` (`claim_expiry_minutes` = 30, lecture `aal2`, aucune écriture), `business_deadline()` déterministe, sans jours fériés, EXECUTE à personne (05 l'accorde à son appelant) ; plancher tm3 17 à 37 |
| 05 | 05.md | commit | opus | high | expert-database | fait | I-4. `0207` : `moderated_fields` (6), motifs (8), `advertiser_review_entries` (une `open` par compte, échéances figées par déclencheur), `profile_field_revisions`, jeton `advertiser_review_token()` jamais stocké ; la soumission ouvre l'entrée ; `business_deadline()` à `influx_identity_definer` seul ; export et effacement étendus (E-5) |
| 06 | 06.md | commit | opus | high | expert-database | fait | I-4. `0208` (`in_review`), `0209` : déclencheur `guard_advertiser_member_write()` sur 11 tables (L2C-G1 à G5 vus rouges sans lui), porte RG9 `submit_own_advertiser_revision()`, jamais une décision (politiques), logo en examen, actif servi, aucune purge ; L2BS-1 côté membre soldé, L2BT-3, L2BT-7 |
| 07 | 07.md | commit | opus | high | expert-database | fait | I-4. `0210` : `influx_moderation_definer` (A5), prise par transition conditionnelle (L2C-V1 vu rouge par mutation), relâche, prolongation, levée forcée (motif, admin) ; publier et refuser au titulaire d’un verrou vivant, profil verrouillé avant le jeton, révisions appliquées, `profile.decision`, `profile.completed` une fois puis `lead.updated` ; doublons RG25, RG70 |
| 08 | — | commit | — | — | — | ignoré | RG71 reporté au Lot 5 (réponse 1 du fondateur, 2026-11-03) ; CA22 en `21` §8 à la clôture |
| 09a | 09a.md | commit | opus | high | expert-database | fait | I-4. `0211` : charge de `profile.decision` + `email_code` (publier, refuser recréées, clé inchangée) ; `leads.read_brevo_profile_decision()` (`influx_leads_definer`, worker seul) : décision, motif, message, langue ; jamais `internal_comment`, aucune ligne si compte effacé ; avant 09 (décision du fondateur) |
| 09 | 09.md | commit | sonnet | high | expert-integrations-api | fait | I-10. `profile.decision` dans `WORKER_RENDERED_EMAILS`, rendu `profiles/brand-decision-email.ts`, textes `email.profileDecision` (RG66 mot pour mot) ; décision lue à la consommation (`readProfileDecision`), adresse par `read_brevo_subject` ; « Autre » échappé, refusé par RG158 s’il ressemble à un lien ; aucune migration |
| 10 | 10.md | commit | sonnet | high | expert-integrations-api | à faire | |
| 11 | 11.md | commit | sonnet | high | dev-react-node | à faire | |
| 12 | 12.md | commit | sonnet | high | dev-react-node | à faire | |
| 13 | 13.md | commit | sonnet | high | dev-react-node | à faire | |
| 14 | 14.md | arbitrage | opus | xhigh | architecte | à faire | Sur recommandation `testeur` ; éclats autorisés, borne de 8 min inchangée (réponse 2) |
| 15 | 15.md | commit | sonnet | high | dev-react-node | à faire | e2e ≤ 4 s |
| 16 | 16.md | commit | sonnet | high | dev-react-node | à faire | e2e ≤ 6 s |
| 17 | 17.md | commit | sonnet | high | dev-react-node | à faire | e2e ≤ 8 s |
| 18 | 18.md | commit | sonnet | high | dev-react-node | à faire | e2e ≤ 2 s |
| 19 | recette.md | fondateur | — | — | fondateur | à faire | |
| R | revue.md | revue | — | — | testeur + expert-cybersecurite | à faire | |
| C | cloture.md | cloture | sonnet | medium | testeur | à faire | |
