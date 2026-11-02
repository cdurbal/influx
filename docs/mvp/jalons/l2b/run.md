# Exécution du jalon L2B

| # | Fichier | Type | Modèle | Effort | Agent | État | Note |
|---|---|---|---|---|---|---|---|
| 01 | 01.md | commit | sonnet | high | testeur | fait | Liste fermée des modèles de route (`contracts/route-models`), inconnu = `unmatched` ; garde J4S-7 sur tout `src/app` ; toutes les contraintes check de 0201 (inventaire, refus par nom, mutation) ; contiguïté `price_bands` reportée (table vide, D78) |
| 02 | 02.md | arbitrage | opus | xhigh | architecte | fait | D80, `stockage.md` : logo par le passe-plat (2 Mio), aucune URL signée (E1-3 intenable : URL Supabase de 2 h) ; `sharp` 0.35.5, `storage-js` 2.117.2 ; ligne avant objet, purge E-4 |
| 03 | 03.md | commit | sonnet | high | integrateur | fait | `storage-api` hors de `-x` (imgproxy exclu), contrôle `/storage/v1/status` par la passerelle dans `db` et `e2e` ; `supabase start` local ×3 : sans 31/25/26 s, avec 28/27/27 s (images en cache, aucun surcoût) ; `db reset` neuf : `storage.buckets` a `file_size_limit` et `allowed_mime_types` ; mesure CI à relever au push ; I-4 |
| 04 | 04.md | commit | sonnet | high | dev-react-node | fait | `@influx/domain` sans dépendance (lint : seuls imports relatifs) ; complétude sur les points atteignables 82 (budget D78 et badge L2E `offered: false`), score entier jamais 100 si incomplet ; obligatoires en camelCase (12 codes, budget suspendu), parité 06 par conversion snake_case ; plancher 25 cas |
| 05 | 05.md | commit | opus | xhigh | expert-database | fait | `0202` : 9 colonnes nullables (aucun budget, réponse A), 8 listes à clé étrangère, plafonds par `slot` (PK), `none` refusé ; `advertiser_contact_details` sans aucun droit créateur (D46), interne en aal2 ; `status`/`legal_name` hors `GRANT` membre ; export complet, effacement de toutes les colonnes saisies (EC-L2B-05-1 à 6) ; I-4 |
| 06 | 06.md | commit | opus | high | expert-database | à faire | I-4 ; suite base |
| 07 | 07.md | commit | sonnet | high | dev-react-node | à faire | |
| 08 | 08.md | commit | opus | high | expert-database | à faire | I-4 ; suite base |
| 09 | 09.md | commit | opus | high | dev-react-node | à faire | I-4 si CSP ; dépendances : suite complète |
| 10 | 10.md | commit | sonnet | high | dev-react-node | à faire | |
| 11 | 11.md | commit | sonnet | high | dev-react-node | à faire | e2e ≤ 12 s |
| 12 | 12.md | commit | sonnet | high | dev-react-node | à faire | e2e ≤ 4 s |
| 13 | 13.md | commit | sonnet | high | dev-react-node | à faire | e2e ≤ 4 s |
| 14 | recette.md | fondateur | — | — | fondateur | à faire | Recette `staging`, arrêt |
| R | revue.md | revue | — | — | testeur + expert-cybersecurite | à faire | |
| C | cloture.md | cloture | sonnet | medium | testeur | à faire | |
